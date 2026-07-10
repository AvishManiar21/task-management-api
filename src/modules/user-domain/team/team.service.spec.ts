import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamRepository } from './team.repository';
import { UserRepository } from '../user/user.repository';
import { CacheService } from '@common/infrastructure/cache/cache.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Team } from './team.entity';
import { User } from '../user/user.entity';
import { CreateTeamDto } from '../user/dto/create-team.dto';

describe('TeamService', () => {
  let service: TeamService;
  let teamRepo: jest.Mocked<TeamRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let cacheService: jest.Mocked<CacheService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const createMockTeam = (name: string): Team => ({
    id: 'team-123',
    name,
    description: `${name} team`,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Team);

  const createMockUser = (teamId?: string): User => ({
    id: 'user-123',
    email: 'test@example.com',
    teamId: teamId || null,
    isActive: true,
  } as User);

  beforeEach(async () => {
    const mockTeamRepo = {
      findByName: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      findWithMembers: jest.fn(),
    };

    const mockUserRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };

    const mockCacheService = {
      delByPattern: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        { provide: TeamRepository, useValue: mockTeamRepo },
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: CacheService, useValue: mockCacheService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: LoggerService, useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn() } },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    teamRepo = module.get(TeamRepository);
    userRepo = module.get(UserRepository);
    cacheService = module.get(CacheService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('createTeam', () => {
    it('should successfully create team', async () => {
      // Arrange
      const dto: CreateTeamDto = { name: 'Engineering', description: 'Engineering team' };
      const adminId = 'admin-123';
      const team = createMockTeam(dto.name);

      teamRepo.findByName.mockResolvedValue(null);
      teamRepo.save.mockResolvedValue(team);

      // Act
      const result = await service.createTeam(dto, adminId);

      // Assert
      expect(teamRepo.findByName).toHaveBeenCalledWith(dto.name);
      expect(teamRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('team.created', expect.objectContaining({ teamId: team.id }));
      expect(result).toEqual(team);
    });

    it('should throw ConflictException if team name already exists', async () => {
      // Arrange
      const dto: CreateTeamDto = { name: 'Engineering', description: 'Engineering team' };
      const existingTeam = createMockTeam(dto.name);
      teamRepo.findByName.mockResolvedValue(existingTeam);

      // Act & Assert
      await expect(service.createTeam(dto, 'admin-123')).rejects.toThrow(ConflictException);
      await expect(service.createTeam(dto, 'admin-123')).rejects.toThrow(`Team name '${dto.name}' already exists`);
    });
  });

  describe('updateTeam', () => {
    it('should successfully update team', async () => {
      // Arrange
      const teamId = 'team-123';
      const updates = { name: 'Updated Engineering', description: 'Updated description' };
      const adminId = 'admin-123';
      const team = createMockTeam('Engineering');
      const updatedTeam = { ...team, ...updates };

      teamRepo.findOne.mockResolvedValue(team);
      teamRepo.findByName.mockResolvedValue(null);
      teamRepo.save.mockResolvedValue(updatedTeam);

      // Act
      const result = await service.updateTeam(teamId, updates, adminId);

      // Assert
      expect(teamRepo.findOne).toHaveBeenCalledWith({ where: { id: teamId } });
      expect(teamRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('team.updated', expect.objectContaining({ teamId }));
      expect(result).toEqual(updatedTeam);
    });

    it('should throw NotFoundException if team not found', async () => {
      // Arrange
      teamRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateTeam('nonexistent', { name: 'New Name' }, 'admin-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new name conflicts', async () => {
      // Arrange
      const teamId = 'team-123';
      const team = createMockTeam('Engineering');
      const conflictingTeam = createMockTeam('Marketing');
      const updates = { name: 'Marketing' };

      teamRepo.findOne.mockResolvedValue(team);
      teamRepo.findByName.mockResolvedValue(conflictingTeam);

      // Act & Assert
      await expect(service.updateTeam(teamId, updates, 'admin-123')).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteTeam', () => {
    it('should soft delete team and clear members teamId', async () => {
      // Arrange
      const teamId = 'team-123';
      const adminId = 'admin-123';
      const team = createMockTeam('Engineering');
      const members = [createMockUser(teamId), createMockUser(teamId)];

      teamRepo.findOne.mockResolvedValue(team);
      userRepo.find.mockResolvedValue(members);
      userRepo.save.mockResolvedValue(undefined);
      teamRepo.save.mockResolvedValue({ ...team, deletedAt: new Date() });

      // Act
      await service.deleteTeam(teamId, adminId);

      // Assert
      expect(userRepo.find).toHaveBeenCalledWith({ where: { teamId } });
      expect(userRepo.save).toHaveBeenCalledTimes(members.length);
      expect(teamRepo.save).toHaveBeenCalled();
      expect(cacheService.delByPattern).toHaveBeenCalledWith(`team:${teamId}:*`);
      expect(eventEmitter.emit).toHaveBeenCalledWith('team.deleted', expect.objectContaining({ teamId }));
    });

    it('should throw NotFoundException if team not found', async () => {
      // Arrange
      teamRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteTeam('nonexistent', 'admin-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTeamMembers', () => {
    it('should return team with members', async () => {
      // Arrange
      const teamId = 'team-123';
      const team = createMockTeam('Engineering');
      teamRepo.findWithMembers.mockResolvedValue(team);

      // Act
      const result = await service.getTeamMembers(teamId);

      // Assert
      expect(teamRepo.findWithMembers).toHaveBeenCalledWith(teamId);
      expect(result).toEqual(team);
    });

    it('should throw NotFoundException if team not found', async () => {
      // Arrange
      teamRepo.findWithMembers.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getTeamMembers('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllTeams', () => {
    it('should return all active teams', async () => {
      // Arrange
      const teams = [createMockTeam('Engineering'), createMockTeam('Marketing')];
      teamRepo.find.mockResolvedValue(teams as any);

      // Act
      const result = await service.getAllTeams();

      // Assert
      expect(teamRepo.find).toHaveBeenCalledWith({ where: { deletedAt: null } });
      expect(result).toEqual(teams);
    });
  });
});
