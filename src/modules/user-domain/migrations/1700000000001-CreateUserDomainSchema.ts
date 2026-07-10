import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateUserDomainSchema Migration
 *
 * Creates the complete User Domain database schema including:
 * - users table (core user entity)
 * - teams table (team management)
 * - roles table (RBAC roles)
 * - permissions table (RBAC permissions)
 * - user_roles table (many-to-many user-role assignments)
 * - role_permissions table (many-to-many role-permission assignments)
 *
 * Indexes:
 * - Unique indexes on auth0Id and email (with partial index for soft delete)
 * - Foreign key indexes for performance
 * - Composite indexes for common query patterns
 *
 * Business Rules Enforced:
 * - BR-AUTH-001: Email uniqueness (partial unique index)
 * - BR-AUTH-002: Auth0 ID uniqueness (partial unique index)
 * - BR-TEAM-001: User can belong to at most one team (nullable teamId FK)
 * - BR-ROLE-001: Role names are unique
 * - BR-PERM-001: Permission (resource, action) pair is unique
 *
 * @see US-041, US-042, US-043, US-044, US-045, US-046, US-047, US-048
 */
export class CreateUserDomainSchema1700000000001 implements MigrationInterface {
  name = 'CreateUserDomainSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create teams table
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMP NULL,
        CONSTRAINT "UQ_teams_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_teams_deleted_at" ON "teams" ("deleted_at")
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "teams" IS 'Teams for organizing users'
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "auth0_id" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
        "name" VARCHAR(255) NOT NULL,
        "picture" VARCHAR(500),
        "display_name" VARCHAR(255),
        "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
        "language" VARCHAR(10) NOT NULL DEFAULT 'en',
        "notification_preferences" JSONB NOT NULL DEFAULT '{"email": true, "inApp": true, "taskAssigned": true, "taskUpdated": true, "taskCompleted": true, "mentions": true}',
        "team_id" UUID NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "last_login_at" TIMESTAMP NULL,
        "deleted_at" TIMESTAMP NULL,
        CONSTRAINT "FK_users_team_id" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL
      )
    `);

    // Unique indexes with partial index for soft delete
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_auth0_id" ON "users" ("auth0_id") WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email") WHERE "deleted_at" IS NULL
    `);

    // Performance indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_users_team_id" ON "users" ("team_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_is_active_deleted_at" ON "users" ("is_active", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_email_verified" ON "users" ("email_verified")
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "users" IS 'Core user entity with Auth0 integration'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."auth0_id" IS 'Auth0 user ID (e.g., auth0|123456)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."notification_preferences" IS 'User notification preferences (JSONB)'
    `);

    // Create roles table
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" VARCHAR(50) NOT NULL,
        "description" TEXT,
        "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMP NULL,
        CONSTRAINT "UQ_roles_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_roles_is_system" ON "roles" ("is_system")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_roles_deleted_at" ON "roles" ("deleted_at")
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "roles" IS 'RBAC roles'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "roles"."is_system" IS 'System roles cannot be deleted (ADMIN, TEAM_LEAD, MEMBER, OBSERVER)'
    `);

    // Create permissions table
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "resource" VARCHAR(50) NOT NULL,
        "action" VARCHAR(50) NOT NULL,
        "description" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_permissions_resource_action" UNIQUE ("resource", "action")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_permissions_resource" ON "permissions" ("resource")
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "permissions" IS 'RBAC permissions (resource:action format)'
    `);

    // Create user_roles table (many-to-many with audit trail)
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" UUID NOT NULL,
        "role_id" UUID NOT NULL,
        "assigned_by" UUID NOT NULL,
        "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_user_roles_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_assigned_by" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE NO ACTION,
        CONSTRAINT "UQ_user_roles_user_role" UNIQUE ("user_id", "role_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_roles_user_id" ON "user_roles" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_roles_role_id" ON "user_roles" ("role_id")
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "user_roles" IS 'User-role assignments with audit trail'
    `);

    // Create role_permissions table (many-to-many)
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "role_id" UUID NOT NULL,
        "permission_id" UUID NOT NULL,
        "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_role_permissions_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permissions_permission_id" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_role_permissions_role_permission" UNIQUE ("role_id", "permission_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_role_permissions_role_id" ON "role_permissions" ("role_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_role_permissions_permission_id" ON "role_permissions" ("permission_id")
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "role_permissions" IS 'Role-permission assignments'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order (dependencies first)
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams" CASCADE`);
  }
}
