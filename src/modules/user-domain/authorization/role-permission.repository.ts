import { Injectable } from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { Permission } from './permission.entity';

/**
 * RolePermissionRepository
 *
 * Custom repository for RolePermission join table.
 *
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-047 (Manage User Permissions - Granular)
 */
@Injectable()
export class RolePermissionRepository extends Repository<RolePermission> {
  constructor(private dataSource: DataSource) {
    super(RolePermission, dataSource.createEntityManager());
  }

  /**
   * Find all permissions for a role
   *
   * @param roleId - Role UUID
   * @returns Array of permissions
   */
  async findPermissionsByRoleId(roleId: string): Promise<Permission[]> {
    const rolePermissions = await this.find({
      where: { roleId },
      relations: ['permission'],
    });

    return rolePermissions.map((rp) => rp.permission);
  }

  /**
   * Find all permissions for multiple roles (union)
   *
   * @param roleIds - Array of role UUIDs
   * @returns Array of unique permissions
   */
  async findPermissionsByRoleIds(roleIds: string[]): Promise<Permission[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const rolePermissions = await this.find({
      where: { roleId: In(roleIds) },
      relations: ['permission'],
    });

    // Remove duplicates (same permission from multiple roles)
    const uniquePermissions = new Map<string, Permission>();
    rolePermissions.forEach((rp) => {
      uniquePermissions.set(rp.permission.id, rp.permission);
    });

    return Array.from(uniquePermissions.values());
  }

  /**
   * Find all role-permission assignments for a role
   *
   * @param roleId - Role UUID
   * @returns Array of RolePermission entities
   */
  async findByRoleId(roleId: string): Promise<RolePermission[]> {
    return await this.find({
      where: { roleId },
      relations: ['permission'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if role has a specific permission
   *
   * @param roleId - Role UUID
   * @param permissionId - Permission UUID
   * @returns true if role has permission, false otherwise
   */
  async roleHasPermission(roleId: string, permissionId: string): Promise<boolean> {
    const count = await this.count({ where: { roleId, permissionId } });
    return count > 0;
  }

  /**
   * Delete all permissions for a role
   *
   * @param roleId - Role UUID
   * @returns Number of deleted records
   */
  async deleteByRoleId(roleId: string): Promise<number> {
    const result = await this.delete({ roleId });
    return result.affected || 0;
  }

  /**
   * Delete specific role-permission assignment
   *
   * @param roleId - Role UUID
   * @param permissionId - Permission UUID
   * @returns Number of deleted records
   */
  async deleteRolePermission(roleId: string, permissionId: string): Promise<number> {
    const result = await this.delete({ roleId, permissionId });
    return result.affected || 0;
  }

  /**
   * Assign multiple permissions to a role
   *
   * @param roleId - Role UUID
   * @param permissionIds - Array of permission UUIDs
   */
  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    const rolePermissions = permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    await this.insert(rolePermissions);
  }

  /**
   * Revoke multiple permissions from a role
   *
   * @param roleId - Role UUID
   * @param permissionIds - Array of permission UUIDs
   * @returns Number of deleted records
   */
  async revokePermissionsFromRole(roleId: string, permissionIds: string[]): Promise<number> {
    const result = await this.delete({
      roleId,
      permissionId: In(permissionIds),
    });

    return result.affected || 0;
  }
}
