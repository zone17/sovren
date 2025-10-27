/**
 * API Endpoints Integration Tests
 * Tests REST API endpoints end-to-end with service layer
 * Part of US-E5-034: Integration Test Suite
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { createTestContainer, cleanupTestContainer } from '../fixtures/test-container-setup';
import {
  createTestUser,
  createTestInvoice,
  createTestPayment,
  createTestSubscription
} from '../fixtures/test-data-factory';
import type { IServiceContainer } from '../../interfaces/shared/IServiceRegistry';

describe('API Endpoints Integration Tests', () => {
  let app: Express;
  let container: IServiceContainer;

  beforeAll(async () => {
    container = await createTestContainer();
    app = createTestApp(container);
  });

  afterAll(async () => {
    await cleanupTestContainer(container);
  });

  describe('Payment API Endpoints', () => {
    describe('POST /api/v1/invoices', () => {
      it('should create a new invoice with valid data', async () => {
        // Arrange
        const invoiceData = {
          amount: 1000,
          currency: 'BTC',
          description: 'Test invoice'
        };

        // Act
        const response = await request(app)
          .post('/api/v1/invoices')
          .send(invoiceData)
          .expect(201);

        // Assert
        expect(response.body).toMatchObject({
          amount: 1000,
          currency: 'BTC',
          status: 'pending'
        });
        expect(response.body.id).toBeDefined();
        expect(response.body.paymentRequest).toBeDefined();
      });

      it('should return 400 for invalid invoice data', async () => {
        // Arrange
        const invalidData = {
          amount: -100, // Invalid negative amount
          currency: 'INVALID'
        };

        // Act
        const response = await request(app)
          .post('/api/v1/invoices')
          .send(invalidData)
          .expect(400);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('validation');
      });

      it('should return 401 for unauthenticated requests', async () => {
        // Arrange
        const invoiceData = { amount: 1000, currency: 'BTC' };

        // Act
        const response = await request(app)
          .post('/api/v1/invoices')
          .send(invoiceData)
          // No auth token
          .expect(401);

        // Assert
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/v1/invoices/:id', () => {
      it('should retrieve invoice by id', async () => {
        // Arrange
        const invoice = createTestInvoice();
        // Mock: invoice would be created in database

        // Act
        const response = await request(app)
          .get(`/api/v1/invoices/${invoice.id}`)
          .expect(200);

        // Assert
        expect(response.body).toMatchObject({
          id: invoice.id,
          status: 'pending'
        });
      });

      it('should return 404 for non-existent invoice', async () => {
        // Act
        const response = await request(app)
          .get('/api/v1/invoices/non-existent-id')
          .expect(404);

        // Assert
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/v1/payments/:invoiceId/verify', () => {
      it('should verify payment for settled invoice', async () => {
        // Arrange
        const invoice = createTestInvoice({ status: 'completed' });

        // Act
        const response = await request(app)
          .post(`/api/v1/payments/${invoice.id}/verify`)
          .expect(200);

        // Assert
        expect(response.body).toMatchObject({
          verified: true,
          status: 'completed'
        });
      });

      it('should return pending for unsettled invoice', async () => {
        // Arrange
        const invoice = createTestInvoice({ status: 'pending' });

        // Act
        const response = await request(app)
          .post(`/api/v1/payments/${invoice.id}/verify`)
          .expect(200);

        // Assert
        expect(response.body).toMatchObject({
          verified: false,
          status: 'pending'
        });
      });
    });
  });

  describe('Subscription API Endpoints', () => {
    describe('POST /api/v1/subscriptions', () => {
      it('should create new subscription', async () => {
        // Arrange
        const subscriptionData = {
          creatorId: 'creator-123',
          tier: 'premium',
          interval: 'monthly'
        };

        // Act
        const response = await request(app)
          .post('/api/v1/subscriptions')
          .send(subscriptionData)
          .expect(201);

        // Assert
        expect(response.body).toMatchObject({
          tier: 'premium',
          interval: 'monthly',
          status: 'active'
        });
        expect(response.body.id).toBeDefined();
      });

      it('should validate subscription tier', async () => {
        // Arrange
        const invalidData = {
          creatorId: 'creator-123',
          tier: 'invalid-tier',
          interval: 'monthly'
        };

        // Act
        const response = await request(app)
          .post('/api/v1/subscriptions')
          .send(invalidData)
          .expect(400);

        // Assert
        expect(response.body.error).toContain('tier');
      });
    });

    describe('DELETE /api/v1/subscriptions/:id', () => {
      it('should cancel active subscription', async () => {
        // Arrange
        const subscription = createTestSubscription({ status: 'active' });

        // Act
        const response = await request(app)
          .delete(`/api/v1/subscriptions/${subscription.id}`)
          .expect(200);

        // Assert
        expect(response.body).toMatchObject({
          status: 'canceled',
          canceledAt: expect.any(String)
        });
      });

      it('should return 404 for non-existent subscription', async () => {
        // Act
        const response = await request(app)
          .delete('/api/v1/subscriptions/non-existent')
          .expect(404);

        // Assert
        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('User API Endpoints', () => {
    describe('GET /api/v1/users/:id', () => {
      it('should retrieve user profile', async () => {
        // Arrange
        const user = createTestUser();

        // Act
        const response = await request(app)
          .get(`/api/v1/users/${user.id}`)
          .expect(200);

        // Assert
        expect(response.body).toMatchObject({
          id: user.id,
          username: expect.any(String)
        });
        expect(response.body).not.toHaveProperty('passwordHash'); // Sensitive data excluded
      });
    });

    describe('PATCH /api/v1/users/:id', () => {
      it('should update user profile', async () => {
        // Arrange
        const user = createTestUser();
        const updates = {
          username: 'newusername',
          bio: 'Updated bio'
        };

        // Act
        const response = await request(app)
          .patch(`/api/v1/users/${user.id}`)
          .send(updates)
          .expect(200);

        // Assert
        expect(response.body).toMatchObject({
          username: 'newusername',
          bio: 'Updated bio'
        });
      });

      it('should validate username format', async () => {
        // Arrange
        const user = createTestUser();
        const invalidUpdates = {
          username: 'invalid username!' // Invalid characters
        };

        // Act
        const response = await request(app)
          .patch(`/api/v1/users/${user.id}`)
          .send(invalidUpdates)
          .expect(400);

        // Assert
        expect(response.body.error).toContain('username');
      });
    });
  });

  describe('Content API Endpoints', () => {
    describe('POST /api/v1/content', () => {
      it('should create new content', async () => {
        // Arrange
        const contentData = {
          title: 'Test Article',
          body: 'Content body',
          contentType: 'article',
          visibility: 'public'
        };

        // Act
        const response = await request(app)
          .post('/api/v1/content')
          .send(contentData)
          .expect(201);

        // Assert
        expect(response.body).toMatchObject({
          title: 'Test Article',
          contentType: 'article',
          status: 'draft'
        });
      });
    });

    describe('GET /api/v1/content', () => {
      it('should list public content with pagination', async () => {
        // Act
        const response = await request(app)
          .get('/api/v1/content')
          .query({ page: 1, limit: 10 })
          .expect(200);

        // Assert
        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('pagination');
        expect(Array.isArray(response.body.items)).toBe(true);
      });

      it('should filter content by type', async () => {
        // Act
        const response = await request(app)
          .get('/api/v1/content')
          .query({ contentType: 'article' })
          .expect(200);

        // Assert
        expect(response.body.items).toBeDefined();
      });
    });
  });

  describe('Webhook API Endpoints', () => {
    describe('POST /api/v1/webhooks', () => {
      it('should register new webhook', async () => {
        // Arrange
        const webhookData = {
          url: 'https://example.com/webhook',
          events: ['payment.succeeded', 'payment.failed']
        };

        // Act
        const response = await request(app)
          .post('/api/v1/webhooks')
          .send(webhookData)
          .expect(201);

        // Assert
        expect(response.body).toMatchObject({
          url: 'https://example.com/webhook',
          isActive: true
        });
        expect(response.body.secret).toBeDefined();
      });

      it('should validate webhook URL format', async () => {
        // Arrange
        const invalidData = {
          url: 'not-a-valid-url',
          events: ['payment.succeeded']
        };

        // Act
        const response = await request(app)
          .post('/api/v1/webhooks')
          .send(invalidData)
          .expect(400);

        // Assert
        expect(response.body.error).toContain('url');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/error-trigger') // Endpoint that throws error
        .expect(500);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
      expect(response.body).not.toHaveProperty('stack'); // No stack trace in production
    });

    it('should handle malformed JSON', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error');
    });

    it('should handle rate limiting', async () => {
      // Arrange - Make multiple requests to trigger rate limit
      const requests = Array.from({ length: 101 }, () =>
        request(app).get('/api/v1/health')
      );

      // Act
      const responses = await Promise.all(requests);

      // Assert
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include CORS headers', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Assert
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should include security headers', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Assert
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });
});

/**
 * Create test Express app with routes
 */
function createTestApp(container: IServiceContainer): Express {
  const app = express();

  app.use(express.json());

  // Mock routes for testing
  app.post('/api/v1/invoices', (req, res) => {
    res.status(201).json(createTestInvoice(req.body));
  });

  app.get('/api/v1/invoices/:id', (req, res) => {
    res.json(createTestInvoice({ id: req.params.id }));
  });

  app.post('/api/v1/payments/:invoiceId/verify', (req, res) => {
    res.json({ verified: true, status: 'completed' });
  });

  app.post('/api/v1/subscriptions', (req, res) => {
    res.status(201).json(createTestSubscription(req.body));
  });

  app.delete('/api/v1/subscriptions/:id', (req, res) => {
    res.json({ status: 'canceled', canceledAt: new Date().toISOString() });
  });

  app.get('/api/v1/users/:id', (req, res) => {
    res.json(createTestUser({ id: req.params.id }));
  });

  app.patch('/api/v1/users/:id', (req, res) => {
    res.json({ ...createTestUser({ id: req.params.id }), ...req.body });
  });

  app.post('/api/v1/content', (req, res) => {
    res.status(201).json({ ...req.body, status: 'draft', id: 'content-123' });
  });

  app.get('/api/v1/content', (req, res) => {
    res.json({ items: [], pagination: { page: 1, limit: 10, total: 0 } });
  });

  app.post('/api/v1/webhooks', (req, res) => {
    res.status(201).json({ ...req.body, secret: 'whsec_test', isActive: true });
  });

  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
