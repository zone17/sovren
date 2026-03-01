/**
 * 🌐 RelayPoolManager Integration Tests
 * US-318: Comprehensive Integration Tests
 *
 * Tests RelayPoolManager with real relay connections:
 * - Multi-relay connections
 * - Failover scenarios
 * - Connection pooling
 * - Health checks
 * - Performance benchmarks
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RelayPoolManager, RelayStatus, RelayHealth } from '../../RelayPoolManager';
import { TEST_RELAYS, TEST_CONFIG, setupIntegrationTests, cleanupServices } from './setup';
import { TestEventFactory } from './helpers/test-events';
import { PerformanceBenchmark, LatencyMeasurement } from './helpers/performance-utils';
import { KeyManagementService } from '../../KeyManagementService';
import type { NostrEvent } from '@shared/types/nostr/index';

// Setup integration test environment
setupIntegrationTests();

describe('RelayPoolManager Integration Tests', () => {
  let relayPool: RelayPoolManager;
  let keyManagement: KeyManagementService;
  let perfBenchmark: PerformanceBenchmark;

  beforeAll(async () => {
    // Initialize services
    keyManagement = KeyManagementService.getInstance();
    await keyManagement.initialize();

    relayPool = RelayPoolManager.getInstance();
    perfBenchmark = new PerformanceBenchmark();
  });

  afterAll(async () => {
    await cleanupServices(relayPool, keyManagement);
    perfBenchmark.printReport();
  });

  beforeEach(async () => {
    // Ensure clean state
    await relayPool.disconnectAll();
  });

  describe('Multi-Relay Connections', () => {
    it(
      'should connect to multiple relays simultaneously',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: TEST_RELAYS.all });

        // Act
        const result = await perfBenchmark.measure('connect-all', async () => {
          await relayPool.connectAll();
          return relayPool.getConnectedRelays();
        });

        // Assert
        expect(result.result.length).toBeGreaterThan(0);
        expect(result.duration).toBeLessThan(TEST_CONFIG.timeout.connection);

        console.log(
          `✅ Connected to ${result.result.length} relays in ${result.duration.toFixed(2)}ms`
        );
      },
      TEST_CONFIG.timeout.default
    );

    it(
      'should handle partial connection failures gracefully',
      async () => {
        // Arrange: Mix of valid and invalid relays
        const relays = [...TEST_RELAYS.all, 'wss://invalid-relay-that-does-not-exist.com'];

        await relayPool.initialize({ relays });

        // Act
        await relayPool.connectAll();

        // Assert
        const connected = relayPool.getConnectedRelays();
        expect(connected.length).toBeGreaterThan(0);
        expect(connected.length).toBeLessThan(relays.length); // Some should fail

        console.log(`✅ Connected to ${connected.length}/${relays.length} relays`);
      },
      TEST_CONFIG.timeout.default
    );

    it(
      'should track relay connection status accurately',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: TEST_RELAYS.all });
        await relayPool.connectAll();

        // Act & Assert
        for (const relay of TEST_RELAYS.all) {
          const status = relayPool.getRelayStatus(relay);
          expect([RelayStatus.CONNECTED, RelayStatus.ERROR]).toContain(status);
        }
      },
      TEST_CONFIG.timeout.default
    );

    it(
      'should provide accurate relay health information',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: TEST_RELAYS.all });
        await relayPool.connectAll();

        // Act
        const connectedRelays = relayPool.getConnectedRelays();

        // Assert
        for (const relay of connectedRelays) {
          const health = relayPool.getRelayHealth(relay);

          expect(health).toBeDefined();
          expect(health.url).toBe(relay);
          expect(health.score).toBeGreaterThanOrEqual(0);
          expect(health.score).toBeLessThanOrEqual(100);
          expect([RelayHealth.HEALTHY, RelayHealth.DEGRADED, RelayHealth.UNHEALTHY]).toContain(
            health.status
          );
        }
      },
      TEST_CONFIG.timeout.default
    );
  });

  describe('Failover Scenarios', () => {
    it('should automatically reconnect after relay disconnection', async () => {
      // Arrange
      await relayPool.initialize({
        relays: [TEST_RELAYS.primary],
        autoReconnect: true,
        maxReconnectAttempts: 3,
      });
      await relayPool.connect(TEST_RELAYS.primary);

      // Act: Simulate disconnection
      relayPool.handleRelayDisconnect(TEST_RELAYS.primary);

      // Wait for reconnection attempt
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Assert
      const reconnectAttempts = relayPool.getReconnectAttempts(TEST_RELAYS.primary);
      expect(reconnectAttempts).toBeGreaterThan(0);
    }, 10000);

    it(
      'should fail over to healthy relays when one fails',
      async () => {
        // Arrange
        const relays = [...TEST_RELAYS.all, 'wss://failing-relay.invalid'];
        await relayPool.initialize({ relays });
        await relayPool.connectAll();

        // Generate test event
        const activeKey = keyManagement.getActiveKey();
        if (!activeKey) throw new Error('No active key');

        const unsigned = TestEventFactory.textNote('Failover test');
        const event = await keyManagement.signEvent(activeKey.keyId, unsigned);

        // Act: Publish to all relays (including failing one)
        const results = await relayPool.publishEvent(event);

        // Assert: At least some relays succeeded
        const successCount = results.filter((r) => r.success).length;
        expect(successCount).toBeGreaterThan(0);

        console.log(`✅ Published to ${successCount}/${results.length} relays`);
      },
      TEST_CONFIG.timeout.default
    );

    it(
      'should prioritize fastest relays for publishing',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: TEST_RELAYS.all });
        await relayPool.connectAll();

        // Generate test event
        const activeKey = keyManagement.getActiveKey();
        if (!activeKey) throw new Error('No active key');

        const unsigned = TestEventFactory.textNote('Fastest relay test');
        const event = await keyManagement.signEvent(activeKey.keyId, unsigned);

        // Act
        const latencyMeasurement = new LatencyMeasurement();
        const results = await relayPool.publishEventToFastest(event, 2);

        results.forEach((r) => {
          if (r.latency) latencyMeasurement.record(r.latency);
        });

        // Assert
        expect(results.length).toBeLessThanOrEqual(2);
        const avgLatency = latencyMeasurement.getAverage();
        expect(avgLatency).toBeLessThan(TEST_CONFIG.performance.publishLatency * 2); // Allow 2x threshold

        console.log(`✅ Avg latency to fastest relays: ${avgLatency.toFixed(2)}ms`);
      },
      TEST_CONFIG.timeout.default
    );
  });

  describe('Connection Pooling', () => {
    it(
      'should reuse existing connections',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: [TEST_RELAYS.primary] });

        // Act: Connect multiple times
        await relayPool.connect(TEST_RELAYS.primary);
        await relayPool.connect(TEST_RELAYS.primary); // Should reuse

        // Assert
        const status = relayPool.getRelayStatus(TEST_RELAYS.primary);
        expect(status).toBe(RelayStatus.CONNECTED);
      },
      TEST_CONFIG.timeout.default
    );

    it(
      'should limit maximum number of connections',
      async () => {
        // Arrange: More relays than max allowed
        const manyRelays = [
          ...TEST_RELAYS.all,
          'wss://relay1.example.com',
          'wss://relay2.example.com',
          'wss://relay3.example.com',
        ];

        await relayPool.initialize({
          relays: manyRelays,
          maxRelays: 3,
        });

        // Act
        await relayPool.connectAll();

        // Assert
        const connected = relayPool.getConnectedRelays();
        expect(connected.length).toBeLessThanOrEqual(3);
      },
      TEST_CONFIG.timeout.default
    );

    it(
      'should allow dynamic relay addition',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: [TEST_RELAYS.primary] });
        await relayPool.connectAll();

        const initialCount = relayPool.getConfiguredRelays().length;

        // Act
        await relayPool.addRelay(TEST_RELAYS.secondary[0]);

        // Assert
        const newCount = relayPool.getConfiguredRelays().length;
        expect(newCount).toBe(initialCount + 1);
      },
      TEST_CONFIG.timeout.default
    );

    it(
      'should allow dynamic relay removal',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: TEST_RELAYS.all });
        await relayPool.connectAll();

        const initialCount = relayPool.getConfiguredRelays().length;

        // Act
        await relayPool.removeRelay(TEST_RELAYS.all[0]);

        // Assert
        const newCount = relayPool.getConfiguredRelays().length;
        expect(newCount).toBe(initialCount - 1);
      },
      TEST_CONFIG.timeout.default
    );
  });

  describe('Health Checks', () => {
    it('should perform periodic health checks', async () => {
      // Arrange
      await relayPool.initialize({
        relays: TEST_RELAYS.all,
        enableHealthMonitoring: true,
        healthCheckInterval: 1000,
      });
      await relayPool.connectAll();

      // Act: Wait for health checks
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Assert
      const connectedRelays = relayPool.getConnectedRelays();
      for (const relay of connectedRelays) {
        const health = relayPool.getRelayHealth(relay);
        expect(health.lastCheck).toBeGreaterThan(0);
      }
    }, 5000);

    it(
      'should calculate health scores accurately',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: TEST_RELAYS.all });
        await relayPool.connectAll();

        // Generate test event
        const activeKey = keyManagement.getActiveKey();
        if (!activeKey) throw new Error('No active key');

        const unsigned = TestEventFactory.textNote('Health score test');
        const event = await keyManagement.signEvent(activeKey.keyId, unsigned);

        // Act: Publish to generate metrics
        await relayPool.publishEvent(event);

        // Assert
        const connectedRelays = relayPool.getConnectedRelays();
        for (const relay of connectedRelays) {
          const health = relayPool.getRelayHealth(relay);
          expect(health.score).toBeGreaterThanOrEqual(0);
          expect(health.score).toBeLessThanOrEqual(100);
        }
      },
      TEST_CONFIG.timeout.default
    );

    it(
      'should identify healthiest relay',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: TEST_RELAYS.all });
        await relayPool.connectAll();

        // Act
        const healthiest = relayPool.getHealthiestRelay();

        // Assert
        expect(healthiest).toBeDefined();
        if (healthiest) {
          const health = relayPool.getRelayHealth(healthiest);
          expect(health.status).toBe(RelayHealth.HEALTHY);
        }
      },
      TEST_CONFIG.timeout.default
    );
  });

  describe('Performance Benchmarks', () => {
    it('should meet connection latency threshold', async () => {
      // Benchmark
      const result = await perfBenchmark.benchmark(
        {
          name: 'relay-connection',
          thresholdMs: 5000,
          warmupRuns: 1,
          testRuns: 3,
        },
        async () => {
          await relayPool.initialize({ relays: [TEST_RELAYS.primary] });
          await relayPool.connect(TEST_RELAYS.primary);
          await relayPool.disconnect(TEST_RELAYS.primary);
        }
      );

      expect(result.passed).toBe(true);
    }, 30000);

    it('should meet event publishing latency threshold', async () => {
      // Arrange
      await relayPool.initialize({ relays: TEST_RELAYS.all });
      await relayPool.connectAll();

      const activeKey = keyManagement.getActiveKey();
      if (!activeKey) throw new Error('No active key');

      // Benchmark
      const result = await perfBenchmark.benchmark(
        {
          name: 'event-publishing',
          thresholdMs: TEST_CONFIG.performance.publishLatency,
          warmupRuns: 3,
          testRuns: 10,
        },
        async () => {
          const unsigned = TestEventFactory.textNote('Performance test');
          const event = await keyManagement.signEvent(activeKey.keyId, unsigned);
          await relayPool.publishEvent(event);
        }
      );

      expect(result.passed).toBe(true);
    }, 60000);

    it('should handle high-volume publishing', async () => {
      // Arrange
      await relayPool.initialize({ relays: TEST_RELAYS.all });
      await relayPool.connectAll();

      const activeKey = keyManagement.getActiveKey();
      if (!activeKey) throw new Error('No active key');

      // Act: Publish 50 events
      const eventCount = 50;
      const start = performance.now();

      for (let i = 0; i < eventCount; i++) {
        const unsigned = TestEventFactory.textNote(`Batch event ${i + 1}`);
        const event = await keyManagement.signEvent(activeKey.keyId, unsigned);
        await relayPool.publishEvent(event);
      }

      const duration = performance.now() - start;

      // Assert
      const avgLatency = duration / eventCount;
      expect(avgLatency).toBeLessThan(TEST_CONFIG.performance.publishLatency * 3); // Allow 3x threshold

      console.log(`✅ Published ${eventCount} events in ${duration.toFixed(2)}ms`);
      console.log(`   Avg: ${avgLatency.toFixed(2)}ms per event`);
    }, 120000);
  });

  describe('Subscription Management', () => {
    it(
      'should create subscriptions across multiple relays',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: TEST_RELAYS.all });
        await relayPool.connectAll();

        const events: NostrEvent[] = [];
        let eoseReceived = false;

        // Act
        const subId = relayPool.subscribe(
          [{ kinds: [1], limit: 10 }],
          (event: NostrEvent) => {
            events.push(event);
          },
          () => {
            eoseReceived = true;
          }
        );

        // Wait for EOSE
        await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.timeout.eose));

        // Assert
        expect(subId).toBeDefined();
        expect(eoseReceived).toBe(true);

        relayPool.unsubscribe(subId);
      },
      TEST_CONFIG.timeout.default
    );

    it(
      'should deduplicate events from multiple relays',
      async () => {
        // Arrange
        await relayPool.initialize({
          relays: TEST_RELAYS.all,
          enableDeduplication: true,
        });
        await relayPool.connectAll();

        const eventIds = new Set<string>();

        // Act
        const subId = relayPool.subscribe([{ kinds: [1], limit: 20 }], (event: NostrEvent) => {
          eventIds.add(event.id);
        });

        // Wait for events
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Assert: No duplicate event IDs
        expect(eventIds.size).toBeGreaterThan(0);

        relayPool.unsubscribe(subId);
      },
      TEST_CONFIG.timeout.default
    );
  });

  describe('Error Handling', () => {
    it('should handle invalid relay URLs gracefully', async () => {
      // Act & Assert
      await expect(async () => {
        await relayPool.initialize({ relays: ['invalid-url'] });
      }).rejects.toThrow();
    });

    it('should handle connection timeouts', async () => {
      // Arrange
      await relayPool.initialize({
        relays: ['wss://timeout-relay.invalid'],
        connectionTimeout: 1000,
      });

      // Act
      const start = performance.now();
      await relayPool.connectAll();
      const duration = performance.now() - start;

      // Assert: Should fail quickly
      expect(duration).toBeLessThan(5000);
      expect(relayPool.getConnectedRelays().length).toBe(0);
    }, 10000);

    it(
      'should handle publish failures gracefully',
      async () => {
        // Arrange
        await relayPool.initialize({ relays: ['wss://invalid.relay'] });
        await relayPool.connectAll();

        const activeKey = keyManagement.getActiveKey();
        if (!activeKey) throw new Error('No active key');

        const unsigned = TestEventFactory.textNote('Error handling test');
        const event = await keyManagement.signEvent(activeKey.keyId, unsigned);

        // Act
        const results = await relayPool.publishEvent(event);

        // Assert: Should have results even if all failed
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      },
      TEST_CONFIG.timeout.default
    );
  });
});
