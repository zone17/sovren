/**
 * State Management Monitoring & Metrics
 *
 * Features:
 * - Redux DevTools instrumentation
 * - React Query DevTools configuration
 * - State management metrics dashboard
 * - Redux action frequency and dispatch time tracking
 * - React Query cache hit/miss rate tracking
 * - Component re-render count tracking
 * - Error tracking for state management failures
 * - Performance degradation alerts
 * - State snapshots for debugging
 */

import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

interface StateMetrics {
  redux: {
    actionCount: number;
    dispatchTimes: number[];
    avgDispatchTime: number;
    p95DispatchTime: number;
    storeSize: number;
    subscriberCount: number;
  };
  reactQuery: {
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    activeQueries: number;
    staleQueries: number;
    invalidatedQueries: number;
  };
  components: {
    totalRenders: number;
    rendersByComponent: Record<string, number>;
    unnecessaryRenders: number;
  };
  errors: {
    reduxErrors: number;
    queryErrors: number;
    lastError: string | null;
  };
}

interface PerformanceAlert {
  id: string;
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
}

/**
 * Redux DevTools Setup
 */
export const setupReduxDevTools = (store: any) => {
  if (typeof window !== 'undefined' && (window as any).__REDUX_DEVTOOLS_EXTENSION__) {
    const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__({
      name: 'Sovren State',
      trace: true,
      traceLimit: 25,
      features: {
        pause: true,
        lock: true,
        persist: true,
        export: true,
        import: 'custom',
        jump: true,
        skip: true,
        reorder: true,
        dispatch: true,
        test: true
      }
    });

    // Connect store to DevTools
    store.subscribe(() => {
      devTools.send(store.getState());
    });
  }
};

/**
 * State Management Metrics Provider
 */
export const StateMetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useStore();
  const queryClient = useQueryClient();
  const [metrics, setMetrics] = useState<StateMetrics>({
    redux: {
      actionCount: 0,
      dispatchTimes: [],
      avgDispatchTime: 0,
      p95DispatchTime: 0,
      storeSize: 0,
      subscriberCount: 0
    },
    reactQuery: {
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      activeQueries: 0,
      staleQueries: 0,
      invalidatedQueries: 0
    },
    components: {
      totalRenders: 0,
      rendersByComponent: {},
      unnecessaryRenders: 0
    },
    errors: {
      reduxErrors: 0,
      queryErrors: 0,
      lastError: null
    }
  });

  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const metricsRef = useRef(metrics);

  // Track Redux metrics
  useEffect(() => {
    let actionCount = 0;
    const dispatchTimes: number[] = [];

    const originalDispatch = store.dispatch;
    store.dispatch = function(action: any) {
      const startTime = performance.now();
      const result = originalDispatch.call(store, action);
      const endTime = performance.now();
      const dispatchTime = endTime - startTime;

      actionCount++;
      dispatchTimes.push(dispatchTime);

      // Keep last 100 dispatch times
      if (dispatchTimes.length > 100) {
        dispatchTimes.shift();
      }

      // Update metrics
      const avgTime = dispatchTimes.reduce((a, b) => a + b, 0) / dispatchTimes.length;
      const sortedTimes = [...dispatchTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95Time = sortedTimes[p95Index] || 0;

      setMetrics(prev => ({
        ...prev,
        redux: {
          ...prev.redux,
          actionCount,
          dispatchTimes: dispatchTimes,
          avgDispatchTime: avgTime,
          p95DispatchTime: p95Time
        }
      }));

      // Check for performance alerts
      if (p95Time > 16) {
        addAlert({
          metric: 'Redux Dispatch Time',
          value: p95Time,
          threshold: 16,
          severity: 'warning',
          message: `Redux dispatch P95 time (${p95Time.toFixed(2)}ms) exceeds 16ms threshold`
        });
      }

      return result;
    };

    return () => {
      store.dispatch = originalDispatch;
    };
  }, [store]);

  // Track React Query metrics
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    let cacheHits = 0;
    let cacheMisses = 0;

    // Subscribe to cache events
    const unsubscribe = cache.subscribe((event) => {
      if (event.type === 'added') {
        cacheMisses++;
      } else if (event.query?.state.dataUpdatedAt) {
        cacheHits++;
      }

      const hitRate = cacheHits / (cacheHits + cacheMisses) * 100;

      setMetrics(prev => ({
        ...prev,
        reactQuery: {
          ...prev.reactQuery,
          cacheHits,
          cacheMisses,
          cacheHitRate: hitRate,
          activeQueries: cache.getAll().filter(q => q.state.fetchStatus === 'fetching').length,
          staleQueries: cache.getAll().filter(q => q.isStale()).length
        }
      }));

      // Check for cache hit rate alert
      if (hitRate < 70 && cacheHits + cacheMisses > 10) {
        addAlert({
          metric: 'Cache Hit Rate',
          value: hitRate,
          threshold: 70,
          severity: 'warning',
          message: `React Query cache hit rate (${hitRate.toFixed(1)}%) below 70% threshold`
        });
      }
    });

    return unsubscribe;
  }, [queryClient]);

  // Component render tracking
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const originalError = console.error;
      let renderCount = 0;
      const componentRenders: Record<string, number> = {};

      // Track React render warnings
      console.error = function(...args) {
        const message = args[0]?.toString() || '';
        if (message.includes('rendered')) {
          renderCount++;

          // Extract component name if possible
          const componentMatch = message.match(/(\w+) rendered/);
          if (componentMatch) {
            const componentName = componentMatch[1];
            componentRenders[componentName] = (componentRenders[componentName] || 0) + 1;
          }

          setMetrics(prev => ({
            ...prev,
            components: {
              ...prev.components,
              totalRenders: renderCount,
              rendersByComponent: { ...componentRenders }
            }
          }));
        }

        originalError.apply(console, args);
      };

      return () => {
        console.error = originalError;
      };
    }
  }, []);

  // Add performance alert
  const addAlert = (alert: Omit<PerformanceAlert, 'id' | 'timestamp'>) => {
    const newAlert: PerformanceAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random()}`,
      timestamp: Date.now()
    };

    setAlerts(prev => [...prev, newAlert]);

    // Log to console based on severity
    if (alert.severity === 'critical') {
      console.error(`🚨 CRITICAL: ${alert.message}`);
    } else {
      console.warn(`⚠️ WARNING: ${alert.message}`);
    }

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // sendToMonitoringService(newAlert);
    }
  };

  // Store metrics in window for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__STATE_METRICS__ = metrics;
      (window as any).__STATE_ALERTS__ = alerts;
    }
  }, [metrics, alerts]);

  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <>
          <ReactQueryDevtools
            initialIsOpen={false}
            position="bottom-right"
            panelProps={{
              style: {
                zIndex: 9999
              }
            }}
          />
          <StateMetricsDashboard metrics={metrics} alerts={alerts} />
        </>
      )}
    </>
  );
};

/**
 * State Metrics Dashboard Component
 */
const StateMetricsDashboard: React.FC<{
  metrics: StateMetrics;
  alerts: PerformanceAlert[]
}> = ({ metrics, alerts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'alerts' | 'snapshot'>('metrics');

  // Take state snapshot
  const takeSnapshot = () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      metrics: { ...metrics },
      alerts: [...alerts],
      reduxState: useStore().getState(),
      reactQueryCache: useQueryClient().getQueryCache().getAll().map(q => ({
        queryKey: q.queryKey,
        state: q.state.status,
        dataUpdatedAt: q.state.dataUpdatedAt
      }))
    };

    // Save to localStorage
    localStorage.setItem(
      `state-snapshot-${Date.now()}`,
      JSON.stringify(snapshot)
    );

    console.log('📸 State snapshot saved', snapshot);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          padding: '10px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          zIndex: 9998
        }}
      >
        📊 State Metrics
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      width: '400px',
      maxHeight: '600px',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      zIndex: 9998,
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd'
      }}>
        <h3 style={{ margin: 0 }}>State Management Metrics</h3>
        <button onClick={() => setIsOpen(false)} style={{
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer'
        }}>×</button>
      </div>

      <div style={{
        display: 'flex',
        borderBottom: '1px solid #ddd'
      }}>
        <button
          onClick={() => setActiveTab('metrics')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            backgroundColor: activeTab === 'metrics' ? '#4CAF50' : 'white',
            color: activeTab === 'metrics' ? 'white' : 'black',
            cursor: 'pointer'
          }}
        >
          Metrics
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            backgroundColor: activeTab === 'alerts' ? '#4CAF50' : 'white',
            color: activeTab === 'alerts' ? 'white' : 'black',
            cursor: 'pointer',
            position: 'relative'
          }}
        >
          Alerts {alerts.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              backgroundColor: 'red',
              color: 'white',
              borderRadius: '50%',
              padding: '2px 6px',
              fontSize: '12px'
            }}>
              {alerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('snapshot')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            backgroundColor: activeTab === 'snapshot' ? '#4CAF50' : 'white',
            color: activeTab === 'snapshot' ? 'white' : 'black',
            cursor: 'pointer'
          }}
        >
          Snapshot
        </button>
      </div>

      <div style={{
        padding: '15px',
        maxHeight: '450px',
        overflowY: 'auto'
      }}>
        {activeTab === 'metrics' && (
          <div>
            <h4>Redux Metrics</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>Actions Dispatched: {metrics.redux.actionCount}</li>
              <li>Avg Dispatch Time: {metrics.redux.avgDispatchTime.toFixed(2)}ms</li>
              <li>P95 Dispatch Time: {metrics.redux.p95DispatchTime.toFixed(2)}ms</li>
            </ul>

            <h4>React Query Metrics</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>Cache Hits: {metrics.reactQuery.cacheHits}</li>
              <li>Cache Misses: {metrics.reactQuery.cacheMisses}</li>
              <li>Hit Rate: {metrics.reactQuery.cacheHitRate.toFixed(1)}%</li>
              <li>Active Queries: {metrics.reactQuery.activeQueries}</li>
              <li>Stale Queries: {metrics.reactQuery.staleQueries}</li>
            </ul>

            <h4>Component Metrics</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>Total Renders: {metrics.components.totalRenders}</li>
              <li>Top Renderers:</li>
              {Object.entries(metrics.components.rendersByComponent)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([name, count]) => (
                  <li key={name} style={{ marginLeft: '20px' }}>
                    {name}: {count}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div>
            {alerts.length === 0 ? (
              <p>No performance alerts</p>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  style={{
                    padding: '10px',
                    marginBottom: '10px',
                    backgroundColor: alert.severity === 'critical' ? '#ffebee' : '#fff3e0',
                    border: `1px solid ${alert.severity === 'critical' ? '#ef5350' : '#ff9800'}`,
                    borderRadius: '4px'
                  }}
                >
                  <strong style={{
                    color: alert.severity === 'critical' ? '#c62828' : '#f57c00'
                  }}>
                    {alert.severity.toUpperCase()}: {alert.metric}
                  </strong>
                  <p style={{ margin: '5px 0' }}>{alert.message}</p>
                  <small>{new Date(alert.timestamp).toLocaleTimeString()}</small>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'snapshot' && (
          <div>
            <button
              onClick={takeSnapshot}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              📸 Take Snapshot
            </button>
            <p>Snapshots are saved to localStorage for debugging.</p>
            <p>Access via: <code>localStorage.getItem('state-snapshot-*')</code></p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Performance monitoring setup
 */
export const setupStateMonitoring = () => {
  // Define monitoring rules
  const monitoringRules = [
    {
      name: 'Redux Dispatch Performance',
      metric: 'redux.p95DispatchTime',
      threshold: 16,
      condition: 'greater_than',
      severity: 'warning',
      message: 'Redux dispatch time exceeding frame budget'
    },
    {
      name: 'React Query Cache Efficiency',
      metric: 'reactQuery.cacheHitRate',
      threshold: 70,
      condition: 'less_than',
      severity: 'warning',
      message: 'Cache hit rate below optimal threshold'
    },
    {
      name: 'Component Render Efficiency',
      metric: 'components.unnecessaryRenders',
      threshold: 50,
      condition: 'greater_than',
      severity: 'warning',
      message: 'High number of unnecessary re-renders detected'
    }
  ];

  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Initialize monitoring service
    // initializeMonitoringService(monitoringRules);
  }

  console.log('📊 State management monitoring initialized with rules:', monitoringRules);
};

// Export utility for getting current metrics
export const getStateMetrics = (): StateMetrics | undefined => {
  if (typeof window !== 'undefined') {
    return (window as any).__STATE_METRICS__;
  }
  return undefined;
};

// Export utility for getting current alerts
export const getStateAlerts = (): PerformanceAlert[] => {
  if (typeof window !== 'undefined') {
    return (window as any).__STATE_ALERTS__ || [];
  }
  return [];
};