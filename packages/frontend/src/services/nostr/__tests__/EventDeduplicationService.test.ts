/**
 * EventDeduplicationService Tests
 *
 * US-307: Implement Event Deduplication System
 * Epic 003: NOSTR Consolidation
 *
 * Test Coverage:
 * - Event ID-based deduplication ✓
 * - Content-based deduplication ✓
 * - Replaceable event handling (NIP-01, NIP-16, NIP-33) ✓
 * - Bloom filter performance ✓
 * - Late arrival window handling ✓
 * - Memory efficiency ✓
 * - Metrics tracking ✓
 *
 * Target: ≥90% coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { NostrEvent } from '@shared/types/nostr/index';
import { NostrEventKind } from '@shared/types/nostr/index';
import { EventDeduplicationService, DeduplicationConfig } from '../EventDeduplicationService';

describe('EventDeduplicationService', () => {
  let service: EventDeduplicationService;

  // Helper: Create mock event
  const createEvent = (overrides: Partial<NostrEvent> = {}): NostrEvent => ({
    id: `event_${Math.random().toString(36).substring(2, 15)}`,
    pubkey: 'pubkey_test_12345678901234567890123456789012',
    created_at: Math.floor(Date.now() / 1000),
    kind: NostrEventKind.TEXT_NOTE,
    tags: [],
    content: 'Test content',
    sig: 'sig_1234567890123456789012345678901234567890123456789012345678901234',
    ...overrides,
  });

  beforeEach(() => {
    service = new EventDeduplicationService();
  });

  afterEach(async () => {
    await service.destroy();
  });

  // ========================================
  // INITIALIZATION
  // ========================================

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const config: DeduplicationConfig = {
        maxCacheSize: 5000,
        bloomFilterSize: 50000,
        lateArrivalWindow: 10000,
        enableContentDedup: false,
        enableBloomFilter: false,
      };

      const customService = new EventDeduplicationService(config);
      expect(customService).toBeDefined();
    });

    it('should accept singleton instance', () => {
      const instance1 = EventDeduplicationService.getInstance();
      const instance2 = EventDeduplicationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ========================================
  // EVENT ID DEDUPLICATION
  // ========================================

  describe('Event ID Deduplication', () => {
    it('should allow first occurrence of event', async () => {
      const event = createEvent();
      const result = await service.checkDuplicate(event);

      expect(result.isDuplicate).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('should detect duplicate event by ID', async () => {
      const event = createEvent();

      // First occurrence
      const result1 = await service.checkDuplicate(event);
      expect(result1.isDuplicate).toBe(false);

      // Second occurrence (duplicate)
      const result2 = await service.checkDuplicate(event);
      expect(result2.isDuplicate).toBe(true);
      expect(result2.reason).toBe('duplicate_id');
    });

    it('should track relay information for duplicates', async () => {
      const event = createEvent();

      await service.checkDuplicate(event, 'wss://relay1.com');
      const result = await service.checkDuplicate(event, 'wss://relay2.com');

      expect(result.isDuplicate).toBe(true);
      expect(result.originalRelay).toBe('wss://relay1.com');
      expect(result.seenOn).toContain('wss://relay1.com');
    });

    it('should handle unsigned events without ID', async () => {
      const event = createEvent({ id: '' });

      const result = await service.checkDuplicate(event);

      // Without ID, should fall back to content-based dedup
      expect(result.isDuplicate).toBe(false);
    });
  });

  // ========================================
  // CONTENT-BASED DEDUPLICATION
  // ========================================

  describe('Content-Based Deduplication', () => {
    it('should detect duplicate by content hash', async () => {
      const content = 'Identical content for testing';
      const event1 = createEvent({ id: 'id1', content });
      const event2 = createEvent({ id: 'id2', content });

      await service.checkDuplicate(event1);
      const result = await service.checkDuplicate(event2);

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('duplicate_content');
    });

    it('should not flag different content as duplicate', async () => {
      const event1 = createEvent({ content: 'First message' });
      const event2 = createEvent({ content: 'Second message' });

      await service.checkDuplicate(event1);
      const result = await service.checkDuplicate(event2);

      expect(result.isDuplicate).toBe(false);
    });

    it('should consider pubkey in content deduplication', async () => {
      const content = 'Same content, different author';
      const event1 = createEvent({
        id: 'id1',
        pubkey: 'pubkey1_123456789012345678901234567890123',
        content,
      });
      const event2 = createEvent({
        id: 'id2',
        pubkey: 'pubkey2_123456789012345678901234567890123',
        content,
      });

      await service.checkDuplicate(event1);
      const result = await service.checkDuplicate(event2);

      // Different authors = not duplicate
      expect(result.isDuplicate).toBe(false);
    });

    it('should disable content dedup when configured', async () => {
      const customService = new EventDeduplicationService({
        enableContentDedup: false,
      });

      const content = 'Same content';
      const event1 = createEvent({ id: 'id1', content });
      const event2 = createEvent({ id: 'id2', content });

      await customService.checkDuplicate(event1);
      const result = await customService.checkDuplicate(event2);

      // Should not detect content duplicate
      expect(result.isDuplicate).toBe(false);
    });
  });

  // ========================================
  // REPLACEABLE EVENT HANDLING
  // ========================================

  describe('Replaceable Events (NIP-01)', () => {
    it('should handle metadata events (kind 0)', async () => {
      const pubkey = 'creator_pubkey_12345678901234567890123';

      const event1 = createEvent({
        kind: NostrEventKind.SET_METADATA,
        pubkey,
        created_at: 1000,
        content: JSON.stringify({ name: 'Old Name' }),
      });

      const event2 = createEvent({
        kind: NostrEventKind.SET_METADATA,
        pubkey,
        created_at: 2000,
        content: JSON.stringify({ name: 'New Name' }),
      });

      // Add first metadata
      const result1 = await service.checkDuplicate(event1);
      expect(result1.isDuplicate).toBe(false);

      // Add newer metadata (should replace)
      const result2 = await service.checkDuplicate(event2);
      expect(result2.isDuplicate).toBe(false);
      expect(result2.reason).toBe('replaced_older');
    });

    it('should reject older replaceable events', async () => {
      const pubkey = 'creator_pubkey_12345678901234567890123';

      const newerEvent = createEvent({
        kind: NostrEventKind.SET_METADATA,
        pubkey,
        created_at: 2000,
      });

      const olderEvent = createEvent({
        kind: NostrEventKind.SET_METADATA,
        pubkey,
        created_at: 1000,
      });

      // Add newer first
      await service.checkDuplicate(newerEvent);

      // Try to add older (should be rejected)
      const result = await service.checkDuplicate(olderEvent);
      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('older_replaceable');
    });

    it('should handle contact list events (kind 3)', async () => {
      const pubkey = 'creator_pubkey_12345678901234567890123';

      const oldContacts = createEvent({
        kind: NostrEventKind.CONTACTS,
        pubkey,
        created_at: 1000,
      });

      const newContacts = createEvent({
        kind: NostrEventKind.CONTACTS,
        pubkey,
        created_at: 2000,
      });

      await service.checkDuplicate(oldContacts);
      const result = await service.checkDuplicate(newContacts);

      expect(result.isDuplicate).toBe(false);
      expect(result.reason).toBe('replaced_older');
    });

    it('should handle different pubkeys separately for replaceable events', async () => {
      const event1 = createEvent({
        kind: NostrEventKind.SET_METADATA,
        pubkey: 'pubkey1_123456789012345678901234567890123',
        created_at: 1000,
      });

      const event2 = createEvent({
        kind: NostrEventKind.SET_METADATA,
        pubkey: 'pubkey2_123456789012345678901234567890123',
        created_at: 2000,
      });

      const result1 = await service.checkDuplicate(event1);
      const result2 = await service.checkDuplicate(event2);

      // Different pubkeys = both allowed
      expect(result1.isDuplicate).toBe(false);
      expect(result2.isDuplicate).toBe(false);
    });
  });

  // ========================================
  // PARAMETERIZED REPLACEABLE EVENTS (NIP-33)
  // ========================================

  describe('Parameterized Replaceable Events (NIP-33)', () => {
    it('should handle parameterized replaceable events with d tag', async () => {
      const pubkey = 'creator_pubkey_12345678901234567890123';

      const event1 = createEvent({
        kind: 30023, // Long-form content
        pubkey,
        tags: [['d', 'my-article']],
        created_at: 1000,
      });

      const event2 = createEvent({
        kind: 30023,
        pubkey,
        tags: [['d', 'my-article']],
        created_at: 2000,
      });

      await service.checkDuplicate(event1);
      const result = await service.checkDuplicate(event2);

      expect(result.isDuplicate).toBe(false);
      expect(result.reason).toBe('replaced_older');
    });

    it('should allow different d tags for same kind', async () => {
      const pubkey = 'creator_pubkey_12345678901234567890123';

      const article1 = createEvent({
        kind: 30023,
        pubkey,
        tags: [['d', 'article-1']],
        created_at: 1000,
      });

      const article2 = createEvent({
        kind: 30023,
        pubkey,
        tags: [['d', 'article-2']],
        created_at: 1000,
      });

      const result1 = await service.checkDuplicate(article1);
      const result2 = await service.checkDuplicate(article2);

      // Different d tags = both allowed
      expect(result1.isDuplicate).toBe(false);
      expect(result2.isDuplicate).toBe(false);
    });

    it('should handle missing d tag in parameterized replaceable events', async () => {
      const pubkey = 'creator_pubkey_12345678901234567890123';

      const event1 = createEvent({
        kind: 30023,
        pubkey,
        tags: [], // No d tag
        created_at: 1000,
      });

      const event2 = createEvent({
        kind: 30023,
        pubkey,
        tags: [], // No d tag
        created_at: 2000,
      });

      await service.checkDuplicate(event1);
      const result = await service.checkDuplicate(event2);

      // Without d tag, treated as empty string identifier
      expect(result.isDuplicate).toBe(false);
      expect(result.reason).toBe('replaced_older');
    });
  });

  // ========================================
  // LATE ARRIVAL WINDOW
  // ========================================

  describe('Late Arrival Window', () => {
    it('should handle events within late arrival window', async () => {
      const event = createEvent();

      // First arrival
      await service.checkDuplicate(event, 'wss://relay1.com');

      // Wait 2 seconds (within default 5s window)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Late arrival from another relay
      const result = await service.checkDuplicate(event, 'wss://relay2.com');

      expect(result.isDuplicate).toBe(true);
      expect(result.seenOn).toContain('wss://relay1.com');
      expect(result.seenOn).toContain('wss://relay2.com');
    });

    it('should clean up after late arrival window expires', async () => {
      const customService = new EventDeduplicationService({
        lateArrivalWindow: 100, // 100ms
      });

      const event = createEvent();

      await customService.checkDuplicate(event);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Check should still detect as duplicate (event in cache)
      const result = await customService.checkDuplicate(event);
      expect(result.isDuplicate).toBe(true);
    });
  });

  // ========================================
  // BLOOM FILTER
  // ========================================

  describe('Bloom Filter', () => {
    it('should use bloom filter for fast lookup', async () => {
      const service = new EventDeduplicationService({
        enableBloomFilter: true,
      });

      const event = createEvent();

      await service.checkDuplicate(event);
      const result = await service.checkDuplicate(event);

      expect(result.isDuplicate).toBe(true);
    });

    it('should handle bloom filter false positives', async () => {
      // Bloom filter may have false positives but cache lookup prevents incorrect duplicates
      const service = new EventDeduplicationService({
        enableBloomFilter: true,
        bloomFilterSize: 1000, // Reasonable size to minimize collisions
      });

      const events = Array.from({ length: 10 }, (_, i) =>
        createEvent({ content: `Unique content ${i}` })
      );

      for (const event of events) {
        const result = await service.checkDuplicate(event);
        // First occurrence should not be duplicate (even with bloom filter collisions)
        expect(result.isDuplicate).toBe(false);
      }
    });

    it('should work without bloom filter', async () => {
      const service = new EventDeduplicationService({
        enableBloomFilter: false,
      });

      const event = createEvent();

      await service.checkDuplicate(event);
      const result = await service.checkDuplicate(event);

      expect(result.isDuplicate).toBe(true);
    });
  });

  // ========================================
  // BATCH DEDUPLICATION
  // ========================================

  describe('Batch Deduplication', () => {
    it('should deduplicate batch of events', async () => {
      const event1 = createEvent({ content: 'Event 1 content' });
      const event2 = createEvent({ content: 'Event 2 content' });
      const event3 = createEvent({ content: 'Event 3 content' });

      const events = [
        event1, // First occurrence of event1
        event2, // First occurrence of event2
        event1, // Duplicate of event1
        event3, // First occurrence of event3
        event2, // Duplicate of event2
      ];

      const results = await service.checkDuplicateBatch(events);

      expect(results).toHaveLength(5);
      expect(results[0].isDuplicate).toBe(false); // event1 first
      expect(results[1].isDuplicate).toBe(false); // event2 first
      expect(results[2].isDuplicate).toBe(true); // event1 duplicate
      expect(results[3].isDuplicate).toBe(false); // event3 first
      expect(results[4].isDuplicate).toBe(true); // event2 duplicate
    });

    it('should handle empty batch', async () => {
      const results = await service.checkDuplicateBatch([]);
      expect(results).toHaveLength(0);
    });

    it('should maintain relay information in batch', async () => {
      const event = createEvent();

      const results = await service.checkDuplicateBatch([event, event], 'wss://relay.test.com');

      expect(results[0].isDuplicate).toBe(false);
      expect(results[1].isDuplicate).toBe(true);
      expect(results[1].originalRelay).toBe('wss://relay.test.com');
    });
  });

  // ========================================
  // MEMORY EFFICIENCY
  // ========================================

  describe('Memory Efficiency', () => {
    it('should enforce maximum cache size', async () => {
      const service = new EventDeduplicationService({
        maxCacheSize: 10,
      });

      // Add 15 events (more than max)
      const events = Array.from({ length: 15 }, () => createEvent());

      for (const event of events) {
        await service.checkDuplicate(event);
      }

      const stats = await service.getStats();
      expect(stats.cacheSize).toBeLessThanOrEqual(10);
    });

    it('should use LRU eviction policy', async () => {
      const service = new EventDeduplicationService({
        maxCacheSize: 3,
      });

      const event1 = createEvent();
      const event2 = createEvent();
      const event3 = createEvent();
      const event4 = createEvent();

      // Fill cache
      await service.checkDuplicate(event1);
      await service.checkDuplicate(event2);
      await service.checkDuplicate(event3);

      // Access event1 (make it recently used)
      await service.checkDuplicate(event1);

      // Add event4 (should evict event2 as least recently used)
      await service.checkDuplicate(event4);

      // event1 should still be in cache
      const result1 = await service.checkDuplicate(event1);
      expect(result1.isDuplicate).toBe(true);
    });

    it('should clear cache', async () => {
      const event1 = createEvent();
      const event2 = createEvent();

      await service.checkDuplicate(event1);
      await service.checkDuplicate(event2);

      await service.clear();

      const stats = await service.getStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.totalChecks).toBe(0);
    });
  });

  // ========================================
  // METRICS AND STATISTICS
  // ========================================

  describe('Metrics and Statistics', () => {
    it('should track deduplication statistics', async () => {
      const event1 = createEvent({ content: 'Message 1' });
      const event2 = createEvent({ content: 'Message 2' });

      await service.checkDuplicate(event1);
      await service.checkDuplicate(event1); // Duplicate by ID
      await service.checkDuplicate(event2);

      const stats = await service.getStats();

      expect(stats.totalChecks).toBe(3);
      expect(stats.duplicateCount).toBe(1);
      expect(stats.uniqueCount).toBe(2);
      expect(stats.duplicateRate).toBeCloseTo(0.333, 2);
    });

    it('should track per-relay statistics', async () => {
      const event = createEvent();

      await service.checkDuplicate(event, 'wss://relay1.com');
      await service.checkDuplicate(event, 'wss://relay2.com');
      await service.checkDuplicate(createEvent(), 'wss://relay1.com');

      const stats = await service.getStats();

      expect(stats.perRelayStats).toBeDefined();
      expect(stats.perRelayStats?.['wss://relay1.com']).toBeDefined();
      expect(stats.perRelayStats?.['wss://relay2.com']).toBeDefined();
    });

    it('should track replaceable event statistics', async () => {
      const pubkey = 'creator_pubkey_12345678901234567890123';

      const metadata1 = createEvent({
        kind: NostrEventKind.SET_METADATA,
        pubkey,
        created_at: 1000,
      });

      const metadata2 = createEvent({
        kind: NostrEventKind.SET_METADATA,
        pubkey,
        created_at: 2000,
      });

      await service.checkDuplicate(metadata1);
      await service.checkDuplicate(metadata2);

      const stats = await service.getStats();

      expect(stats.replaceableCount).toBeGreaterThan(0);
    });

    it('should calculate performance metrics', async () => {
      const events = Array.from({ length: 100 }, () => createEvent());

      const start = performance.now();
      for (const event of events) {
        await service.checkDuplicate(event);
      }
      const duration = performance.now() - start;

      const stats = await service.getStats();

      expect(stats.averageCheckTime).toBeDefined();
      expect(stats.averageCheckTime).toBeLessThan(5); // <5ms per event
    });
  });

  // ========================================
  // ERROR HANDLING
  // ========================================

  describe('Error Handling', () => {
    it('should handle invalid events gracefully', async () => {
      const invalidEvent = {} as NostrEvent;

      const result = await service.checkDuplicate(invalidEvent);

      // Should not throw, return safe result
      expect(result).toBeDefined();
    });

    it('should handle events with missing fields', async () => {
      const event = createEvent();
      delete (event as any).pubkey;

      const result = await service.checkDuplicate(event);

      expect(result).toBeDefined();
    });

    it('should handle concurrent duplicate checks', async () => {
      const event = createEvent();

      // Concurrent checks
      const results = await Promise.all([
        service.checkDuplicate(event),
        service.checkDuplicate(event),
        service.checkDuplicate(event),
      ]);

      // At least one should be unique
      const uniqueResults = results.filter((r) => !r.isDuplicate);
      expect(uniqueResults.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // PERFORMANCE
  // ========================================

  describe('Performance', () => {
    it('should check duplicates in <5ms', async () => {
      const events = Array.from({ length: 100 }, () => createEvent());

      // Warm up
      for (let i = 0; i < 10; i++) {
        await service.checkDuplicate(createEvent());
      }

      // Measure
      const timings: number[] = [];

      for (const event of events) {
        const start = performance.now();
        await service.checkDuplicate(event);
        const duration = performance.now() - start;
        timings.push(duration);
      }

      const average = timings.reduce((a, b) => a + b) / timings.length;
      const p95 = timings.sort((a, b) => a - b)[Math.floor(timings.length * 0.95)];

      expect(average).toBeLessThan(5);
      expect(p95).toBeLessThan(10);
    });

    it('should handle high throughput (1000 events/sec)', async () => {
      const events = Array.from({ length: 1000 }, () => createEvent());

      const start = performance.now();
      await Promise.all(events.map((e) => service.checkDuplicate(e)));
      const duration = performance.now() - start;

      // Should complete in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should use minimal memory for large event sets', async () => {
      const service = new EventDeduplicationService({
        maxCacheSize: 1000,
      });

      const events = Array.from({ length: 10000 }, () => createEvent());

      for (const event of events) {
        await service.checkDuplicate(event);
      }

      const stats = await service.getStats();

      // Cache should not exceed configured size
      expect(stats.cacheSize).toBeLessThanOrEqual(1000);
    });
  });

  // ========================================
  // LIFECYCLE
  // ========================================

  describe('Lifecycle Management', () => {
    it('should initialize service', async () => {
      const newService = new EventDeduplicationService();
      expect(newService).toBeDefined();
    });

    it('should destroy service and cleanup resources', async () => {
      const newService = new EventDeduplicationService();

      await newService.checkDuplicate(createEvent());
      await newService.destroy();

      const stats = await newService.getStats();
      expect(stats.cacheSize).toBe(0);
    });

    it('should reset singleton instance', () => {
      EventDeduplicationService.resetInstance();
      const instance1 = EventDeduplicationService.getInstance();
      EventDeduplicationService.resetInstance();
      const instance2 = EventDeduplicationService.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });
});
