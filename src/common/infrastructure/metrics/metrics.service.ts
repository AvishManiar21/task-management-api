import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  register as defaultRegister,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Metric Labels
 *
 * Key-value pairs for labeling metrics (used for filtering and aggregation)
 */
export interface MetricLabels {
  [key: string]: string | number;
}

/**
 * MetricsService
 *
 * Prometheus metrics collection service for observability.
 *
 * Features:
 * - Wrapper around prom-client for Prometheus metrics
 * - Pre-configured application-specific metrics
 * - Default system metrics (memory, CPU, event loop)
 * - Custom metric registration support
 * - Label-based metric filtering
 *
 * Metric Types:
 * - Counter: Monotonically increasing value (e.g., total requests, errors)
 * - Histogram: Distribution of values (e.g., request duration, response size)
 * - Gauge: Current value that can go up or down (e.g., active connections, cache hit rate)
 *
 * Pre-defined Metrics:
 * - http_request_duration_seconds: HTTP request latency histogram
 * - http_requests_total: Total HTTP requests counter
 * - user_registrations_total: User registration events counter
 * - auth0_api_call_duration_seconds: Auth0 API call latency histogram
 * - permission_cache_hit_rate: Permission cache hit rate gauge
 * - active_users_count: Current active users gauge
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly metricsService: MetricsService) {}
 *
 *   async createUser(dto: CreateUserDto) {
 *     // Increment user registration counter
 *     this.metricsService.incrementCounter('user_registrations_total', {
 *       method: 'email',
 *       source: 'web'
 *     });
 *
 *     return await this.userRepo.create(dto);
 *   }
 * }
 * ```
 *
 * Complies with:
 * - RESILIENCY-05: Monitoring and alerting infrastructure
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // Pre-defined metrics
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestsTotal: Counter<string>;
  private readonly userRegistrationsTotal: Counter<string>;
  private readonly auth0ApiCallDuration: Histogram<string>;
  private readonly permissionCacheHitRate: Gauge<string>;
  private readonly activeUsersCount: Gauge<string>;
  private readonly taskCreationsTotal: Counter<string>;
  private readonly taskAssignmentsTotal: Counter<string>;
  private readonly databaseQueryDuration: Histogram<string>;
  private readonly cacheOperationsTotal: Counter<string>;

  // Custom metrics registry
  private readonly customCounters: Map<string, Counter<string>> = new Map();
  private readonly customHistograms: Map<string, Histogram<string>> = new Map();
  private readonly customGauges: Map<string, Gauge<string>> = new Map();

  constructor() {
    // Use default Prometheus registry
    this.registry = defaultRegister;

    // Initialize HTTP request duration histogram
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 1ms to 5s
      registers: [this.registry],
    });

    // Initialize HTTP requests total counter
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // Initialize user registrations counter
    this.userRegistrationsTotal = new Counter({
      name: 'user_registrations_total',
      help: 'Total number of user registrations',
      labelNames: ['method', 'source'], // method: email, oauth; source: web, mobile
      registers: [this.registry],
    });

    // Initialize Auth0 API call duration histogram
    this.auth0ApiCallDuration = new Histogram({
      name: 'auth0_api_call_duration_seconds',
      help: 'Duration of Auth0 API calls in seconds',
      labelNames: ['operation', 'status'], // operation: createUser, updateUser, deleteUser; status: success, error
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10], // 10ms to 10s
      registers: [this.registry],
    });

    // Initialize permission cache hit rate gauge
    this.permissionCacheHitRate = new Gauge({
      name: 'permission_cache_hit_rate',
      help: 'Permission cache hit rate (0-1)',
      registers: [this.registry],
    });

    // Initialize active users count gauge
    this.activeUsersCount = new Gauge({
      name: 'active_users_count',
      help: 'Current number of active users',
      registers: [this.registry],
    });

    // Initialize task creations counter
    this.taskCreationsTotal = new Counter({
      name: 'task_creations_total',
      help: 'Total number of tasks created',
      labelNames: ['priority', 'status'],
      registers: [this.registry],
    });

    // Initialize task assignments counter
    this.taskAssignmentsTotal = new Counter({
      name: 'task_assignments_total',
      help: 'Total number of task assignments',
      labelNames: ['assignedBy', 'assignedTo'],
      registers: [this.registry],
    });

    // Initialize database query duration histogram
    this.databaseQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1], // 1ms to 1s
      registers: [this.registry],
    });

    // Initialize cache operations counter
    this.cacheOperationsTotal = new Counter({
      name: 'cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation', 'result'], // operation: get, set, del; result: hit, miss, error
      registers: [this.registry],
    });
  }

  /**
   * Initialize default metrics collection
   *
   * Collects Node.js process metrics (memory, CPU, event loop)
   */
  onModuleInit() {
    // Collect default metrics (memory, CPU, event loop latency)
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'nodejs_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // GC duration buckets
    });
  }

  /**
   * Increment a counter metric
   *
   * @param name - Metric name
   * @param labels - Optional labels for filtering
   * @param value - Value to increment by (default: 1)
   */
  incrementCounter(name: string, labels?: MetricLabels, value: number = 1): void {
    const metric = this.getOrCreateCounter(name, labels);
    if (labels) {
      metric.inc(labels as any, value);
    } else {
      metric.inc(value);
    }
  }

  /**
   * Observe a value in a histogram metric
   *
   * Used for measuring distributions (latency, size, etc.)
   *
   * @param name - Metric name
   * @param value - Value to observe
   * @param labels - Optional labels for filtering
   */
  observeHistogram(name: string, value: number, labels?: MetricLabels): void {
    const metric = this.getOrCreateHistogram(name, labels);
    if (labels) {
      metric.observe(labels as any, value);
    } else {
      metric.observe(value);
    }
  }

  /**
   * Set a gauge metric value
   *
   * Used for current state values (active connections, memory usage, etc.)
   *
   * @param name - Metric name
   * @param value - Current value
   * @param labels - Optional labels for filtering
   */
  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const metric = this.getOrCreateGauge(name, labels);
    if (labels) {
      metric.set(labels as any, value);
    } else {
      metric.set(value);
    }
  }

  /**
   * Increment a gauge metric
   *
   * @param name - Metric name
   * @param value - Value to increment by (default: 1)
   * @param labels - Optional labels for filtering
   */
  incrementGauge(name: string, value: number = 1, labels?: MetricLabels): void {
    const metric = this.getOrCreateGauge(name, labels);
    if (labels) {
      metric.inc(labels as any, value);
    } else {
      metric.inc(value);
    }
  }

  /**
   * Decrement a gauge metric
   *
   * @param name - Metric name
   * @param value - Value to decrement by (default: 1)
   * @param labels - Optional labels for filtering
   */
  decrementGauge(name: string, value: number = 1, labels?: MetricLabels): void {
    const metric = this.getOrCreateGauge(name, labels);
    if (labels) {
      metric.dec(labels as any, value);
    } else {
      metric.dec(value);
    }
  }

  /**
   * Get metrics in Prometheus format
   *
   * Returns all metrics as plain text in Prometheus exposition format
   * to be scraped by Prometheus server.
   *
   * @returns Prometheus-formatted metrics string
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics registry (for testing or custom usage)
   *
   * @returns Prometheus registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Record HTTP request metrics
   *
   * Helper method for middleware to record HTTP request duration and count
   *
   * @param method - HTTP method (GET, POST, etc.)
   * @param route - Request route pattern
   * @param statusCode - HTTP status code
   * @param durationSeconds - Request duration in seconds
   */
  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    const labels = { method, route, status_code: statusCode.toString() };
    this.httpRequestDuration.observe(labels, durationSeconds);
    this.httpRequestsTotal.inc(labels);
  }

  /**
   * Record Auth0 API call metrics
   *
   * @param operation - Auth0 operation (createUser, updateUser, etc.)
   * @param durationSeconds - API call duration in seconds
   * @param success - Whether the call succeeded
   */
  recordAuth0ApiCall(operation: string, durationSeconds: number, success: boolean): void {
    const labels = { operation, status: success ? 'success' : 'error' };
    this.auth0ApiCallDuration.observe(labels, durationSeconds);
  }

  /**
   * Get or create a custom counter
   *
   * @param name - Counter name
   * @param labels - Label names
   * @returns Counter instance
   */
  private getOrCreateCounter(name: string, labels?: MetricLabels): Counter<string> {
    // Check pre-defined metrics
    if (name === 'http_requests_total') return this.httpRequestsTotal;
    if (name === 'user_registrations_total') return this.userRegistrationsTotal;
    if (name === 'task_creations_total') return this.taskCreationsTotal;
    if (name === 'task_assignments_total') return this.taskAssignmentsTotal;
    if (name === 'cache_operations_total') return this.cacheOperationsTotal;

    // Get or create custom counter
    if (!this.customCounters.has(name)) {
      const labelNames = labels ? Object.keys(labels) : [];
      const counter = new Counter({
        name,
        help: `Custom counter metric: ${name}`,
        labelNames,
        registers: [this.registry],
      });
      this.customCounters.set(name, counter);
    }

    return this.customCounters.get(name)!;
  }

  /**
   * Get or create a custom histogram
   *
   * @param name - Histogram name
   * @param labels - Label names
   * @returns Histogram instance
   */
  private getOrCreateHistogram(name: string, labels?: MetricLabels): Histogram<string> {
    // Check pre-defined metrics
    if (name === 'http_request_duration_seconds') return this.httpRequestDuration;
    if (name === 'auth0_api_call_duration_seconds') return this.auth0ApiCallDuration;
    if (name === 'database_query_duration_seconds') return this.databaseQueryDuration;

    // Get or create custom histogram
    if (!this.customHistograms.has(name)) {
      const labelNames = labels ? Object.keys(labels) : [];
      const histogram = new Histogram({
        name,
        help: `Custom histogram metric: ${name}`,
        labelNames,
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5], // Default buckets
        registers: [this.registry],
      });
      this.customHistograms.set(name, histogram);
    }

    return this.customHistograms.get(name)!;
  }

  /**
   * Get or create a custom gauge
   *
   * @param name - Gauge name
   * @param labels - Label names
   * @returns Gauge instance
   */
  private getOrCreateGauge(name: string, labels?: MetricLabels): Gauge<string> {
    // Check pre-defined metrics
    if (name === 'permission_cache_hit_rate') return this.permissionCacheHitRate;
    if (name === 'active_users_count') return this.activeUsersCount;

    // Get or create custom gauge
    if (!this.customGauges.has(name)) {
      const labelNames = labels ? Object.keys(labels) : [];
      const gauge = new Gauge({
        name,
        help: `Custom gauge metric: ${name}`,
        labelNames,
        registers: [this.registry],
      });
      this.customGauges.set(name, gauge);
    }

    return this.customGauges.get(name)!;
  }
}
