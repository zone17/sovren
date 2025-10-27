/**
 * Idempotency Repository Tests
 *
 * TDD approach: Write tests FIRST for repository layer
 *
 * Test Coverage:
 * - Store new cache entry
 * - Find by key
 * - Delete by key
 * - Cleanup expired entries
 * - Error handling
 * - Database constraints
 *
 * @story PAY-010
 */

import { IdempotencyRepository } from '../repositories/IdempotencyRepository';
import { IdempotencyCacheRequest } from '../types/idempotency';

// Mock database client
interface MockDatabaseClient {
  query: jest.Mock;
  end: jest.Mock;
}

describe('IdempotencyRepository', () => {
  let repository: IdempotencyRepository;
  let mockDb: MockDatabaseClient;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      end: jest.fn(),
    };

    repository = new IdempotencyRepository(mockDb as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('store', () => {
    it('should store new idempotency cache entry', async () => {
      const cacheRequest: IdempotencyCacheRequest = {
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
        request_hash: 'abc123def456',
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
        response_status: 201,
        response_body: { invoice: 'lnbc...', amount_sats: 10000 },
        response_headers: { 'content-type': 'application/json' },
        client_ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      };

      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.store(cacheRequest);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO idempotency_cache'),
        expect.arrayContaining([
          cacheRequest.idempotency_key,
          cacheRequest.request_hash,
          cacheRequest.http_method,
          cacheRequest.endpoint_path,
          cacheRequest.response_status,
          expect.any(String), // JSON stringified body
          expect.any(String), // JSON stringified headers
        ])
      );
    });

    it('should calculate expiration timestamp with 24h TTL', async () => {
      const cacheRequest: IdempotencyCacheRequest = {
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
        request_hash: 'hash',
        http_method: 'POST',
        endpoint_path: '/api/payments/process',
        response_status: 200,
        response_body: { success: true },
      };

      mockDb.query.mockResolvedValue({ rowCount: 1 });

      await repository.store(cacheRequest);

      const queryCall = mockDb.query.mock.calls[0];
      const expiresAtParam = queryCall[1][7]; // expires_at parameter

      // Should be approximately 24 hours from now
      const expiresAt = new Date(expiresAtParam);
      const now = new Date();
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      expect(diffHours).toBeGreaterThan(23.9);
      expect(diffHours).toBeLessThan(24.1);
    });

    it('should handle duplicate key constraint violation', async () => {
      const cacheRequest: IdempotencyCacheRequest = {
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
        request_hash: 'hash',
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
        response_status: 200,
        response_body: {},
      };

      const duplicateError = new Error('duplicate key violation');
      (duplicateError as any).code = '23505'; // PostgreSQL duplicate key error code
      mockDb.query.mockRejectedValue(duplicateError);

      await expect(repository.store(cacheRequest)).rejects.toThrow(
        'duplicate key violation'
      );
    });

    it('should handle database connection errors', async () => {
      const cacheRequest: IdempotencyCacheRequest = {
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
        request_hash: 'hash',
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
        response_status: 200,
        response_body: {},
      };

      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.store(cacheRequest)).rejects.toThrow(
        'Connection refused'
      );
    });

    it('should store optional fields', async () => {
      const cacheRequest: IdempotencyCacheRequest = {
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
        request_hash: 'hash',
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
        response_status: 200,
        response_body: {},
        // No client_ip, user_agent, or response_headers
      };

      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.store(cacheRequest);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('findByKey', () => {
    it('should find existing cache entry by key', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const mockRow = {
        idempotency_key: idempotencyKey,
        request_hash: 'abc123',
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
        response_status: 201,
        response_body: JSON.stringify({ invoice: 'lnbc...' }),
        response_headers: JSON.stringify({ 'content-type': 'application/json' }),
        created_at: new Date('2025-10-25T12:00:00Z'),
        expires_at: new Date('2025-10-26T12:00:00Z'),
        client_ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      };

      mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

      const result = await repository.findByKey(idempotencyKey);

      expect(result).not.toBeNull();
      expect(result?.idempotency_key).toBe(idempotencyKey);
      expect(result?.response_body).toEqual({ invoice: 'lnbc...' });
      expect(result?.response_headers).toEqual({ 'content-type': 'application/json' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM idempotency_cache'),
        [idempotencyKey]
      );
    });

    it('should return null for non-existent key', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.findByKey(idempotencyKey);

      expect(result).toBeNull();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM idempotency_cache'),
        [idempotencyKey]
      );
    });

    it('should parse JSON fields correctly', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const complexBody = {
        invoice: 'lnbc...',
        amount_sats: 10000,
        metadata: { user: 'test', tags: ['payment', 'lightning'] },
      };

      const mockRow = {
        idempotency_key: idempotencyKey,
        request_hash: 'hash',
        http_method: 'POST',
        endpoint_path: '/api/lightning/invoice',
        response_status: 200,
        response_body: JSON.stringify(complexBody),
        response_headers: JSON.stringify({ 'x-custom': 'value' }),
        created_at: new Date(),
        expires_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

      const result = await repository.findByKey(idempotencyKey);

      expect(result?.response_body).toEqual(complexBody);
      expect(result?.response_headers).toEqual({ 'x-custom': 'value' });
    });

    it('should handle database query errors', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      mockDb.query.mockRejectedValue(new Error('Query timeout'));

      await expect(repository.findByKey(idempotencyKey)).rejects.toThrow(
        'Query timeout'
      );
    });
  });

  describe('deleteByKey', () => {
    it('should delete existing cache entry', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteByKey(idempotencyKey);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM idempotency_cache'),
        [idempotencyKey]
      );
    });

    it('should return false for non-existent key', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteByKey(idempotencyKey);

      expect(result).toBe(false);
    });

    it('should handle delete errors', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      mockDb.query.mockRejectedValue(new Error('Permission denied'));

      await expect(repository.deleteByKey(idempotencyKey)).rejects.toThrow(
        'Permission denied'
      );
    });
  });

  describe('cleanupExpired', () => {
    it('should delete all expired entries', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 42 });

      const stats = await repository.cleanupExpired();

      expect(stats.deleted_count).toBe(42);
      expect(stats.cleanup_at).toBeInstanceOf(Date);
      expect(stats.duration_ms).toBeGreaterThanOrEqual(0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM idempotency_cache[\s\S]*WHERE expires_at/i)
      );
    });

    it('should return zero when no expired entries', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const stats = await repository.cleanupExpired();

      expect(stats.deleted_count).toBe(0);
    });

    it('should measure cleanup duration', async () => {
      mockDb.query.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ rowCount: 10 }), 50)
          )
      );

      const stats = await repository.cleanupExpired();

      expect(stats.duration_ms).toBeGreaterThanOrEqual(50);
      expect(stats.duration_ms).toBeLessThan(200); // Reasonable upper bound
    });

    it('should handle cleanup errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Disk full'));

      await expect(repository.cleanupExpired()).rejects.toThrow('Disk full');
    });
  });

  describe('countEntries', () => {
    it('should count total cache entries', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '150' }] });

      const count = await repository.countEntries();

      expect(count).toBe(150);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT COUNT\(\*\).*FROM idempotency_cache/i)
      );
    });

    it('should return zero for empty cache', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] });

      const count = await repository.countEntries();

      expect(count).toBe(0);
    });

    it('should handle count query errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database unavailable'));

      await expect(repository.countEntries()).rejects.toThrow(
        'Database unavailable'
      );
    });
  });

  describe('findExpiredKeys', () => {
    it('should find all expired keys', async () => {
      const expiredKeys = [
        { idempotency_key: '550e8400-e29b-41d4-a716-446655440001' },
        { idempotency_key: '550e8400-e29b-41d4-a716-446655440002' },
        { idempotency_key: '550e8400-e29b-41d4-a716-446655440003' },
      ];

      mockDb.query.mockResolvedValue({ rows: expiredKeys });

      const keys = await repository.findExpiredKeys();

      expect(keys).toHaveLength(3);
      expect(keys).toEqual([
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
      ]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT idempotency_key[\s\S]*FROM idempotency_cache[\s\S]*WHERE expires_at/i)
      );
    });

    it('should return empty array when no expired keys', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const keys = await repository.findExpiredKeys();

      expect(keys).toEqual([]);
    });
  });
});
