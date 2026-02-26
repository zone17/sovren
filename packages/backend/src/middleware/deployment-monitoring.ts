/**
 * Deployment Monitoring Middleware
 *
 * Real Prometheus metrics via prom-client for production observability.
 *
 * Metrics Tracked:
 * - HTTP request counters (by method, route, status code)
 * - Request duration histograms (P50, P95, P99 via bucket boundaries)
 * - Active connections gauge
 * - Node.js process metrics (memory, CPU, event loop lag)
 *
 * @module deployment-monitoring
 */

import { Request, Response, NextFunction } from 'express';
import client, { Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from '../lib/logger';

// Use the global default registry
const register = client.register;

// Collect default Node.js metrics (memory, CPU, event loop lag, GC, etc.)
let metricsInitialized = false;
export function initMetrics(): void {
  if (metricsInitialized) return;
  collectDefaultMetrics({ register, prefix: 'sovren_' });
  metricsInitialized = true;
}

// Auto-initialize on import for backward compatibility
initMetrics();

// --- HTTP Request Metrics ---

const httpRequestsTotal = new Counter({
  name: 'sovren_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'sovren_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpActiveConnections = new Gauge({
  name: 'sovren_http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

// --- Business Metrics ---

const httpRequestErrors = new Counter({
  name: 'sovren_http_request_errors_total',
  help: 'Total HTTP errors (4xx + 5xx)',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

// --- Database Metrics ---
// TODO: Wire into Supabase/Redis when instrumentation layer exists

export const dbQueryDuration = new Histogram({
  name: 'sovren_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

// TODO: Wire into Supabase when instrumentation layer exists
export const dbConnectionsActive = new Gauge({
  name: 'sovren_db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

// --- Cache Metrics ---
// TODO: Wire into Redis when instrumentation layer exists

export const cacheOperations = new Counter({
  name: 'sovren_cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'result'] as const,
  registers: [register],
});

// --- Queue Metrics (BullMQ) ---

export const queueJobsTotal = new Counter({
  name: 'sovren_queue_jobs_total',
  help: 'Total queue jobs processed',
  labelNames: ['queue', 'status'] as const,
  registers: [register],
});

export const queueJobDuration = new Histogram({
  name: 'sovren_queue_job_duration_seconds',
  help: 'Queue job processing duration in seconds',
  labelNames: ['queue'] as const,
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

export const queueDepth = new Gauge({
  name: 'sovren_queue_depth',
  help: 'Current queue depth (waiting jobs)',
  labelNames: ['queue'] as const,
  registers: [register],
});

/**
 * Normalize route paths to avoid high-cardinality labels.
 * Replaces dynamic segments (UUIDs, hex strings, numeric IDs) with placeholders.
 */
function normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/[0-9a-f]{64}/gi, '/:pubkey')
    .replace(/\/\d+/g, '/:id');
}

/**
 * Express middleware to track request metrics via prom-client.
 */
export function deploymentMonitoring(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics endpoint to avoid recursion
  if (req.path === '/metrics') {
    next();
    return;
  }

  const end = httpRequestDuration.startTimer();

  httpActiveConnections.inc();

  res.on('finish', () => {
    const route = req.route?.path
      ? normalizeRoute(req.route.path)
      : '/unmatched';
    const statusCode = res.statusCode.toString();
    const labels = { method: req.method, route, status_code: statusCode };

    end(labels);
    httpRequestsTotal.inc(labels);
    httpActiveConnections.dec();

    if (res.statusCode >= 400) {
      httpRequestErrors.inc(labels);
    }
  });

  next();
}


/**
 * Prometheus metrics endpoint handler.
 * Returns metrics in the standard Prometheus exposition format.
 */
export async function getPrometheusMetrics(req: Request, res: Response): Promise<void> {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Error collecting Prometheus metrics', { error });
    res.status(500).end('Error collecting metrics');
  }
}


/**
 * Returns all Prometheus metrics as a structured JSON object.
 * Designed for agent/bot consumption — avoids text-format parsing.
 */
export async function getJsonMetrics(): Promise<Record<string, unknown>> {
  const metricsJson = await register.getMetricsAsJSON();

  const result: Record<string, unknown> = {};
  for (const metric of metricsJson) {
    result[metric.name] = {
      help: metric.help,
      type: metric.type,
      values: metric.values,
    };
  }

  return result;
}

// Export the registry for use in tests
export { register as metricsRegistry };
