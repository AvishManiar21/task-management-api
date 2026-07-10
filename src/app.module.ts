import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';

// Infrastructure modules
import { ConfigModule } from '@common/config/config.module';
import { ConfigService } from '@common/config/config.service';
import { InfrastructureModule } from '@common/infrastructure/infrastructure.module';
import { DatabaseModule } from '@common/infrastructure/database/database.module';
import { CacheModule } from '@common/infrastructure/cache/cache.module';
import { LoggerModule } from '@common/infrastructure/logging/logger.module';
import { MetricsModule } from '@common/infrastructure/metrics/metrics.module';
import { TracingModule } from '@common/infrastructure/tracing/tracing.module';
import { HealthModule } from '@common/infrastructure/health/health.module';
import { SecurityModule } from '@common/infrastructure/security/security.module';

// Domain modules
import { UserDomainModule } from '@modules/user-domain/user-domain.module';
import { TaskDomainModule } from '@modules/task-domain/task-domain.module';
import { NotificationDomainModule } from '@modules/notification-domain/notification-domain.module';
import { IntegrationDomainModule } from '@modules/integration-domain/integration-domain.module';

/**
 * AppModule
 *
 * Root application module that wires together all infrastructure and domain modules.
 *
 * Module Organization:
 * 1. **Global Infrastructure**: Configuration, logging, caching, metrics, tracing
 * 2. **Database**: PostgreSQL connection with TypeORM
 * 3. **Security**: Rate limiting, authentication guards
 * 4. **Health & Monitoring**: Health checks, Prometheus metrics
 * 5. **Domain Modules**: User Domain, Task Domain (TODO)
 *
 * Architecture Patterns:
 * - Modular Monolith: Single deployment with clear module boundaries
 * - Domain-Driven Design: User Domain and Task Domain as bounded contexts
 * - Vertical Slice: Each domain owns its data, business logic, and API layer
 *
 * Infrastructure Services:
 * - Config: Environment-based configuration (dev, staging, prod)
 * - Cache: Redis with graceful degradation to in-memory
 * - Logger: Structured JSON logging with PII redaction
 * - Metrics: Prometheus metrics collection
 * - Tracing: OpenTelemetry distributed tracing (10% sampling)
 * - Health: Kubernetes liveness/readiness probes
 *
 * Security:
 * - Rate limiting: 100 requests per minute per IP
 * - JWT authentication: Local verification with JWKS caching
 * - RBAC: Role-based permission checks
 * - Helmet: Security headers
 *
 * @see Infrastructure Guide: docs/infrastructure-guide.md
 */
@Module({
  imports: [
    // ===========================
    // Global Configuration
    // ===========================
    ConfigModule,

    // ===========================
    // Event Emitter (for domain events)
    // ===========================
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 10,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    // ===========================
    // Database (PostgreSQL + TypeORM)
    // ===========================
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.getDatabaseConfig();
        return {
          type: 'postgres',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
          synchronize: false, // Never auto-sync in production
          logging: dbConfig.logging,
          ssl: dbConfig.ssl
            ? {
                rejectUnauthorized: false,
              }
            : false,
          // Connection pool settings (NFR-PERF-001: Sub-100ms p95 latency)
          extra: {
            max: dbConfig.poolSize || 20, // Maximum pool size
            min: 5, // Minimum pool size
            idleTimeoutMillis: 30000, // Close idle connections after 30s
            connectionTimeoutMillis: 5000, // Fail fast if can't connect in 5s
          },
        };
      },
    }),

    // ===========================
    // Rate Limiting (Security)
    // ===========================
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute window
        limit: 100, // 100 requests per minute per IP
      },
    ]),

    // ===========================
    // Infrastructure Modules
    // ===========================
    InfrastructureModule, // Aggregates all infrastructure submodules
    DatabaseModule,
    CacheModule,
    LoggerModule,
    MetricsModule,
    TracingModule,
    HealthModule,
    SecurityModule,

    // ===========================
    // Domain Modules
    // ===========================
    UserDomainModule, // User management, RBAC, team management (US-041 through US-048)
    TaskDomainModule, // Task management (US-011 through US-040, US-049 through US-080)
    NotificationDomainModule, // Notification system (US-081 through US-090)
    IntegrationDomainModule, // External integrations (US-091 through US-100)
  ],

  controllers: [],

  providers: [],
})
export class AppModule {
  constructor(private readonly configService: ConfigService) {
    // Log application startup information
    const serverConfig = this.configService.getServerConfig();
    console.log('='.repeat(60));
    console.log('Task Management Microservice');
    console.log('='.repeat(60));
    console.log(`Environment: ${serverConfig.environment}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log('='.repeat(60));
  }
}
