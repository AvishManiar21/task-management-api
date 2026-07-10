import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { WebhookDelivery } from './webhook-delivery.entity';
import { EventType } from '../enums/event-type.enum';

/**
 * WebhookSubscription Entity
 *
 * Represents a webhook subscription configuration for external systems.
 *
 * Features:
 * - Multiple event type subscriptions (array of EventType)
 * - HMAC-SHA256 signature generation using secret
 * - Active/inactive toggle for temporary disabling
 * - Tracks subscription creator for audit
 * - Delivery history via WebhookDelivery relationship
 *
 * Business Rules:
 * - URL must be valid HTTPS endpoint
 * - Secret is auto-generated on creation (32 bytes, hex-encoded)
 * - At least one event type must be selected
 * - Inactive subscriptions do not receive webhooks
 * - Only the subscription creator can view the secret
 *
 * Security:
 * - Secret is used for HMAC-SHA256 signature in X-Signature header
 * - External systems must verify signature to ensure authenticity
 * - Secret should never be logged or exposed in responses
 *
 * @see WebhookDelivery
 * @see EventType
 */
@Entity('webhook_subscriptions')
@Index(['createdBy'])
@Index(['isActive'])
export class WebhookSubscription {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Target webhook URL (HTTPS only)
   * External endpoint that will receive webhook payloads
   */
  @Column({ type: 'varchar', length: 500 })
  url: string;

  /**
   * Subscribed event types
   * Array of EventType enum values
   * Minimum 1 event type required
   */
  @Column({ type: 'simple-array' })
  events: EventType[];

  /**
   * Webhook secret for HMAC-SHA256 signature
   * Auto-generated on creation (32 bytes, hex-encoded = 64 chars)
   * Used to sign webhook payloads in X-Signature header
   * Format: HMAC-SHA256(payload, secret)
   *
   * SECURITY: Never expose in API responses, only show once at creation
   */
  @Column({ type: 'varchar', length: 255 })
  secret: string;

  /**
   * Active status
   * false = subscription disabled, no webhooks sent
   * true = subscription active, webhooks sent for subscribed events
   */
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  @Index()
  isActive: boolean;

  /**
   * Optional description for this subscription
   * Helps identify purpose of webhook integration
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /**
   * User who created this subscription
   */
  @Column({ type: 'uuid', name: 'created_by' })
  @Index()
  createdBy: string;

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
   * Webhook delivery history
   */
  @OneToMany(() => WebhookDelivery, (delivery) => delivery.subscription)
  deliveries: WebhookDelivery[];

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Check if subscription is active and can receive webhooks
   * @returns true if subscription is active
   */
  isActiveSubscription(): boolean {
    return this.isActive;
  }

  /**
   * Check if subscription is subscribed to a specific event type
   * @param eventType - Event type to check
   * @returns true if subscribed to event type
   */
  isSubscribedToEvent(eventType: EventType): boolean {
    return this.events.includes(eventType);
  }

  /**
   * Add an event type to subscription
   * @param eventType - Event type to add
   */
  addEventType(eventType: EventType): void {
    if (!this.events.includes(eventType)) {
      this.events.push(eventType);
    }
  }

  /**
   * Remove an event type from subscription
   * @param eventType - Event type to remove
   */
  removeEventType(eventType: EventType): void {
    this.events = this.events.filter((e) => e !== eventType);

    // Ensure at least one event remains
    if (this.events.length === 0) {
      throw new Error('Subscription must have at least one event type');
    }
  }

  /**
   * Activate subscription
   */
  activate(): void {
    this.isActive = true;
  }

  /**
   * Deactivate subscription (temporarily disable)
   */
  deactivate(): void {
    this.isActive = false;
  }

  /**
   * Validate subscription data
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // URL validation
    if (!this.url || this.url.trim().length === 0) {
      errors.push('URL is required');
    } else if (!this.url.startsWith('https://')) {
      errors.push('URL must be HTTPS');
    } else if (this.url.length > 500) {
      errors.push('URL cannot exceed 500 characters');
    }

    // Events validation
    if (!this.events || this.events.length === 0) {
      errors.push('At least one event type is required');
    }

    // Validate each event type
    if (this.events) {
      this.events.forEach((event, index) => {
        if (!Object.values(EventType).includes(event)) {
          errors.push(`Invalid event type at index ${index}: ${event}`);
        }
      });
    }

    // Secret validation
    if (!this.secret || this.secret.length === 0) {
      errors.push('Secret is required');
    }

    // Description validation
    if (this.description && this.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
