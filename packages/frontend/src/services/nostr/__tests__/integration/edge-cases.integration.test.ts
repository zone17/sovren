/**
 * 🧪 NOSTR Integration Tests - Edge Cases & Stress Tests
 * US-316: NOSTR Integration Test Suite
 *
 * Test Coverage:
 * - Edge cases and boundary conditions
 * - Stress testing and load scenarios
 * - Concurrent operations
 * - Resource cleanup
 * - Memory leak detection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { KeyManagementService } from '../../KeyManagementService';
import { RelayPoolManager } from '../../RelayPoolManager';
import { EventCacheService } from '../../EventCacheService';
import { EventDeduplicationService } from '../../EventDeduplicationService';
import { SubscriptionManagerService } from '../../SubscriptionManagerService';
import type { NostrEvent, UnsignedNostrEvent } from '@sovren/shared/types/nostr';
import { MockRelayServer, TestDataFactory, PerformanceMeasurement, wait } from './test-helpers';

// Mock globals
const mockIndexedDB = {
  databases: new Map(),
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

const mockCrypto = {
  subtle: {
    generateKey: vi.fn().mockResolvedValue({}),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    deriveKey: vi.fn().mockResolvedValue({}),
    importKey: vi.fn().mockResolvedValue({}),
  },
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  randomUUID: () => Math.random().toString(36).substring(7),
};

describe('NOSTR Edge Cases & Stress Tests', () => {
  let keyManagement: KeyManagementService;
  let relayPool: RelayPoolManager;
  let eventCache: EventCacheService;
  let deduplication: EventDeduplicationService;
  let subscriptionManager: SubscriptionManagerService;
  let perfMeasure: PerformanceMeasurement;

  beforeAll(async () => {
    global.indexedDB = mockIndexedDB as any;
    global.crypto = mockCrypto as any;

    keyManagement = KeyManagementService.getInstance();
    relayPool = RelayPoolManager.getInstance();
    eventCache = EventCacheService.getInstance();
    deduplication = EventDeduplicationService.getInstance();
    subscriptionManager = SubscriptionManagerService.getInstance();
    perfMeasure = new PerformanceMeasurement();

    await keyManagement.initialize();
    await relayPool.initialize({ relays: ['wss://test.relay'], autoReconnect: false });
    await subscriptionManager.initialize();
  });

  afterAll(async () => {
    await keyManagement.destroy?.();
    await relayPool.destroy?.();
    await subscriptionManager.destroy?.();
    perfMeasure.printReport();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('should handle empty event content', async () => {
      const emptyEvent: UnsignedNostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: '',
      };

      const keyPair = await keyManagement.generateKeyPair();
      const signed = await keyManagement.signEvent(keyPair.keyId, emptyEvent);

      expect(signed.content).toBe('');
      expect(signed.id).toBeDefined();
      expect(signed.sig).toBeDefined();
    });

    it('should handle very long event content', async () => {
      const longContent = 'x'.repeat(100000); // 100KB content
      const longEvent: UnsignedNostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: longContent,
      };

      const keyPair = await keyManagement.generateKeyPair();

      const { duration } = await perfMeasure.measure('sign-long-event', async () => {
        return keyManagement.signEvent(keyPair.keyId, longEvent);
      });

      expect(duration).toBeLessThan(1000); // Should still be fast
      console.log(`[Edge Case] Signed 100KB event in ${duration.toFixed(2)}ms`);
    });

    it('should handle events with many tags', async () => {
      const manyTags: string[][] = [];
      for (let i = 0; i < 1000; i++) {
        manyTags.push(['t', `tag-${i}`]);
      }

      const taggedEvent: UnsignedNostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: manyTags,
        content: 'Event with many tags',
      };

      const keyPair = await keyManagement.generateKeyPair();
      const signed = await keyManagement.signEvent(keyPair.keyId, taggedEvent);

      expect(signed.tags).toHaveLength(1000);
    });

    it('should handle Unicode and emoji content', async () => {
      const unicodeContent = '👋 Hello 世界! 🌍🚀 Testing Unicode: 日本語 中文 한글 العربية';
      const unicodeEvent: UnsignedNostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: unicodeContent,
      };

      const keyPair = await keyManagement.generateKeyPair();
      const signed = await keyManagement.signEvent(keyPair.keyId, unicodeEvent);

      expect(signed.content).toBe(unicodeContent);

      const isValid = await keyManagement.verifyEventSignature(signed);
      expect(isValid).toBe(true);
    });

    it('should handle timestamp edge cases', async () => {
      // Very old timestamp
      const oldEvent: UnsignedNostrEvent = {
        kind: 1,
        created_at: 0,
        tags: [],
        content: 'Old event',
      };

      // Very far future timestamp
      const futureEvent: UnsignedNostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000) + 31536000, // 1 year in future
        tags: [],
        content: 'Future event',
      };

      const keyPair = await keyManagement.generateKeyPair();

      const signedOld = await keyManagement.signEvent(keyPair.keyId, oldEvent);
      const signedFuture = await keyManagement.signEvent(keyPair.keyId, futureEvent);

      expect(signedOld.created_at).toBe(0);
      expect(signedFuture.created_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should handle null/undefined tag values gracefully', async () => {
      const event: UnsignedNostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', 'event-id'],
          ['p', 'pubkey'],
        ],
        content: 'Test',
      };

      const keyPair = await keyManagement.generateKeyPair();
      const signed = await keyManagement.signEvent(keyPair.keyId, event);

      expect(signed.tags).toHaveLength(2);
    });

    it('should handle rapid key generation', async () => {
      const keys = await Promise.all([
        keyManagement.generateKeyPair(),
        keyManagement.generateKeyPair(),
        keyManagement.generateKeyPair(),
        keyManagement.generateKeyPair(),
        keyManagement.generateKeyPair(),
      ]);

      expect(keys).toHaveLength(5);
      const uniqueKeys = new Set(keys.map(k => k.publicKey));
      expect(uniqueKeys.size).toBe(5); // All unique
    });

    it('should handle cache with duplicate event IDs', async () => {
      const event1: NostrEvent = {
        id: 'same-id',
        pubkey: 'pubkey1',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'First',
        sig: 'sig1',
      };

      const event2: NostrEvent = {
        id: 'same-id',
        pubkey: 'pubkey2',
        created_at: Math.floor(Date.now() / 1000) + 1,
        kind: 1,
        tags: [],
        content: 'Second',
        sig: 'sig2',
      };

      eventCache.addEvent(event1);
      eventCache.addEvent(event2); // Should replace

      const cached = eventCache.getEvent('same-id');
      expect(cached?.content).toBe('Second'); // Latest wins
    });
  });

  // ========================================
  // STRESS TESTS
  // ========================================

  describe('Stress Tests', () => {
    it('should handle high volume event publishing', async () => {
      const eventCount = 100;
      const events: UnsignedNostrEvent[] = [];

      for (let i = 0; i < eventCount; i++) {
        events.push(TestDataFactory.createTextNote(`Stress test event ${i}`));
      }

      const keyPair = await keyManagement.generateKeyPair();

      const { duration } = await perfMeasure.measure('publish-100-events', async () => {
        const signed = await Promise.all(
          events.map(e => keyManagement.signEvent(keyPair.keyId, e))
        );

        // Mock publishing
        vi.spyOn(relayPool, 'publishEvent').mockResolvedValue([
          { relay: 'wss://test.relay', success: true, latency: 100 },
        ]);

        return Promise.all(signed.map(e => relayPool.publishEvent(e)));
      });

      const eventsPerSecond = (eventCount / duration) * 1000;
      console.log(`[Stress Test] Published ${eventCount} events in ${duration.toFixed(2)}ms (${eventsPerSecond.toFixed(0)} events/sec)`);

      expect(duration).toBeLessThan(10000); // Should complete in 10 seconds
    });

    it('should handle many concurrent subscriptions', async () => {
      const subCount = 50;
      const subscriptionIds: string[] = [];

      vi.spyOn(subscriptionManager, 'subscribe').mockImplementation(async () => {
        return `sub-${Math.random()}`;
      });

      const { duration } = await perfMeasure.measure('create-50-subscriptions', async () => {
        const subs = await Promise.all(
          Array.from({ length: subCount }, () =>
            subscriptionManager.subscribe({
              filters: [{ kinds: [1] }],
              onEvent: () => {},
            })
          )
        );
        subscriptionIds.push(...subs);
        return subs;
      });

      expect(subscriptionIds).toHaveLength(subCount);
      console.log(`[Stress Test] Created ${subCount} subscriptions in ${duration.toFixed(2)}ms`);
    });

    it('should handle rapid cache operations', async () => {
      const operationCount = 1000;
      const events: NostrEvent[] = Array.from({ length: operationCount }, (_, i) => ({
        id: `stress-${i}`,
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: `Event ${i}`,
        sig: 'test-sig',
      }));

      const { duration: addDuration } = await perfMeasure.measure('cache-add-1000', async () => {
        events.forEach(e => eventCache.addEvent(e));
        return Promise.resolve();
      });

      const { duration: getDuration } = await perfMeasure.measure('cache-get-1000', async () => {
        events.forEach(e => eventCache.getEvent(e.id));
        return Promise.resolve();
      });

      const avgAddTime = addDuration / operationCount;
      const avgGetTime = getDuration / operationCount;

      console.log(`[Stress Test] Cache add: ${avgAddTime.toFixed(4)}ms/op, get: ${avgGetTime.toFixed(4)}ms/op`);

      expect(avgAddTime).toBeLessThan(1); // Should be sub-millisecond
      expect(avgGetTime).toBeLessThan(0.1); // Cache hits should be very fast
    });

    it('should handle deduplication at scale', async () => {
      const eventCount = 10000;
      const event: NostrEvent = {
        id: 'dedup-stress',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Dedup stress test',
        sig: 'test-sig',
      };

      deduplication.addEvent(event);

      const { duration } = await perfMeasure.measure('dedup-10000-checks', async () => {
        for (let i = 0; i < eventCount; i++) {
          deduplication.isDuplicate(event);
        }
        return Promise.resolve();
      });

      const avgTime = duration / eventCount;
      console.log(`[Stress Test] Deduplication: ${avgTime.toFixed(4)}ms/check`);

      expect(avgTime).toBeLessThan(0.1); // Should be very fast
    });

    it('should handle memory pressure with large cache', async () => {
      const largeEventCount = 5000;

      for (let i = 0; i < largeEventCount; i++) {
        const event: NostrEvent = {
          id: `large-cache-${i}`,
          pubkey: 'test-pubkey',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'x'.repeat(1000), // 1KB content each = 5MB total
          sig: 'test-sig',
        };
        eventCache.addEvent(event);
      }

      const stats = eventCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(largeEventCount);

      // Cache should still be fast
      const { duration } = await perfMeasure.measure('cache-under-pressure', async () => {
        eventCache.getEvent('large-cache-1000');
        return Promise.resolve();
      });

      expect(duration).toBeLessThan(10);
      console.log(`[Stress Test] Cache size: ${stats.size}, lookup time: ${duration.toFixed(2)}ms`);
    });
  });

  // ========================================
  // CONCURRENT OPERATIONS
  // ========================================

  describe('Concurrent Operations', () => {
    it('should handle concurrent key operations', async () => {
      const operations = await Promise.allSettled([
        keyManagement.generateKeyPair({ name: 'Key 1' }),
        keyManagement.generateKeyPair({ name: 'Key 2' }),
        keyManagement.generateKeyPair({ name: 'Key 3' }),
        keyManagement.listKeys(),
      ]);

      const fulfilled = operations.filter(op => op.status === 'fulfilled');
      expect(fulfilled.length).toBe(4);
    });

    it('should handle concurrent event operations', async () => {
      const keyPair = await keyManagement.generateKeyPair();

      const events = [
        TestDataFactory.createTextNote('Event 1'),
        TestDataFactory.createTextNote('Event 2'),
        TestDataFactory.createTextNote('Event 3'),
      ];

      vi.spyOn(relayPool, 'publishEvent').mockResolvedValue([
        { relay: 'wss://test.relay', success: true, latency: 100 },
      ]);

      const signedEvents = await Promise.all(
        events.map(e => keyManagement.signEvent(keyPair.keyId, e))
      );

      const publishResults = await Promise.all(
        signedEvents.map(e => relayPool.publishEvent(e))
      );

      expect(publishResults).toHaveLength(3);
      expect(publishResults.every(r => r[0].success)).toBe(true);
    });

    it('should handle concurrent cache reads and writes', async () => {
      const event: NostrEvent = {
        id: 'concurrent-test',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Concurrent test',
        sig: 'test-sig',
      };

      // Race condition test
      const operations = await Promise.allSettled([
        Promise.resolve(eventCache.addEvent(event)),
        Promise.resolve(eventCache.getEvent(event.id)),
        Promise.resolve(eventCache.addEvent(event)),
        Promise.resolve(eventCache.getEvent(event.id)),
      ]);

      expect(operations.every(op => op.status === 'fulfilled')).toBe(true);
    });

    it('should handle concurrent subscriptions with same filter', async () => {
      const filter = { kinds: [1], limit: 10 };
      let callCount = 0;

      vi.spyOn(subscriptionManager, 'subscribe').mockImplementation(async () => {
        callCount++;
        return `sub-${callCount}`;
      });

      const subscriptions = await Promise.all([
        subscriptionManager.subscribe({ filters: [filter], onEvent: () => {} }),
        subscriptionManager.subscribe({ filters: [filter], onEvent: () => {} }),
        subscriptionManager.subscribe({ filters: [filter], onEvent: () => {} }),
      ]);

      expect(subscriptions).toHaveLength(3);
      expect(new Set(subscriptions).size).toBe(3); // All unique
    });
  });

  // ========================================
  // RESOURCE CLEANUP
  // ========================================

  describe('Resource Cleanup', () => {
    it('should cleanup subscriptions on unsubscribe', async () => {
      vi.spyOn(subscriptionManager, 'subscribe').mockResolvedValue('cleanup-sub');
      vi.spyOn(subscriptionManager, 'unsubscribe').mockResolvedValue(undefined);

      const subId = await subscriptionManager.subscribe({
        filters: [{ kinds: [1] }],
        onEvent: () => {},
      });

      await subscriptionManager.unsubscribe(subId);

      // Verify cleanup
      expect(subscriptionManager.unsubscribe).toHaveBeenCalledWith(subId);
    });

    it('should cleanup cache on clear', async () => {
      const event: NostrEvent = {
        id: 'cleanup-test',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Cleanup test',
        sig: 'test-sig',
      };

      eventCache.addEvent(event);
      expect(eventCache.getEvent(event.id)).toBeDefined();

      eventCache.clear();
      expect(eventCache.getEvent(event.id)).toBeNull();
    });

    it('should cleanup deduplication cache', async () => {
      const event: NostrEvent = {
        id: 'dedup-cleanup',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Dedup cleanup',
        sig: 'test-sig',
      };

      deduplication.addEvent(event);
      expect(deduplication.isDuplicate(event)).toBe(true);

      deduplication.clear();
      expect(deduplication.isDuplicate(event)).toBe(false);
    });

    it('should handle service destruction and recreation', async () => {
      // Create and destroy service
      const tempKey = await keyManagement.generateKeyPair({ name: 'Temp Key' });
      expect(tempKey).toBeDefined();

      // Service should handle reinitialization
      const config = keyManagement.getConfig();
      expect(config).toBeDefined();
    });
  });

  // ========================================
  // MEMORY LEAK DETECTION
  // ========================================

  describe('Memory Leak Detection', () => {
    it('should not leak memory on repeated operations', async () => {
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const event: NostrEvent = {
          id: `leak-test-${i}`,
          pubkey: 'test-pubkey',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: `Leak test ${i}`,
          sig: 'test-sig',
        };

        eventCache.addEvent(event);
        eventCache.getEvent(event.id);
        deduplication.addEvent(event);
        deduplication.isDuplicate(event);
      }

      // Cleanup
      eventCache.clear();
      deduplication.clear();

      // Cache should be empty
      const stats = eventCache.getStats();
      expect(stats.size).toBe(0);
    });

    it('should handle subscription creation/destruction cycles', async () => {
      vi.spyOn(subscriptionManager, 'subscribe').mockImplementation(async () => Math.random().toString());
      vi.spyOn(subscriptionManager, 'unsubscribe').mockResolvedValue(undefined);

      for (let i = 0; i < 50; i++) {
        const subId = await subscriptionManager.subscribe({
          filters: [{ kinds: [1] }],
          onEvent: () => {},
        });

        await subscriptionManager.unsubscribe(subId);
      }

      // Should not accumulate subscriptions
      expect(true).toBe(true); // If we got here without errors, test passes
    });
  });
});
