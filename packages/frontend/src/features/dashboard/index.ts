/**
 * 📊 **DASHBOARD FEATURE MODULE EXPORTS**
 *
 * Elite Engineering Standards:
 * - Real-time monitoring and visualization dashboards
 * - Advanced analytics and performance tracking
 * - Alert management and health monitoring systems
 * - Customizable dashboard layouts and widgets
 */

// 📊 **DASHBOARD COMPONENTS**
export { default as AIDashboard } from './components/AIDashboard';
export { default as MonitoringDashboard } from './components/MonitoringDashboard';

// 🎯 **DASHBOARD TYPES** - Comprehensive Dashboard & Monitoring Library!
export type {
  // Dashboard Layout & Widgets
  AIDashboardProps,
  Alert,
  AlertAction,
  AlertCategory,
  AlertRule,
  AlertSeverity,
  AlertStatus,

  // Chart & Data Visualization
  ChartData,
  DashboardConfig,
  DashboardFilters,
  DashboardLayout,
  DashboardServiceInterface,
  DashboardState,
  DashboardTheme,

  // Real-time Data
  DataPoint,
  HealthCheck,
  HealthStatus,
  MetricTrend,
  MonitoringCategory,
  MonitoringDashboardProps,

  // System Health & Monitoring
  RealtimeData,
  SystemHealth,
  TimeSeries,

  // Widget Management
  WidgetConfig,
  WidgetProps,
  WidgetSize,
  WidgetType,
} from './types';

// 🔧 **DASHBOARD HOOKS** (when created)
// export { useDashboard, useRealtimeData, useHealthMonitoring } from './hooks';

// 📦 **DASHBOARD STORES** (when created)
// export { dashboardStore, useDashboardStore } from './stores';

// 🛠️ **DASHBOARD SERVICES** (when created)
// export { dashboardService, healthMonitor, alertManager } from './services';
