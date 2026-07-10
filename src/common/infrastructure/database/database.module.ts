import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TransactionManager } from './transaction-manager.service';
import { LoggerModule } from '../logging/logger.module';

/**
 * DatabaseModule
 *
 * Global module providing database connectivity and transaction management.
 *
 * Features:
 * - TypeORM PostgreSQL connection
 * - Connection pooling
 * - Transaction manager service
 * - Automatic entity discovery
 * - Environment-based configuration
 * - Connection retry on failure
 *
 * Environment Configuration:
 * - DATABASE_HOST - PostgreSQL host (default: 'localhost')
 * - DATABASE_PORT - PostgreSQL port (default: 5432)
 * - DATABASE_USERNAME - Database user
 * - DATABASE_PASSWORD - Database password
 * - DATABASE_NAME - Database name
 * - DATABASE_SCHEMA - Schema name (default: 'public')
 * - DATABASE_SSL - Enable SSL (default: 'false')
 * - DATABASE_POOL_MIN - Minimum pool connections (default: 2)
 * - DATABASE_POOL_MAX - Maximum pool connections (default: 10)
 * - DATABASE_LOGGING - Enable SQL logging (default: 'false')
 *
 * Connection Pooling:
 * - Minimum: 2 connections
 * - Maximum: 10 connections
 * - Idle timeout: 30 seconds
 * - Connection timeout: 5 seconds
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(
 *     @InjectRepository(User) private readonly userRepo: Repository<User>,
 *     private readonly txManager: TransactionManager,
 *   ) {}
 *
 *   async createUserWithProfile(dto: CreateUserDto) {
 *     return await this.txManager.run(async (em) => {
 *       const user = await em.save(User, dto);
 *       const profile = await em.save(UserProfile, { userId: user.id });
 *       return { user, profile };
 *     });
 *   }
 * }
 * ```
 *
 * Complies with:
 * - US-060: Encryption at Rest (PostgreSQL encryption)
 * - Technical requirement: ACID transaction support
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, LoggerModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('DATABASE_HOST', 'localhost');
        const port = configService.get<number>('DATABASE_PORT', 5432);
        const username = configService.get<string>('DATABASE_USERNAME', 'postgres');
        const password = configService.get<string>('DATABASE_PASSWORD', 'postgres');
        const database = configService.get<string>('DATABASE_NAME', 'task_management');
        const schema = configService.get<string>('DATABASE_SCHEMA', 'public');
        const ssl = configService.get<string>('DATABASE_SSL', 'false') === 'true';
        const poolMin = configService.get<number>('DATABASE_POOL_MIN', 2);
        const poolMax = configService.get<number>('DATABASE_POOL_MAX', 10);
        const logging = configService.get<string>('DATABASE_LOGGING', 'false') === 'true';

        return {
          type: 'postgres',
          host,
          port,
          username,
          password,
          database,
          schema,
          // SSL configuration
          ssl: ssl
            ? {
                rejectUnauthorized: false, // For self-signed certificates in development
              }
            : false,
          // Entity discovery
          entities: [__dirname + '/../../../**/*.entity{.ts,.js}'],
          // Auto-run migrations on startup (disable in production)
          synchronize: false, // Use migrations instead
          // Logging
          logging: logging ? ['query', 'error', 'schema'] : ['error'],
          // Connection pool
          extra: {
            min: poolMin,
            max: poolMax,
            idleTimeoutMillis: 30000, // 30 seconds
            connectionTimeoutMillis: 5000, // 5 seconds
          },
          // Retry connection on failure
          retryAttempts: 3,
          retryDelay: 3000, // 3 seconds between retries
        };
      },
    }),
  ],
  providers: [TransactionManager],
  exports: [TransactionManager, TypeOrmModule],
})
export class DatabaseModule {}
