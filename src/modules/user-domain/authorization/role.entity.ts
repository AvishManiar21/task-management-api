import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { UserRole } from './user-role.entity';
import { RolePermission } from './role-permission.entity';

/**
 * Role Entity
 *
 * Represents a role in the RBAC (Role-Based Access Control) system.
 *
 * System Roles (cannot be deleted):
 * - ADMIN: Full system access
 * - TEAM_LEAD: Team management + task assignment
 * - MEMBER: Basic task management
 * - OBSERVER: Read-only access
 *
 * Business Rules:
 * - System roles cannot be deleted (BR-ROLE-002)
 * - Role names must be unique (BR-ROLE-001)
 * - Custom roles can be created by admins (US-047)
 *
 * Related Entities:
 * - UserRole (one-to-many): Role assigned to many users
 * - RolePermission (one-to-many): Role has many permissions
 *
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-047 (Manage User Permissions - Granular)
 */
@Entity('roles')
@Index(['name'], { unique: true })
export class Role {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Role name (unique)
   * Examples: 'ADMIN', 'TEAM_LEAD', 'MEMBER', 'OBSERVER', or custom names
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  @Index({ unique: true })
  name: string;

  /**
   * Role description
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * System role flag
   * true = System role (cannot be deleted)
   * false = Custom role (can be deleted by admin)
   */
  @Column({ type: 'boolean', default: false, name: 'is_system' })
  isSystem: boolean;

  /**
   * Record creation timestamp
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * User role assignments
   */
  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];

  /**
   * Role permissions
   */
  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions: RolePermission[];
}
