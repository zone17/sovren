import React, { useCallback, useEffect, useState } from 'react';
import { getPerformanceReport } from '../monitoring/performance';

interface MetricDisplayProps {
  title: string;
  value: string | number;
  status: 'good' | 'needs-improvement' | 'poor';
  unit?: string;
  description?: string;
}

const MetricCard: React.FC<MetricDisplayProps> = ({ title, value, status, unit, description }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'needs-improvement':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'poor':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return (
          <svg
            className="w-5 h-5 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'needs-improvement':
        return (
          <svg
            className="w-5 h-5 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
      case 'poor':
        return (
          <svg
            className="w-5 h-5 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor(status)}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {getStatusIcon(status)}
      </div>
      <div className="flex items-baseline">
        <span className="text-2xl font-bold">
          {typeof value === 'number' ? value.toFixed(2) : value}
        </span>
        {unit && <span className="ml-1 text-sm">{unit}</span>}
      </div>
      {description && <p className="text-xs mt-1 opacity-75">{description}</p>}
    </div>
  );
};

interface PerformanceData {
  summary: {
    total: number;
    good: number;
    needsImprovement: number;
    poor: number;
    byType: Record<string, { count: number; avgValue: number; rating: string }>;
  };
  recentMetrics: Array<{
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    timestamp: number;
  }>;
  poorPerformance: Array<{
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    timestamp: number;
  }>;
  timestamp: string;
}

const MonitoringDashboard: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshInterval = 5000; // 5 seconds

  const refreshData = useCallback(() => {
    const report = getPerformanceReport();
    setPerformanceData(report);
  }, []);

  useEffect(() => {
    // Initial load
    refreshData();

    // Set up auto-refresh
    let intervalId: number;
    if (autoRefresh) {
      intervalId = window.setInterval(refreshData, refreshInterval);
    }

    // Listen for performance events
    const handlePerformanceMetric = () => {
      if (autoRefresh) {
        refreshData();
      }
    };

    window.addEventListener('performance-metric', handlePerformanceMetric);

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('performance-metric', handlePerformanceMetric);
    };
  }, [autoRefresh, refreshInterval, refreshData]);

  // Only show in development or when explicitly enabled
  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_MONITORING !== 'true') {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
        title="Toggle Monitoring Dashboard"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </button>

      {/* Dashboard Panel */}
      {isVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsVisible(false)}
        >
          <div
            className="fixed top-4 right-4 bottom-4 w-96 bg-white rounded-lg shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Performance Monitor</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`px-2 py-1 text-xs rounded ${
                    autoRefresh ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {autoRefresh ? 'Auto' : 'Manual'}
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {performanceData ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <MetricCard
                      title="Total Metrics"
                      value={performanceData.summary.total}
                      status="good"
                      description="Collected metrics"
                    />
                    <MetricCard
                      title="Performance Score"
                      value={Math.round(
                        (performanceData.summary.good / performanceData.summary.total) * 100
                      )}
                      status={
                        performanceData.summary.good / performanceData.summary.total > 0.8
                          ? 'good'
                          : performanceData.summary.good / performanceData.summary.total > 0.6
                            ? 'needs-improvement'
                            : 'poor'
                      }
                      unit="%"
                      description="Good metrics ratio"
                    />
                  </div>

                  {/* Core Web Vitals */}
                  {Object.entries(performanceData.summary.byType).filter(([name]) =>
                    ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].includes(name)
                  ).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Core Web Vitals</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(performanceData.summary.byType)
                          .filter(([name]) => ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].includes(name))
                          .map(([name, data]) => (
                            <MetricCard
                              key={name}
                              title={name}
                              value={data.avgValue}
                              status={data.rating as 'good' | 'needs-improvement' | 'poor'}
                              unit={name === 'CLS' ? '' : 'ms'}
                              description={`${data.count} samples`}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Metrics */}
                  {Object.entries(performanceData.summary.byType).filter(
                    ([name]) => !['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].includes(name)
                  ).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Custom Metrics</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(performanceData.summary.byType)
                          .filter(([name]) => !['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].includes(name))
                          .slice(0, 5) // Limit to 5 for space
                          .map(([name, data]) => (
                            <MetricCard
                              key={name}
                              title={name.replace(/_/g, ' ')}
                              value={data.avgValue}
                              status={data.rating as 'good' | 'needs-improvement' | 'poor'}
                              unit="ms"
                              description={`${data.count} samples`}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Poor Performance Alerts */}
                  {performanceData.poorPerformance.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-red-700 mb-3">
                        Performance Issues ({performanceData.poorPerformance.length})
                      </h3>
                      <div className="space-y-2">
                        {performanceData.poorPerformance.slice(0, 3).map((metric, index) => (
                          <div key={index} className="bg-red-50 border border-red-200 rounded p-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-red-800">
                                {metric.name.replace(/_/g, ' ')}
                              </span>
                              <span className="text-sm text-red-600">
                                {metric.value.toFixed(2)}ms
                              </span>
                            </div>
                            <div className="text-xs text-red-600">
                              {new Date(metric.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Activity */}
                  {performanceData.recentMetrics.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Activity</h3>
                      <div className="space-y-1">
                        {performanceData.recentMetrics.slice(0, 5).map((metric, index) => (
                          <div key={index} className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">{metric.name.replace(/_/g, ' ')}</span>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`
                                px-1 rounded text-xs
                                ${
                                  metric.rating === 'good'
                                    ? 'bg-green-100 text-green-800'
                                    : metric.rating === 'needs-improvement'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                }
                              `}
                              >
                                {metric.value.toFixed(1)}ms
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="mt-6 pt-4 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        Last updated: {new Date(performanceData.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={refreshData}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-500">Loading performance data...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MonitoringDashboard;
