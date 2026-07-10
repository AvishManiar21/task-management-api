import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { TeamRepository } from './team.repository';
import { UserRepository } from '../user/user.repository';
import { TransactionManager } from '@common/infrastructure/database/transaction-manager.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { CreateTeamDto } from '../user/dto/create-team.dto';
import { Team } from './team.entity';
import { User } from '../user/user.entity';

/**
 * TeamService
 *
 * Business logic for team management.
 *
 * Implements:
 * - Team CRUD operations
 * - Team member assignment (delegates to UserService)
 * - Team deletion with member cleanup
 *
 * Business Rules:
 * - BR-TEAM-001: User can belong to at most one team
 * - BR-TEAM-002: Team names must be unique
 * - BR-TEAM-005: Team deletion sets members' teamId to NULL
 *
 * @see US-046 (Assign User to Team)
 */
@Injectable()
export class TeamService {
  private readonly logger = new LoggerService();

  constructor(
    private readonly teamRepo: TeamRepository,
    private readonly userRepo: UserRepository,
    private readonly txManager: TransactionManager,
  ) {
    this.logger.setContext('TeamService');
  }

  /**
   * Create new team
   *
   * Business Rule: BR-TEAM-002 (Unique team names)
   *
   * @param dto - Team creation data
   * @param createdBy - User ID creating the team
   * @returns Created team
   * @throws ConflictException if team name exists
   * @see US-046 (Assign User to Team)
   */
  async createTeam(dto: CreateTeamDto, createdBy: string): Promise<Team> {
    this.logger.log('Creating team', { name: dto.name, createdBy });

    // BR-TEAM-002: Check for duplicate name
    const existing = await this.teamRepo.findByName(dto.name);
    if (existing) {
      throw new ConflictException(`Team ${dto.name} already exists`);
    }

    const team = this.teamRepo.create({
      name: dto.name,
      description: dto.description || null,
      createdBy,
    });

    const savedTeam = await this.teamRepo.save(team);

    this.logger.log('Team created successfully', { teamId: savedTeam.id, name: savedTeam.name });

    return savedTeam;
  }

  /**
   * Update team
   *
   * @param teamId - Team ID
   * @param updates - Team updates
   * @param actorId - User ID performing update
   * @returns Updated team
   * @throws NotFoundException if team not found
   * @throws ConflictException if new name conflicts
   */
  async updateTeam(
    teamId: string,
    updates: { name?: string; description?: string },
    actorId: string,
  ): Promise<Team> {
    this.logger.log('Updating team', { teamId, actorId });

    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    // Check for name conflict if name is being changed
    if (updates.name && updates.name !== team.name) {
      const existing = await this.teamRepo.findByName(updates.name);
      if (existing) {
        throw new ConflictException(`Team ${updates.name} already exists`);
      }
      team.name = updates.name;
    }

    if (updates.description !== undefined) {
      team.description = updates.description;
    }

    const updatedTeam = await this.teamRepo.save(team);

    this.logger.log('Team updated successfully', { teamId });

    return updatedTeam;
  }

  /**
   * Delete team
   *
   * Business Rule: BR-TEAM-005 (Set members' teamId to NULL on deletion)
   *
   * @param teamId - Team ID
   * @param actorId - User ID performing deletion
   * @throws NotFoundException if team not found
   */
  async deleteTeam(teamId: string, actorId: string): Promise<void> {
    this.logger.warn('Deleting team', { teamId, actorId });

    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    await this.txManager.run(async (em) => {
      // BR-TEAM-005: Set teamId to NULL for all members
      const members = await this.userRepo.findByTeamId(teamId);
      for (const member of members) {
        member.teamId = null;
        await em.save(User, member);
      }

      this.logger.log('Team members unassigned', { teamId, memberCount: members.length });

      // Soft delete team
      await em.softDelete(Team, { id: teamId });
    });

    this.logger.warn('Team deleted successfully', { teamId, teamName: team.name });
  }

  /**
   * Get team by ID
   *
   * @param teamId - Team ID
   * @returns Team
   * @throws NotFoundException if not found
   */
  async getTeamById(teamId: string): Promise<Team> {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }
    return team;
  }

  /**
   * Get team members
   *
   * @param teamId - Team ID
   * @returns Array of team members
   * @throws NotFoundException if team not found
   */
  async getTeamMembers(teamId: string): Promise<User[]> {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    return await this.userRepo.findByTeamId(teamId);
  }

  /**
   * Get all teams
   *
   * @returns Array of all teams
   */
  async getAllTeams(): Promise<Team[]> {
    return await this.teamRepo.findAllTeams();
  }
}
