import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

// Entities
import { WebhookSubscription } from './webhook/webhook-subscription.entity';
import { WebhookDelivery } from './webhook/webhook-delivery.entity';
import { ApiKey } from './api-key/api-key.entity';
import { IntegrationEvent } from './event/integration-event.entity';

// Services
import { WebhookService } from './webhook/services/webhook.service';
import { ApiKeyService } from './api-key/services/api-key.service';
import { EventPublisherService } from './event/services/event-publisher.service';

// Controllers
import { WebhookController } from './webhook/controllers/webhook.controller';
import { ApiKeyController } from './api-key/controllers/api-key.controller';

/**
 * Integration Domain Module
 *
 * Encapsulates all external integration functionality including:
 * - Webhook subscriptions and delivery
 * - API key management
 * - Event publishing
 * - Integration audit trail
 *
 * Features:
 * - Webhook Management: Subscribe to domain events, HMAC-SHA256 signing, retry logic
 * - API Keys: Secure key generation, bcrypt hashing, permission-based access
 * - Event Publishing: Domain event logging, webhook triggering, event replay
 *
 * Entities: 4 total
 * - WebhookSubscription (webhook configurations)
 * - WebhookDelivery (delivery attempts and status)
 * - ApiKey (API key authentication)
 * - IntegrationEvent (event audit log)
 *
 * Services:
 * - WebhookService: Webhook CRUD and delivery logic
 * - ApiKeyService: API key generation and validation
 * - EventPublisherService: Event publishing and webhook triggering
 *
 * Security:
 * - Webhooks signed with HMAC-SHA256
 * - API keys hashed with bcrypt
 * - Secrets never exposed in responses
 * - Permission-based access control
 *
 * External Dependencies:
 * - @nestjs/axios: HTTP client for webhook delivery
 * - bcrypt: Key hashing
 * - crypto: Secret generation and HMAC signing
 */
@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      WebhookSubscription,
      WebhookDelivery,
      ApiKey,
      IntegrationEvent,
    ]),
    // HTTP module for webhook delivery
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
    }),
  ],
  controllers: [
    WebhookController,
    ApiKeyController,
  ],
  providers: [
    WebhookService,
    ApiKeyService,
    EventPublisherService,
  ],
  exports: [
    WebhookService,
    ApiKeyService,
    EventPublisherService,
  ],
})
export class IntegrationDomainModule {}
