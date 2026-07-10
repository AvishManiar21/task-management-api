import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from './user-role.entity';
import { Role } from './role.entity';

/**
 * UserRoleRepository
 *
 * Custom repository for UserRole join table.
 *
 * @see US-042 (Manage User Roles and Permissions)
 */
@Injectable()
export class UserRoleRepository extends Repository<UserRole> {
  constructor(private dataSource: DataSource) {
    super(UserRole, dataSource.createEntityManager());
  }

  /**
   * Find all roles for a user
   *
   * @param userId - User UUID
   * @returns Array of roles
   */
  async findRolesByUserId(userId: string): Promise<Role[]> {
    const userRoles = await this.find({
      where: { userId },
      relations: ['role'],
    });

    return userRoles.map((ur) => ur.role);
  }

  /**
   * Find all user-role assignments for a user
   *
   * @param userId - User UUID
   * @returns Array of UserRole entities
   */
  async findByUserId(userId: string): Promise<UserRole[]> {
    return await this.find({
      where: { userId },
      relations: ['role'],
      order: { assignedAt: 'DESC' },
    });
  }

  /**
   * Find all users with a specific role
   *
   * @param roleId - Role UUID
   * @returns Array of UserRole entities
   */
  async findByRoleId(roleId: string): Promise<UserRole[]> {
    return await this.find({
      where: { roleId },
      relations: ['user'],
      order: { assignedAt: 'DESC' },
    });
  }

  /**
   * Check if user has a specific role
   *
   * @param userId - User UUID
   * @param roleId - Role UUID
   * @returns true if user has role, false otherwise
   */
  async userHasRole(userId: string, roleId: string): Promise<boolean> {
    const count = await this.count({ where: { userId, roleId } });
    return count > 0;
  }

  /**
   * Delete all roles for a user
   *
   * Used during user deletion or role revocation
   *
   * @param userId - User UUID
   * @returns Number of deleted records
   */
  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.delete({ userId });
    return result.affected || 0;
  }

  /**
   * Delete specific user-role assignment
   *
   * @param userId - User UUID
   * @param roleId - Role UUID
   * @returns Number of deleted records
   */
  async deleteUserRole(userId: string, roleId: string): Promise<number> {
    const result = await this.delete({ userId, roleId });
    return result.affected || 0;
  }
}
