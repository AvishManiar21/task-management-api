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
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationStatus } from '../enums/notification-status.enum';

/**
 * Notification Entity
 *
 * Represents a notification sent to a user.
 *
 * Features:
 * - Multiple notification types (task assignment, due dates, comments, etc.)
 * - Multiple delivery channels (email, in-app)
 * - Read/unread tracking for IN_APP notifications
 * - Delivery status tracking (PENDING → SENT → DELIVERED/FAILED → READ)
 * - Metadata for extensibility (JSONB)
 *
 * Business Rules:
 * - Title max 255 characters
 * - Message is text (unlimited length)
 * - Status tracking: PENDING → SENT → DELIVERED/FAILED (→ READ for IN_APP)
 * - Only IN_APP notifications can be marked as READ
 *
 * Indexes:
 * - userId (for fetching user notifications)
 * - status (for filtering by status)
 * - createdAt (for sorting by date)
 *
 * Related Entities:
 * - NotificationLog (one-to-many): Delivery tracking
 */
@Entity('notification')
@Index(['userId', 'status'])
@Index(['userId', 'createdAt'])
export class Notification {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * User ID (recipient)
   */
  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  /**
   * Notification type
   */
  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  /**
   * Notification title (max 255 characters)
   */
  @Column({ type: 'varchar', length: 255 })
  title: string;

  /**
   * Notification message body
   */
  @Column({ type: 'text' })
  message: string;

  /**
   * Delivery channel
   */
  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  /**
   * Notification status
   */
  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  @Index()
  status: NotificationStatus;

  /**
   * Additional metadata (JSONB)
   * Can store task IDs, comment IDs, links, etc.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  /**
   * Timestamp when notification was read (IN_APP only)
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'read_at' })
  readAt: Date | null;

  /**
   * Creation timestamp
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  @Index()
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  /**
   * Mark notification as read (IN_APP only)
   */
  markAsRead(): void {
    if (this.channel !== NotificationChannel.IN_APP) {
      throw new Error('Only IN_APP notifications can be marked as read');
    }
    if (this.status === NotificationStatus.READ) {
      return;
    }
    this.status = NotificationStatus.READ;
    this.readAt = new Date();
  }

  /**
   * Check if notification is read
   */
  isRead(): boolean {
    return this.status === NotificationStatus.READ;
  }

  /**
   * Check if notification is delivered
   */
  isDelivered(): boolean {
    return this.status === NotificationStatus.DELIVERED;
  }

  /**
   * Check if notification failed
   */
  hasFailed(): boolean {
    return this.status === NotificationStatus.FAILED;
  }
}
