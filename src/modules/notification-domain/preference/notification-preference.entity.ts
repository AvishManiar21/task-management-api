import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user-domain/user/user.entity';

/**
 * NotificationPreference Entity
 *
 * Stores user notification preferences for different channels and event types.
 *
 * Features:
 * - Per-channel enabling (email, in-app)
 * - Granular event type filtering
 * - One preference record per user (unique constraint)
 *
 * Business Rules:
 * - Each user has exactly one preference record
 * - Default: email and in-app enabled for all event types
 * - enabledEventTypes is an array of NotificationType strings
 *
 * Indexes:
 * - userId (unique) - One preference per user
 *
 * Related Entities:
 * - User (many-to-one): Preference owner
 */
@Entity('notification_preference')
@Index(['userId'], { unique: true })
export class NotificationPreference {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * User ID (unique - one preference per user)
   */
  @Column({ type: 'uuid', name: 'user_id', unique: true })
  @Index({ unique: true })
  userId: string;

  /**
   * User relationship
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Email notifications enabled
   */
  @Column({ type: 'boolean', default: true, name: 'email_enabled' })
  emailEnabled: boolean;

  /**
   * In-app notifications enabled
   */
  @Column({ type: 'boolean', default: true, name: 'in_app_enabled' })
  inAppEnabled: boolean;

  /**
   * Enabled event types (array of NotificationType strings)
   * Empty array means all events disabled
   */
  @Column({ type: 'simple-array', name: 'enabled_event_types' })
  enabledEventTypes: string[];

  /**
   * Creation timestamp
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  /**
   * Check if event type is enabled
   */
  isEventTypeEnabled(eventType: string): boolean {
    return this.enabledEventTypes.includes(eventType);
  }

  /**
   * Check if any notifications are enabled
   */
  hasNotificationsEnabled(): boolean {
    return (
      (this.emailEnabled || this.inAppEnabled) &&
      this.enabledEventTypes.length > 0
    );
  }
}
