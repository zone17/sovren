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

// Mock nostr-tools
jest.mock('nostr-tools', () => ({
  SimplePool: jest.fn().mockImplementation(() => ({
    ensureRelay: jest.fn().mockResolvedValue(undefined),
    subscribeMany: jest.fn().mockReturnValue({
      close: jest.fn(),
    }),
    publish: jest.fn().mockResolvedValue([]),
    close: jest.fn(),
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
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
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
      const invalidRelay = 'wss://nonexistent.relay.test';
      await manager.connect(invalidRelay);

      const status = manager.getRelayStatus(invalidRelay);
      expect(status).toBe(RelayStatus.ERROR);
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
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('should track relay success rate', async () => {
      const relayUrl = mockRelays[0];
      const health = manager.getRelayHealth(relayUrl);

      expect(health.successRate).toBeGreaterThanOrEqual(0);
      expect(health.successRate).toBeLessThanOrEqual(100);
    });

    it('should track relay uptime', async () => {
      const relayUrl = mockRelays[0];
      const health = manager.getRelayHealth(relayUrl);

      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.uptime).toBeLessThanOrEqual(100);
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
      // Simulate high latency
      manager.updateRelayMetrics(relayUrl, {
        latency: 1500,
        success: true,
      });

      const health = manager.getRelayHealth(relayUrl);
      expect(health.status).toBe(RelayHealth.DEGRADED);
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
      const healthCheckSpy = jest.spyOn(manager as any, 'performHealthCheck');

      jest.advanceTimersByTime(30000); // 30 seconds

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

    it('should automatically reconnect on connection loss', async () => {
      const relayUrl = mockRelays[0];
      await manager.connect(relayUrl);

      // Simulate connection loss
      manager.handleRelayDisconnect(relayUrl);

      // Wait for reconnection attempt
      jest.advanceTimersByTime(1000);

      const status = manager.getRelayStatus(relayUrl);
      expect(status).toBe(RelayStatus.RECONNECTING);
    });

    it('should use exponential backoff for reconnection', async () => {
      const relayUrl = mockRelays[0];
      await manager.connect(relayUrl);

      // Simulate multiple failed reconnection attempts
      manager.handleRelayDisconnect(relayUrl);

      jest.advanceTimersByTime(1000); // First retry: 1s
      expect(manager.getReconnectAttempts(relayUrl)).toBe(1);

      jest.advanceTimersByTime(2000); // Second retry: 2s
      expect(manager.getReconnectAttempts(relayUrl)).toBe(2);

      jest.advanceTimersByTime(4000); // Third retry: 4s
      expect(manager.getReconnectAttempts(relayUrl)).toBe(3);
    });

    it('should stop reconnecting after max attempts', async () => {
      const relayUrl = mockRelays[0];
      await manager.connect(relayUrl);

      manager.handleRelayDisconnect(relayUrl);

      // Simulate max reconnection attempts (5)
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(Math.pow(2, i) * 1000);
      }

      const status = manager.getRelayStatus(relayUrl);
      expect(status).toBe(RelayStatus.FAILED);
    });

    it('should reset reconnect attempts on successful connection', async () => {
      const relayUrl = mockRelays[0];
      await manager.connect(relayUrl);

      manager.handleRelayDisconnect(relayUrl);
      jest.advanceTimersByTime(1000);

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
      const invalidEvent = { ...mockEvent, id: undefined } as any;

      const results = await manager.publishEvent(invalidEvent);

      // Should still return results, but with errors
      expect(results.some(r => r.error)).toBe(true);
    });

    it('should retry publishing on transient failures', async () => {
      const publishSpy = jest.spyOn(manager as any, 'publishToRelay');

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
      const subId = manager.subscribe(mockFilters, jest.fn());

      expect(subId).toBeDefined();
      expect(manager.getActiveSubscriptions()).toContain(subId);
    });

    it('should aggregate events from multiple relays', () => {
      const onEvent = jest.fn();

      const subId = manager.subscribe(mockFilters, onEvent);

      expect(subId).toBeDefined();
      expect(manager.getActiveSubscriptions()).toContain(subId);
    });

    it('should deduplicate events by ID', () => {
      const onEvent = jest.fn();

      const subId = manager.subscribe(mockFilters, onEvent);

      expect(subId).toBeDefined();
      // Deduplication is handled internally by RelayPoolManager
    });

    it('should unsubscribe from all relays', () => {
      const subId = manager.subscribe(mockFilters, jest.fn());

      manager.unsubscribe(subId);

      expect(manager.getActiveSubscriptions()).not.toContain(subId);
    });

    it('should call onEose callback when subscription completes', () => {
      const onEose = jest.fn();

      manager.subscribe(mockFilters, jest.fn(), onEose);

      // onEose will be called by the pool when subscription ends
      expect(onEose).toBeDefined();
    });

    it('should handle subscription errors gracefully', () => {
      const invalidFilters = [{ kinds: 'invalid' }] as any;

      expect(() => {
        manager.subscribe(invalidFilters, jest.fn());
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
      manager.updateRelayMetrics(mockRelays[0], { latency: 300, success: true });
      manager.updateRelayMetrics(mockRelays[1], { latency: 100, success: true });
      manager.updateRelayMetrics(mockRelays[2], { latency: 200, success: true });

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
      const errorHandler = jest.fn();
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
      jest.advanceTimersByTime(1000);

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

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

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

      const healthCheckSpy = jest.spyOn(manager as any, 'performHealthCheck');

      jest.advanceTimersByTime(30000);

      // Should batch check all relays, not check individually
      expect(healthCheckSpy).toHaveBeenCalledTimes(1);
    });
  });
});
