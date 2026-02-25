/**
 * SubscriptionManagerService Tests
 *
 * US-304: Create Unified Subscription Manager Service
 * Epic 003: NOSTR Consolidation
 *
 * Test Coverage:
 * - Subscription creation and cancellation
 * - Multi-relay subscription handling
 * - Event deduplication across relays
 * - Subscription state management (pause/resume)
 * - Filter optimization
 * - Subscription pooling
 * - Event callbacks and EOSE handling
 * - Auto-cleanup on unmount
 * - Integration with RelayPoolManager
 * - Integration with EventCacheService
 */

import { SubscriptionManagerService } from '../SubscriptionManagerService';
import { RelayPoolManager } from '../RelayPoolManager';
import { EventCacheService } from '../EventCacheService';
import type { NostrEvent, NostrFilter } from '@shared/types/nostr';

// ========================================
// Mock Dependencies
// ========================================

vi.mock('../RelayPoolManager');
vi.mock('../EventCacheService');
// Mock RateLimiter so checkLimit always allows (rate limiting tested separately)
vi.mock('../RateLimiter', () => {
  const mockInstance = {
    checkLimit: vi.fn().mockResolvedValue({ allowed: true }),
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    destroy: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn(),
    setRelayLimit: vi.fn(),
    getMetrics: vi.fn().mockReturnValue({ overall: {}, byOperation: new Map(), queue: {} }),
    getQueueMetrics: vi.fn().mockReturnValue({ size: 0, totalQueued: 0, totalProcessed: 0, totalTimedOut: 0 }),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn(),
  };
  const RateLimiter = vi.fn().mockImplementation(() => mockInstance);
  RateLimiter.getInstance = vi.fn().mockReturnValue(mockInstance);
  return { RateLimiter };
});

describe('SubscriptionManagerService', () => {
  let service: SubscriptionManagerService;
  let mockRelayPoolManager: vi.Mocked<RelayPoolManager>;
  let mockEventCache: vi.Mocked<EventCacheService>;

  // Mock event factory
  const createMockEvent = (overrides: Partial<NostrEvent> = {}): NostrEvent => ({
    id: `event_${Math.random().toString(36).substring(7)}`,
    pubkey: 'pubkey123',
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: 'Test content',
    sig: 'signature123',
    ...overrides,
  });

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock instances
    let subscriptionCounter = 0;
    mockRelayPoolManager = {
      subscribe: vi.fn(() => `relay_sub_${++subscriptionCounter}`),
      unsubscribe: vi.fn(),
      getConnectedRelays: vi.fn(() => ['wss://relay1.com', 'wss://relay2.com']),
      isInitialized: true,
    } as any;

    mockEventCache = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      query: vi.fn().mockResolvedValue([]),
    } as any;

    // Mock RelayPoolManager.getInstance()
    (RelayPoolManager.getInstance as any).mockReturnValue(mockRelayPoolManager);

    // Create fresh service instance
    service = SubscriptionManagerService.getInstance();
    (service as any).relayPoolManager = mockRelayPoolManager;
    (service as any).eventCache = mockEventCache;
  });

  afterEach(async () => {
    // Cleanup service
    await service.destroy();
    (SubscriptionManagerService as any).instance = null;
  });

  // ========================================
  // Singleton Pattern Tests
  // ========================================

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SubscriptionManagerService.getInstance();
      const instance2 = SubscriptionManagerService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', async () => {
      const instance1 = SubscriptionManagerService.getInstance();
      await instance1.destroy();
      (SubscriptionManagerService as any).instance = null;

      const instance2 = SubscriptionManagerService.getInstance();

      expect(instance2).toBeDefined();
      expect(instance2).not.toBe(instance1);
    });
  });

  // ========================================
  // Subscription Creation Tests
  // ========================================

  describe('subscribe()', () => {
    it('should create subscription with single filter', async () => {
      const filter: NostrFilter = { kinds: [1], limit: 10 };
      const onEvent = vi.fn();

      const subId = await service.subscribe([filter], onEvent);

      expect(subId).toBeDefined();
      expect(typeof subId).toBe('string');
      expect(mockRelayPoolManager.subscribe).toHaveBeenCalledWith(
        [filter],
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should create subscription with multiple filters', async () => {
      const filters: NostrFilter[] = [
        { kinds: [1], limit: 10 },
        { kinds: [0], authors: ['pubkey123'] },
      ];
      const onEvent = vi.fn();

      const subId = await service.subscribe(filters, onEvent);

      expect(subId).toBeDefined();
      expect(mockRelayPoolManager.subscribe).toHaveBeenCalledWith(
        filters,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should create subscription with custom ID', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const customId = 'custom-subscription-id';

      const subId = await service.subscribe([filter], onEvent, {
        id: customId,
      });

      expect(subId).toBe(customId);
    });

    it('should call onEvent callback when event is received', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const mockEvent = createMockEvent();

      await service.subscribe([filter], onEvent);

      // Simulate event reception
      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(mockEvent);

      expect(onEvent).toHaveBeenCalledWith(mockEvent, expect.any(String));
    });

    it('should call onEOSE callback when EOSE is received', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const onEOSE = vi.fn();

      await service.subscribe([filter], onEvent, { onEOSE });

      // Simulate EOSE reception
      const eoseCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][2];
      eoseCallback();

      expect(onEOSE).toHaveBeenCalledWith('wss://relay1.com'); // First relay
    });

    it('should track subscription state', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();

      const subId = await service.subscribe([filter], onEvent);
      const subscription = service.getSubscription(subId);

      expect(subscription).toBeDefined();
      expect(subscription?.id).toBe(subId);
      expect(subscription?.filters).toEqual([filter]);
      expect(subscription?.state).toBe('active');
    });

    it('should auto-cache events when option is enabled', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const mockEvent = createMockEvent();

      await service.subscribe([filter], onEvent, { autoCache: true });

      // Simulate event reception
      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(mockEvent);

      expect(mockEventCache.set).toHaveBeenCalledWith(mockEvent, expect.any(Object));
    });

    it('should throw error if no connected relays', async () => {
      mockRelayPoolManager.getConnectedRelays.mockReturnValue([]);

      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();

      await expect(service.subscribe([filter], onEvent)).rejects.toThrow(
        'No connected relays available'
      );
    });
  });

  // ========================================
  // Event Deduplication Tests
  // ========================================

  describe('Event Deduplication', () => {
    it('should deduplicate events from multiple relays', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const mockEvent = createMockEvent({ id: 'same-event-id' });

      await service.subscribe([filter], onEvent);

      // Simulate same event from different relays
      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(mockEvent); // First occurrence
      subscribeCallback(mockEvent); // Duplicate

      expect(onEvent).toHaveBeenCalledTimes(1);
    });

    it('should track event source relay', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const mockEvent = createMockEvent();

      await service.subscribe([filter], onEvent);

      // Simulate event reception
      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(mockEvent);

      expect(onEvent).toHaveBeenCalledWith(mockEvent, expect.any(String));
    });

    it('should allow different events with same content', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const event1 = createMockEvent({ id: 'event1', content: 'Same content' });
      const event2 = createMockEvent({ id: 'event2', content: 'Same content' });

      await service.subscribe([filter], onEvent);

      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(event1);
      subscribeCallback(event2);

      expect(onEvent).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================
  // Subscription Update Tests
  // ========================================

  describe('updateSubscription()', () => {
    it('should update subscription filters', async () => {
      const initialFilter: NostrFilter = { kinds: [1], limit: 10 };
      const onEvent = vi.fn();
      const subId = await service.subscribe([initialFilter], onEvent);

      const newFilters: NostrFilter[] = [{ kinds: [1, 6], limit: 20 }];
      service.updateSubscription(subId, newFilters);

      const subscription = service.getSubscription(subId);
      expect(subscription?.filters).toEqual(newFilters);
    });

    it('should close old subscription and create new one', async () => {
      const initialFilter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const subId = await service.subscribe([initialFilter], onEvent);

      mockRelayPoolManager.subscribe.mockClear();

      const newFilters: NostrFilter[] = [{ kinds: [6] }];
      service.updateSubscription(subId, newFilters);

      expect(mockRelayPoolManager.unsubscribe).toHaveBeenCalled();
      expect(mockRelayPoolManager.subscribe).toHaveBeenCalledWith(
        newFilters,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should throw error for non-existent subscription', () => {
      expect(() => {
        service.updateSubscription('non-existent-id', [{ kinds: [1] }]);
      }).toThrow('Subscription not found');
    });
  });

  // ========================================
  // Subscription Cancellation Tests
  // ========================================

  describe('unsubscribe()', () => {
    it('should cancel active subscription', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const subId = await service.subscribe([filter], onEvent);

      service.unsubscribe(subId);

      expect(mockRelayPoolManager.unsubscribe).toHaveBeenCalled();
      expect(service.getSubscription(subId)).toBeNull();
    });

    it('should handle cancelling non-existent subscription gracefully', () => {
      expect(() => {
        service.unsubscribe('non-existent-id');
      }).not.toThrow();
    });

    it('should update subscription state to closed', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const subId = await service.subscribe([filter], onEvent);

      const subscription = service.getSubscription(subId);
      expect(subscription?.state).toBe('active');

      service.unsubscribe(subId);

      // After unsubscribe, subscription should be removed
      expect(service.getSubscription(subId)).toBeNull();
    });
  });

  // ========================================
  // Pause/Resume Tests
  // ========================================

  describe('Pause and Resume', () => {
    it('should pause active subscription', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const subId = await service.subscribe([filter], onEvent);

      service.pauseSubscription(subId);

      const subscription = service.getSubscription(subId);
      expect(subscription?.state).toBe('paused');
    });

    it('should not receive events when paused', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const mockEvent = createMockEvent();

      const subId = await service.subscribe([filter], onEvent);
      service.pauseSubscription(subId);

      // Simulate event reception
      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(mockEvent);

      expect(onEvent).not.toHaveBeenCalled();
    });

    it('should resume paused subscription', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const subId = await service.subscribe([filter], onEvent);

      service.pauseSubscription(subId);
      service.resumeSubscription(subId);

      const subscription = service.getSubscription(subId);
      expect(subscription?.state).toBe('active');
    });

    it('should receive events after resume', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const mockEvent = createMockEvent();

      const subId = await service.subscribe([filter], onEvent);
      service.pauseSubscription(subId);
      service.resumeSubscription(subId);

      // Simulate event reception
      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(mockEvent);

      expect(onEvent).toHaveBeenCalledWith(mockEvent, expect.any(String));
    });

    it('should throw error when pausing non-existent subscription', () => {
      expect(() => {
        service.pauseSubscription('non-existent-id');
      }).toThrow('Subscription not found');
    });

    it('should throw error when resuming non-existent subscription', () => {
      expect(() => {
        service.resumeSubscription('non-existent-id');
      }).toThrow('Subscription not found');
    });
  });

  // ========================================
  // List Subscriptions Tests
  // ========================================

  describe('getSubscriptions()', () => {
    it('should return all active subscriptions', async () => {
      const filter1: NostrFilter = { kinds: [1] };
      const filter2: NostrFilter = { kinds: [6] };
      const onEvent = vi.fn();

      const subId1 = await service.subscribe([filter1], onEvent);
      const subId2 = await service.subscribe([filter2], onEvent);

      const subscriptions = service.getSubscriptions();

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions.map(s => s.id)).toContain(subId1);
      expect(subscriptions.map(s => s.id)).toContain(subId2);
    });

    it('should return empty array when no subscriptions', () => {
      const subscriptions = service.getSubscriptions();

      expect(subscriptions).toHaveLength(0);
    });

    it('should filter subscriptions by state', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();

      // Disable pooling to create separate subscriptions
      const subId1 = await service.subscribe([filter], onEvent, { pool: false });
      const subId2 = await service.subscribe([filter], onEvent, { pool: false });

      service.pauseSubscription(subId1);

      const activeSubscriptions = service.getSubscriptions('active');
      const pausedSubscriptions = service.getSubscriptions('paused');

      expect(activeSubscriptions).toHaveLength(1);
      expect(activeSubscriptions[0].id).toBe(subId2);
      expect(pausedSubscriptions).toHaveLength(1);
      expect(pausedSubscriptions[0].id).toBe(subId1);
    });
  });

  // ========================================
  // Filter Optimization Tests
  // ========================================

  describe('Filter Optimization', () => {
    it('should merge similar filters', () => {
      const filters: NostrFilter[] = [
        { kinds: [1], authors: ['pubkey1'] },
        { kinds: [1], authors: ['pubkey2'] },
      ];

      const optimized = (service as any).optimizeFilters(filters);

      expect(optimized).toHaveLength(1);
      expect(optimized[0].kinds).toEqual([1]);
      expect(optimized[0].authors).toContain('pubkey1');
      expect(optimized[0].authors).toContain('pubkey2');
    });

    it('should not merge filters with different kinds', () => {
      const filters: NostrFilter[] = [
        { kinds: [1], authors: ['pubkey1'] },
        { kinds: [6], authors: ['pubkey1'] },
      ];

      const optimized = (service as any).optimizeFilters(filters);

      expect(optimized).toHaveLength(2);
    });

    it('should remove empty filters', () => {
      const filters: NostrFilter[] = [
        { kinds: [1] },
        {}, // Empty filter
        { kinds: [6] },
      ];

      const optimized = (service as any).optimizeFilters(filters);

      expect(optimized).toHaveLength(2);
    });

    it('should deduplicate array values in filters', () => {
      const filters: NostrFilter[] = [
        { kinds: [1, 1, 6, 6], authors: ['pubkey1', 'pubkey1'] },
      ];

      const optimized = (service as any).optimizeFilters(filters);

      expect(optimized[0].kinds).toEqual([1, 6]);
      expect(optimized[0].authors).toEqual(['pubkey1']);
    });
  });

  // ========================================
  // Subscription Pooling Tests
  // ========================================

  describe('Subscription Pooling', () => {
    it('should reuse existing subscription for identical filters', async () => {
      const filter: NostrFilter = { kinds: [1], limit: 10 };
      const onEvent1 = vi.fn();
      const onEvent2 = vi.fn();

      const subId1 = await service.subscribe([filter], onEvent1, { pool: true });
      const subId2 = await service.subscribe([filter], onEvent2, { pool: true });

      // Should return same subscription ID
      expect(subId1).toBe(subId2);

      // Should only create one relay subscription
      expect(mockRelayPoolManager.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should call all callbacks for pooled subscription', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent1 = vi.fn();
      const onEvent2 = vi.fn();
      const mockEvent = createMockEvent();

      await service.subscribe([filter], onEvent1, { pool: true });
      await service.subscribe([filter], onEvent2, { pool: true });

      // Simulate event reception
      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(mockEvent);

      expect(onEvent1).toHaveBeenCalledWith(mockEvent, expect.any(String));
      expect(onEvent2).toHaveBeenCalledWith(mockEvent, expect.any(String));
    });

    it('should not pool when pool option is false', async () => {
      const filter: NostrFilter = { kinds: [1], limit: 10 };
      const onEvent1 = vi.fn();
      const onEvent2 = vi.fn();

      const subId1 = await service.subscribe([filter], onEvent1, { pool: false });
      const subId2 = await service.subscribe([filter], onEvent2, { pool: false });

      expect(subId1).not.toBe(subId2);
      expect(mockRelayPoolManager.subscribe).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================
  // Event Count and Rate Tests
  // ========================================

  describe('Event Tracking', () => {
    it('should track event count for subscription', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const subId = await service.subscribe([filter], onEvent);

      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(createMockEvent());
      subscribeCallback(createMockEvent());
      subscribeCallback(createMockEvent());

      const subscription = service.getSubscription(subId);
      expect(subscription?.eventCount).toBe(3);
    });

    it('should track last event timestamp', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const subId = await service.subscribe([filter], onEvent);

      const beforeTime = Date.now();
      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(createMockEvent());
      const afterTime = Date.now();

      const subscription = service.getSubscription(subId);
      expect(subscription?.lastEvent).toBeGreaterThanOrEqual(beforeTime);
      expect(subscription?.lastEvent).toBeLessThanOrEqual(afterTime);
    });
  });

  // ========================================
  // EOSE Tracking Tests
  // ========================================

  describe('EOSE Tracking', () => {
    it('should track EOSE per relay', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const onEOSE = vi.fn();

      const subId = await service.subscribe([filter], onEvent, { onEOSE });

      const eoseCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][2];
      eoseCallback(); // Simulate EOSE from first relay

      const subscription = service.getSubscription(subId);
      expect(subscription?.eoseRelays).toContain('wss://relay1.com');
    });

    it('should mark subscription as EOSE complete when all relays report EOSE', async () => {
      mockRelayPoolManager.getConnectedRelays.mockReturnValue(['wss://relay1.com']);

      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const subId = await service.subscribe([filter], onEvent);

      const eoseCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][2];
      eoseCallback(); // EOSE from only relay

      const subscription = service.getSubscription(subId);
      expect(subscription?.eoseReceived).toBe(true);
    });
  });

  // ========================================
  // Cleanup Tests
  // ========================================

  describe('Automatic Cleanup', () => {
    it('should cleanup all subscriptions on destroy', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();

      await service.subscribe([filter], onEvent);
      await service.subscribe([filter], onEvent);

      await service.destroy();

      const subscriptions = service.getSubscriptions();
      expect(subscriptions).toHaveLength(0);
    });

    it('should call unsubscribe for all active subscriptions on destroy', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();

      // Disable pooling to create separate subscriptions
      await service.subscribe([filter], onEvent, { pool: false });
      await service.subscribe([filter], onEvent, { pool: false });

      await service.destroy();

      expect(mockRelayPoolManager.unsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================
  // Error Handling Tests
  // ========================================

  describe('Error Handling', () => {
    it('should call onError callback when subscription fails', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const onError = vi.fn();

      mockRelayPoolManager.subscribe.mockImplementation(() => {
        throw new Error('Subscription failed');
      });

      await expect(service.subscribe([filter], onEvent, { onError })).rejects.toThrow(
        'Subscription failed'
      );
    });

    it('should handle relay disconnection gracefully', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const subId = await service.subscribe([filter], onEvent);

      // Simulate relay disconnection
      mockRelayPoolManager.getConnectedRelays.mockReturnValue([]);

      const subscription = service.getSubscription(subId);
      expect(subscription).toBeDefined();
    });
  });

  // ========================================
  // Integration Tests
  // ========================================

  describe('Integration with RelayPoolManager', () => {
    it('should use relay pool manager for subscriptions', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();

      await service.subscribe([filter], onEvent);

      expect(mockRelayPoolManager.subscribe).toHaveBeenCalled();
    });

    it('should get connected relays from pool manager', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();

      await service.subscribe([filter], onEvent);

      expect(mockRelayPoolManager.getConnectedRelays).toHaveBeenCalled();
    });
  });

  describe('Integration with EventCacheService', () => {
    it('should cache events when autoCache is enabled', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const mockEvent = createMockEvent();

      await service.subscribe([filter], onEvent, { autoCache: true });

      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(mockEvent);

      expect(mockEventCache.set).toHaveBeenCalledWith(mockEvent, expect.any(Object));
    });

    it('should not cache events when autoCache is disabled', async () => {
      const filter: NostrFilter = { kinds: [1] };
      const onEvent = vi.fn();
      const mockEvent = createMockEvent();

      await service.subscribe([filter], onEvent, { autoCache: false });

      const subscribeCallback = (mockRelayPoolManager.subscribe as any).mock.calls[0][1];
      subscribeCallback(mockEvent);

      expect(mockEventCache.set).not.toHaveBeenCalled();
    });
  });
});
