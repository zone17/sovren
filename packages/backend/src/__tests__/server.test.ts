import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../app';

describe('Sovren API Server', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  describe('Basic Server Functionality', () => {
    it('should respond to health check', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('sovren-api');
    });

    it('should respond to API root endpoint', async () => {
      const response = await request(app).get('/api').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Sovren API');
      expect(response.body.data.endpoints).toBeDefined();
    });

    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app).get('/unknown-endpoint').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should include security headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      // X-XSS-Protection intentionally removed — deprecated per OWASP, can cause XSS in older browsers
    });
  });

  describe('API Performance', () => {
    it('should respond to health check within 200ms', async () => {
      const startTime = Date.now();

      await request(app).get('/health').expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(200);
    });
  });
});
