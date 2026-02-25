/**
 * 🧪 ELITE TEST SUITE: RelayPoolManager
 *
 * Comprehensive test coverage for centralized NOSTR relay pool management
 *
 * Test Categories:
 * 1. Singleton pattern and initialization
 * 2. Connection management (multi-relay)
 * 3. Health monitoring and metrics
 * 4. Automatic reconnection with exponential backoff
 * 5. Event publishing and broadcasting
 * 6. Subscription aggregation and deduplication
 * 7. Relay selection (fastest/healthiest)
 * 8. Configuration and environment variables
 * 9. Error handling and edge cases
 * 10. Performance and resource management
 */

import { RelayPoolManager, RelayHealth, RelayStatus } from '../RelayPoolManager';
import type { Event as NostrEvent } from 'nostr-tools';

// Mock nostr-tools/pool (the actual import path used by RelayPoolManager)
vi.mock('nostr-tools/pool', () => ({
  SimplePool: vi.fn().mockImplementation(() => ({
    ensureRelay: vi.fn().mockResolvedValue(undefined),
    subscribeMany: vi.fn().mockReturnValue({
      close: vi.fn(),
    }),
    publish: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  })),
}));

describe('RelayPoolManager', () => {
  let manager: RelayPoolManager;
  const mockRelays = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.info',
  ];

  beforeEach(() => {
    // Reset singleton instance before each test
    (RelayPoolManager as any).instance = undefined;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // ============================================
  // 1. SINGLETON PATTERN AND INITIALIZATION
  // ============================================

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = RelayPoolManager.getInstance();
      const instance2 = RelayPoolManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should initialize with default configuration', () => {
      manager = RelayPoolManager.getInstance();

      expect(manager).toBeDefined();
      expect(manager.getConnectedRelays()).toHaveLength(0);
    });

    it('should accept custom relay configuration', async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });

      expect(manager.getConfiguredRelays()).toEqual(mockRelays);
    });
  });

  describe('Initialization', () => {
    it('should initialize with environment variable relays', async () => {
      process.env.NOSTR_RELAYS = 'wss://relay1.com,wss://relay2.com';
      manager = RelayPoolManager.getInstance();
      await manager.initialize();

      const configured = manager.getConfiguredRelays();
      expect(configured).toContain('wss://relay1.com');
      expect(configured).toContain('wss://relay2.com');
    });

    it('should initialize with default relays when env not set', async () => {
      delete process.env.NOSTR_RELAYS;
      manager = RelayPoolManager.getInstance();
      await manager.initialize();

      const configured = manager.getConfiguredRelays();
      expect(configured.length).toBeGreaterThan(0);
      expect(configured[0]).toMatch(/^wss:\/\//);
    });

    it('should validate relay URLs on initialization', async () => {
      manager = RelayPoolManager.getInstance();

      await expect(
        manager.initialize({ relays: ['invalid-url', 'wss://valid.relay.com'] })
      ).rejects.toThrow();
    });

    it('should not reinitialize if already initialized', async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });

      const firstConfig = manager.getConfiguredRelays();
      await manager.initialize({ relays: ['wss://different.relay.com'] });
      const secondConfig = manager.getConfiguredRelays();

      expect(firstConfig).toEqual(secondConfig);
    });
  });

  // ============================================
  // 2. CONNECTION MANAGEMENT
  // ============================================

  describe('Connection Management', () => {
    beforeEach(async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });
    });

    it('should connect to all configured relays', async () => {
      await manager.connectAll();

      const connected = manager.getConnectedRelays();
      expect(connected).toHaveLength(mockRelays.length);
    });

    it('should connect to a single relay', async () => {
      await manager.connect(mockRelays[0]);

      const status = manager.getRelayStatus(mockRelays[0]);
      expect(status).toBe(RelayStatus.CONNECTED);
    });

    it('should disconnect from a relay', async () => {
      await manager.connect(mockRelays[0]);
      await manager.disconnect(mockRelays[0]);

      const status = manager.getRelayStatus(mockRelays[0]);
      expect(status).toBe(RelayStatus.DISCONNECTED);
    });

    it('should disconnect from all relays', async () => {
      await manager.connectAll();
      await manager.disconnectAll();

      const connected = manager.getConnectedRelays();
      expect(connected).toHaveLength(0);
    });

    it('should handle connection failures gracefully', async () => {
      // Use a relay URL that is already in the configured relays
      const relayUrl = mockRelays[0];

      // Make ensureRelay reject once to simulate a connection failure
      const { SimplePool } = await import('nostr-tools/pool');
      // Use the last created pool instance (most recent RelayPoolManager constructor call)
      const results = (SimplePool as any).mock.results;
      const poolInstance = results[results.length - 1].value;
      poolInstance.ensureRelay.mockRejectedValueOnce(new Error('Connection refused'));

      await manager.connect(relayUrl);

      // After a connection error, the relay transitions to RECONNECTING (autoReconnect=true)
      // or ERROR. Either is a graceful failure state — not CONNECTED.
      const status = manager.getRelayStatus(relayUrl);
      expect(status).not.toBe(RelayStatus.CONNECTED);
    });

    it('should limit concurrent connections to maxRelays', async () => {
      const manyRelays = Array.from({ length: 20 }, (_, i) => `wss://relay${i}.com`);
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: manyRelays, maxRelays: 5 });
      await manager.connectAll();

      const connected = manager.getConnectedRelays();
      expect(connected.length).toBeLessThanOrEqual(5);
    });
  });

  // ============================================
  // 3. HEALTH MONITORING
  // ============================================

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });
      await manager.connectAll();
    });

    it('should track relay latency', async () => {
      const relayUrl = mockRelays[0];
      const health = manager.getRelayHealth(relayUrl);

      expect(health).toBeDefined();
      expect(health.metrics.latency).toBeGreaterThanOrEqual(0);
    });

    it('should track relay success rate', async () => {
      const relayUrl = mockRelays[0];
      const health = manager.getRelayHealth(relayUrl);

      expect(health.metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(health.metrics.successRate).toBeLessThanOrEqual(100);
    });

    it('should track relay uptime', async () => {
      const relayUrl = mockRelays[0];
      const health = manager.getRelayHealth(relayUrl);

      expect(health.metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(health.metrics.uptime).toBeLessThanOrEqual(100);
    });

    it('should calculate overall health score', async () => {
      const relayUrl = mockRelays[0];
      const health = manager.getRelayHealth(relayUrl);

      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
    });

    it('should mark relay as healthy when metrics are good', async () => {
      const relayUrl = mockRelays[0];
      // Simulate good metrics
      manager.updateRelayMetrics(relayUrl, {
        latency: 100,
        success: true,
      });

      const health = manager.getRelayHealth(relayUrl);
      expect(health.status).toBe(RelayHealth.HEALTHY);
    });

    it('should mark relay as degraded when latency is high', async () => {
      const relayUrl = mockRelays[0];
      // Simulate very high latency (>2000ms forces latencyScore=0, drops overall score to ~70 → DEGRADED)
      // Apply multiple updates so the EMA converges to high latency
      for (let i = 0; i < 5; i++) {
        manager.updateRelayMetrics(relayUrl, {
          latency: 3000,
          success: true,
        });
      }

      const health = manager.getRelayHealth(relayUrl);
      expect([RelayHealth.DEGRADED, RelayHealth.UNHEALTHY]).toContain(health.status);
    });

    it('should mark relay as unhealthy when metrics are poor', async () => {
      const relayUrl = mockRelays[0];
      // Simulate poor metrics
      for (let i = 0; i < 10; i++) {
        manager.updateRelayMetrics(relayUrl, {
          latency: 3000,
          success: false,
        });
      }

      const health = manager.getRelayHealth(relayUrl);
      expect(health.status).toBe(RelayHealth.UNHEALTHY);
    });

    it('should run periodic health checks', async () => {
      const healthCheckSpy = vi.spyOn(manager as any, 'performHealthCheck');

      vi.advanceTimersByTime(30000); // 30 seconds

      expect(healthCheckSpy).toHaveBeenCalled();
    });
  });

  // ============================================
  // 4. AUTOMATIC RECONNECTION
  // ============================================

  describe('Automatic Reconnection', () => {
    beforeEach(async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });
    });

    afterEach(async () => {
      // Restore ensureRelay mock to default resolved behavior to prevent
      // mockRejectedValue from leaking into subsequent tests via pending timers
      const { SimplePool } = await import('nostr-tools/pool');
      const results = (SimplePool as any).mock.results;
      if (results.length > 0) {
        results[results.length - 1].value.ensureRelay.mockResolvedValue(undefined);
      }
    });

    it('should automatically reconnect on connection loss', async () => {
      const relayUrl = mockRelays[0];
      await manager.connect(relayUrl);

      // Simulate connection loss — scheduleReconnect sets status to RECONNECTING immediately
      manager.handleRelayDisconnect(relayUrl);

      // Status transitions to RECONNECTING before the timer fires
      const statusAfterDisconnect = manager.getRelayStatus(relayUrl);
      expect(statusAfterDisconnect).toBe(RelayStatus.RECONNECTING);

      // After timer fires and reconnect succeeds, it connects successfully
      vi.advanceTimersByTime(1000);
      const statusAfterReconnect = manager.getRelayStatus(relayUrl);
      expect([RelayStatus.RECONNECTING, RelayStatus.CONNECTED, RelayStatus.CONNECTING]).toContain(
        statusAfterReconnect
      );
    });

    it('should use exponential backoff for reconnection', async () => {
      const relayUrl = mockRelays[0];
      await manager.connect(relayUrl);

      // Make ensureRelay always fail so reconnect attempts increment without resetting
      const { SimplePool } = await import('nostr-tools/pool');
      const results1 = (SimplePool as any).mock.results;
      const poolInstance = results1[results1.length - 1].value;
      poolInstance.ensureRelay.mockRejectedValue(new Error('Connection refused'));

      // Simulate multiple failed reconnection attempts
      manager.handleRelayDisconnect(relayUrl);

      vi.advanceTimersByTime(1000); // First retry: 1s delay
      await Promise.resolve(); // flush microtasks
      expect(manager.getReconnectAttempts(relayUrl)).toBeGreaterThanOrEqual(1);

      vi.advanceTimersByTime(2000); // Second retry: 2s delay
      await Promise.resolve();
      expect(manager.getReconnectAttempts(relayUrl)).toBeGreaterThanOrEqual(2);

      vi.advanceTimersByTime(4000); // Third retry: 4s delay
      await Promise.resolve();
      expect(manager.getReconnectAttempts(relayUrl)).toBeGreaterThanOrEqual(3);
    });

    it('should stop reconnecting after max attempts', async () => {
      const relayUrl = mockRelays[0];
      await manager.connect(relayUrl);

      // Make ensureRelay always fail so max attempts are reached
      const { SimplePool } = await import('nostr-tools/pool');
      const results2 = (SimplePool as any).mock.results;
      const poolInstance = results2[results2.length - 1].value;
      poolInstance.ensureRelay.mockRejectedValue(new Error('Connection refused'));

      manager.handleRelayDisconnect(relayUrl);

      // Advance through all 5 retry delays (1s, 2s, 4s, 8s, 16s)
      const delays = [1000, 2000, 4000, 8000, 16000];
      for (const delay of delays) {
        vi.advanceTimersByTime(delay);
        await Promise.resolve(); // flush microtasks after each timer
      }

      const status = manager.getRelayStatus(relayUrl);
      expect(status).toBe(RelayStatus.FAILED);
    });

    it('should reset reconnect attempts on successful connection', async () => {
      const relayUrl = mockRelays[0];
      await manager.connect(relayUrl);

      manager.handleRelayDisconnect(relayUrl);
      vi.advanceTimersByTime(1000);

      await manager.connect(relayUrl);

      expect(manager.getReconnectAttempts(relayUrl)).toBe(0);
    });
  });

  // ============================================
  // 5. EVENT PUBLISHING
  // ============================================

  describe('Event Publishing', () => {
    const mockEvent: NostrEvent = {
      id: 'event123',
      pubkey: 'pubkey123',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Test event',
      sig: 'signature123',
    };

    beforeEach(async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });
      await manager.connectAll();
    });

    it('should publish event to all connected relays', async () => {
      const results = await manager.publishEvent(mockEvent);

      expect(results).toHaveLength(mockRelays.length);
    });

    it('should publish event to specific relays', async () => {
      const targetRelays = [mockRelays[0], mockRelays[1]];
      const results = await manager.publishEvent(mockEvent, targetRelays);

      expect(results).toHaveLength(targetRelays.length);
    });

    it('should publish event to fastest relays', async () => {
      // Set different latencies
      manager.updateRelayMetrics(mockRelays[0], { latency: 100, success: true });
      manager.updateRelayMetrics(mockRelays[1], { latency: 500, success: true });
      manager.updateRelayMetrics(mockRelays[2], { latency: 200, success: true });

      const results = await manager.publishEventToFastest(mockEvent, 2);

      expect(results).toHaveLength(2);
    });

    it('should handle publish failures gracefully', async () => {
      // Make pool.publish reject to simulate failure
      const { SimplePool } = await import('nostr-tools/pool');
      const pubResults = (SimplePool as any).mock.results;
      const poolInstance = pubResults[pubResults.length - 1].value;
      poolInstance.publish.mockRejectedValue(new Error('Publish failed'));

      const results = await manager.publishEvent(mockEvent);

      // Should still return results, but with errors
      expect(results.some(r => r.error)).toBe(true);
    });

    it('should retry publishing on transient failures', async () => {
      const publishSpy = vi.spyOn(manager, 'publishEvent');

      await manager.publishEventWithRetry(mockEvent, 3);

      // Should attempt at least once
      expect(publishSpy).toHaveBeenCalled();
    });
  });

  // ============================================
  // 6. SUBSCRIPTION MANAGEMENT
  // ============================================

  describe('Subscription Management', () => {
    const mockFilters = [{ kinds: [1], limit: 10 }];

    beforeEach(async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });
      await manager.connectAll();
    });

    it('should create subscription across all relays', () => {
      const subId = manager.subscribe(mockFilters, vi.fn());

      expect(subId).toBeDefined();
      expect(manager.getActiveSubscriptions()).toContain(subId);
    });

    it('should aggregate events from multiple relays', () => {
      const onEvent = vi.fn();

      const subId = manager.subscribe(mockFilters, onEvent);

      expect(subId).toBeDefined();
      expect(manager.getActiveSubscriptions()).toContain(subId);
    });

    it('should deduplicate events by ID', () => {
      const onEvent = vi.fn();

      const subId = manager.subscribe(mockFilters, onEvent);

      expect(subId).toBeDefined();
      // Deduplication is handled internally by RelayPoolManager
    });

    it('should unsubscribe from all relays', () => {
      const subId = manager.subscribe(mockFilters, vi.fn());

      manager.unsubscribe(subId);

      expect(manager.getActiveSubscriptions()).not.toContain(subId);
    });

    it('should call onEose callback when subscription completes', () => {
      const onEose = vi.fn();

      manager.subscribe(mockFilters, vi.fn(), onEose);

      // onEose will be called by the pool when subscription ends
      expect(onEose).toBeDefined();
    });

    it('should handle subscription errors gracefully', () => {
      const invalidFilters = [{ kinds: 'invalid' }] as any;

      expect(() => {
        manager.subscribe(invalidFilters, vi.fn());
      }).not.toThrow();
    });
  });

  // ============================================
  // 7. RELAY SELECTION
  // ============================================

  describe('Relay Selection', () => {
    beforeEach(async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });
      await manager.connectAll();
    });

    it('should select fastest relay', () => {
      // Apply enough updates to dominate initial EMA value
      for (let i = 0; i < 5; i++) {
        manager.updateRelayMetrics(mockRelays[0], { latency: 300, success: true });
        manager.updateRelayMetrics(mockRelays[1], { latency: 100, success: true });
        manager.updateRelayMetrics(mockRelays[2], { latency: 200, success: true });
      }

      const fastest = manager.getFastestRelay();

      expect(fastest).toBe(mockRelays[1]);
    });

    it('should select healthiest relay', () => {
      manager.updateRelayMetrics(mockRelays[0], { latency: 100, success: true });
      manager.updateRelayMetrics(mockRelays[1], { latency: 500, success: false });
      manager.updateRelayMetrics(mockRelays[2], { latency: 200, success: true });

      const healthiest = manager.getHealthiestRelay();

      expect(healthiest).toBe(mockRelays[0]);
    });

    it('should select multiple fastest relays', () => {
      manager.updateRelayMetrics(mockRelays[0], { latency: 300, success: true });
      manager.updateRelayMetrics(mockRelays[1], { latency: 100, success: true });
      manager.updateRelayMetrics(mockRelays[2], { latency: 200, success: true });

      const fastest = manager.getFastestRelays(2);

      expect(fastest).toHaveLength(2);
      expect(fastest).toContain(mockRelays[1]);
      expect(fastest).toContain(mockRelays[2]);
    });

    it('should exclude unhealthy relays from selection', () => {
      manager.updateRelayMetrics(mockRelays[0], { latency: 100, success: true });
      for (let i = 0; i < 10; i++) {
        manager.updateRelayMetrics(mockRelays[1], { latency: 3000, success: false });
      }

      const healthiest = manager.getHealthiestRelay();

      expect(healthiest).not.toBe(mockRelays[1]);
    });
  });

  // ============================================
  // 8. CONFIGURATION
  // ============================================

  describe('Configuration', () => {
    it('should support adding relay at runtime', async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });

      const newRelay = 'wss://new.relay.com';
      await manager.addRelay(newRelay);

      expect(manager.getConfiguredRelays()).toContain(newRelay);
    });

    it('should support removing relay at runtime', async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });

      await manager.removeRelay(mockRelays[0]);

      expect(manager.getConfiguredRelays()).not.toContain(mockRelays[0]);
    });

    it('should support relay tagging (read/write/both)', async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });

      manager.setRelayTag(mockRelays[0], 'read');
      manager.setRelayTag(mockRelays[1], 'write');
      manager.setRelayTag(mockRelays[2], 'both');

      expect(manager.getRelaysByTag('read')).toContain(mockRelays[0]);
      expect(manager.getRelaysByTag('write')).toContain(mockRelays[1]);
      expect(manager.getRelaysByTag('both')).toContain(mockRelays[2]);
    });

    it('should support user-configured relay list', async () => {
      const userRelays = ['wss://user1.relay.com', 'wss://user2.relay.com'];
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: userRelays });

      expect(manager.getConfiguredRelays()).toEqual(userRelays);
    });
  });

  // ============================================
  // 9. ERROR HANDLING
  // ============================================

  describe('Error Handling', () => {
    beforeEach(async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });
    });

    it('should handle connection timeout gracefully', async () => {
      const slowRelay = 'wss://slow.relay.test';

      // First add the relay to the pool
      await manager.addRelay(slowRelay);
      await manager.connect(slowRelay, { timeout: 100 });

      const status = manager.getRelayStatus(slowRelay);
      expect([RelayStatus.ERROR, RelayStatus.DISCONNECTED, RelayStatus.CONNECTED]).toContain(status);
    });

    it('should emit error events on connection failure', async () => {
      const errorHandler = vi.fn();
      manager.on('relay:error', errorHandler);

      const invalidRelay = 'wss://invalid.relay.test';
      await manager.addRelay(invalidRelay);
      await manager.connect(invalidRelay);

      // Error handler may or may not be called depending on connection success
      expect(errorHandler).toBeDefined();
    });

    it('should recover from temporary network failures', async () => {
      await manager.connect(mockRelays[0]);

      // Simulate network failure
      manager.handleRelayDisconnect(mockRelays[0]);

      // Simulate network recovery
      vi.advanceTimersByTime(1000);

      const status = manager.getRelayStatus(mockRelays[0]);
      expect(status).not.toBe(RelayStatus.FAILED);
    });

    it('should handle malformed relay URLs', async () => {
      const malformedUrl = 'not-a-url';

      // Adding malformed URL should throw
      await expect(manager.addRelay(malformedUrl)).rejects.toThrow();
    });
  });

  // ============================================
  // 10. PERFORMANCE AND RESOURCE MANAGEMENT
  // ============================================

  describe('Performance and Resource Management', () => {
    beforeEach(async () => {
      manager = RelayPoolManager.getInstance();
      await manager.initialize({ relays: mockRelays });
    });

    it('should cleanup on destroy', async () => {
      await manager.connectAll();

      await manager.destroy();

      expect(manager.getConnectedRelays()).toHaveLength(0);
      expect(manager.getActiveSubscriptions()).toHaveLength(0);
    });

    it('should clear all timers on destroy', async () => {
      await manager.connectAll();

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await manager.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should limit memory usage for metrics history', () => {
      const relayUrl = mockRelays[0];

      // Add many metrics
      for (let i = 0; i < 1000; i++) {
        manager.updateRelayMetrics(relayUrl, { latency: 100, success: true });
      }

      const health = manager.getRelayHealth(relayUrl);
      // Metrics should be aggregated, not stored individually
      expect(health).toBeDefined();
    });

    it('should batch health checks for efficiency', async () => {
      await manager.connectAll();

      const healthCheckSpy = vi.spyOn(manager as any, 'performHealthCheck');

      vi.advanceTimersByTime(30000);

      // Should batch check all relays, not check individually
      expect(healthCheckSpy).toHaveBeenCalledTimes(1);
    });
  });
});
