import { SetMetadata } from '@nestjs/common';

/**
 * @Public Decorator
 *
 * Marks an endpoint as public (no authentication required).
 *
 * Use this decorator on endpoints that should be accessible without JWT token:
 * - Health checks
 * - Metrics endpoints
 * - Public documentation
 * - Webhooks from external services (use webhook signature verification instead)
 *
 * Usage:
 * ```typescript
 * @Controller('health')
 * export class HealthController {
 *   @Get()
 *   @Public()
 *   async healthCheck() {
 *     return { status: 'ok' };
 *   }
 * }
 * ```
 *
 * @returns Decorator that marks endpoint as public
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
