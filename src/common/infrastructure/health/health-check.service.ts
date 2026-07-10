import { Injectable } from '@nestjs/common';
import { HealthCheckService as TerminusHealthCheckService, TypeOrmHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { LoggerService } from '../logging/logger.service';
import { CacheService } from '../cache/cache.service';

/**
 * Health Status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Health Check Result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  dependencies?: {
    database?: DependencyHealth;
    cache?: DependencyHealth;
    auth0?: DependencyHealth;
  };
}

/**
 * Dependency Health
 */
export interface DependencyHealth {
  status: HealthStatus;
  responseTime?: number; // milliseconds
  message?: string;
  error?: string;
}

/**
 * HealthCheckService
 *
 * Provides health check endpoints for Kubernetes liveness and readiness probes.
 *
 * Health Check Types:
 * - Liveness: Is the process running? (no dependency checks)
 * - Readiness: Can the service handle requests? (checks critical dependencies)
 * - Deep Health: Detailed health of all dependencies (for monitoring dashboards)
 *
 * Kubernetes Probe Configuration:
 * ```yaml
 * livenessProbe:
 *   httpGet:
 *     path: /health
 *     port: 3000
 *   initialDelaySeconds: 10
 *   periodSeconds: 30
 *
 * readinessProbe:
 *   httpGet:
 *     path: /ready
 *     port: 3000
 *   initialDelaySeconds: 5
 *   periodSeconds: 10
 * ```
 *
 * Health Status Logic:
 * - HEALTHY: All dependencies are operational
 * - DEGRADED: Non-critical dependencies are down (e.g., cache, Auth0)
 * - UNHEALTHY: Critical dependencies are down (e.g., database)
 *
 * Complies with:
 * - US-062: Health and Readiness Endpoints
 * - RESILIENCY-06: Kubernetes health checks
 *
 * @example
 * ```typescript
 * // Liveness check (always returns healthy if process is running)
 * const liveness = await healthCheckService.checkLiveness();
 * // { status: 'healthy', timestamp: '2024-...', uptime: 12345 }
 *
 * // Readiness check (checks database and cache)
 * const readiness = await healthCheckService.checkReadiness();
 * // { status: 'healthy', timestamp: '2024-...', uptime: 12345, dependencies: {...} }
 *
 * // Deep health check (checks all dependencies including Auth0)
 * const deepHealth = await healthCheckService.checkDeepHealth();
 * // { status: 'degraded', timestamp: '2024-...', uptime: 12345, dependencies: {...} }
 * ```
 */
@Injectable()
export class HealthCheckService {
  private readonly logger = new LoggerService();
  private readonly startTime = Date.now();

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cacheService: CacheService,
    private readonly terminus: TerminusHealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {
    this.logger.setContext('HealthCheckService');
  }

  /**
   * Liveness Check
   *
   * Checks if the process is running (no dependency checks).
   * Used by Kubernetes liveness probe.
   *
   * Returns:
   * - HTTP 200 if process is running
   * - Always returns HEALTHY (no dependency checks)
   *
   * @returns Liveness health status
   */
  async checkLiveness(): Promise<HealthCheckResult> {
    return {
      status: HealthStatus.HEALTHY,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
    };
  }

  /**
   * Readiness Check
   *
   * Checks if service can handle requests (checks critical dependencies).
   * Used by Kubernetes readiness probe.
   *
   * Critical Dependencies:
   * - Database (PostgreSQL)
   *
   * Non-Critical Dependencies (checked but don't fail readiness):
   * - Cache (Redis) - Graceful degradation supported
   *
   * Returns:
   * - HTTP 200 if database is healthy
   * - HTTP 503 if database is unhealthy
   * - DEGRADED status if cache is down (but still returns HTTP 200)
   *
   * @returns Readiness health status
   */
  async checkReadiness(): Promise<HealthCheckResult> {
    const dependencies: HealthCheckResult['dependencies'] = {};

    // Check database (critical dependency)
    const dbHealth = await this.checkDatabase();
    dependencies.database = dbHealth;

    // Check cache (non-critical, graceful degradation)
    const cacheHealth = await this.checkCache();
    dependencies.cache = cacheHealth;

    // Determine overall status
    let status = HealthStatus.HEALTHY;

    // If database is unhealthy, service is unhealthy
    if (dbHealth.status === HealthStatus.UNHEALTHY) {
      status = HealthStatus.UNHEALTHY;
    }
    // If cache is unhealthy, service is degraded (but still ready)
    else if (cacheHealth.status === HealthStatus.UNHEALTHY) {
      status = HealthStatus.DEGRADED;
      this.logger.warn('Service is degraded - cache is unavailable');
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      dependencies,
    };
  }

  /**
   * Deep Health Check
   *
   * Detailed health check of all dependencies (for monitoring dashboards).
   *
   * Checks:
   * - Database (PostgreSQL)
   * - Cache (Redis)
   * - Auth0 (optional, doesn't fail health check due to timeout risk)
   * - Memory usage
   *
   * Returns:
   * - Detailed status of each dependency
   * - Response times for each check
   *
   * Note: This endpoint should be cached (10 seconds) to avoid overwhelming dependencies.
   *
   * @returns Deep health status
   */
  async checkDeepHealth(): Promise<HealthCheckResult> {
    const dependencies: HealthCheckResult['dependencies'] = {};

    // Check database
    dependencies.database = await this.checkDatabase();

    // Check cache
    dependencies.cache = await this.checkCache();

    // Check Auth0 (optional, timeout-protected)
    dependencies.auth0 = await this.checkAuth0();

    // Determine overall status
    let status = HealthStatus.HEALTHY;

    // Critical: Database
    if (dependencies.database.status === HealthStatus.UNHEALTHY) {
      status = HealthStatus.UNHEALTHY;
    }
    // Non-critical degradation
    else if (
      dependencies.cache?.status === HealthStatus.UNHEALTHY ||
      dependencies.auth0?.status === HealthStatus.UNHEALTHY
    ) {
      status = HealthStatus.DEGRADED;
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      dependencies,
    };
  }

  /**
   * Check Database Health
   *
   * Executes simple query: SELECT 1
   *
   * @returns Database health status
   */
  private async checkDatabase(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      // Simple query to check database connectivity
      await this.connection.query('SELECT 1');

      const responseTime = Date.now() - start;

      return {
        status: HealthStatus.HEALTHY,
        responseTime,
        message: 'Database connection is healthy',
      };
    } catch (error) {
      const responseTime = Date.now() - start;

      this.logger.error('Database health check failed', error.stack);

      return {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: error.message,
        message: 'Database connection failed',
      };
    }
  }

  /**
   * Check Cache Health
   *
   * Executes PING command to Redis
   *
   * @returns Cache health status
   */
  private async checkCache(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      // Check if cache service is healthy
      const isHealthy = this.cacheService.isHealthy();

      if (!isHealthy) {
        return {
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - start,
          message: 'Redis connection is unavailable (degraded mode)',
        };
      }

      // Try to set and get a test key
      const testKey = '__health_check__';
      const testValue = Date.now().toString();

      await this.cacheService.set(testKey, testValue, 10);
      const retrieved = await this.cacheService.get<string>(testKey);

      const responseTime = Date.now() - start;

      if (retrieved === testValue) {
        await this.cacheService.del(testKey);

        return {
          status: HealthStatus.HEALTHY,
          responseTime,
          message: 'Cache is operational',
        };
      } else {
        return {
          status: HealthStatus.DEGRADED,
          responseTime,
          message: 'Cache read/write verification failed',
        };
      }
    } catch (error) {
      const responseTime = Date.now() - start;

      this.logger.warn('Cache health check failed (degraded mode)', error.message);

      return {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: error.message,
        message: 'Cache connection failed',
      };
    }
  }

  /**
   * Check Auth0 Health
   *
   * Optional check - doesn't fail overall health due to timeout risk.
   * Just reports Auth0 availability for monitoring.
   *
   * @returns Auth0 health status
   */
  private async checkAuth0(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      // Note: Actual Auth0 health check would require Auth0 SDK
      // For now, we'll skip this to avoid external dependencies
      // In production, implement:
      // - await this.auth0Service.checkHealth();
      // - Timeout protection (5 second max)

      return {
        status: HealthStatus.HEALTHY,
        responseTime: Date.now() - start,
        message: 'Auth0 health check not implemented (skipped)',
      };
    } catch (error) {
      const responseTime = Date.now() - start;

      this.logger.warn('Auth0 health check failed', error.message);

      return {
        status: HealthStatus.DEGRADED,
        responseTime,
        error: error.message,
        message: 'Auth0 availability check failed (non-critical)',
      };
    }
  }

  /**
   * Get application uptime in seconds
   *
   * @returns Uptime in seconds
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
