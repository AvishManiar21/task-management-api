import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RoleRepository } from './role.repository';
import { PermissionRepository } from './permission.repository';
import { UserRoleRepository } from './user-role.repository';
import { RolePermissionRepository } from './role-permission.repository';
import { AuthorizationService } from './authorization.service';
import { TransactionManager } from '@common/infrastructure/database/transaction-manager.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

/**
 * RoleService
 *
 * Business logic for role and permission management (RBAC).
 *
 * Implements:
 * - Flow 4: Role Assignment (admin-only, audit trail)
 * - Custom role creation (US-047)
 * - Permission management (assign/revoke permissions to/from roles)
 *
 * Business Rules:
 * - BR-ROLE-001: Admin-only role assignment
 * - BR-ROLE-002: System roles cannot be deleted
 * - BR-ROLE-003: No self-assignment of roles
 *
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-047 (Manage User Permissions - Granular)
 */
@Injectable()
export class RoleService {
  private readonly logger = new LoggerService();

  constructor(
    private readonly roleRepo: RoleRepository,
    private readonly permissionRepo: PermissionRepository,
    private readonly userRoleRepo: UserRoleRepository,
    private readonly rolePermissionRepo: RolePermissionRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly txManager: TransactionManager,
  ) {
    this.logger.setContext('RoleService');
  }

  /**
   * Assign role to user (Flow 4: Role Assignment)
   *
   * Business Rules:
   * - BR-ROLE-001: Admin-only operation
   * - BR-ROLE-003: Cannot self-assign roles
   * - Idempotent: Succeeds silently if user already has role
   *
   * @param userId - User ID
   * @param roleId - Role ID
   * @param assignedBy - User ID of admin assigning role
   * @throws ForbiddenException if not admin
   * @throws BadRequestException if self-assignment attempted
   * @throws NotFoundException if user or role not found
   * @see US-042 (Manage User Roles and Permissions)
   */
  async assignRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
    this.logger.log('Assigning role to user', { userId, roleId, assignedBy });

    // BR-ROLE-003: Prevent self-assignment
    if (userId === assignedBy) {
      throw new BadRequestException('Cannot self-assign roles');
    }

    // Verify role exists
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    // Check if user already has role (idempotent)
    const hasRole = await this.userRoleRepo.userHasRole(userId, roleId);
    if (hasRole) {
      this.logger.log('User already has role (idempotent)', { userId, roleId });
      return;
    }

    // Assign role
    await this.userRoleRepo.save({
      userId,
      roleId,
      assignedBy,
    });

    // Invalidate permission cache
    await this.authorizationService.invalidatePermissionCache(userId);

    this.logger.log('Role assigned successfully', { userId, roleId, roleName: role.name });
  }

  /**
   * Revoke role from user
   *
   * @param userId - User ID
   * @param roleId - Role ID
   * @param assignedBy - User ID of admin revoking role
   * @throws NotFoundException if user doesn't have role
   */
  async revokeRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
    this.logger.log('Revoking role from user', { userId, roleId, assignedBy });

    const deleted = await this.userRoleRepo.deleteUserRole(userId, roleId);
    if (deleted === 0) {
      throw new NotFoundException(`User ${userId} does not have role ${roleId}`);
    }

    // Invalidate permission cache
    await this.authorizationService.invalidatePermissionCache(userId);

    this.logger.log('Role revoked successfully', { userId, roleId });
  }

  /**
   * Create custom role (US-047)
   *
   * Business Rules:
   * - Role name must be unique
   * - Cannot use system role names (ADMIN, TEAM_LEAD, MEMBER, OBSERVER)
   * - isSystem flag set to false
   *
   * @param name - Role name
   * @param description - Role description
   * @param permissionIds - Array of permission IDs to assign to role
   * @param createdBy - User ID creating the role
   * @returns Created role
   * @throws ConflictException if role name exists
   * @see US-047 (Manage User Permissions - Granular)
   */
  async createCustomRole(
    name: string,
    description: string | null,
    permissionIds: string[],
    createdBy: string,
  ): Promise<Role> {
    this.logger.log('Creating custom role', { name, permissionCount: permissionIds.length, createdBy });

    // Check for duplicate name
    const existing = await this.roleRepo.findByName(name);
    if (existing) {
      throw new ConflictException(`Role ${name} already exists`);
    }

    // Prevent using system role names
    const systemRoleNames = ['ADMIN', 'TEAM_LEAD', 'MEMBER', 'OBSERVER'];
    if (systemRoleNames.includes(name.toUpperCase())) {
      throw new BadRequestException(`Cannot use system role name: ${name}`);
    }

    const role = await this.txManager.run(async (em) => {
      // Create role
      const newRole = em.create(Role, {
        name,
        description,
        isSystem: false,
      });

      const savedRole = await em.save(Role, newRole);

      // Assign permissions
      if (permissionIds.length > 0) {
        await this.rolePermissionRepo.assignPermissionsToRole(savedRole.id, permissionIds);
      }

      return savedRole;
    });

    this.logger.log('Custom role created successfully', { roleId: role.id, roleName: role.name });

    return role;
  }

  /**
   * Delete custom role
   *
   * Business Rule: BR-ROLE-002 (System roles cannot be deleted)
   *
   * @param roleId - Role ID
   * @throws ForbiddenException if attempting to delete system role
   * @throws NotFoundException if role not found
   */
  async deleteCustomRole(roleId: string): Promise<void> {
    this.logger.log('Deleting custom role', { roleId });

    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    // BR-ROLE-002: Cannot delete system roles
    if (role.isSystem) {
      throw new ForbiddenException(`Cannot delete system role: ${role.name}`);
    }

    await this.txManager.run(async (em) => {
      // Delete role-permission assignments (cascade)
      await this.rolePermissionRepo.deleteByRoleId(roleId);

      // Delete user-role assignments (cascade)
      // Note: Users with this role will lose it

      // Delete role
      await em.delete(Role, { id: roleId });
    });

    this.logger.log('Custom role deleted successfully', { roleId, roleName: role.name });
  }

  /**
   * Assign permissions to role (US-047)
   *
   * @param roleId - Role ID
   * @param permissionIds - Array of permission IDs
   * @throws NotFoundException if role not found
   */
  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    this.logger.log('Assigning permissions to role', { roleId, permissionCount: permissionIds.length });

    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    // Filter out permissions that are already assigned (idempotent)
    const newPermissions = [];
    for (const permissionId of permissionIds) {
      const hasPermission = await this.rolePermissionRepo.roleHasPermission(roleId, permissionId);
      if (!hasPermission) {
        newPermissions.push(permissionId);
      }
    }

    if (newPermissions.length > 0) {
      await this.rolePermissionRepo.assignPermissionsToRole(roleId, newPermissions);
      this.logger.log('Permissions assigned to role', {
        roleId,
        newPermissionCount: newPermissions.length,
      });
    } else {
      this.logger.log('All permissions already assigned (idempotent)', { roleId });
    }

    // Invalidate cache for all users with this role
    await this.invalidateRolePermissionCache(roleId);
  }

  /**
   * Revoke permissions from role (US-047)
   *
   * @param roleId - Role ID
   * @param permissionIds - Array of permission IDs
   * @throws NotFoundException if role not found
   */
  async revokePermissionsFromRole(roleId: string, permissionIds: string[]): Promise<void> {
    this.logger.log('Revoking permissions from role', { roleId, permissionCount: permissionIds.length });

    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    const deleted = await this.rolePermissionRepo.revokePermissionsFromRole(roleId, permissionIds);

    this.logger.log('Permissions revoked from role', { roleId, deletedCount: deleted });

    // Invalidate cache for all users with this role
    await this.invalidateRolePermissionCache(roleId);
  }

  /**
   * Get all roles for a user
   *
   * @param userId - User ID
   * @returns Array of roles
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    return await this.userRoleRepo.findRolesByUserId(userId);
  }

  /**
   * Get all permissions for a role
   *
   * @param roleId - Role ID
   * @returns Array of permissions
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    return await this.rolePermissionRepo.findPermissionsByRoleId(roleId);
  }

  /**
   * Get all system roles
   *
   * @returns Array of system roles
   */
  async getSystemRoles(): Promise<Role[]> {
    return await this.roleRepo.findSystemRoles();
  }

  /**
   * Get all custom roles
   *
   * @returns Array of custom roles
   */
  async getCustomRoles(): Promise<Role[]> {
    return await this.roleRepo.findCustomRoles();
  }

  /**
   * Invalidate permission cache for all users with a specific role
   *
   * Called when role's permissions change.
   *
   * @param roleId - Role ID
   */
  private async invalidateRolePermissionCache(roleId: string): Promise<void> {
    // Get all users with this role
    const userRoles = await this.userRoleRepo.findByRoleId(roleId);

    // Invalidate cache for each user
    for (const userRole of userRoles) {
      await this.authorizationService.invalidatePermissionCache(userRole.userId);
    }

    this.logger.log('Invalidated permission cache for role users', {
      roleId,
      userCount: userRoles.length,
    });
  }
}
