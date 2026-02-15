/**
 * V1 API Routes Integration Tests
 *
 * Verifies that all spec'd endpoints from docs/api-spec.md are registered
 * with correct HTTP methods, paths, and middleware (auth, validation).
 * Tests match the Phase 1 API contract.
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../app';

describe('V1 API Route Registration', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  // =========================================================================
  // Auth API - /api/auth
  // =========================================================================
  describe('Auth API (/api/auth)', () => {
    it('POST /api/auth/challenge - should accept requests', async () => {
      const res = await request(app).post('/api/auth/challenge');
      // Should not 404 (route exists)
      expect(res.status).not.toBe(404);
    });

    it('POST /api/auth/authenticate - should validate input', async () => {
      const res = await request(app)
        .post('/api/auth/authenticate')
        .send({});
      // Should be 400 (validation) or 500, not 404
      expect(res.status).not.toBe(404);
      expect([400, 500]).toContain(res.status);
    });

    it('POST /api/auth/refresh - should require auth', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/verify - should require auth', async () => {
      const res = await request(app).get('/api/auth/verify');
      expect(res.status).toBe(401);
    });

    it('POST /api/auth/logout - should accept requests', async () => {
      const res = await request(app).post('/api/auth/logout');
      // optionalAuth means no 401
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/auth/stats - should require auth', async () => {
      const res = await request(app).get('/api/auth/stats');
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/health - should return healthy', async () => {
      const res = await request(app).get('/api/auth/health');
      expect(res.status).not.toBe(404);
    });
  });

  // =========================================================================
  // Content API - /api/v1/content
  // =========================================================================
  describe('Content API (/api/v1/content)', () => {
    it('POST /api/v1/content/publish - should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/content/publish')
        .send({ title: 'Test', content: 'Body', contentType: 'article' });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/content/moderate - should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/content/moderate')
        .send({ content_id: 'test', action: 'approve' });
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/content/search - should not require auth', async () => {
      const res = await request(app)
        .get('/api/v1/content/search')
        .query({ query: 'test' });
      // optionalAuth -- should not 401 or 404
      expect(res.status).not.toBe(404);
      expect(res.status).not.toBe(401);
    });

    it('GET /api/v1/content/recommendations - should not require auth', async () => {
      const res = await request(app)
        .get('/api/v1/content/recommendations');
      expect(res.status).not.toBe(404);
      expect(res.status).not.toBe(401);
    });

    it('GET /api/v1/content/analytics/:id - should require auth', async () => {
      const res = await request(app)
        .get('/api/v1/content/analytics/00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/content/versions/:id - should require auth', async () => {
      const res = await request(app)
        .get('/api/v1/content/versions/00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/content/versions/:id/revert - should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/content/versions/00000000-0000-0000-0000-000000000001/revert')
        .send({ target_version: 1 });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // User API - /api/v1/users
  // =========================================================================
  describe('User API (/api/v1/users)', () => {
    it('GET /api/v1/users/profile/:id - should not require auth (optional)', async () => {
      const res = await request(app)
        .get('/api/v1/users/profile/00000000-0000-0000-0000-000000000001');
      expect(res.status).not.toBe(404);
      expect(res.status).not.toBe(401);
    });

    it('PUT /api/v1/users/profile/:id - should require auth', async () => {
      const res = await request(app)
        .put('/api/v1/users/profile/00000000-0000-0000-0000-000000000001')
        .send({ display_name: 'Test' });
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/users/preferences/:id - should require auth', async () => {
      const res = await request(app)
        .get('/api/v1/users/preferences/00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(401);
    });

    it('PUT /api/v1/users/preferences/:id - should require auth', async () => {
      const res = await request(app)
        .put('/api/v1/users/preferences/00000000-0000-0000-0000-000000000001')
        .send({});
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/users/activity/:id - should require auth', async () => {
      const res = await request(app)
        .get('/api/v1/users/activity/00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/users/relationships/follow - should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/users/relationships/follow')
        .send({ target_user_id: '00000000-0000-0000-0000-000000000001' });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/v1/users/relationships/unfollow - should require auth', async () => {
      const res = await request(app)
        .delete('/api/v1/users/relationships/unfollow')
        .send({ target_user_id: '00000000-0000-0000-0000-000000000001' });
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/users/analytics/:id - should require auth', async () => {
      const res = await request(app)
        .get('/api/v1/users/analytics/00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // Payment API - /api/v1/payments
  // =========================================================================
  describe('Payment API (/api/v1/payments)', () => {
    it('POST /api/v1/payments/invoices - should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/payments/invoices')
        .send({ amount_sats: 5000, recipient_id: 'test' });
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/payments/invoices/:id - should require auth', async () => {
      const res = await request(app)
        .get('/api/v1/payments/invoices/00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/payments/invoices/:id/pay - should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/payments/invoices/00000000-0000-0000-0000-000000000001/pay')
        .send({ payment_request: 'lnbc...' });
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/payments/currency/convert - should require auth', async () => {
      const res = await request(app)
        .get('/api/v1/payments/currency/convert')
        .query({ amount: 10, from: 'USD', to: 'BTC' });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/payments/subscriptions - should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/payments/subscriptions')
        .send({ creator_id: 'test', tier_id: 'basic' });
      expect(res.status).toBe(401);
    });

    it('PUT /api/v1/payments/subscriptions/:id - should require auth', async () => {
      const res = await request(app)
        .put('/api/v1/payments/subscriptions/00000000-0000-0000-0000-000000000001')
        .send({ tier_id: 'premium' });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/v1/payments/subscriptions/:id - should require auth', async () => {
      const res = await request(app)
        .delete('/api/v1/payments/subscriptions/00000000-0000-0000-0000-000000000001')
        .send({ reason: 'test' });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/payments/refunds - should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/payments/refunds')
        .send({ payment_id: 'test', amount_sats: 1000 });
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/payments/analytics - should require auth', async () => {
      const res = await request(app)
        .get('/api/v1/payments/analytics');
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/payments/webhooks - should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/payments/webhooks')
        .send({ url: 'https://example.com/webhook', events: ['payment.confirmed'] });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // Lightning API - /api/lightning
  // =========================================================================
  describe('Lightning API (/api/lightning)', () => {
    it('GET /api/lightning/node-info - should require auth', async () => {
      const res = await request(app).get('/api/lightning/node-info');
      expect(res.status).toBe(401);
    });

    it('POST /api/lightning/invoice - should require auth', async () => {
      const res = await request(app)
        .post('/api/lightning/invoice')
        .send({ amount_msats: 5000000 });
      expect(res.status).toBe(401);
    });

    it('GET /api/lightning/invoice/:paymentHash - should require auth', async () => {
      const res = await request(app).get('/api/lightning/invoice/abc123');
      expect(res.status).toBe(401);
    });

    it('POST /api/lightning/payment - should require auth', async () => {
      const res = await request(app)
        .post('/api/lightning/payment')
        .send({ paymentRequest: 'lnbc...' });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // Health API
  // =========================================================================
  describe('Health API', () => {
    it('GET /health - should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
    });
  });

  // =========================================================================
  // API Root
  // =========================================================================
  describe('API Root', () => {
    it('GET /api - should return API info', async () => {
      const res = await request(app).get('/api');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.endpoints).toHaveProperty('content');
      expect(res.body.data.endpoints).toHaveProperty('payments');
      expect(res.body.data.endpoints).toHaveProperty('lightning');
    });

    it('GET /api/v1 - should return v1 API info', async () => {
      const res = await request(app).get('/api/v1');
      expect(res.status).not.toBe(404);
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================
  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const res = await request(app).get('/api/v1/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should include consistent error response envelope', async () => {
      const res = await request(app).get('/api/v1/nonexistent');
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('code');
    });
  });

  // =========================================================================
  // Response Envelope
  // =========================================================================
  describe('Response Envelope', () => {
    it('POST /api/auth/logout - should use standard envelope', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.body).toHaveProperty('success');
    });

    it('Authenticated endpoints return auth error with envelope', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('code');
    });
  });
});
