/**
 * 📊 **DASHBOARD FEATURE TYPE DEFINITIONS**
 *
 * Elite Engineering Standards:
 * - Real-time monitoring and visualization
 * - Performance tracking and health metrics
 * - Alert management and notification systems
 * - Advanced dashboard customization and layouts
 */

import type {
  AnalyticsMetric,
  DashboardMetrics,
  PerformanceMetric,
  UserBehaviorPrediction,
} from '../../analytics/types';

// 🖥️ **DASHBOARD LAYOUT TYPES**
export type DashboardLayout = 'grid' | 'list' | 'cards' | 'timeline';
export type WidgetSize = 'small' | 'medium' | 'large' | 'full';
export type WidgetType =
  | 'metric'
  | 'chart'
  | 'table'
  | 'alert'
  | 'prediction'
  | 'recommendation'
  | 'performance'
  | 'user-behavior';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: WidgetConfig;
  visible: boolean;
  refreshInterval?: number;
  lastUpdated?: string;
}

export interface WidgetConfig {
  metric?: PerformanceMetric | string;
  timeRange?: string;
  filters?: Record<string, unknown>;
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  thresholds?: {
    warning: number;
    critical: number;
  };
  displayOptions?: {
    showTrend: boolean;
    showComparison: boolean;
    showTargets: boolean;
  };
}

// 📈 **MONITORING TYPES**
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';
export type MonitoringCategory =
  | 'performance'
  | 'security'
  | 'business'
  | 'infrastructure'
  | 'user-experience';

export interface HealthCheck {
  id: string;
  name: string;
  category: MonitoringCategory;
  status: HealthStatus;
  value: number;
  unit?: string;
  threshold: {
    warning: number;
    critical: number;
  };
  message: string;
  lastChecked: string;
  trend?: 'up' | 'down' | 'stable';
  metadata?: Record<string, unknown>;
}

export interface SystemHealth {
  overall_status: HealthStatus;
  score: number;
  checks: HealthCheck[];
  summary: {
    healthy: number;
    warning: number;
    critical: number;
    unknown: number;
  };
  lastUpdated: string;
}

// 🚨 **ALERT MANAGEMENT**
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'suppressed';
export type AlertCategory = 'performance' | 'error' | 'security' | 'business' | 'user-behavior';

export interface Alert {
  id: string;
  title: string;
  description: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  value?: number;
  threshold?: number;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  tags: string[];
  actions?: AlertAction[];
  metadata?: Record<string, unknown>;
}

export interface AlertAction {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'auto-resolve';
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne' | 'contains';
  threshold: number;
  duration: number; // seconds
  severity: AlertSeverity;
  enabled: boolean;
  actions: AlertAction[];
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}

// 📊 **REAL-TIME DATA TYPES**
export interface RealtimeData {
  metrics: AnalyticsMetric[];
  predictions: UserBehaviorPrediction[];
  alerts: Alert[];
  health: SystemHealth;
  timestamp: string;
}

export interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface TimeSeries {
  name: string;
  data: DataPoint[];
  unit?: string;
  color?: string;
}

// 🎯 **DASHBOARD STATE**
export interface DashboardState {
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  metrics: DashboardMetrics;
  alerts: Alert[];
  health: SystemHealth;
  realtimeData: RealtimeData | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;

  // Configuration
  refreshInterval: number;
  autoRefresh: boolean;
  theme: 'light' | 'dark' | 'auto';
}

// 🔧 **DASHBOARD CONFIGURATION**
export interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  settings: {
    refreshInterval: number;
    autoRefresh: boolean;
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
  };
  permissions: {
    canEdit: boolean;
    canShare: boolean;
    canDelete: boolean;
  };
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  sharedWith?: string[];
}

// 🎨 **COMPONENT PROPS**
export interface AIDashboardProps {
  config?: Partial<DashboardConfig>;
  height?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onMetricClick?: (metric: AnalyticsMetric) => void;
  onAlertClick?: (alert: Alert) => void;
  showFilters?: boolean;
  compact?: boolean;
}

export interface MonitoringDashboardProps {
  showSystemHealth?: boolean;
  showAlerts?: boolean;
  showMetrics?: boolean;
  compactView?: boolean;
  refreshInterval?: number;
  onHealthCheckClick?: (check: HealthCheck) => void;
  onAlertClick?: (alert: Alert) => void;
}

export interface WidgetProps {
  widget: DashboardWidget;
  data: unknown;
  onConfigChange?: (config: WidgetConfig) => void;
  onResize?: (size: WidgetSize) => void;
  onRemove?: () => void;
  isEditing?: boolean;
}

// 🔄 **SERVICE INTERFACES**
export interface DashboardServiceInterface {
  // Dashboard Management
  getDashboard: (id: string) => Promise<DashboardConfig>;
  updateDashboard: (id: string, config: Partial<DashboardConfig>) => Promise<boolean>;
  createDashboard: (
    config: Omit<DashboardConfig, 'id' | 'createdAt' | 'createdBy'>
  ) => Promise<string>;
  deleteDashboard: (id: string) => Promise<boolean>;

  // Data Fetching
  getRealtimeData: () => Promise<RealtimeData>;
  getMetrics: (timeRange?: string) => Promise<AnalyticsMetric[]>;
  getSystemHealth: () => Promise<SystemHealth>;
  getAlerts: (status?: AlertStatus) => Promise<Alert[]>;

  // Configuration
  updateWidgetConfig: (widgetId: string, config: WidgetConfig) => Promise<boolean>;
  addWidget: (widget: Omit<DashboardWidget, 'id'>) => Promise<string>;
  removeWidget: (widgetId: string) => Promise<boolean>;
}

// 🎯 **EXPORT UTILITY TYPES**
export type DashboardTheme = 'light' | 'dark' | 'auto';
export type MetricTrend = 'up' | 'down' | 'stable';
export type ChartData = TimeSeries[];

export interface DashboardFilters {
  timeRange?: string;
  category?: MonitoringCategory;
  severity?: AlertSeverity;
  status?: AlertStatus;
}
