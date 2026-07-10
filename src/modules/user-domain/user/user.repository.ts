import { Injectable } from '@nestjs/common';
import { DataSource, Repository, Like, IsNull } from 'typeorm';
import { User } from './user.entity';

/**
 * UserRepository
 *
 * Custom repository for User entity with domain-specific query methods.
 *
 * Features:
 * - Soft delete awareness (auto-filters deletedAt IS NULL)
 * - Custom query methods for common patterns
 * - Search functionality (contextual: functional vs administrative)
 *
 * @see US-041 (Register New User)
 * @see US-043 (Edit User Profile)
 * @see US-044 (Deactivate User Account)
 * @see US-045 (Search Users)
 * @see US-046 (Assign User to Team)
 */
@Injectable()
export class UserRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  /**
   * Find user by email
   *
   * @param email - User email address
   * @returns User or null
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.findOne({
      where: { email, deletedAt: IsNull() },
    });
  }

  /**
   * Find user by Auth0 ID
   *
   * Used during JWT validation to load authenticated user
   *
   * @param auth0Id - Auth0 user ID
   * @returns User or null
   */
  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    return await this.findOne({
      where: { auth0Id, deletedAt: IsNull() },
    });
  }

  /**
   * Find all active users
   *
   * Returns users where isActive=true and deletedAt IS NULL
   *
   * @returns Array of active users
   */
  async findActiveUsers(): Promise<User[]> {
    return await this.find({
      where: { isActive: true, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find users by team ID
   *
   * @param teamId - Team UUID
   * @returns Array of team members
   */
  async findByTeamId(teamId: string): Promise<User[]> {
    return await this.find({
      where: { teamId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Search users (contextual)
   *
   * Two modes:
   * - Functional search: Permissionless search for task assignment (all active users)
   * - Administrative search: Permission-required full search
   *
   * @param query - Search query (name, email, displayName)
   * @param contextual - true = functional (active only), false = administrative (all)
   * @returns Array of matching users
   * @see US-045 (Search Users)
   */
  async searchUsers(query: string, contextual: boolean = true): Promise<User[]> {
    const searchPattern = `%${query}%`;

    const queryBuilder = this.createQueryBuilder('user')
      .where('user.deletedAt IS NULL')
      .andWhere(
        '(user.name ILIKE :pattern OR user.email ILIKE :pattern OR user.displayName ILIKE :pattern)',
        { pattern: searchPattern }
      );

    // Contextual search: Only active users (for functional task assignment)
    if (contextual) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive: true });
    }

    return await queryBuilder
      .orderBy('user.name', 'ASC')
      .getMany();
  }

  /**
   * Find users with verified emails
   *
   * Used to filter users eligible for task assignment
   *
   * @returns Array of users with verified emails
   */
  async findVerifiedUsers(): Promise<User[]> {
    return await this.find({
      where: {
        emailVerified: true,
        isActive: true,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if email exists (non-deleted users only)
   *
   * @param email - Email to check
   * @returns true if email exists, false otherwise
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.count({
      where: { email, deletedAt: IsNull() },
    });
    return count > 0;
  }

  /**
   * Check if Auth0 ID exists (non-deleted users only)
   *
   * @param auth0Id - Auth0 ID to check
   * @returns true if exists, false otherwise
   */
  async auth0IdExists(auth0Id: string): Promise<boolean> {
    const count = await this.count({
      where: { auth0Id, deletedAt: IsNull() },
    });
    return count > 0;
  }
}
