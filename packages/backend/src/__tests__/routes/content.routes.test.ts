/**
 * Content Routes Integration Tests
 *
 * Tests all Content API endpoints with realistic scenarios
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../app';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { ContentPublishingService } from '../../services/content';

describe('Content API Routes', () => {
  let app: Express;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
    // Mock authentication token
    authToken = 'Bearer mock-jwt-token';
  });

  describe('POST /api/v1/content/publish', () => {
    it('should publish content successfully', async () => {
      const response = await request(app)
        .post('/api/v1/content/publish')
        .set('Authorization', authToken)
        .send({
          title: 'Test Content',
          content: 'This is test content',
          contentType: 'article',
          tags: ['test', 'demo'],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('contentId');
      expect(response.body.data.status).toBe('published');
    });

    it('should return 400 for invalid content type', async () => {
      const response = await request(app)
        .post('/api/v1/content/publish')
        .set('Authorization', authToken)
        .send({
          title: 'Test',
          content: 'Content',
          contentType: 'invalid-type',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/content/publish')
        .send({
          title: 'Test',
          content: 'Content',
          contentType: 'article',
        })
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/v1/content/search', () => {
    it('should search content without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ query: 'test', limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(Array.isArray(response.body.data.results)).toBe(true);
    });

    it('should validate query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ query: '' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/content/analytics/:id', () => {
    it('should return analytics for authenticated user', async () => {
      const contentId = 'test-uuid-here';

      const response = await request(app)
        .get(`/api/v1/content/analytics/${contentId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
    });

    it('should return 401 without authentication', async () => {
      const contentId = 'test-uuid-here';

      await request(app)
        .get(`/api/v1/content/analytics/${contentId}`)
        .expect(401);
    });
  });
});
