import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { LoggerService } from '../logging/logger.service';

/**
 * TracingMiddleware
 *
 * NestJS middleware that enriches requests with distributed tracing context.
 *
 * Features:
 * - Extracts parent trace ID from W3C Trace Context headers
 * - Creates child spans for incoming HTTP requests
 * - Injects trace context into request object
 * - Attaches span ID to logger context for correlation
 * - Automatically records span status and errors
 *
 * Request Headers (W3C Trace Context):
 * - traceparent: 00-{trace-id}-{span-id}-{flags}
 * - tracestate: {key}={value}[,{key}={value}]*
 *
 * Response Headers:
 * - x-trace-id: Current trace ID for client correlation
 *
 * Span Attributes:
 * - http.method: HTTP method
 * - http.route: Request route pattern
 * - http.status_code: HTTP status code
 * - http.user_agent: Client user agent
 * - user.id: Authenticated user ID (if available)
 *
 * Usage:
 * ```typescript
 * // app.module.ts
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(TracingMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 *
 * Complies with:
 * - RESILIENCY-05: Distributed tracing for monitoring
 */
@Injectable()
export class TracingMiddleware implements NestMiddleware {
  private readonly tracer = trace.getTracer('task-management-api');

  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('TracingMiddleware');
  }

  /**
   * Process incoming request with tracing
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // Get active context (parent span from W3C Trace Context headers)
    const activeContext = context.active();

    // Create child span for this HTTP request
    const span = this.tracer.startSpan(
      `HTTP ${req.method} ${req.path}`,
      {
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.target': req.path,
          'http.host': req.hostname,
          'http.scheme': req.protocol,
          'http.user_agent': req.get('user-agent') || 'unknown',
        },
      },
      activeContext,
    );

    // Get trace ID from span context
    const spanContext = span.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;

    // Inject trace context into request object
    (req as any).traceId = traceId;
    (req as any).spanId = spanId;

    // Set trace ID in response header for client correlation
    res.setHeader('x-trace-id', traceId);

    // Inject trace context into logger
    this.logger.setGlobalContext({
      traceId,
      spanId,
    });

    // Record response details when request completes
    res.on('finish', () => {
      // Set span attributes
      span.setAttribute('http.status_code', res.statusCode);

      // Set user ID if authenticated
      if ((req as any).user?.id) {
        span.setAttribute('user.id', (req as any).user.id);
      }

      // Set route pattern (if available from NestJS)
      if ((req as any).route?.path) {
        span.setAttribute('http.route', (req as any).route.path);
      }

      // Set span status based on HTTP status code
      if (res.statusCode >= 500) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode} Client Error`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      // End span
      span.end();

      // Clear logger global context
      this.logger.clearGlobalContext();
    });

    // Handle errors
    res.on('error', (error: Error) => {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();

      this.logger.clearGlobalContext();
    });

    // Continue to next middleware/handler
    next();
  }
}
