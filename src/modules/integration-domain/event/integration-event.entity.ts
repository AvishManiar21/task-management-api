import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { EventType } from '../enums/event-type.enum';

/**
 * IntegrationEvent Entity
 *
 * Represents a domain event that has been published to external systems.
 *
 * Features:
 * - Complete event log for audit and debugging
 * - Event replay capability for failed webhooks
 * - Event sourcing support for audit trails
 * - Efficient querying by event type and entity
 *
 * Purpose:
 * - Audit trail: Track all events published by the system
 * - Debugging: Investigate webhook delivery issues
 * - Replay: Resend events to new webhook subscriptions
 * - Analytics: Analyze event patterns and volumes
 * - Compliance: Event history for regulatory requirements
 *
 * Business Rules:
 * - Events are immutable (no updates/deletes)
 * - Payload stored as JSONB for efficient querying
 * - Retention: Events kept for 90 days (configurable)
 * - Indexes for fast event type and entity lookups
 *
 * Event Lifecycle:
 * 1. Domain event occurs (task created, updated, etc.)
 * 2. Event published via EventPublisher service
 * 3. Event logged in IntegrationEvent table
 * 4. Webhook subscriptions matched by event type
 * 5. WebhookDelivery records created for each subscription
 *
 * @see EventType
 * @see EventPublisher
 */
@Entity('integration_events')
@Index(['eventType'])
@Index(['entityId'])
@Index(['entityType'])
@Index(['publishedAt'])
export class IntegrationEvent {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Event type (task.created, task.updated, etc.)
   */
  @Column({ type: 'enum', enum: EventType, name: 'event_type' })
  @Index()
  eventType: EventType;

  /**
   * Entity type (task, user, comment, etc.)
   * Extracted from eventType for easier filtering
   * Example: 'task' from 'task.created'
   */
  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  @Index()
  entityType: string;

  /**
   * Entity ID that triggered the event
   * UUID of the task, user, comment, etc.
   */
  @Column({ type: 'uuid', name: 'entity_id' })
  @Index()
  entityId: string;

  /**
   * Event payload (JSONB)
   * Contains all relevant event data
   * Structure varies by event type
   *
   * Common fields:
   * - id: Entity ID
   * - timestamp: Event timestamp
   * - actor: User who triggered the event
   * - changes: What changed (for update events)
   * - metadata: Additional context
   */
  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  /**
   * User who triggered the event
   * null for system-generated events
   */
  @Column({ type: 'uuid', nullable: true, name: 'triggered_by' })
  @Index()
  triggeredBy: string | null;

  /**
   * Event publication timestamp
   * When event was published to integration system
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'published_at' })
  @Index()
  publishedAt: Date;

  /**
   * Optional correlation ID for tracing
   * Links related events together
   * Example: All events in a single request share same correlationId
   */
  @Column({ type: 'uuid', nullable: true, name: 'correlation_id' })
  @Index()
  correlationId: string | null;

  /**
   * Event metadata (JSONB)
   * Additional context about event publication
   * Example: { source: 'api', userAgent: '...', ipAddress: '...' }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Extract entity type from event type
   * Example: 'task.created' -> 'task'
   * @param eventType - Event type
   * @returns Entity type
   */
  static extractEntityType(eventType: EventType): string {
    return eventType.split('.')[0];
  }

  /**
   * Extract action from event type
   * Example: 'task.created' -> 'created'
   * @param eventType - Event type
   * @returns Action
   */
  static extractAction(eventType: EventType): string {
    return eventType.split('.')[1];
  }

  /**
   * Get entity type for this event
   * @returns Entity type (task, user, comment, etc.)
   */
  getEntityType(): string {
    return IntegrationEvent.extractEntityType(this.eventType);
  }

  /**
   * Get action for this event
   * @returns Action (created, updated, deleted, etc.)
   */
  getAction(): string {
    return IntegrationEvent.extractAction(this.eventType);
  }

  /**
   * Check if event was triggered by a user
   * @returns true if event has triggeredBy user
   */
  isUserTriggered(): boolean {
    return this.triggeredBy !== null;
  }

  /**
   * Check if event is part of a correlation group
   * @returns true if event has correlationId
   */
  isCorrelated(): boolean {
    return this.correlationId !== null;
  }

  /**
   * Get event age in hours
   * @returns Number of hours since event was published
   */
  getAgeInHours(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.publishedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  }

  /**
   * Check if event is recent (within last hour)
   * @returns true if event published within last hour
   */
  isRecent(): boolean {
    return this.getAgeInHours() < 1;
  }

  /**
   * Get human-readable event description
   * @returns Event description
   */
  getDescription(): string {
    const entityType = this.getEntityType();
    const action = this.getAction();
    const entityId = this.entityId.substring(0, 8);

    return `${entityType} ${entityId} was ${action}`;
  }

  /**
   * Validate event data
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Event type validation
    if (!Object.values(EventType).includes(this.eventType)) {
      errors.push('Invalid event type');
    }

    // Entity type validation
    if (!this.entityType || this.entityType.trim().length === 0) {
      errors.push('Entity type is required');
    }

    // Entity ID validation
    if (!this.entityId || this.entityId.trim().length === 0) {
      errors.push('Entity ID is required');
    }

    // Payload validation
    if (!this.payload || Object.keys(this.payload).length === 0) {
      errors.push('Payload is required and cannot be empty');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
