import { Module, Global } from '@nestjs/common';

/**
 * ResiliencyModule
 *
 * Global module providing resiliency patterns for fault tolerance.
 *
 * Features:
 * - Circuit breaker pattern for external service calls
 * - Prevents cascade failures
 * - Automatic service recovery detection
 * - Configurable failure thresholds and recovery periods
 *
 * Patterns Provided:
 * - Circuit Breaker: Fail fast when external service is down
 *
 * Future Enhancements:
 * - Retry with exponential backoff
 * - Bulkhead isolation (limit concurrent requests)
 * - Rate limiting per service
 * - Timeout policies
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * export class Auth0Service {
 *   @CircuitBreaker({
 *     strategy: 'consecutive',
 *     threshold: 5,
 *     halfOpenAfter: 30000,
 *     fallback: () => null,
 *     name: 'auth0-api'
 *   })
 *   async callAuth0API(endpoint: string, data: any) {
 *     return await this.httpClient.post(endpoint, data);
 *   }
 * }
 * ```
 *
 * Monitoring Circuit Breakers:
 * ```typescript
 * import { CircuitBreakerRegistry } from './decorators/circuit-breaker.decorator';
 *
 * // Get circuit breaker state
 * const cb = CircuitBreakerRegistry.get('auth0-api');
 * const state = cb.state; // 'closed', 'open', or 'half-open'
 * ```
 *
 * Complies with:
 * - RESILIENCY-10: Circuit breakers for preventing cascade failures
 */
@Global()
@Module({
  providers: [],
  exports: [],
})
export class ResiliencyModule {}
