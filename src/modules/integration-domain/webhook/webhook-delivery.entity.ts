import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhookStatus } from '../enums/webhook-status.enum';
import { EventType } from '../enums/event-type.enum';

/**
 * WebhookDelivery Entity
 *
 * Represents a single webhook delivery attempt with retry tracking.
 *
 * Features:
 * - Tracks delivery attempts and status
 * - Exponential backoff retry strategy
 * - HTTP response capture (status code, body)
 * - Next retry timestamp calculation
 * - Complete audit trail of delivery lifecycle
 *
 * Retry Strategy:
 * - Max attempts: 5
 * - Backoff delays: 1min, 5min, 15min, 1hour, 6hours
 * - Status transitions: PENDING -> PROCESSING -> SUCCESS/RETRYING/FAILED
 *
 * Business Rules:
 * - Timeout: 30 seconds per attempt
 * - Success: 2xx HTTP response
 * - Retry: 4xx, 5xx, timeout, network errors
 * - Failed: After 5 failed attempts
 * - Idempotency: Use deliveryId in webhook payload
 *
 * @see WebhookSubscription
 * @see WebhookStatus
 */
@Entity('webhook_deliveries')
@Index(['subscriptionId'])
@Index(['status'])
@Index(['eventType'])
@Index(['nextRetryAt'])
@Index(['createdAt'])
export class WebhookDelivery {
  /**
   * Unique identifier (UUID v4)
   * Used for idempotency in webhook payloads
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Associated webhook subscription
   */
  @Column({ type: 'uuid', name: 'subscription_id' })
  @Index()
  subscriptionId: string;

  /**
   * Event type that triggered this webhook
   */
  @Column({ type: 'enum', enum: EventType, name: 'event_type' })
  @Index()
  eventType: EventType;

  /**
   * Webhook payload (JSON)
   * Contains event data sent to external endpoint
   */
  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  /**
   * Current delivery status
   */
  @Column({ type: 'enum', enum: WebhookStatus, default: WebhookStatus.PENDING })
  @Index()
  status: WebhookStatus;

  /**
   * Number of delivery attempts made
   * Incremented on each attempt
   * Max: 5 attempts
   */
  @Column({ type: 'integer', default: 0 })
  attempts: number;

  /**
   * HTTP status code from last delivery attempt
   * null if no attempt made yet or network error
   */
  @Column({ type: 'integer', nullable: true, name: 'http_status_code' })
  httpStatusCode: number | null;

  /**
   * HTTP response body from last delivery attempt
   * Truncated to 1KB to prevent excessive storage
   * null if no response received
   */
  @Column({ type: 'text', nullable: true, name: 'response_body' })
  responseBody: string | null;

  /**
   * Error message from last delivery attempt
   * Contains timeout, network error, or other failure reason
   */
  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  /**
   * Timestamp of next retry attempt
   * Calculated using exponential backoff
   * null if no retry scheduled (success or failed)
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'next_retry_at' })
  @Index()
  nextRetryAt: Date | null;

  /**
   * Timestamp of last delivery attempt
   * null if no attempt made yet
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'last_attempted_at' })
  lastAttemptedAt: Date | null;

  /**
   * Timestamp when delivery succeeded
   * null if not yet successful
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'delivered_at' })
  deliveredAt: Date | null;

  /**
   * Creation timestamp (when webhook was queued)
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
   * Associated webhook subscription
   */
  @ManyToOne(() => WebhookSubscription, (subscription) => subscription.deliveries)
  @JoinColumn({ name: 'subscription_id' })
  subscription: WebhookSubscription;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Check if delivery can be retried
   * @returns true if retry is possible (attempts < 5 and not succeeded)
   */
  canRetry(): boolean {
    return this.attempts < 5 && this.status !== WebhookStatus.SUCCESS;
  }

  /**
   * Check if delivery is pending retry
   * @returns true if status is RETRYING and nextRetryAt is in the future
   */
  isPendingRetry(): boolean {
    return (
      this.status === WebhookStatus.RETRYING &&
      this.nextRetryAt !== null &&
      new Date() < new Date(this.nextRetryAt)
    );
  }

  /**
   * Check if delivery is ready for retry
   * @returns true if status is RETRYING and nextRetryAt has passed
   */
  isReadyForRetry(): boolean {
    return (
      this.status === WebhookStatus.RETRYING &&
      this.nextRetryAt !== null &&
      new Date() >= new Date(this.nextRetryAt)
    );
  }

  /**
   * Calculate next retry timestamp using exponential backoff
   * Backoff schedule: 1min, 5min, 15min, 1hour, 6hours
   * @returns Next retry timestamp or null if no more retries
   */
  calculateNextRetryAt(): Date | null {
    if (!this.canRetry()) {
      return null;
    }

    // Exponential backoff delays in milliseconds
    const backoffDelays = [
      1 * 60 * 1000, // 1 minute
      5 * 60 * 1000, // 5 minutes
      15 * 60 * 1000, // 15 minutes
      60 * 60 * 1000, // 1 hour
      6 * 60 * 60 * 1000, // 6 hours
    ];

    const delayIndex = Math.min(this.attempts, backoffDelays.length - 1);
    const delay = backoffDelays[delayIndex];

    return new Date(Date.now() + delay);
  }

  /**
   * Mark delivery as processing
   */
  markAsProcessing(): void {
    this.status = WebhookStatus.PROCESSING;
    this.lastAttemptedAt = new Date();
  }

  /**
   * Mark delivery as successful
   * @param statusCode - HTTP status code
   * @param responseBody - HTTP response body (truncated to 1KB)
   */
  markAsSuccess(statusCode: number, responseBody: string): void {
    this.status = WebhookStatus.SUCCESS;
    this.httpStatusCode = statusCode;
    this.responseBody = this.truncateResponse(responseBody);
    this.deliveredAt = new Date();
    this.nextRetryAt = null;
    this.errorMessage = null;
  }

  /**
   * Mark delivery as failed (will retry if possible)
   * @param statusCode - HTTP status code (if available)
   * @param errorMessage - Error message
   * @param responseBody - HTTP response body (if available)
   */
  markAsFailed(statusCode: number | null, errorMessage: string, responseBody?: string): void {
    this.attempts += 1;
    this.httpStatusCode = statusCode;
    this.errorMessage = errorMessage;
    this.responseBody = responseBody ? this.truncateResponse(responseBody) : null;

    if (this.canRetry()) {
      this.status = WebhookStatus.RETRYING;
      this.nextRetryAt = this.calculateNextRetryAt();
    } else {
      this.status = WebhookStatus.FAILED;
      this.nextRetryAt = null;
    }
  }

  /**
   * Truncate response body to 1KB
   * @param response - Response body
   * @returns Truncated response
   */
  private truncateResponse(response: string): string {
    const maxLength = 1024;
    if (response.length <= maxLength) {
      return response;
    }
    return response.substring(0, maxLength) + '... [truncated]';
  }

  /**
   * Get human-readable status description
   * @returns Status description
   */
  getStatusDescription(): string {
    switch (this.status) {
      case WebhookStatus.PENDING:
        return 'Pending delivery';
      case WebhookStatus.PROCESSING:
        return 'Currently being sent';
      case WebhookStatus.SUCCESS:
        return `Delivered successfully at ${this.deliveredAt?.toISOString()}`;
      case WebhookStatus.RETRYING:
        return `Retrying (attempt ${this.attempts}/5), next retry at ${this.nextRetryAt?.toISOString()}`;
      case WebhookStatus.FAILED:
        return `Failed after ${this.attempts} attempts: ${this.errorMessage}`;
      default:
        return 'Unknown status';
    }
  }
}
