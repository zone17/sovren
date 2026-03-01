/**
 * 🧪 ELITE TEST SUITE: EventPublisherService
 * US-303: Create Unified Event Publisher Service
 *
 * Test Coverage:
 * - Event creation from templates
 * - Event signing (local and extension)
 * - Multi-relay publishing
 * - Publishing strategies (broadcast, targeted, smart, batch)
 * - Retry logic with exponential backoff
 * - Event validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { EventPublisherService } from '../EventPublisherService';
import { KeyManagementService } from '../KeyManagementService';
import { RelayPoolManager } from '../RelayPoolManager';
import type { NostrEvent, EventTemplate } from '@shared/types/nostr/index';

// Mock dependencies
vi.mock('../KeyManagementService');
vi.mock('../RelayPoolManager');

describe('EventPublisherService', () => {
  let publisherService: EventPublisherService;
  let mockKeyManagement: vi.Mocked<KeyManagementService>;
  let mockRelayPool: vi.Mocked<RelayPoolManager>;

  const mockPublicKey = '0'.repeat(64);
  const mockPrivateKey = '1'.repeat(64);
  const mockEventId = '2'.repeat(64);
  const mockSignature = '3'.repeat(128);

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset the EventPublisherService singleton so each test gets a fresh instance
    // that captures the mocked dependencies set up below. Without this, the instance
    // created at module-load time holds a reference to the real (unmocked) KMS.
    (EventPublisherService as any).instance = null;

    // Setup KeyManagementService mock with proper prototype
    mockKeyManagement = {
      isInitialized: vi.fn().mockReturnValue(true),
      getActiveKey: vi.fn().mockReturnValue({
        keyId: 'test-key-id',
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
        npub: 'npub1test',
        nsec: 'nsec1test',
      }),
      signEvent: vi.fn().mockImplementation(async (keyId, event) => ({
        ...event,
        id: mockEventId,
        sig: mockSignature,
      })),
      verifyEventSignature: vi.fn().mockResolvedValue(true),
    } as any;

    // Setup RelayPoolManager mock
    mockRelayPool = {
      isInitialized: vi.fn().mockReturnValue(true),
      getConnectedRelays: vi
        .fn()
        .mockReturnValue(['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.info']),
      publishEvent: vi.fn().mockResolvedValue([
        { relay: 'wss://relay.damus.io', success: true, latency: 100 },
        { relay: 'wss://nos.lol', success: true, latency: 150 },
        { relay: 'wss://relay.nostr.info', success: true, latency: 200 },
      ]),
      publishEventToFastest: vi
        .fn()
        .mockResolvedValue([{ relay: 'wss://relay.damus.io', success: true, latency: 100 }]),
      getFastestRelays: vi.fn().mockReturnValue(['wss://relay.damus.io']),
    } as any;

    // Mock getInstance methods BEFORE creating service
    (KeyManagementService.getInstance as any).mockReturnValue(mockKeyManagement);
    (RelayPoolManager.getInstance as any).mockReturnValue(mockRelayPool);

    // Create service instance
    publisherService = EventPublisherService.getInstance();
    await publisherService.initialize();
  });

  afterEach(async () => {
    // Don't call destroy to avoid singleton cleanup issues between tests
    // Just ensure service is in a clean state
    if (publisherService) {
      publisherService.resetStats();
    }
  });

  afterAll(async () => {
    // Final cleanup after all tests
    if (publisherService) {
      await publisherService.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize service successfully', async () => {
      expect(publisherService.isInitialized()).toBe(true);
    });

    it('should not initialize twice', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();
      await publisherService.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already initialized'));
      consoleSpy.mockRestore();
    });

    it('should throw error if dependencies not initialized', async () => {
      // This test must run last in the Initialization suite as it modifies state
      // Save current state
      const wasInitialized = publisherService.isInitialized();

      // Manually mark as uninitialized to test the check
      (publisherService as any).initialized = false;

      // Mock the dependency to be uninitialized
      mockKeyManagement.isInitialized.mockReturnValue(false);

      await expect(publisherService.initialize()).rejects.toThrow(
        'KeyManagementService must be initialized first'
      );

      // Restore state
      mockKeyManagement.isInitialized.mockReturnValue(true);
      if (wasInitialized) {
        await publisherService.initialize();
      }
    });
  });

  describe('Event Creation', () => {
    it('should create unsigned text note event', async () => {
      const template: EventTemplate = {
        kind: 1,
        content: 'Hello NOSTR!',
        tags: [],
      };

      const event = await publisherService.createEvent(template);

      expect(event).toMatchObject({
        kind: 1,
        content: 'Hello NOSTR!',
        tags: [],
        pubkey: mockPublicKey,
      });
      expect(event.created_at).toBeGreaterThan(0);
      expect(event.id).toBeDefined();
      expect(event.sig).toBeDefined();
    });

    it('should create metadata event (kind 0)', async () => {
      const template: EventTemplate = {
        kind: 0,
        content: JSON.stringify({
          name: 'Test User',
          about: 'Test bio',
          picture: 'https://example.com/avatar.jpg',
        }),
        tags: [],
      };

      const event = await publisherService.createEvent(template);

      expect(event.kind).toBe(0);
      expect(JSON.parse(event.content)).toMatchObject({
        name: 'Test User',
        about: 'Test bio',
      });
    });

    it('should create event with custom timestamp', async () => {
      const customTimestamp = Math.floor(Date.now() / 1000) - 3600;
      const template: EventTemplate = {
        kind: 1,
        content: 'Test',
        created_at: customTimestamp,
      };

      const event = await publisherService.createEvent(template);

      expect(event.created_at).toBe(customTimestamp);
    });

    it('should create event with tags', async () => {
      const template: EventTemplate = {
        kind: 1,
        content: 'Reply test',
        tags: [
          ['e', 'parent-event-id', 'wss://relay.damus.io'],
          ['p', mockPublicKey],
          ['t', 'nostr'],
        ],
      };

      const event = await publisherService.createEvent(template);

      expect(event.tags).toHaveLength(3);
      expect(event.tags[0]).toEqual(['e', 'parent-event-id', 'wss://relay.damus.io']);
      expect(event.tags[1]).toEqual(['p', mockPublicKey]);
      expect(event.tags[2]).toEqual(['t', 'nostr']);
    });

    it('should auto-populate created_at if not provided', async () => {
      const beforeTimestamp = Math.floor(Date.now() / 1000);
      const event = await publisherService.createEvent({ kind: 1, content: 'Test' });
      const afterTimestamp = Math.floor(Date.now() / 1000);

      expect(event.created_at).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(event.created_at).toBeLessThanOrEqual(afterTimestamp);
    });
  });

  describe('Event Signing', () => {
    it('should sign event with active key', async () => {
      const unsignedEvent = {
        kind: 1,
        content: 'Test',
        tags: [],
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await publisherService.signEvent(unsignedEvent);

      expect(mockKeyManagement.signEvent).toHaveBeenCalledWith('test-key-id', expect.any(Object));
      expect(signedEvent.sig).toBe(mockSignature);
      expect(signedEvent.id).toBe(mockEventId);
    });

    it('should sign event with specific key', async () => {
      const unsignedEvent = {
        kind: 1,
        content: 'Test',
        tags: [],
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
      };

      const customKeyId = 'custom-key-id';
      await publisherService.signEvent(unsignedEvent, customKeyId);

      expect(mockKeyManagement.signEvent).toHaveBeenCalledWith(customKeyId, expect.any(Object));
    });

    it('should sign event with browser extension', async () => {
      const unsignedEvent = {
        kind: 1,
        content: 'Test',
        tags: [],
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
      };

      await publisherService.signEvent(unsignedEvent, 'extension');

      expect(mockKeyManagement.signEvent).toHaveBeenCalledWith('extension', expect.any(Object));
    });

    it('should throw error if no active key', async () => {
      mockKeyManagement.getActiveKey.mockReturnValue(null);

      const unsignedEvent = {
        kind: 1,
        content: 'Test',
        tags: [],
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
      };

      await expect(publisherService.signEvent(unsignedEvent)).rejects.toThrow(
        'No active key available for signing'
      );
    });

    it('should verify signature after signing', async () => {
      const unsignedEvent = {
        kind: 1,
        content: 'Test',
        tags: [],
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
      };

      await publisherService.signEvent(unsignedEvent);

      expect(mockKeyManagement.verifyEventSignature).toHaveBeenCalled();
    });
  });

  describe('Event Validation', () => {
    it('should validate event structure', async () => {
      const validEvent: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test',
        sig: mockSignature,
      };

      const result = await publisherService.validateEvent(validEvent);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid event ID', async () => {
      const invalidEvent: NostrEvent = {
        id: 'invalid-id',
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test',
        sig: mockSignature,
      };

      const result = await publisherService.validateEvent(invalidEvent);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('id');
    });

    it('should detect future timestamps', async () => {
      const futureEvent: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour in future
        kind: 1,
        tags: [],
        content: 'Test',
        sig: mockSignature,
      };

      const result = await publisherService.validateEvent(futureEvent);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.code === 'FUTURE_TIMESTAMP')).toBe(true);
    });

    it('should validate replaceable events', async () => {
      const replaceableEvent: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 0, // Metadata is replaceable
        tags: [],
        content: '{}',
        sig: mockSignature,
      };

      const result = await publisherService.validateEvent(replaceableEvent);

      expect(result.valid).toBe(true);
    });
  });

  describe('Multi-Relay Publishing', () => {
    it('should publish event to all relays (broadcast)', async () => {
      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Broadcast test',
        sig: mockSignature,
      };

      const results = await publisherService.publish(event);

      expect(mockRelayPool.publishEvent).toHaveBeenCalledWith(event, undefined);
      expect(results.success).toBe(true);
      expect(results.publishedTo).toHaveLength(3);
      expect(results.failedRelays).toHaveLength(0);
    });

    it('should publish event to specific relays (targeted)', async () => {
      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Targeted test',
        sig: mockSignature,
      };

      const targetRelays = ['wss://relay.damus.io'];
      await publisherService.publish(event, { relays: targetRelays });

      expect(mockRelayPool.publishEvent).toHaveBeenCalledWith(event, targetRelays);
    });

    it('should publish to fastest relays (smart)', async () => {
      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Smart test',
        sig: mockSignature,
      };

      await publisherService.publishToFastest(event, 2);

      expect(mockRelayPool.publishEventToFastest).toHaveBeenCalledWith(event, 2);
    });

    it('should track publish success per relay', async () => {
      mockRelayPool.publishEvent.mockResolvedValue([
        { relay: 'wss://relay.damus.io', success: true, latency: 100 },
        { relay: 'wss://nos.lol', success: false, error: new Error('Timeout'), latency: 5000 },
      ]);

      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test',
        sig: mockSignature,
      };

      const results = await publisherService.publish(event);

      expect(results.publishedTo).toEqual(['wss://relay.damus.io']);
      expect(results.failedRelays).toEqual(['wss://nos.lol']);
      expect(results.relayResults).toHaveLength(2);
    });

    it('should handle all relays failing', async () => {
      mockRelayPool.publishEvent.mockResolvedValue([
        { relay: 'wss://relay.damus.io', success: false, error: new Error('Failed'), latency: 100 },
        { relay: 'wss://nos.lol', success: false, error: new Error('Failed'), latency: 100 },
      ]);

      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test',
        sig: mockSignature,
      };

      const results = await publisherService.publish(event);

      expect(results.success).toBe(false);
      expect(results.publishedTo).toHaveLength(0);
      expect(results.failedRelays).toHaveLength(2);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed publishes with exponential backoff', async () => {
      let attemptCount = 0;
      mockRelayPool.publishEvent.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          return [
            {
              relay: 'wss://relay.damus.io',
              success: false,
              error: new Error('Failed'),
              latency: 100,
            },
          ];
        }
        return [{ relay: 'wss://relay.damus.io', success: true, latency: 100 }];
      });

      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Retry test',
        sig: mockSignature,
      };

      const results = await publisherService.publishWithRetry(event, { maxRetries: 3 });

      expect(attemptCount).toBe(3);
      expect(results.success).toBe(true);
    });

    it('should use exponential backoff between retries', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      global.setTimeout = vi.fn((callback, delay) => {
        delays.push(delay as number);
        return originalSetTimeout(callback, 0); // Execute immediately for test
      }) as any;

      mockRelayPool.publishEvent.mockResolvedValue([
        { relay: 'wss://relay.damus.io', success: false, error: new Error('Failed'), latency: 100 },
      ]);

      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Backoff test',
        sig: mockSignature,
      };

      await publisherService.publishWithRetry(event, { maxRetries: 3 });

      // Check exponential backoff: 1s, 2s, 4s
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);

      global.setTimeout = originalSetTimeout;
    });

    it('should stop retrying after max attempts', async () => {
      mockRelayPool.publishEvent.mockResolvedValue([
        { relay: 'wss://relay.damus.io', success: false, error: new Error('Failed'), latency: 100 },
      ]);

      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Max retry test',
        sig: mockSignature,
      };

      const results = await publisherService.publishWithRetry(event, { maxRetries: 2 });

      expect(mockRelayPool.publishEvent).toHaveBeenCalledTimes(2);
      expect(results.success).toBe(false);
    });
  });

  describe('Batch Publishing', () => {
    it('should publish multiple events efficiently', async () => {
      const events: NostrEvent[] = [
        {
          id: mockEventId + '1',
          pubkey: mockPublicKey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Event 1',
          sig: mockSignature,
        },
        {
          id: mockEventId + '2',
          pubkey: mockPublicKey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: 'Event 2',
          sig: mockSignature,
        },
      ];

      const results = await publisherService.publishBatch(events, { skipValidation: true });

      expect(results.totalEvents).toBe(2);
      expect(results.successCount).toBe(2);
      expect(results.failureCount).toBe(0);
      expect(results.results).toHaveLength(2);
    });

    it('should track batch publish metrics', async () => {
      const events: NostrEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: mockEventId + i,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: `Event ${i}`,
        sig: mockSignature,
      }));

      const results = await publisherService.publishBatch(events, { skipValidation: true });

      expect(results.duration).toBeGreaterThanOrEqual(0);
      expect(results.averageLatency).toBeGreaterThanOrEqual(0);
      expect(results.totalEvents).toBe(5);
    });
  });

  describe('Publishing Strategies', () => {
    it('should support broadcast strategy', async () => {
      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Broadcast',
        sig: mockSignature,
      };

      await publisherService.publish(event, { strategy: 'broadcast' });

      expect(mockRelayPool.publishEvent).toHaveBeenCalledWith(event, undefined);
    });

    it('should support targeted strategy', async () => {
      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Targeted',
        sig: mockSignature,
      };

      const relays = ['wss://relay.damus.io'];
      await publisherService.publish(event, { strategy: 'targeted', relays });

      expect(mockRelayPool.publishEvent).toHaveBeenCalledWith(event, relays);
    });

    it('should support smart strategy (fastest relays)', async () => {
      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Smart',
        sig: mockSignature,
      };

      await publisherService.publish(event, { strategy: 'smart', relayCount: 2 });

      expect(mockRelayPool.publishEventToFastest).toHaveBeenCalledWith(event, 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle signing errors gracefully', async () => {
      mockKeyManagement.signEvent.mockRejectedValue(new Error('Signing failed'));

      const template: EventTemplate = {
        kind: 1,
        content: 'Test',
      };

      await expect(publisherService.createAndPublish(template)).rejects.toThrow('Signing failed');
    });

    it('should handle relay pool errors', async () => {
      mockRelayPool.publishEvent.mockRejectedValue(new Error('Relay pool error'));

      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test',
        sig: mockSignature,
      };

      await expect(publisherService.publish(event)).rejects.toThrow('Relay pool error');
    });

    it('should emit error events', async () => {
      const errorHandler = vi.fn();
      publisherService.on('publish:error', errorHandler);

      mockRelayPool.publishEvent.mockRejectedValue(new Error('Test error'));

      const event: NostrEvent = {
        id: mockEventId,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test',
        sig: mockSignature,
      };

      try {
        await publisherService.publish(event);
      } catch {
        // Expected
      }

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = EventPublisherService.getInstance();
      const instance2 = EventPublisherService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      await publisherService.destroy();

      expect(publisherService.isInitialized()).toBe(false);
    });
  });
});
