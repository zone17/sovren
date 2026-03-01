/**
 * 📊 ELITE COMPONENT: NOSTR Monitoring Dashboard
 *
 * US-316: NOSTR Monitoring Service
 * Epic 003: NOSTR Consolidation
 *
 * Real-time monitoring dashboard for NOSTR operations with:
 * - Connection health visualization
 * - Publishing metrics display
 * - Subscription monitoring
 * - Performance charts
 * - Active alerts panel
 * - Health status indicators
 * - Auto-refresh (5 second interval)
 *
 * @example
 * ```tsx
 * import { NostrMonitoringDashboard } from '@components/nostr';
 *
 * function App() {
 *   return <NostrMonitoringDashboard />;
 * }
 * ```
 */

import React, { useState, useEffect } from 'react';
import { MonitoringService } from '@/services/nostr/MonitoringService';
import type {
  MonitoringMetrics,
  Alert,
  HealthCheckResult,
  HealthStatus,
} from '@/services/nostr/types/monitoring';
import { AlertSeverity } from '@/services/nostr/types/monitoring';

/**
 * Dashboard props
 */
export interface NostrMonitoringDashboardProps {
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Show detailed metrics */
  showDetails?: boolean;
  /** Enable compact mode */
  compact?: boolean;
  /** Custom CSS class */
  className?: string;
}

/**
 * NOSTR Monitoring Dashboard Component
 */
export const NostrMonitoringDashboard: React.FC<NostrMonitoringDashboardProps> = ({
  refreshInterval = 5000,
  showDetails = true,
  compact = false,
  className = '',
}) => {
  const [monitoring] = useState(() => MonitoringService.getInstance());
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch metrics
  const fetchMetrics = () => {
    try {
      if (!monitoring.isInitialized()) {
        setError('Monitoring service not initialized');
        return;
      }

      const currentMetrics = monitoring.getMetrics();
      const currentHealth = monitoring.healthCheck();

      setMetrics(currentMetrics);
      setHealth(currentHealth);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      setLoading(false);
    }
  };

  // Auto-refresh metrics
  useEffect(() => {
    fetchMetrics();

    const interval = setInterval(fetchMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Listen for real-time updates
  useEffect(() => {
    const handleMetricsUpdate = (updatedMetrics: MonitoringMetrics) => {
      setMetrics(updatedMetrics);
      setHealth(monitoring.healthCheck());
    };

    monitoring.on('metrics:updated', handleMetricsUpdate);

    return () => {
      monitoring.off('metrics:updated', handleMetricsUpdate);
    };
  }, [monitoring]);

  if (loading) {
    return (
      <div className={`monitoring-dashboard ${className}`}>
        <div className="loading">Loading monitoring data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`monitoring-dashboard ${className}`}>
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  if (!metrics || !health) {
    return (
      <div className={`monitoring-dashboard ${className}`}>
        <div className="no-data">No monitoring data available</div>
      </div>
    );
  }

  return (
    <div className={`monitoring-dashboard ${compact ? 'compact' : ''} ${className}`}>
      {/* Header */}
      <div className="dashboard-header">
        <h2>NOSTR Monitoring Dashboard</h2>
        <div className="last-update">
          Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Overall Health Status */}
      <HealthStatusCard health={health} compact={compact} />

      {/* Active Alerts */}
      {metrics.activeAlerts.length > 0 && (
        <AlertsPanel
          alerts={metrics.activeAlerts}
          onAcknowledge={(id) => monitoring.acknowledgeAlert(id)}
        />
      )}

      {/* Metrics Grid */}
      <div className={`metrics-grid ${compact ? 'compact' : ''}`}>
        {/* Connection Health */}
        <ConnectionHealthCard
          health={metrics.connectionHealth}
          relayHealth={metrics.relayHealth}
          showDetails={showDetails}
          compact={compact}
        />

        {/* Publishing Metrics */}
        <PublishingMetricsCard
          metrics={metrics.publishing}
          showDetails={showDetails}
          compact={compact}
        />

        {/* Subscription Metrics */}
        <SubscriptionMetricsCard
          metrics={metrics.subscriptions}
          showDetails={showDetails}
          compact={compact}
        />

        {/* Performance Metrics */}
        <PerformanceMetricsCard
          metrics={metrics.network}
          showDetails={showDetails}
          compact={compact}
        />

        {/* Memory Metrics */}
        {showDetails && <MemoryMetricsCard metrics={metrics.memory} compact={compact} />}
      </div>
    </div>
  );
};

/**
 * Health Status Card
 */
const HealthStatusCard: React.FC<{ health: HealthCheckResult; compact: boolean }> = ({
  health,
  compact,
}) => {
  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return 'green';
      case 'degraded':
        return 'yellow';
      case 'unhealthy':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'degraded':
        return '⚠';
      case 'unhealthy':
        return '✗';
      default:
        return '?';
    }
  };

  return (
    <div className={`health-status-card status-${health.status}`}>
      <div className="status-header">
        <span className={`status-icon ${getStatusColor(health.status)}`}>
          {getStatusIcon(health.status)}
        </span>
        <h3>Overall Health: {health.status.toUpperCase()}</h3>
        <span className="health-score">{health.score.toFixed(0)}/100</span>
      </div>

      {!compact && (
        <div className="health-checks">
          <HealthCheck
            label="Relays"
            status={health.checks.relays}
            color={getStatusColor(health.checks.relays)}
          />
          <HealthCheck
            label="Publishing"
            status={health.checks.publishing}
            color={getStatusColor(health.checks.publishing)}
          />
          <HealthCheck
            label="Subscriptions"
            status={health.checks.subscriptions}
            color={getStatusColor(health.checks.subscriptions)}
          />
          <HealthCheck
            label="Performance"
            status={health.checks.performance}
            color={getStatusColor(health.checks.performance)}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Individual Health Check
 */
const HealthCheck: React.FC<{ label: string; status: HealthStatus; color: string }> = ({
  label,
  status,
  color,
}) => (
  <div className="health-check">
    <span className={`indicator ${color}`}></span>
    <span className="label">{label}</span>
    <span className="status">{status}</span>
  </div>
);

/**
 * Alerts Panel
 */
const AlertsPanel: React.FC<{
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
}> = ({ alerts, onAcknowledge }) => {
  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'red';
      case AlertSeverity.ERROR:
        return 'orange';
      case AlertSeverity.WARNING:
        return 'yellow';
      case AlertSeverity.INFO:
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <div className="alerts-panel">
      <h3>Active Alerts ({alerts.length})</h3>
      <div className="alerts-list">
        {alerts.map((alert) => (
          <div key={alert.id} className={`alert alert-${getSeverityColor(alert.severity)}`}>
            <div className="alert-header">
              <span className="severity">{alert.severity.toUpperCase()}</span>
              <span className="title">{alert.title}</span>
              <span className="timestamp">{new Date(alert.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="alert-message">{alert.message}</div>
            {alert.relay && <div className="alert-relay">Relay: {alert.relay}</div>}
            <button className="acknowledge-btn" onClick={() => onAcknowledge(alert.id)}>
              Acknowledge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Connection Health Card
 */
const ConnectionHealthCard: React.FC<{
  health: any;
  relayHealth: any[];
  showDetails: boolean;
  compact: boolean;
}> = ({ health, relayHealth, showDetails, compact }) => (
  <div className="metric-card connection-health">
    <h3>Connection Health</h3>

    <div className="metric-summary">
      <MetricItem
        label="Connected Relays"
        value={`${health.connectedRelays}/${health.totalRelays}`}
        color={health.connectedRelays > 0 ? 'green' : 'red'}
      />
      <MetricItem
        label="Health Score"
        value={`${health.averageHealthScore.toFixed(0)}/100`}
        color={
          health.averageHealthScore > 80
            ? 'green'
            : health.averageHealthScore > 50
              ? 'yellow'
              : 'red'
        }
      />
      <MetricItem
        label="Avg Uptime"
        value={`${health.averageUptime.toFixed(1)}%`}
        color={health.averageUptime > 95 ? 'green' : 'yellow'}
      />
      <MetricItem
        label="Avg Latency"
        value={`${health.averageLatency.toFixed(0)}ms`}
        color={
          health.averageLatency < 500 ? 'green' : health.averageLatency < 1000 ? 'yellow' : 'red'
        }
      />
    </div>

    {showDetails && !compact && (
      <div className="relay-details">
        <h4>Relay Status</h4>
        {relayHealth.slice(0, 5).map((relay) => (
          <div key={relay.url} className="relay-item">
            <span className={`status-dot status-${relay.status}`}></span>
            <span className="relay-url">{relay.url}</span>
            <span className="relay-health">{relay.health}</span>
            <span className="relay-latency">{relay.latency.toFixed(0)}ms</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/**
 * Publishing Metrics Card
 */
const PublishingMetricsCard: React.FC<{
  metrics: any;
  showDetails: boolean;
  compact: boolean;
}> = ({ metrics, showDetails, compact }) => (
  <div className="metric-card publishing-metrics">
    <h3>Publishing Metrics</h3>

    <div className="metric-summary">
      <MetricItem label="Total Events" value={metrics.totalEvents.toString()} color="blue" />
      <MetricItem
        label="Success Rate"
        value={`${metrics.successRate.toFixed(1)}%`}
        color={metrics.successRate > 95 ? 'green' : metrics.successRate > 80 ? 'yellow' : 'red'}
      />
      <MetricItem
        label="Avg Latency"
        value={`${metrics.averageLatency.toFixed(0)}ms`}
        color={metrics.averageLatency < 500 ? 'green' : 'yellow'}
      />
      <MetricItem
        label="p95 Latency"
        value={`${metrics.p95Latency.toFixed(0)}ms`}
        color={metrics.p95Latency < 500 ? 'green' : metrics.p95Latency < 1000 ? 'yellow' : 'red'}
      />
    </div>

    {showDetails && !compact && metrics.perRelayMetrics.length > 0 && (
      <div className="relay-publish-stats">
        <h4>Per-Relay Stats</h4>
        {metrics.perRelayMetrics.slice(0, 3).map((relay: any) => (
          <div key={relay.relay} className="publish-stat">
            <span className="relay-name">{relay.relay}</span>
            <span className="success-rate">{relay.successRate.toFixed(0)}%</span>
            <span className="latency">{relay.p95Latency.toFixed(0)}ms</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/**
 * Subscription Metrics Card
 */
const SubscriptionMetricsCard: React.FC<{
  metrics: any;
  showDetails: boolean;
  compact: boolean;
}> = ({ metrics, showDetails, compact }) => (
  <div className="metric-card subscription-metrics">
    <h3>Subscription Metrics</h3>

    <div className="metric-summary">
      <MetricItem label="Active Subs" value={metrics.activeSubscriptions.toString()} color="blue" />
      <MetricItem
        label="Total Events"
        value={metrics.totalEventsReceived.toString()}
        color="blue"
      />
      <MetricItem
        label="Events/sec"
        value={metrics.averageEventsPerSecond.toFixed(2)}
        color="green"
      />
      <MetricItem
        label="Errors"
        value={metrics.totalErrors.toString()}
        color={metrics.totalErrors > 10 ? 'red' : metrics.totalErrors > 0 ? 'yellow' : 'green'}
      />
    </div>

    {showDetails && !compact && metrics.perSubscriptionMetrics.length > 0 && (
      <div className="subscription-list">
        <h4>Active Subscriptions</h4>
        {metrics.perSubscriptionMetrics.slice(0, 3).map((sub: any) => (
          <div key={sub.subscriptionId} className="subscription-item">
            <span className="sub-id">{sub.subscriptionId.slice(0, 12)}...</span>
            <span className="event-count">{sub.totalEvents} events</span>
            <span className="eps">{sub.eventsPerSecond.toFixed(2)}/s</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/**
 * Performance Metrics Card
 */
const PerformanceMetricsCard: React.FC<{
  metrics: any;
  showDetails: boolean;
  compact: boolean;
}> = ({ metrics, showDetails, compact }) => (
  <div className="metric-card performance-metrics">
    <h3>Performance Metrics</h3>

    <div className="metric-summary">
      <MetricItem
        label="Throughput"
        value={`${metrics.throughput.eventsPerSecond} ev/s`}
        color="blue"
      />
      <MetricItem label="p50 Latency" value={`${metrics.latency.p50.toFixed(0)}ms`} color="green" />
      <MetricItem
        label="p95 Latency"
        value={`${metrics.latency.p95.toFixed(0)}ms`}
        color={metrics.latency.p95 < 500 ? 'green' : metrics.latency.p95 < 1000 ? 'yellow' : 'red'}
      />
      <MetricItem
        label="p99 Latency"
        value={`${metrics.latency.p99.toFixed(0)}ms`}
        color={metrics.latency.p99 < 1000 ? 'green' : 'yellow'}
      />
    </div>

    {showDetails && !compact && (
      <div className="latency-percentiles">
        <h4>Latency Percentiles</h4>
        <LatencyBar label="p50" value={metrics.latency.p50} max={2000} />
        <LatencyBar label="p75" value={metrics.latency.p75} max={2000} />
        <LatencyBar label="p90" value={metrics.latency.p90} max={2000} />
        <LatencyBar label="p95" value={metrics.latency.p95} max={2000} />
        <LatencyBar label="p99" value={metrics.latency.p99} max={2000} />
      </div>
    )}
  </div>
);

/**
 * Memory Metrics Card
 */
const MemoryMetricsCard: React.FC<{
  metrics: any;
  compact: boolean;
}> = ({ metrics, compact }) => (
  <div className="metric-card memory-metrics">
    <h3>Memory Metrics</h3>

    <div className="metric-summary">
      <MetricItem label="Event Cache" value={metrics.eventCacheSize.toString()} color="blue" />
      <MetricItem label="Subscriptions" value={metrics.subscriptionCount.toString()} color="blue" />
      <MetricItem label="Seen Events" value={metrics.seenEventIdsCount.toString()} color="blue" />
    </div>
  </div>
);

/**
 * Metric Item Component
 */
const MetricItem: React.FC<{
  label: string;
  value: string;
  color: string;
}> = ({ label, value, color }) => (
  <div className="metric-item">
    <span className="metric-label">{label}</span>
    <span className={`metric-value color-${color}`}>{value}</span>
  </div>
);

/**
 * Latency Bar Component
 */
const LatencyBar: React.FC<{
  label: string;
  value: number;
  max: number;
}> = ({ label, value, max }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const color = value < 500 ? 'green' : value < 1000 ? 'yellow' : 'red';

  return (
    <div className="latency-bar">
      <span className="bar-label">{label}</span>
      <div className="bar-container">
        <div className={`bar-fill color-${color}`} style={{ width: `${percentage}%` }}></div>
      </div>
      <span className="bar-value">{value.toFixed(0)}ms</span>
    </div>
  );
};

// Export component
export default NostrMonitoringDashboard;
