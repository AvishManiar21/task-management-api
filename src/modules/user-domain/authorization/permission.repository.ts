import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Permission } from './permission.entity';

/**
 * PermissionRepository
 *
 * Custom repository for Permission entity.
 *
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-047 (Manage User Permissions - Granular)
 */
@Injectable()
export class PermissionRepository extends Repository<Permission> {
  constructor(private dataSource: DataSource) {
    super(Permission, dataSource.createEntityManager());
  }

  /**
   * Find permission by resource and action
   *
   * @param resource - Resource type (e.g., 'user', 'task')
   * @param action - Action type (e.g., 'create', 'read')
   * @returns Permission or null
   */
  async findByResourceAndAction(resource: string, action: string): Promise<Permission | null> {
    return await this.findOne({
      where: { resource, action },
    });
  }

  /**
   * Find all permissions for a specific resource
   *
   * @param resource - Resource type
   * @returns Array of permissions
   */
  async findByResource(resource: string): Promise<Permission[]> {
    return await this.find({
      where: { resource },
      order: { action: 'ASC' },
    });
  }

  /**
   * Check if permission exists
   *
   * @param resource - Resource type
   * @param action - Action type
   * @returns true if exists, false otherwise
   */
  async permissionExists(resource: string, action: string): Promise<boolean> {
    const count = await this.count({ where: { resource, action } });
    return count > 0;
  }

  /**
   * Find all permissions
   *
   * @returns Array of all permissions
   */
  async findAllPermissions(): Promise<Permission[]> {
    return await this.find({
      order: { resource: 'ASC', action: 'ASC' },
    });
  }
}
