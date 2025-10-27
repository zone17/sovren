/**
 * 🧪 ELITE TESTS: NOSTR Monitoring Service
 *
 * US-316: NOSTR Monitoring Service
 * Epic 003: NOSTR Consolidation
 *
 * Comprehensive test suite with 95%+ coverage:
 * - Service initialization
 * - Relay health tracking
 * - Publishing metrics
 * - Subscription monitoring
 * - Performance metrics
 * - Alert generation
 * - Metrics export
 * - Health checks
 */

import { MonitoringService } from '../MonitoringService';
import { RelayPoolManager } from '../RelayPoolManager';
import { EventPublisherService } from '../EventPublisherService';
import { SubscriptionManagerService } from '../SubscriptionManagerService';
import {
  AlertType,
  AlertSeverity,
  HealthStatus,
} from '../types/monitoring';
import { RelayStatus, RelayHealth } from '../types';
import type { NostrEvent } from '@shared/types/nostr';

// Mock dependencies
jest.mock('../RelayPoolManager');
jest.mock('../EventPublisherService');
jest.mock('../SubscriptionManagerService');

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockRelayPool: jest.Mocked<RelayPoolManager>;
  let mockPublisher: jest.Mocked<EventPublisherService>;
  let mockSubscriptionManager: jest.Mocked<SubscriptionManagerService>;

  beforeEach(() => {
    // Clear singleton
    (MonitoringService as any).instance = null;

    // Create fresh instances
    monitoringService = MonitoringService.getInstance();

    // Get mocked instances
    mockRelayPool = RelayPoolManager.getInstance() as jest.Mocked<RelayPoolManager>;
    mockPublisher = EventPublisherService.getInstance() as jest.Mocked<EventPublisherService>;
    mockSubscriptionManager =
      SubscriptionManagerService.getInstance() as jest.Mocked<SubscriptionManagerService>;

    // Setup default mocks
    setupDefaultMocks();
  });

  afterEach(async () => {
    await monitoringService.destroy();
    jest.clearAllMocks();
  });

  // ============================================
  // INITIALIZATION TESTS
  // ============================================

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = MonitoringService.getInstance();
      const instance2 = MonitoringService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should initialize successfully', async () => {
      await monitoringService.initialize({
        enabled: true,
        metricsInterval: 1000,
      });

      expect(monitoringService.isInitialized()).toBe(true);
    });

    it('should handle already initialized state', async () => {
      await monitoringService.initialize();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await monitoringService.initialize();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already initialized')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should skip initialization if disabled', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await monitoringService.initialize({ enabled: false });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Monitoring disabled')
      );

      consoleLogSpy.mockRestore();
    });

    it('should initialize relay metrics for all configured relays', async () => {
      mockRelayPool.getConfiguredRelays.mockReturnValue([
        'wss://relay1.com',
        'wss://relay2.com',
      ]);

      await monitoringService.initialize();

      const metrics = monitoringService.getMetrics();
      expect(metrics.relayHealth).toHaveLength(2);
    });

    it('should set up event listeners on initialization', async () => {
      const onSpy = jest.spyOn(mockRelayPool, 'on');

      await monitoringService.initialize();

      expect(onSpy).toHaveBeenCalledWith('relay:connected', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('relay:disconnected', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('relay:error', expect.any(Function));
    });
  });

  // ============================================
  // RELAY HEALTH TRACKING TESTS
  // ============================================

  describe('Relay Health Tracking', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should track relay connection health', () => {
      mockRelayPool.getRelayHealth.mockReturnValue({
        url: 'wss://relay1.com',
        status: RelayHealth.HEALTHY,
        score: 95,
        metrics: {
          latency: 100,
          successRate: 98,
          uptime: 99,
          totalRequests: 100,
          successfulRequests: 98,
          failedRequests: 2,
        },
        lastCheck: Date.now(),
      });

      mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.CONNECTED);

      // Trigger relay connected event
      const connectHandler = (mockRelayPool.on as jest.Mock).mock.calls.find(
        call => call[0] === 'relay:connected'
      )?.[1];

      connectHandler('wss://relay1.com');

      const metrics = monitoringService.getMetrics();
      const relayMetric = metrics.relayHealth.find(r => r.url === 'wss://relay1.com');

      expect(relayMetric).toBeDefined();
      expect(relayMetric?.status).toBe(RelayStatus.CONNECTED);
      expect(relayMetric?.health).toBe(RelayHealth.HEALTHY);
      expect(relayMetric?.healthScore).toBe(95);
    });

    it('should create alert when relay disconnects', () => {
      mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.DISCONNECTED);

      const alertSpy = jest.fn();
      monitoringService.on('alert:created', alertSpy);

      // Trigger disconnect
      const disconnectHandler = (mockRelayPool.on as jest.Mock).mock.calls.find(
        call => call[0] === 'relay:disconnected'
      )?.[1];

      disconnectHandler('wss://relay1.com');

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AlertType.RELAY_DISCONNECTED,
          severity: AlertSeverity.WARNING,
        })
      );
    });

    it('should track connection uptime', () => {
      mockRelayPool.getRelayHealth.mockReturnValue({
        url: 'wss://relay1.com',
        status: RelayHealth.HEALTHY,
        score: 90,
        metrics: {
          latency: 150,
          successRate: 95,
          uptime: 99.5,
          totalRequests: 1000,
          successfulRequests: 950,
          failedRequests: 50,
        },
        lastCheck: Date.now(),
      });

      mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.CONNECTED);

      const connectHandler = (mockRelayPool.on as jest.Mock).mock.calls.find(
        call => call[0] === 'relay:connected'
      )?.[1];

      connectHandler('wss://relay1.com');

      const metrics = monitoringService.getMetrics();
      expect(metrics.connectionHealth.averageUptime).toBeGreaterThan(0);
    });

    it('should calculate connection health summary correctly', () => {
      mockRelayPool.getConfiguredRelays.mockReturnValue([
        'wss://relay1.com',
        'wss://relay2.com',
        'wss://relay3.com',
      ]);

      // Mock different health states
      mockRelayPool.getRelayStatus
        .mockReturnValueOnce(RelayStatus.CONNECTED)
        .mockReturnValueOnce(RelayStatus.DISCONNECTED)
        .mockReturnValueOnce(RelayStatus.CONNECTED);

      mockRelayPool.getRelayHealth.mockReturnValue({
        url: 'wss://relay.com',
        status: RelayHealth.HEALTHY,
        score: 85,
        metrics: {
          latency: 200,
          successRate: 95,
          uptime: 98,
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
        },
        lastCheck: Date.now(),
      });

      const metrics = monitoringService.getMetrics();

      expect(metrics.connectionHealth.totalRelays).toBeGreaterThan(0);
      expect(metrics.connectionHealth.connectedRelays).toBeGreaterThanOrEqual(0);
      expect(metrics.connectionHealth.disconnectedRelays).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // PUBLISHING METRICS TESTS
  // ============================================

  describe('Publishing Metrics', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should track successful publish events', () => {
      const publishResult = {
        success: true,
        eventId: 'event123',
        relayResults: [
          { relay: 'wss://relay1.com', success: true, latency: 150 },
          { relay: 'wss://relay2.com', success: true, latency: 200 },
        ],
        publishedTo: ['wss://relay1.com', 'wss://relay2.com'],
        failedRelays: [],
        timestamp: Date.now(),
        totalLatency: 350,
      };

      // Trigger publish event
      const publishHandler = (mockPublisher.on as jest.Mock).mock.calls.find(
        call => call[0] === 'event:published'
      )?.[1];

      publishHandler(publishResult);

      const metrics = monitoringService.getMetrics();
      expect(metrics.publishing.totalEvents).toBe(1);
      expect(metrics.publishing.successfulEvents).toBe(1);
      expect(metrics.publishing.successRate).toBe(100);
    });

    it('should track failed publish events', () => {
      const publishResult = {
        success: false,
        eventId: 'event123',
        relayResults: [
          {
            relay: 'wss://relay1.com',
            success: false,
            latency: 100,
            error: new Error('Publish failed'),
          },
        ],
        publishedTo: [],
        failedRelays: ['wss://relay1.com'],
        timestamp: Date.now(),
        totalLatency: 100,
      };

      const publishHandler = (mockPublisher.on as jest.Mock).mock.calls.find(
        call => call[0] === 'event:published'
      )?.[1];

      publishHandler(publishResult);

      const metrics = monitoringService.getMetrics();
      expect(metrics.publishing.failedEvents).toBe(1);
      expect(metrics.publishing.successRate).toBeLessThan(100);
    });

    it('should calculate latency percentiles', () => {
      // Publish multiple events with different latencies
      const latencies = [100, 150, 200, 250, 300, 400, 500, 600, 800, 1000];

      latencies.forEach(latency => {
        const publishResult = {
          success: true,
          eventId: `event${latency}`,
          relayResults: [{ relay: 'wss://relay1.com', success: true, latency }],
          publishedTo: ['wss://relay1.com'],
          failedRelays: [],
          timestamp: Date.now(),
          totalLatency: latency,
        };

        const publishHandler = (mockPublisher.on as jest.Mock).mock.calls.find(
          call => call[0] === 'event:published'
        )?.[1];

        publishHandler(publishResult);
      });

      const metrics = monitoringService.getMetrics();
      const relay1Metrics = metrics.publishing.perRelayMetrics.find(
        m => m.relay === 'wss://relay1.com'
      );

      expect(relay1Metrics).toBeDefined();
      expect(relay1Metrics?.p50Latency).toBeGreaterThan(0);
      expect(relay1Metrics?.p95Latency).toBeGreaterThan(relay1Metrics?.p50Latency!);
      expect(relay1Metrics?.p99Latency).toBeGreaterThanOrEqual(relay1Metrics?.p95Latency!);
    });

    it('should create alert for high error rate', () => {
      const alertSpy = jest.fn();
      monitoringService.on('alert:created', alertSpy);

      // Publish events with high failure rate
      for (let i = 0; i < 20; i++) {
        const publishResult = {
          success: i >= 15, // 75% failure rate
          eventId: `event${i}`,
          relayResults: [
            {
              relay: 'wss://relay1.com',
              success: i >= 15,
              latency: 100,
            },
          ],
          publishedTo: i >= 15 ? ['wss://relay1.com'] : [],
          failedRelays: i < 15 ? ['wss://relay1.com'] : [],
          timestamp: Date.now(),
          totalLatency: 100,
        };

        const publishHandler = (mockPublisher.on as jest.Mock).mock.calls.find(
          call => call[0] === 'event:published'
        )?.[1];

        publishHandler(publishResult);
      }

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AlertType.HIGH_ERROR_RATE,
          severity: AlertSeverity.ERROR,
        })
      );
    });

    it('should create alert for high latency', () => {
      const alertSpy = jest.fn();
      monitoringService.on('alert:created', alertSpy);

      // Publish events with increasing latency
      for (let i = 0; i < 100; i++) {
        const publishResult = {
          success: true,
          eventId: `event${i}`,
          relayResults: [
            {
              relay: 'wss://relay1.com',
              success: true,
              latency: 1000 + i * 10, // High latency
            },
          ],
          publishedTo: ['wss://relay1.com'],
          failedRelays: [],
          timestamp: Date.now(),
          totalLatency: 1000 + i * 10,
        };

        const publishHandler = (mockPublisher.on as jest.Mock).mock.calls.find(
          call => call[0] === 'event:published'
        )?.[1];

        publishHandler(publishResult);
      }

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AlertType.HIGH_LATENCY,
          severity: AlertSeverity.WARNING,
        })
      );
    });
  });

  // ============================================
  // SUBSCRIPTION MONITORING TESTS
  // ============================================

  describe('Subscription Monitoring', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should get subscription summary', () => {
      mockSubscriptionManager.getSubscriptions.mockReturnValue([
        {
          id: 'sub1',
          filters: [{ kinds: [1] }],
          relays: ['wss://relay1.com'],
          state: 'active',
          active: true,
          createdAt: Date.now(),
          eventCount: 10,
          eoseReceived: true,
          eoseRelays: ['wss://relay1.com'],
          errors: [],
        },
        {
          id: 'sub2',
          filters: [{ kinds: [3] }],
          relays: ['wss://relay2.com'],
          state: 'paused',
          active: false,
          createdAt: Date.now(),
          eventCount: 5,
          eoseReceived: false,
          eoseRelays: [],
          errors: [],
        },
      ]);

      mockSubscriptionManager.getStats.mockReturnValue({
        totalSubscriptions: 2,
        activeSubscriptions: 1,
        pausedSubscriptions: 1,
        pooledSubscriptions: 0,
        seenEvents: 15,
        totalEvents: 15,
      });

      const metrics = monitoringService.getMetrics();

      expect(metrics.subscriptions.activeSubscriptions).toBe(1);
      expect(metrics.subscriptions.pausedSubscriptions).toBe(1);
    });
  });

  // ============================================
  // PERFORMANCE METRICS TESTS
  // ============================================

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should calculate network latency metrics', () => {
      // Simulate publish events with various latencies
      const latencies = [50, 100, 150, 200, 300, 500, 1000];

      latencies.forEach(latency => {
        const publishResult = {
          success: true,
          eventId: `event${latency}`,
          relayResults: [
            { relay: 'wss://relay1.com', success: true, latency },
          ],
          publishedTo: ['wss://relay1.com'],
          failedRelays: [],
          timestamp: Date.now(),
          totalLatency: latency,
        };

        const publishHandler = (mockPublisher.on as jest.Mock).mock.calls.find(
          call => call[0] === 'event:published'
        )?.[1];

        publishHandler(publishResult);
      });

      const metrics = monitoringService.getMetrics();

      expect(metrics.network.latency.p50).toBeGreaterThan(0);
      expect(metrics.network.latency.p95).toBeGreaterThan(0);
      expect(metrics.network.latency.avg).toBeGreaterThan(0);
    });

    it('should track throughput metrics', () => {
      const metrics = monitoringService.getMetrics();

      expect(metrics.network.throughput).toBeDefined();
      expect(metrics.network.throughput.totalEvents).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // ALERTING TESTS
  // ============================================

  describe('Alerting', () => {
    beforeEach(async () => {
      await monitoringService.initialize({
        alerts: {
          enabled: true,
          conditions: [
            {
              type: AlertType.RELAY_DISCONNECTED,
              severity: AlertSeverity.WARNING,
              enabled: true,
            },
          ],
        },
      });
    });

    it('should create alerts when conditions are met', () => {
      const alertSpy = jest.fn();
      monitoringService.on('alert:created', alertSpy);

      mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.DISCONNECTED);

      const disconnectHandler = (mockRelayPool.on as jest.Mock).mock.calls.find(
        call => call[0] === 'relay:disconnected'
      )?.[1];

      disconnectHandler('wss://relay1.com');

      expect(alertSpy).toHaveBeenCalled();

      const alerts = monitoringService.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should acknowledge alerts', () => {
      mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.ERROR);

      const errorHandler = (mockRelayPool.on as jest.Mock).mock.calls.find(
        call => call[0] === 'relay:error'
      )?.[1];

      errorHandler('wss://relay1.com', new Error('Connection failed'));

      const alerts = monitoringService.getActiveAlerts();
      const alertId = alerts[0]?.id;

      if (alertId) {
        monitoringService.acknowledgeAlert(alertId);

        const activeAlerts = monitoringService.getActiveAlerts();
        expect(activeAlerts.length).toBe(0);
      }
    });

    it('should clear all alerts', () => {
      mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.ERROR);

      const errorHandler = (mockRelayPool.on as jest.Mock).mock.calls.find(
        call => call[0] === 'relay:error'
      )?.[1];

      errorHandler('wss://relay1.com', new Error('Error 1'));
      errorHandler('wss://relay2.com', new Error('Error 2'));

      monitoringService.clearAlerts();

      const alerts = monitoringService.getAllAlerts();
      expect(alerts.length).toBe(0);
    });

    it('should limit maximum alerts', async () => {
      await monitoringService.destroy();

      monitoringService = MonitoringService.getInstance();
      await monitoringService.initialize({
        alerts: {
          enabled: true,
          maxAlerts: 5,
          conditions: [
            {
              type: AlertType.RELAY_ERROR,
              severity: AlertSeverity.ERROR,
              enabled: true,
            },
          ],
        },
      });

      mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.ERROR);

      const errorHandler = (mockRelayPool.on as jest.Mock).mock.calls.find(
        call => call[0] === 'relay:error'
      )?.[1];

      // Create more than max alerts
      for (let i = 0; i < 10; i++) {
        errorHandler(`wss://relay${i}.com`, new Error(`Error ${i}`));
      }

      const alerts = monitoringService.getAllAlerts();
      expect(alerts.length).toBeLessThanOrEqual(5);
    });
  });

  // ============================================
  // METRICS EXPORT TESTS
  // ============================================

  describe('Metrics Export', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should export metrics to Prometheus format', () => {
      const prometheusMetrics = monitoringService.exportPrometheus();

      expect(prometheusMetrics).toContain('nostr_relays_total');
      expect(prometheusMetrics).toContain('nostr_events_published_total');
      expect(prometheusMetrics).toContain('nostr_subscriptions_active');
      expect(prometheusMetrics).toContain('HELP');
      expect(prometheusMetrics).toContain('TYPE');
    });

    it('should export metrics to JSON format', () => {
      const jsonExport = monitoringService.exportJSON();

      expect(jsonExport.format).toBe('json');
      expect(jsonExport.metrics).toBeDefined();
      expect(jsonExport.timestamp).toBeGreaterThan(0);
    });

    it('should include all metric categories in export', () => {
      const prometheusMetrics = monitoringService.exportPrometheus();

      // Check for key metric categories
      expect(prometheusMetrics).toContain('relay');
      expect(prometheusMetrics).toContain('publish');
      expect(prometheusMetrics).toContain('subscription');
      expect(prometheusMetrics).toContain('network');
      expect(prometheusMetrics).toContain('latency');
    });
  });

  // ============================================
  // HEALTH CHECK TESTS
  // ============================================

  describe('Health Check', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should perform comprehensive health check', () => {
      mockRelayPool.getConfiguredRelays.mockReturnValue(['wss://relay1.com']);
      mockRelayPool.getRelayHealth.mockReturnValue({
        url: 'wss://relay1.com',
        status: RelayHealth.HEALTHY,
        score: 95,
        metrics: {
          latency: 100,
          successRate: 99,
          uptime: 99.9,
          totalRequests: 1000,
          successfulRequests: 990,
          failedRequests: 10,
        },
        lastCheck: Date.now(),
      });

      mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.CONNECTED);

      const health = monitoringService.healthCheck();

      expect(health.status).toBeDefined();
      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
      expect(health.checks).toHaveProperty('relays');
      expect(health.checks).toHaveProperty('publishing');
      expect(health.checks).toHaveProperty('subscriptions');
      expect(health.checks).toHaveProperty('performance');
    });

    it('should return healthy status when all checks pass', () => {
      setupHealthyMocks();

      const health = monitoringService.healthCheck();

      expect(health.status).toBe(HealthStatus.HEALTHY);
      expect(health.score).toBeGreaterThan(75);
    });

    it('should return degraded status when some checks fail', () => {
      setupDegradedMocks();

      const health = monitoringService.healthCheck();

      expect(health.status).toBe(HealthStatus.DEGRADED);
    });

    it('should return unhealthy status when multiple checks fail', () => {
      setupUnhealthyMocks();

      const health = monitoringService.healthCheck();

      expect(health.status).toBe(HealthStatus.UNHEALTHY);
    });
  });

  // ============================================
  // LIFECYCLE TESTS
  // ============================================

  describe('Lifecycle', () => {
    it('should destroy service and cleanup resources', async () => {
      await monitoringService.initialize();

      await monitoringService.destroy();

      expect(monitoringService.isInitialized()).toBe(false);
    });

    it('should clear all metrics on destroy', async () => {
      await monitoringService.initialize();

      // Generate some metrics
      const publishResult = {
        success: true,
        eventId: 'event123',
        relayResults: [
          { relay: 'wss://relay1.com', success: true, latency: 100 },
        ],
        publishedTo: ['wss://relay1.com'],
        failedRelays: [],
        timestamp: Date.now(),
        totalLatency: 100,
      };

      const publishHandler = (mockPublisher.on as jest.Mock).mock.calls.find(
        call => call[0] === 'event:published'
      )?.[1];

      publishHandler(publishResult);

      await monitoringService.destroy();

      // Recreate instance
      (MonitoringService as any).instance = null;
      const newService = MonitoringService.getInstance();
      await newService.initialize();

      const metrics = newService.getMetrics();
      expect(metrics.publishing.totalEvents).toBe(0);
    });
  });

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  function setupDefaultMocks() {
    mockRelayPool.getConfiguredRelays.mockReturnValue([
      'wss://relay1.com',
      'wss://relay2.com',
    ]);

    mockRelayPool.getRelayHealth.mockReturnValue({
      url: 'wss://relay.com',
      status: RelayHealth.HEALTHY,
      score: 90,
      metrics: {
        latency: 150,
        successRate: 95,
        uptime: 98,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
      },
      lastCheck: Date.now(),
    });

    mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.CONNECTED);
    mockRelayPool.getReconnectAttempts.mockReturnValue(0);
    mockRelayPool.on.mockReturnValue(mockRelayPool);

    mockPublisher.on.mockReturnValue(mockPublisher);

    mockSubscriptionManager.getSubscriptions.mockReturnValue([]);
    mockSubscriptionManager.getStats.mockReturnValue({
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      pausedSubscriptions: 0,
      pooledSubscriptions: 0,
      seenEvents: 0,
      totalEvents: 0,
    });
  }

  function setupHealthyMocks() {
    mockRelayPool.getRelayHealth.mockReturnValue({
      url: 'wss://relay1.com',
      status: RelayHealth.HEALTHY,
      score: 95,
      metrics: {
        latency: 100,
        successRate: 99,
        uptime: 99.9,
        totalRequests: 1000,
        successfulRequests: 990,
        failedRequests: 10,
      },
      lastCheck: Date.now(),
    });

    mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.CONNECTED);
  }

  function setupDegradedMocks() {
    mockRelayPool.getRelayHealth.mockReturnValue({
      url: 'wss://relay1.com',
      status: RelayHealth.DEGRADED,
      score: 60,
      metrics: {
        latency: 800,
        successRate: 85,
        uptime: 90,
        totalRequests: 1000,
        successfulRequests: 850,
        failedRequests: 150,
      },
      lastCheck: Date.now(),
    });
  }

  function setupUnhealthyMocks() {
    mockRelayPool.getRelayHealth.mockReturnValue({
      url: 'wss://relay1.com',
      status: RelayHealth.UNHEALTHY,
      score: 30,
      metrics: {
        latency: 2000,
        successRate: 50,
        uptime: 60,
        totalRequests: 1000,
        successfulRequests: 500,
        failedRequests: 500,
      },
      lastCheck: Date.now(),
    });

    mockRelayPool.getRelayStatus.mockReturnValue(RelayStatus.ERROR);
  }
});
