/**
 * 📊 ELITE TYPE DEFINITIONS: NOSTR Monitoring Service
 *
 * US-316: NOSTR Monitoring Service
 * Epic 003: NOSTR Consolidation
 *
 * Comprehensive monitoring types for tracking NOSTR operations:
 * - Connection health metrics
 * - Event publishing metrics
 * - Subscription metrics
 * - Performance tracking
 * - Alert definitions
 */

import type { RelayStatus, RelayHealth } from '../types';

// ============================================
// CONNECTION HEALTH METRICS
// ============================================

/**
 * Relay connection health snapshot
 */
export interface RelayHealthMetrics {
  /** Relay URL */
  url: string;
  /** Current connection status */
  status: RelayStatus;
  /** Health status */
  health: RelayHealth;
  /** Overall health score (0-100) */
  healthScore: number;
  /** Connection uptime percentage */
  uptime: number;
  /** Average latency in milliseconds */
  latency: number;
  /** Connection attempt count */
  connectionAttempts: number;
  /** Successful connections */
  successfulConnections: number;
  /** Failed connections */
  failedConnections: number;
  /** Last connection timestamp */
  lastConnectedAt?: number;
  /** Last disconnection timestamp */
  lastDisconnectedAt?: number;
  /** Last error message */
  lastError?: string;
  /** Last error timestamp */
  lastErrorAt?: number;
}

/**
 * Aggregated connection health across all relays
 */
export interface ConnectionHealthSummary {
  /** Total relay count */
  totalRelays: number;
  /** Connected relays */
  connectedRelays: number;
  /** Disconnected relays */
  disconnectedRelays: number;
  /** Relays with errors */
  errorRelays: number;
  /** Average health score */
  averageHealthScore: number;
  /** Average uptime percentage */
  averageUptime: number;
  /** Average latency across all relays */
  averageLatency: number;
  /** Relays by health status */
  relaysByHealth: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

// ============================================
// EVENT PUBLISHING METRICS
// ============================================

/**
 * Event publishing metrics per relay
 */
export interface PublishMetrics {
  /** Relay URL */
  relay: string;
  /** Total publish attempts */
  totalPublishes: number;
  /** Successful publishes */
  successfulPublishes: number;
  /** Failed publishes */
  failedPublishes: number;
  /** Success rate percentage (0-100) */
  successRate: number;
  /** Average publish latency (ms) */
  averageLatency: number;
  /** p50 latency (ms) */
  p50Latency: number;
  /** p95 latency (ms) */
  p95Latency: number;
  /** p99 latency (ms) */
  p99Latency: number;
  /** Last publish timestamp */
  lastPublishAt?: number;
  /** Last publish success */
  lastPublishSuccess?: boolean;
  /** Recent publish latencies (rolling window) */
  recentLatencies: number[];
}

/**
 * Aggregated publish metrics across all relays
 */
export interface PublishSummary {
  /** Total events published */
  totalEvents: number;
  /** Successfully published events */
  successfulEvents: number;
  /** Failed events */
  failedEvents: number;
  /** Overall success rate */
  successRate: number;
  /** Average latency across all relays */
  averageLatency: number;
  /** p95 latency across all relays */
  p95Latency: number;
  /** Events published per minute */
  eventsPerMinute: number;
  /** Per-relay metrics */
  perRelayMetrics: PublishMetrics[];
}

// ============================================
// SUBSCRIPTION METRICS
// ============================================

/**
 * Subscription performance metrics
 */
export interface SubscriptionMetrics {
  /** Subscription ID */
  subscriptionId: string;
  /** Active relay count */
  activeRelays: number;
  /** Total events received */
  totalEvents: number;
  /** Events received per second */
  eventsPerSecond: number;
  /** Average event receiving latency (ms) */
  averageLatency: number;
  /** Subscription uptime (ms) */
  uptime: number;
  /** Subscription errors */
  errors: number;
  /** EOSE received count */
  eoseCount: number;
  /** EOSE relays */
  eoseRelays: string[];
  /** Last event received timestamp */
  lastEventAt?: number;
  /** Created timestamp */
  createdAt: number;
}

/**
 * Aggregated subscription metrics
 */
export interface SubscriptionSummary {
  /** Total active subscriptions */
  activeSubscriptions: number;
  /** Total paused subscriptions */
  pausedSubscriptions: number;
  /** Total events received across all subscriptions */
  totalEventsReceived: number;
  /** Average events per second */
  averageEventsPerSecond: number;
  /** Total subscription errors */
  totalErrors: number;
  /** Per-subscription metrics */
  perSubscriptionMetrics: SubscriptionMetrics[];
}

// ============================================
// PERFORMANCE METRICS
// ============================================

/**
 * Latency percentile metrics
 */
export interface LatencyPercentiles {
  /** 50th percentile (median) */
  p50: number;
  /** 75th percentile */
  p75: number;
  /** 90th percentile */
  p90: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
  /** Maximum latency */
  max: number;
  /** Minimum latency */
  min: number;
  /** Average latency */
  avg: number;
}

/**
 * Throughput metrics
 */
export interface ThroughputMetrics {
  /** Events per second (current) */
  eventsPerSecond: number;
  /** Events per minute (current) */
  eventsPerMinute: number;
  /** Peak events per second */
  peakEventsPerSecond: number;
  /** Average events per second (over time window) */
  averageEventsPerSecond: number;
  /** Total events processed */
  totalEvents: number;
}

/**
 * Network performance metrics
 */
export interface NetworkMetrics {
  /** Total network requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Request latency percentiles */
  latency: LatencyPercentiles;
  /** Throughput metrics */
  throughput: ThroughputMetrics;
  /** Bytes sent (if available) */
  bytesSent?: number;
  /** Bytes received (if available) */
  bytesReceived?: number;
}

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  /** Total heap size in bytes */
  totalHeapSize?: number;
  /** Used heap size in bytes */
  usedHeapSize?: number;
  /** Heap usage percentage */
  heapUsagePercent?: number;
  /** Event cache size */
  eventCacheSize: number;
  /** Subscription count */
  subscriptionCount: number;
  /** Seen event IDs count */
  seenEventIdsCount: number;
}

// ============================================
// ALERTING
// ============================================

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Alert types
 */
export enum AlertType {
  RELAY_DISCONNECTED = 'relay_disconnected',
  RELAY_ERROR = 'relay_error',
  HIGH_ERROR_RATE = 'high_error_rate',
  HIGH_LATENCY = 'high_latency',
  PUBLISH_FAILURE = 'publish_failure',
  SUBSCRIPTION_ERROR = 'subscription_error',
  PERFORMANCE_DEGRADED = 'performance_degraded',
  MEMORY_HIGH = 'memory_high',
}

/**
 * Alert definition
 */
export interface Alert {
  /** Unique alert ID */
  id: string;
  /** Alert type */
  type: AlertType;
  /** Severity level */
  severity: AlertSeverity;
  /** Alert title */
  title: string;
  /** Alert message */
  message: string;
  /** Timestamp when alert was created */
  timestamp: number;
  /** Related relay URL (if applicable) */
  relay?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Whether alert has been acknowledged */
  acknowledged: boolean;
  /** Acknowledgement timestamp */
  acknowledgedAt?: number;
}

/**
 * Alert condition configuration
 */
export interface AlertCondition {
  /** Alert type */
  type: AlertType;
  /** Severity level */
  severity: AlertSeverity;
  /** Enable this alert */
  enabled: boolean;
  /** Threshold value (depends on alert type) */
  threshold?: number;
  /** Time window in milliseconds */
  timeWindow?: number;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Enable alerting */
  enabled: boolean;
  /** Alert conditions */
  conditions: AlertCondition[];
  /** Maximum alerts to retain */
  maxAlerts?: number;
  /** Alert callback */
  onAlert?: (alert: Alert) => void;
}

// ============================================
// MONITORING EVENTS
// ============================================

/**
 * Monitoring service event types
 */
export interface MonitoringEvents {
  'metrics:updated': (metrics: MonitoringMetrics) => void;
  'alert:created': (alert: Alert) => void;
  'health:changed': (health: ConnectionHealthSummary) => void;
  'performance:degraded': (metrics: NetworkMetrics) => void;
}

// ============================================
// MONITORING CONFIGURATION
// ============================================

/**
 * Monitoring service configuration
 */
export interface MonitoringConfig {
  /** Enable monitoring */
  enabled: boolean;
  /** Metrics collection interval (ms) */
  metricsInterval?: number;
  /** Metrics retention window (ms) */
  retentionWindow?: number;
  /** Enable performance tracking */
  enablePerformanceTracking?: boolean;
  /** Enable memory tracking */
  enableMemoryTracking?: boolean;
  /** Alert configuration */
  alerts?: AlertConfig;
  /** Maximum latency samples to retain */
  maxLatencySamples?: number;
}

// ============================================
// COMPREHENSIVE METRICS
// ============================================

/**
 * Complete monitoring metrics snapshot
 */
export interface MonitoringMetrics {
  /** Snapshot timestamp */
  timestamp: number;
  /** Connection health metrics */
  connectionHealth: ConnectionHealthSummary;
  /** Per-relay health metrics */
  relayHealth: RelayHealthMetrics[];
  /** Publishing metrics */
  publishing: PublishSummary;
  /** Subscription metrics */
  subscriptions: SubscriptionSummary;
  /** Network performance metrics */
  network: NetworkMetrics;
  /** Memory metrics */
  memory: MemoryMetrics;
  /** Active alerts */
  activeAlerts: Alert[];
}

// ============================================
// METRICS EXPORT FORMATS
// ============================================

/**
 * Prometheus metric format
 */
export interface PrometheusMetric {
  /** Metric name */
  name: string;
  /** Metric type (counter, gauge, histogram) */
  type: 'counter' | 'gauge' | 'histogram';
  /** Metric value */
  value: number;
  /** Metric labels */
  labels?: Record<string, string>;
  /** Help text */
  help?: string;
  /** Timestamp */
  timestamp?: number;
}

/**
 * Metrics export format
 */
export interface MetricsExport {
  /** Format type */
  format: 'prometheus' | 'json' | 'custom';
  /** Metrics data */
  metrics: PrometheusMetric[] | MonitoringMetrics | unknown;
  /** Export timestamp */
  timestamp: number;
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Health check status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Overall health status */
  status: HealthStatus;
  /** Health score (0-100) */
  score: number;
  /** Individual checks */
  checks: {
    relays: HealthStatus;
    publishing: HealthStatus;
    subscriptions: HealthStatus;
    performance: HealthStatus;
  };
  /** Timestamp */
  timestamp: number;
  /** Details */
  details?: string;
}
