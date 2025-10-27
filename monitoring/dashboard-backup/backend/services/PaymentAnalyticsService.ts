/**
 * Payment Analytics Service
 *
 * Production-grade analytics engine for Lightning payment metrics.
 * Provides real-time aggregation, time-series analysis, and anomaly detection.
 *
 * Features:
 * - Accurate metric calculations (no mocks)
 * - Time-series aggregation (hour/day/week/month)
 * - Real-time monitoring with degradation detection
 * - Creator-specific analytics
 * - Prometheus-compatible metrics export
 */

import {
  PaymentEvent,
  PaymentMetricsSummary,
  PaymentTimeSeriesData,
  TimeSeriesDataPoint,
  RealtimeMetrics,
  CreatorAnalytics,
  Alert,
  AlertThresholds,
  PrometheusMetrics,
} from '../types/payment-analytics';

const SATS_PER_BTC = 100_000_000;

/**
 * Calculate success rate as a decimal (0.0 to 1.0)
 */
export function calculateSuccessRate(successful: number, failed: number): number {
  const total = successful + failed;
  if (total === 0) return 0.0;
  return successful / total;
}

/**
 * Calculate percentile value from sorted array
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0] ?? 0;

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  const lowerValue = sortedValues[lower] ?? 0;
  const upperValue = sortedValues[upper] ?? 0;

  return lowerValue * (1 - weight) + upperValue * weight;
}

/**
 * Detect anomalies in payment metrics based on thresholds
 */
export function detectAnomalies(
  metrics: { success_rate: number; total_payments: number; average_duration_ms?: number },
  thresholds: AlertThresholds
): Alert[] {
  const alerts: Alert[] = [];

  // Don't alert if insufficient data
  if (metrics.total_payments < thresholds.min_payments_for_alert) {
    return alerts;
  }

  // Check success rate
  if (metrics.success_rate < thresholds.min_success_rate) {
    alerts.push({
      id: `alert-success-rate-${Date.now()}`,
      severity: 'critical',
      type: 'success_rate',
      message: `Payment success rate (${(metrics.success_rate * 100).toFixed(1)}%) is below threshold (${(thresholds.min_success_rate * 100).toFixed(1)}%)`,
      threshold: thresholds.min_success_rate,
      current_value: metrics.success_rate,
      triggered_at: new Date(),
      metadata: {
        total_payments: metrics.total_payments,
        failure_rate: 1 - metrics.success_rate,
      },
    });
  }

  // Check latency
  if (metrics.average_duration_ms && metrics.average_duration_ms > thresholds.max_average_duration_ms) {
    alerts.push({
      id: `alert-latency-${Date.now()}`,
      severity: 'warning',
      type: 'latency',
      message: `Average payment duration (${metrics.average_duration_ms.toFixed(0)}ms) exceeds threshold (${thresholds.max_average_duration_ms}ms)`,
      threshold: thresholds.max_average_duration_ms,
      current_value: metrics.average_duration_ms,
      triggered_at: new Date(),
      metadata: {
        total_payments: metrics.total_payments,
      },
    });
  }

  return alerts;
}

/**
 * Payment Analytics Service
 */
export class PaymentAnalyticsService {
  private defaultThresholds: AlertThresholds = {
    min_success_rate: 0.95,
    max_failure_rate: 0.05,
    max_average_duration_ms: 30000,
    min_payments_for_alert: 10,
  };

  /**
   * Aggregate payment metrics summary from payment events
   */
  aggregateMetricsSummary(payments: PaymentEvent[]): PaymentMetricsSummary {
    if (payments.length === 0) {
      return this.getEmptyMetricsSummary();
    }

    // Filter completed and failed payments (exclude pending/processing)
    const finalizedPayments = payments.filter((p) =>
      ['completed', 'failed'].includes(p.status)
    );

    const successful = finalizedPayments.filter((p) => p.status === 'completed');
    const failed = finalizedPayments.filter((p) => p.status === 'failed');

    // Calculate amounts
    const amounts = finalizedPayments.map((p) => p.amount_sats);
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const totalVolumeSats = amounts.reduce((sum, amt) => sum + amt, 0);

    // Calculate durations
    const durations = finalizedPayments
      .filter((p) => p.duration_ms !== undefined)
      .map((p) => p.duration_ms!);
    const sortedDurations = [...durations].sort((a, b) => a - b);

    // Payment method distribution
    const methodCounts = finalizedPayments.reduce(
      (acc, p) => {
        acc[p.payment_method] = (acc[p.payment_method] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Time range
    const timestamps = payments.map((p) => p.timestamp.getTime());
    const timeRange = {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    };

    return {
      total_payments: finalizedPayments.length,
      total_volume_sats: totalVolumeSats,
      total_volume_btc: totalVolumeSats / SATS_PER_BTC,

      successful_payments: successful.length,
      failed_payments: failed.length,
      success_rate: calculateSuccessRate(successful.length, failed.length),

      average_payment_sats: totalVolumeSats / finalizedPayments.length,
      median_payment_sats: calculatePercentile(sortedAmounts, 50),
      min_payment_sats: Math.min(...amounts),
      max_payment_sats: Math.max(...amounts),

      average_duration_ms: durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0,
      p95_duration_ms: calculatePercentile(sortedDurations, 95),
      p99_duration_ms: calculatePercentile(sortedDurations, 99),

      payment_methods: {
        lightning: methodCounts['lightning'] || 0,
        webln: methodCounts['webln'] || 0,
      },

      time_range: timeRange,
    };
  }

  /**
   * Aggregate time-series data by interval
   */
  aggregateTimeSeriesData(
    payments: PaymentEvent[],
    interval: 'hour' | 'day' | 'week' | 'month'
  ): PaymentTimeSeriesData {
    if (payments.length === 0) {
      return {
        interval,
        data_points: [],
        summary: this.getEmptyMetricsSummary(),
      };
    }

    // Group payments by time interval
    const grouped = this.groupByInterval(payments, interval);

    // Create data points
    const dataPoints: TimeSeriesDataPoint[] = [];

    for (const [timestamp, intervalPayments] of grouped.entries()) {
      const finalizedPayments = intervalPayments.filter((p) =>
        ['completed', 'failed'].includes(p.status)
      );

      const successful = finalizedPayments.filter((p) => p.status === 'completed');
      const failed = finalizedPayments.filter((p) => p.status === 'failed');
      const totalVolume = finalizedPayments.reduce((sum, p) => sum + p.amount_sats, 0);

      dataPoints.push({
        timestamp: new Date(timestamp),
        payment_count: finalizedPayments.length,
        total_volume_sats: totalVolume,
        success_count: successful.length,
        failure_count: failed.length,
        average_amount_sats: finalizedPayments.length > 0
          ? totalVolume / finalizedPayments.length
          : 0,
        success_rate: calculateSuccessRate(successful.length, failed.length),
      });
    }

    // Sort by timestamp
    dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      interval,
      data_points: dataPoints,
      summary: this.aggregateMetricsSummary(payments),
    };
  }

  /**
   * Get real-time metrics from recent payment events
   */
  async getRealtimeMetrics(recentPayments: PaymentEvent[]): Promise<RealtimeMetrics> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

    // Last minute metrics
    const lastMinutePayments = recentPayments.filter(
      (p) => p.timestamp >= oneMinuteAgo
    );

    const paymentsPerMinute = lastMinutePayments.length;
    const volumePerMinuteSats = lastMinutePayments.reduce(
      (sum, p) => sum + p.amount_sats,
      0
    );

    // Last 5 minutes metrics for degradation detection
    const lastFiveMinutePayments = recentPayments.filter(
      (p) => p.timestamp >= fiveMinutesAgo
    );

    const recentSummary = this.aggregateMetricsSummary(lastFiveMinutePayments);

    // Active payments
    const activePayments = recentPayments.filter(
      (p) => ['pending', 'processing'].includes(p.status)
    ).length;

    // Degradation detection
    const alerts = detectAnomalies(
      {
        success_rate: recentSummary.success_rate,
        total_payments: recentSummary.total_payments,
        average_duration_ms: recentSummary.average_duration_ms,
      },
      this.defaultThresholds
    );

    const isDegraded = alerts.some((a) => a.severity === 'critical');
    const degradationReason = isDegraded
      ? alerts.find((a) => a.severity === 'critical')?.message
      : undefined;

    return {
      timestamp: now,
      payments_per_minute: paymentsPerMinute,
      volume_per_minute_sats: volumePerMinuteSats,
      active_payments: activePayments,
      pending_verifications: activePayments, // Same for now
      recent_success_rate: recentSummary.success_rate,
      recent_average_duration_ms: recentSummary.average_duration_ms,
      is_degraded: isDegraded,
      degradation_reason: degradationReason,
    };
  }

  /**
   * Get creator-specific analytics
   */
  getCreatorAnalytics(creatorId: string, payments: PaymentEvent[]): CreatorAnalytics {
    const creatorPayments = payments.filter(
      (p) => p.creator_id === creatorId && p.status === 'completed'
    );

    if (creatorPayments.length === 0) {
      return {
        creator_id: creatorId,
        total_received_sats: 0,
        payment_count: 0,
        unique_supporters: 0,
        average_payment_sats: 0,
        success_rate: 0,
        first_payment: new Date(),
        last_payment: new Date(),
      };
    }

    const totalReceived = creatorPayments.reduce((sum, p) => sum + p.amount_sats, 0);

    // Count unique supporters
    const uniqueSupporters = new Set(
      creatorPayments.filter((p) => p.user_id).map((p) => p.user_id!)
    );

    // Find top supporter
    const supporterTotals = creatorPayments
      .filter((p) => p.user_id)
      .reduce((acc, p) => {
        acc[p.user_id!] = (acc[p.user_id!] || 0) + p.amount_sats;
        return acc;
      }, {} as Record<string, number>);

    const topSupporter = Object.entries(supporterTotals).sort(
      ([, a], [, b]) => b - a
    )[0];

    // Time range
    const timestamps = creatorPayments.map((p) => p.timestamp.getTime());

    // Success rate for this creator
    const allCreatorPayments = payments.filter((p) => p.creator_id === creatorId);
    const successful = allCreatorPayments.filter((p) => p.status === 'completed');
    const failed = allCreatorPayments.filter((p) => p.status === 'failed');

    return {
      creator_id: creatorId,
      total_received_sats: totalReceived,
      payment_count: creatorPayments.length,
      unique_supporters: uniqueSupporters.size,
      average_payment_sats: totalReceived / creatorPayments.length,
      success_rate: calculateSuccessRate(successful.length, failed.length),
      top_supporter_id: topSupporter ? topSupporter[0] : undefined,
      first_payment: new Date(Math.min(...timestamps)),
      last_payment: new Date(Math.max(...timestamps)),
    };
  }

  /**
   * Generate Prometheus-compatible metrics
   */
  generatePrometheusMetrics(payments: PaymentEvent[]): PrometheusMetrics {
    const startTime = Date.now();
    const summary = this.aggregateMetricsSummary(payments);

    // Amount histogram buckets (in sats): 100, 500, 1k, 5k, 10k, 50k, 100k, 500k, 1M
    const amountBuckets = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
    const amountBucketCounts: Record<string, number> = {};

    for (const bucket of amountBuckets) {
      const count = payments.filter((p) => p.amount_sats <= bucket).length;
      amountBucketCounts[`${bucket}`] = count;
    }
    amountBucketCounts['+Inf'] = payments.length;

    // Duration histogram buckets (in ms): 100, 500, 1s, 5s, 10s, 30s, 60s
    const durationBuckets = [100, 500, 1000, 5000, 10000, 30000, 60000];
    const durationBucketCounts: Record<string, number> = {};

    const paymentsWithDuration = payments.filter((p) => p.duration_ms !== undefined);
    for (const bucket of durationBuckets) {
      const count = paymentsWithDuration.filter((p) => p.duration_ms! <= bucket).length;
      durationBucketCounts[`${bucket}`] = count;
    }
    durationBucketCounts['+Inf'] = paymentsWithDuration.length;

    return {
      payment_total: summary.total_payments,
      payment_success_total: summary.successful_payments,
      payment_failure_total: summary.failed_payments,
      payment_volume_sats_total: summary.total_volume_sats,
      payment_success_rate: summary.success_rate,
      active_payments_count: payments.filter((p) =>
        ['pending', 'processing'].includes(p.status)
      ).length,
      payment_amount_sats_bucket: amountBucketCounts,
      payment_duration_ms_bucket: durationBucketCounts,
      timestamp: new Date(),
      scrape_duration_ms: Date.now() - startTime,
    };
  }

  /**
   * Helper: Group payments by time interval
   */
  private groupByInterval(
    payments: PaymentEvent[],
    interval: 'hour' | 'day' | 'week' | 'month'
  ): Map<number, PaymentEvent[]> {
    const grouped = new Map<number, PaymentEvent[]>();

    for (const payment of payments) {
      const key = this.getIntervalKey(payment.timestamp, interval);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(payment);
    }

    return grouped;
  }

  /**
   * Helper: Get interval key for grouping
   */
  private getIntervalKey(date: Date, interval: 'hour' | 'day' | 'week' | 'month'): number {
    const d = new Date(date);

    switch (interval) {
      case 'hour':
        d.setMinutes(0, 0, 0);
        return d.getTime();
      case 'day':
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      case 'week':
        d.setHours(0, 0, 0, 0);
        const dayOfWeek = d.getDay();
        d.setDate(d.getDate() - dayOfWeek);
        return d.getTime();
      case 'month':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }
  }

  /**
   * Helper: Get empty metrics summary
   */
  private getEmptyMetricsSummary(): PaymentMetricsSummary {
    const now = new Date();
    return {
      total_payments: 0,
      total_volume_sats: 0,
      total_volume_btc: 0,
      successful_payments: 0,
      failed_payments: 0,
      success_rate: 0,
      average_payment_sats: 0,
      median_payment_sats: 0,
      min_payment_sats: 0,
      max_payment_sats: 0,
      average_duration_ms: 0,
      p95_duration_ms: 0,
      p99_duration_ms: 0,
      payment_methods: {
        lightning: 0,
        webln: 0,
      },
      time_range: {
        start: now,
        end: now,
      },
    };
  }
}
