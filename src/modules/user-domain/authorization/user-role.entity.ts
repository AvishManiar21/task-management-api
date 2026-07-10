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
import { User } from '../user/user.entity';
import { Role } from './role.entity';

/**
 * UserRole Entity (Join Table)
 *
 * Represents the many-to-many relationship between users and roles.
 *
 * Business Rules:
 * - A user can have multiple roles
 * - A role can be assigned to multiple users
 * - Composite uniqueness: (userId, roleId)
 * - Admin-only role assignment (BR-ROLE-001)
 * - Audit trail: assignedBy, assignedAt
 *
 * Related Entities:
 * - User (many-to-one)
 * - Role (many-to-one)
 *
 * @see US-042 (Manage User Roles and Permissions)
 */
@Entity('user_roles')
@Unique(['userId', 'roleId'])
@Index(['userId', 'roleId'], { unique: true })
@Index(['userId'])
@Index(['roleId'])
export class UserRole {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Foreign key to User
   */
  @Column({ type: 'uuid', nullable: false, name: 'user_id' })
  @Index()
  userId: string;

  /**
   * User relationship
   */
  @ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Foreign key to Role
   */
  @Column({ type: 'uuid', nullable: false, name: 'role_id' })
  @Index()
  roleId: string;

  /**
   * Role relationship
   */
  @ManyToOne(() => Role, (role) => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  /**
   * User who assigned this role (audit trail)
   */
  @Column({ type: 'uuid', nullable: false, name: 'assigned_by' })
  assignedBy: string;

  /**
   * Role assignment timestamp
   */
  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;
}
