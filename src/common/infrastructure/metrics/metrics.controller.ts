import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { Public } from '@modules/user-domain/decorators/public.decorator';

/**
 * MetricsController
 *
 * Exposes Prometheus metrics endpoint for scraping.
 *
 * Endpoints:
 * - GET /metrics - Returns all metrics in Prometheus exposition format
 *
 * Security:
 * - No authentication required (Prometheus scraper needs access)
 * - Rate limited to 100 requests/minute to prevent abuse
 * - Should be exposed only to internal network in production
 *
 * Prometheus Scrape Configuration:
 * ```yaml
 * scrape_configs:
 *   - job_name: 'task-management-api'
 *     scrape_interval: 15s
 *     static_configs:
 *       - targets: ['localhost:3000']
 *     metrics_path: '/metrics'
 * ```
 *
 * @example
 * ```bash
 * # Scrape metrics
 * curl http://localhost:3000/metrics
 *
 * # Output (Prometheus exposition format):
 * # HELP http_requests_total Total number of HTTP requests
 * # TYPE http_requests_total counter
 * http_requests_total{method="GET",route="/users",status_code="200"} 42
 *
 * # HELP http_request_duration_seconds Duration of HTTP requests in seconds
 * # TYPE http_request_duration_seconds histogram
 * http_request_duration_seconds_bucket{method="GET",route="/users",status_code="200",le="0.005"} 10
 * http_request_duration_seconds_bucket{method="GET",route="/users",status_code="200",le="0.01"} 25
 * # ...
 * ```
 *
 * Complies with:
 * - RESILIENCY-05: Monitoring and alerting (Prometheus integration)
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Get Prometheus metrics
   *
   * Returns all application metrics in Prometheus exposition format.
   * This endpoint is scraped by Prometheus server at regular intervals.
   *
   * @returns Prometheus-formatted metrics string
   */
  @Get()
  @Public() // No authentication required for Prometheus scraper
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }
}
