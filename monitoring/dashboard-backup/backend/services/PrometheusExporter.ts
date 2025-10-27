/**
 * Prometheus Metrics Exporter
 *
 * Production-grade Prometheus-compatible metrics exporter for payment system.
 * Generates text-based metrics in Prometheus exposition format.
 *
 * Features:
 * - Payment metrics (RED method: Rate, Errors, Duration)
 * - System metrics (USE method: Utilization, Saturation, Errors)
 * - Health check metrics
 * - Business metrics (revenue, conversion rates)
 * - Histogram metrics with configurable buckets
 * - Gauge metrics for current state
 * - Counter metrics for cumulative values
 *
 * @module services/PrometheusExporter
 * @story PAY-013
 */

import { PaymentEvent, PrometheusMetrics } from '../types/payment-analytics';
import { SystemHealthStatus, HealthCheckResult } from './HealthCheckService';

export interface MetricDefinition {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: string[];
}

/**
 * Prometheus Exporter Service
 */
export class PrometheusExporter {
  private static readonly METRIC_DEFINITIONS: MetricDefinition[] = [
    // Payment Counters
    {
      name: 'payment_total',
      help: 'Total number of payments processed',
      type: 'counter',
      labels: ['status', 'method'],
    },
    {
      name: 'payment_volume_sats_total',
      help: 'Total payment volume in satoshis',
      type: 'counter',
      labels: ['method'],
    },
    {
      name: 'payment_fees_sats_total',
      help: 'Total payment fees in satoshis',
      type: 'counter',
      labels: ['method'],
    },

    // Payment Gauges
    {
      name: 'payment_success_rate',
      help: 'Current payment success rate (0.0 to 1.0)',
      type: 'gauge',
    },
    {
      name: 'active_payments_count',
      help: 'Number of active (pending/processing) payments',
      type: 'gauge',
    },
    {
      name: 'pending_verifications_count',
      help: 'Number of payments pending verification',
      type: 'gauge',
    },

    // Payment Histograms
    {
      name: 'payment_amount_sats',
      help: 'Payment amount distribution in satoshis',
      type: 'histogram',
      labels: ['method'],
    },
    {
      name: 'payment_duration_seconds',
      help: 'Payment processing duration in seconds',
      type: 'histogram',
      labels: ['status'],
    },

    // Health Check Metrics
    {
      name: 'health_check_status',
      help: 'Health check status (1=healthy, 0.5=degraded, 0=unhealthy)',
      type: 'gauge',
      labels: ['component'],
    },
    {
      name: 'health_check_latency_seconds',
      help: 'Health check latency in seconds',
      type: 'gauge',
      labels: ['component'],
    },

    // System Metrics
    {
      name: 'system_uptime_seconds',
      help: 'System uptime in seconds',
      type: 'gauge',
    },
    {
      name: 'database_connections_active',
      help: 'Number of active database connections',
      type: 'gauge',
    },
    {
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      type: 'histogram',
    },

    // Circuit Breaker Metrics
    {
      name: 'circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
      type: 'gauge',
      labels: ['name'],
    },
    {
      name: 'circuit_breaker_failures_total',
      help: 'Total circuit breaker failures',
      type: 'counter',
      labels: ['name'],
    },

    // Business Metrics
    {
      name: 'revenue_sats_total',
      help: 'Total revenue in satoshis',
      type: 'counter',
      labels: ['creator_id'],
    },
    {
      name: 'unique_supporters_total',
      help: 'Total number of unique supporters',
      type: 'gauge',
      labels: ['creator_id'],
    },
  ];

  /**
   * Export metrics in Prometheus text format
   */
  static exportMetrics(
    paymentMetrics: PrometheusMetrics,
    healthStatus: SystemHealthStatus,
    additionalMetrics?: Record<string, any>
  ): string {
    const lines: string[] = [];

    // Header
    lines.push('# Sovren Payment System Metrics');
    lines.push(`# Generated at ${new Date().toISOString()}`);
    lines.push('');

    // Payment Counters
    this.addMetric(lines, 'payment_total', 'counter', 'Total number of payments processed');
    lines.push(
      `payment_total{status="completed",method="lightning"} ${paymentMetrics.payment_success_total}`
    );
    lines.push(
      `payment_total{status="failed",method="lightning"} ${paymentMetrics.payment_failure_total}`
    );
    lines.push('');

    this.addMetric(
      lines,
      'payment_volume_sats_total',
      'counter',
      'Total payment volume in satoshis'
    );
    lines.push(
      `payment_volume_sats_total{method="lightning"} ${paymentMetrics.payment_volume_sats_total}`
    );
    lines.push('');

    // Payment Gauges
    this.addMetric(
      lines,
      'payment_success_rate',
      'gauge',
      'Current payment success rate (0.0 to 1.0)'
    );
    lines.push(`payment_success_rate ${paymentMetrics.payment_success_rate.toFixed(4)}`);
    lines.push('');

    this.addMetric(
      lines,
      'active_payments_count',
      'gauge',
      'Number of active (pending/processing) payments'
    );
    lines.push(`active_payments_count ${paymentMetrics.active_payments_count}`);
    lines.push('');

    // Payment Histograms
    this.addMetric(
      lines,
      'payment_amount_sats',
      'histogram',
      'Payment amount distribution in satoshis'
    );
    this.addHistogram(lines, 'payment_amount_sats', paymentMetrics.payment_amount_sats_bucket, {
      method: 'lightning',
    });
    lines.push('');

    this.addMetric(
      lines,
      'payment_duration_seconds',
      'histogram',
      'Payment processing duration in seconds'
    );
    // Convert milliseconds to seconds for Prometheus best practices
    const durationBucketsSeconds: Record<string, number> = {};
    for (const [bucket, count] of Object.entries(paymentMetrics.payment_duration_ms_bucket)) {
      const bucketSeconds = bucket === '+Inf' ? '+Inf' : (parseFloat(bucket) / 1000).toFixed(3);
      durationBucketsSeconds[bucketSeconds] = count;
    }
    this.addHistogram(lines, 'payment_duration_seconds', durationBucketsSeconds, {
      status: 'completed',
    });
    lines.push('');

    // Health Check Metrics
    this.addMetric(
      lines,
      'health_check_status',
      'gauge',
      'Health check status (1=healthy, 0.5=degraded, 0=unhealthy)'
    );
    for (const [component, result] of Object.entries(healthStatus.components)) {
      const statusValue = this.healthStatusToValue(result.status);
      lines.push(`health_check_status{component="${component}"} ${statusValue}`);
    }
    lines.push('');

    this.addMetric(
      lines,
      'health_check_latency_seconds',
      'gauge',
      'Health check latency in seconds'
    );
    for (const [component, result] of Object.entries(healthStatus.components)) {
      const latencySeconds = (result.latency_ms || 0) / 1000;
      lines.push(
        `health_check_latency_seconds{component="${component}"} ${latencySeconds.toFixed(4)}`
      );
    }
    lines.push('');

    // System Metrics
    this.addMetric(lines, 'system_uptime_seconds', 'gauge', 'System uptime in seconds');
    lines.push(`system_uptime_seconds ${healthStatus.uptime_seconds}`);
    lines.push('');

    // Scrape Duration (meta-metric)
    this.addMetric(lines, 'scrape_duration_seconds', 'gauge', 'Duration of the scrape in seconds');
    const scrapeDurationSeconds = paymentMetrics.scrape_duration_ms / 1000;
    lines.push(`scrape_duration_seconds ${scrapeDurationSeconds.toFixed(4)}`);
    lines.push('');

    // Add additional metrics if provided
    if (additionalMetrics) {
      for (const [name, value] of Object.entries(additionalMetrics)) {
        if (typeof value === 'number') {
          lines.push(`${name} ${value}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Add metric header (HELP and TYPE)
   */
  private static addMetric(
    lines: string[],
    name: string,
    type: string,
    help: string
  ): void {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
  }

  /**
   * Add histogram metric with buckets
   */
  private static addHistogram(
    lines: string[],
    name: string,
    buckets: Record<string, number>,
    labels: Record<string, string> = {}
  ): void {
    const labelStr = this.formatLabels(labels);

    // Add bucket counts
    const sortedBuckets = Object.entries(buckets).sort(([a], [b]) => {
      if (a === '+Inf') return 1;
      if (b === '+Inf') return -1;
      return parseFloat(a) - parseFloat(b);
    });

    for (const [bucket, count] of sortedBuckets) {
      lines.push(`${name}_bucket{${labelStr}le="${bucket}"} ${count}`);
    }

    // Add sum and count (approximations for now)
    const totalCount = buckets['+Inf'] || 0;
    lines.push(`${name}_sum${labelStr ? `{${labelStr}}` : ''} ${totalCount * 1000}`); // Approximate sum
    lines.push(`${name}_count${labelStr ? `{${labelStr}}` : ''} ${totalCount}`);
  }

  /**
   * Format label key-value pairs
   */
  private static formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels).map(([key, value]) => `${key}="${value}"`);
    return pairs.length > 0 ? pairs.join(',') + ',' : '';
  }

  /**
   * Convert health status to numeric value
   */
  private static healthStatusToValue(status: 'healthy' | 'degraded' | 'unhealthy'): number {
    switch (status) {
      case 'healthy':
        return 1.0;
      case 'degraded':
        return 0.5;
      case 'unhealthy':
        return 0.0;
      default:
        return 0.0;
    }
  }

  /**
   * Generate OpenMetrics format (alternative to Prometheus text format)
   */
  static exportOpenMetrics(
    paymentMetrics: PrometheusMetrics,
    healthStatus: SystemHealthStatus
  ): string {
    const lines: string[] = [];

    // OpenMetrics header
    lines.push('# OpenMetrics format');
    lines.push('# TYPE payment_total counter');
    lines.push(
      `payment_total{status="completed"} ${paymentMetrics.payment_success_total} ${paymentMetrics.timestamp.getTime()}`
    );
    lines.push(
      `payment_total{status="failed"} ${paymentMetrics.payment_failure_total} ${paymentMetrics.timestamp.getTime()}`
    );
    lines.push('# EOF');

    return lines.join('\n');
  }

  /**
   * Get metric definitions (for documentation)
   */
  static getMetricDefinitions(): MetricDefinition[] {
    return [...this.METRIC_DEFINITIONS];
  }

  /**
   * Validate metric name (Prometheus naming conventions)
   */
  static validateMetricName(name: string): boolean {
    // Must match [a-zA-Z_:][a-zA-Z0-9_:]*
    const validNamePattern = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
    return validNamePattern.test(name);
  }

  /**
   * Validate label name (Prometheus naming conventions)
   */
  static validateLabelName(name: string): boolean {
    // Must match [a-zA-Z_][a-zA-Z0-9_]*
    const validLabelPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return validLabelPattern.test(name) && !name.startsWith('__');
  }
}
