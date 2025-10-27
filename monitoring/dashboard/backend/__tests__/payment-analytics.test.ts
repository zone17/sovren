/**
 * Payment Analytics Service Tests
 *
 * Comprehensive test suite for payment analytics calculations,
 * metrics aggregation, and data accuracy validation.
 *
 * Coverage Target: ≥95%
 */

import {
  PaymentAnalyticsService,
  calculateSuccessRate,
  calculatePercentile,
  aggregateTimeSeriesData,
  detectAnomalies,
} from '../services/PaymentAnalyticsService';
import {
  PaymentEvent,
  PaymentMetricsSummary,
  TimeSeriesDataPoint,
} from '../types/payment-analytics';

describe('PaymentAnalyticsService', () => {
  let analyticsService: PaymentAnalyticsService;

  beforeEach(() => {
    analyticsService = new PaymentAnalyticsService();
  });

  describe('calculateSuccessRate', () => {
    it('should calculate 100% success rate when all payments succeed', () => {
      const successRate = calculateSuccessRate(10, 0);
      expect(successRate).toBe(1.0);
    });

    it('should calculate 0% success rate when all payments fail', () => {
      const successRate = calculateSuccessRate(0, 10);
      expect(successRate).toBe(0.0);
    });

    it('should calculate correct success rate for mixed results', () => {
      const successRate = calculateSuccessRate(95, 5);
      expect(successRate).toBe(0.95);
    });

    it('should return 0 when no payments exist', () => {
      const successRate = calculateSuccessRate(0, 0);
      expect(successRate).toBe(0.0);
    });

    it('should handle edge case with very small success rate', () => {
      const successRate = calculateSuccessRate(1, 999);
      expect(successRate).toBe(0.001);
    });
  });

  describe('calculatePercentile', () => {
    it('should calculate P50 (median) correctly for odd-length array', () => {
      const values = [1, 2, 3, 4, 5];
      const p50 = calculatePercentile(values, 50);
      expect(p50).toBe(3);
    });

    it('should calculate P50 (median) correctly for even-length array', () => {
      const values = [1, 2, 3, 4];
      const p50 = calculatePercentile(values, 50);
      expect(p50).toBe(2.5);
    });

    it('should calculate P95 correctly', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const p95 = calculatePercentile(values, 95);
      expect(p95).toBe(95);
    });

    it('should calculate P99 correctly', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const p99 = calculatePercentile(values, 99);
      expect(p99).toBe(99);
    });

    it('should return 0 for empty array', () => {
      const p50 = calculatePercentile([], 50);
      expect(p50).toBe(0);
    });

    it('should handle single value array', () => {
      const p50 = calculatePercentile([42], 50);
      expect(p50).toBe(42);
    });
  });

  describe('aggregateMetricsSummary', () => {
    const createMockPayments = (): PaymentEvent[] => [
      {
        id: '1',
        timestamp: new Date('2025-10-24T10:00:00Z'),
        amount_sats: 1000,
        payment_method: 'lightning',
        status: 'completed',
        payment_hash: 'hash1',
        creator_id: 'creator1',
        duration_ms: 500,
      },
      {
        id: '2',
        timestamp: new Date('2025-10-24T10:05:00Z'),
        amount_sats: 2000,
        payment_method: 'webln',
        status: 'completed',
        payment_hash: 'hash2',
        creator_id: 'creator1',
        duration_ms: 300,
      },
      {
        id: '3',
        timestamp: new Date('2025-10-24T10:10:00Z'),
        amount_sats: 1500,
        payment_method: 'lightning',
        status: 'failed',
        payment_hash: 'hash3',
        creator_id: 'creator1',
        error_code: 'INSUFFICIENT_FUNDS',
        duration_ms: 100,
      },
    ];

    it('should calculate correct total payment count', () => {
      const payments = createMockPayments();
      const summary = analyticsService.aggregateMetricsSummary(payments);

      expect(summary.total_payments).toBe(3);
    });

    it('should calculate correct success and failure counts', () => {
      const payments = createMockPayments();
      const summary = analyticsService.aggregateMetricsSummary(payments);

      expect(summary.successful_payments).toBe(2);
      expect(summary.failed_payments).toBe(1);
      expect(summary.success_rate).toBeCloseTo(0.667, 2);
    });

    it('should calculate correct total volume', () => {
      const payments = createMockPayments();
      const summary = analyticsService.aggregateMetricsSummary(payments);

      expect(summary.total_volume_sats).toBe(4500); // 1000 + 2000 + 1500
      expect(summary.total_volume_btc).toBeCloseTo(0.000045, 8);
    });

    it('should calculate correct average payment amount', () => {
      const payments = createMockPayments();
      const summary = analyticsService.aggregateMetricsSummary(payments);

      expect(summary.average_payment_sats).toBe(1500); // (1000 + 2000 + 1500) / 3
    });

    it('should calculate correct min and max amounts', () => {
      const payments = createMockPayments();
      const summary = analyticsService.aggregateMetricsSummary(payments);

      expect(summary.min_payment_sats).toBe(1000);
      expect(summary.max_payment_sats).toBe(2000);
    });

    it('should calculate median correctly', () => {
      const payments = createMockPayments();
      const summary = analyticsService.aggregateMetricsSummary(payments);

      expect(summary.median_payment_sats).toBe(1500);
    });

    it('should track payment method distribution', () => {
      const payments = createMockPayments();
      const summary = analyticsService.aggregateMetricsSummary(payments);

      expect(summary.payment_methods.lightning).toBe(2);
      expect(summary.payment_methods.webln).toBe(1);
    });

    it('should calculate performance metrics correctly', () => {
      const payments = createMockPayments();
      const summary = analyticsService.aggregateMetricsSummary(payments);

      expect(summary.average_duration_ms).toBe(300); // (500 + 300 + 100) / 3
      expect(summary.p95_duration_ms).toBeGreaterThanOrEqual(300);
      expect(summary.p99_duration_ms).toBeGreaterThanOrEqual(300);
    });

    it('should handle empty payment array', () => {
      const summary = analyticsService.aggregateMetricsSummary([]);

      expect(summary.total_payments).toBe(0);
      expect(summary.total_volume_sats).toBe(0);
      expect(summary.success_rate).toBe(0);
      expect(summary.average_payment_sats).toBe(0);
    });

    it('should include correct time range', () => {
      const payments = createMockPayments();
      const summary = analyticsService.aggregateMetricsSummary(payments);

      expect(summary.time_range.start).toEqual(new Date('2025-10-24T10:00:00Z'));
      expect(summary.time_range.end).toEqual(new Date('2025-10-24T10:10:00Z'));
    });
  });

  describe('aggregateTimeSeriesData', () => {
    const createTimeSeriesPayments = (): PaymentEvent[] => {
      const payments: PaymentEvent[] = [];
      const baseDate = new Date('2025-10-24T00:00:00Z');

      // Create payments across 3 days
      for (let day = 0; day < 3; day++) {
        for (let i = 0; i < 10; i++) {
          const timestamp = new Date(baseDate);
          timestamp.setDate(baseDate.getDate() + day);
          timestamp.setHours(i);

          payments.push({
            id: `payment-${day}-${i}`,
            timestamp,
            amount_sats: 1000 * (i + 1),
            payment_method: i % 2 === 0 ? 'lightning' : 'webln',
            status: i < 8 ? 'completed' : 'failed', // 80% success rate
            payment_hash: `hash-${day}-${i}`,
            creator_id: 'creator1',
            duration_ms: 100 + i * 50,
          });
        }
      }

      return payments;
    };

    it('should aggregate data by day correctly', () => {
      const payments = createTimeSeriesPayments();
      const timeSeries = analyticsService.aggregateTimeSeriesData(payments, 'day');

      expect(timeSeries.data_points).toHaveLength(3);
      expect(timeSeries.interval).toBe('day');
    });

    it('should calculate correct payment count per interval', () => {
      const payments = createTimeSeriesPayments();
      const timeSeries = analyticsService.aggregateTimeSeriesData(payments, 'day');

      timeSeries.data_points.forEach((point) => {
        expect(point.payment_count).toBe(10);
      });
    });

    it('should calculate correct success rate per interval', () => {
      const payments = createTimeSeriesPayments();
      const timeSeries = analyticsService.aggregateTimeSeriesData(payments, 'day');

      timeSeries.data_points.forEach((point) => {
        expect(point.success_rate).toBe(0.8); // 8 out of 10
      });
    });

    it('should calculate correct volume per interval', () => {
      const payments = createTimeSeriesPayments();
      const timeSeries = analyticsService.aggregateTimeSeriesData(payments, 'day');

      timeSeries.data_points.forEach((point) => {
        // Sum of 1000, 2000, ..., 10000 = 55000
        expect(point.total_volume_sats).toBe(55000);
      });
    });

    it('should aggregate by hour correctly', () => {
      const payments = createTimeSeriesPayments();
      const timeSeries = analyticsService.aggregateTimeSeriesData(payments, 'hour');

      expect(timeSeries.data_points.length).toBeGreaterThan(3);
      expect(timeSeries.interval).toBe('hour');
    });

    it('should handle empty payments array', () => {
      const timeSeries = analyticsService.aggregateTimeSeriesData([], 'day');

      expect(timeSeries.data_points).toHaveLength(0);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect when success rate drops below threshold', () => {
      const recentMetrics = {
        success_rate: 0.85,
        total_payments: 100,
      };

      const alerts = detectAnomalies(recentMetrics, {
        min_success_rate: 0.95,
        max_failure_rate: 0.05,
        max_average_duration_ms: 30000,
        min_payments_for_alert: 10,
      });

      const successRateAlert = alerts.find((a) => a.type === 'success_rate');
      expect(successRateAlert).toBeDefined();
      expect(successRateAlert?.severity).toBe('critical');
    });

    it('should not alert when success rate is above threshold', () => {
      const recentMetrics = {
        success_rate: 0.98,
        total_payments: 100,
      };

      const alerts = detectAnomalies(recentMetrics, {
        min_success_rate: 0.95,
        max_failure_rate: 0.05,
        max_average_duration_ms: 30000,
        min_payments_for_alert: 10,
      });

      const successRateAlert = alerts.find((a) => a.type === 'success_rate');
      expect(successRateAlert).toBeUndefined();
    });

    it('should not alert when payment count is below minimum', () => {
      const recentMetrics = {
        success_rate: 0.5, // Very low, but not enough data
        total_payments: 5,
      };

      const alerts = detectAnomalies(recentMetrics, {
        min_success_rate: 0.95,
        max_failure_rate: 0.05,
        max_average_duration_ms: 30000,
        min_payments_for_alert: 10,
      });

      expect(alerts).toHaveLength(0);
    });

    it('should detect high latency', () => {
      const recentMetrics = {
        success_rate: 0.98,
        total_payments: 100,
        average_duration_ms: 45000,
      };

      const alerts = detectAnomalies(recentMetrics, {
        min_success_rate: 0.95,
        max_failure_rate: 0.05,
        max_average_duration_ms: 30000,
        min_payments_for_alert: 10,
      });

      const latencyAlert = alerts.find((a) => a.type === 'latency');
      expect(latencyAlert).toBeDefined();
      expect(latencyAlert?.severity).toBe('warning');
    });
  });

  describe('getRealtimeMetrics', () => {
    it('should calculate payments per minute from recent data', async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);

      // Mock 10 payments in the last minute
      const recentPayments: PaymentEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `recent-${i}`,
        timestamp: new Date(oneMinuteAgo.getTime() + i * 6000),
        amount_sats: 1000,
        payment_method: 'lightning',
        status: 'completed',
        payment_hash: `hash-${i}`,
        creator_id: 'creator1',
        duration_ms: 300,
      }));

      const metrics = await analyticsService.getRealtimeMetrics(recentPayments);

      expect(metrics.payments_per_minute).toBeGreaterThan(0);
      expect(metrics.volume_per_minute_sats).toBe(10000);
    });

    it('should detect degraded performance', async () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

      // Create payments with low success rate
      const recentPayments: PaymentEvent[] = Array.from({ length: 100 }, (_, i) => ({
        id: `recent-${i}`,
        timestamp: new Date(fiveMinutesAgo.getTime() + i * 3000),
        amount_sats: 1000,
        payment_method: 'lightning',
        status: i < 80 ? 'completed' : 'failed', // 80% success rate
        payment_hash: `hash-${i}`,
        creator_id: 'creator1',
        duration_ms: 300,
      }));

      const metrics = await analyticsService.getRealtimeMetrics(recentPayments);

      expect(metrics.recent_success_rate).toBe(0.8);
      expect(metrics.is_degraded).toBe(true);
      expect(metrics.degradation_reason).toContain('success rate');
    });
  });

  describe('getCreatorAnalytics', () => {
    it('should calculate creator-specific metrics correctly', () => {
      const payments: PaymentEvent[] = [
        {
          id: '1',
          timestamp: new Date('2025-10-24T10:00:00Z'),
          amount_sats: 1000,
          payment_method: 'lightning',
          status: 'completed',
          payment_hash: 'hash1',
          creator_id: 'creator1',
          user_id: 'user1',
          duration_ms: 500,
        },
        {
          id: '2',
          timestamp: new Date('2025-10-24T11:00:00Z'),
          amount_sats: 2000,
          payment_method: 'webln',
          status: 'completed',
          payment_hash: 'hash2',
          creator_id: 'creator1',
          user_id: 'user2',
          duration_ms: 300,
        },
        {
          id: '3',
          timestamp: new Date('2025-10-24T12:00:00Z'),
          amount_sats: 3000,
          payment_method: 'lightning',
          status: 'completed',
          payment_hash: 'hash3',
          creator_id: 'creator1',
          user_id: 'user1',
          duration_ms: 400,
        },
      ];

      const analytics = analyticsService.getCreatorAnalytics('creator1', payments);

      expect(analytics.total_received_sats).toBe(6000);
      expect(analytics.payment_count).toBe(3);
      expect(analytics.unique_supporters).toBe(2);
      expect(analytics.average_payment_sats).toBe(2000);
      expect(analytics.success_rate).toBe(1.0);
    });
  });
});
