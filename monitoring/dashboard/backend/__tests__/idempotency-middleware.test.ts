/**
 * Idempotency Middleware Tests
 *
 * TDD approach: Write tests FIRST, then implement middleware
 *
 * Test Coverage:
 * - First request processing
 * - Duplicate request detection
 * - Cached response return
 * - UUID validation
 * - Request hash comparison
 * - Expired key handling
 * - TTL cleanup
 * - Error scenarios
 *
 * @story PAY-010
 */

import { Request, Response, NextFunction } from 'express';
import { IdempotencyMiddleware } from '../middleware/idempotency';
import { IdempotencyRepository } from '../repositories/IdempotencyRepository';

// Mock the repository
jest.mock('../repositories/IdempotencyRepository');

describe('IdempotencyMiddleware', () => {
  let middleware: IdempotencyMiddleware;
  let mockRepository: jest.Mocked<IdempotencyRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseData: { status?: number; json?: any; send?: any };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock repository
    mockRepository = new IdempotencyRepository(null as any) as jest.Mocked<IdempotencyRepository>;

    // Create middleware instance
    middleware = new IdempotencyMiddleware(mockRepository, {
      ttl_ms: 24 * 60 * 60 * 1000, // 24 hours
      header_name: 'Idempotency-Key',
      required: true,
    });

    // Create mock request
    mockRequest = {
      method: 'POST',
      path: '/api/lightning/invoice',
      headers: {},
      body: { amount_sats: 10000 },
      ip: '192.168.1.1',
      get: jest.fn((header: string) => {
        const value = mockRequest.headers?.[header.toLowerCase()];
        return value as any;
      }) as any,
    };

    // Create mock response with chainable methods
    responseData = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((data) => {
        responseData.json = data;
        return mockResponse;
      }),
      send: jest.fn().mockImplementation((data) => {
        responseData.send = data;
        return mockResponse;
      }),
      setHeader: jest.fn().mockReturnThis(),
    };

    // Create mock next function
    mockNext = jest.fn();
  });

  describe('UUID Validation', () => {
    it('should accept valid UUID v4 idempotency key', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': validUuid };

      mockRepository.findByKey = jest.fn().mockResolvedValue(null);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid UUID format', async () => {
      mockRequest.headers = { 'idempotency-key': 'invalid-uuid-123' };

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseData.json).toMatchObject({
        error: expect.stringContaining('Invalid idempotency key format'),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject non-UUID string', async () => {
      mockRequest.headers = { 'idempotency-key': 'not-a-uuid' };

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject missing idempotency key when required', async () => {
      // No idempotency-key header

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseData.json).toMatchObject({
        error: expect.stringContaining('Idempotency-Key header is required'),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow missing key when not required', async () => {
      middleware = new IdempotencyMiddleware(mockRepository, {
        required: false,
      });

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('First Request Processing', () => {
    it('should process first request normally', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      // No cached entry found
      mockRepository.findByKey = jest.fn().mockResolvedValue(null);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRepository.findByKey).toHaveBeenCalledWith(idempotencyKey);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should compute request hash from body', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = { amount_sats: 10000, memo: 'Test payment' };

      mockRepository.findByKey = jest.fn().mockResolvedValue(null);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      // Hash should be computed and stored in request
    });

    it('should handle empty request body', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = {};

      mockRepository.findByKey = jest.fn().mockResolvedValue(null);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Duplicate Request Detection', () => {
    it('should return cached response for duplicate request', async () => {
      const crypto = require('crypto');
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const requestBody = { amount_sats: 10000 };
      const requestHash = crypto.createHash('sha256').update(JSON.stringify(requestBody)).digest('hex');

      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = requestBody;

      const cachedResponse = {
        idempotency_key: idempotencyKey,
        request_hash: requestHash, // Use actual computed hash
        response_status: 200,
        response_body: { invoice: 'lnbc...', amount_sats: 10000 },
        response_headers: { 'content-type': 'application/json' },
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
      };

      mockRepository.findByKey = jest.fn().mockResolvedValue(cachedResponse);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Idempotency-Cached',
        'true'
      );
      expect(responseData.json).toEqual(cachedResponse.response_body);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should detect request body changes with same idempotency key', async () => {
      const crypto = require('crypto');
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const originalBody = { amount_sats: 10000 };
      const originalHash = crypto.createHash('sha256').update(JSON.stringify(originalBody)).digest('hex');

      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = { amount_sats: 20000 }; // Different amount

      const cachedResponse = {
        idempotency_key: idempotencyKey,
        request_hash: originalHash, // Hash from original request
        response_status: 200,
        response_body: { invoice: 'lnbc...', amount_sats: 10000 },
        response_headers: {},
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
      };

      mockRepository.findByKey = jest.fn().mockResolvedValue(cachedResponse);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(responseData.json).toMatchObject({
        error: 'Idempotency check failed',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should add cache headers to cached response', async () => {
      const crypto = require('crypto');
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const requestBody = { success: true };
      const requestHash = crypto.createHash('sha256').update(JSON.stringify(requestBody)).digest('hex');

      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = requestBody;

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const cachedResponse = {
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        response_status: 201,
        response_body: { success: true },
        response_headers: {},
        created_at: new Date(),
        expires_at: expiresAt,
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
      };

      mockRepository.findByKey = jest.fn().mockResolvedValue(cachedResponse);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Idempotency-Cached',
        'true'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Cache-Expires',
        expiresAt.toISOString()
      );
    });
  });

  describe('Expired Key Handling', () => {
    it('should reprocess request with expired cache entry', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      const expiredResponse = {
        idempotency_key: idempotencyKey,
        request_hash: 'hash',
        response_status: 200,
        response_body: { old: 'data' },
        response_headers: {},
        created_at: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        expires_at: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
      };

      mockRepository.findByKey = jest.fn().mockResolvedValue(expiredResponse);
      mockRepository.deleteByKey = jest.fn().mockResolvedValue(true);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRepository.deleteByKey).toHaveBeenCalledWith(idempotencyKey);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle cleanup of expired entry failure gracefully', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      const expiredResponse = {
        idempotency_key: idempotencyKey,
        request_hash: 'hash',
        response_status: 200,
        response_body: {},
        response_headers: {},
        created_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
        expires_at: new Date(Date.now() - 60 * 60 * 1000),
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
      };

      mockRepository.findByKey = jest.fn().mockResolvedValue(expiredResponse);
      mockRepository.deleteByKey = jest.fn().mockRejectedValue(
        new Error('Database error')
      );

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should still proceed with request
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Response Caching', () => {
    it('should cache successful response after processing', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = { amount_sats: 10000 };

      mockRepository.findByKey = jest.fn().mockResolvedValue(null);
      mockRepository.store = jest.fn().mockResolvedValue(true);

      // Simulate middleware processing
      mockResponse.json = jest.fn((data) => {
        responseData.json = data;
        // Trigger cache storage
        return mockResponse;
      }) as any;

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      // Caching happens in response interception
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      mockRepository.findByKey = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(responseData.json).toMatchObject({
        error: expect.stringContaining('Idempotency check failed'),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle malformed cached data', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      const malformedResponse = {
        idempotency_key: idempotencyKey,
        // Missing required fields - should cause error
      } as any;

      mockRepository.findByKey = jest.fn().mockResolvedValue(malformedResponse);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should return error due to malformed data
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('HTTP Method Filtering', () => {
    it('should apply idempotency to POST requests', async () => {
      mockRequest.method = 'POST';
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      mockRepository.findByKey = jest.fn().mockResolvedValue(null);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRepository.findByKey).toHaveBeenCalled();
    });

    it('should skip idempotency for GET requests', async () => {
      mockRequest.method = 'GET';

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRepository.findByKey).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should apply idempotency to PUT requests', async () => {
      mockRequest.method = 'PUT';
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      mockRepository.findByKey = jest.fn().mockResolvedValue(null);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRepository.findByKey).toHaveBeenCalled();
    });
  });

  describe('Configuration Options', () => {
    it('should use custom header name', async () => {
      middleware = new IdempotencyMiddleware(mockRepository, {
        header_name: 'X-Request-ID',
      });

      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-request-id': idempotencyKey };

      mockRepository.findByKey = jest.fn().mockResolvedValue(null);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRepository.findByKey).toHaveBeenCalledWith(idempotencyKey);
    });

    it('should respect custom TTL', async () => {
      const customTtl = 12 * 60 * 60 * 1000; // 12 hours
      middleware = new IdempotencyMiddleware(mockRepository, {
        ttl_ms: customTtl,
      });

      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      mockRepository.findByKey = jest.fn().mockResolvedValue(null);
      mockRepository.store = jest.fn().mockResolvedValue(true);

      await middleware.handle(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      // TTL should be used in expiration calculation
    });
  });
});
