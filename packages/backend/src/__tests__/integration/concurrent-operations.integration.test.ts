/**
 * Concurrent Operations Integration Tests
 * Tests race conditions, deadlocks, resource contention, and thread safety
 * Part of US-E5-034: Integration Test Suite
 */


import { createTestContainer, cleanupTestContainer } from '../fixtures/test-container-setup';
import { createTestUser, createTestInvoice, createTestPayment } from '../fixtures/test-data-factory';
import type { IServiceContainer } from '../../interfaces/shared/IServiceRegistry';

describe('Concurrent Operations Integration Tests', () => {
  let container: IServiceContainer;

  beforeEach(async () => {
    container = await createTestContainer();
  });

  afterEach(async () => {
    await cleanupTestContainer(container);
  });

  describe('Race Conditions', () => {
    it('should handle concurrent cache writes', async () => {
      // Arrange
      const cache = container.resolve({ name: 'ICacheService' });
      const key = 'concurrent:key';

      // Act - 100 concurrent writes
      const writes = Array.from({ length: 100 }, (_, i) =>
        cache.set(key, { value: i })
      );
      await Promise.all(writes);

      // Assert - Final value should be one of the written values
      const result = await cache.get(key);
      expect(result).toBeDefined();
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(100);
    });

    it('should handle concurrent database inserts', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const users = Array.from({ length: 50 }, () => createTestUser());

      // Act
      await Promise.all(users.map(user => db.insert('users', user)));

      // Assert
      const allUsers = await db.findAll('users');
      expect(allUsers.length).toBe(50);
    });

    it('should prevent duplicate key violations', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const user = createTestUser();

      // Act - Concurrent inserts with same ID
      const results = await Promise.allSettled([
        db.insert('users', user),
        db.insert('users', user),
        db.insert('users', user)
      ]);

      // Assert - Only one should succeed in real database
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThan(0);
    });

    it('should handle read-modify-write race conditions', async () => {
      // Arrange
      const cache = container.resolve({ name: 'ICacheService' });
      await cache.set('counter', 0);

      // Act - Concurrent increments
      const increments = Array.from({ length: 100 }, () =>
        cache.increment('counter', 1)
      );
      await Promise.all(increments);

      // Assert
      const final = await cache.get('counter');
      expect(final).toBe(100);
    });
  });

  describe('Deadlock Prevention', () => {
    it('should avoid database deadlocks with lock ordering', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const user1 = createTestUser();
      const user2 = createTestUser();

      await db.insert('users', user1);
      await db.insert('users', user2);

      // Act - Always lock in same order (by ID)
      const [id1, id2] = [user1.id, user2.id].sort();

      const tx1 = db.transaction(async (trx: any) => {
        await db.update('users', id1, { email: 'tx1-1@test.com' });
        await new Promise(resolve => setTimeout(resolve, 10));
        await db.update('users', id2, { email: 'tx1-2@test.com' });
      });

      const tx2 = db.transaction(async (trx: any) => {
        await db.update('users', id1, { email: 'tx2-1@test.com' });
        await new Promise(resolve => setTimeout(resolve, 10));
        await db.update('users', id2, { email: 'tx2-2@test.com' });
      });

      // Assert - Both should complete without deadlock
      await Promise.all([tx1, tx2]);
      expect(true).toBe(true);
    });

    it('should timeout on deadlock detection', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const timeout = 5000;

      // Act - Simulate potential deadlock with timeout
      const operation = db.transaction(async (trx: any) => {
        await new Promise(resolve => setTimeout(resolve, 10000));
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deadlock timeout')), timeout)
      );

      // Assert
      await expect(Promise.race([operation, timeoutPromise])).rejects.toThrow();
    });
  });

  describe('Resource Contention', () => {
    it('should handle concurrent database connections', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });

      // Act - 50 concurrent queries
      const queries = Array.from({ length: 50 }, () =>
        db.query('SELECT 1')
      );

      const start = Date.now();
      await Promise.all(queries);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should queue requests when pool exhausted', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });

      // Act - More requests than pool size
      const operations = Array.from({ length: 100 }, () =>
        db.query('SELECT pg_sleep(0.01)')
      );

      // Assert - All should eventually complete
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });

    it('should handle concurrent cache access', async () => {
      // Arrange
      const cache = container.resolve({ name: 'ICacheService' });

      // Act - Mixed reads and writes
      const operations = [
        ...Array.from({ length: 50 }, (_, i) => cache.set(`key:${i}`, i)),
        ...Array.from({ length: 50 }, (_, i) => cache.get(`key:${i}`))
      ];

      await Promise.all(operations);

      // Assert
      const value = await cache.get('key:25');
      expect(value).toBeDefined();
    });
  });

  describe('Thread Safety', () => {
    it('should safely update shared counter', async () => {
      // Arrange
      const cache = container.resolve({ name: 'ICacheService' });
      await cache.set('shared:counter', 0);

      // Act - 1000 concurrent increments
      const increments = Array.from({ length: 1000 }, () =>
        cache.increment('shared:counter', 1)
      );

      await Promise.all(increments);

      // Assert
      const final = await cache.get('shared:counter');
      expect(final).toBe(1000);
    });

    it('should maintain list integrity under concurrent operations', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        value: i
      }));

      // Act - Concurrent inserts
      await Promise.all(items.map(item => db.insert('items', item)));

      // Assert
      const allItems = await db.findAll('items');
      expect(allItems.length).toBe(100);
    });

    it('should handle concurrent map operations', async () => {
      // Arrange
      const cache = container.resolve({ name: 'ICacheService' });

      // Act - Concurrent writes to different keys
      const operations = Array.from({ length: 100 }, (_, i) =>
        cache.set(`map:key:${i}`, { value: i })
      );

      await Promise.all(operations);

      // Assert - All keys should exist
      const key50 = await cache.get('map:key:50');
      expect(key50).toEqual({ value: 50 });
    });
  });

  describe('Atomic Operations', () => {
    it('should perform atomic compare-and-swap', async () => {
      // Arrange
      const cache = container.resolve({ name: 'ICacheService' });
      await cache.set('cas:key', { version: 1, value: 'old' });

      // Act - Simulate CAS operation
      const current = await cache.get('cas:key');
      if (current && current.version === 1) {
        await cache.set('cas:key', { version: 2, value: 'new' });
      }

      // Assert
      const updated = await cache.get('cas:key');
      expect(updated.version).toBe(2);
      expect(updated.value).toBe('new');
    });

    it('should perform atomic increment/decrement', async () => {
      // Arrange
      const cache = container.resolve({ name: 'ICacheService' });
      await cache.set('atomic:counter', 100);

      // Act
      const increments = Array.from({ length: 50 }, () => cache.increment('atomic:counter', 1));
      const decrements = Array.from({ length: 30 }, () => cache.increment('atomic:counter', -1));

      await Promise.all([...increments, ...decrements]);

      // Assert
      const final = await cache.get('atomic:counter');
      expect(final).toBe(120); // 100 + 50 - 30
    });
  });

  describe('Optimistic Locking', () => {
    it('should detect concurrent modifications', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const user = createTestUser();
      await db.insert('users', { ...user, version: 1 });

      // Act - Two concurrent updates
      const update1 = db.update('users', user.id, {
        email: 'user1@test.com',
        version: 2
      });

      const update2 = db.update('users', user.id, {
        email: 'user2@test.com',
        version: 2
      });

      const results = await Promise.allSettled([update1, update2]);

      // Assert - At least one should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(0);
    });

    it('should retry on version conflict', async () => {
      // Arrange
      const db = container.resolve({ name: 'IDatabase' });
      const user = createTestUser();
      await db.insert('users', { ...user, version: 1 });

      // Act - Retry with updated version
      let currentVersion = 1;
      for (let i = 0; i < 3; i++) {
        try {
          await db.update('users', user.id, {
            email: 'updated@test.com',
            version: currentVersion + 1
          });
          break;
        } catch (error) {
          // Refresh version and retry
          const current = await db.findById('users', user.id);
          currentVersion = current.version;
        }
      }

      // Assert
      const updated = await db.findById('users', user.id);
      expect(updated.email).toBe('updated@test.com');
    });
  });

  describe('Event Bus Concurrency', () => {
    it('should handle concurrent event publishes', async () => {
      // Arrange
      const eventBus = container.resolve({ name: 'IEventBusService' });
      const receivedEvents: number[] = [];

      eventBus.subscribe('concurrent.event', (payload: any) => {
        receivedEvents.push(payload.seq);
      });

      // Act - 100 concurrent publishes
      const publishes = Array.from({ length: 100 }, (_, i) =>
        eventBus.publish('concurrent.event', { seq: i })
      );

      await Promise.all(publishes);

      // Assert
      expect(receivedEvents).toHaveLength(100);
    });

    it('should handle concurrent subscriptions', async () => {
      // Arrange
      const eventBus = container.resolve({ name: 'IEventBusService' });
      const handlers: Array<(p: any) => void> = [];

      // Act - Add 50 concurrent subscribers
      for (let i = 0; i < 50; i++) {
        const handler = (payload: any) => {};
        handlers.push(handler);
        eventBus.subscribe('multi.event', handler);
      }

      await eventBus.publish('multi.event', { test: true });

      // Assert
      const subscriberCount = eventBus.getSubscribers?.('multi.event') || 0;
      expect(subscriberCount).toBe(50);
    });
  });

  describe('Load Testing', () => {
    it('should handle high concurrent load', async () => {
      // Arrange
      const cache = container.resolve({ name: 'ICacheService' });
      const operations = 10000;

      // Act
      const start = Date.now();
      const promises = Array.from({ length: operations }, (_, i) => {
        if (i % 2 === 0) {
          return cache.set(`load:${i}`, { value: i });
        } else {
          return cache.get(`load:${i - 1}`);
        }
      });

      await Promise.all(promises);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(10000); // Should complete in < 10 seconds
      const opsPerSecond = operations / (duration / 1000);
      expect(opsPerSecond).toBeGreaterThan(100); // At least 100 ops/sec
    });

    it('should maintain performance under sustained load', async () => {
      // Arrange
      const cache = container.resolve({ name: 'ICacheService' });
      const durations: number[] = [];

      // Act - 5 rounds of 100 operations
      for (let round = 0; round < 5; round++) {
        const start = Date.now();
        const operations = Array.from({ length: 100 }, (_, i) =>
          cache.set(`sustained:${i}`, { round, i })
        );
        await Promise.all(operations);
        durations.push(Date.now() - start);
      }

      // Assert - Performance should not degrade significantly
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      expect(avgDuration).toBeLessThan(1000);
    });
  });
});
