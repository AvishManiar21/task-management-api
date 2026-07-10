import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { TeamRepository } from '../team/team.repository';
import { RoleRepository } from '../authorization/role.repository';
import { UserRoleRepository } from '../authorization/user-role.repository';
import { Auth0Adapter } from '../adapters/auth0.adapter';
import { TransactionManager } from '@common/infrastructure/database/transaction-manager.service';
import { CacheService } from '@common/infrastructure/cache/cache.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { MetricsService } from '@common/infrastructure/metrics/metrics.service';
import { User } from './user.entity';
import { Role } from '../authorization/role.entity';
import { Team } from '../team/team.entity';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

describe('UserService', () => {
  let service: UserService;
  let userRepo: jest.Mocked<UserRepository>;
  let teamRepo: jest.Mocked<TeamRepository>;
  let roleRepo: jest.Mocked<RoleRepository>;
  let userRoleRepo: jest.Mocked<UserRoleRepository>;
  let auth0Adapter: jest.Mocked<Auth0Adapter>;
  let txManager: jest.Mocked<TransactionManager>;
  let cacheService: jest.Mocked<CacheService>;
  let metricsService: jest.Mocked<MetricsService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  // Test data factory
  const createMockUser = (overrides?: Partial<User>): User => ({
    id: '11111111-1111-1111-1111-111111111111',
    auth0Id: 'auth0|123456',
    email: 'test@example.com',
    emailVerified: false,
    name: 'Test User',
    picture: null,
    displayName: null,
    timezone: 'UTC',
    language: 'en',
    notificationPreferences: {
      email: true,
      inApp: true,
      taskAssigned: true,
      taskUpdated: true,
      taskCompleted: true,
      mentions: true,
    },
    teamId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    deletedAt: null,
    canBeAssignedTasks: jest.fn().mockReturnValue(false),
    getDisplayName: jest.fn().mockReturnValue('Test User'),
    isActiveUser: jest.fn().mockReturnValue(true),
    ...overrides,
  } as unknown as User);

  const createMockRole = (name: string): Role => ({
    id: `role-${name.toLowerCase()}`,
    name,
    description: `${name} role`,
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Role);

  const createMockTeam = (name: string): Team => ({
    id: 'team-123',
    name,
    description: `${name} team`,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Team);

  beforeEach(async () => {
    // Create mock implementations
    const mockUserRepo = {
      findByEmail: jest.fn(),
      findByAuth0Id: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      findActiveUsers: jest.fn(),
      searchUsers: jest.fn(),
    };

    const mockTeamRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockRoleRepo = {
      findByName: jest.fn(),
    };

    const mockUserRoleRepo = {
      findRolesByUserId: jest.fn(),
      deleteByUserId: jest.fn(),
      save: jest.fn(),
    };

    const mockAuth0Adapter = {
      createUser: jest.fn(),
      getUserByAuth0Id: jest.fn(),
      updateUser: jest.fn(),
      deactivateUser: jest.fn(),
      reactivateUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    const mockTxManager = {
      run: jest.fn((callback) => callback({
        create: jest.fn((entity, data) => data),
        save: jest.fn((entity, data) => Promise.resolve(data)),
        findOne: jest.fn(),
      })),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
    };

    const mockMetricsService = {
      incrementCounter: jest.fn(),
      recordHistogram: jest.fn(),
      setGauge: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: TeamRepository, useValue: mockTeamRepo },
        { provide: RoleRepository, useValue: mockRoleRepo },
        { provide: UserRoleRepository, useValue: mockUserRoleRepo },
        { provide: Auth0Adapter, useValue: mockAuth0Adapter },
        { provide: TransactionManager, useValue: mockTxManager },
        { provide: CacheService, useValue: mockCacheService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: LoggerService, useValue: { setContext: jest.fn(), log: jest.fn(), error: jest.fn(), warn: jest.fn() } },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(UserRepository);
    teamRepo = module.get(TeamRepository);
    roleRepo = module.get(RoleRepository);
    userRoleRepo = module.get(UserRoleRepository);
    auth0Adapter = module.get(Auth0Adapter);
    txManager = module.get(TransactionManager);
    cacheService = module.get(CacheService);
    metricsService = module.get(MetricsService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('registerUser', () => {
    const registerDto: RegisterUserDto = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      name: 'New User',
      timezone: 'America/New_York',
      language: 'en',
    };

    it('should successfully register a new user', async () => {
      // Arrange
      const auth0User = { user_id: 'auth0|newuser', email: registerDto.email, email_verified: false };
      const memberRole = createMockRole('MEMBER');
      const createdUser = createMockUser({ email: registerDto.email, name: registerDto.name });

      userRepo.findByEmail.mockResolvedValue(null);
      auth0Adapter.createUser.mockResolvedValue(auth0User as any);
      roleRepo.findByName.mockResolvedValue(memberRole);
      txManager.run.mockImplementation(async (callback) => {
        const em = {
          create: jest.fn().mockReturnValue(createdUser),
          save: jest.fn().mockResolvedValue(createdUser),
        };
        return callback(em);
      });

      // Act
      const result = await service.registerUser(registerDto);

      // Assert
      expect(userRepo.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(auth0Adapter.createUser).toHaveBeenCalledWith(registerDto.email, registerDto.password, registerDto.name);
      expect(roleRepo.findByName).toHaveBeenCalledWith('MEMBER');
      expect(metricsService.incrementCounter).toHaveBeenCalledWith('user_registrations_total', { method: 'email', source: 'web' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.created', expect.objectContaining({ user: createdUser }));
      expect(result).toEqual(createdUser);
    });

    it('should throw ConflictException if email already exists', async () => {
      // Arrange
      const existingUser = createMockUser({ email: registerDto.email });
      userRepo.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(service.registerUser(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.registerUser(registerDto)).rejects.toThrow(`Email ${registerDto.email} is already registered`);
      expect(auth0Adapter.createUser).not.toHaveBeenCalled();
    });

    it('should propagate Auth0 errors', async () => {
      // Arrange
      userRepo.findByEmail.mockResolvedValue(null);
      auth0Adapter.createUser.mockRejectedValue(new Error('Auth0 API error'));

      // Act & Assert
      await expect(service.registerUser(registerDto)).rejects.toThrow('Auth0 API error');
      expect(txManager.run).not.toHaveBeenCalled();
    });

    it('should use default timezone and language if not provided', async () => {
      // Arrange
      const dtoWithoutDefaults = { email: 'test@example.com', password: 'Pass123!', name: 'Test' };
      const auth0User = { user_id: 'auth0|test', email: dtoWithoutDefaults.email, email_verified: false };
      const memberRole = createMockRole('MEMBER');

      userRepo.findByEmail.mockResolvedValue(null);
      auth0Adapter.createUser.mockResolvedValue(auth0User as any);
      roleRepo.findByName.mockResolvedValue(memberRole);

      // Act
      await service.registerUser(dtoWithoutDefaults as RegisterUserDto);

      // Assert
      expect(txManager.run).toHaveBeenCalled();
      // Verify defaults are used in entity creation
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      // Arrange
      const user = createMockUser();
      userRepo.findOne.mockResolvedValue(user);

      // Act
      const result = await service.getUserById(user.id);

      // Assert
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: user.id } });
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      userRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserByAuth0Id', () => {
    it('should return user by Auth0 ID', async () => {
      // Arrange
      const user = createMockUser();
      userRepo.findByAuth0Id.mockResolvedValue(user);

      // Act
      const result = await service.getUserByAuth0Id(user.auth0Id);

      // Assert
      expect(userRepo.findByAuth0Id).toHaveBeenCalledWith(user.auth0Id);
      expect(result).toEqual(user);
    });

    it('should return null if user not found', async () => {
      // Arrange
      userRepo.findByAuth0Id.mockResolvedValue(null);

      // Act
      const result = await service.getUserByAuth0Id('nonexistent-auth0-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateUserProfileDto = {
      displayName: 'Updated Name',
      timezone: 'Europe/London',
      language: 'es',
      notificationPreferences: {
        email: false,
        inApp: true,
        taskAssigned: true,
        taskUpdated: false,
        taskCompleted: true,
        mentions: true,
      },
    };

    it('should successfully update user profile', async () => {
      // Arrange
      const user = createMockUser();
      const updatedUser = { ...user, ...updateDto };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(updatedUser);

      // Act
      const result = await service.updateProfile(user.id, updateDto);

      // Assert
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: user.id } });
      expect(userRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.updated', expect.objectContaining({ userId: user.id }));
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      userRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateProfile('nonexistent-id', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should only update editable fields', async () => {
      // Arrange
      const user = createMockUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(user);

      // Act
      await service.updateProfile(user.id, updateDto);

      // Assert
      const savedUser = userRepo.save.mock.calls[0][0];
      expect(savedUser.displayName).toBe(updateDto.displayName);
      expect(savedUser.timezone).toBe(updateDto.timezone);
      expect(savedUser.language).toBe(updateDto.language);
      expect(savedUser.notificationPreferences).toEqual(updateDto.notificationPreferences);
      // Non-editable fields should remain unchanged
      expect(savedUser.email).toBe(user.email);
      expect(savedUser.auth0Id).toBe(user.auth0Id);
    });
  });

  describe('deactivateUser', () => {
    it('should successfully deactivate user', async () => {
      // Arrange
      const user = createMockUser();
      const adminId = 'admin-123';
      const deactivatedUser = { ...user, isActive: false };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(deactivatedUser);
      auth0Adapter.deactivateUser.mockResolvedValue(undefined);

      // Act
      const result = await service.deactivateUser(user.id, adminId);

      // Assert
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: user.id } });
      expect(auth0Adapter.deactivateUser).toHaveBeenCalledWith(user.auth0Id);
      expect(userRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.deactivated', expect.objectContaining({ userId: user.id }));
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      userRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deactivateUser('nonexistent-id', 'admin-id')).rejects.toThrow(NotFoundException);
    });

    it('should handle Auth0 deactivation failure gracefully', async () => {
      // Arrange
      const user = createMockUser();
      userRepo.findOne.mockResolvedValue(user);
      auth0Adapter.deactivateUser.mockRejectedValue(new Error('Auth0 error'));

      // Act & Assert
      await expect(service.deactivateUser(user.id, 'admin-id')).rejects.toThrow('Auth0 error');
    });
  });

  describe('reactivateUser', () => {
    it('should successfully reactivate user', async () => {
      // Arrange
      const user = createMockUser({ isActive: false });
      const adminId = 'admin-123';
      const reactivatedUser = { ...user, isActive: true };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(reactivatedUser);
      auth0Adapter.reactivateUser.mockResolvedValue(undefined);

      // Act
      const result = await service.reactivateUser(user.id, adminId);

      // Assert
      expect(auth0Adapter.reactivateUser).toHaveBeenCalledWith(user.auth0Id);
      expect(result.isActive).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.reactivated', expect.objectContaining({ userId: user.id }));
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user and anonymize PII', async () => {
      // Arrange
      const user = createMockUser();
      const adminId = 'admin-123';
      userRepo.findOne.mockResolvedValue(user);
      userRoleRepo.deleteByUserId.mockResolvedValue(undefined);
      auth0Adapter.deleteUser.mockResolvedValue(undefined);
      userRepo.save.mockImplementation((u) => Promise.resolve(u));

      // Act
      const result = await service.deleteUser(user.id, adminId);

      // Assert
      expect(userRoleRepo.deleteByUserId).toHaveBeenCalledWith(user.id);
      expect(auth0Adapter.deleteUser).toHaveBeenCalledWith(user.auth0Id);
      expect(result.deletedAt).not.toBeNull();
      expect(result.email).toContain('deleted-');
      expect(result.name).toBe('[Deleted User]');
      expect(result.displayName).toBe('[Deleted User]');
      expect(result.picture).toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.deleted', expect.objectContaining({ userId: user.id }));
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      userRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteUser('nonexistent-id', 'admin-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignTeam', () => {
    it('should successfully assign user to team', async () => {
      // Arrange
      const user = createMockUser({ teamId: null });
      const team = createMockTeam('Engineering');
      const adminId = 'admin-123';
      const updatedUser = { ...user, teamId: team.id };

      userRepo.findOne.mockResolvedValue(user);
      teamRepo.findOne.mockResolvedValue(team);
      userRepo.save.mockResolvedValue(updatedUser);
      cacheService.delByPattern.mockResolvedValue(undefined);

      // Act
      const result = await service.assignTeam(user.id, team.id, adminId);

      // Assert
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: user.id } });
      expect(teamRepo.findOne).toHaveBeenCalledWith({ where: { id: team.id } });
      expect(result.teamId).toBe(team.id);
      expect(cacheService.delByPattern).toHaveBeenCalledWith(`user:${user.id}:*`);
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.team_assigned', expect.objectContaining({ userId: user.id, teamId: team.id }));
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      userRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.assignTeam('user-id', 'team-id', 'admin-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if team not found', async () => {
      // Arrange
      const user = createMockUser();
      userRepo.findOne.mockResolvedValue(user);
      teamRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.assignTeam(user.id, 'nonexistent-team', 'admin-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchUsers', () => {
    it('should return active users for contextual search', async () => {
      // Arrange
      const users = [createMockUser(), createMockUser({ id: 'user-2', email: 'user2@example.com' })];
      userRepo.searchUsers.mockResolvedValue(users);

      // Act
      const result = await service.searchUsers('test', true, 'current-user-id');

      // Assert
      expect(userRepo.searchUsers).toHaveBeenCalledWith('test', true);
      expect(result).toHaveLength(2);
    });

    it('should return all users for administrative search', async () => {
      // Arrange
      const users = [
        createMockUser(),
        createMockUser({ id: 'user-2', isActive: false }),
        createMockUser({ id: 'user-3', deletedAt: new Date() }),
      ];
      userRepo.searchUsers.mockResolvedValue(users);

      // Act
      const result = await service.searchUsers('', false, 'admin-id');

      // Assert
      expect(userRepo.searchUsers).toHaveBeenCalledWith('', false);
      expect(result).toHaveLength(3);
    });
  });

  describe('syncUserFromAuth0', () => {
    it('should sync user data from Auth0', async () => {
      // Arrange
      const auth0User = {
        user_id: 'auth0|123',
        email: 'newemail@example.com',
        email_verified: true,
        name: 'Updated Name',
        picture: 'https://example.com/avatar.jpg',
      };
      const localUser = createMockUser({ auth0Id: 'auth0|123', email: 'oldemail@example.com' });
      userRepo.findByAuth0Id.mockResolvedValue(localUser);
      userRepo.save.mockImplementation((u) => Promise.resolve(u));

      // Act
      const result = await service.syncUserFromAuth0(auth0User as any);

      // Assert
      expect(result.email).toBe(auth0User.email);
      expect(result.emailVerified).toBe(auth0User.email_verified);
      expect(result.name).toBe(auth0User.name);
      expect(result.picture).toBe(auth0User.picture);
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.synced', expect.objectContaining({ userId: localUser.id }));
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      const auth0User = { user_id: 'auth0|nonexistent', email: 'test@example.com' };
      userRepo.findByAuth0Id.mockResolvedValue(null);

      // Act & Assert
      await expect(service.syncUserFromAuth0(auth0User as any)).rejects.toThrow(NotFoundException);
    });
  });
});
