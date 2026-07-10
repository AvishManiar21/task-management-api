import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task Domain Migration
 *
 * Creates all tables for the Task Domain:
 * - workflow (configurable workflows)
 * - workflow_state (states within workflows)
 * - workflow_transition (allowed state transitions)
 * - task_template (reusable task templates)
 * - task (core task entity)
 * - task_dependency (task blocking relationships)
 * - comment (task comments with threading)
 * - attachment (file attachment metadata)
 * - task_history (audit trail)
 *
 * Features:
 * - UUID primary keys
 * - Timestamptz for all timestamps
 * - Soft deletes (deletedAt)
 * - Optimistic locking (version)
 * - JSONB for flexible data
 * - Full-text search indexes
 * - Foreign key constraints with cascades
 */
export class CreateTaskDomain1720397108000 implements MigrationInterface {
  name = 'CreateTaskDomain1720397108000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ===========================
    // Workflow Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "workflow" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL UNIQUE,
        "description" text,
        "is_default" boolean NOT NULL DEFAULT false,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_workflow_default" ON "workflow" ("is_default") WHERE "is_default" = true
    `);

    // ===========================
    // Workflow State Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "workflow_state" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workflow_id" uuid NOT NULL,
        "name" varchar(50) NOT NULL,
        "description" text,
        "color" varchar(7),
        "order" integer NOT NULL,
        "is_initial" boolean NOT NULL DEFAULT false,
        "is_terminal" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_workflow_state_workflow" FOREIGN KEY ("workflow_id") REFERENCES "workflow"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_workflow_state_name" UNIQUE ("workflow_id", "name"),
        CONSTRAINT "uq_workflow_state_order" UNIQUE ("workflow_id", "order")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_workflow_state_workflow" ON "workflow_state" ("workflow_id")
    `);

    // ===========================
    // Workflow Transition Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "workflow_transition" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workflow_id" uuid NOT NULL,
        "from_state_id" uuid NOT NULL,
        "to_state_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "required_permissions" text,
        "requires_comment" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_workflow_transition_workflow" FOREIGN KEY ("workflow_id") REFERENCES "workflow"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_workflow_transition_from_state" FOREIGN KEY ("from_state_id") REFERENCES "workflow_state"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_workflow_transition_to_state" FOREIGN KEY ("to_state_id") REFERENCES "workflow_state"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_workflow_transition" UNIQUE ("workflow_id", "from_state_id", "to_state_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_workflow_transition_from_state" ON "workflow_transition" ("from_state_id")
    `);

    // ===========================
    // Task Template Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "task_template" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL UNIQUE,
        "description" text,
        "title_template" varchar(255) NOT NULL,
        "description_template" text,
        "default_priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
        "default_tags" text,
        "default_workflow_id" uuid NOT NULL,
        "estimated_hours" decimal(10,2),
        "variables" jsonb NOT NULL,
        "custom_fields_template" jsonb,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_task_template_workflow" FOREIGN KEY ("default_workflow_id") REFERENCES "workflow"("id")
      )
    `);

    // ===========================
    // Task Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "task" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(255) NOT NULL,
        "description" text,
        "workflow_id" uuid NOT NULL,
        "current_state_id" uuid NOT NULL,
        "priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
        "assignee_id" uuid,
        "creator_id" uuid NOT NULL,
        "due_date" timestamptz,
        "tags" text,
        "custom_fields" jsonb,
        "parent_task_id" uuid,
        "template_id" uuid,
        "is_recurring" boolean NOT NULL DEFAULT false,
        "recurrence_pattern" jsonb,
        "recurrence_source_id" uuid,
        "estimated_hours" decimal(10,2),
        "actual_hours" decimal(10,2),
        "completed_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        "created_by" uuid NOT NULL,
        "updated_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "fk_task_workflow" FOREIGN KEY ("workflow_id") REFERENCES "workflow"("id"),
        CONSTRAINT "fk_task_current_state" FOREIGN KEY ("current_state_id") REFERENCES "workflow_state"("id"),
        CONSTRAINT "fk_task_parent" FOREIGN KEY ("parent_task_id") REFERENCES "task"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_template" FOREIGN KEY ("template_id") REFERENCES "task_template"("id"),
        CONSTRAINT "fk_task_recurrence_source" FOREIGN KEY ("recurrence_source_id") REFERENCES "task"("id")
      )
    `);

    // Task indexes
    await queryRunner.query(`
      CREATE INDEX "idx_task_assignee" ON "task" ("assignee_id") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_creator" ON "task" ("creator_id") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_workflow" ON "task" ("workflow_id", "current_state_id") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_due_date" ON "task" ("due_date") WHERE "deleted_at" IS NULL AND "completed_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_parent" ON "task" ("parent_task_id") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_priority" ON "task" ("priority") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_completed_at" ON "task" ("completed_at") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_created_at" ON "task" ("created_at") WHERE "deleted_at" IS NULL
    `);

    // Full-text search index
    await queryRunner.query(`
      CREATE INDEX "idx_task_search" ON "task"
      USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')))
      WHERE "deleted_at" IS NULL
    `);

    // ===========================
    // Task Dependency Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "task_dependency" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "depends_on_task_id" uuid NOT NULL,
        "dependency_type" varchar(20) NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_task_dependency_task" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_dependency_depends_on" FOREIGN KEY ("depends_on_task_id") REFERENCES "task"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_task_dependency" UNIQUE ("task_id", "depends_on_task_id"),
        CONSTRAINT "chk_task_dependency_no_self" CHECK ("task_id" <> "depends_on_task_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_task_dependency_task" ON "task_dependency" ("task_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_dependency_depends_on" ON "task_dependency" ("depends_on_task_id")
    `);

    // ===========================
    // Comment Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "comment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "content" text NOT NULL,
        "parent_comment_id" uuid,
        "mentions" text,
        "depth" integer NOT NULL DEFAULT 0,
        "edited_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "fk_comment_task" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_comment_parent" FOREIGN KEY ("parent_comment_id") REFERENCES "comment"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_comment_depth" CHECK ("depth" >= 0 AND "depth" <= 10),
        CONSTRAINT "chk_comment_content_length" CHECK (length("content") <= 10000)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_comment_task" ON "comment" ("task_id") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_comment_parent" ON "comment" ("parent_comment_id") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_comment_user" ON "comment" ("user_id") WHERE "deleted_at" IS NULL
    `);

    // ===========================
    // Attachment Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "attachment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "file_name" varchar(255) NOT NULL,
        "file_size" bigint NOT NULL,
        "mime_type" varchar(100) NOT NULL,
        "storage_key" varchar(500) NOT NULL UNIQUE,
        "storage_url" varchar(1000) NOT NULL,
        "checksum" varchar(64) NOT NULL,
        "virus_scan_status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "virus_scan_details" jsonb,
        "uploaded_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "marked_for_deletion_at" timestamptz,
        CONSTRAINT "fk_attachment_task" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_attachment_file_size" CHECK ("file_size" > 0 AND "file_size" <= 26214400)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_attachment_task" ON "attachment" ("task_id") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_attachment_cleanup" ON "attachment" ("marked_for_deletion_at")
      WHERE "marked_for_deletion_at" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_attachment_virus_scan" ON "attachment" ("virus_scan_status")
      WHERE "virus_scan_status" = 'PENDING'
    `);

    // ===========================
    // Task History Table
    // ===========================
    await queryRunner.query(`
      CREATE TABLE "task_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "change_type" varchar(20) NOT NULL,
        "field_name" varchar(100),
        "old_value" jsonb,
        "new_value" jsonb,
        "changed_by" uuid NOT NULL,
        "changed_at" timestamptz NOT NULL DEFAULT now(),
        "metadata" jsonb,
        CONSTRAINT "fk_task_history_task" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_task_history_task_date" ON "task_history" ("task_id", "changed_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_history_user_date" ON "task_history" ("changed_by", "changed_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_history_field" ON "task_history" ("field_name") WHERE "field_name" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_task_history_change_type" ON "task_history" ("change_type")
    `);

    // ===========================
    // Insert Default Workflow
    // ===========================
    await queryRunner.query(`
      INSERT INTO "workflow" ("id", "name", "description", "is_default", "is_system", "created_by")
      VALUES (
        gen_random_uuid(),
        'Standard',
        'Default workflow for task management',
        true,
        true,
        '00000000-0000-0000-0000-000000000000'
      )
    `);

    // Get the default workflow ID
    const workflowResult = await queryRunner.query(`
      SELECT id FROM "workflow" WHERE "name" = 'Standard'
    `);
    const workflowId = workflowResult[0].id;

    // Insert default workflow states
    await queryRunner.query(`
      INSERT INTO "workflow_state" ("workflow_id", "name", "description", "color", "order", "is_initial", "is_terminal")
      VALUES
        ('${workflowId}', 'TODO', 'Initial state for new tasks', '#94A3B8', 1, true, false),
        ('${workflowId}', 'IN_PROGRESS', 'Task is being worked on', '#3B82F6', 2, false, false),
        ('${workflowId}', 'IN_REVIEW', 'Task is under review', '#F59E0B', 3, false, false),
        ('${workflowId}', 'DONE', 'Task is completed', '#10B981', 4, false, true),
        ('${workflowId}', 'CANCELLED', 'Task was cancelled', '#EF4444', 5, false, true)
    `);

    // Get state IDs for transitions
    const statesResult = await queryRunner.query(`
      SELECT id, name FROM "workflow_state" WHERE "workflow_id" = '${workflowId}'
    `);

    const stateMap = statesResult.reduce((acc: any, state: any) => {
      acc[state.name] = state.id;
      return acc;
    }, {});

    // Insert default workflow transitions
    await queryRunner.query(`
      INSERT INTO "workflow_transition" ("workflow_id", "from_state_id", "to_state_id", "name", "requires_comment")
      VALUES
        ('${workflowId}', '${stateMap['TODO']}', '${stateMap['IN_PROGRESS']}', 'Start Work', false),
        ('${workflowId}', '${stateMap['IN_PROGRESS']}', '${stateMap['IN_REVIEW']}', 'Submit for Review', false),
        ('${workflowId}', '${stateMap['IN_REVIEW']}', '${stateMap['DONE']}', 'Approve', false),
        ('${workflowId}', '${stateMap['IN_REVIEW']}', '${stateMap['IN_PROGRESS']}', 'Request Changes', true),
        ('${workflowId}', '${stateMap['TODO']}', '${stateMap['CANCELLED']}', 'Cancel', true),
        ('${workflowId}', '${stateMap['IN_PROGRESS']}', '${stateMap['CANCELLED']}', 'Cancel', true),
        ('${workflowId}', '${stateMap['IN_REVIEW']}', '${stateMap['CANCELLED']}', 'Cancel', true),
        ('${workflowId}', '${stateMap['DONE']}', '${stateMap['TODO']}', 'Reopen', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "task_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attachment" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "comment" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_dependency" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_template" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_transition" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_state" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow" CASCADE`);
  }
}
