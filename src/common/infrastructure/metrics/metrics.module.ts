import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

/**
 * MetricsModule
 *
 * Global module providing Prometheus metrics infrastructure.
 *
 * Features:
 * - Prometheus-compatible metrics collection
 * - Pre-configured application-specific metrics
 * - Default Node.js process metrics
 * - HTTP endpoint for Prometheus scraping
 *
 * Metrics Exposed:
 * - http_request_duration_seconds - HTTP request latency
 * - http_requests_total - Total HTTP requests
 * - user_registrations_total - User registration events
 * - auth0_api_call_duration_seconds - Auth0 API latency
 * - permission_cache_hit_rate - Permission cache efficiency
 * - active_users_count - Current active users
 * - task_creations_total - Task creation events
 * - task_assignments_total - Task assignment events
 * - database_query_duration_seconds - Database query latency
 * - cache_operations_total - Cache operation counts
 * - nodejs_* - Node.js process metrics (memory, CPU, GC, event loop)
 *
 * Usage in Services:
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly metricsService: MetricsService) {}
 *
 *   async createUser(dto: CreateUserDto) {
 *     this.metricsService.incrementCounter('user_registrations_total', {
 *       method: 'email',
 *       source: 'web'
 *     });
 *     // ... implementation
 *   }
 * }
 * ```
 *
 * Usage in Middleware:
 * ```typescript
 * @Injectable()
 * export class MetricsMiddleware implements NestMiddleware {
 *   constructor(private readonly metricsService: MetricsService) {}
 *
 *   use(req: Request, res: Response, next: NextFunction) {
 *     const start = Date.now();
 *     res.on('finish', () => {
 *       const duration = (Date.now() - start) / 1000;
 *       this.metricsService.recordHttpRequest(
 *         req.method,
 *         req.route?.path || req.path,
 *         res.statusCode,
 *         duration
 *       );
 *     });
 *     next();
 *   }
 * }
 * ```
 *
 * Prometheus Configuration:
 * Add to prometheus.yml:
 * ```yaml
 * scrape_configs:
 *   - job_name: 'task-management-api'
 *     scrape_interval: 15s
 *     static_configs:
 *       - targets: ['task-management-api:3000']
 *     metrics_path: '/metrics'
 * ```
 *
 * Complies with:
 * - RESILIENCY-05: Monitoring and alerting infrastructure
 */
@Global()
@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
