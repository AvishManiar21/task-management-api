import { Module, Global } from '@nestjs/common';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { MetricsModule } from '../metrics/metrics.module';
import { LoggerModule } from '../logging/logger.module';

/**
 * SecurityModule
 *
 * Global module providing security infrastructure.
 *
 * Features:
 * - Rate limiting for abuse prevention
 * - IP-based and user-based rate limits
 * - Configurable per-endpoint limits
 *
 * Future Enhancements:
 * - CORS configuration
 * - Helmet security headers
 * - CSRF protection
 * - Content Security Policy (CSP)
 * - Request size limits
 * - Request signature validation
 *
 * Usage:
 * ```typescript
 * // Apply rate limiting globally
 * @Module({
 *   imports: [SecurityModule],
 *   providers: [
 *     {
 *       provide: APP_GUARD,
 *       useClass: RateLimitGuard,
 *     },
 *   ],
 * })
 * export class AppModule {}
 *
 * // Apply custom rate limits to specific endpoints
 * @Controller('auth')
 * export class AuthController {
 *   @Post('login')
 *   @RateLimit({ points: 5, duration: 60 }) // 5 attempts per minute
 *   async login() { ... }
 * }
 * ```
 *
 * Rate Limit Configuration:
 * - Default: 1000 requests/hour per user
 * - Unauthenticated: 100 requests/hour per IP
 * - Custom limits via @RateLimit decorator
 *
 * Complies with:
 * - SECURITY-11: Rate limiting for abuse prevention
 */
@Global()
@Module({
  imports: [MetricsModule, LoggerModule],
  providers: [RateLimitGuard],
  exports: [RateLimitGuard],
})
export class SecurityModule {}
