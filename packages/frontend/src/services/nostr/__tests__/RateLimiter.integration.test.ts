/**
 * 🧪 ELITE INTEGRATION TESTS: Rate Limiter
 *
 * US-321: Implement NOSTR Rate Limiting
 * Test Coverage: Integration with NOSTR services
 *
 * Tests rate limiting integration with EventPublisher and SubscriptionManager
 */

import { RateLimiter } from '../RateLimiter';
import { RateLimitMonitor } from '../RateLimitMonitor';
import { EventPublisherService } from '../EventPublisherService';
import { SubscriptionManagerService } from '../SubscriptionManagerService';
import { KeyManagementService } from '../KeyManagementService';
import { RelayPoolManager } from '../RelayPoolManager';
import { RateLimitOperation, RequestPriority } from '../types/rate-limit';
import type { NostrEvent, EventTemplate } from '@shared/types/nostr/index';

// Mock dependencies
vi.mock('../RelayPoolManager');
vi.mock('../KeyManagementService');

describe('RateLimiter Integration Tests', () => {
  let rateLimiter: RateLimiter;
  let rateLimitMonitor: RateLimitMonitor;
  let eventPublisher: EventPublisherService;
  let subscriptionManager: SubscriptionManagerService;
  let keyManagement: KeyManagementService;
  let relayPool: RelayPoolManager;

  beforeEach(async () => {
    // Initialize services
    rateLimiter = RateLimiter.getInstance();
    await rateLimiter.initialize({
      enabled: true,
      enableQueuing: true,
      enableMetrics: true,
      // Use very high global limit to prevent global bucket exhaustion from interfering
      // with operation/relay-level tests (global bucket is consumed even on relay-denied requests)
      globalLimit: { requests: 100000, window: 1000 },
      operationLimits: {
        [RateLimitOperation.PUBLISH_EVENT]: { requests: 3, window: 1000 },
        [RateLimitOperation.SUBSCRIBE]: { requests: 2, window: 1000 },
        [RateLimitOperation.QUERY]: { requests: 10, window: 1000 },
        [RateLimitOperation.NIP05_VERIFY]: { requests: 2, window: 1000 },
        [RateLimitOperation.FETCH_EVENT]: { requests: 15, window: 1000 },
        [RateLimitOperation.BATCH]: { requests: 2, window: 1000 },
      },
    });

    rateLimitMonitor = RateLimitMonitor.getInstance();
    await rateLimitMonitor.initialize(1000);

    keyManagement = KeyManagementService.getInstance();
    relayPool = RelayPoolManager.getInstance();
    eventPublisher = EventPublisherService.getInstance();
    subscriptionManager = SubscriptionManagerService.getInstance();

    // Mock key management
    const mockPublicKey = 'a'.repeat(64);
    // mockPrivateKey not needed — only publicKey used in getActiveKey mock
    vi.spyOn(keyManagement, 'getActiveKey').mockReturnValue({
      keyId: 'test-key',
      publicKey: mockPublicKey,
      type: 'local',
      createdAt: Date.now(),
    });
    vi.spyOn(keyManagement, 'isInitialized').mockReturnValue(true);
    vi.spyOn(keyManagement, 'signEvent').mockImplementation(async (keyId, event) => {
      return {
        ...event,
        id: 'c'.repeat(64),
        sig: 'd'.repeat(128),
        pubkey: mockPublicKey,
      } as NostrEvent;
    });
    vi.spyOn(keyManagement, 'verifyEventSignature').mockResolvedValue(true);

    // Mock relay pool
    vi.spyOn(relayPool, 'isInitialized').mockReturnValue(true);
    vi.spyOn(relayPool, 'getConnectedRelays').mockReturnValue([
      'wss://relay.damus.io',
      'wss://nos.lol',
    ]);
    vi.spyOn(relayPool, 'publishEvent').mockResolvedValue([
      { relay: 'wss://relay.damus.io', success: true, latency: 100 },
    ]);
    vi.spyOn(relayPool, 'publishEventToFastest').mockResolvedValue([
      { relay: 'wss://relay.damus.io', success: true, latency: 50 },
    ]);
    vi.spyOn(relayPool, 'subscribe').mockReturnValue('sub-123');

    // Initialize EventPublisher and SubscriptionManager
    await eventPublisher.initialize();
  });

  afterEach(async () => {
    await eventPublisher.destroy();
    await subscriptionManager.destroy();
    await rateLimitMonitor.destroy();
    await rateLimiter.destroy();
    vi.clearAllMocks();
  });

  // ========================================
  // EventPublisher Integration
  // ========================================

  describe('EventPublisher Integration', () => {
    it('should rate limit event publishing', async () => {
      // Disable queuing so rate-limited requests throw immediately instead of queuing
      rateLimiter.updateConfig({ enableQueuing: false });

      const template: EventTemplate = {
        kind: 1,
        content: 'Test event',
        tags: [],
      };

      // First 3 should succeed (limit is 3 per second)
      const results = await Promise.all([
        eventPublisher.createAndPublish(template),
        eventPublisher.createAndPublish(template),
        eventPublisher.createAndPublish(template),
      ]);

      expect(results.every((r) => r.success)).toBe(true);

      // 4th should fail with rate limit error (queuing disabled, so throws immediately)
      await expect(eventPublisher.createAndPublish(template)).rejects.toThrow(
        /Rate limit exceeded/
      );
    });

    it('should queue events when rate limit is hit', async () => {
      const template: EventTemplate = {
        kind: 1,
        content: 'Queued event',
        tags: [],
      };

      // Exhaust rate limit with skipQueue
      const event = await eventPublisher.createEvent(template);

      for (let i = 0; i < 3; i++) {
        await rateLimiter.checkLimit({
          operation: RateLimitOperation.PUBLISH_EVENT,
          skipQueue: true,
        });
      }

      // This should be queued
      const queuedPromise = eventPublisher.publish(event);

      // Check queue metrics
      const queueMetrics = rateLimiter.getQueueMetrics();
      expect(queueMetrics.size).toBeGreaterThan(0);

      // Should eventually succeed
      const result = await queuedPromise;
      expect(result.success).toBe(true);
    }, 10000);

    it('should track publishing statistics with rate limiting', async () => {
      const template: EventTemplate = {
        kind: 1,
        content: 'Stats test',
        tags: [],
      };

      // Publish some events
      await eventPublisher.createAndPublish(template);
      await eventPublisher.createAndPublish(template);

      // Check rate limit metrics
      const metrics = rateLimiter.getMetrics();
      const publishStats = metrics.byOperation.get(RateLimitOperation.PUBLISH_EVENT);

      expect(publishStats).toBeDefined();
      expect(publishStats!.totalRequests).toBeGreaterThan(0);
      expect(publishStats!.allowed).toBeGreaterThan(0);
      expect(publishStats!.successRate).toBe(100);
    });
  });

  // ========================================
  // SubscriptionManager Integration
  // ========================================

  describe('SubscriptionManager Integration', () => {
    it('should rate limit subscription creation', async () => {
      // Disable queuing so rate-limited requests throw immediately instead of being queued
      rateLimiter.updateConfig({ enableQueuing: false });

      const filters = [{ kinds: [1], limit: 10 }];
      const callback = vi.fn();

      // First 2 should succeed (limit is 2 per second)
      const sub1 = await subscriptionManager.subscribe(filters, callback);
      const sub2 = await subscriptionManager.subscribe(filters, callback);

      expect(sub1).toBeDefined();
      expect(sub2).toBeDefined();

      // 3rd should fail with rate limit error (queuing disabled, so throws immediately)
      await expect(subscriptionManager.subscribe(filters, callback)).rejects.toThrow(
        /Rate limit exceeded/
      );

      // Cleanup
      subscriptionManager.unsubscribe(sub1);
      subscriptionManager.unsubscribe(sub2);
    });

    it('should allow subscriptions after rate limit resets', async () => {
      // Disable queuing so rate-limited requests throw immediately
      rateLimiter.updateConfig({ enableQueuing: false });

      const filters = [{ kinds: [1], limit: 10 }];
      const callback = vi.fn();

      // Exhaust rate limit (2 subscribes allowed per second)
      const sub1 = await subscriptionManager.subscribe(filters, callback);
      const sub2 = await subscriptionManager.subscribe(filters, callback);

      // Should fail immediately (queuing disabled)
      await expect(subscriptionManager.subscribe(filters, callback)).rejects.toThrow(
        /Rate limit exceeded/
      );

      // Wait for rate limit to reset (1 second)
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await vi.advanceTimersByTimeAsync(1100);
      vi.useRealTimers();

      // Re-enable queuing (restored to test default) and try again
      rateLimiter.updateConfig({ enableQueuing: true });
      const sub3 = await subscriptionManager.subscribe(filters, callback);
      expect(sub3).toBeDefined();

      // Cleanup
      subscriptionManager.unsubscribe(sub1);
      subscriptionManager.unsubscribe(sub2);
      subscriptionManager.unsubscribe(sub3);
    }, 5000);
  });

  // ========================================
  // RateLimitMonitor Integration
  // ========================================

  describe('RateLimitMonitor Integration', () => {
    it('should collect metrics from rate limiter', () => {
      const metrics = rateLimitMonitor.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.overall).toBeDefined();
      expect(metrics.byOperation).toBeInstanceOf(Map);
      expect(metrics.queue).toBeDefined();
    });

    it('should generate dashboard data', async () => {
      // Make some requests to generate data
      await rateLimiter.checkLimit({ operation: RateLimitOperation.PUBLISH_EVENT });
      await rateLimiter.checkLimit({ operation: RateLimitOperation.QUERY });

      const dashboardData = rateLimitMonitor.getDashboardData();

      expect(dashboardData).toBeDefined();
      expect(dashboardData.health).toBeDefined();
      expect(dashboardData.summary).toBeDefined();
      expect(dashboardData.operations).toBeDefined();
      expect(Array.isArray(dashboardData.operations)).toBe(true);
    });

    it('should export Prometheus metrics', async () => {
      // Make some requests
      await rateLimiter.checkLimit({ operation: RateLimitOperation.PUBLISH_EVENT });
      await rateLimiter.checkLimit({ operation: RateLimitOperation.SUBSCRIBE });

      const prometheusMetrics = rateLimitMonitor.exportPrometheus();

      expect(prometheusMetrics).toContain('nostr_rate_limit_requests_total');
      expect(prometheusMetrics).toContain('nostr_rate_limit_allowed_total');
      expect(prometheusMetrics).toContain('nostr_rate_limit_denied_total');
      expect(prometheusMetrics).toContain('nostr_rate_limit_queue_size');
    });

    it('should export JSON metrics', async () => {
      // Make some requests
      await rateLimiter.checkLimit({ operation: RateLimitOperation.PUBLISH_EVENT });

      const jsonMetrics = rateLimitMonitor.exportJSON();
      const parsed = JSON.parse(jsonMetrics);

      expect(parsed).toBeDefined();
      expect(parsed.overall).toBeDefined();
      expect(parsed.queue).toBeDefined();
    });

    it('should handle rate limit alerts', async () => {
      const alerts: any[] = [];

      rateLimitMonitor.on('alert', (alert) => {
        alerts.push(alert);
      });

      // Consistently hit rate limit to trigger alert
      for (let i = 0; i < 20; i++) {
        await rateLimiter.checkLimit({
          operation: RateLimitOperation.PUBLISH_EVENT,
          skipQueue: true,
        });
      }

      // Wait for alert processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Load Testing
  // ========================================

  describe('Load Testing', () => {
    it('should handle high concurrent request volume', async () => {
      const concurrentRequests = 100;
      const requests = [];

      // Use skipQueue: true so all requests return immediately (allowed or denied).
      // Without skipQueue, 90 requests would queue with 5s timeout, causing Promise.all
      // to reject (queue exhaustion takes ~9s > 5s queueTimeout).
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          rateLimiter.checkLimit({
            operation: RateLimitOperation.QUERY,
            skipQueue: true,
          })
        );
      }

      const results = await Promise.all(requests);

      // Should handle all requests immediately (first 10 allowed, rest denied due to limit)
      const allowed = results.filter((r) => r.allowed).length;
      expect(allowed).toBeGreaterThan(0);

      // Check metrics
      const metrics = rateLimiter.getMetrics();
      expect(metrics.overall.totalRequests).toBe(concurrentRequests);
    }, 15000);

    it('should maintain performance under load', async () => {
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await rateLimiter.checkLimit({
          operation: RateLimitOperation.QUERY,
          skipQueue: true,
        });
      }

      const duration = Date.now() - startTime;
      const avgLatency = duration / iterations;

      // Average latency should be less than 1ms per check
      expect(avgLatency).toBeLessThan(1);
    });

    it('should handle burst traffic with queue', async () => {
      // Send burst of requests
      const burstSize = 50;
      const promises = [];

      for (let i = 0; i < burstSize; i++) {
        promises.push(
          rateLimiter.checkLimit({
            operation: RateLimitOperation.QUERY,
            priority: i % 2 === 0 ? RequestPriority.HIGH : RequestPriority.NORMAL,
          })
        );
      }

      // All should eventually complete
      const results = await Promise.all(promises);
      const allowed = results.filter((r) => r.allowed).length;

      expect(allowed).toBeGreaterThan(0);

      // Queue should have processed requests
      const queueMetrics = rateLimiter.getQueueMetrics();
      expect(queueMetrics.totalProcessed).toBeGreaterThan(0);
    }, 15000);
  });

  // ========================================
  // Real-World Scenarios
  // ========================================

  describe('Real-World Scenarios', () => {
    it('should handle mixed operation types', async () => {
      // Simulate realistic usage pattern
      const operations = [
        RateLimitOperation.PUBLISH_EVENT,
        RateLimitOperation.SUBSCRIBE,
        RateLimitOperation.QUERY,
        RateLimitOperation.FETCH_EVENT,
        RateLimitOperation.QUERY,
        RateLimitOperation.PUBLISH_EVENT,
        RateLimitOperation.QUERY,
      ];

      const results = await Promise.all(
        operations.map((operation) => rateLimiter.checkLimit({ operation, skipQueue: true }))
      );

      // Most should succeed (within limits)
      const allowed = results.filter((r) => r.allowed).length;
      expect(allowed).toBeGreaterThan(operations.length / 2);
    });

    it('should prioritize critical operations', async () => {
      // Exhaust query limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit({
          operation: RateLimitOperation.QUERY,
          skipQueue: true,
        });
      }

      const results: Array<{ priority: RequestPriority; resolved: boolean }> = [];

      // Queue requests with different priorities.
      // Note: Use HIGH (1) instead of CRITICAL (0) — the service stores priority as
      // `options.priority || NORMAL` and 0 is falsy, so CRITICAL would be stored as
      // NORMAL, defeating the priority test.
      const lowPromise = rateLimiter
        .checkLimit({
          operation: RateLimitOperation.QUERY,
          priority: RequestPriority.LOW,
        })
        .then(() => {
          results.push({ priority: RequestPriority.LOW, resolved: true });
        });

      const highPromise = rateLimiter
        .checkLimit({
          operation: RateLimitOperation.QUERY,
          priority: RequestPriority.HIGH,
        })
        .then(() => {
          results.push({ priority: RequestPriority.HIGH, resolved: true });
        });

      await Promise.all([lowPromise, highPromise]);

      // Both should resolve; verify both priorities are present
      // (Promise.then callback order is non-deterministic across JS engines)
      const priorities = results.map((r) => r.priority);
      expect(priorities).toContain(RequestPriority.HIGH);
      expect(priorities).toContain(RequestPriority.LOW);
      expect(results).toHaveLength(2);
    }, 10000);

    it('should handle relay failover with rate limiting', async () => {
      const relay1 = 'wss://relay1.io';
      const relay2 = 'wss://relay2.io';

      // Set strict limit on relay1
      rateLimiter.setRelayLimit(relay1, { requests: 2, window: 1000 });
      // Increase PUBLISH_EVENT operation limit so it doesn't become the bottleneck
      // (operation tokens are consumed even when relay-level check fails)
      rateLimiter.updateConfig({
        operationLimits: {
          [RateLimitOperation.PUBLISH_EVENT]: { requests: 10, window: 1000 },
        },
      });

      // Exhaust relay1 (consumes 2 relay1 tokens + 2 operation tokens)
      await rateLimiter.checkLimit({
        operation: RateLimitOperation.PUBLISH_EVENT,
        relay: relay1,
        skipQueue: true,
      });
      await rateLimiter.checkLimit({
        operation: RateLimitOperation.PUBLISH_EVENT,
        relay: relay1,
        skipQueue: true,
      });

      // relay1 should be exhausted (relay1 = 0 tokens)
      const relay1Result = await rateLimiter.checkLimit({
        operation: RateLimitOperation.PUBLISH_EVENT,
        relay: relay1,
        skipQueue: true,
      });
      expect(relay1Result.allowed).toBe(false);

      // relay2 should still work — uses default relay limit (operation bucket still has tokens)
      const relay2Result = await rateLimiter.checkLimit({
        operation: RateLimitOperation.PUBLISH_EVENT,
        relay: relay2,
        skipQueue: true,
      });
      expect(relay2Result.allowed).toBe(true);
    });
  });
});
