/**
 * Payment Analytics API Routes
 *
 * RESTful API endpoints for payment analytics and metrics.
 *
 * Endpoints:
 * - GET /api/analytics/payments/summary - Payment metrics summary
 * - GET /api/analytics/payments/timeseries - Time-series data
 * - GET /api/analytics/payments/realtime - Real-time metrics
 * - GET /api/analytics/creators/:creatorId - Creator-specific analytics
 * - GET /metrics - Prometheus metrics endpoint
 */

import { Router, Request, Response } from 'express';
import { PaymentAnalyticsService } from '../services/PaymentAnalyticsService';
import { PaymentEvent } from '../types/payment-analytics';
import { prometheusMetricsMiddleware, HttpMetricsCollector } from '../middleware/prometheus';

/**
 * Create analytics router
 */
export function createAnalyticsRouter(
  analyticsService: PaymentAnalyticsService,
  getPayments: () => Promise<PaymentEvent[]> | PaymentEvent[]
): Router {
  const router = Router();
  const httpMetrics = new HttpMetricsCollector();

  // Track HTTP metrics
  router.use(httpMetrics.middleware());

  /**
   * GET /api/analytics/payments/summary
   *
   * Returns aggregated payment metrics summary.
   *
   * Query params:
   * - start_date (ISO 8601) - Filter payments after this date
   * - end_date (ISO 8601) - Filter payments before this date
   * - creator_id (string) - Filter by creator
   * - payment_method (lightning|webln) - Filter by payment method
   * - status (completed|failed|pending) - Filter by status
   */
  router.get('/api/analytics/payments/summary', async (req: Request, res: Response) => {
    try {
      let payments = await getPayments();

      // Apply filters
      payments = applyFilters(payments, req.query);

      const summary = analyticsService.aggregateMetricsSummary(payments);

      res.json({
        success: true,
        data: summary,
        metadata: {
          filters_applied: getAppliedFilters(req.query),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error generating payment summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate payment summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/analytics/payments/timeseries
   *
   * Returns time-series payment data.
   *
   * Query params:
   * - interval (hour|day|week|month) - Aggregation interval (default: day)
   * - start_date (ISO 8601) - Start of time range
   * - end_date (ISO 8601) - End of time range
   * - creator_id (string) - Filter by creator
   */
  router.get('/api/analytics/payments/timeseries', async (req: Request, res: Response) => {
    try {
      let payments = await getPayments();

      // Apply filters
      payments = applyFilters(payments, req.query);

      const interval = (req.query.interval as string) || 'day';
      if (!['hour', 'day', 'week', 'month'].includes(interval)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid interval',
          message: 'Interval must be one of: hour, day, week, month',
        });
      }

      const timeSeries = analyticsService.aggregateTimeSeriesData(
        payments,
        interval as 'hour' | 'day' | 'week' | 'month'
      );

      res.json({
        success: true,
        data: timeSeries,
        metadata: {
          filters_applied: getAppliedFilters(req.query),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error generating time-series data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate time-series data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/analytics/payments/realtime
   *
   * Returns real-time payment metrics.
   *
   * Query params:
   * - window (number) - Time window in minutes (default: 5)
   */
  router.get('/api/analytics/payments/realtime', async (req: Request, res: Response) => {
    try {
      const windowMinutes = parseInt(req.query.window as string) || 5;
      const windowMs = windowMinutes * 60 * 1000;

      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);

      const allPayments = await getPayments();
      const recentPayments = allPayments.filter(
        (p) => p.timestamp >= windowStart
      );

      const metrics = await analyticsService.getRealtimeMetrics(recentPayments);

      res.json({
        success: true,
        data: metrics,
        metadata: {
          window_minutes: windowMinutes,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error generating realtime metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate realtime metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/analytics/creators/:creatorId
   *
   * Returns analytics for a specific creator.
   */
  router.get('/api/analytics/creators/:creatorId', async (req: Request, res: Response) => {
    try {
      const { creatorId } = req.params;

      if (!creatorId) {
        return res.status(400).json({
          success: false,
          error: 'Missing creator ID',
        });
      }

      let payments = await getPayments();

      // Apply additional filters if provided
      payments = applyFilters(payments, req.query);

      const analytics = analyticsService.getCreatorAnalytics(creatorId, payments);

      res.json({
        success: true,
        data: analytics,
        metadata: {
          creator_id: creatorId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error generating creator analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate creator analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /metrics
   *
   * Prometheus metrics endpoint.
   * Returns metrics in Prometheus exposition format.
   */
  router.get(
    '/metrics',
    prometheusMetricsMiddleware(async () => {
      const payments = await getPayments();
      return analyticsService.generatePrometheusMetrics(payments);
    })
  );

  /**
   * GET /api/analytics/health
   *
   * Health check endpoint for the analytics service.
   */
  router.get('/api/analytics/health', async (req: Request, res: Response) => {
    try {
      const payments = await getPayments();
      const recentPayments = payments.filter(
        (p) => p.timestamp >= new Date(Date.now() - 5 * 60 * 1000)
      );

      const metrics = await analyticsService.getRealtimeMetrics(recentPayments);

      res.json({
        success: true,
        status: metrics.is_degraded ? 'degraded' : 'healthy',
        data: {
          is_degraded: metrics.is_degraded,
          degradation_reason: metrics.degradation_reason,
          recent_success_rate: metrics.recent_success_rate,
          active_payments: metrics.active_payments,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error checking analytics health:', error);
      res.status(500).json({
        success: false,
        status: 'error',
        error: 'Failed to check health',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

/**
 * Apply query filters to payments
 */
function applyFilters(payments: PaymentEvent[], query: any): PaymentEvent[] {
  let filtered = [...payments];

  // Date range filters
  if (query.start_date) {
    const startDate = new Date(query.start_date as string);
    if (!isNaN(startDate.getTime())) {
      filtered = filtered.filter((p) => p.timestamp >= startDate);
    }
  }

  if (query.end_date) {
    const endDate = new Date(query.end_date as string);
    if (!isNaN(endDate.getTime())) {
      filtered = filtered.filter((p) => p.timestamp <= endDate);
    }
  }

  // Creator filter
  if (query.creator_id) {
    filtered = filtered.filter((p) => p.creator_id === query.creator_id);
  }

  // Payment method filter
  if (query.payment_method) {
    const method = query.payment_method as string;
    if (['lightning', 'webln'].includes(method)) {
      filtered = filtered.filter((p) => p.payment_method === method);
    }
  }

  // Status filter
  if (query.status) {
    const status = query.status as string;
    if (['completed', 'failed', 'pending', 'processing', 'expired'].includes(status)) {
      filtered = filtered.filter((p) => p.status === status);
    }
  }

  // Amount range filters
  if (query.min_amount_sats) {
    const minAmount = parseInt(query.min_amount_sats as string);
    if (!isNaN(minAmount)) {
      filtered = filtered.filter((p) => p.amount_sats >= minAmount);
    }
  }

  if (query.max_amount_sats) {
    const maxAmount = parseInt(query.max_amount_sats as string);
    if (!isNaN(maxAmount)) {
      filtered = filtered.filter((p) => p.amount_sats <= maxAmount);
    }
  }

  return filtered;
}

/**
 * Get list of applied filters from query
 */
function getAppliedFilters(query: any): Record<string, any> {
  const filters: Record<string, any> = {};

  if (query.start_date) filters.start_date = query.start_date;
  if (query.end_date) filters.end_date = query.end_date;
  if (query.creator_id) filters.creator_id = query.creator_id;
  if (query.payment_method) filters.payment_method = query.payment_method;
  if (query.status) filters.status = query.status;
  if (query.min_amount_sats) filters.min_amount_sats = query.min_amount_sats;
  if (query.max_amount_sats) filters.max_amount_sats = query.max_amount_sats;

  return filters;
}
