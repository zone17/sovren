import { useCallback, useEffect, useState } from 'react';

import {
  AnalyticsDashboardConfig,
  AnalyticsEvent,
  AutomatedReport,
  ConversionFunnel,
  DataVisualization,
  DataWarehouseConnection,
  ErrorAnalytics,
  ErrorEvent,
  PerformanceAlertRule,
  PerformanceBaseline,
  PerformanceMetric,
  PredictiveAnalyticsModel,
  UserBehavior,
} from '../types/analytics-integration';

interface AnalyticsServiceHook {
  // Web Analytics (US-143)
  analytics: {
    trackEvent: (event: Partial<AnalyticsEvent>) => Promise<AnalyticsEvent>;
    createFunnel: (funnel: Partial<ConversionFunnel>) => Promise<ConversionFunnel>;
    trackUserBehavior: (behavior: Partial<UserBehavior>) => Promise<UserBehavior>;
    getDashboardConfig: (userId: string) => Promise<AnalyticsDashboardConfig>;
    exportData: (params: any) => Promise<string>;
    getTotalEvents: (timeRange: string) => Promise<number>;
    getActiveUsers: (timeRange: string) => Promise<number>;
    getConversionRate: (timeRange: string) => Promise<number>;
    validateTracking: () => Promise<any>;
  };

  // Business Intelligence (US-144)
  businessIntelligence: {
    createWarehouseConnection: (
      connection: Partial<DataWarehouseConnection>
    ) => Promise<DataWarehouseConnection>;
    createAutomatedReport: (report: Partial<AutomatedReport>) => Promise<AutomatedReport>;
    enableRealTimeDashboard: (dashboardId: string) => Promise<void>;
    createPredictiveModel: (
      model: Partial<PredictiveAnalyticsModel>
    ) => Promise<PredictiveAnalyticsModel>;
    createVisualization: (visualization: Partial<DataVisualization>) => Promise<DataVisualization>;
    getReports: () => Promise<AutomatedReport[]>;
    getModels: () => Promise<PredictiveAnalyticsModel[]>;
    validateBI: () => Promise<any>;
  };

  // Performance Monitoring (US-145)
  performance: {
    createAlert: (alert: Partial<PerformanceAlertRule>) => Promise<PerformanceAlertRule>;
    createBaseline: (baseline: Partial<PerformanceBaseline>) => Promise<PerformanceBaseline>;
    getOptimizationSuggestions: (serviceName: string) => Promise<any>;
    analyzeTrends: (serviceName: string, timeRange: any) => Promise<any>;
    getAverageResponseTime: (timeRange: string) => Promise<number>;
    getSystemHealth: () => Promise<number>;
    getMetrics: (serviceName: string) => Promise<PerformanceMetric[]>;
    validateMonitoring: () => Promise<any>;
  };

  // Error Tracking (US-146)
  errorTracking: {
    reportError: (error: Partial<ErrorEvent>) => Promise<ErrorEvent>;
    createErrorCategory: (category: any) => Promise<any>;
    createResolutionWorkflow: (errorId: string, steps: any[]) => Promise<any>;
    getErrorAnalytics: (timeRange: any) => Promise<ErrorAnalytics>;
    getErrorRate: (timeRange: string) => Promise<number>;
    getTopErrors: (timeRange: string) => Promise<ErrorEvent[]>;
    validateErrorTracking: () => Promise<any>;
  };

  // Common state
  loading: boolean;
  error: string | null;
  isInitialized: boolean;
}

/**
 * Analytics Service Hook
 *
 * Comprehensive React hook implementing:
 * - US-143: Web Analytics Integration
 * - US-144: Business Intelligence Tools
 * - US-145: Performance Monitoring
 * - US-146: Error Tracking Integration
 */
export const useAnalyticsService = (userId: string): AnalyticsServiceHook => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // API base URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  // Generic API request handler
  const apiRequest = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            ...options.headers,
          },
          ...options,
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        console.error(`API request error for ${endpoint}:`, err);
        throw err;
      }
    },
    [API_BASE]
  );

  // ==========================================
  // US-143: Web Analytics Integration
  // ==========================================

  const trackEvent = useCallback(
    async (event: Partial<AnalyticsEvent>): Promise<AnalyticsEvent> => {
      setLoading(true);
      setError(null);

      try {
        const sessionId = localStorage.getItem('session_id') || 'anonymous';
        const response = await apiRequest('/analytics/events', {
          method: 'POST',
          body: JSON.stringify({
            ...event,
            user_id: userId,
            session_id: sessionId,
            timestamp: new Date().toISOString(),
          }),
        });

        return response.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to track event';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId, apiRequest]
  );

  const createFunnel = useCallback(
    async (funnel: Partial<ConversionFunnel>): Promise<ConversionFunnel> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/analytics/funnels', {
          method: 'POST',
          body: JSON.stringify(funnel),
        });

        return response.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create funnel';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const trackUserBehavior = useCallback(
    async (behavior: Partial<UserBehavior>): Promise<UserBehavior> => {
      setLoading(true);
      setError(null);

      try {
        const sessionId = localStorage.getItem('session_id') || 'anonymous';
        const response = await apiRequest('/analytics/behavior', {
          method: 'POST',
          body: JSON.stringify({
            ...behavior,
            user_id: userId,
            session_id: sessionId,
          }),
        });

        return response.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to track behavior';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId, apiRequest]
  );

  const getDashboardConfig = useCallback(
    async (userId: string): Promise<AnalyticsDashboardConfig> => {
      try {
        const response = await apiRequest(`/analytics/dashboards/${userId}`);
        return response.data;
      } catch (err) {
        console.warn('No dashboard config found, using defaults');

        // Return default dashboard configuration
        return {
          id: 'default',
          name: 'Default Dashboard',
          user_id: userId,
          widgets: [],
          date_range: {
            start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end_date: new Date(),
          },
          auto_refresh: true,
          refresh_interval: 300000,
        };
      }
    },
    [apiRequest]
  );

  const exportData = useCallback(
    async (params: any): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/analytics/export', {
          method: 'POST',
          body: JSON.stringify(params),
        });

        return response.data.url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to export data';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const getTotalEvents = useCallback(
    async (timeRange: string): Promise<number> => {
      try {
        const response = await apiRequest(`/analytics/metrics/events?range=${timeRange}`);
        return response.data.total;
      } catch (err) {
        console.error('Failed to get total events:', err);
        return 0;
      }
    },
    [apiRequest]
  );

  const getActiveUsers = useCallback(
    async (timeRange: string): Promise<number> => {
      try {
        const response = await apiRequest(`/analytics/metrics/users?range=${timeRange}`);
        return response.data.active;
      } catch (err) {
        console.error('Failed to get active users:', err);
        return 0;
      }
    },
    [apiRequest]
  );

  const getConversionRate = useCallback(
    async (timeRange: string): Promise<number> => {
      try {
        const response = await apiRequest(`/analytics/metrics/conversion?range=${timeRange}`);
        return response.data.rate;
      } catch (err) {
        console.error('Failed to get conversion rate:', err);
        return 0;
      }
    },
    [apiRequest]
  );

  const validateTracking = useCallback(async (): Promise<any> => {
    try {
      const response = await apiRequest('/analytics/validate');
      return response.data;
    } catch (err) {
      console.error('Failed to validate tracking:', err);
      return { accuracy_score: 0, validation_results: {} };
    }
  }, [apiRequest]);

  // ==========================================
  // US-144: Business Intelligence Tools
  // ==========================================

  const createWarehouseConnection = useCallback(
    async (connection: Partial<DataWarehouseConnection>): Promise<DataWarehouseConnection> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/bi/warehouse-connections', {
          method: 'POST',
          body: JSON.stringify(connection),
        });

        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create warehouse connection';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const createAutomatedReport = useCallback(
    async (report: Partial<AutomatedReport>): Promise<AutomatedReport> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/bi/reports', {
          method: 'POST',
          body: JSON.stringify(report),
        });

        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create automated report';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const enableRealTimeDashboard = useCallback(
    async (dashboardId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await apiRequest(`/bi/dashboards/${dashboardId}/realtime`, {
          method: 'POST',
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to enable real-time dashboard';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const createPredictiveModel = useCallback(
    async (model: Partial<PredictiveAnalyticsModel>): Promise<PredictiveAnalyticsModel> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/bi/predictive-models', {
          method: 'POST',
          body: JSON.stringify(model),
        });

        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create predictive model';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const createVisualization = useCallback(
    async (visualization: Partial<DataVisualization>): Promise<DataVisualization> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/bi/visualizations', {
          method: 'POST',
          body: JSON.stringify(visualization),
        });

        return response.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create visualization';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const getReports = useCallback(async (): Promise<AutomatedReport[]> => {
    try {
      const response = await apiRequest('/bi/reports');
      return response.data;
    } catch (err) {
      console.error('Failed to get reports:', err);
      return [];
    }
  }, [apiRequest]);

  const getModels = useCallback(async (): Promise<PredictiveAnalyticsModel[]> => {
    try {
      const response = await apiRequest('/bi/predictive-models');
      return response.data;
    } catch (err) {
      console.error('Failed to get models:', err);
      return [];
    }
  }, [apiRequest]);

  const validateBI = useCallback(async (): Promise<any> => {
    try {
      const response = await apiRequest('/bi/validate');
      return response.data;
    } catch (err) {
      console.error('Failed to validate BI:', err);
      return { connection_health: {}, query_performance: {}, data_accuracy: 0 };
    }
  }, [apiRequest]);

  // ==========================================
  // US-145: Performance Monitoring
  // ==========================================

  const createAlert = useCallback(
    async (alert: Partial<PerformanceAlertRule>): Promise<PerformanceAlertRule> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/performance/alerts', {
          method: 'POST',
          body: JSON.stringify(alert),
        });

        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create performance alert';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const createBaseline = useCallback(
    async (baseline: Partial<PerformanceBaseline>): Promise<PerformanceBaseline> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/performance/baselines', {
          method: 'POST',
          body: JSON.stringify(baseline),
        });

        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create performance baseline';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const getOptimizationSuggestions = useCallback(
    async (serviceName: string): Promise<any> => {
      try {
        const response = await apiRequest(`/performance/suggestions/${serviceName}`);
        return response.data;
      } catch (err) {
        console.error('Failed to get optimization suggestions:', err);
        return { suggestions: [] };
      }
    },
    [apiRequest]
  );

  const analyzeTrends = useCallback(
    async (serviceName: string, timeRange: any): Promise<any> => {
      try {
        const response = await apiRequest(`/performance/trends/${serviceName}`, {
          method: 'POST',
          body: JSON.stringify({ timeRange }),
        });
        return response.data;
      } catch (err) {
        console.error('Failed to analyze trends:', err);
        return { trends: {}, anomalies: [] };
      }
    },
    [apiRequest]
  );

  const getAverageResponseTime = useCallback(
    async (timeRange: string): Promise<number> => {
      try {
        const response = await apiRequest(`/performance/metrics/response-time?range=${timeRange}`);
        return response.data.average;
      } catch (err) {
        console.error('Failed to get average response time:', err);
        return 0;
      }
    },
    [apiRequest]
  );

  const getSystemHealth = useCallback(async (): Promise<number> => {
    try {
      const response = await apiRequest('/performance/health');
      return response.data.score;
    } catch (err) {
      console.error('Failed to get system health:', err);
      return 0;
    }
  }, [apiRequest]);

  const getMetrics = useCallback(
    async (serviceName: string): Promise<PerformanceMetric[]> => {
      try {
        const response = await apiRequest(`/performance/metrics/${serviceName}`);
        return response.data;
      } catch (err) {
        console.error('Failed to get metrics:', err);
        return [];
      }
    },
    [apiRequest]
  );

  const validateMonitoring = useCallback(async (): Promise<any> => {
    try {
      const response = await apiRequest('/performance/validate');
      return response.data;
    } catch (err) {
      console.error('Failed to validate monitoring:', err);
      return { metric_accuracy: 0, alert_reliability: 0, baseline_stability: 0 };
    }
  }, [apiRequest]);

  // ==========================================
  // US-146: Error Tracking Integration
  // ==========================================

  const reportError = useCallback(
    async (error: Partial<ErrorEvent>): Promise<ErrorEvent> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/errors/report', {
          method: 'POST',
          body: JSON.stringify({
            ...error,
            user_context: {
              user_id: userId,
              ...error.user_context,
            },
          }),
        });

        return response.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to report error';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId, apiRequest]
  );

  const createErrorCategory = useCallback(
    async (category: any): Promise<any> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/errors/categories', {
          method: 'POST',
          body: JSON.stringify(category),
        });

        return response.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create error category';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const createResolutionWorkflow = useCallback(
    async (errorId: string, steps: any[]): Promise<any> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest('/errors/workflows', {
          method: 'POST',
          body: JSON.stringify({ errorId, steps }),
        });

        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create resolution workflow';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const getErrorAnalytics = useCallback(
    async (timeRange: any): Promise<ErrorAnalytics> => {
      try {
        const response = await apiRequest('/errors/analytics', {
          method: 'POST',
          body: JSON.stringify({ timeRange }),
        });
        return response.data;
      } catch (err) {
        console.error('Failed to get error analytics:', err);
        return {
          time_period: timeRange,
          total_errors: 0,
          new_errors: 0,
          resolved_errors: 0,
          error_rate: 0,
          mean_time_to_resolution: 0,
          top_errors: [],
          error_trends: [],
          resolution_metrics: {
            average_resolution_time: 0,
            resolution_rate: 0,
            escalation_rate: 0,
          },
        };
      }
    },
    [apiRequest]
  );

  const getErrorRate = useCallback(
    async (timeRange: string): Promise<number> => {
      try {
        const response = await apiRequest(`/errors/metrics/rate?range=${timeRange}`);
        return response.data.rate;
      } catch (err) {
        console.error('Failed to get error rate:', err);
        return 0;
      }
    },
    [apiRequest]
  );

  const getTopErrors = useCallback(
    async (timeRange: string): Promise<ErrorEvent[]> => {
      try {
        const response = await apiRequest(`/errors/top?range=${timeRange}`);
        return response.data;
      } catch (err) {
        console.error('Failed to get top errors:', err);
        return [];
      }
    },
    [apiRequest]
  );

  const validateErrorTracking = useCallback(async (): Promise<any> => {
    try {
      const response = await apiRequest('/errors/validate');
      return response.data;
    } catch (err) {
      console.error('Failed to validate error tracking:', err);
      return {
        detection_accuracy: 0,
        categorization_accuracy: 0,
        resolution_efficiency: 0,
        false_positive_rate: 0,
      };
    }
  }, [apiRequest]);

  // ==========================================
  // Initialization
  // ==========================================

  useEffect(() => {
    const initializeAnalytics = async () => {
      setLoading(true);
      setError(null);

      try {
        // Initialize analytics architecture
        await apiRequest('/analytics/initialize', { method: 'POST' });

        // Initialize BI architecture
        await apiRequest('/bi/initialize', { method: 'POST' });

        // Initialize performance monitoring
        await apiRequest('/performance/initialize', { method: 'POST' });

        // Initialize error tracking
        await apiRequest('/errors/initialize', { method: 'POST' });

        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize analytics:', err);
        setError('Failed to initialize analytics systems');
      } finally {
        setLoading(false);
      }
    };

    if (userId && !isInitialized) {
      initializeAnalytics();
    }
  }, [userId, isInitialized, apiRequest]);

  // Auto-track page views
  useEffect(() => {
    if (isInitialized && userId) {
      const trackPageView = async () => {
        try {
          await trackEvent({
            event_name: 'page_view',
            event_category: 'navigation',
            event_action: 'view',
            page_url: window.location.pathname,
            referrer: document.referrer,
          });
        } catch (err) {
          console.warn('Failed to track page view:', err);
        }
      };

      trackPageView();

      // Track page views on navigation
      const handlePopState = () => trackPageView();
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isInitialized, userId, trackEvent]);

  // Auto-report JavaScript errors
  useEffect(() => {
    if (isInitialized && userId) {
      const handleError = async (event: ErrorEvent) => {
        try {
          await reportError({
            title: event.error?.name || 'JavaScript Error',
            message: event.message,
            stack_trace: event.error?.stack,
            error_type: 'javascript',
            severity: 'medium',
            request_context: {
              url: window.location.href,
              user_agent: navigator.userAgent,
            },
            system_context: {
              browser: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
            },
          });
        } catch (err) {
          console.warn('Failed to report error:', err);
        }
      };

      const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
        try {
          await reportError({
            title: 'Unhandled Promise Rejection',
            message: event.reason?.message || 'Promise rejected',
            stack_trace: event.reason?.stack,
            error_type: 'promise_rejection',
            severity: 'medium',
            request_context: {
              url: window.location.href,
              user_agent: navigator.userAgent,
            },
          });
        } catch (err) {
          console.warn('Failed to report promise rejection:', err);
        }
      };

      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, [isInitialized, userId, reportError]);

  return {
    analytics: {
      trackEvent,
      createFunnel,
      trackUserBehavior,
      getDashboardConfig,
      exportData,
      getTotalEvents,
      getActiveUsers,
      getConversionRate,
      validateTracking,
    },
    businessIntelligence: {
      createWarehouseConnection,
      createAutomatedReport,
      enableRealTimeDashboard,
      createPredictiveModel,
      createVisualization,
      getReports,
      getModels,
      validateBI,
    },
    performance: {
      createAlert,
      createBaseline,
      getOptimizationSuggestions,
      analyzeTrends,
      getAverageResponseTime,
      getSystemHealth,
      getMetrics,
      validateMonitoring,
    },
    errorTracking: {
      reportError,
      createErrorCategory,
      createResolutionWorkflow,
      getErrorAnalytics,
      getErrorRate,
      getTopErrors,
      validateErrorTracking,
    },
    loading,
    error,
    isInitialized,
  };
};
