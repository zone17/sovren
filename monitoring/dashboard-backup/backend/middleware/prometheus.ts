/**
 * Prometheus Metrics Middleware
 *
 * Express middleware for exposing payment metrics in Prometheus format.
 * Provides automatic metric collection and /metrics endpoint.
 *
 * Metrics exposed:
 * - payment_total (counter) - Total number of payments
 * - payment_success_total (counter) - Total successful payments
 * - payment_failure_total (counter) - Total failed payments
 * - payment_volume_sats_total (counter) - Total payment volume in sats
 * - payment_success_rate (gauge) - Current success rate (0.0 to 1.0)
 * - payment_amount_sats (histogram) - Payment amount distribution
 * - payment_duration_ms (histogram) - Payment duration distribution
 * - active_payments_count (gauge) - Currently active payments
 */

import { Request, Response, NextFunction } from 'express';
import { PrometheusMetrics } from '../types/payment-analytics';

/**
 * Prometheus metric formatter
 */
export class PrometheusFormatter {
  /**
   * Format metrics in Prometheus exposition format
   */
  static formatMetrics(metrics: PrometheusMetrics): string {
    const lines: string[] = [];

    // Header
    lines.push('# Sovren Payment Metrics');
    lines.push(`# Scraped at ${metrics.timestamp.toISOString()}`);
    lines.push('');

    // Payment total counter
    lines.push('# HELP payment_total Total number of payments processed');
    lines.push('# TYPE payment_total counter');
    lines.push(`payment_total ${metrics.payment_total}`);
    lines.push('');

    // Success counter
    lines.push('# HELP payment_success_total Total number of successful payments');
    lines.push('# TYPE payment_success_total counter');
    lines.push(`payment_success_total ${metrics.payment_success_total}`);
    lines.push('');

    // Failure counter
    lines.push('# HELP payment_failure_total Total number of failed payments');
    lines.push('# TYPE payment_failure_total counter');
    lines.push(`payment_failure_total ${metrics.payment_failure_total}`);
    lines.push('');

    // Volume counter
    lines.push('# HELP payment_volume_sats_total Total payment volume in satoshis');
    lines.push('# TYPE payment_volume_sats_total counter');
    lines.push(`payment_volume_sats_total ${metrics.payment_volume_sats_total}`);
    lines.push('');

    // Success rate gauge
    lines.push('# HELP payment_success_rate Current payment success rate (0.0 to 1.0)');
    lines.push('# TYPE payment_success_rate gauge');
    lines.push(`payment_success_rate ${metrics.payment_success_rate.toFixed(4)}`);
    lines.push('');

    // Active payments gauge
    lines.push('# HELP active_payments_count Number of currently active payments');
    lines.push('# TYPE active_payments_count gauge');
    lines.push(`active_payments_count ${metrics.active_payments_count}`);
    lines.push('');

    // Payment amount histogram
    lines.push('# HELP payment_amount_sats Payment amount distribution in satoshis');
    lines.push('# TYPE payment_amount_sats histogram');
    for (const [bucket, count] of Object.entries(metrics.payment_amount_sats_bucket)) {
      const le = bucket === '+Inf' ? '+Inf' : bucket;
      lines.push(`payment_amount_sats_bucket{le="${le}"} ${count}`);
    }
    lines.push(`payment_amount_sats_count ${metrics.payment_total}`);
    lines.push(`payment_amount_sats_sum ${metrics.payment_volume_sats_total}`);
    lines.push('');

    // Payment duration histogram
    lines.push('# HELP payment_duration_ms Payment processing duration in milliseconds');
    lines.push('# TYPE payment_duration_ms histogram');
    for (const [bucket, count] of Object.entries(metrics.payment_duration_ms_bucket)) {
      const le = bucket === '+Inf' ? '+Inf' : bucket;
      lines.push(`payment_duration_ms_bucket{le="${le}"} ${count}`);
    }
    const totalDurations = Object.values(metrics.payment_duration_ms_bucket)[0] || 0;
    lines.push(`payment_duration_ms_count ${totalDurations}`);
    lines.push('');

    // Scrape metadata
    lines.push('# HELP scrape_duration_ms Time taken to generate metrics');
    lines.push('# TYPE scrape_duration_ms gauge');
    lines.push(`scrape_duration_ms ${metrics.scrape_duration_ms}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format metrics summary for dashboard
   */
  static formatSummary(metrics: PrometheusMetrics): string {
    return `
Payment Metrics Summary
=======================
Total Payments: ${metrics.payment_total}
Successful: ${metrics.payment_success_total} (${(metrics.payment_success_rate * 100).toFixed(2)}%)
Failed: ${metrics.payment_failure_total}
Total Volume: ${metrics.payment_volume_sats_total.toLocaleString()} sats
Active Payments: ${metrics.active_payments_count}

Scraped at: ${metrics.timestamp.toISOString()}
Scrape Duration: ${metrics.scrape_duration_ms}ms
    `.trim();
  }
}

/**
 * Express middleware for Prometheus metrics endpoint
 */
export function prometheusMetricsMiddleware(
  getMetrics: () => Promise<PrometheusMetrics> | PrometheusMetrics
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = await getMetrics();

      // Set Prometheus content type
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');

      // Format and send metrics
      const formattedMetrics = PrometheusFormatter.formatMetrics(metrics);
      res.send(formattedMetrics);
    } catch (error) {
      console.error('Error generating Prometheus metrics:', error);
      res.status(500).send('# Error generating metrics\n');
    }
  };
}

/**
 * Middleware to track HTTP request metrics
 */
export class HttpMetricsCollector {
  private requestCount = 0;
  private requestDurations: number[] = [];
  private statusCodes: Record<string, number> = {};

  /**
   * Express middleware to track request metrics
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Track response
      res.on('finish', () => {
        const duration = Date.now() - startTime;

        this.requestCount++;
        this.requestDurations.push(duration);

        const statusCode = res.statusCode.toString();
        this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;

        // Keep only last 1000 durations
        if (this.requestDurations.length > 1000) {
          this.requestDurations.shift();
        }
      });

      next();
    };
  }

  /**
   * Get HTTP metrics in Prometheus format
   */
  getMetrics(): string {
    const lines: string[] = [];

    // Request counter
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${this.requestCount}`);
    lines.push('');

    // Status code counters
    lines.push('# HELP http_requests_by_status HTTP requests by status code');
    lines.push('# TYPE http_requests_by_status counter');
    for (const [code, count] of Object.entries(this.statusCodes)) {
      lines.push(`http_requests_by_status{code="${code}"} ${count}`);
    }
    lines.push('');

    // Duration histogram
    if (this.requestDurations.length > 0) {
      const sorted = [...this.requestDurations].sort((a, b) => a - b);
      const p50 = this.percentile(sorted, 50);
      const p95 = this.percentile(sorted, 95);
      const p99 = this.percentile(sorted, 99);
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;

      lines.push('# HELP http_request_duration_ms HTTP request duration');
      lines.push('# TYPE http_request_duration_ms summary');
      lines.push(`http_request_duration_ms{quantile="0.5"} ${p50.toFixed(2)}`);
      lines.push(`http_request_duration_ms{quantile="0.95"} ${p95.toFixed(2)}`);
      lines.push(`http_request_duration_ms{quantile="0.99"} ${p99.toFixed(2)}`);
      lines.push(`http_request_duration_ms_sum ${sorted.reduce((a, b) => a + b, 0)}`);
      lines.push(`http_request_duration_ms_count ${sorted.length}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private percentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.requestCount = 0;
    this.requestDurations = [];
    this.statusCodes = {};
  }
}
