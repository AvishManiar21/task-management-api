import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { RoleService } from '../authorization/role.service';
import { TeamService } from '../team/team.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AssignTeamDto } from './dto/assign-team.dto';
import { User } from './user.entity';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;
  let roleService: jest.Mocked<RoleService>;
  let teamService: jest.Mocked<TeamService>;

  const createMockUser = (overrides?: Partial<User>): User => ({
    id: 'user-123',
    auth0Id: 'auth0|123',
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
    ...overrides,
  } as User);

  beforeEach(async () => {
    const mockUserService = {
      registerUser: jest.fn(),
      getUserById: jest.fn(),
      updateProfile: jest.fn(),
      deactivateUser: jest.fn(),
      searchUsers: jest.fn(),
      assignTeam: jest.fn(),
    };

    const mockRoleService = {
      assignRole: jest.fn(),
      revokeRole: jest.fn(),
      getUserRoles: jest.fn(),
    };

    const mockTeamService = {
      createTeam: jest.fn(),
      getAllTeams: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: RoleService, useValue: mockRoleService },
        { provide: TeamService, useValue: mockTeamService },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
    roleService = module.get(RoleService);
    teamService = module.get(TeamService);
  });

  describe('POST /api/v1/users/register', () => {
    it('should register new user', async () => {
      // Arrange
      const dto: RegisterUserDto = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      };
      const user = createMockUser({ email: dto.email, name: dto.name });
      userService.registerUser.mockResolvedValue(user);

      // Act
      const result = await controller.register(dto);

      // Assert
      expect(userService.registerUser).toHaveBeenCalledWith(dto);
      expect(result).toBeDefined();
      expect(result.email).toBe(dto.email);
    });
  });

  describe('GET /api/v1/users/me', () => {
    it('should return current user profile', async () => {
      // Arrange
      const currentUser = createMockUser();

      // Act
      const result = await controller.getCurrentUser(currentUser);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(currentUser.id);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return user by ID', async () => {
      // Arrange
      const user = createMockUser();
      userService.getUserById.mockResolvedValue(user);

      // Act
      const result = await controller.getUserById(user.id);

      // Assert
      expect(userService.getUserById).toHaveBeenCalledWith(user.id);
      expect(result).toBeDefined();
      expect(result.id).toBe(user.id);
    });
  });

  describe('PUT /api/v1/users/:id', () => {
    it('should update user profile', async () => {
      // Arrange
      const userId = 'user-123';
      const dto: UpdateUserProfileDto = {
        displayName: 'Updated Name',
        timezone: 'Europe/London',
      };
      const currentUser = createMockUser({ id: userId });
      const updatedUser = { ...currentUser, ...dto };
      userService.updateProfile.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateProfile(userId, dto, currentUser);

      // Assert
      expect(userService.updateProfile).toHaveBeenCalledWith(userId, dto);
      expect(result.displayName).toBe(dto.displayName);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should deactivate user', async () => {
      // Arrange
      const userId = 'user-123';
      const adminUser = createMockUser({ id: 'admin-123' });
      const deactivatedUser = createMockUser({ id: userId, isActive: false });
      userService.deactivateUser.mockResolvedValue(deactivatedUser);

      // Act
      const result = await controller.deactivateUser(userId, adminUser);

      // Assert
      expect(userService.deactivateUser).toHaveBeenCalledWith(userId, adminUser.id);
      expect(result.isActive).toBe(false);
    });
  });

  describe('GET /api/v1/users', () => {
    it('should return search results (contextual search)', async () => {
      // Arrange
      const currentUser = createMockUser();
      const users = [createMockUser(), createMockUser({ id: 'user-456' })];
      userService.searchUsers.mockResolvedValue(users);

      // Act
      const result = await controller.searchUsers({ query: 'test', isActive: true }, currentUser);

      // Assert
      expect(userService.searchUsers).toHaveBeenCalledWith('test', true, currentUser.id);
      expect(result).toHaveLength(2);
    });

    it('should return all users (administrative search)', async () => {
      // Arrange
      const adminUser = createMockUser({ id: 'admin-123' });
      const users = [
        createMockUser(),
        createMockUser({ id: 'user-456', isActive: false }),
      ];
      userService.searchUsers.mockResolvedValue(users);

      // Act
      const result = await controller.searchUsers({ isActive: false }, adminUser);

      // Assert
      expect(userService.searchUsers).toHaveBeenCalledWith('', false, adminUser.id);
      expect(result).toHaveLength(2);
    });
  });

  describe('POST /api/v1/users/:id/roles', () => {
    it('should assign role to user', async () => {
      // Arrange
      const userId = 'user-123';
      const dto: AssignRoleDto = { roleId: 'role-member' };
      const adminUser = createMockUser({ id: 'admin-123' });
      roleService.assignRole.mockResolvedValue(undefined);

      // Act
      await controller.assignRole(userId, dto, adminUser);

      // Assert
      expect(roleService.assignRole).toHaveBeenCalledWith(userId, dto.roleId, adminUser.id);
    });
  });

  describe('DELETE /api/v1/users/:id/roles/:roleId', () => {
    it('should revoke role from user', async () => {
      // Arrange
      const userId = 'user-123';
      const roleId = 'role-member';
      const adminUser = createMockUser({ id: 'admin-123' });
      roleService.revokeRole.mockResolvedValue(undefined);

      // Act
      await controller.revokeRole(userId, roleId, adminUser);

      // Assert
      expect(roleService.revokeRole).toHaveBeenCalledWith(userId, roleId, adminUser.id);
    });
  });

  describe('POST /api/v1/users/:id/team', () => {
    it('should assign user to team', async () => {
      // Arrange
      const userId = 'user-123';
      const dto: AssignTeamDto = { teamId: 'team-123' };
      const adminUser = createMockUser({ id: 'admin-123' });
      const updatedUser = createMockUser({ id: userId, teamId: dto.teamId });
      userService.assignTeam.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.assignTeam(userId, dto, adminUser);

      // Assert
      expect(userService.assignTeam).toHaveBeenCalledWith(userId, dto.teamId, adminUser.id);
      expect(result.teamId).toBe(dto.teamId);
    });
  });

  describe('GET /api/v1/users/:id/activity', () => {
    it('should return user activity placeholder', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = createMockUser();

      // Act
      const result = await controller.getUserActivity(userId, currentUser);

      // Assert
      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.message).toContain('not yet implemented');
    });
  });

  describe('GET /api/v1/users/:id/roles', () => {
    it('should return user roles', async () => {
      // Arrange
      const userId = 'user-123';
      const roles = [{ id: 'role-1', name: 'MEMBER' }, { id: 'role-2', name: 'TEAM_LEAD' }];
      roleService.getUserRoles.mockResolvedValue(roles as any);

      // Act
      const result = await controller.getUserRoles(userId);

      // Assert
      expect(roleService.getUserRoles).toHaveBeenCalledWith(userId);
      expect(result).toEqual(roles);
    });
  });

  describe('POST /api/v1/users/teams', () => {
    it('should create new team', async () => {
      // Arrange
      const dto = { name: 'Engineering', description: 'Engineering team' };
      const currentUser = createMockUser({ id: 'admin-123' });
      const team = { id: 'team-123', name: dto.name, description: dto.description };
      teamService.createTeam.mockResolvedValue(team as any);

      // Act
      const result = await controller.createTeam(dto, currentUser);

      // Assert
      expect(teamService.createTeam).toHaveBeenCalledWith(dto, currentUser.id);
      expect(result).toEqual(team);
    });
  });

  describe('GET /api/v1/users/teams', () => {
    it('should return all teams', async () => {
      // Arrange
      const teams = [
        { id: 'team-1', name: 'Engineering' },
        { id: 'team-2', name: 'Marketing' },
      ];
      teamService.getAllTeams.mockResolvedValue(teams as any);

      // Act
      const result = await controller.getAllTeams();

      // Assert
      expect(teamService.getAllTeams).toHaveBeenCalled();
      expect(result).toEqual(teams);
    });
  });
});
