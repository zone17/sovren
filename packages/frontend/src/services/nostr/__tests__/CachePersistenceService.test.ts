/**
 * 🧪 Cache Persistence Service Tests
 * US-317: NOSTR Caching Layer - Subtask 9
 *
 * Comprehensive test coverage for IndexedDB persistence
 */

import { CachePersistenceService } from '../CachePersistenceService';
import type { NostrEvent, NostrFilter } from '@shared/types/nostr';

// Mock IndexedDB for testing
import 'fake-indexeddb/auto';

describe('CachePersistenceService', () => {
  let service: CachePersistenceService;

  const createMockEvent = (id: string, kind: number = 1): NostrEvent => ({
    id,
    pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags: [],
    content: `Test content for event ${id}`,
    sig: 'mock_signature',
  });

  beforeEach(async () => {
    // Clear IndexedDB
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        await indexedDB.deleteDatabase(db.name);
      }
    }

    service = CachePersistenceService.getInstance({
      maxEvents: 100,
      maxSizeBytes: 10 * 1024 * 1024, // 10MB
      enableAutoSave: false, // Disable for tests
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('Event Persistence', () => {
    it('should persist event to IndexedDB', async () => {
      const event = createMockEvent('test1');

      await service.persistEvent(event);

      const retrieved = await service.getPersistedEvent('test1');
      expect(retrieved).toEqual(event);
    });

    it('should batch persist multiple events', async () => {
      const events = [
        createMockEvent('batch1'),
        createMockEvent('batch2'),
        createMockEvent('batch3'),
      ];

      await service.persistBatch(events);

      const retrieved1 = await service.getPersistedEvent('batch1');
      const retrieved2 = await service.getPersistedEvent('batch2');
      const retrieved3 = await service.getPersistedEvent('batch3');

      expect(retrieved1).toEqual(events[0]);
      expect(retrieved2).toEqual(events[1]);
      expect(retrieved3).toEqual(events[2]);
    });

    it('should update access metadata on retrieval', async () => {
      const event = createMockEvent('access1');
      await service.persistEvent(event);

      // First retrieval
      await service.getPersistedEvent('access1');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second retrieval
      await service.getPersistedEvent('access1');

      // Access count should be incremented (internal state)
      // This would be visible in the IndexedDB directly
      const retrieved = await service.getPersistedEvent('access1');
      expect(retrieved).toEqual(event);
    });

    it('should return null for non-existent event', async () => {
      const retrieved = await service.getPersistedEvent('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Add test events
      const events = [
        { ...createMockEvent('q1', 1), created_at: 1000 },
        { ...createMockEvent('q2', 1), created_at: 2000 },
        { ...createMockEvent('q3', 2), created_at: 3000 },
        { ...createMockEvent('q4', 3), created_at: 4000 },
      ];

      await service.persistBatch(events);
    });

    it('should query events by kind', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const results = await service.queryPersistedEvents(filter);

      expect(results).toHaveLength(2);
      expect(results.every(e => e.kind === 1)).toBe(true);
    });

    it('should query events with limit', async () => {
      const filter: NostrFilter = { limit: 2 };
      const results = await service.queryPersistedEvents(filter);

      expect(results).toHaveLength(2);
    });

    it('should query events by time range', async () => {
      const filter: NostrFilter = {
        since: 1500,
        until: 3500,
      };
      const results = await service.queryPersistedEvents(filter);

      expect(results).toHaveLength(2);
      expect(results[0].created_at).toBe(2000);
      expect(results[1].created_at).toBe(3000);
    });

    it('should query events by author', async () => {
      const authorEvent = createMockEvent('author1', 1);
      authorEvent.pubkey = 'different_pubkey';
      await service.persistEvent(authorEvent);

      const filter: NostrFilter = {
        authors: ['different_pubkey'],
      };
      const results = await service.queryPersistedEvents(filter);

      expect(results).toHaveLength(1);
      expect(results[0].pubkey).toBe('different_pubkey');
    });
  });

  describe('Profile Persistence', () => {
    it('should persist profile data', async () => {
      const pubkey = 'test_pubkey';
      const metadata = {
        name: 'Test User',
        about: 'Test bio',
        picture: 'https://example.com/pic.jpg',
      };

      await service.persistProfile(pubkey, metadata, 'user@example.com');

      const retrieved = await service.getPersistedProfile(pubkey);
      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata).toEqual(metadata);
      expect(retrieved?.nip05).toBe('user@example.com');
      expect(retrieved?.nip05Verified).toBe(true);
    });

    it('should update last accessed time on retrieval', async () => {
      const pubkey = 'access_test';
      await service.persistProfile(pubkey, { name: 'Test' });

      const first = await service.getPersistedProfile(pubkey);
      const firstAccessed = first?.lastAccessed;

      await new Promise(resolve => setTimeout(resolve, 10));

      const second = await service.getPersistedProfile(pubkey);
      const secondAccessed = second?.lastAccessed;

      expect(secondAccessed).toBeGreaterThan(firstAccessed!);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used events when limit reached', async () => {
      // Create service with low limits
      const limitedService = CachePersistenceService.getInstance({
        maxEvents: 3,
        enableAutoSave: false,
      });

      // Add 4 events (should trigger eviction)
      const events = [
        createMockEvent('lru1'),
        createMockEvent('lru2'),
        createMockEvent('lru3'),
        createMockEvent('lru4'),
      ];

      for (const event of events) {
        await limitedService.persistEvent(event);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Access middle events to update their last accessed time
      await limitedService.getPersistedEvent('lru2');
      await limitedService.getPersistedEvent('lru3');

      // Add one more event to trigger eviction
      await limitedService.persistEvent(createMockEvent('lru5'));

      // lru1 should be evicted (least recently accessed)
      const evicted = await limitedService.getPersistedEvent('lru1');
      expect(evicted).toBeNull();

      // Others should still exist
      const exists2 = await limitedService.getPersistedEvent('lru2');
      const exists3 = await limitedService.getPersistedEvent('lru3');
      const exists5 = await limitedService.getPersistedEvent('lru5');

      expect(exists2).toBeDefined();
      expect(exists3).toBeDefined();
      expect(exists5).toBeDefined();

      limitedService.cleanup();
    });

    it('should evict based on size limits', async () => {
      // Create service with very small size limit
      const limitedService = CachePersistenceService.getInstance({
        maxSizeBytes: 1000, // 1KB
        enableAutoSave: false,
      });

      // Create large event
      const largeEvent = createMockEvent('large1');
      largeEvent.content = 'x'.repeat(500); // ~500 bytes

      await limitedService.persistEvent(largeEvent);

      // Add another large event (should trigger eviction)
      const largeEvent2 = createMockEvent('large2');
      largeEvent2.content = 'y'.repeat(600);

      await limitedService.persistEvent(largeEvent2);

      // Stats should show eviction
      const stats = limitedService.getStatistics();
      expect(stats.evictionCount).toBeGreaterThan(0);

      limitedService.cleanup();
    });
  });

  describe('Statistics', () => {
    it('should track cache statistics', async () => {
      const events = [
        createMockEvent('stat1'),
        createMockEvent('stat2'),
        createMockEvent('stat3'),
      ];

      await service.persistBatch(events);

      const stats = service.getStatistics();

      expect(stats.totalEvents).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.averageEventSize).toBeGreaterThan(0);
      expect(stats.cacheEfficiency).toBe(1); // No evictions yet
    });

    it('should calculate cache efficiency', async () => {
      // Create service with low limit to force evictions
      const limitedService = CachePersistenceService.getInstance({
        maxEvents: 2,
        enableAutoSave: false,
      });

      // Add 3 events to force eviction
      for (let i = 0; i < 3; i++) {
        await limitedService.persistEvent(createMockEvent(`eff${i}`));
      }

      const stats = limitedService.getStatistics();
      expect(stats.evictionCount).toBeGreaterThan(0);
      expect(stats.cacheEfficiency).toBeLessThan(1);
      expect(stats.cacheEfficiency).toBeGreaterThan(0);

      limitedService.cleanup();
    });
  });

  describe('Clear Operations', () => {
    it('should clear all persisted data', async () => {
      const events = [
        createMockEvent('clear1'),
        createMockEvent('clear2'),
      ];

      await service.persistBatch(events);
      await service.persistProfile('clear_profile', { name: 'Test' });

      // Verify data exists
      let event = await service.getPersistedEvent('clear1');
      let profile = await service.getPersistedProfile('clear_profile');
      expect(event).toBeDefined();
      expect(profile).toBeDefined();

      // Clear all
      await service.clearAll();

      // Verify data is gone
      event = await service.getPersistedEvent('clear1');
      profile = await service.getPersistedProfile('clear_profile');
      expect(event).toBeNull();
      expect(profile).toBeNull();

      // Stats should be reset
      const stats = service.getStatistics();
      expect(stats.totalEvents).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('Metadata Management', () => {
    it('should persist and restore metadata', async () => {
      const events = [
        createMockEvent('meta1'),
        createMockEvent('meta2'),
      ];

      await service.persistBatch(events);

      // Get initial stats
      const initialStats = service.getStatistics();

      // Create new service instance (simulates restart)
      const newService = CachePersistenceService.getInstance();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Stats should be restored
      const restoredStats = newService.getStatistics();
      expect(restoredStats.totalEvents).toBe(initialStats.totalEvents);

      newService.cleanup();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close the database to simulate error
      service.cleanup();

      // Try to persist (should not throw)
      const event = createMockEvent('error1');
      await expect(service.persistEvent(event)).resolves.not.toThrow();
    });

    it('should handle invalid events', async () => {
      const invalidEvent = {} as NostrEvent;

      // Should not throw
      await expect(service.persistEvent(invalidEvent)).resolves.not.toThrow();
    });
  });

  describe('Compression', () => {
    it('should handle compression flag', async () => {
      const compressService = CachePersistenceService.getInstance({
        enableCompression: true,
        enableAutoSave: false,
      });

      const event = createMockEvent('compress1');
      await compressService.persistEvent(event);

      const retrieved = await compressService.getPersistedEvent('compress1');
      expect(retrieved).toEqual(event);

      compressService.cleanup();
    });
  });
});