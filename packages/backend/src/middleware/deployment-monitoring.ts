/**
 * 📊 Deployment Monitoring Middleware
 *
 * Tracks deployment health metrics and error rates to support
 * automated rollback decisions.
 *
 * Metrics Tracked:
 * - HTTP error rates (4xx, 5xx)
 * - Response times (P50, P95, P99)
 * - Request throughput
 * - Active connections
 * - Memory usage trends
 *
 * @module deployment-monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

interface RequestMetrics {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  memoryUsed: number;
}

interface AggregatedMetrics {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  responseTimes: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  statusCodes: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  };
  lastUpdated: string;
}

class DeploymentMonitor {
  private metrics: RequestMetrics[] = [];
  private readonly maxMetricsSize = 1000;
  private readonly aggregationInterval = 60000; // 1 minute
  private aggregatedMetrics: AggregatedMetrics;

  constructor() {
    this.aggregatedMetrics = this.getEmptyMetrics();
    // Only start aggregation in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      this.startAggregation();
    }
  }

  private getEmptyMetrics(): AggregatedMetrics {
    return {
      totalRequests: 0,
      errorCount: 0,
      errorRate: 0,
      responseTimes: {
        p50: 0,
        p95: 0,
        p99: 0,
        avg: 0,
      },
      statusCodes: {
        '2xx': 0,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Record a request metric
   */
  recordRequest(metric: RequestMetrics): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics = this.metrics.slice(-this.maxMetricsSize);
    }
  }

  /**
   * Get current error rate (percentage)
   */
  getErrorRate(): number {
    return this.aggregatedMetrics.errorRate;
  }

  /**
   * Get P95 response time
   */
  getP95ResponseTime(): number {
    return this.aggregatedMetrics.responseTimes.p95;
  }

  /**
   * Get P99 response time
   */
  getP99ResponseTime(): number {
    return this.aggregatedMetrics.responseTimes.p99;
  }

  /**
   * Get all aggregated metrics
   */
  getMetrics(): AggregatedMetrics {
    return { ...this.aggregatedMetrics };
  }

  /**
   * Check if deployment is healthy based on SLO thresholds
   */
  isHealthy(): {
    healthy: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let healthy = true;

    // Error rate threshold: 5%
    if (this.aggregatedMetrics.errorRate > 5) {
      healthy = false;
      reasons.push(`Error rate too high: ${this.aggregatedMetrics.errorRate.toFixed(2)}%`);
    }

    // P95 response time threshold: 1000ms
    if (this.aggregatedMetrics.responseTimes.p95 > 1000) {
      healthy = false;
      reasons.push(
        `P95 response time too high: ${this.aggregatedMetrics.responseTimes.p95.toFixed(0)}ms`
      );
    }

    // P99 response time threshold: 2000ms
    if (this.aggregatedMetrics.responseTimes.p99 > 2000) {
      healthy = false;
      reasons.push(
        `P99 response time too high: ${this.aggregatedMetrics.responseTimes.p99.toFixed(0)}ms`
      );
    }

    // 5xx error threshold: >10% of total requests
    const serverErrorRate =
      (this.aggregatedMetrics.statusCodes['5xx'] / this.aggregatedMetrics.totalRequests) * 100;
    if (serverErrorRate > 10) {
      healthy = false;
      reasons.push(`Server error rate too high: ${serverErrorRate.toFixed(2)}%`);
    }

    return { healthy, reasons };
  }

  /**
   * Aggregate metrics from raw data
   */
  private aggregateMetrics(): void {
    if (this.metrics.length === 0) {
      return;
    }

    const now = Date.now();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const recentMetrics = this.metrics.filter((m) => now - m.timestamp < timeWindow);

    if (recentMetrics.length === 0) {
      return;
    }

    // Calculate total requests and errors
    const totalRequests = recentMetrics.length;
    const errorCount = recentMetrics.filter((m) => m.statusCode >= 400).length;
    const errorRate = (errorCount / totalRequests) * 100;

    // Calculate response time percentiles
    const sortedDurations = recentMetrics.map((m) => m.duration).sort((a, b) => a - b);
    const p50Index = Math.floor(sortedDurations.length * 0.5);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p99Index = Math.floor(sortedDurations.length * 0.99);

    const responseTimes = {
      p50: sortedDurations[p50Index] || 0,
      p95: sortedDurations[p95Index] || 0,
      p99: sortedDurations[p99Index] || 0,
      avg:
        sortedDurations.reduce((sum, d) => sum + d, 0) / sortedDurations.length || 0,
    };

    // Count status codes
    const statusCodes = {
      '2xx': recentMetrics.filter((m) => m.statusCode >= 200 && m.statusCode < 300).length,
      '3xx': recentMetrics.filter((m) => m.statusCode >= 300 && m.statusCode < 400).length,
      '4xx': recentMetrics.filter((m) => m.statusCode >= 400 && m.statusCode < 500).length,
      '5xx': recentMetrics.filter((m) => m.statusCode >= 500).length,
    };

    this.aggregatedMetrics = {
      totalRequests,
      errorCount,
      errorRate,
      responseTimes,
      statusCodes,
      lastUpdated: new Date().toISOString(),
    };

    // Log health status
    const health = this.isHealthy();
    if (!health.healthy) {
      console.warn('🚨 Deployment health check failed:', health.reasons);
    }
  }

  /**
   * Start periodic aggregation
   */
  private startAggregation(): void {
    setInterval(() => {
      this.aggregateMetrics();
    }, this.aggregationInterval);
  }

  /**
   * Force metric aggregation (for testing)
   */
  forceAggregation(): void {
    this.aggregateMetrics();
  }

  /**
   * Reset metrics (used for testing)
   */
  reset(): void {
    this.metrics = [];
    this.aggregatedMetrics = this.getEmptyMetrics();
  }
}

// Singleton instance
const monitor = new DeploymentMonitor();

/**
 * Express middleware to track request metrics
 */
export function deploymentMonitoring(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    const duration = Date.now() - startTime;
    const memoryUsed = process.memoryUsage().heapUsed - startMemory;

    // Record metrics
    monitor.recordRequest({
      timestamp: startTime,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      memoryUsed,
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Health check endpoint handler
 */
export function getDeploymentHealth(req: Request, res: Response): void {
  const metrics = monitor.getMetrics();
  const health = monitor.isHealthy();

  const statusCode = health.healthy ? 200 : 503;

  res.status(statusCode).json({
    status: health.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    metrics: {
      errorRate: metrics.errorRate.toFixed(2) + '%',
      totalRequests: metrics.totalRequests,
      errorCount: metrics.errorCount,
      responseTimes: {
        p50: Math.round(metrics.responseTimes.p50) + 'ms',
        p95: Math.round(metrics.responseTimes.p95) + 'ms',
        p99: Math.round(metrics.responseTimes.p99) + 'ms',
        avg: Math.round(metrics.responseTimes.avg) + 'ms',
      },
      statusCodes: metrics.statusCodes,
      lastUpdated: metrics.lastUpdated,
    },
    health: {
      healthy: health.healthy,
      issues: health.reasons,
    },
  });
}

/**
 * Prometheus-style metrics endpoint
 */
export function getPrometheusMetrics(req: Request, res: Response): void {
  const metrics = monitor.getMetrics();

  const prometheusFormat = `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.totalRequests}

# HELP http_requests_errors_total Total number of HTTP errors (4xx + 5xx)
# TYPE http_requests_errors_total counter
http_requests_errors_total ${metrics.errorCount}

# HELP http_request_error_rate Error rate percentage
# TYPE http_request_error_rate gauge
http_request_error_rate ${metrics.errorRate}

# HELP http_request_duration_p50_milliseconds P50 response time in milliseconds
# TYPE http_request_duration_p50_milliseconds gauge
http_request_duration_p50_milliseconds ${metrics.responseTimes.p50}

# HELP http_request_duration_p95_milliseconds P95 response time in milliseconds
# TYPE http_request_duration_p95_milliseconds gauge
http_request_duration_p95_milliseconds ${metrics.responseTimes.p95}

# HELP http_request_duration_p99_milliseconds P99 response time in milliseconds
# TYPE http_request_duration_p99_milliseconds gauge
http_request_duration_p99_milliseconds ${metrics.responseTimes.p99}

# HELP http_requests_by_status Total requests by status code range
# TYPE http_requests_by_status counter
http_requests_by_status{code="2xx"} ${metrics.statusCodes['2xx']}
http_requests_by_status{code="3xx"} ${metrics.statusCodes['3xx']}
http_requests_by_status{code="4xx"} ${metrics.statusCodes['4xx']}
http_requests_by_status{code="5xx"} ${metrics.statusCodes['5xx']}
  `.trim();

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(prometheusFormat);
}

/**
 * Trigger rollback if health checks fail
 */
export async function checkAndTriggerRollback(): Promise<void> {
  const health = monitor.isHealthy();

  if (!health.healthy) {
    console.error('🚨 DEPLOYMENT UNHEALTHY - TRIGGERING ROLLBACK 🚨');
    console.error('Reasons:', health.reasons);

    // Send alert to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: '🚨 AUTOMATIC ROLLBACK TRIGGERED 🚨',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Deployment Health Check Failed*\n\nReasons:\n${health.reasons.map((r) => `• ${r}`).join('\n')}`,
                },
              },
            ],
          }),
        });
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }

    // Trigger GitHub Actions rollback workflow
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
      try {
        const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
        await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/workflows/automated-rollback.yml/dispatches`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ref: 'main',
              inputs: {
                environment: process.env.NODE_ENV === 'production' ? 'production' : 'staging',
                reason: `Automatic rollback: ${health.reasons.join(', ')}`,
                skip_verification: 'false',
              },
            }),
          }
        );

        console.log('✅ Rollback workflow triggered via GitHub Actions');
      } catch (error) {
        console.error('Failed to trigger rollback workflow:', error);
      }
    }
  }
}

// Export monitor instance for testing
export { monitor as deploymentMonitor };
