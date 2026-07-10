import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Role } from './role.entity';

/**
 * RoleRepository
 *
 * Custom repository for Role entity.
 *
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-047 (Manage User Permissions - Granular)
 */
@Injectable()
export class RoleRepository extends Repository<Role> {
  constructor(private dataSource: DataSource) {
    super(Role, dataSource.createEntityManager());
  }

  /**
   * Find role by name
   *
   * @param name - Role name (e.g., 'ADMIN', 'MEMBER')
   * @returns Role or null
   */
  async findByName(name: string): Promise<Role | null> {
    return await this.findOne({
      where: { name },
    });
  }

  /**
   * Find all system roles
   *
   * @returns Array of system roles
   */
  async findSystemRoles(): Promise<Role[]> {
    return await this.find({
      where: { isSystem: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find all custom roles
   *
   * @returns Array of custom roles
   */
  async findCustomRoles(): Promise<Role[]> {
    return await this.find({
      where: { isSystem: false },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find role with permissions (eager load)
   *
   * @param roleId - Role UUID
   * @returns Role with permissions loaded
   */
  async findWithPermissions(roleId: string): Promise<Role | null> {
    return await this.findOne({
      where: { id: roleId },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });
  }

  /**
   * Check if role name exists
   *
   * @param name - Role name
   * @returns true if exists, false otherwise
   */
  async nameExists(name: string): Promise<boolean> {
    const count = await this.count({ where: { name } });
    return count > 0;
  }
}
