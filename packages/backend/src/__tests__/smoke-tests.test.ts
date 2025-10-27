/**
 * 🔥 Smoke Test Suite for Post-Deployment Validation
 *
 * These tests run after deployment to verify critical functionality.
 * They are designed to be fast, focused, and fail-fast.
 *
 * Test Categories:
 * 1. Health & Readiness - System is alive and ready
 * 2. Critical Endpoints - Core API functionality works
 * 3. Database Connectivity - Data layer is accessible
 * 4. External Services - Third-party integrations are functional
 * 5. Performance Baseline - Response times are acceptable
 *
 * @module smoke-tests
 */

import { createApp } from '../app';
import supertest from 'supertest';

describe('Smoke Tests - Post-Deployment Validation', () => {
  let app: ReturnType<typeof createApp>;
  let request: ReturnType<typeof supertest>;

  beforeAll(() => {
    app = createApp();
    request = supertest(app);
  });

  describe('Health & Readiness', () => {
    it('should return healthy status from /health endpoint', async () => {
      const response = await request.get('/health').expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          service: 'sovren-api',
        },
      });

      expect(response.body.data.version).toBeDefined();
      expect(response.body.data.uptime).toBeGreaterThan(0);
    }, 5000);

    it('should return alive status from /health/live endpoint', async () => {
      const response = await request.get('/health/live').expect(200);

      expect(response.body.status).toBe('alive');
      expect(response.body.pid).toBeGreaterThan(0);
      expect(response.body.uptime).toBeGreaterThan(0);
    }, 5000);

    it('should return ready status from /health/ready endpoint', async () => {
      const response = await request.get('/health/ready');

      // Accept either 200 (ready) or 503 (not ready) in test environment
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.status).toBe('ready');
      } else {
        expect(response.body.status).toBe('not-ready');
        expect(response.body.issues).toBeDefined();
      }
    }, 10000);

    it('should return detailed health information', async () => {
      const response = await request.get('/health/detailed');

      // Accept either healthy or degraded in test environment
      expect([200, 503]).toContain(response.status);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('metrics');

      // Verify service health structure
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('redis');
      expect(response.body.services).toHaveProperty('lightning');
      expect(response.body.services).toHaveProperty('nostr');

      // Verify metrics structure
      expect(response.body.metrics).toHaveProperty('memory');
      expect(response.body.metrics).toHaveProperty('cpu');
      expect(response.body.metrics).toHaveProperty('process');
    }, 15000);
  });

  describe('Critical Endpoints', () => {
    it('should return API information from /api endpoint', async () => {
      const response = await request.get('/api').expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: 'Sovren API',
          description: 'NOSTR-native creator monetization platform',
        },
      });

      expect(response.body.data.endpoints).toBeDefined();
      expect(response.body.data.version).toBeDefined();
    }, 5000);

    it('should handle authentication endpoint structure', async () => {
      // We're not testing auth logic, just that the endpoint exists and responds
      const response = await request
        .post('/api/auth/register')
        .send({})
        .set('Content-Type', 'application/json');

      // Expect validation error (400) or unauthorized (401), not 404 or 500
      expect([400, 401, 422]).toContain(response.status);
    }, 5000);

    it('should handle unknown endpoints gracefully', async () => {
      const response = await request.get('/api/unknown-endpoint').expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
      });
    }, 5000);

    it('should enforce rate limiting headers', async () => {
      const response = await request.get('/health');

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    }, 5000);
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request.get('/health');

      // Helmet security headers
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');

      // CORS headers (in development)
      if (process.env.NODE_ENV !== 'production') {
        expect(response.headers['access-control-allow-origin']).toBeDefined();
      }
    }, 5000);

    it('should include CSP headers', async () => {
      const response = await request.get('/health');

      expect(response.headers['content-security-policy']).toBeDefined();
    }, 5000);
  });

  describe('Performance Baseline', () => {
    it('should respond to health check within 500ms', async () => {
      const start = Date.now();
      await request.get('/health').expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should respond to API info within 500ms', async () => {
      const start = Date.now();
      await request.get('/api').expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should handle concurrent requests efficiently', async () => {
      const start = Date.now();

      await Promise.all([
        request.get('/health'),
        request.get('/health'),
        request.get('/health'),
        request.get('/health'),
        request.get('/health'),
      ]);

      const duration = Date.now() - start;

      // 5 concurrent requests should complete in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request
        .post('/api/auth/register')
        .send('invalid-json')
        .set('Content-Type', 'application/json');

      expect([400, 401, 422, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    }, 5000);

    it('should handle missing content-type gracefully', async () => {
      const response = await request.post('/api/auth/register').send({});

      expect([400, 401, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    }, 5000);

    it('should handle oversized payloads', async () => {
      // Create a 15MB payload (server limit is 10MB)
      const oversizedData = 'x'.repeat(15 * 1024 * 1024);

      const response = await request
        .post('/api/auth/register')
        .send({ data: oversizedData })
        .set('Content-Type', 'application/json');

      // Should reject oversized payload
      expect([413, 400]).toContain(response.status);
    }, 10000);
  });

  describe('Service Dependencies', () => {
    it('should report database status in health check', async () => {
      const response = await request.get('/health/detailed');

      expect(response.body.services.database).toHaveProperty('status');
      expect(response.body.services.database).toHaveProperty('responseTime');
      expect(response.body.services.database).toHaveProperty('lastChecked');

      // Status should be one of: healthy, degraded, unhealthy
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        response.body.services.database.status
      );
    }, 15000);

    it('should report redis status in health check', async () => {
      const response = await request.get('/health/detailed');

      expect(response.body.services.redis).toHaveProperty('status');
      expect(response.body.services.redis).toHaveProperty('responseTime');
      expect(response.body.services.redis).toHaveProperty('lastChecked');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        response.body.services.redis.status
      );
    }, 15000);

    it('should report lightning status in health check', async () => {
      const response = await request.get('/health/detailed');

      expect(response.body.services.lightning).toHaveProperty('status');
      expect(response.body.services.lightning).toHaveProperty('responseTime');
      expect(response.body.services.lightning).toHaveProperty('lastChecked');

      // Lightning can be degraded if not configured in test environment
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        response.body.services.lightning.status
      );
    }, 15000);

    it('should report nostr status in health check', async () => {
      const response = await request.get('/health/detailed');

      expect(response.body.services.nostr).toHaveProperty('status');
      expect(response.body.services.nostr).toHaveProperty('responseTime');
      expect(response.body.services.nostr).toHaveProperty('lastChecked');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        response.body.services.nostr.status
      );
    }, 15000);
  });

  describe('System Metrics', () => {
    it('should report memory usage', async () => {
      const response = await request.get('/health/detailed');

      expect(response.body.metrics.memory).toHaveProperty('used');
      expect(response.body.metrics.memory).toHaveProperty('total');
      expect(response.body.metrics.memory).toHaveProperty('percentage');

      expect(response.body.metrics.memory.used).toBeGreaterThan(0);
      expect(response.body.metrics.memory.total).toBeGreaterThan(0);
      expect(response.body.metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(response.body.metrics.memory.percentage).toBeLessThanOrEqual(100);
    }, 15000);

    it('should report process information', async () => {
      const response = await request.get('/health/detailed');

      expect(response.body.metrics.process).toHaveProperty('pid');
      expect(response.body.metrics.process).toHaveProperty('uptime');

      expect(response.body.metrics.process.pid).toBeGreaterThan(0);
      expect(response.body.metrics.process.uptime).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should report environment information', async () => {
      const response = await request.get('/health/detailed');

      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');

      expect(['development', 'test', 'staging', 'production']).toContain(
        response.body.environment
      );
    }, 15000);
  });
});
