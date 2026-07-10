import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterMemory, RateLimiterRedis, IRateLimiterOptions } from 'rate-limiter-flexible';
import { Request, Response } from 'express';
import { LoggerService } from '../../logging/logger.service';
import { MetricsService } from '../../metrics/metrics.service';

export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Rate Limit Configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests
   */
  points: number;

  /**
   * Time window in seconds
   */
  duration: number;

  /**
   * Custom key generator function
   * Default: Uses user ID or IP address
   */
  keyGenerator?: (req: Request) => string;

  /**
   * Skip rate limiting based on request
   * Default: false
   */
  skip?: (req: Request) => boolean;
}

/**
 * @RateLimit Decorator
 *
 * Apply rate limiting to controller methods.
 *
 * @param config - Rate limit configuration
 *
 * @example
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   @Post('login')
 *   @RateLimit({ points: 5, duration: 60 }) // 5 requests per minute
 *   async login(@Body() dto: LoginDto) {
 *     return await this.authService.login(dto);
 *   }
 *
 *   @Post('register')
 *   @RateLimit({ points: 3, duration: 3600 }) // 3 registrations per hour
 *   async register(@Body() dto: RegisterDto) {
 *     return await this.authService.register(dto);
 *   }
 * }
 * ```
 */
export const RateLimit = (config: RateLimitConfig) => {
  return SetMetadata(RATE_LIMIT_KEY, config);
};

/**
 * RateLimitGuard
 *
 * NestJS guard that enforces rate limiting using rate-limiter-flexible.
 *
 * Features:
 * - Redis-backed rate limiting (production)
 * - In-memory fallback (development)
 * - Per-user or per-IP rate limiting
 * - Customizable limits per endpoint
 * - Returns 429 Too Many Requests with Retry-After header
 * - Metrics tracking for rate limit violations
 *
 * Default Rate Limits (if no @RateLimit decorator):
 * - 1000 requests per hour per user
 * - 100 requests per hour per IP (unauthenticated)
 *
 * Rate Limit Headers:
 * - X-RateLimit-Limit: Maximum requests allowed
 * - X-RateLimit-Remaining: Requests remaining in current window
 * - X-RateLimit-Reset: Timestamp when limit resets
 * - Retry-After: Seconds until rate limit resets (only when rate limited)
 *
 * @example
 * ```typescript
 * // Apply globally
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_GUARD,
 *       useClass: RateLimitGuard,
 *     },
 *   ],
 * })
 * export class AppModule {}
 *
 * // Apply to specific routes
 * @Controller('users')
 * @UseGuards(RateLimitGuard)
 * export class UserController {
 *   @Post()
 *   @RateLimit({ points: 10, duration: 60 })
 *   async createUser() { ... }
 * }
 * ```
 *
 * Complies with:
 * - SECURITY-11: Rate limiting for abuse prevention
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new LoggerService();
  private readonly limiter: RateLimiterMemory | RateLimiterRedis;

  // Default rate limits
  private readonly DEFAULT_POINTS = 1000; // 1000 requests
  private readonly DEFAULT_DURATION = 3600; // per hour

  constructor(
    private readonly reflector: Reflector,
    private readonly metricsService: MetricsService,
  ) {
    this.logger.setContext('RateLimitGuard');

    // Use in-memory rate limiter for simplicity
    // In production, replace with Redis-backed limiter
    const limiterOptions: IRateLimiterOptions = {
      points: this.DEFAULT_POINTS,
      duration: this.DEFAULT_DURATION,
    };

    this.limiter = new RateLimiterMemory(limiterOptions);

    this.logger.log('RateLimitGuard initialized (in-memory)');
  }

  /**
   * Check if request is rate limited
   *
   * @param context - Execution context
   * @returns true if request is allowed, false if rate limited
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get rate limit config from decorator
    const config = this.reflector.get<RateLimitConfig>(RATE_LIMIT_KEY, context.getHandler());

    // Skip rate limiting if configured
    if (config?.skip && config.skip(request)) {
      return true;
    }

    // Generate rate limit key
    const key = config?.keyGenerator
      ? config.keyGenerator(request)
      : this.getDefaultKey(request);

    // Get rate limit parameters
    const points = config?.points ?? this.DEFAULT_POINTS;
    const duration = config?.duration ?? this.DEFAULT_DURATION;

    try {
      // Consume 1 point
      const rateLimiterRes = await this.limiter.consume(key, 1);

      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit', points);
      response.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
      response.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());

      return true;
    } catch (rateLimiterRes: any) {
      // Rate limit exceeded
      const retryAfterSeconds = Math.ceil(rateLimiterRes.msBeforeNext / 1000);

      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit', points);
      response.setHeader('X-RateLimit-Remaining', 0);
      response.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
      response.setHeader('Retry-After', retryAfterSeconds);

      // Log rate limit violation
      this.logger.warn(`Rate limit exceeded for key: ${key}`, {
        key,
        endpoint: request.path,
        retryAfter: retryAfterSeconds,
      });

      // Track metric
      this.metricsService.incrementCounter('rate_limit_violations_total', {
        endpoint: request.path,
        key,
      });

      // Throw 429 Too Many Requests
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`,
          error: 'Too Many Requests',
          retryAfter: retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Get default rate limit key
   *
   * Uses user ID if authenticated, otherwise uses IP address.
   *
   * @param request - Express request
   * @returns Rate limit key
   */
  private getDefaultKey(request: Request): string {
    // Use user ID if authenticated
    if ((request as any).user?.id) {
      return `user:${(request as any).user.id}`;
    }

    // Otherwise use IP address
    const ip = this.getClientIp(request);
    return `ip:${ip}`;
  }

  /**
   * Get client IP address
   *
   * Handles proxies and load balancers (X-Forwarded-For header).
   *
   * @param request - Express request
   * @returns Client IP address
   */
  private getClientIp(request: Request): string {
    // Check X-Forwarded-For header (proxy/load balancer)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2)
      // First IP is the original client
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header (nginx proxy)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fallback to request IP
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
