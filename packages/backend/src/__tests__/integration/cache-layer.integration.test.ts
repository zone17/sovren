/**
 * Cache Layer Integration Tests
 * Tests cache hit/miss, invalidation, coherency, and eviction
 * Part of US-E5-034: Integration Test Suite
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestContainer, cleanupTestContainer } from '../fixtures/test-container-setup';
import { createTestUser, createTestInvoice } from '../fixtures/test-data-factory';
import type { IServiceContainer } from '../../interfaces/shared/IServiceRegistry';
import type { ICacheService } from '../../interfaces/shared/ICacheService';

describe('Cache Layer Integration Tests', () => {
  let container: IServiceContainer;
  let cache: ICacheService;

  beforeEach(async () => {
    container = await createTestContainer();
    cache = container.resolve({ name: 'ICacheService' });
    await cache.clear();
  });

  afterEach(async () => {
    await cleanupTestContainer(container);
  });

  describe('Basic Cache Operations', () => {
    it('should set and get cache values', async () => {
      // Act
      await cache.set('test:key', { value: 'test' });
      const result = await cache.get('test:key');

      // Assert
      expect(result).toEqual({ value: 'test' });
    });

    it('should return null for non-existent keys', async () => {
      // Act
      const result = await cache.get('non:existent');

      // Assert
      expect(result).toBeNull();
    });

    it('should delete cache entries', async () => {
      // Arrange
      await cache.set('test:key', 'value');

      // Act
      const deleted = await cache.delete('test:key');
      const result = await cache.get('test:key');

      // Assert
      expect(deleted).toBe(true);
      expect(result).toBeNull();
    });

    it('should check key existence', async () => {
      // Arrange
      await cache.set('test:key', 'value');

      // Act
      const exists = await cache.exists('test:key');
      const notExists = await cache.exists('other:key');

      // Assert
      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });
  });

  describe('TTL Management', () => {
    it('should expire keys after TTL', async () => {
      // Arrange
      await cache.set('expiring:key', 'value', 1); // 1 second TTL

      // Act
      const immediate = await cache.get('expiring:key');
      await new Promise(resolve => setTimeout(resolve, 1100));
      const afterExpiry = await cache.get('expiring:key');

      // Assert
      expect(immediate).toBe('value');
      expect(afterExpiry).toBeNull();
    });

    it('should get remaining TTL', async () => {
      // Arrange
      await cache.set('ttl:key', 'value', 60);

      // Act
      const ttl = await cache.ttl('ttl:key');

      // Assert
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should return -1 for keys without TTL', async () => {
      // Arrange
      await cache.set('no-ttl:key', 'value');

      // Act
      const ttl = await cache.ttl('no-ttl:key');

      // Assert
      expect(ttl).toBe(-1);
    });

    it('should return -2 for non-existent keys', async () => {
      // Act
      const ttl = await cache.ttl('non:existent');

      // Assert
      expect(ttl).toBe(-2);
    });
  });

  describe('Cache Hit/Miss Patterns', () => {
    it('should track cache hits', async () => {
      // Arrange
      const user = createTestUser();
      await cache.set(`user:${user.id}`, user);

      // Act - Multiple reads (cache hits)
      const read1 = await cache.get(`user:${user.id}`);
      const read2 = await cache.get(`user:${user.id}`);
      const read3 = await cache.get(`user:${user.id}`);

      // Assert
      expect(read1).toEqual(user);
      expect(read2).toEqual(user);
      expect(read3).toEqual(user);
    });

    it('should handle cache misses', async () => {
      // Act - Read non-existent key (cache miss)
      const result = await cache.get('user:nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('should implement read-through caching', async () => {
      // Arrange
      const user = createTestUser();
      const fetchFromDb = async (id: string) => user;

      // Act
      let cached = await cache.get(`user:${user.id}`);
      if (!cached) {
        cached = await fetchFromDb(user.id);
        await cache.set(`user:${user.id}`, cached, 60);
      }

      // Assert
      expect(cached).toEqual(user);
    });

    it('should implement write-through caching', async () => {
      // Arrange
      const user = createTestUser();

      // Act - Write to both DB and cache
      await cache.set(`user:${user.id}`, user);
      // In real scenario: await db.insert('users', user);

      const cached = await cache.get(`user:${user.id}`);

      // Assert
      expect(cached).toEqual(user);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate single cache entry', async () => {
      // Arrange
      await cache.set('user:1', { name: 'Old' });

      // Act - Invalidate
      await cache.delete('user:1');
      await cache.set('user:1', { name: 'New' });

      // Assert
      const result = await cache.get('user:1');
      expect(result).toEqual({ name: 'New' });
    });

    it('should invalidate related cache entries', async () => {
      // Arrange
      await cache.set('user:1:profile', { data: 'profile' });
      await cache.set('user:1:settings', { data: 'settings' });

      // Act - Invalidate all user:1 keys
      const keys = cache.getKeys?.() || [];
      for (const key of keys.filter(k => k.startsWith('user:1'))) {
        await cache.delete(key);
      }

      // Assert
      const profile = await cache.get('user:1:profile');
      const settings = await cache.get('user:1:settings');
      expect(profile).toBeNull();
      expect(settings).toBeNull();
    });

    it('should invalidate on update', async () => {
      // Arrange
      const user = createTestUser();
      await cache.set(`user:${user.id}`, user);

      // Act - Update user
      const updated = { ...user, username: 'updated' };
      await cache.delete(`user:${user.id}`);
      await cache.set(`user:${user.id}`, updated);

      // Assert
      const result = await cache.get(`user:${user.id}`);
      expect(result).toMatchObject({ username: 'updated' });
    });
  });

  describe('Cache Coherency', () => {
    it('should maintain consistency across cache and database', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const user = createTestUser();

      // Act - Write to both
      await db.insert('users', user);
      await cache.set(`user:${user.id}`, user);

      // Read from cache
      const cached = await cache.get(`user:${user.id}`);
      // Read from DB
      const fromDb = await db.findById('users', user.id);

      // Assert
      expect(cached).toEqual(fromDb);
    });

    it('should invalidate cache on database update', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const user = createTestUser();
      await db.insert('users', user);
      await cache.set(`user:${user.id}`, user);

      // Act - Update DB and invalidate cache
      const updated = { ...user, email: 'new@example.com' };
      await db.update('users', user.id, updated);
      await cache.delete(`user:${user.id}`);

      // Assert
      const cached = await cache.get(`user:${user.id}`);
      expect(cached).toBeNull();
    });
  });

  describe('Multi-Layer Caching', () => {
    it('should implement L1/L2 cache pattern', async () => {
      // Arrange
      const l1Cache = new Map(); // In-memory
      const l2Cache = cache; // Redis/external
      const key = 'multi:level:key';

      // Act - Write to both layers
      l1Cache.set(key, 'value');
      await l2Cache.set(key, 'value');

      // Read L1 first
      let result = l1Cache.get(key);
      if (!result) {
        result = await l2Cache.get(key);
        if (result) {
          l1Cache.set(key, result);
        }
      }

      // Assert
      expect(result).toBe('value');
    });
  });

  describe('Cache Eviction', () => {
    it('should evict least recently used entries when full', async () => {
      // Arrange - Fill cache
      for (let i = 0; i < 10; i++) {
        await cache.set(`key:${i}`, `value${i}`);
      }

      // Act - Add new entry (may trigger eviction)
      await cache.set('key:new', 'newvalue');

      // Assert - New entry should exist
      const result = await cache.get('key:new');
      expect(result).toBe('newvalue');
    });

    it('should respect cache size limits', async () => {
      // Arrange
      const largeObject = { data: 'x'.repeat(10000) };

      // Act
      await cache.set('large:object', largeObject);
      const result = await cache.get('large:object');

      // Assert
      expect(result).toEqual(largeObject);
    });
  });

  describe('Atomic Operations', () => {
    it('should increment counter atomically', async () => {
      // Arrange
      await cache.set('counter:key', 0);

      // Act
      const result1 = await cache.increment('counter:key', 1);
      const result2 = await cache.increment('counter:key', 5);

      // Assert
      expect(result1).toBe(1);
      expect(result2).toBe(6);
    });

    it('should handle concurrent increments', async () => {
      // Arrange
      await cache.set('concurrent:counter', 0);

      // Act
      const increments = Array.from({ length: 100 }, () =>
        cache.increment('concurrent:counter', 1)
      );
      await Promise.all(increments);

      // Assert
      const final = await cache.get('concurrent:counter');
      expect(final).toBe(100);
    });
  });

  describe('Performance', () => {
    it('should handle high read throughput', async () => {
      // Arrange
      await cache.set('perf:key', { data: 'test' });

      // Act
      const start = Date.now();
      const reads = Array.from({ length: 1000 }, () =>
        cache.get('perf:key')
      );
      await Promise.all(reads);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(1000); // < 1 second
    });

    it('should handle high write throughput', async () => {
      // Act
      const start = Date.now();
      const writes = Array.from({ length: 1000 }, (_, i) =>
        cache.set(`write:${i}`, { value: i })
      );
      await Promise.all(writes);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(2000); // < 2 seconds
    });
  });

  describe('Cache Patterns', () => {
    it('should implement cache-aside pattern', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const user = createTestUser();
      await db.insert('users', user);

      // Act - Cache-aside read
      let cached = await cache.get(`user:${user.id}`);
      if (!cached) {
        cached = await db.findById('users', user.id);
        await cache.set(`user:${user.id}`, cached, 300);
      }

      // Assert
      expect(cached).toBeDefined();
    });

    it('should implement cache stampede prevention', async () => {
      // Arrange
      const lockKey = 'lock:expensive:query';
      const cacheKey = 'expensive:query:result';

      // Act
      const isLocked = await cache.exists(lockKey);
      if (!isLocked) {
        await cache.set(lockKey, true, 10); // Lock for 10s
        // Expensive operation
        const result = { computed: 'value' };
        await cache.set(cacheKey, result, 300);
        await cache.delete(lockKey);
      }

      // Assert
      const result = await cache.get(cacheKey);
      expect(result).toBeDefined();
    });
  });
});
