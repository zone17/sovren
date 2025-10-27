/**
 * Analytics API Routes Tests
 *
 * Integration tests for payment analytics API endpoints.
 *
 * Coverage Target: ≥95%
 */

import request from 'supertest';
import express, { Application } from 'express';
import { createAnalyticsRouter } from '../routes/analytics';
import { PaymentAnalyticsService } from '../services/PaymentAnalyticsService';
import { PaymentEvent } from '../types/payment-analytics';

describe('Analytics API Routes', () => {
  let app: Application;
  let analyticsService: PaymentAnalyticsService;
  let mockPayments: PaymentEvent[];

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create analytics service
    analyticsService = new PaymentAnalyticsService();

    // Create mock payments
    mockPayments = createMockPayments();

    // Create router with mock data provider
    const router = createAnalyticsRouter(
      analyticsService,
      async () => mockPayments
    );

    app.use(router);
  });

  describe('GET /api/analytics/payments/summary', () => {
    it('should return payment summary successfully', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_payments');
      expect(response.body.data).toHaveProperty('success_rate');
      expect(response.body.data).toHaveProperty('total_volume_sats');
      expect(response.body.metadata).toHaveProperty('timestamp');
    });

    it('should filter by date range', async () => {
      const startDate = '2025-10-24T10:00:00Z';
      const endDate = '2025-10-24T12:00:00Z';

      const response = await request(app)
        .get('/api/analytics/payments/summary')
        .query({ start_date: startDate, end_date: endDate })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters_applied).toHaveProperty('start_date');
      expect(response.body.metadata.filters_applied).toHaveProperty('end_date');
    });

    it('should filter by creator_id', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/summary')
        .query({ creator_id: 'creator1' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters_applied.creator_id).toBe('creator1');
    });

    it('should filter by payment_method', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/summary')
        .query({ payment_method: 'lightning' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters_applied.payment_method).toBe('lightning');
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/summary')
        .query({ status: 'completed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters_applied.status).toBe('completed');
    });

    it('should filter by amount range', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/summary')
        .query({ min_amount_sats: 1000, max_amount_sats: 5000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters_applied).toHaveProperty('min_amount_sats');
      expect(response.body.metadata.filters_applied).toHaveProperty('max_amount_sats');
    });

    it('should handle errors gracefully', async () => {
      // Create router with failing data provider
      const failingRouter = createAnalyticsRouter(
        analyticsService,
        async () => {
          throw new Error('Database error');
        }
      );

      const failingApp = express();
      failingApp.use(express.json());
      failingApp.use(failingRouter);

      const response = await request(failingApp)
        .get('/api/analytics/payments/summary')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/analytics/payments/timeseries', () => {
    it('should return time-series data with default interval', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/timeseries')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('interval');
      expect(response.body.data).toHaveProperty('data_points');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.interval).toBe('day');
    });

    it('should accept hour interval', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/timeseries')
        .query({ interval: 'hour' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.interval).toBe('hour');
    });

    it('should accept week interval', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/timeseries')
        .query({ interval: 'week' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.interval).toBe('week');
    });

    it('should accept month interval', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/timeseries')
        .query({ interval: 'month' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.interval).toBe('month');
    });

    it('should reject invalid interval', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/timeseries')
        .query({ interval: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid interval');
    });

    it('should filter time-series by date range', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/timeseries')
        .query({
          start_date: '2025-10-24T00:00:00Z',
          end_date: '2025-10-25T00:00:00Z',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters_applied).toHaveProperty('start_date');
    });
  });

  describe('GET /api/analytics/payments/realtime', () => {
    it('should return realtime metrics with default window', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/realtime')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('payments_per_minute');
      expect(response.body.data).toHaveProperty('volume_per_minute_sats');
      expect(response.body.data).toHaveProperty('active_payments');
      expect(response.body.data).toHaveProperty('recent_success_rate');
      expect(response.body.data).toHaveProperty('is_degraded');
      expect(response.body.metadata.window_minutes).toBe(5);
    });

    it('should accept custom window parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/payments/realtime')
        .query({ window: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.window_minutes).toBe(10);
    });

    it('should detect degraded performance', async () => {
      // Create payments with low success rate
      const degradedPayments = createDegradedPayments();

      const degradedRouter = createAnalyticsRouter(
        analyticsService,
        async () => degradedPayments
      );

      const degradedApp = express();
      degradedApp.use(express.json());
      degradedApp.use(degradedRouter);

      const response = await request(degradedApp)
        .get('/api/analytics/payments/realtime')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.is_degraded).toBe(true);
      expect(response.body.data.degradation_reason).toBeDefined();
    });
  });

  describe('GET /api/analytics/creators/:creatorId', () => {
    it('should return creator-specific analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/creators/creator1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('creator_id');
      expect(response.body.data).toHaveProperty('total_received_sats');
      expect(response.body.data).toHaveProperty('payment_count');
      expect(response.body.data).toHaveProperty('unique_supporters');
      expect(response.body.data).toHaveProperty('average_payment_sats');
      expect(response.body.data).toHaveProperty('success_rate');
      expect(response.body.data.creator_id).toBe('creator1');
    });

    it('should filter creator analytics by date range', async () => {
      const response = await request(app)
        .get('/api/analytics/creators/creator1')
        .query({
          start_date: '2025-10-24T00:00:00Z',
          end_date: '2025-10-25T00:00:00Z',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('payment_total');
      expect(response.text).toContain('payment_success_total');
      expect(response.text).toContain('payment_failure_total');
      expect(response.text).toContain('payment_volume_sats_total');
      expect(response.text).toContain('payment_success_rate');
      expect(response.text).toContain('payment_amount_sats_bucket');
      expect(response.text).toContain('payment_duration_ms_bucket');
    });

    it('should include histogram buckets', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      // Check for amount buckets
      expect(response.text).toContain('payment_amount_sats_bucket{le="1000"}');
      expect(response.text).toContain('payment_amount_sats_bucket{le="5000"}');
      expect(response.text).toContain('payment_amount_sats_bucket{le="+Inf"}');

      // Check for duration buckets
      expect(response.text).toContain('payment_duration_ms_bucket{le="1000"}');
      expect(response.text).toContain('payment_duration_ms_bucket{le="5000"}');
      expect(response.text).toContain('payment_duration_ms_bucket{le="+Inf"}');
    });

    it('should include metadata', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
      expect(response.text).toContain('scrape_duration_ms');
    });
  });

  describe('GET /api/analytics/health', () => {
    it('should return healthy status when system is normal', async () => {
      const response = await request(app)
        .get('/api/analytics/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
      expect(response.body.data).toHaveProperty('is_degraded');
      expect(response.body.data).toHaveProperty('recent_success_rate');
      expect(response.body.data).toHaveProperty('active_payments');
    });

    it('should return degraded status when performance is poor', async () => {
      const degradedPayments = createDegradedPayments();

      const degradedRouter = createAnalyticsRouter(
        analyticsService,
        async () => degradedPayments
      );

      const degradedApp = express();
      degradedApp.use(express.json());
      degradedApp.use(degradedRouter);

      const response = await request(degradedApp)
        .get('/api/analytics/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('degraded');
      expect(response.body.data.is_degraded).toBe(true);
    });
  });
});

/**
 * Helper: Create mock payment events
 */
function createMockPayments(): PaymentEvent[] {
  const now = new Date();
  const payments: PaymentEvent[] = [];

  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now.getTime() - i * 60000); // 1 minute intervals

    payments.push({
      id: `payment-${i}`,
      timestamp,
      amount_sats: 1000 + i * 100,
      payment_method: i % 2 === 0 ? 'lightning' : 'webln',
      status: i < 95 ? 'completed' : 'failed', // 95% success rate
      payment_hash: `hash-${i}`,
      creator_id: `creator${i % 3 + 1}`, // 3 creators
      user_id: `user${i % 10 + 1}`, // 10 users
      duration_ms: 300 + i * 10,
      retry_count: 0,
    });
  }

  return payments;
}

/**
 * Helper: Create payments with degraded performance
 */
function createDegradedPayments(): PaymentEvent[] {
  const now = new Date();
  const payments: PaymentEvent[] = [];

  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now.getTime() - i * 60000);

    payments.push({
      id: `payment-${i}`,
      timestamp,
      amount_sats: 1000,
      payment_method: 'lightning',
      status: i < 80 ? 'completed' : 'failed', // 80% success rate (degraded)
      payment_hash: `hash-${i}`,
      creator_id: 'creator1',
      duration_ms: 45000, // High latency
      retry_count: i >= 80 ? 3 : 0,
    });
  }

  return payments;
}
