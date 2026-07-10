import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleRepository } from './role.repository';
import { PermissionRepository } from './permission.repository';
import { UserRoleRepository } from './user-role.repository';
import { RolePermissionRepository } from './role-permission.repository';
import { AuthorizationService } from './authorization.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

describe('RoleService', () => {
  let service: RoleService;
  let roleRepo: jest.Mocked<RoleRepository>;
  let permissionRepo: jest.Mocked<PermissionRepository>;
  let userRoleRepo: jest.Mocked<UserRoleRepository>;
  let rolePermissionRepo: jest.Mocked<RolePermissionRepository>;
  let authorizationService: jest.Mocked<AuthorizationService>;

  const createMockRole = (name: string, isSystem = false): Role => ({
    id: `role-${name.toLowerCase()}`,
    name,
    description: `${name} role`,
    isSystem,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Role);

  const createMockPermission = (resource: string, action: string): Permission => ({
    id: `perm-${resource}-${action}`,
    resource,
    action,
    description: `${resource}:${action}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    getPermissionString: jest.fn().mockReturnValue(`${resource}:${action}`),
  } as unknown as Permission);

  beforeEach(async () => {
    const mockRoleRepo = {
      findByName: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      findWithPermissions: jest.fn(),
    };

    const mockPermissionRepo = {
      findOne: jest.fn(),
    };

    const mockUserRoleRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findRolesByUserId: jest.fn(),
    };

    const mockRolePermissionRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const mockAuthorizationService = {
      invalidatePermissionCache: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: RoleRepository, useValue: mockRoleRepo },
        { provide: PermissionRepository, useValue: mockPermissionRepo },
        { provide: UserRoleRepository, useValue: mockUserRoleRepo },
        { provide: RolePermissionRepository, useValue: mockRolePermissionRepo },
        { provide: AuthorizationService, useValue: mockAuthorizationService },
        { provide: LoggerService, useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    roleRepo = module.get(RoleRepository);
    permissionRepo = module.get(PermissionRepository);
    userRoleRepo = module.get(UserRoleRepository);
    rolePermissionRepo = module.get(RolePermissionRepository);
    authorizationService = module.get(AuthorizationService);
  });

  describe('assignRole', () => {
    it('should successfully assign role to user', async () => {
      // Arrange
      const userId = 'user-123';
      const roleId = 'role-member';
      const adminId = 'admin-123';
      const role = createMockRole('MEMBER');

      roleRepo.findOne.mockResolvedValue(role);
      userRoleRepo.findOne.mockResolvedValue(null); // Role not already assigned
      userRoleRepo.save.mockResolvedValue(undefined);
      authorizationService.invalidatePermissionCache.mockResolvedValue(undefined);

      // Act
      await service.assignRole(userId, roleId, adminId);

      // Assert
      expect(roleRepo.findOne).toHaveBeenCalledWith({ where: { id: roleId } });
      expect(userRoleRepo.save).toHaveBeenCalled();
      expect(authorizationService.invalidatePermissionCache).toHaveBeenCalledWith(userId);
    });

    it('should throw ForbiddenException on self-assignment', async () => {
      // Arrange
      const userId = 'user-123';
      const roleId = 'role-admin';

      // Act & Assert
      await expect(service.assignRole(userId, roleId, userId)).rejects.toThrow(ForbiddenException);
      await expect(service.assignRole(userId, roleId, userId)).rejects.toThrow('Cannot self-assign roles');
    });

    it('should throw NotFoundException if role not found', async () => {
      // Arrange
      const userId = 'user-123';
      const roleId = 'nonexistent-role';
      const adminId = 'admin-123';
      roleRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.assignRole(userId, roleId, adminId)).rejects.toThrow(NotFoundException);
    });

    it('should be idempotent (succeed if role already assigned)', async () => {
      // Arrange
      const userId = 'user-123';
      const roleId = 'role-member';
      const adminId = 'admin-123';
      const role = createMockRole('MEMBER');
      const existingAssignment = { userId, roleId };

      roleRepo.findOne.mockResolvedValue(role);
      userRoleRepo.findOne.mockResolvedValue(existingAssignment as any);

      // Act
      await service.assignRole(userId, roleId, adminId);

      // Assert
      expect(userRoleRepo.save).not.toHaveBeenCalled();
    });

    it('should invalidate permission cache after assignment', async () => {
      // Arrange
      const userId = 'user-123';
      const roleId = 'role-member';
      const adminId = 'admin-123';
      const role = createMockRole('MEMBER');

      roleRepo.findOne.mockResolvedValue(role);
      userRoleRepo.findOne.mockResolvedValue(null);
      userRoleRepo.save.mockResolvedValue(undefined);

      // Act
      await service.assignRole(userId, roleId, adminId);

      // Assert
      expect(authorizationService.invalidatePermissionCache).toHaveBeenCalledWith(userId);
    });
  });

  describe('revokeRole', () => {
    it('should successfully revoke role from user', async () => {
      // Arrange
      const userId = 'user-123';
      const roleId = 'role-member';
      const adminId = 'admin-123';
      const assignment = { userId, roleId };

      userRoleRepo.findOne.mockResolvedValue(assignment as any);
      userRoleRepo.delete.mockResolvedValue(undefined);
      authorizationService.invalidatePermissionCache.mockResolvedValue(undefined);

      // Act
      await service.revokeRole(userId, roleId, adminId);

      // Assert
      expect(userRoleRepo.findOne).toHaveBeenCalledWith({ where: { userId, roleId } });
      expect(userRoleRepo.delete).toHaveBeenCalledWith({ userId, roleId });
      expect(authorizationService.invalidatePermissionCache).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException if assignment not found', async () => {
      // Arrange
      const userId = 'user-123';
      const roleId = 'role-member';
      const adminId = 'admin-123';
      userRoleRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.revokeRole(userId, roleId, adminId)).rejects.toThrow(NotFoundException);
    });

    it('should invalidate permission cache after revocation', async () => {
      // Arrange
      const userId = 'user-123';
      const roleId = 'role-member';
      const adminId = 'admin-123';
      const assignment = { userId, roleId };

      userRoleRepo.findOne.mockResolvedValue(assignment as any);
      userRoleRepo.delete.mockResolvedValue(undefined);

      // Act
      await service.revokeRole(userId, roleId, adminId);

      // Assert
      expect(authorizationService.invalidatePermissionCache).toHaveBeenCalledWith(userId);
    });
  });

  describe('createCustomRole', () => {
    it('should successfully create custom role', async () => {
      // Arrange
      const name = 'CustomRole';
      const description = 'Custom role description';
      const adminId = 'admin-123';
      const newRole = createMockRole(name, false);

      roleRepo.findByName.mockResolvedValue(null);
      roleRepo.save.mockResolvedValue(newRole);

      // Act
      const result = await service.createCustomRole(name, description, adminId);

      // Assert
      expect(roleRepo.findByName).toHaveBeenCalledWith(name);
      expect(roleRepo.save).toHaveBeenCalled();
      expect(result).toEqual(newRole);
    });

    it('should throw ConflictException if role name already exists', async () => {
      // Arrange
      const name = 'ExistingRole';
      const existingRole = createMockRole(name);
      roleRepo.findByName.mockResolvedValue(existingRole);

      // Act & Assert
      await expect(service.createCustomRole(name, 'desc', 'admin-123')).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if using system role name', async () => {
      // Arrange
      const systemRoleNames = ['ADMIN', 'TEAM_LEAD', 'MEMBER', 'OBSERVER'];

      for (const name of systemRoleNames) {
        roleRepo.findByName.mockResolvedValue(null);

        // Act & Assert
        await expect(service.createCustomRole(name, 'desc', 'admin-123')).rejects.toThrow(BadRequestException);
      }
    });
  });

  describe('deleteCustomRole', () => {
    it('should successfully delete custom role', async () => {
      // Arrange
      const roleId = 'role-custom';
      const adminId = 'admin-123';
      const customRole = createMockRole('CustomRole', false);
      const usersWithRole = [{ id: 'user-1' }, { id: 'user-2' }];

      roleRepo.findOne.mockResolvedValue(customRole);
      userRoleRepo.findRolesByUserId.mockResolvedValue(usersWithRole as any);
      roleRepo.save.mockResolvedValue({ ...customRole, deletedAt: new Date() });

      // Act
      await service.deleteCustomRole(roleId, adminId);

      // Assert
      expect(roleRepo.save).toHaveBeenCalled();
      expect(authorizationService.invalidatePermissionCache).toHaveBeenCalledTimes(usersWithRole.length);
    });

    it('should throw NotFoundException if role not found', async () => {
      // Arrange
      roleRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteCustomRole('nonexistent', 'admin-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if trying to delete system role', async () => {
      // Arrange
      const systemRole = createMockRole('ADMIN', true);
      roleRepo.findOne.mockResolvedValue(systemRole);

      // Act & Assert
      await expect(service.deleteCustomRole(systemRole.id, 'admin-123')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignPermissionsToRole', () => {
    it('should successfully assign permissions to role', async () => {
      // Arrange
      const roleId = 'role-custom';
      const permissionIds = ['perm-1', 'perm-2'];
      const adminId = 'admin-123';
      const role = createMockRole('CustomRole');
      const permissions = [createMockPermission('task', 'create'), createMockPermission('task', 'read')];
      const usersWithRole = [{ id: 'user-1' }, { id: 'user-2' }];

      roleRepo.findOne.mockResolvedValue(role);
      permissionRepo.findOne.mockResolvedValueOnce(permissions[0]).mockResolvedValueOnce(permissions[1]);
      rolePermissionRepo.findOne.mockResolvedValue(null);
      rolePermissionRepo.save.mockResolvedValue(undefined);
      userRoleRepo.findRolesByUserId.mockResolvedValue(usersWithRole as any);

      // Act
      await service.assignPermissionsToRole(roleId, permissionIds, adminId);

      // Assert
      expect(rolePermissionRepo.save).toHaveBeenCalledTimes(2);
      expect(authorizationService.invalidatePermissionCache).toHaveBeenCalledTimes(usersWithRole.length);
    });

    it('should be idempotent for already assigned permissions', async () => {
      // Arrange
      const roleId = 'role-custom';
      const permissionIds = ['perm-1'];
      const adminId = 'admin-123';
      const role = createMockRole('CustomRole');
      const permission = createMockPermission('task', 'create');
      const existingAssignment = { roleId, permissionId: permissionIds[0] };

      roleRepo.findOne.mockResolvedValue(role);
      permissionRepo.findOne.mockResolvedValue(permission);
      rolePermissionRepo.findOne.mockResolvedValue(existingAssignment as any);
      userRoleRepo.findRolesByUserId.mockResolvedValue([]);

      // Act
      await service.assignPermissionsToRole(roleId, permissionIds, adminId);

      // Assert
      expect(rolePermissionRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if permission not found', async () => {
      // Arrange
      const roleId = 'role-custom';
      const permissionIds = ['nonexistent-perm'];
      const adminId = 'admin-123';
      const role = createMockRole('CustomRole');

      roleRepo.findOne.mockResolvedValue(role);
      permissionRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.assignPermissionsToRole(roleId, permissionIds, adminId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserRoles', () => {
    it('should return all roles for user', async () => {
      // Arrange
      const userId = 'user-123';
      const roles = [createMockRole('MEMBER'), createMockRole('TEAM_LEAD')];
      userRoleRepo.findRolesByUserId.mockResolvedValue(roles);

      // Act
      const result = await service.getUserRoles(userId);

      // Assert
      expect(userRoleRepo.findRolesByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(roles);
    });
  });
});
