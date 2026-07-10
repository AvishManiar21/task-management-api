import { Module, Global, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TracingMiddleware } from './tracing.middleware';
import { startTracing, stopTracing } from './tracing.config';
import { LoggerModule } from '../logging/logger.module';

/**
 * TracingModule
 *
 * Global module providing distributed tracing infrastructure with OpenTelemetry.
 *
 * Features:
 * - OpenTelemetry SDK initialization
 * - Automatic instrumentation for HTTP, PostgreSQL, Redis
 * - W3C Trace Context propagation
 * - Tracing middleware for request context injection
 * - Graceful shutdown with span flushing
 *
 * Lifecycle:
 * - onModuleInit: Starts OpenTelemetry SDK
 * - onModuleDestroy: Stops OpenTelemetry SDK and flushes pending spans
 *
 * Environment Configuration:
 * - TRACING_ENABLED - Enable/disable tracing (default: true)
 * - TRACING_SAMPLE_RATE - Sampling rate 0-1 (default: 0.1 = 10%)
 * - TRACING_EXPORTER - Exporter type: 'jaeger' | 'xray' | 'console'
 * - JAEGER_ENDPOINT - Jaeger collector endpoint
 * - SERVICE_NAME - Service name for tracing
 * - SERVICE_VERSION - Service version
 *
 * Usage in Application:
 * ```typescript
 * // app.module.ts
 * @Module({
 *   imports: [TracingModule],
 * })
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     // Apply tracing middleware to all routes
 *     consumer.apply(TracingMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 *
 * Creating Manual Spans:
 * ```typescript
 * import { trace } from '@opentelemetry/api';
 *
 * @Injectable()
 * export class UserService {
 *   private readonly tracer = trace.getTracer('task-management-api');
 *
 *   async createUser(dto: CreateUserDto) {
 *     const span = this.tracer.startSpan('UserService.createUser');
 *
 *     try {
 *       span.setAttribute('user.email', dto.email);
 *       const user = await this.userRepo.create(dto);
 *       span.setStatus({ code: SpanStatusCode.OK });
 *       return user;
 *     } catch (error) {
 *       span.recordException(error);
 *       span.setStatus({ code: SpanStatusCode.ERROR });
 *       throw error;
 *     } finally {
 *       span.end();
 *     }
 *   }
 * }
 * ```
 *
 * Complies with:
 * - RESILIENCY-05: Monitoring and alerting (distributed tracing)
 */
@Global()
@Module({
  imports: [LoggerModule],
  providers: [TracingMiddleware],
  exports: [TracingMiddleware],
})
export class TracingModule implements OnModuleInit, OnModuleDestroy {
  /**
   * Initialize tracing on module init
   *
   * Starts the OpenTelemetry SDK before any instrumented code runs.
   */
  async onModuleInit(): Promise<void> {
    await startTracing();
  }

  /**
   * Stop tracing on module destroy
   *
   * Gracefully shuts down the OpenTelemetry SDK, flushing any pending spans.
   */
  async onModuleDestroy(): Promise<void> {
    await stopTracing();
  }
}
