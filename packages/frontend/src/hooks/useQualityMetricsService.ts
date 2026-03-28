import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BugMetric,
  CodeQualityMetric,
  CoverageMetric,
  PerformanceBenchmark,
  QualityMetricsConfig,
  QualityMetricsDashboard,
} from '../../../shared/src/types/quality-metrics';

/**
 * Custom Hook for Quality Metrics Service Integration
 * Supports US-159 through US-162 implementations
 */

interface UseQualityMetricsServiceOptions {
  realTimeUpdates?: boolean;
  refreshInterval?: number;
  enableCaching?: boolean;
  aiInsights?: boolean;
  autoOptimize?: boolean;
}

interface UseQualityMetricsServiceReturn {
  // Data
  dashboard: QualityMetricsDashboard | null;
  coverage: CoverageMetric | null;
  quality: CodeQualityMetric | null;
  bugs: BugMetric | null;
  performance: PerformanceBenchmark | null;

  // State
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  lastUpdate: Date | null;

  // Actions
  refreshDashboard: () => Promise<void>;
  refreshCoverage: () => Promise<void>;
  refreshQuality: () => Promise<void>;
  refreshBugs: () => Promise<void>;
  refreshPerformance: () => Promise<void>;

  // Configuration
  updateConfiguration: (config: Partial<QualityMetricsConfig>) => Promise<void>;

  // Export and Reporting
  exportReport: (format: 'json' | 'pdf' | 'csv' | 'html') => Promise<void>;
  generateInsights: () => Promise<any[]>;

  // AI Features
  optimizeThresholds: () => Promise<void>;
  getAIRecommendations: () => Promise<any[]>;

  // Real-time Features
  subscribeToUpdates: () => void;
  unsubscribeFromUpdates: () => void;
}

export const useQualityMetricsService = (
  projectId: string,
  options: UseQualityMetricsServiceOptions = {}
): UseQualityMetricsServiceReturn => {
  const {
    realTimeUpdates = true,
    refreshInterval = 30000, // 30 seconds
    enableCaching = true,
    aiInsights = true,
    autoOptimize = false,
  } = options;

  // State Management
  const [dashboard, setDashboard] = useState<QualityMetricsDashboard | null>(null);
  const [coverage, setCoverage] = useState<CoverageMetric | null>(null);
  const [quality, setQuality] = useState<CodeQualityMetric | null>(null);
  const [bugs, setBugs] = useState<BugMetric | null>(null);
  const [performance, setPerformance] = useState<PerformanceBenchmark | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Refs for cleanup and management
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // API Configuration
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

  /**
   * US-159: Coverage Tracking Functions
   */
  const fetchCoverage = useCallback(async (): Promise<CoverageMetric> => {
    const cacheKey = `coverage_${projectId}`;

    if (enableCaching) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) {
        // 5 minutes cache
        return cached.data;
      }
    }

    const response = await fetch(`${apiBaseUrl}/api/quality-metrics/coverage/${projectId}`, {
      method: 'GET',
      credentials: 'include' as RequestCredentials,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch coverage: ${response.statusText}`);
    }

    const data = await response.json();

    if (enableCaching) {
      cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }, [projectId, apiBaseUrl, enableCaching]);

  /**
   * US-160: Code Quality Functions
   */
  const fetchQuality = useCallback(async (): Promise<CodeQualityMetric> => {
    const cacheKey = `quality_${projectId}`;

    if (enableCaching) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 1800000) {
        // 30 minutes cache
        return cached.data;
      }
    }

    const response = await fetch(`${apiBaseUrl}/api/quality-metrics/quality/${projectId}`, {
      method: 'GET',
      credentials: 'include' as RequestCredentials,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch quality metrics: ${response.statusText}`);
    }

    const data = await response.json();

    if (enableCaching) {
      cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }, [projectId, apiBaseUrl, enableCaching]);

  /**
   * US-161: Bug Tracking Functions
   */
  const fetchBugs = useCallback(async (): Promise<BugMetric> => {
    const cacheKey = `bugs_${projectId}`;

    if (enableCaching) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 600000) {
        // 10 minutes cache
        return cached.data;
      }
    }

    const response = await fetch(`${apiBaseUrl}/api/quality-metrics/bugs/${projectId}`, {
      method: 'GET',
      credentials: 'include' as RequestCredentials,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bug metrics: ${response.statusText}`);
    }

    const data = await response.json();

    if (enableCaching) {
      cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }, [projectId, apiBaseUrl, enableCaching]);

  /**
   * US-162: Performance Benchmarking Functions
   */
  const fetchPerformance = useCallback(async (): Promise<PerformanceBenchmark> => {
    const cacheKey = `performance_${projectId}`;

    if (enableCaching) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 120000) {
        // 2 minutes cache
        return cached.data;
      }
    }

    const response = await fetch(`${apiBaseUrl}/api/quality-metrics/performance/${projectId}`, {
      method: 'GET',
      credentials: 'include' as RequestCredentials,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch performance metrics: ${response.statusText}`);
    }

    const data = await response.json();

    if (enableCaching) {
      cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }, [projectId, apiBaseUrl, enableCaching]);

  /**
   * Unified Dashboard Fetch
   */
  const fetchDashboard = useCallback(async (): Promise<QualityMetricsDashboard> => {
    const cacheKey = `dashboard_${projectId}`;

    if (enableCaching) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60000) {
        // 1 minute cache
        return cached.data;
      }
    }

    const response = await fetch(`${apiBaseUrl}/api/quality-metrics/dashboard/${projectId}`, {
      method: 'GET',
      credentials: 'include' as RequestCredentials,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard: ${response.statusText}`);
    }

    const data = await response.json();

    if (enableCaching) {
      cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }, [projectId, apiBaseUrl, enableCaching]);

  /**
   * Refresh Functions
   */
  const refreshDashboard = useCallback(async (): Promise<void> => {
    if (loading) return;

    setLoading(true);
    setError(null);

    // Create new abort controller for this request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const [dashboardData, coverageData, qualityData, bugsData, performanceData] =
        await Promise.all([
          fetchDashboard(),
          fetchCoverage(),
          fetchQuality(),
          fetchBugs(),
          fetchPerformance(),
        ]);

      setDashboard(dashboardData);
      setCoverage(coverageData);
      setQuality(qualityData);
      setBugs(bugsData);
      setPerformance(performanceData);
      setLastUpdate(new Date());
      setIsConnected(true);

      // Clear cache to force fresh data on next request if needed
      if (!enableCaching) {
        cacheRef.current.clear();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to load quality metrics');
        setIsConnected(false);
        console.error('Error fetching quality metrics:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    fetchDashboard,
    fetchCoverage,
    fetchQuality,
    fetchBugs,
    fetchPerformance,
    enableCaching,
  ]);

  const refreshCoverage = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchCoverage();
      setCoverage(data);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh coverage');
    }
  }, [fetchCoverage]);

  const refreshQuality = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchQuality();
      setQuality(data);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh quality metrics');
    }
  }, [fetchQuality]);

  const refreshBugs = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchBugs();
      setBugs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh bug metrics');
    }
  }, [fetchBugs]);

  const refreshPerformance = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchPerformance();
      setPerformance(data);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh performance metrics');
    }
  }, [fetchPerformance]);

  /**
   * Configuration Management
   */
  const updateConfiguration = useCallback(
    async (config: Partial<QualityMetricsConfig>): Promise<void> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/quality-metrics/config/${projectId}`, {
          method: 'PUT',
          credentials: 'include' as RequestCredentials,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        });

        if (!response.ok) {
          throw new Error(`Failed to update configuration: ${response.statusText}`);
        }

        // Refresh dashboard after configuration update
        await refreshDashboard();
      } catch (err: any) {
        setError(err.message || 'Failed to update configuration');
        throw err;
      }
    },
    [projectId, apiBaseUrl, refreshDashboard]
  );

  /**
   * Export and Reporting
   */
  const exportReport = useCallback(
    async (format: 'json' | 'pdf' | 'csv' | 'html'): Promise<void> => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/quality-metrics/export/${projectId}?format=${format}`,
          {
            method: 'GET',
            credentials: 'include' as RequestCredentials,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to export report: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `quality-metrics-${projectId}-${format}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err: any) {
        setError(err.message || 'Failed to export report');
        throw err;
      }
    },
    [projectId, apiBaseUrl]
  );

  /**
   * AI Features
   */
  const generateInsights = useCallback(async (): Promise<any[]> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/quality-metrics/insights/${projectId}`, {
        method: 'POST',
        credentials: 'include' as RequestCredentials,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to generate insights: ${response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message || 'Failed to generate insights');
      throw err;
    }
  }, [projectId, apiBaseUrl]);

  const optimizeThresholds = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/quality-metrics/optimize-thresholds/${projectId}`,
        {
          method: 'POST',
          credentials: 'include' as RequestCredentials,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to optimize thresholds: ${response.statusText}`);
      }

      // Refresh coverage after threshold optimization
      await refreshCoverage();
    } catch (err: any) {
      setError(err.message || 'Failed to optimize thresholds');
      throw err;
    }
  }, [projectId, apiBaseUrl, refreshCoverage]);

  const getAIRecommendations = useCallback(async (): Promise<any[]> => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/quality-metrics/ai-recommendations/${projectId}`,
        {
          method: 'GET',
          credentials: 'include' as RequestCredentials,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get AI recommendations: ${response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message || 'Failed to get AI recommendations');
      throw err;
    }
  }, [projectId, apiBaseUrl]);

  /**
   * Real-time WebSocket Integration
   */
  const subscribeToUpdates = useCallback((): void => {
    if (!realTimeUpdates || wsRef.current) return;

    try {
      const wsUrl = `${wsBaseUrl}/quality-metrics/${projectId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Quality metrics WebSocket connected');
        setIsConnected(true);

        // WebSocket auth: cookie is sent automatically with the WS upgrade request
        // No need to send token in a separate message
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'coverage_update':
              setCoverage(message.data);
              setLastUpdate(new Date());
              break;
            case 'quality_update':
              setQuality(message.data);
              setLastUpdate(new Date());
              break;
            case 'bugs_update':
              setBugs(message.data);
              setLastUpdate(new Date());
              break;
            case 'performance_update':
              setPerformance(message.data);
              setLastUpdate(new Date());
              break;
            case 'dashboard_update':
              setDashboard(message.data);
              setLastUpdate(new Date());
              break;
            case 'error':
              setError(message.message);
              break;
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('Quality metrics WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (realTimeUpdates) {
            subscribeToUpdates();
          }
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('Quality metrics WebSocket error:', error);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to establish WebSocket connection:', err);
      setError('Failed to establish real-time connection');
    }
  }, [realTimeUpdates, wsBaseUrl, projectId]);

  const unsubscribeFromUpdates = useCallback((): void => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  /**
   * Auto-refresh Setup
   */
  useEffect(() => {
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (!loading && !wsRef.current) {
          // Only auto-refresh if not connected via WebSocket
          refreshDashboard();
        }
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    return undefined;
  }, [refreshInterval, loading, refreshDashboard]);

  /**
   * Initial Load and WebSocket Setup
   */
  useEffect(() => {
    if (projectId) {
      // Initial data load
      refreshDashboard();

      // Subscribe to real-time updates if enabled
      if (realTimeUpdates) {
        subscribeToUpdates();
      }
    }

    return () => {
      // Cleanup on unmount
      abortControllerRef.current?.abort();
      unsubscribeFromUpdates();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [projectId, realTimeUpdates, refreshDashboard, subscribeToUpdates, unsubscribeFromUpdates]);

  /**
   * Auto-optimization
   */
  useEffect(() => {
    if (autoOptimize && coverage && coverage.aiInsights) {
      // Automatically optimize thresholds if AI suggests it
      if (
        coverage.aiInsights.riskAssessment === 'low' &&
        coverage.coveragePercentage > coverage.threshold.target
      ) {
        optimizeThresholds();
      }
    }
  }, [autoOptimize, coverage, optimizeThresholds]);

  /**
   * Cache Management
   */
  useEffect(() => {
    // Clean up old cache entries every 5 minutes
    const cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 1800000; // 30 minutes

      for (const [key, value] of cacheRef.current.entries()) {
        if (now - value.timestamp > maxAge) {
          cacheRef.current.delete(key);
        }
      }
    }, 300000); // 5 minutes

    return () => clearInterval(cacheCleanupInterval);
  }, []);

  /**
   * Memoized Return Value
   */
  return useMemo(
    () => ({
      // Data
      dashboard,
      coverage,
      quality,
      bugs,
      performance,

      // State
      loading,
      error,
      isConnected,
      lastUpdate,

      // Actions
      refreshDashboard,
      refreshCoverage,
      refreshQuality,
      refreshBugs,
      refreshPerformance,

      // Configuration
      updateConfiguration,

      // Export and Reporting
      exportReport,
      generateInsights,

      // AI Features
      optimizeThresholds,
      getAIRecommendations,

      // Real-time Features
      subscribeToUpdates,
      unsubscribeFromUpdates,
    }),
    [
      dashboard,
      coverage,
      quality,
      bugs,
      performance,
      loading,
      error,
      isConnected,
      lastUpdate,
      refreshDashboard,
      refreshCoverage,
      refreshQuality,
      refreshBugs,
      refreshPerformance,
      updateConfiguration,
      exportReport,
      generateInsights,
      optimizeThresholds,
      getAIRecommendations,
      subscribeToUpdates,
      unsubscribeFromUpdates,
    ]
  );
};

export default useQualityMetricsService;
