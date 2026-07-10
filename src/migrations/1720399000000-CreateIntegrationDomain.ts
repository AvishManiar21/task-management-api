import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Integration Domain Migration
 *
 * Creates all tables for the Integration Domain:
 * - webhook_subscriptions (webhook configurations)
 * - webhook_deliveries (delivery attempts and status)
 * - api_keys (API key authentication)
 * - integration_events (event audit log)
 *
 * Features:
 * - UUID primary keys
 * - Timestamptz for all timestamps
 * - JSONB for flexible payload data
 * - Indexes for performance (status, event types, etc.)
 * - Foreign key constraints with cascades
 * - Enum types for status and event types
 *
 * Security:
 * - API keys stored as hashed values (bcrypt)
 * - Webhook secrets for HMAC-SHA256 signing
 * - Permission-based access control
 */
export class CreateIntegrationDomain1720399000000 implements MigrationInterface {
  name = 'CreateIntegrationDomain1720399000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ===========================
    // Enum Types
    // ===========================

    // Webhook Status Enum
    await queryRunner.query(`
      CREATE TYPE "webhook_status_enum" AS ENUM (
        'PENDING',
        'PROCESSING',
        'SUCCESS',
        'RETRYING',
        'FAILED'
      )
    `);

    // Event Type Enum
    await queryRunner.query(`
      CREATE TYPE "event_type_enum" AS ENUM (
        'task.created',
        'task.updated',
        'task.deleted',
        'task.assigned',
        'task.completed',
        'task.state_changed',
        'comment.created',
        'comment.updated',
        'comment.deleted',
        'user.created',
        'user.updated',
        'user.deleted',
        'team.created',
        'team.updated',
        'workflow.created',
        'workflow.updated'
      )
    `);

    // ===========================
    // Webhook Subscriptions Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "webhook_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "url" varchar(500) NOT NULL,
        "events" text NOT NULL,
        "secret" varchar(255) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "description" varchar(500),
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_webhook_subscriptions_created_by" ON "webhook_subscriptions" ("created_by")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_webhook_subscriptions_is_active" ON "webhook_subscriptions" ("is_active")
    `);

    // ===========================
    // Webhook Deliveries Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "webhook_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "subscription_id" uuid NOT NULL,
        "event_type" event_type_enum NOT NULL,
        "payload" jsonb NOT NULL,
        "status" webhook_status_enum NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "http_status_code" integer,
        "response_body" text,
        "error_message" text,
        "next_retry_at" timestamptz,
        "last_attempted_at" timestamptz,
        "delivered_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_webhook_delivery_subscription" FOREIGN KEY ("subscription_id")
          REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_webhook_deliveries_subscription_id" ON "webhook_deliveries" ("subscription_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_webhook_deliveries_status" ON "webhook_deliveries" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_webhook_deliveries_event_type" ON "webhook_deliveries" ("event_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_webhook_deliveries_next_retry_at" ON "webhook_deliveries" ("next_retry_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_webhook_deliveries_created_at" ON "webhook_deliveries" ("created_at")
    `);

    // ===========================
    // API Keys Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "key_hash" varchar(255) NOT NULL UNIQUE,
        "prefix" varchar(20) NOT NULL,
        "permissions" text NOT NULL,
        "description" text,
        "expires_at" timestamptz,
        "last_used_at" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_api_keys_key_hash" ON "api_keys" ("key_hash")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_api_keys_created_by" ON "api_keys" ("created_by")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_api_keys_is_active" ON "api_keys" ("is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_api_keys_expires_at" ON "api_keys" ("expires_at")
    `);

    // ===========================
    // Integration Events Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "integration_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_type" event_type_enum NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "entity_id" uuid NOT NULL,
        "payload" jsonb NOT NULL,
        "triggered_by" uuid,
        "published_at" timestamptz NOT NULL DEFAULT now(),
        "correlation_id" uuid,
        "metadata" jsonb
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_integration_events_event_type" ON "integration_events" ("event_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_integration_events_entity_id" ON "integration_events" ("entity_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_integration_events_entity_type" ON "integration_events" ("entity_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_integration_events_published_at" ON "integration_events" ("published_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_integration_events_triggered_by" ON "integration_events" ("triggered_by")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_integration_events_correlation_id" ON "integration_events" ("correlation_id")
    `);

    // ===========================
    // Comments
    // ===========================
    await queryRunner.query(`
      COMMENT ON TABLE "webhook_subscriptions" IS 'Webhook subscriptions for external integrations'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "webhook_deliveries" IS 'Webhook delivery attempts with retry tracking'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "api_keys" IS 'API keys for external system authentication'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "integration_events" IS 'Integration event audit log for debugging and replay'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respect foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "integration_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_deliveries" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_subscriptions" CASCADE`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "event_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "webhook_status_enum"`);
  }
}
