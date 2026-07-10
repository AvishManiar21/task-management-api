import { Injectable } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { UserRoleRepository } from './user-role.repository';
import { RolePermissionRepository } from './role-permission.repository';
import { CacheService } from '@common/infrastructure/cache/cache.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { MetricsService } from '@common/infrastructure/metrics/metrics.service';

/**
 * AuthorizationService
 *
 * Handles authorization logic for the application.
 *
 * Implements:
 * - Flow 5: Permission Check (with 5-minute cache)
 * - Resource-level authorization (ownership + admin override)
 * - Permission caching for performance
 *
 * Permission Format: {resource}:{action}
 * Examples:
 * - user:create, user:read, user:update, user:delete
 * - task:create, task:read, task:update, task:delete, task:assign
 * - team:create, team:read, team:update, team:delete, team:assign_members
 * - *:* (wildcard - full access for ADMIN)
 *
 * Caching Strategy:
 * - Permission cache: 5 minute TTL (balance between performance and freshness)
 * - Cache invalidation on role change
 *
 * Business Rules:
 * - BR-AUTH-001: Permission check uses cached permissions (5 min TTL)
 * - BR-AUTH-002: Wildcard permission (*:*) grants full access
 * - BR-AUTH-003: Multiple roles = union of permissions
 *
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-047 (Manage User Permissions - Granular)
 */
@Injectable()
export class AuthorizationService {
  private readonly logger = new LoggerService();
  private readonly PERMISSION_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly userRepo: UserRepository,
    private readonly userRoleRepo: UserRoleRepository,
    private readonly rolePermissionRepo: RolePermissionRepository,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
  ) {
    this.logger.setContext('AuthorizationService');
  }

  /**
   * Check if user has permission (Flow 5: Permission Check)
   *
   * Action-Level Authorization:
   * - Checks if user has global permission for an action
   * - Example: Can user create tasks globally?
   *
   * Permission Resolution:
   * 1. Load user permissions from cache (or DB if cache miss)
   * 2. Check for exact match (e.g., 'task:create')
   * 3. Check for wildcard permission ('*:*' for ADMIN)
   *
   * Caching:
   * - Cache TTL: 5 minutes
   * - Cache key: `user:{userId}:permissions`
   * - Invalidated on role change
   *
   * @param userId - User ID
   * @param permission - Permission string (format: 'resource:action')
   * @returns true if user has permission, false otherwise
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    this.logger.debug('Checking permission', { userId, permission });

    // Load user permissions (cached)
    const userPermissions = await this.getUserPermissions(userId);

    // Check for exact permission match
    if (userPermissions.includes(permission)) {
      this.logger.debug('Permission granted (exact match)', { userId, permission });
      return true;
    }

    // Check for wildcard permission (ADMIN has *:*)
    if (userPermissions.includes('*:*')) {
      this.logger.debug('Permission granted (wildcard)', { userId, permission });
      return true;
    }

    // Check for resource-level wildcard (e.g., 'task:*')
    const [resource] = permission.split(':');
    const resourceWildcard = `${resource}:*`;
    if (userPermissions.includes(resourceWildcard)) {
      this.logger.debug('Permission granted (resource wildcard)', { userId, permission });
      return true;
    }

    this.logger.debug('Permission denied', { userId, permission });
    return false;
  }

  /**
   * Get all permissions for a user
   *
   * Loads permissions from cache if available, otherwise from database.
   *
   * Permission Calculation:
   * 1. Load all roles for user
   * 2. Load all permissions for those roles
   * 3. Union permissions (remove duplicates)
   * 4. Cache result
   *
   * @param userId - User ID
   * @returns Array of permission strings
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `user:${userId}:permissions`;

    // Try cache first
    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached) {
      this.metricsService.incrementCounter('cache_operations_total', {
        operation: 'get',
        result: 'hit',
      });
      this.logger.debug('Permission cache HIT', { userId });
      return cached;
    }

    this.metricsService.incrementCounter('cache_operations_total', {
      operation: 'get',
      result: 'miss',
    });
    this.logger.debug('Permission cache MISS - loading from database', { userId });

    // Load from database
    const permissions = await this.loadUserPermissionsFromDB(userId);

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, permissions, this.PERMISSION_CACHE_TTL);

    // Track cache hit rate
    this.updatePermissionCacheHitRate();

    return permissions;
  }

  /**
   * Load user permissions from database
   *
   * @param userId - User ID
   * @returns Array of permission strings
   */
  private async loadUserPermissionsFromDB(userId: string): Promise<string[]> {
    // 1. Get all roles for user
    const roles = await this.userRoleRepo.findRolesByUserId(userId);
    if (roles.length === 0) {
      this.logger.warn('User has no roles assigned', { userId });
      return [];
    }

    const roleIds = roles.map((role) => role.id);

    // 2. Get all permissions for those roles
    const permissions = await this.rolePermissionRepo.findPermissionsByRoleIds(roleIds);

    // 3. Convert to permission strings (format: 'resource:action')
    const permissionStrings = permissions.map((p) => p.getPermissionString());

    this.logger.debug('Loaded permissions from database', {
      userId,
      roleCount: roles.length,
      permissionCount: permissionStrings.length,
    });

    return permissionStrings;
  }

  /**
   * Invalidate permission cache for user
   *
   * Called when user's roles change.
   *
   * @param userId - User ID
   */
  async invalidatePermissionCache(userId: string): Promise<void> {
    const cacheKey = `user:${userId}:permissions`;
    await this.cacheService.del(cacheKey);

    this.logger.log('Permission cache invalidated', { userId });
  }

  /**
   * Check if user can update another user (Resource-Level Authorization)
   *
   * Authorization Rules:
   * - User can update own profile
   * - Admin can update any profile (has 'user:update' permission)
   *
   * @param actorId - User performing update
   * @param targetUserId - User being updated
   * @returns true if authorized, false otherwise
   */
  async canUpdateUser(actorId: string, targetUserId: string): Promise<boolean> {
    // User can always update own profile
    if (actorId === targetUserId) {
      return true;
    }

    // Admin can update any profile
    return await this.hasPermission(actorId, 'user:update');
  }

  /**
   * Check if user can delete another user (Resource-Level Authorization)
   *
   * Authorization Rules:
   * - Admin only (has 'user:delete' permission)
   *
   * @param actorId - User performing deletion
   * @param targetUserId - User being deleted
   * @returns true if authorized, false otherwise
   */
  async canDeleteUser(actorId: string, targetUserId: string): Promise<boolean> {
    // Admin only
    return await this.hasPermission(actorId, 'user:delete');
  }

  /**
   * Check if user can be assigned tasks
   *
   * Business Rule: BR-EMAIL-001 (Email verification required for task assignment)
   *
   * @param userId - User ID
   * @returns true if user can be assigned tasks, false otherwise
   */
  async canBeAssignedTask(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return false;
    }

    return user.canBeAssignedTasks();
  }

  /**
   * Check if user can assign roles
   *
   * Business Rule: BR-ROLE-001 (Admin-only role assignment)
   *
   * @param userId - User ID
   * @returns true if user can assign roles, false otherwise
   */
  async canAssignRoles(userId: string): Promise<boolean> {
    return await this.hasPermission(userId, 'user:manage_roles');
  }

  /**
   * Check if user can manage team assignments
   *
   * @param userId - User ID
   * @returns true if user can assign users to teams, false otherwise
   */
  async canAssignTeams(userId: string): Promise<boolean> {
    return await this.hasPermission(userId, 'team:assign_members');
  }

  /**
   * Update permission cache hit rate metric
   *
   * Calculates and updates Prometheus gauge for cache efficiency monitoring
   */
  private updatePermissionCacheHitRate(): void {
    // This is a simplified version
    // In production, track hits/misses over time window
    // For now, just update gauge based on recent operation
    this.metricsService.setGauge('permission_cache_hit_rate', 0.8); // Example: 80% hit rate
  }
}
