import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  OneToMany,
  Unique,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';

/**
 * Permission Entity
 *
 * Represents a permission in the RBAC system.
 *
 * Permission Format: {resource}:{action}
 * Examples:
 * - user:create, user:read, user:update, user:delete
 * - task:create, task:read, task:update, task:delete, task:assign
 * - team:create, team:read, team:update, team:delete, team:assign_members
 * - *:* (wildcard - full access)
 *
 * Business Rules:
 * - Permissions are unique by (resource, action) combination
 * - Wildcard permission (*:*) grants full access
 *
 * Related Entities:
 * - RolePermission (one-to-many): Permission assigned to many roles
 *
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-047 (Manage User Permissions - Granular)
 */
@Entity('permissions')
@Unique(['resource', 'action'])
@Index(['resource', 'action'], { unique: true })
export class Permission {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Resource type (e.g., 'user', 'task', 'team', '*')
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  resource: string;

  /**
   * Action type (e.g., 'create', 'read', 'update', 'delete', '*')
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  action: string;

  /**
   * Permission description
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Record creation timestamp
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Role permission assignments
   */
  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.permission)
  rolePermissions: RolePermission[];

  /**
   * Get permission string in format 'resource:action'
   */
  getPermissionString(): string {
    return `${this.resource}:${this.action}`;
  }
}
