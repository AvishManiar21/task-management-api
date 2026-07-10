import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { IntegrationEvent } from '../integration-event.entity';
import { WebhookService } from '../../webhook/services/webhook.service';
import { EventType } from '../../enums/event-type.enum';

/**
 * EventPublisherService
 *
 * Core business logic for publishing domain events to external systems.
 *
 * Features:
 * - Publish domain events to integration event log
 * - Match events to webhook subscriptions
 * - Trigger webhook deliveries for subscribed events
 * - Query event history for audit and debugging
 * - Support event replay for new subscriptions
 *
 * Event Publishing Flow:
 * 1. Domain event occurs (task created, updated, etc.)
 * 2. publish() method called with event data
 * 3. Event saved to IntegrationEvent table
 * 4. Find all active webhook subscriptions for event type
 * 5. Create WebhookDelivery records for each subscription
 * 6. Webhook delivery happens asynchronously
 *
 * Event Format:
 * - eventType: EventType enum value (task.created, etc.)
 * - entityId: UUID of entity that triggered event
 * - entityType: Extracted from eventType (task, user, comment, etc.)
 * - payload: Complete event data (JSONB)
 * - triggeredBy: User who triggered event (null for system events)
 * - correlationId: Optional correlation ID for tracing related events
 *
 * Usage Example:
 * ```typescript
 * await eventPublisher.publish(
 *   EventType.TASK_CREATED,
 *   task.id,
 *   'task',
 *   {
 *     id: task.id,
 *     title: task.title,
 *     priority: task.priority,
 *     creatorId: task.creatorId,
 *     createdAt: task.createdAt,
 *   },
 *   userId,
 *   correlationId
 * );
 * ```
 *
 * @see IntegrationEvent
 * @see WebhookService
 * @see EventType
 */
@Injectable()
export class EventPublisherService {
  private readonly logger = new LoggerService();

  constructor(
    @InjectRepository(IntegrationEvent)
    private readonly eventRepo: Repository<IntegrationEvent>,
    private readonly webhookService: WebhookService,
  ) {
    this.logger.setContext('EventPublisherService');
  }

  /**
   * Publish a domain event
   *
   * Steps:
   * 1. Create IntegrationEvent record
   * 2. Extract entity type from event type
   * 3. Find active webhook subscriptions for event type
   * 4. Trigger webhook deliveries
   *
   * Business Rules:
   * - Events are immutable (never updated/deleted)
   * - Event payload stored as JSONB
   * - Entity type extracted automatically from event type
   * - Webhook delivery happens asynchronously
   *
   * @param eventType - Type of event (task.created, etc.)
   * @param entityId - ID of entity that triggered event
   * @param entityType - Type of entity (task, user, comment, etc.)
   * @param payload - Event payload data
   * @param triggeredBy - User who triggered event (null for system events)
   * @param correlationId - Optional correlation ID for tracing
   * @param metadata - Optional metadata about event publication
   * @returns Created integration event
   */
  async publish(
    eventType: EventType,
    entityId: string,
    entityType: string,
    payload: Record<string, any>,
    triggeredBy: string | null = null,
    correlationId: string | null = null,
    metadata: Record<string, any> | null = null,
  ): Promise<IntegrationEvent> {
    this.logger.log('Publishing integration event', {
      eventType,
      entityId,
      entityType,
      triggeredBy,
    });

    // Create integration event record
    const event = this.eventRepo.create({
      eventType,
      entityId,
      entityType,
      payload,
      triggeredBy,
      correlationId,
      metadata,
    });

    const savedEvent = await this.eventRepo.save(event);
    this.logger.log('Integration event published', {
      eventId: savedEvent.id,
      eventType: savedEvent.eventType,
    });

    // Trigger webhooks asynchronously
    // Use setImmediate to not block the response
    setImmediate(() => {
      this.triggerWebhooks(savedEvent).catch((error) => {
        this.logger.error('Failed to trigger webhooks for event', error.stack, {
          eventId: savedEvent.id,
          eventType: savedEvent.eventType,
        });
      });
    });

    return savedEvent;
  }

  /**
   * Trigger webhooks for a published event
   *
   * Steps:
   * 1. Find all active subscriptions for event type
   * 2. Send webhook for each subscription
   * 3. Log any errors (but don't fail the request)
   *
   * @param event - Integration event to broadcast
   */
  private async triggerWebhooks(event: IntegrationEvent): Promise<void> {
    this.logger.log('Triggering webhooks for event', {
      eventId: event.id,
      eventType: event.eventType,
    });

    // Find active subscriptions for this event type
    const subscriptions = await this.webhookService.listActiveSubscriptionsForEvent(
      event.eventType,
    );

    if (subscriptions.length === 0) {
      this.logger.log('No active webhook subscriptions for event type', {
        eventType: event.eventType,
      });
      return;
    }

    this.logger.log('Found webhook subscriptions', {
      eventType: event.eventType,
      count: subscriptions.length,
    });

    // Send webhook to each subscription
    for (const subscription of subscriptions) {
      try {
        // Prepare webhook payload
        const webhookPayload = {
          event: event.eventType,
          entityId: event.entityId,
          entityType: event.entityType,
          data: event.payload,
          timestamp: event.publishedAt.toISOString(),
          triggeredBy: event.triggeredBy,
          correlationId: event.correlationId,
        };

        await this.webhookService.sendWebhook(subscription, event.eventType, webhookPayload);
      } catch (error) {
        this.logger.error('Failed to send webhook', error.stack, {
          subscriptionId: subscription.id,
          eventId: event.id,
        });
        // Continue with other subscriptions even if one fails
      }
    }
  }

  /**
   * Get an integration event by ID
   *
   * @param id - Event ID
   * @returns Integration event
   */
  async getEvent(id: string): Promise<IntegrationEvent | null> {
    return this.eventRepo.findOne({ where: { id } });
  }

  /**
   * List integration events with filters
   *
   * @param eventType - Optional event type filter
   * @param entityId - Optional entity ID filter
   * @param entityType - Optional entity type filter
   * @param triggeredBy - Optional user filter
   * @param limit - Max number of events to return
   * @returns List of integration events
   */
  async listEvents(
    eventType?: EventType,
    entityId?: string,
    entityType?: string,
    triggeredBy?: string,
    limit = 50,
  ): Promise<IntegrationEvent[]> {
    const queryBuilder = this.eventRepo.createQueryBuilder('event');

    if (eventType) {
      queryBuilder.andWhere('event.event_type = :eventType', { eventType });
    }

    if (entityId) {
      queryBuilder.andWhere('event.entity_id = :entityId', { entityId });
    }

    if (entityType) {
      queryBuilder.andWhere('event.entity_type = :entityType', { entityType });
    }

    if (triggeredBy) {
      queryBuilder.andWhere('event.triggered_by = :triggeredBy', { triggeredBy });
    }

    queryBuilder.orderBy('event.published_at', 'DESC').take(limit);

    return queryBuilder.getMany();
  }

  /**
   * Get event count by type
   *
   * @param eventType - Event type to count
   * @returns Event count
   */
  async getEventCount(eventType?: EventType): Promise<number> {
    const queryBuilder = this.eventRepo.createQueryBuilder('event');

    if (eventType) {
      queryBuilder.where('event.event_type = :eventType', { eventType });
    }

    return queryBuilder.getCount();
  }

  /**
   * Get recent events (within last N hours)
   *
   * @param hours - Number of hours to look back
   * @param limit - Max number of events to return
   * @returns List of recent integration events
   */
  async getRecentEvents(hours = 24, limit = 100): Promise<IntegrationEvent[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    return this.eventRepo.find({
      where: {
        publishedAt: cutoffDate as any, // TypeORM will handle >= comparison
      },
      order: { publishedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get events by correlation ID
   *
   * Used to trace related events in a request/transaction
   *
   * @param correlationId - Correlation ID
   * @returns List of correlated events
   */
  async getEventsByCorrelationId(correlationId: string): Promise<IntegrationEvent[]> {
    return this.eventRepo.find({
      where: { correlationId },
      order: { publishedAt: 'ASC' },
    });
  }

  /**
   * Replay events to a webhook subscription
   *
   * Used when adding a new webhook subscription that should receive historical events
   *
   * @param subscriptionId - Webhook subscription ID
   * @param eventTypes - Event types to replay
   * @param fromDate - Start date for replay
   * @param toDate - End date for replay
   * @returns Number of events replayed
   */
  async replayEvents(
    subscriptionId: string,
    eventTypes: EventType[],
    fromDate: Date,
    toDate: Date,
  ): Promise<number> {
    this.logger.log('Replaying events to subscription', {
      subscriptionId,
      eventTypes,
      fromDate,
      toDate,
    });

    // Find subscription
    const subscription = await this.webhookService.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Webhook subscription ${subscriptionId} not found`);
    }

    // Build query for events
    const queryBuilder = this.eventRepo
      .createQueryBuilder('event')
      .where('event.event_type IN (:...eventTypes)', { eventTypes })
      .andWhere('event.published_at >= :fromDate', { fromDate })
      .andWhere('event.published_at <= :toDate', { toDate })
      .orderBy('event.published_at', 'ASC');

    const events = await queryBuilder.getMany();

    this.logger.log('Found events to replay', {
      subscriptionId,
      count: events.length,
    });

    // Send webhook for each event
    let replayed = 0;
    for (const event of events) {
      try {
        const webhookPayload = {
          event: event.eventType,
          entityId: event.entityId,
          entityType: event.entityType,
          data: event.payload,
          timestamp: event.publishedAt.toISOString(),
          triggeredBy: event.triggeredBy,
          correlationId: event.correlationId,
          replay: true, // Mark as replayed event
        };

        await this.webhookService.sendWebhook(subscription, event.eventType, webhookPayload);
        replayed++;
      } catch (error) {
        this.logger.error('Failed to replay event', error.stack, {
          eventId: event.id,
          subscriptionId,
        });
        // Continue with other events
      }
    }

    this.logger.log('Events replayed successfully', {
      subscriptionId,
      replayed,
      total: events.length,
    });

    return replayed;
  }
}
