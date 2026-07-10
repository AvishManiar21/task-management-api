import { Injectable } from '@nestjs/common';
import { DataSource, Repository, IsNull } from 'typeorm';
import { Team } from './team.entity';

/**
 * TeamRepository
 *
 * Custom repository for Team entity with domain-specific query methods.
 *
 * @see US-046 (Assign User to Team)
 */
@Injectable()
export class TeamRepository extends Repository<Team> {
  constructor(private dataSource: DataSource) {
    super(Team, dataSource.createEntityManager());
  }

  /**
   * Find team by name
   *
   * @param name - Team name
   * @returns Team or null
   */
  async findByName(name: string): Promise<Team | null> {
    return await this.findOne({
      where: { name, deletedAt: IsNull() },
    });
  }

  /**
   * Find team with members (eager load)
   *
   * @param teamId - Team UUID
   * @returns Team with members relationship loaded
   */
  async findWithMembers(teamId: string): Promise<Team | null> {
    return await this.findOne({
      where: { id: teamId, deletedAt: IsNull() },
      relations: ['members'],
    });
  }

  /**
   * Check if team name exists (non-deleted teams only)
   *
   * @param name - Team name
   * @returns true if exists, false otherwise
   */
  async nameExists(name: string): Promise<boolean> {
    const count = await this.count({
      where: { name, deletedAt: IsNull() },
    });
    return count > 0;
  }

  /**
   * Find all non-deleted teams
   *
   * @returns Array of teams
   */
  async findAllTeams(): Promise<Team[]> {
    return await this.find({
      where: { deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }
}
