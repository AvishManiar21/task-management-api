import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomBytes } from 'crypto';
import axios, { AxiosError } from 'axios';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { WebhookSubscription } from '../webhook-subscription.entity';
import { WebhookDelivery } from '../webhook-delivery.entity';
import { CreateWebhookSubscriptionDto } from '../dto/create-webhook-subscription.dto';
import { UpdateWebhookSubscriptionDto } from '../dto/update-webhook-subscription.dto';
import { WebhookStatus } from '../../enums/webhook-status.enum';
import { EventType } from '../../enums/event-type.enum';

/**
 * WebhookService
 *
 * Core business logic for webhook subscription management and delivery.
 *
 * Features:
 * - Create and manage webhook subscriptions
 * - Sign webhook payloads with HMAC-SHA256
 * - Send webhooks with retry logic (exponential backoff)
 * - Track delivery attempts and status
 * - Query webhook delivery history
 *
 * Webhook Delivery Flow:
 * 1. Event occurs (task created, updated, etc.)
 * 2. EventPublisher matches event to active subscriptions
 * 3. WebhookDelivery record created for each subscription
 * 4. sendWebhook() sends HTTP POST to subscription URL
 * 5. Sign payload with HMAC-SHA256 secret
 * 6. Retry failed deliveries with exponential backoff
 *
 * Retry Strategy:
 * - Max attempts: 5
 * - Backoff delays: 1min, 5min, 15min, 1hour, 6hours
 * - Timeout: 30 seconds per attempt
 * - Success: 2xx HTTP response
 * - Retry: 4xx, 5xx, timeout, network errors
 *
 * Security:
 * - HMAC-SHA256 signature in X-Webhook-Signature header
 * - Format: sha256=<hex-encoded-hash>
 * - External systems must verify signature
 * - Secret is auto-generated (32 bytes, hex-encoded = 64 chars)
 *
 * @see WebhookSubscription
 * @see WebhookDelivery
 */
@Injectable()
export class WebhookService {
  private readonly logger = new LoggerService();

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepo: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
  ) {
    this.logger.setContext('WebhookService');
  }

  /**
   * Create a new webhook subscription
   *
   * Business Rules:
   * - URL must be HTTPS
   * - At least one event type required
   * - Secret auto-generated (32 bytes = 64 hex chars)
   * - Default: active
   *
   * @param dto - Subscription creation data
   * @param userId - User creating the subscription
   * @returns Created subscription with secret (only time secret is shown)
   */
  async createSubscription(
    dto: CreateWebhookSubscriptionDto,
    userId: string,
  ): Promise<WebhookSubscription> {
    this.logger.log('Creating webhook subscription', { url: dto.url, userId });

    // Validate URL is HTTPS
    if (!dto.url.startsWith('https://')) {
      throw new BadRequestException('Webhook URL must be HTTPS');
    }

    // Validate at least one event type
    if (!dto.events || dto.events.length === 0) {
      throw new BadRequestException('At least one event type is required');
    }

    // Validate event types
    const invalidEvents = dto.events.filter(
      (event) => !Object.values(EventType).includes(event),
    );
    if (invalidEvents.length > 0) {
      throw new BadRequestException(`Invalid event types: ${invalidEvents.join(', ')}`);
    }

    // Generate secure random secret (32 bytes = 64 hex chars)
    const secret = this.generateSecret();

    // Create subscription
    const subscription = this.subscriptionRepo.create({
      url: dto.url,
      events: dto.events,
      secret,
      description: dto.description || null,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      createdBy: userId,
    });

    const saved = await this.subscriptionRepo.save(subscription);
    this.logger.log('Webhook subscription created', { id: saved.id, url: saved.url });

    return saved;
  }

  /**
   * Update an existing webhook subscription
   *
   * @param id - Subscription ID
   * @param dto - Update data
   * @param userId - User performing update
   * @returns Updated subscription
   */
  async updateSubscription(
    id: string,
    dto: UpdateWebhookSubscriptionDto,
    userId: string,
  ): Promise<WebhookSubscription> {
    this.logger.log('Updating webhook subscription', { id, userId });

    const subscription = await this.subscriptionRepo.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException(`Webhook subscription ${id} not found`);
    }

    // Update fields
    if (dto.url !== undefined) {
      if (!dto.url.startsWith('https://')) {
        throw new BadRequestException('Webhook URL must be HTTPS');
      }
      subscription.url = dto.url;
    }

    if (dto.events !== undefined) {
      if (dto.events.length === 0) {
        throw new BadRequestException('At least one event type is required');
      }
      subscription.events = dto.events;
    }

    if (dto.description !== undefined) {
      subscription.description = dto.description;
    }

    if (dto.isActive !== undefined) {
      subscription.isActive = dto.isActive;
    }

    const updated = await this.subscriptionRepo.save(subscription);
    this.logger.log('Webhook subscription updated', { id: updated.id });

    return updated;
  }

  /**
   * Get a webhook subscription by ID
   *
   * @param id - Subscription ID
   * @returns Webhook subscription (without secret)
   */
  async getSubscription(id: string): Promise<WebhookSubscription> {
    const subscription = await this.subscriptionRepo.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException(`Webhook subscription ${id} not found`);
    }
    return subscription;
  }

  /**
   * List all webhook subscriptions for a user
   *
   * @param userId - User ID
   * @returns List of subscriptions (without secrets)
   */
  async listSubscriptions(userId: string): Promise<WebhookSubscription[]> {
    return this.subscriptionRepo.find({
      where: { createdBy: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * List all active webhook subscriptions for a specific event type
   *
   * @param eventType - Event type to filter by
   * @returns List of active subscriptions subscribed to event type
   */
  async listActiveSubscriptionsForEvent(eventType: EventType): Promise<WebhookSubscription[]> {
    // Use query builder for array contains query
    return this.subscriptionRepo
      .createQueryBuilder('subscription')
      .where('subscription.is_active = :isActive', { isActive: true })
      .andWhere(':eventType = ANY(subscription.events)', { eventType })
      .getMany();
  }

  /**
   * Delete a webhook subscription
   *
   * @param id - Subscription ID
   * @param userId - User performing deletion
   */
  async deleteSubscription(id: string, userId: string): Promise<void> {
    this.logger.log('Deleting webhook subscription', { id, userId });

    const subscription = await this.subscriptionRepo.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException(`Webhook subscription ${id} not found`);
    }

    // Check ownership
    if (subscription.createdBy !== userId) {
      throw new BadRequestException('You can only delete your own subscriptions');
    }

    await this.subscriptionRepo.remove(subscription);
    this.logger.log('Webhook subscription deleted', { id });
  }

  /**
   * Send a webhook to a subscription
   *
   * Steps:
   * 1. Create WebhookDelivery record
   * 2. Sign payload with HMAC-SHA256
   * 3. Send HTTP POST to subscription URL
   * 4. Update delivery status based on response
   * 5. Schedule retry if failed
   *
   * @param subscription - Webhook subscription
   * @param eventType - Event type
   * @param payload - Event payload
   * @returns Webhook delivery record
   */
  async sendWebhook(
    subscription: WebhookSubscription,
    eventType: EventType,
    payload: Record<string, any>,
  ): Promise<WebhookDelivery> {
    this.logger.log('Sending webhook', {
      subscriptionId: subscription.id,
      eventType,
      url: subscription.url,
    });

    // Create delivery record
    const delivery = this.deliveryRepo.create({
      subscriptionId: subscription.id,
      eventType,
      payload,
      status: WebhookStatus.PENDING,
      attempts: 0,
    });
    await this.deliveryRepo.save(delivery);

    // Attempt delivery
    await this.attemptDelivery(delivery, subscription);

    return delivery;
  }

  /**
   * Attempt to deliver a webhook
   *
   * @param delivery - Webhook delivery record
   * @param subscription - Webhook subscription (optional, loaded if not provided)
   */
  async attemptDelivery(
    delivery: WebhookDelivery,
    subscription?: WebhookSubscription,
  ): Promise<void> {
    this.logger.log('Attempting webhook delivery', {
      deliveryId: delivery.id,
      attempt: delivery.attempts + 1,
    });

    // Load subscription if not provided
    if (!subscription) {
      const loadedSubscription = await this.subscriptionRepo.findOne({
        where: { id: delivery.subscriptionId },
      });
      if (!loadedSubscription) {
        throw new NotFoundException(`Webhook subscription ${delivery.subscriptionId} not found`);
      }
      subscription = loadedSubscription;
    }

    // Check if subscription is active
    if (!subscription.isActive) {
      this.logger.warn('Webhook subscription is inactive, skipping delivery', {
        subscriptionId: subscription.id,
      });
      return;
    }

    // Mark as processing
    delivery.markAsProcessing();
    await this.deliveryRepo.save(delivery);

    try {
      // Sign payload
      const signature = this.signPayload(delivery.payload, subscription.secret);

      // Send HTTP POST request
      const response = await axios.post(subscription.url, delivery.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': delivery.eventType,
          'X-Webhook-Delivery-Id': delivery.id,
        },
        timeout: 30000, // 30 seconds
        validateStatus: (status) => status >= 200 && status < 300, // Only 2xx is success
      });

      // Success
      delivery.markAsSuccess(response.status, JSON.stringify(response.data));
      await this.deliveryRepo.save(delivery);

      this.logger.log('Webhook delivered successfully', {
        deliveryId: delivery.id,
        statusCode: response.status,
      });
    } catch (error) {
      // Failed - mark for retry or failure
      const axiosError = error as AxiosError;
      const statusCode = axiosError.response?.status || null;
      const errorMessage = axiosError.message;
      const responseBody = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : undefined;

      delivery.markAsFailed(statusCode, errorMessage, responseBody);
      await this.deliveryRepo.save(delivery);

      this.logger.warn('Webhook delivery failed', {
        deliveryId: delivery.id,
        statusCode,
        errorMessage,
        willRetry: delivery.canRetry(),
      });
    }
  }

  /**
   * Process pending webhook retries
   *
   * Queries for deliveries with status RETRYING and nextRetryAt <= now
   * Attempts delivery for each
   *
   * This method should be called by a scheduled job (e.g., every minute)
   */
  async processRetries(): Promise<void> {
    const now = new Date();
    const pendingRetries = await this.deliveryRepo
      .createQueryBuilder('delivery')
      .where('delivery.status = :status', { status: WebhookStatus.RETRYING })
      .andWhere('delivery.next_retry_at <= :now', { now })
      .getMany();

    this.logger.log('Processing webhook retries', { count: pendingRetries.length });

    for (const delivery of pendingRetries) {
      try {
        await this.attemptDelivery(delivery);
      } catch (error) {
        this.logger.error('Failed to process webhook retry', error.stack, {
          deliveryId: delivery.id,
        });
      }
    }
  }

  /**
   * Get webhook delivery history for a subscription
   *
   * @param subscriptionId - Subscription ID
   * @param limit - Max number of deliveries to return
   * @returns List of webhook deliveries
   */
  async getDeliveryHistory(subscriptionId: string, limit = 50): Promise<WebhookDelivery[]> {
    return this.deliveryRepo.find({
      where: { subscriptionId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get a specific webhook delivery
   *
   * @param id - Delivery ID
   * @returns Webhook delivery
   */
  async getDelivery(id: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveryRepo.findOne({ where: { id } });
    if (!delivery) {
      throw new NotFoundException(`Webhook delivery ${id} not found`);
    }
    return delivery;
  }

  /**
   * Regenerate secret for a webhook subscription
   *
   * @param id - Subscription ID
   * @param userId - User performing regeneration
   * @returns Updated subscription with new secret
   */
  async regenerateSecret(id: string, userId: string): Promise<WebhookSubscription> {
    this.logger.log('Regenerating webhook secret', { id, userId });

    const subscription = await this.subscriptionRepo.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException(`Webhook subscription ${id} not found`);
    }

    // Check ownership
    if (subscription.createdBy !== userId) {
      throw new BadRequestException('You can only regenerate secrets for your own subscriptions');
    }

    // Generate new secret
    subscription.secret = this.generateSecret();
    const updated = await this.subscriptionRepo.save(subscription);

    this.logger.log('Webhook secret regenerated', { id });
    return updated;
  }

  /**
   * Generate a secure random secret for webhook signing
   *
   * @returns Hex-encoded secret (32 bytes = 64 hex chars)
   */
  private generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Sign a webhook payload with HMAC-SHA256
   *
   * @param payload - Payload to sign
   * @param secret - Secret key
   * @returns Hex-encoded signature
   */
  private signPayload(payload: Record<string, any>, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hmac = createHmac('sha256', secret);
    hmac.update(payloadString);
    return hmac.digest('hex');
  }

  /**
   * Verify a webhook signature
   *
   * Used for testing or webhook endpoint validation
   *
   * @param payload - Payload that was signed
   * @param signature - Signature to verify (without 'sha256=' prefix)
   * @param secret - Secret key
   * @returns true if signature is valid
   */
  verifySignature(payload: Record<string, any>, signature: string, secret: string): boolean {
    const expectedSignature = this.signPayload(payload, secret);
    return signature === expectedSignature;
  }
}
