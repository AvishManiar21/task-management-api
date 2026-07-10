import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Team } from '../team/team.entity';
import { UserRole } from '../authorization/user-role.entity';

/**
 * User Entity
 *
 * Represents a user in the Task Management system with Auth0 integration.
 *
 * Field Ownership:
 * - Auth0-synced (read-only): auth0Id, email, emailVerified, name, picture
 * - User-editable: displayName, timezone, language, notificationPreferences
 * - Admin-only: teamId, isActive, deletedAt
 *
 * Business Rules:
 * - Email must be unique and verified before task assignment (BR-EMAIL-001)
 * - Users belong to at most one team (BR-TEAM-001)
 * - Soft delete preserves audit trails (BR-DELETE-001)
 * - PII is anonymized on GDPR deletion (BR-DELETE-003)
 *
 * Indexes:
 * - auth0Id (unique) - Fast lookup during JWT validation
 * - email (unique) - User search and duplicate prevention
 * - teamId - Team member queries
 * - isActive + deletedAt - Active user filtering
 *
 * Related Entities:
 * - Team (many-to-one): User belongs to one team
 * - UserRole (one-to-many): User has multiple roles
 *
 * @see US-041 (Register New User)
 * @see US-043 (Edit User Profile)
 * @see US-044 (Deactivate User Account)
 * @see US-046 (Assign User to Team)
 */
@Entity('users')
@Index(['auth0Id'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['email'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['teamId'])
@Index(['isActive', 'deletedAt'])
export class User {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Auth0 user ID (source of truth for identity)
   * Synced from Auth0, cannot be edited by user
   */
  @Column({ type: 'varchar', length: 255, nullable: false, name: 'auth0_id' })
  @Index({ unique: true })
  auth0Id: string;

  /**
   * User email address (synced from Auth0)
   * Must be unique and verified before task assignment
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  @Index({ unique: true })
  email: string;

  /**
   * Email verification status (synced from Auth0)
   * Required to be true for task assignment (BR-EMAIL-001)
   */
  @Column({ type: 'boolean', default: false, name: 'email_verified' })
  emailVerified: boolean;

  /**
   * User full name (synced from Auth0)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  /**
   * Profile picture URL (synced from Auth0)
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  picture: string | null;

  /**
   * Display name (user-editable)
   * Allows users to set preferred name different from Auth0 name
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'display_name' })
  displayName: string | null;

  /**
   * User timezone (user-editable)
   * Default: UTC
   * Must be valid IANA timezone (e.g., 'America/New_York')
   */
  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone: string;

  /**
   * User preferred language (user-editable)
   * Default: 'en'
   * Format: ISO 639-1 code (e.g., 'en', 'es', 'fr')
   */
  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string;

  /**
   * Notification preferences (user-editable)
   * JSON structure: { email: boolean, push: boolean, inApp: boolean, taskAssigned: boolean, etc. }
   */
  @Column({
    type: 'jsonb',
    nullable: true,
    default: () => "'{}'"
,
    name: 'notification_preferences',
  })
  notificationPreferences: Record<string, any>;

  /**
   * Team membership (admin-only)
   * Foreign key to Team entity
   * Users can belong to at most one team (BR-TEAM-001)
   */
  @Column({ type: 'uuid', nullable: true, name: 'team_id' })
  @Index()
  teamId: string | null;

  /**
   * Team relationship
   */
  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  /**
   * User active status (admin-only)
   * false = deactivated, true = active
   * Deactivation is reversible (BR-DEACT-003)
   */
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

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
   * Last login timestamp
   * Updated on successful authentication
   */
  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date | null;

  /**
   * Soft delete timestamp
   * When set, user is considered deleted (GDPR right-to-erasure)
   * PII fields are anonymized on deletion (BR-DELETE-003)
   */
  @DeleteDateColumn({ name: 'deleted_at' })
  @Exclude()
  deletedAt: Date | null;

  /**
   * User roles relationship
   */
  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];

  /**
   * Helper method: Get full display name
   * Returns displayName if set, otherwise falls back to name
   */
  getDisplayName(): string {
    return this.displayName || this.name || 'Unknown User';
  }

  /**
   * Helper method: Check if user can be assigned tasks
   * Requires email verification (BR-EMAIL-001)
   */
  canBeAssignedTasks(): boolean {
    return this.emailVerified && this.isActive && !this.deletedAt;
  }

  /**
   * Helper method: Check if user is active
   */
  isActiveUser(): boolean {
    return this.isActive && !this.deletedAt;
  }
}
