import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Notification Domain
 *
 * Creates all tables and indexes for the Notification Domain:
 * - notification: Core notification records
 * - notification_preference: User notification preferences
 * - notification_template: Reusable notification templates
 * - notification_log: Delivery tracking and logs
 *
 * Features:
 * - Multi-channel notifications (EMAIL, IN_APP)
 * - Status tracking (PENDING → SENT → DELIVERED/FAILED → READ)
 * - User preferences per channel and event type
 * - Template support with variable substitution
 * - Delivery logging and error tracking
 */
export class CreateNotificationDomain1720398000000 implements MigrationInterface {
  name = 'CreateNotificationDomain1720398000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create notification_status enum
    await queryRunner.query(`
      CREATE TYPE "notification_status_enum" AS ENUM (
        'PENDING',
        'SENT',
        'DELIVERED',
        'FAILED',
        'READ'
      );
    `);

    // Create notification_type enum
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM (
        'TASK_ASSIGNED',
        'TASK_DUE_SOON',
        'TASK_OVERDUE',
        'TASK_COMPLETED',
        'TASK_STATE_CHANGED',
        'COMMENT_ADDED',
        'MENTION_IN_COMMENT'
      );
    `);

    // Create notification_channel enum
    await queryRunner.query(`
      CREATE TYPE "notification_channel_enum" AS ENUM (
        'EMAIL',
        'IN_APP'
      );
    `);

    // Create notification table
    await queryRunner.query(`
      CREATE TABLE "notification" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" notification_type_enum NOT NULL,
        "title" varchar(255) NOT NULL,
        "message" text NOT NULL,
        "channel" notification_channel_enum NOT NULL,
        "status" notification_status_enum NOT NULL DEFAULT 'PENDING',
        "metadata" jsonb,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Create indexes for notification table
    await queryRunner.query(`
      CREATE INDEX "idx_notification_user_id" ON "notification" ("user_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notification_status" ON "notification" ("status");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notification_created_at" ON "notification" ("created_at");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notification_user_status" ON "notification" ("user_id", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notification_user_created" ON "notification" ("user_id", "created_at");
    `);

    // Create notification_preference table
    await queryRunner.query(`
      CREATE TABLE "notification_preference" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL UNIQUE,
        "email_enabled" boolean NOT NULL DEFAULT true,
        "in_app_enabled" boolean NOT NULL DEFAULT true,
        "enabled_event_types" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Create unique index for notification_preference
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_notification_preference_user_id" ON "notification_preference" ("user_id");
    `);

    // Create notification_template table
    await queryRunner.query(`
      CREATE TABLE "notification_template" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL UNIQUE,
        "event_type" varchar(100) NOT NULL,
        "channel" notification_channel_enum NOT NULL,
        "subject" varchar(255) NOT NULL,
        "body" text NOT NULL,
        "variables" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Create unique index for notification_template
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_notification_template_name" ON "notification_template" ("name");
    `);

    // Create notification_log table
    await queryRunner.query(`
      CREATE TABLE "notification_log" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "notification_id" uuid NOT NULL,
        "status" notification_status_enum NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_attempt_at" timestamptz,
        "error_message" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_notification_log_notification" FOREIGN KEY ("notification_id")
          REFERENCES "notification" ("id") ON DELETE CASCADE
      );
    `);

    // Create indexes for notification_log table
    await queryRunner.query(`
      CREATE INDEX "idx_notification_log_notification_id" ON "notification_log" ("notification_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notification_log_status" ON "notification_log" ("status");
    `);

    // Insert default preferences for existing users
    await queryRunner.query(`
      INSERT INTO "notification_preference" ("user_id", "email_enabled", "in_app_enabled", "enabled_event_types")
      SELECT
        id,
        true,
        true,
        'TASK_ASSIGNED,TASK_DUE_SOON,TASK_OVERDUE,TASK_COMPLETED,TASK_STATE_CHANGED,COMMENT_ADDED,MENTION_IN_COMMENT'
      FROM "users"
      WHERE NOT EXISTS (
        SELECT 1 FROM "notification_preference" WHERE "notification_preference"."user_id" = "users"."id"
      );
    `);

    // Insert default notification templates
    await queryRunner.query(`
      INSERT INTO "notification_template" ("name", "event_type", "channel", "subject", "body", "variables")
      VALUES
        (
          'task-assigned-email',
          'TASK_ASSIGNED',
          'EMAIL',
          'You have been assigned to a task',
          'Hello {{userName}}, you have been assigned to the task "{{taskTitle}}" by {{assignerName}}. Due date: {{dueDate}}',
          '{"userName": "string", "taskTitle": "string", "assignerName": "string", "dueDate": "date"}'::jsonb
        ),
        (
          'task-assigned-in-app',
          'TASK_ASSIGNED',
          'IN_APP',
          'New Task Assignment',
          '{{assignerName}} assigned you to "{{taskTitle}}"',
          '{"assignerName": "string", "taskTitle": "string"}'::jsonb
        ),
        (
          'task-due-soon-in-app',
          'TASK_DUE_SOON',
          'IN_APP',
          'Task Due Soon',
          'Task "{{taskTitle}}" is due in {{hoursRemaining}} hours',
          '{"taskTitle": "string", "hoursRemaining": "number"}'::jsonb
        ),
        (
          'task-overdue-in-app',
          'TASK_OVERDUE',
          'IN_APP',
          'Task Overdue',
          'Task "{{taskTitle}}" is now overdue',
          '{"taskTitle": "string"}'::jsonb
        ),
        (
          'comment-added-in-app',
          'COMMENT_ADDED',
          'IN_APP',
          'New Comment',
          '{{commenterName}} commented on "{{taskTitle}}": {{commentText}}',
          '{"commenterName": "string", "taskTitle": "string", "commentText": "string"}'::jsonb
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_log" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_template" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preference" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification" CASCADE;`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_channel_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_status_enum";`);
  }
}
