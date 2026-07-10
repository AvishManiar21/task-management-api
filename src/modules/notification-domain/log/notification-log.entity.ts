import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Notification } from '../notification/notification.entity';
import { NotificationStatus } from '../enums/notification-status.enum';

/**
 * NotificationLog Entity
 *
 * Tracks delivery attempts and status for each notification.
 *
 * Features:
 * - Delivery attempt counting
 * - Error logging
 * - Last attempt timestamp tracking
 *
 * Business Rules:
 * - Each notification can have multiple logs (one per attempt)
 * - Attempts start at 0, increment on retry
 * - Status progression: PENDING → SENT → DELIVERED/FAILED
 * - errorMessage field populated only on FAILED status
 *
 * Indexes:
 * - notificationId (for fetching logs by notification)
 * - status (for filtering by delivery status)
 *
 * Related Entities:
 * - Notification (many-to-one): The notification being delivered
 */
@Entity('notification_log')
@Index(['notificationId'])
@Index(['status'])
export class NotificationLog {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Notification ID
   */
  @Column({ type: 'uuid', name: 'notification_id' })
  @Index()
  notificationId: string;

  /**
   * Notification relationship
   */
  @ManyToOne(() => Notification)
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;

  /**
   * Delivery status
   */
  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  @Index()
  status: NotificationStatus;

  /**
   * Number of delivery attempts
   */
  @Column({ type: 'integer', default: 0 })
  attempts: number;

  /**
   * Last attempt timestamp
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'last_attempt_at' })
  lastAttemptAt: Date | null;

  /**
   * Error message (if delivery failed)
   */
  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  /**
   * Creation timestamp
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  /**
   * Record delivery attempt
   */
  recordAttempt(success: boolean, error?: string): void {
    this.attempts++;
    this.lastAttemptAt = new Date();

    if (success) {
      this.status = NotificationStatus.DELIVERED;
      this.errorMessage = null;
    } else {
      this.status = NotificationStatus.FAILED;
      this.errorMessage = error || 'Unknown error';
    }
  }

  /**
   * Mark as sent (in transit)
   */
  markAsSent(): void {
    this.status = NotificationStatus.SENT;
    this.lastAttemptAt = new Date();
    this.attempts++;
  }

  /**
   * Check if delivery failed
   */
  hasFailed(): boolean {
    return this.status === NotificationStatus.FAILED;
  }

  /**
   * Check if delivery is complete
   */
  isDelivered(): boolean {
    return this.status === NotificationStatus.DELIVERED;
  }
}
