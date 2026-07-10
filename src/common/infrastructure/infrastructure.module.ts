import { Module, Global } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { LoggerModule } from './logging/logger.module';
import { MetricsModule } from './metrics/metrics.module';
import { TracingModule } from './tracing/tracing.module';
import { ResiliencyModule } from './resiliency/resiliency.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { SecurityModule } from './security/security.module';
import { ConfigModule } from '../config/config.module';

/**
 * InfrastructureModule
 *
 * Global infrastructure module that aggregates all framework-level services.
 *
 * This module provides cross-cutting infrastructure concerns used by all domain modules:
 * - **Configuration**: Type-safe environment-based configuration
 * - **Database**: PostgreSQL connection with transaction management
 * - **Caching**: Redis-backed caching with decorators
 * - **Logging**: Structured JSON logging with PII redaction
 * - **Metrics**: Prometheus metrics collection
 * - **Tracing**: OpenTelemetry distributed tracing
 * - **Health Checks**: Kubernetes liveness and readiness probes
 * - **Resiliency**: Circuit breakers for external services
 * - **Security**: Rate limiting and abuse prevention
 *
 * Architecture:
 * - All submodules are @Global(), making their exports available to all domain modules
 * - No business logic - only technical infrastructure
 * - Framework-agnostic patterns wrapped in NestJS modules
 *
 * Usage in Application:
 * ```typescript
 * // app.module.ts
 * @Module({
 *   imports: [
 *     InfrastructureModule,  // Import once, available everywhere
 *     UserModule,            // Domain modules can inject infrastructure services
 *     TaskModule,
 *     NotificationModule,
 *   ],
 * })
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     // Apply tracing middleware to all routes
 *     consumer.apply(TracingMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 *
 * Usage in Domain Services:
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(
 *     @InjectRepository(User) private readonly userRepo: Repository<User>,
 *     private readonly cacheService: CacheService,
 *     private readonly logger: LoggerService,
 *     private readonly metricsService: MetricsService,
 *     private readonly txManager: TransactionManager,
 *   ) {
 *     this.logger.setContext('UserService');
 *   }
 *
 *   async createUser(dto: CreateUserDto): Promise<User> {
 *     this.logger.log('Creating user', { email: dto.email });
 *
 *     return await this.txManager.run(async (em) => {
 *       const user = await em.save(User, dto);
 *
 *       this.metricsService.incrementCounter('user_registrations_total', {
 *         method: 'email',
 *         source: 'web'
 *       });
 *
 *       await this.cacheService.del('users:all'); // Invalidate cache
 *
 *       return user;
 *     });
 *   }
 * }
 * ```
 *
 * Environment Configuration:
 * All infrastructure modules support environment-based configuration.
 * See ConfigService for complete list of environment variables.
 *
 * Key Environment Variables:
 * - NODE_ENV: development | staging | production
 * - DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, etc.
 * - REDIS_HOST, REDIS_PORT, etc.
 * - AUTH0_DOMAIN, AUTH0_CLIENT_ID, etc.
 * - LOG_LEVEL, LOG_FILE_PATH, etc.
 * - TRACING_ENABLED, TRACING_SAMPLE_RATE, etc.
 *
 * Complies with:
 * - US-060: Encryption at Rest and in Transit (Database, TLS)
 * - US-062: Health and Readiness Endpoints
 * - SECURITY-03: Application-level logging
 * - SECURITY-11: Rate limiting
 * - RESILIENCY-05: Monitoring and alerting (metrics, tracing)
 * - RESILIENCY-06: Health checks for Kubernetes
 * - RESILIENCY-10: Circuit breakers for external services
 *
 * Exported Services:
 * - CacheService: Redis caching
 * - LoggerService: Structured logging
 * - MetricsService: Prometheus metrics
 * - HealthCheckService: Health checks
 * - TransactionManager: Database transactions
 * - RateLimitGuard: Rate limiting guard
 * - ConfigService: Type-safe configuration
 */
@Global()
@Module({
  imports: [
    ConfigModule,      // Configuration management (must be first)
    DatabaseModule,    // PostgreSQL connection and transaction management
    CacheModule,       // Redis caching
    LoggerModule,      // Structured logging
    MetricsModule,     // Prometheus metrics
    TracingModule,     // OpenTelemetry distributed tracing
    ResiliencyModule,  // Circuit breakers
    HealthModule,      // Health checks
    SecurityModule,    // Rate limiting and security
  ],
  exports: [
    ConfigModule,
    DatabaseModule,
    CacheModule,
    LoggerModule,
    MetricsModule,
    TracingModule,
    ResiliencyModule,
    HealthModule,
    SecurityModule,
  ],
})
export class InfrastructureModule {}
