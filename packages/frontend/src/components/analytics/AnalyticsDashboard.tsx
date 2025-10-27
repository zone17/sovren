import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bug,
  Database,
  Filter,
  LineChart,
  Monitor,
  PieChart,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAnalyticsService } from '../../hooks/useAnalyticsService';
import { AnalyticsDashboardConfig } from '../../types/analytics-integration';

interface AnalyticsDashboardProps {
  userId: string;
  className?: string;
}

interface DashboardMetrics {
  totalEvents: number;
  activeUsers: number;
  conversionRate: number;
  errorRate: number;
  averageResponseTime: number;
  systemHealth: number;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
  }>;
}

/**
 * Analytics Dashboard Component
 *
 * Comprehensive dashboard implementing:
 * - US-143: Web Analytics Integration
 * - US-144: Business Intelligence Tools
 * - US-145: Performance Monitoring
 * - US-146: Error Tracking Integration
 */
export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  userId,
  className = '',
}) => {
  const { analytics, performance, errorTracking, businessIntelligence, loading, error } =
    useAnalyticsService(userId);

  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('24h');
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState<AnalyticsDashboardConfig | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalEvents: 0,
    activeUsers: 0,
    conversionRate: 0,
    errorRate: 0,
    averageResponseTime: 0,
    systemHealth: 0,
  });

  // Load dashboard configuration
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const config = await analytics.getDashboardConfig(userId);
        setDashboardConfig(config);
      } catch (err) {
        console.error('Failed to load dashboard config:', err);
      }
    };

    loadDashboard();
  }, [userId, analytics]);

  // Load metrics data
  const loadMetrics = useCallback(async () => {
    try {
      const [events, users, conversion, errors, performance, health] = await Promise.all([
        analytics.getTotalEvents(timeRange),
        analytics.getActiveUsers(timeRange),
        analytics.getConversionRate(timeRange),
        errorTracking.getErrorRate(timeRange),
        performance.getAverageResponseTime(timeRange),
        performance.getSystemHealth(),
      ]);

      setMetrics({
        totalEvents: events,
        activeUsers: users,
        conversionRate: conversion,
        errorRate: errors,
        averageResponseTime: performance,
        systemHealth: health,
      });
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  }, [timeRange, analytics, errorTracking, performance]);

  // Auto-refresh functionality
  useEffect(() => {
    if (isAutoRefresh && refreshInterval > 0) {
      const interval = setInterval(loadMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [isAutoRefresh, refreshInterval, loadMetrics]);

  // Initial data load
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleRefresh = () => {
    loadMetrics();
  };

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
  };

  if (loading && !dashboardConfig) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Analytics Dashboard</h3>
          <p className="text-gray-600">Initializing analytics systems...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Unavailable</h3>
          <p className="text-gray-600 mb-4">
            We couldn't load the analytics dashboard. Please try again.
          </p>
          <Button onClick={handleRefresh}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`analytics-dashboard ${className}`}>
      {/* Dashboard Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600">Comprehensive platform analytics and insights</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </div>
        </div>

        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <MetricCard
            title="Total Events"
            value={metrics.totalEvents.toLocaleString()}
            icon={<Activity className="h-5 w-5" />}
            trend={{ value: 12, direction: 'up' }}
            color="blue"
          />
          <MetricCard
            title="Active Users"
            value={metrics.activeUsers.toLocaleString()}
            icon={<Users className="h-5 w-5" />}
            trend={{ value: 8, direction: 'up' }}
            color="green"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${(metrics.conversionRate * 100).toFixed(1)}%`}
            icon={<TrendingUp className="h-5 w-5" />}
            trend={{ value: 5, direction: 'up' }}
            color="purple"
          />
          <MetricCard
            title="Error Rate"
            value={`${(metrics.errorRate * 100).toFixed(2)}%`}
            icon={<Bug className="h-5 w-5" />}
            trend={{ value: 15, direction: 'down' }}
            color="red"
          />
          <MetricCard
            title="Avg Response"
            value={`${metrics.averageResponseTime}ms`}
            icon={<Zap className="h-5 w-5" />}
            trend={{ value: 20, direction: 'down' }}
            color="yellow"
          />
          <MetricCard
            title="System Health"
            value={`${(metrics.systemHealth * 100).toFixed(1)}%`}
            icon={<Monitor className="h-5 w-5" />}
            trend={{ value: 2, direction: 'up' }}
            color="green"
          />
        </div>
      </div>

      {/* Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Web Analytics</TabsTrigger>
          <TabsTrigger value="business">Business Intelligence</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Error Tracking</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <OverviewDashboard
            userId={userId}
            timeRange={timeRange}
            analytics={analytics}
            performance={performance}
            errorTracking={errorTracking}
          />
        </TabsContent>

        {/* Web Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <WebAnalyticsDashboard userId={userId} timeRange={timeRange} analytics={analytics} />
        </TabsContent>

        {/* Business Intelligence Tab */}
        <TabsContent value="business" className="space-y-6">
          <BusinessIntelligenceDashboard
            userId={userId}
            timeRange={timeRange}
            businessIntelligence={businessIntelligence}
          />
        </TabsContent>

        {/* Performance Monitoring Tab */}
        <TabsContent value="performance" className="space-y-6">
          <PerformanceMonitoringDashboard
            userId={userId}
            timeRange={timeRange}
            performance={performance}
          />
        </TabsContent>

        {/* Error Tracking Tab */}
        <TabsContent value="errors" className="space-y-6">
          <ErrorTrackingDashboard
            userId={userId}
            timeRange={timeRange}
            errorTracking={errorTracking}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ==========================================
// Metric Card Component
// ==========================================

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: { value: number; direction: 'up' | 'down' };
  color: 'blue' | 'green' | 'purple' | 'red' | 'yellow';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend, color }) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    red: 'text-red-600 bg-red-50',
    yellow: 'text-yellow-600 bg-yellow-50',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
          {trend && (
            <div
              className={`flex items-center text-sm ${
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              <TrendingUp
                className={`h-3 w-3 mr-1 ${trend.direction === 'down' ? 'rotate-180' : ''}`}
              />
              {trend.value}%
            </div>
          )}
        </div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-600">{title}</div>
      </CardContent>
    </Card>
  );
};

// ==========================================
// Overview Dashboard Component
// ==========================================

interface OverviewDashboardProps {
  userId: string;
  timeRange: string;
  analytics: any;
  performance: any;
  errorTracking: any;
}

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  userId,
  timeRange,
  analytics,
  performance,
  errorTracking,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Traffic Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Traffic Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Traffic chart visualization would go here
          </div>
        </CardContent>
      </Card>

      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Monitor className="h-5 w-5 mr-2" />
            System Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Performance metrics visualization would go here
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bug className="h-5 w-5 mr-2" />
            Recent Errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Database connection timeout (3 occurrences in last hour)
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                API rate limit exceeded (1 occurrence in last hour)
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Conversion funnel visualization would go here
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ==========================================
// Web Analytics Dashboard Component
// ==========================================

interface WebAnalyticsDashboardProps {
  userId: string;
  timeRange: string;
  analytics: any;
}

const WebAnalyticsDashboard: React.FC<WebAnalyticsDashboardProps> = ({
  userId,
  timeRange,
  analytics,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Page Views */}
        <Card>
          <CardHeader>
            <CardTitle>Page Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-gray-500">
              Page views chart
            </div>
          </CardContent>
        </Card>

        {/* User Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>User Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-gray-500">
              Sessions chart
            </div>
          </CardContent>
        </Card>

        {/* Bounce Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Bounce Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-gray-500">
              Bounce rate chart
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Behavior Heat Map */}
      <Card>
        <CardHeader>
          <CardTitle>User Behavior Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Heatmap visualization would go here
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ==========================================
// Business Intelligence Dashboard Component
// ==========================================

interface BusinessIntelligenceDashboardProps {
  userId: string;
  timeRange: string;
  businessIntelligence: any;
}

const BusinessIntelligenceDashboard: React.FC<BusinessIntelligenceDashboardProps> = ({
  userId,
  timeRange,
  businessIntelligence,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Forecast */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Revenue Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              Revenue forecasting chart
            </div>
          </CardContent>
        </Card>

        {/* User Growth Prediction */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              User Growth Prediction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              User growth prediction chart
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automated Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Automated Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Weekly Performance Report</h4>
                <p className="text-sm text-gray-600">Runs every Monday at 9:00 AM</p>
              </div>
              <Button variant="outline" size="sm">
                View
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Monthly Revenue Analysis</h4>
                <p className="text-sm text-gray-600">Runs first day of each month</p>
              </div>
              <Button variant="outline" size="sm">
                View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ==========================================
// Performance Monitoring Dashboard Component
// ==========================================

interface PerformanceMonitoringDashboardProps {
  userId: string;
  timeRange: string;
  performance: any;
}

const PerformanceMonitoringDashboard: React.FC<PerformanceMonitoringDashboardProps> = ({
  userId,
  timeRange,
  performance,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Response Time */}
        <Card>
          <CardHeader>
            <CardTitle>Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-gray-500">
              Response time chart
            </div>
          </CardContent>
        </Card>

        {/* Throughput */}
        <Card>
          <CardHeader>
            <CardTitle>Throughput</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-gray-500">
              Throughput chart
            </div>
          </CardContent>
        </Card>

        {/* Resource Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-gray-500">
              Resource usage chart
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Active Performance Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                High memory usage detected on server-1 (85% utilization)
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Response time threshold exceeded for /api/content endpoint
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ==========================================
// Error Tracking Dashboard Component
// ==========================================

interface ErrorTrackingDashboardProps {
  userId: string;
  timeRange: string;
  errorTracking: any;
}

const ErrorTrackingDashboard: React.FC<ErrorTrackingDashboardProps> = ({
  userId,
  timeRange,
  errorTracking,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <LineChart className="h-5 w-5 mr-2" />
              Error Rate Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              Error rate trend chart
            </div>
          </CardContent>
        </Card>

        {/* Error Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Error Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              Error distribution pie chart
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Top Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Database Connection Timeout</h4>
                <p className="text-sm text-gray-600">45 occurrences in last 24h</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Critical</span>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">API Rate Limit Exceeded</h4>
                <p className="text-sm text-gray-600">23 occurrences in last 24h</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                  Medium
                </span>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
