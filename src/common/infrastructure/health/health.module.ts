import { Module, Global } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthCheckService } from './health-check.service';
import { HealthController } from './health.controller';
import { CacheModule } from '../cache/cache.module';

/**
 * HealthModule
 *
 * Global module providing health check infrastructure for Kubernetes.
 *
 * Features:
 * - Liveness probe: Process running check
 * - Readiness probe: Critical dependency check (database)
 * - Deep health check: All dependencies including cache and Auth0
 * - NestJS Terminus integration for health indicators
 *
 * Health Check Endpoints:
 * - GET /health - Liveness probe (always returns 200 if process is running)
 * - GET /ready - Readiness probe (returns 200 if database is healthy, 503 otherwise)
 * - GET /health/deep - Deep health check (cached for 10 seconds)
 *
 * Health Status:
 * - HEALTHY: All dependencies operational
 * - DEGRADED: Non-critical dependencies down (cache, Auth0)
 * - UNHEALTHY: Critical dependencies down (database)
 *
 * Kubernetes Integration:
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
 * Prometheus Alerts:
 * ```yaml
 * - alert: ServiceUnhealthy
 *   expr: up{job="task-management-api"} == 0
 *   for: 2m
 *   annotations:
 *     summary: "Service {{ $labels.instance }} is down"
 *
 * - alert: ServiceDegraded
 *   expr: health_status{status="degraded"} == 1
 *   for: 5m
 *   annotations:
 *     summary: "Service {{ $labels.instance }} is degraded"
 * ```
 *
 * Complies with:
 * - US-062: Implement Health and Readiness Endpoints
 * - RESILIENCY-06: Kubernetes health checks
 */
@Global()
@Module({
  imports: [
    TerminusModule,
    TypeOrmModule,
    CacheModule,
  ],
  providers: [HealthCheckService],
  controllers: [HealthController],
  exports: [HealthCheckService],
})
export class HealthModule {}
