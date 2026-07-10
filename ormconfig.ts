import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config();

/**
 * TypeORM Configuration for Migrations
 *
 * This configuration is used by TypeORM CLI for running migrations.
 *
 * Usage:
 * - Generate migration: npm run migration:generate -- -n MigrationName
 * - Run migrations: npm run migration:run
 * - Revert migration: npm run migration:revert
 *
 * Environment Variables Required:
 * - DATABASE_HOST: PostgreSQL host (default: localhost)
 * - DATABASE_PORT: PostgreSQL port (default: 5432)
 * - DATABASE_USERNAME: Database username
 * - DATABASE_PASSWORD: Database password
 * - DATABASE_NAME: Database name
 * - DATABASE_SSL: Enable SSL connection (default: false)
 *
 * Migration Files Location: src/modules/user-domain/migrations/*.ts
 * Entity Files Location: src/modules/**\/*.entity.ts
 *
 * @see docs/infrastructure-guide.md for database migration guide
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'task_management',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,

  // Entity discovery
  entities: [join(__dirname, 'src', '**', '*.entity{.ts,.js}')],

  // Migration files
  migrations: [
    join(__dirname, 'src', 'modules', '**', 'migrations', '*{.ts,.js}'),
    join(__dirname, 'src', 'migrations', '*{.ts,.js}'),
  ],

  // Migration table name
  migrationsTableName: 'migrations',

  // Logging
  logging: process.env.DB_LOGGING === 'true',

  // Enable synchronize ONLY in development (NEVER in production)
  synchronize: false,
});
