/**
 * 📊 ELITE SERVICE: Rate Limit Monitor
 *
 * US-321: Implement NOSTR Rate Limiting
 * Epic 003: NOSTR Consolidation
 *
 * Integration bridge between RateLimiter and MonitoringService.
 * Exports rate limit metrics in formats compatible with monitoring dashboards.
 *
 * Features:
 * - Real-time rate limit metrics tracking
 * - Alert generation for rate limit issues
 * - Dashboard visualization data
 * - Export to Prometheus format
 * - Integration with NOSTR MonitoringService
 *
 * @example
 * ```typescript
 * const monitor = RateLimitMonitor.getInstance();
 * await monitor.initialize();
 *
 * // Get dashboard data
 * const dashboardData = monitor.getDashboardData();
 *
 * // Get Prometheus metrics
 * const prometheusMetrics = monitor.exportPrometheus();
 * ```
 */

import { EventEmitter } from 'events';
import { RateLimiter } from './RateLimiter';
import { MonitoringService } from './MonitoringService';
import type {
  RateLimitMetrics,
  RateLimitOperation,
  RateLimitEvent,
  RateLimitAlert,
  RateLimitAlertSeverity,
} from './types/rate-limit';

// ========================================
// Dashboard Data Types
// ========================================

/**
 * Rate limit dashboard summary
 */
export interface RateLimitDashboardData {
  /** Overall health status */
  health: 'healthy' | 'degraded' | 'critical';
  /** Summary statistics */
  summary: {
    totalRequests: number;
    successRate: number;
    denialRate: number;
    queueSize: number;
    avgWaitTime: number;
  };
  /** Per-operation metrics */
  operations: Array<{
    operation: RateLimitOperation;
    requests: number;
    allowed: number;
    denied: number;
    successRate: number;
  }>;
  /** Top relays by request volume */
  topRelays: Array<{
    relay: string;
    requests: number;
    successRate: number;
  }>;
  /** Recent alerts */
  recentAlerts: RateLimitAlert[];
  /** Time series data for charts */
  timeSeries?: {
    timestamps: number[];
    allowed: number[];
    denied: number[];
    queued: number[];
  };
}

/**
 * Prometheus metric
 */
interface PrometheusMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  help: string;
  value: number;
  labels?: Record<string, string>;
}

// ========================================
// Rate Limit Monitor
// ========================================

export class RateLimitMonitor extends EventEmitter {
  private static instance: RateLimitMonitor | null = null;

  private rateLimiter: RateLimiter;
  private monitoringService: MonitoringService;
  private initialized = false;

  // Time series data for dashboard charts (last 60 data points)
  private timeSeriesData: {
    timestamps: number[];
    allowed: number[];
    denied: number[];
    queued: number[];
  } = {
    timestamps: [],
    allowed: [],
    denied: [],
    queued: [],
  };

  private maxTimeSeriesPoints = 60;
  private metricsUpdateInterval?: NodeJS.Timeout;

  /**
   * Private constructor (Singleton pattern)
   */
  private constructor() {
    super();
    this.rateLimiter = RateLimiter.getInstance();
    this.monitoringService = MonitoringService.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RateLimitMonitor {
    if (!RateLimitMonitor.instance) {
      RateLimitMonitor.instance = new RateLimitMonitor();
    }
    return RateLimitMonitor.instance;
  }

  // ========================================
  // Initialization
  // ========================================

  /**
   * Initialize rate limit monitor
   */
  async initialize(updateInterval: number = 1000): Promise<void> {
    if (this.initialized) {
      console.warn('[RateLimitMonitor] Already initialized');
      return;
    }

    // Ensure dependencies are initialized
    if (!this.rateLimiter.isInitialized()) {
      console.warn('[RateLimitMonitor] RateLimiter not initialized');
    }

    // Set up event listeners
    this.setupEventListeners();

    // Start metrics collection for time series
    this.metricsUpdateInterval = setInterval(() => {
      this.updateTimeSeries();
    }, updateInterval);

    this.initialized = true;
    console.log('[RateLimitMonitor] Initialized successfully');
  }

  /**
   * Check if monitor is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ========================================
  // Event Handling
  // ========================================

  /**
   * Set up event listeners on RateLimiter
   */
  private setupEventListeners(): void {
    // Forward rate limit events
    this.rateLimiter.on('rate-limit-event', (event: RateLimitEvent) => {
      this.emit('rate-limit-event', event);
    });

    // Forward and handle alerts
    this.rateLimiter.on('alert', (alert: RateLimitAlert) => {
      this.handleAlert(alert);
    });
  }

  /**
   * Handle rate limit alert
   */
  private handleAlert(alert: RateLimitAlert): void {
    // Emit alert for consumers
    this.emit('alert', alert);

    // Log to console based on severity
    const prefix = `[RateLimitMonitor] ${alert.severity.toUpperCase()}`;
    const message = `${alert.type}: ${alert.message}`;

    switch (alert.severity) {
      case RateLimitAlertSeverity.CRITICAL:
      case RateLimitAlertSeverity.ERROR:
        console.error(prefix, message, alert.metadata);
        break;
      case RateLimitAlertSeverity.WARNING:
        console.warn(prefix, message, alert.metadata);
        break;
      default:
        console.info(prefix, message, alert.metadata);
    }
  }

  // ========================================
  // Metrics Collection
  // ========================================

  /**
   * Update time series data for dashboard charts
   */
  private updateTimeSeries(): void {
    const metrics = this.rateLimiter.getMetrics();
    const now = Date.now();

    // Add new data point
    this.timeSeriesData.timestamps.push(now);
    this.timeSeriesData.allowed.push(metrics.overall.allowed);
    this.timeSeriesData.denied.push(metrics.overall.denied);
    this.timeSeriesData.queued.push(metrics.queue.size);

    // Trim old data points
    if (this.timeSeriesData.timestamps.length > this.maxTimeSeriesPoints) {
      this.timeSeriesData.timestamps.shift();
      this.timeSeriesData.allowed.shift();
      this.timeSeriesData.denied.shift();
      this.timeSeriesData.queued.shift();
    }
  }

  /**
   * Get current rate limit metrics
   */
  getMetrics(): RateLimitMetrics {
    return this.rateLimiter.getMetrics();
  }

  // ========================================
  // Dashboard Data
  // ========================================

  /**
   * Get dashboard visualization data
   */
  getDashboardData(): RateLimitDashboardData {
    const metrics = this.rateLimiter.getMetrics();
    const alerts = this.rateLimiter.getAlerts(10); // Last 10 alerts

    // Calculate health status
    const denialRate = metrics.overall.totalRequests > 0
      ? metrics.overall.denied / metrics.overall.totalRequests
      : 0;

    const queueUtilization = metrics.queue.size / 1000; // Assuming max queue size of 1000

    let health: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (denialRate > 0.5 || queueUtilization > 0.9) {
      health = 'critical';
    } else if (denialRate > 0.2 || queueUtilization > 0.7) {
      health = 'degraded';
    }

    // Summary statistics
    const summary = {
      totalRequests: metrics.overall.totalRequests,
      successRate: metrics.overall.successRate,
      denialRate: denialRate * 100,
      queueSize: metrics.queue.size,
      avgWaitTime: metrics.queue.averageWaitTime,
    };

    // Per-operation metrics
    const operations = Array.from(metrics.byOperation.entries()).map(
      ([operation, stats]) => ({
        operation,
        requests: stats.totalRequests,
        allowed: stats.allowed,
        denied: stats.denied,
        successRate: stats.successRate,
      })
    );

    // Top relays by request volume
    const topRelays = Array.from(metrics.byRelay.entries())
      .map(([relay, stats]) => ({
        relay,
        requests: stats.totalRequests,
        successRate: stats.successRate,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    return {
      health,
      summary,
      operations,
      topRelays,
      recentAlerts: alerts,
      timeSeries: { ...this.timeSeriesData },
    };
  }

  // ========================================
  // Prometheus Export
  // ========================================

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const metrics = this.rateLimiter.getMetrics();
    const prometheusMetrics: PrometheusMetric[] = [];

    // Overall metrics
    prometheusMetrics.push(
      {
        name: 'nostr_rate_limit_requests_total',
        type: 'counter',
        help: 'Total number of rate limit checks',
        value: metrics.overall.totalRequests,
      },
      {
        name: 'nostr_rate_limit_allowed_total',
        type: 'counter',
        help: 'Total number of allowed requests',
        value: metrics.overall.allowed,
      },
      {
        name: 'nostr_rate_limit_denied_total',
        type: 'counter',
        help: 'Total number of denied requests',
        value: metrics.overall.denied,
      },
      {
        name: 'nostr_rate_limit_queued_total',
        type: 'counter',
        help: 'Total number of queued requests',
        value: metrics.overall.queued,
      },
      {
        name: 'nostr_rate_limit_timeout_total',
        type: 'counter',
        help: 'Total number of timed out requests',
        value: metrics.overall.timedOut,
      },
      {
        name: 'nostr_rate_limit_success_rate',
        type: 'gauge',
        help: 'Success rate percentage (0-100)',
        value: metrics.overall.successRate,
      }
    );

    // Queue metrics
    prometheusMetrics.push(
      {
        name: 'nostr_rate_limit_queue_size',
        type: 'gauge',
        help: 'Current queue size',
        value: metrics.queue.size,
      },
      {
        name: 'nostr_rate_limit_queue_max_size',
        type: 'gauge',
        help: 'Maximum queue size observed',
        value: metrics.queue.maxSize,
      },
      {
        name: 'nostr_rate_limit_queue_wait_time_ms',
        type: 'gauge',
        help: 'Average queue wait time in milliseconds',
        value: metrics.queue.averageWaitTime,
      },
      {
        name: 'nostr_rate_limit_queue_processed_total',
        type: 'counter',
        help: 'Total requests processed from queue',
        value: metrics.queue.totalProcessed,
      }
    );

    // Per-operation metrics
    metrics.byOperation.forEach((stats, operation) => {
      prometheusMetrics.push(
        {
          name: 'nostr_rate_limit_operation_requests_total',
          type: 'counter',
          help: 'Total requests per operation',
          value: stats.totalRequests,
          labels: { operation },
        },
        {
          name: 'nostr_rate_limit_operation_denied_total',
          type: 'counter',
          help: 'Denied requests per operation',
          value: stats.denied,
          labels: { operation },
        },
        {
          name: 'nostr_rate_limit_operation_success_rate',
          type: 'gauge',
          help: 'Success rate per operation',
          value: stats.successRate,
          labels: { operation },
        }
      );

      // Add bucket state if available
      if (stats.bucketState) {
        prometheusMetrics.push(
          {
            name: 'nostr_rate_limit_bucket_tokens',
            type: 'gauge',
            help: 'Current token count in bucket',
            value: stats.bucketState.currentTokens,
            labels: { operation },
          },
          {
            name: 'nostr_rate_limit_bucket_capacity',
            type: 'gauge',
            help: 'Bucket capacity (max tokens)',
            value: stats.bucketState.capacity,
            labels: { operation },
          },
          {
            name: 'nostr_rate_limit_bucket_utilization',
            type: 'gauge',
            help: 'Bucket utilization percentage',
            value: stats.bucketState.utilization,
            labels: { operation },
          }
        );
      }
    });

    // Per-relay metrics (top 20 relays)
    Array.from(metrics.byRelay.entries())
      .slice(0, 20)
      .forEach(([relay, stats]) => {
        const relayLabel = this.sanitizeRelayUrl(relay);
        prometheusMetrics.push(
          {
            name: 'nostr_rate_limit_relay_requests_total',
            type: 'counter',
            help: 'Total requests per relay',
            value: stats.totalRequests,
            labels: { relay: relayLabel },
          },
          {
            name: 'nostr_rate_limit_relay_denied_total',
            type: 'counter',
            help: 'Denied requests per relay',
            value: stats.denied,
            labels: { relay: relayLabel },
          },
          {
            name: 'nostr_rate_limit_relay_success_rate',
            type: 'gauge',
            help: 'Success rate per relay',
            value: stats.successRate,
            labels: { relay: relayLabel },
          }
        );
      });

    // Format as Prometheus text
    return this.formatPrometheusMetrics(prometheusMetrics);
  }

  /**
   * Sanitize relay URL for Prometheus labels
   */
  private sanitizeRelayUrl(url: string): string {
    return url.replace(/^wss?:\/\//, '').replace(/\//g, '_');
  }

  /**
   * Format metrics as Prometheus text
   */
  private formatPrometheusMetrics(metrics: PrometheusMetric[]): string {
    const lines: string[] = [];

    // Group metrics by name for proper Prometheus format
    const groupedMetrics = new Map<string, PrometheusMetric[]>();
    metrics.forEach(metric => {
      if (!groupedMetrics.has(metric.name)) {
        groupedMetrics.set(metric.name, []);
      }
      groupedMetrics.get(metric.name)!.push(metric);
    });

    // Format each metric group
    groupedMetrics.forEach((metricGroup, name) => {
      const first = metricGroup[0];

      // Add HELP and TYPE
      lines.push(`# HELP ${name} ${first.help}`);
      lines.push(`# TYPE ${name} ${first.type}`);

      // Add metric values
      metricGroup.forEach(metric => {
        const labels = metric.labels
          ? `{${Object.entries(metric.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',')}}`
          : '';
        lines.push(`${name}${labels} ${metric.value}`);
      });

      lines.push(''); // Empty line between metric groups
    });

    return lines.join('\n');
  }

  // ========================================
  // Export Methods
  // ========================================

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    const metrics = this.rateLimiter.getMetrics();
    return JSON.stringify(metrics, (key, value) => {
      // Convert Maps to objects for JSON serialization
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }, 2);
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit?: number): RateLimitAlert[] {
    return this.rateLimiter.getAlerts(limit);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.rateLimiter.clearAlerts();
  }

  // ========================================
  // Lifecycle
  // ========================================

  /**
   * Destroy monitor and cleanup
   */
  async destroy(): Promise<void> {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = undefined;
    }

    this.removeAllListeners();

    this.timeSeriesData = {
      timestamps: [],
      allowed: [],
      denied: [],
      queued: [],
    };

    this.initialized = false;
    RateLimitMonitor.instance = null;

    console.log('[RateLimitMonitor] Destroyed successfully');
  }
}

// ========================================
// Singleton Export
// ========================================

export const rateLimitMonitor = RateLimitMonitor.getInstance();
