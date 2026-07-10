-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create teams table
CREATE TABLE IF NOT EXISTS "teams" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMP NULL,
  CONSTRAINT "UQ_teams_name" UNIQUE ("name")
);

CREATE INDEX IF NOT EXISTS "IDX_teams_deleted_at" ON "teams" ("deleted_at");

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_auth0_id" ON "users" ("auth0_id") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email" ON "users" ("email") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_users_team_id" ON "users" ("team_id");
CREATE INDEX IF NOT EXISTS "IDX_users_is_active_deleted_at" ON "users" ("is_active", "deleted_at");
CREATE INDEX IF NOT EXISTS "IDX_users_email_verified" ON "users" ("email_verified");

-- Create roles table
CREATE TABLE IF NOT EXISTS "roles" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMP NULL,
  CONSTRAINT "UQ_roles_name" UNIQUE ("name")
);

CREATE INDEX IF NOT EXISTS "IDX_roles_is_system" ON "roles" ("is_system");
CREATE INDEX IF NOT EXISTS "IDX_roles_deleted_at" ON "roles" ("deleted_at");

-- Create permissions table
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "resource" VARCHAR(50) NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_permissions_resource_action" UNIQUE ("resource", "action")
);

CREATE INDEX IF NOT EXISTS "IDX_permissions_resource" ON "permissions" ("resource");

-- Create user_roles table
CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "assigned_by" UUID NOT NULL,
  "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_user_roles_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_user_roles_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_user_roles_assigned_by" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE NO ACTION,
  CONSTRAINT "UQ_user_roles_user_role" UNIQUE ("user_id", "role_id")
);

CREATE INDEX IF NOT EXISTS "IDX_user_roles_user_id" ON "user_roles" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_user_roles_role_id" ON "user_roles" ("role_id");

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_role_permissions_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_role_permissions_permission_id" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE,
  CONSTRAINT "UQ_role_permissions_role_permission" UNIQUE ("role_id", "permission_id")
);

CREATE INDEX IF NOT EXISTS "IDX_role_permissions_role_id" ON "role_permissions" ("role_id");
CREATE INDEX IF NOT EXISTS "IDX_role_permissions_permission_id" ON "role_permissions" ("permission_id");

-- Create migrations table
CREATE TABLE IF NOT EXISTS "migrations" (
  "id" SERIAL PRIMARY KEY,
  "timestamp" BIGINT NOT NULL,
  "name" VARCHAR(255) NOT NULL
);
