import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

/**
 * RolePermission Entity (Join Table)
 *
 * Represents the many-to-many relationship between roles and permissions.
 *
 * Business Rules:
 * - A role can have multiple permissions
 * - A permission can be assigned to multiple roles
 * - Composite uniqueness: (roleId, permissionId)
 *
 * Related Entities:
 * - Role (many-to-one)
 * - Permission (many-to-one)
 *
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-047 (Manage User Permissions - Granular)
 */
@Entity('role_permissions')
@Unique(['roleId', 'permissionId'])
@Index(['roleId', 'permissionId'], { unique: true })
@Index(['roleId'])
@Index(['permissionId'])
export class RolePermission {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Foreign key to Role
   */
  @Column({ type: 'uuid', nullable: false, name: 'role_id' })
  @Index()
  roleId: string;

  /**
   * Role relationship
   */
  @ManyToOne(() => Role, (role) => role.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  /**
   * Foreign key to Permission
   */
  @Column({ type: 'uuid', nullable: false, name: 'permission_id' })
  @Index()
  permissionId: string;

  /**
   * Permission relationship
   */
  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  /**
   * Permission assignment timestamp
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
