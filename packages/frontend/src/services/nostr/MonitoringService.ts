/**
 * 📊 ELITE SERVICE: NOSTR Monitoring Service
 *
 * US-316: NOSTR Monitoring Service
 * Epic 003: NOSTR Consolidation (Final Story)
 *
 * Comprehensive monitoring for NOSTR operations with:
 * - Real-time connection health tracking
 * - Event publishing success/failure metrics
 * - Subscription performance monitoring
 * - Latency and throughput tracking
 * - Memory usage monitoring
 * - Intelligent alerting system
 * - Metrics export (Prometheus, JSON)
 * - Health check HTTP endpoint support
 *
 * @example
 * ```typescript
 * const monitor = MonitoringService.getInstance();
 * await monitor.initialize({
 *   enabled: true,
 *   metricsInterval: 5000,
 *   alerts: {
 *     enabled: true,
 *     onAlert: (alert) => console.log('Alert:', alert),
 *   },
 * });
 *
 * // Get current metrics
 * const metrics = monitor.getMetrics();
 *
 * // Export to Prometheus
 * const prometheusMetrics = monitor.exportPrometheus();
 *
 * // Health check
 * const health = monitor.healthCheck();
 * ```
 */

import { EventEmitter } from 'events';
import type { NostrEvent } from '@shared/types/nostr';
import { RelayPoolManager } from './RelayPoolManager';
import { EventPublisherService, type PublishResultComplete } from './EventPublisherService';
import { SubscriptionManagerService } from './SubscriptionManagerService';
import type {
  MonitoringConfig,
  MonitoringMetrics,
  RelayHealthMetrics,
  ConnectionHealthSummary,
  PublishMetrics,
  PublishSummary,
  SubscriptionMetrics,
  SubscriptionSummary,
  NetworkMetrics,
  MemoryMetrics,
  LatencyPercentiles,
  ThroughputMetrics,
  Alert,
  AlertType,
  AlertSeverity,
  AlertCondition,
  PrometheusMetric,
  MetricsExport,
  HealthCheckResult,
  HealthStatus,
  MonitoringEvents,
} from './types/monitoring';
import { RelayStatus, RelayHealth } from './types';

/**
 * Default monitoring configuration
 */
const DEFAULT_CONFIG: Required<MonitoringConfig> = {
  enabled: true,
  metricsInterval: 5000, // 5 seconds
  retentionWindow: 3600000, // 1 hour
  enablePerformanceTracking: true,
  enableMemoryTracking: true,
  maxLatencySamples: 1000,
  alerts: {
    enabled: true,
    maxAlerts: 100,
    conditions: [
      {
        type: AlertType.RELAY_DISCONNECTED,
        severity: AlertSeverity.WARNING,
        enabled: true,
      },
      {
        type: AlertType.HIGH_ERROR_RATE,
        severity: AlertSeverity.ERROR,
        enabled: true,
        threshold: 10, // 10% error rate
      },
      {
        type: AlertType.HIGH_LATENCY,
        severity: AlertSeverity.WARNING,
        enabled: true,
        threshold: 1000, // 1000ms p95
      },
      {
        type: AlertType.PERFORMANCE_DEGRADED,
        severity: AlertSeverity.WARNING,
        enabled: true,
      },
    ],
  },
};

/**
 * Monitoring Service (Singleton)
 */
export class MonitoringService extends EventEmitter {
  private static instance: MonitoringService | null = null;

  private relayPool: RelayPoolManager;
  private publisher: EventPublisherService;
  private subscriptionManager: SubscriptionManagerService;

  private config: Required<MonitoringConfig>;
  private initialized = false;
  private metricsTimer?: NodeJS.Timeout;

  // Metrics storage
  private relayMetrics: Map<string, RelayHealthMetrics> = new Map();
  private publishMetrics: Map<string, PublishMetrics> = new Map();
  private subscriptionMetrics: Map<string, SubscriptionMetrics> = new Map();
  private latencySamples: number[] = [];
  private throughputSamples: Array<{ timestamp: number; count: number }> = [];
  private alerts: Alert[] = [];

  // Performance tracking
  private eventCount = 0;
  private requestCount = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private lastMetricsUpdate = Date.now();

  /**
   * Private constructor (Singleton pattern)
   */
  private constructor() {
    super();
    this.relayPool = RelayPoolManager.getInstance();
    this.publisher = EventPublisherService.getInstance();
    this.subscriptionManager = SubscriptionManagerService.getInstance();
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Initialize monitoring service
   */
  async initialize(config?: Partial<MonitoringConfig>): Promise<void> {
    if (this.initialized) {
      console.warn('[MonitoringService] Already initialized');
      return;
    }

    // Merge configuration
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      alerts: {
        ...DEFAULT_CONFIG.alerts,
        ...config?.alerts,
        conditions: config?.alerts?.conditions || DEFAULT_CONFIG.alerts.conditions,
      },
    };

    if (!this.config.enabled) {
      console.log('[MonitoringService] Monitoring disabled');
      return;
    }

    // Initialize relay metrics for all configured relays
    const relays = this.relayPool.getConfiguredRelays();
    relays.forEach(url => {
      this.initializeRelayMetrics(url);
    });

    // Set up event listeners
    this.setupEventListeners();

    // Start metrics collection
    if (this.config.metricsInterval > 0) {
      this.startMetricsCollection();
    }

    this.initialized = true;
    console.log('[MonitoringService] Initialized successfully');
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================
  // RELAY CONNECTION HEALTH MONITORING
  // ============================================

  /**
   * Initialize relay metrics
   */
  private initializeRelayMetrics(url: string): void {
    if (!this.relayMetrics.has(url)) {
      this.relayMetrics.set(url, {
        url,
        status: RelayStatus.DISCONNECTED,
        health: RelayHealth.UNHEALTHY,
        healthScore: 0,
        uptime: 0,
        latency: 0,
        connectionAttempts: 0,
        successfulConnections: 0,
        failedConnections: 0,
      });
    }
  }

  /**
   * Update relay health metrics
   */
  private updateRelayHealth(url: string): void {
    const healthInfo = this.relayPool.getRelayHealth(url);
    const status = this.relayPool.getRelayStatus(url);
    const reconnectAttempts = this.relayPool.getReconnectAttempts(url);

    const existing = this.relayMetrics.get(url) || this.createDefaultRelayMetrics(url);

    this.relayMetrics.set(url, {
      ...existing,
      status,
      health: healthInfo.status,
      healthScore: healthInfo.score,
      uptime: healthInfo.metrics.uptime,
      latency: healthInfo.metrics.latency,
      connectionAttempts: existing.connectionAttempts + (reconnectAttempts > 0 ? 1 : 0),
      lastConnectedAt:
        status === RelayStatus.CONNECTED ? Date.now() : existing.lastConnectedAt,
      lastDisconnectedAt:
        status === RelayStatus.DISCONNECTED ? Date.now() : existing.lastDisconnectedAt,
      lastError: healthInfo.metrics.lastErrorMessage,
      lastErrorAt: healthInfo.metrics.lastError,
    });

    // Check for alerts
    if (status === RelayStatus.DISCONNECTED || status === RelayStatus.ERROR) {
      this.createAlert({
        type: AlertType.RELAY_DISCONNECTED,
        severity: AlertSeverity.WARNING,
        title: 'Relay Disconnected',
        message: `Relay ${url} is disconnected`,
        relay: url,
      });
    }
  }

  /**
   * Get connection health summary
   */
  private getConnectionHealthSummary(): ConnectionHealthSummary {
    const metrics = Array.from(this.relayMetrics.values());

    const connectedRelays = metrics.filter(m => m.status === RelayStatus.CONNECTED).length;
    const disconnectedRelays = metrics.filter(
      m => m.status === RelayStatus.DISCONNECTED
    ).length;
    const errorRelays = metrics.filter(m => m.status === RelayStatus.ERROR).length;

    const averageHealthScore =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.healthScore, 0) / metrics.length
        : 0;

    const averageUptime =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.uptime, 0) / metrics.length
        : 0;

    const averageLatency =
      connectedRelays > 0
        ? metrics
            .filter(m => m.status === RelayStatus.CONNECTED)
            .reduce((sum, m) => sum + m.latency, 0) / connectedRelays
        : 0;

    return {
      totalRelays: metrics.length,
      connectedRelays,
      disconnectedRelays,
      errorRelays,
      averageHealthScore,
      averageUptime,
      averageLatency,
      relaysByHealth: {
        healthy: metrics.filter(m => m.health === RelayHealth.HEALTHY).length,
        degraded: metrics.filter(m => m.health === RelayHealth.DEGRADED).length,
        unhealthy: metrics.filter(m => m.health === RelayHealth.UNHEALTHY).length,
      },
    };
  }

  // ============================================
  // EVENT PUBLISHING TRACKING
  // ============================================

  /**
   * Track publish event
   */
  private trackPublishEvent(result: PublishResultComplete): void {
    const { relayResults } = result;

    relayResults.forEach(relayResult => {
      const { relay, success, latency } = relayResult;

      let metrics = this.publishMetrics.get(relay);
      if (!metrics) {
        metrics = this.createDefaultPublishMetrics(relay);
        this.publishMetrics.set(relay, metrics);
      }

      // Update counters
      metrics.totalPublishes++;
      if (success) {
        metrics.successfulPublishes++;
        metrics.lastPublishSuccess = true;
      } else {
        metrics.failedPublishes++;
        metrics.lastPublishSuccess = false;
      }
      metrics.lastPublishAt = Date.now();

      // Update success rate
      metrics.successRate = (metrics.successfulPublishes / metrics.totalPublishes) * 100;

      // Track latency
      metrics.recentLatencies.push(latency);
      if (metrics.recentLatencies.length > this.config.maxLatencySamples) {
        metrics.recentLatencies.shift();
      }

      // Update latency metrics
      this.updateLatencyMetrics(metrics);

      // Track global latency
      this.latencySamples.push(latency);
      if (this.latencySamples.length > this.config.maxLatencySamples) {
        this.latencySamples.shift();
      }

      // Check for alerts
      if (metrics.successRate < 90) {
        this.createAlert({
          type: AlertType.HIGH_ERROR_RATE,
          severity: AlertSeverity.ERROR,
          title: 'High Publish Error Rate',
          message: `Relay ${relay} has ${metrics.successRate.toFixed(1)}% success rate`,
          relay,
          metadata: { successRate: metrics.successRate },
        });
      }

      if (metrics.p95Latency > 1000) {
        this.createAlert({
          type: AlertType.HIGH_LATENCY,
          severity: AlertSeverity.WARNING,
          title: 'High Publish Latency',
          message: `Relay ${relay} p95 latency: ${metrics.p95Latency.toFixed(0)}ms`,
          relay,
          metadata: { p95Latency: metrics.p95Latency },
        });
      }
    });

    // Track request counts
    this.requestCount++;
    if (result.success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
  }

  /**
   * Update latency percentile metrics
   */
  private updateLatencyMetrics(metrics: PublishMetrics): void {
    if (metrics.recentLatencies.length === 0) {
      return;
    }

    const sorted = [...metrics.recentLatencies].sort((a, b) => a - b);
    const len = sorted.length;

    metrics.averageLatency =
      sorted.reduce((sum, val) => sum + val, 0) / len;
    metrics.p50Latency = sorted[Math.floor(len * 0.5)] || 0;
    metrics.p95Latency = sorted[Math.floor(len * 0.95)] || 0;
    metrics.p99Latency = sorted[Math.floor(len * 0.99)] || 0;
  }

  /**
   * Get publish summary
   */
  private getPublishSummary(): PublishSummary {
    const metrics = Array.from(this.publishMetrics.values());

    const totalEvents = metrics.reduce((sum, m) => sum + m.totalPublishes, 0);
    const successfulEvents = metrics.reduce((sum, m) => sum + m.successfulPublishes, 0);
    const failedEvents = metrics.reduce((sum, m) => sum + m.failedPublishes, 0);

    const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

    const averageLatency =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.averageLatency, 0) / metrics.length
        : 0;

    const p95Latency =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.p95Latency, 0) / metrics.length
        : 0;

    // Calculate events per minute
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentEvents = metrics.reduce((sum, m) => {
      return sum + (m.lastPublishAt && m.lastPublishAt > oneMinuteAgo ? 1 : 0);
    }, 0);

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      successRate,
      averageLatency,
      p95Latency,
      eventsPerMinute: recentEvents,
      perRelayMetrics: metrics,
    };
  }

  // ============================================
  // SUBSCRIPTION MONITORING
  // ============================================

  /**
   * Track subscription event
   */
  private trackSubscriptionEvent(subId: string, event: NostrEvent): void {
    let metrics = this.subscriptionMetrics.get(subId);
    if (!metrics) {
      const subInfo = this.subscriptionManager.getSubscription(subId);
      if (!subInfo) return;

      metrics = {
        subscriptionId: subId,
        activeRelays: subInfo.relays.length,
        totalEvents: 0,
        eventsPerSecond: 0,
        averageLatency: 0,
        uptime: 0,
        errors: 0,
        eoseCount: 0,
        eoseRelays: [],
        createdAt: subInfo.createdAt,
      };
      this.subscriptionMetrics.set(subId, metrics);
    }

    // Update event count
    metrics.totalEvents++;
    metrics.lastEventAt = Date.now();

    // Update uptime
    metrics.uptime = Date.now() - metrics.createdAt;

    // Calculate events per second
    if (metrics.uptime > 0) {
      metrics.eventsPerSecond = (metrics.totalEvents / metrics.uptime) * 1000;
    }

    // Track global event count
    this.eventCount++;
    this.trackThroughput();
  }

  /**
   * Track subscription EOSE
   */
  private trackSubscriptionEOSE(subId: string, relay: string): void {
    const metrics = this.subscriptionMetrics.get(subId);
    if (!metrics) return;

    if (!metrics.eoseRelays.includes(relay)) {
      metrics.eoseRelays.push(relay);
      metrics.eoseCount++;
    }
  }

  /**
   * Track subscription error
   */
  private trackSubscriptionError(subId: string, error: Error): void {
    const metrics = this.subscriptionMetrics.get(subId);
    if (!metrics) return;

    metrics.errors++;

    this.createAlert({
      type: AlertType.SUBSCRIPTION_ERROR,
      severity: AlertSeverity.ERROR,
      title: 'Subscription Error',
      message: `Subscription ${subId}: ${error.message}`,
      metadata: { subscriptionId: subId, error: error.message },
    });
  }

  /**
   * Get subscription summary
   */
  private getSubscriptionSummary(): SubscriptionSummary {
    const allSubs = this.subscriptionManager.getSubscriptions();
    const activeSubs = allSubs.filter(s => s.state === 'active');
    const pausedSubs = allSubs.filter(s => s.state === 'paused');

    const metrics = Array.from(this.subscriptionMetrics.values());

    const totalEventsReceived = metrics.reduce((sum, m) => sum + m.totalEvents, 0);
    const averageEventsPerSecond =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.eventsPerSecond, 0) / metrics.length
        : 0;
    const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);

    return {
      activeSubscriptions: activeSubs.length,
      pausedSubscriptions: pausedSubs.length,
      totalEventsReceived,
      averageEventsPerSecond,
      totalErrors,
      perSubscriptionMetrics: metrics,
    };
  }

  // ============================================
  // PERFORMANCE METRICS
  // ============================================

  /**
   * Track throughput
   */
  private trackThroughput(): void {
    const now = Date.now();
    this.throughputSamples.push({ timestamp: now, count: 1 });

    // Clean up old samples (keep last hour)
    const cutoff = now - this.config.retentionWindow;
    this.throughputSamples = this.throughputSamples.filter(s => s.timestamp > cutoff);
  }

  /**
   * Calculate latency percentiles
   */
  private calculateLatencyPercentiles(): LatencyPercentiles {
    if (this.latencySamples.length === 0) {
      return {
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        max: 0,
        min: 0,
        avg: 0,
      };
    }

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)] || 0,
      p75: sorted[Math.floor(len * 0.75)] || 0,
      p90: sorted[Math.floor(len * 0.9)] || 0,
      p95: sorted[Math.floor(len * 0.95)] || 0,
      p99: sorted[Math.floor(len * 0.99)] || 0,
      max: sorted[len - 1] || 0,
      min: sorted[0] || 0,
      avg: sorted.reduce((sum, val) => sum + val, 0) / len,
    };
  }

  /**
   * Calculate throughput metrics
   */
  private calculateThroughputMetrics(): ThroughputMetrics {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const oneMinuteAgo = now - 60000;

    const eventsLastSecond = this.throughputSamples.filter(
      s => s.timestamp > oneSecondAgo
    ).length;
    const eventsLastMinute = this.throughputSamples.filter(
      s => s.timestamp > oneMinuteAgo
    ).length;

    const totalEvents = this.throughputSamples.length;

    // Calculate average EPS over entire retention window
    const oldestSample = this.throughputSamples[0];
    const timeSpan = oldestSample ? now - oldestSample.timestamp : 1000;
    const averageEventsPerSecond = (totalEvents / timeSpan) * 1000;

    return {
      eventsPerSecond: eventsLastSecond,
      eventsPerMinute: eventsLastMinute,
      peakEventsPerSecond: Math.max(eventsLastSecond, 0),
      averageEventsPerSecond,
      totalEvents: this.eventCount,
    };
  }

  /**
   * Get network metrics
   */
  private getNetworkMetrics(): NetworkMetrics {
    return {
      totalRequests: this.requestCount,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      latency: this.calculateLatencyPercentiles(),
      throughput: this.calculateThroughputMetrics(),
    };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): MemoryMetrics {
    const subStats = this.subscriptionManager.getStats();

    return {
      eventCacheSize: subStats.seenEvents,
      subscriptionCount: subStats.totalSubscriptions,
      seenEventIdsCount: subStats.seenEvents,
    };
  }

  // ============================================
  // ALERTING
  // ============================================

  /**
   * Create alert
   */
  private createAlert(params: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    relay?: string;
    metadata?: Record<string, unknown>;
  }): void {
    if (!this.config.alerts.enabled) {
      return;
    }

    // Check if this alert type is enabled
    const condition = this.config.alerts.conditions.find(c => c.type === params.type);
    if (!condition || !condition.enabled) {
      return;
    }

    // Create alert
    const alert: Alert = {
      id: this.generateAlertId(),
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      timestamp: Date.now(),
      relay: params.relay,
      metadata: params.metadata,
      acknowledged: false,
    };

    // Add to alerts list
    this.alerts.push(alert);

    // Trim alerts if exceeds max
    if (this.alerts.length > this.config.alerts.maxAlerts!) {
      this.alerts = this.alerts.slice(-this.config.alerts.maxAlerts!);
    }

    // Emit event
    this.emit('alert:created', alert);

    // Call callback if configured
    if (this.config.alerts.onAlert) {
      this.config.alerts.onAlert(alert);
    }

    console.warn(`[MonitoringService] Alert: ${alert.title} - ${alert.message}`);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  // ============================================
  // METRICS COLLECTION
  // ============================================

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    const collect = () => {
      this.collectMetrics();
      this.metricsTimer = setTimeout(collect, this.config.metricsInterval);
    };

    collect();
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    // Update relay health for all relays
    const relays = this.relayPool.getConfiguredRelays();
    relays.forEach(url => {
      this.updateRelayHealth(url);
    });

    // Get current metrics
    const metrics = this.getMetrics();

    // Emit metrics updated event
    this.emit('metrics:updated', metrics);

    this.lastMetricsUpdate = Date.now();
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): MonitoringMetrics {
    return {
      timestamp: Date.now(),
      connectionHealth: this.getConnectionHealthSummary(),
      relayHealth: Array.from(this.relayMetrics.values()),
      publishing: this.getPublishSummary(),
      subscriptions: this.getSubscriptionSummary(),
      network: this.getNetworkMetrics(),
      memory: this.getMemoryMetrics(),
      activeAlerts: this.getActiveAlerts(),
    };
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  /**
   * Perform health check
   */
  healthCheck(): HealthCheckResult {
    const metrics = this.getMetrics();

    // Check relay health
    const relayHealth =
      metrics.connectionHealth.averageHealthScore > 80
        ? HealthStatus.HEALTHY
        : metrics.connectionHealth.averageHealthScore > 50
        ? HealthStatus.DEGRADED
        : HealthStatus.UNHEALTHY;

    // Check publishing health
    const publishHealth =
      metrics.publishing.successRate > 95
        ? HealthStatus.HEALTHY
        : metrics.publishing.successRate > 80
        ? HealthStatus.DEGRADED
        : HealthStatus.UNHEALTHY;

    // Check subscription health
    const subscriptionHealth =
      metrics.subscriptions.totalErrors < 5
        ? HealthStatus.HEALTHY
        : metrics.subscriptions.totalErrors < 20
        ? HealthStatus.DEGRADED
        : HealthStatus.UNHEALTHY;

    // Check performance health
    const performanceHealth =
      metrics.network.latency.p95 < 500
        ? HealthStatus.HEALTHY
        : metrics.network.latency.p95 < 1000
        ? HealthStatus.DEGRADED
        : HealthStatus.UNHEALTHY;

    // Calculate overall status
    const healthScores = [relayHealth, publishHealth, subscriptionHealth, performanceHealth];
    const unhealthyCount = healthScores.filter(h => h === HealthStatus.UNHEALTHY).length;
    const degradedCount = healthScores.filter(h => h === HealthStatus.DEGRADED).length;

    let overallStatus: HealthStatus;
    if (unhealthyCount > 1) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (unhealthyCount > 0 || degradedCount > 1) {
      overallStatus = HealthStatus.DEGRADED;
    } else {
      overallStatus = HealthStatus.HEALTHY;
    }

    // Calculate health score
    const score =
      ((healthScores.filter(h => h === HealthStatus.HEALTHY).length * 100 +
        healthScores.filter(h => h === HealthStatus.DEGRADED).length * 50) /
        healthScores.length);

    return {
      status: overallStatus,
      score,
      checks: {
        relays: relayHealth,
        publishing: publishHealth,
        subscriptions: subscriptionHealth,
        performance: performanceHealth,
      },
      timestamp: Date.now(),
    };
  }

  // ============================================
  // METRICS EXPORT
  // ============================================

  /**
   * Export metrics to Prometheus format
   */
  exportPrometheus(): string {
    const metrics = this.getMetrics();
    const prometheusMetrics: PrometheusMetric[] = [];

    // Connection metrics
    prometheusMetrics.push(
      {
        name: 'nostr_relays_total',
        type: 'gauge',
        value: metrics.connectionHealth.totalRelays,
        help: 'Total number of configured relays',
      },
      {
        name: 'nostr_relays_connected',
        type: 'gauge',
        value: metrics.connectionHealth.connectedRelays,
        help: 'Number of connected relays',
      },
      {
        name: 'nostr_relay_health_score',
        type: 'gauge',
        value: metrics.connectionHealth.averageHealthScore,
        help: 'Average relay health score (0-100)',
      },
      {
        name: 'nostr_relay_uptime',
        type: 'gauge',
        value: metrics.connectionHealth.averageUptime,
        help: 'Average relay uptime percentage',
      },
      {
        name: 'nostr_relay_latency_ms',
        type: 'gauge',
        value: metrics.connectionHealth.averageLatency,
        help: 'Average relay latency in milliseconds',
      }
    );

    // Publishing metrics
    prometheusMetrics.push(
      {
        name: 'nostr_events_published_total',
        type: 'counter',
        value: metrics.publishing.totalEvents,
        help: 'Total events published',
      },
      {
        name: 'nostr_events_published_success',
        type: 'counter',
        value: metrics.publishing.successfulEvents,
        help: 'Successfully published events',
      },
      {
        name: 'nostr_events_published_failed',
        type: 'counter',
        value: metrics.publishing.failedEvents,
        help: 'Failed event publishes',
      },
      {
        name: 'nostr_publish_success_rate',
        type: 'gauge',
        value: metrics.publishing.successRate,
        help: 'Event publish success rate percentage',
      },
      {
        name: 'nostr_publish_latency_p95_ms',
        type: 'gauge',
        value: metrics.publishing.p95Latency,
        help: 'p95 publish latency in milliseconds',
      }
    );

    // Subscription metrics
    prometheusMetrics.push(
      {
        name: 'nostr_subscriptions_active',
        type: 'gauge',
        value: metrics.subscriptions.activeSubscriptions,
        help: 'Number of active subscriptions',
      },
      {
        name: 'nostr_subscription_events_total',
        type: 'counter',
        value: metrics.subscriptions.totalEventsReceived,
        help: 'Total events received via subscriptions',
      },
      {
        name: 'nostr_subscription_errors_total',
        type: 'counter',
        value: metrics.subscriptions.totalErrors,
        help: 'Total subscription errors',
      }
    );

    // Network metrics
    prometheusMetrics.push(
      {
        name: 'nostr_network_requests_total',
        type: 'counter',
        value: metrics.network.totalRequests,
        help: 'Total network requests',
      },
      {
        name: 'nostr_network_latency_p50_ms',
        type: 'gauge',
        value: metrics.network.latency.p50,
        help: 'p50 network latency',
      },
      {
        name: 'nostr_network_latency_p95_ms',
        type: 'gauge',
        value: metrics.network.latency.p95,
        help: 'p95 network latency',
      },
      {
        name: 'nostr_network_latency_p99_ms',
        type: 'gauge',
        value: metrics.network.latency.p99,
        help: 'p99 network latency',
      },
      {
        name: 'nostr_throughput_events_per_second',
        type: 'gauge',
        value: metrics.network.throughput.eventsPerSecond,
        help: 'Current events per second',
      }
    );

    // Alert metrics
    prometheusMetrics.push({
      name: 'nostr_alerts_active',
      type: 'gauge',
      value: metrics.activeAlerts.length,
      help: 'Number of active alerts',
    });

    // Convert to Prometheus text format
    return prometheusMetrics
      .map(m => {
        const labels = m.labels
          ? `{${Object.entries(m.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',')}}`
          : '';
        return `# HELP ${m.name} ${m.help || ''}\n# TYPE ${m.name} ${m.type}\n${m.name}${labels} ${m.value}`;
      })
      .join('\n\n');
  }

  /**
   * Export metrics to JSON
   */
  exportJSON(): MetricsExport {
    return {
      format: 'json',
      metrics: this.getMetrics(),
      timestamp: Date.now(),
    };
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Relay pool events
    this.relayPool.on('relay:connected', (url: string) => {
      this.updateRelayHealth(url);
    });

    this.relayPool.on('relay:disconnected', (url: string) => {
      this.updateRelayHealth(url);
    });

    this.relayPool.on('relay:error', (url: string, error: Error) => {
      this.updateRelayHealth(url);
      this.createAlert({
        type: AlertType.RELAY_ERROR,
        severity: AlertSeverity.ERROR,
        title: 'Relay Error',
        message: `Relay ${url}: ${error.message}`,
        relay: url,
      });
    });

    // Publisher events
    this.publisher.on('event:published', (result: PublishResultComplete) => {
      this.trackPublishEvent(result);
    });

    this.publisher.on('publish:error', (event: NostrEvent, error: Error) => {
      this.createAlert({
        type: AlertType.PUBLISH_FAILURE,
        severity: AlertSeverity.ERROR,
        title: 'Publish Failure',
        message: `Failed to publish event: ${error.message}`,
      });
    });
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create default relay metrics
   */
  private createDefaultRelayMetrics(url: string): RelayHealthMetrics {
    return {
      url,
      status: RelayStatus.DISCONNECTED,
      health: RelayHealth.UNHEALTHY,
      healthScore: 0,
      uptime: 0,
      latency: 0,
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
    };
  }

  /**
   * Create default publish metrics
   */
  private createDefaultPublishMetrics(relay: string): PublishMetrics {
    return {
      relay,
      totalPublishes: 0,
      successfulPublishes: 0,
      failedPublishes: 0,
      successRate: 100,
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      recentLatencies: [],
    };
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  /**
   * Destroy service and cleanup
   */
  async destroy(): Promise<void> {
    // Stop metrics collection
    if (this.metricsTimer) {
      clearTimeout(this.metricsTimer);
    }

    // Clear all data
    this.relayMetrics.clear();
    this.publishMetrics.clear();
    this.subscriptionMetrics.clear();
    this.latencySamples = [];
    this.throughputSamples = [];
    this.alerts = [];

    // Reset counters
    this.eventCount = 0;
    this.requestCount = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;

    // Remove all listeners
    this.removeAllListeners();

    this.initialized = false;
    MonitoringService.instance = null;

    console.log('[MonitoringService] Service destroyed');
  }
}

// Export singleton instance
export const monitoringService = MonitoringService.getInstance();
