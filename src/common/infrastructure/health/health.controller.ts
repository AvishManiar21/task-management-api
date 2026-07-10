import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthCheckService, HealthCheckResult, HealthStatus } from './health-check.service';
import { CacheService } from '../cache/cache.service';
import { Public } from '@modules/user-domain/decorators/public.decorator';

/**
 * HealthController
 *
 * Exposes health check endpoints for Kubernetes probes and monitoring.
 *
 * Endpoints:
 * - GET /health - Liveness probe (process running?)
 * - GET /ready - Readiness probe (can handle requests?)
 * - GET /health/deep - Deep health check (all dependencies)
 *
 * Security:
 * - No authentication required (Kubernetes needs access)
 * - Should be exposed only to internal network in production
 * - Consider IP whitelist for /health/deep endpoint
 *
 * Kubernetes Configuration:
 * ```yaml
 * apiVersion: v1
 * kind: Pod
 * spec:
 *   containers:
 *   - name: task-management-api
 *     livenessProbe:
 *       httpGet:
 *         path: /health
 *         port: 3000
 *       initialDelaySeconds: 10
 *       periodSeconds: 30
 *       timeoutSeconds: 5
 *       failureThreshold: 3
 *
 *     readinessProbe:
 *       httpGet:
 *         path: /ready
 *         port: 3000
 *       initialDelaySeconds: 5
 *       periodSeconds: 10
 *       timeoutSeconds: 5
 *       failureThreshold: 3
 * ```
 *
 * Complies with:
 * - US-062: Health and Readiness Endpoints
 * - RESILIENCY-06: Kubernetes health checks
 */
@Controller()
export class HealthController {
  // Cache deep health check for 10 seconds to avoid overwhelming dependencies
  private deepHealthCache: { result: HealthCheckResult; timestamp: number } | null = null;
  private readonly DEEP_HEALTH_CACHE_TTL = 10000; // 10 seconds

  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Liveness Probe
   *
   * Kubernetes liveness probe to check if process is running.
   * Does NOT check dependencies - only confirms process is alive.
   *
   * Returns:
   * - HTTP 200: Process is running
   * - HTTP 503: Process is not responding (should never happen if this returns)
   *
   * @returns Liveness status (always healthy if this method executes)
   */
  @Get('health')
  @Public() // No authentication required for health checks
  @HttpCode(HttpStatus.OK)
  async checkLiveness(): Promise<HealthCheckResult> {
    return await this.healthCheckService.checkLiveness();
  }

  /**
   * Readiness Probe
   *
   * Kubernetes readiness probe to check if service can handle requests.
   * Checks critical dependencies (database).
   *
   * Returns:
   * - HTTP 200: Service is ready (database healthy, cache may be degraded)
   * - HTTP 503: Service is not ready (database unhealthy)
   *
   * Kubernetes will:
   * - Remove pod from load balancer if readiness fails
   * - Add pod back to load balancer when readiness succeeds
   *
   * @returns Readiness status
   */
  @Get('ready')
  @Public() // No authentication required for readiness probes
  async checkReadiness(): Promise<HealthCheckResult> {
    const result = await this.healthCheckService.checkReadiness();

    // Return HTTP 503 if service is unhealthy
    // Return HTTP 200 for healthy or degraded (degraded = cache down, but database OK)
    if (result.status === HealthStatus.UNHEALTHY) {
      throw new Error('Service is not ready');
    }

    return result;
  }

  /**
   * Deep Health Check
   *
   * Detailed health check for monitoring dashboards (not for Kubernetes probes).
   * Checks all dependencies including Auth0.
   *
   * Returns:
   * - HTTP 200: Detailed health of all dependencies
   *
   * Note:
   * - Cached for 10 seconds to avoid overwhelming dependencies
   * - Does not return HTTP 503 (always returns 200 with status in body)
   * - Use /ready for Kubernetes readiness probe, not this endpoint
   *
   * Example Response:
   * ```json
   * {
   *   "status": "degraded",
   *   "timestamp": "2024-07-05T12:34:56.789Z",
   *   "uptime": 12345,
   *   "dependencies": {
   *     "database": {
   *       "status": "healthy",
   *       "responseTime": 5,
   *       "message": "Database connection is healthy"
   *     },
   *     "cache": {
   *       "status": "unhealthy",
   *       "responseTime": 1002,
   *       "error": "ECONNREFUSED",
   *       "message": "Cache connection failed"
   *     },
   *     "auth0": {
   *       "status": "healthy",
   *       "responseTime": 123,
   *       "message": "Auth0 health check not implemented (skipped)"
   *     }
   *   }
   * }
   * ```
   *
   * @returns Deep health status
   */
  @Get('health/deep')
  @Public() // No authentication required for monitoring dashboards
  @HttpCode(HttpStatus.OK)
  async checkDeepHealth(): Promise<HealthCheckResult> {
    // Check cache first
    const now = Date.now();
    if (this.deepHealthCache && now - this.deepHealthCache.timestamp < this.DEEP_HEALTH_CACHE_TTL) {
      return this.deepHealthCache.result;
    }

    // Execute deep health check
    const result = await this.healthCheckService.checkDeepHealth();

    // Update cache
    this.deepHealthCache = {
      result,
      timestamp: now,
    };

    return result;
  }
}
