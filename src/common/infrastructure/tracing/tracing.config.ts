import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

/**
 * OpenTelemetry Tracing Configuration
 *
 * Configures distributed tracing for the Task Management API using OpenTelemetry.
 *
 * Features:
 * - Automatic instrumentation for HTTP, PostgreSQL, Redis
 * - W3C Trace Context propagation for distributed tracing
 * - Sampling strategy (configurable percentage of requests)
 * - Jaeger or AWS X-Ray export (environment-based)
 * - Service name and version tagging
 *
 * Environment Configuration:
 * - TRACING_ENABLED - Enable/disable tracing (default: true)
 * - TRACING_SAMPLE_RATE - Sampling rate 0-1 (default: 0.1 = 10%)
 * - TRACING_EXPORTER - Exporter type: 'jaeger' | 'xray' | 'console' (default: 'jaeger')
 * - JAEGER_ENDPOINT - Jaeger collector endpoint (default: http://localhost:14268/api/traces)
 * - SERVICE_NAME - Service name for tracing (default: 'task-management-api')
 * - SERVICE_VERSION - Service version (default: '1.0.0')
 *
 * Jaeger Setup (Development):
 * ```bash
 * docker run -d --name jaeger \
 *   -p 6831:6831/udp \
 *   -p 6832:6832/udp \
 *   -p 14268:14268 \
 *   -p 16686:16686 \
 *   jaegertracing/all-in-one:latest
 *
 * # View traces: http://localhost:16686
 * ```
 *
 * Complies with:
 * - RESILIENCY-05: Monitoring and alerting (distributed tracing)
 */

let otelSDK: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 *
 * Creates and configures the OpenTelemetry SDK instance with:
 * - Service resource attributes
 * - Auto-instrumentation for HTTP, PostgreSQL, Redis
 * - Sampling strategy
 * - Trace exporter (Jaeger, X-Ray, or Console)
 * - W3C Trace Context propagation
 *
 * @returns NodeSDK instance or null if tracing disabled
 */
export function initializeTracing(): NodeSDK | null {
  const tracingEnabled = process.env.TRACING_ENABLED !== 'false';

  if (!tracingEnabled) {
    console.log('Tracing disabled via TRACING_ENABLED=false');
    return null;
  }

  const serviceName = process.env.SERVICE_NAME || 'task-management-api';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
  const sampleRate = parseFloat(process.env.TRACING_SAMPLE_RATE || '0.1'); // 10% sampling
  const exporterType = process.env.TRACING_EXPORTER || 'jaeger';

  // Configure trace exporter
  let traceExporter;
  switch (exporterType) {
    case 'jaeger':
      traceExporter = new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      });
      console.log(`Tracing exporter: Jaeger (${process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'})`);
      break;

    case 'console':
      // Console exporter for debugging
      const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
      traceExporter = new ConsoleSpanExporter();
      console.log('Tracing exporter: Console (development mode)');
      break;

    case 'xray':
      // AWS X-Ray exporter (production)
      const { AWSXRayPropagator } = require('@opentelemetry/propagator-aws-xray');
      const { AwsInstrumentation } = require('@opentelemetry/instrumentation-aws-sdk');
      // Note: Requires @opentelemetry/exporter-trace-otlp-grpc and AWS X-Ray daemon
      console.warn('AWS X-Ray exporter not yet implemented - falling back to Jaeger');
      traceExporter = new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      });
      break;

    default:
      console.warn(`Unknown TRACING_EXPORTER: ${exporterType} - falling back to Jaeger`);
      traceExporter = new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      });
  }

  // Configure resource attributes (service metadata)
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  });

  // Configure sampling strategy
  // ParentBasedSampler: If parent span is sampled, child is sampled
  // TraceIdRatioBasedSampler: Sample X% of root spans
  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(sampleRate),
  });

  // Initialize OpenTelemetry SDK
  otelSDK = new NodeSDK({
    resource,
    traceExporter,
    sampler,
    // Trace context propagation (W3C standard)
    textMapPropagator: new W3CTraceContextPropagator(),
    // Auto-instrumentation for common libraries
    instrumentations: [
      getNodeAutoInstrumentations({
        // HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          // Ignore health check endpoints
          ignoreIncomingPaths: ['/health', '/ready', '/metrics'],
        },
        // PostgreSQL instrumentation
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
          // Enhance with SQL parameters (be careful with PII)
          enhancedDatabaseReporting: false, // Set to true only in development
        },
        // Redis instrumentation
        '@opentelemetry/instrumentation-redis-4': {
          enabled: true,
        },
        // Express instrumentation
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        // DNS, Net, FS (disable if too noisy)
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-net': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  console.log(`OpenTelemetry initialized: ${serviceName} v${serviceVersion} (sampling: ${sampleRate * 100}%)`);

  return otelSDK;
}

/**
 * Start OpenTelemetry SDK
 *
 * Starts the SDK and begins collecting traces.
 * Must be called BEFORE any instrumented libraries are loaded.
 */
export async function startTracing(): Promise<void> {
  if (!otelSDK) {
    otelSDK = initializeTracing();
  }

  if (otelSDK) {
    try {
      await otelSDK.start();
      console.log('OpenTelemetry SDK started successfully');
    } catch (error) {
      console.error('Failed to start OpenTelemetry SDK:', error);
    }
  }
}

/**
 * Stop OpenTelemetry SDK
 *
 * Gracefully shuts down the SDK, flushing any pending spans.
 * Should be called during application shutdown.
 */
export async function stopTracing(): Promise<void> {
  if (otelSDK) {
    try {
      await otelSDK.shutdown();
      console.log('OpenTelemetry SDK shut down successfully');
    } catch (error) {
      console.error('Failed to shut down OpenTelemetry SDK:', error);
    }
  }
}

/**
 * Get OpenTelemetry SDK instance
 *
 * @returns NodeSDK instance or null if not initialized
 */
export function getTracingSDK(): NodeSDK | null {
  return otelSDK;
}
