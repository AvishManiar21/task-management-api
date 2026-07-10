import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationService } from './authorization.service';
import { UserRepository } from '../user/user.repository';
import { UserRoleRepository } from './user-role.repository';
import { RolePermissionRepository } from './role-permission.repository';
import { CacheService } from '@common/infrastructure/cache/cache.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { MetricsService } from '@common/infrastructure/metrics/metrics.service';
import { User } from '../user/user.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let userRepo: jest.Mocked<UserRepository>;
  let userRoleRepo: jest.Mocked<UserRoleRepository>;
  let rolePermissionRepo: jest.Mocked<RolePermissionRepository>;
  let cacheService: jest.Mocked<CacheService>;
  let metricsService: jest.Mocked<MetricsService>;

  // Test data factory
  const createMockRole = (name: string): Role => ({
    id: `role-${name.toLowerCase()}`,
    name,
    description: `${name} role`,
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Role);

  const createMockPermission = (resource: string, action: string): Permission => ({
    id: `perm-${resource}-${action}`,
    resource,
    action,
    description: `${resource}:${action} permission`,
    createdAt: new Date(),
    updatedAt: new Date(),
    getPermissionString: jest.fn().mockReturnValue(`${resource}:${action}`),
  } as unknown as Permission);

  const createMockUser = (overrides?: Partial<User>): User => ({
    id: '11111111-1111-1111-1111-111111111111',
    auth0Id: 'auth0|123456',
    email: 'test@example.com',
    emailVerified: true,
    name: 'Test User',
    picture: null,
    displayName: null,
    timezone: 'UTC',
    language: 'en',
    notificationPreferences: {},
    teamId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    deletedAt: null,
    canBeAssignedTasks: jest.fn().mockReturnValue(true),
    getDisplayName: jest.fn().mockReturnValue('Test User'),
    isActiveUser: jest.fn().mockReturnValue(true),
    ...overrides,
  } as unknown as User);

  beforeEach(async () => {
    // Create mock implementations
    const mockUserRepo = {
      findOne: jest.fn(),
    };

    const mockUserRoleRepo = {
      findRolesByUserId: jest.fn(),
    };

    const mockRolePermissionRepo = {
      findPermissionsByRoleIds: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockMetricsService = {
      incrementCounter: jest.fn(),
      setGauge: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: UserRoleRepository, useValue: mockUserRoleRepo },
        { provide: RolePermissionRepository, useValue: mockRolePermissionRepo },
        { provide: CacheService, useValue: mockCacheService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: LoggerService, useValue: { setContext: jest.fn(), log: jest.fn(), debug: jest.fn(), warn: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthorizationService>(AuthorizationService);
    userRepo = module.get(UserRepository);
    userRoleRepo = module.get(UserRoleRepository);
    rolePermissionRepo = module.get(RolePermissionRepository);
    cacheService = module.get(CacheService);
    metricsService = module.get(MetricsService);
  });

  describe('hasPermission', () => {
    const userId = 'user-123';

    it('should return true for exact permission match', async () => {
      // Arrange
      const permissions = ['user:create', 'task:read', 'task:update'];
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const result = await service.hasPermission(userId, 'task:read');

      // Assert
      expect(result).toBe(true);
      expect(cacheService.get).toHaveBeenCalledWith(`user:${userId}:permissions`);
    });

    it('should return true for wildcard permission (*:*)', async () => {
      // Arrange
      const permissions = ['*:*']; // Admin wildcard
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const result = await service.hasPermission(userId, 'any:action');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for resource-level wildcard (task:*)', async () => {
      // Arrange
      const permissions = ['task:*'];
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const resultCreate = await service.hasPermission(userId, 'task:create');
      const resultUpdate = await service.hasPermission(userId, 'task:update');
      const resultDelete = await service.hasPermission(userId, 'task:delete');

      // Assert
      expect(resultCreate).toBe(true);
      expect(resultUpdate).toBe(true);
      expect(resultDelete).toBe(true);
    });

    it('should return false if permission not found', async () => {
      // Arrange
      const permissions = ['user:read', 'task:read'];
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const result = await service.hasPermission(userId, 'user:delete');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for user with no permissions', async () => {
      // Arrange
      cacheService.get.mockResolvedValue([]);

      // Act
      const result = await service.hasPermission(userId, 'task:create');

      // Assert
      expect(result).toBe(false);
    });

    it('should load permissions from cache if available', async () => {
      // Arrange
      const cachedPermissions = ['user:create'];
      cacheService.get.mockResolvedValue(cachedPermissions);

      // Act
      await service.hasPermission(userId, 'user:create');

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(`user:${userId}:permissions`);
      expect(metricsService.incrementCounter).toHaveBeenCalledWith('cache_operations_total', {
        operation: 'get',
        result: 'hit',
      });
    });
  });

  describe('getUserPermissions', () => {
    const userId = 'user-123';

    it('should return cached permissions if available', async () => {
      // Arrange
      const cachedPermissions = ['user:create', 'task:read'];
      cacheService.get.mockResolvedValue(cachedPermissions);

      // Act
      const result = await service.getUserPermissions(userId);

      // Assert
      expect(result).toEqual(cachedPermissions);
      expect(cacheService.get).toHaveBeenCalledWith(`user:${userId}:permissions`);
      expect(metricsService.incrementCounter).toHaveBeenCalledWith('cache_operations_total', {
        operation: 'get',
        result: 'hit',
      });
      expect(userRoleRepo.findRolesByUserId).not.toHaveBeenCalled();
    });

    it('should load permissions from database on cache miss', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null); // Cache miss
      const roles = [createMockRole('MEMBER')];
      const permissions = [
        createMockPermission('task', 'create'),
        createMockPermission('task', 'read'),
      ];
      userRoleRepo.findRolesByUserId.mockResolvedValue(roles);
      rolePermissionRepo.findPermissionsByRoleIds.mockResolvedValue(permissions);

      // Act
      const result = await service.getUserPermissions(userId);

      // Assert
      expect(result).toEqual(['task:create', 'task:read']);
      expect(userRoleRepo.findRolesByUserId).toHaveBeenCalledWith(userId);
      expect(rolePermissionRepo.findPermissionsByRoleIds).toHaveBeenCalledWith(['role-member']);
      expect(cacheService.set).toHaveBeenCalledWith(`user:${userId}:permissions`, ['task:create', 'task:read'], 300);
      expect(metricsService.incrementCounter).toHaveBeenCalledWith('cache_operations_total', {
        operation: 'get',
        result: 'miss',
      });
    });

    it('should return empty array if user has no roles', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      userRoleRepo.findRolesByUserId.mockResolvedValue([]);

      // Act
      const result = await service.getUserPermissions(userId);

      // Assert
      expect(result).toEqual([]);
      expect(rolePermissionRepo.findPermissionsByRoleIds).not.toHaveBeenCalled();
    });

    it('should handle multiple roles and union permissions', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      const roles = [createMockRole('MEMBER'), createMockRole('TEAM_LEAD')];
      const permissions = [
        createMockPermission('task', 'create'),
        createMockPermission('task', 'update'),
        createMockPermission('team', 'assign_members'),
      ];
      userRoleRepo.findRolesByUserId.mockResolvedValue(roles);
      rolePermissionRepo.findPermissionsByRoleIds.mockResolvedValue(permissions);

      // Act
      const result = await service.getUserPermissions(userId);

      // Assert
      expect(result).toHaveLength(3);
      expect(result).toContain('task:create');
      expect(result).toContain('task:update');
      expect(result).toContain('team:assign_members');
    });
  });

  describe('invalidatePermissionCache', () => {
    it('should delete permission cache for user', async () => {
      // Arrange
      const userId = 'user-123';
      cacheService.del.mockResolvedValue(undefined);

      // Act
      await service.invalidatePermissionCache(userId);

      // Assert
      expect(cacheService.del).toHaveBeenCalledWith(`user:${userId}:permissions`);
    });
  });

  describe('canUpdateUser', () => {
    it('should allow user to update own profile', async () => {
      // Arrange
      const userId = 'user-123';

      // Act
      const result = await service.canUpdateUser(userId, userId);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow admin to update any profile', async () => {
      // Arrange
      const adminId = 'admin-123';
      const targetUserId = 'user-456';
      const adminPermissions = ['user:update'];
      cacheService.get.mockResolvedValue(adminPermissions);

      // Act
      const result = await service.canUpdateUser(adminId, targetUserId);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny non-admin from updating other profiles', async () => {
      // Arrange
      const userId = 'user-123';
      const targetUserId = 'user-456';
      const permissions = ['task:create']; // No user:update permission
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const result = await service.canUpdateUser(userId, targetUserId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('canDeleteUser', () => {
    it('should allow admin to delete users', async () => {
      // Arrange
      const adminId = 'admin-123';
      const targetUserId = 'user-456';
      const adminPermissions = ['user:delete'];
      cacheService.get.mockResolvedValue(adminPermissions);

      // Act
      const result = await service.canDeleteUser(adminId, targetUserId);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny non-admin from deleting users', async () => {
      // Arrange
      const userId = 'user-123';
      const targetUserId = 'user-456';
      const permissions = ['task:create'];
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const result = await service.canDeleteUser(userId, targetUserId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('canBeAssignedTask', () => {
    it('should return true for verified active user', async () => {
      // Arrange
      const user = createMockUser({ emailVerified: true, isActive: true });
      userRepo.findOne.mockResolvedValue(user);

      // Act
      const result = await service.canBeAssignedTask(user.id);

      // Assert
      expect(result).toBe(true);
      expect(user.canBeAssignedTasks).toHaveBeenCalled();
    });

    it('should return false for unverified user', async () => {
      // Arrange
      const user = createMockUser({ emailVerified: false });
      user.canBeAssignedTasks = jest.fn().mockReturnValue(false);
      userRepo.findOne.mockResolvedValue(user);

      // Act
      const result = await service.canBeAssignedTask(user.id);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for inactive user', async () => {
      // Arrange
      const user = createMockUser({ isActive: false });
      user.canBeAssignedTasks = jest.fn().mockReturnValue(false);
      userRepo.findOne.mockResolvedValue(user);

      // Act
      const result = await service.canBeAssignedTask(user.id);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false if user not found', async () => {
      // Arrange
      userRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.canBeAssignedTask('nonexistent-user');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('canAssignRoles', () => {
    it('should return true for user with user:manage_roles permission', async () => {
      // Arrange
      const adminId = 'admin-123';
      const permissions = ['user:manage_roles'];
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const result = await service.canAssignRoles(adminId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for user without permission', async () => {
      // Arrange
      const userId = 'user-123';
      const permissions = ['task:create'];
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const result = await service.canAssignRoles(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('canAssignTeams', () => {
    it('should return true for user with team:assign_members permission', async () => {
      // Arrange
      const teamLeadId = 'lead-123';
      const permissions = ['team:assign_members'];
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const result = await service.canAssignTeams(teamLeadId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for user without permission', async () => {
      // Arrange
      const userId = 'user-123';
      const permissions = ['task:create'];
      cacheService.get.mockResolvedValue(permissions);

      // Act
      const result = await service.canAssignTeams(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Permission Caching Integration', () => {
    it('should cache permissions for 5 minutes (300 seconds)', async () => {
      // Arrange
      const userId = 'user-123';
      cacheService.get.mockResolvedValue(null);
      const roles = [createMockRole('MEMBER')];
      const permissions = [createMockPermission('task', 'create')];
      userRoleRepo.findRolesByUserId.mockResolvedValue(roles);
      rolePermissionRepo.findPermissionsByRoleIds.mockResolvedValue(permissions);

      // Act
      await service.getUserPermissions(userId);

      // Assert
      expect(cacheService.set).toHaveBeenCalledWith(`user:${userId}:permissions`, ['task:create'], 300);
    });

    it('should invalidate cache when roles change', async () => {
      // Arrange
      const userId = 'user-123';

      // Act
      await service.invalidatePermissionCache(userId);

      // Assert
      expect(cacheService.del).toHaveBeenCalledWith(`user:${userId}:permissions`);
    });
  });
});
