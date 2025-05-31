import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals';
import { addBreadcrumb, captureMessage } from './simpleMonitoring';

// Performance thresholds (in milliseconds) - Updated to latest Core Web Vitals guidelines
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals thresholds (2024 standards)
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 }, // First Input Delay (deprecated, use INP)
  INP: { good: 200, poor: 500 }, // Interaction to Next Paint (new standard)
  CLS: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift

  // Additional metrics
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte

  // Custom thresholds
  API_RESPONSE: { good: 1000, poor: 3000 },
  COMPONENT_RENDER: { good: 100, poor: 500 },
  ROUTE_CHANGE: { good: 200, poor: 1000 },
  HYDRATION: { good: 300, poor: 1000 },
} as const;

// Performance metrics storage with enhanced typing
interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  id: string;
  delta?: number; // For tracking changes over time
  entries?: PerformanceEntry[]; // Raw performance entries
  attribution?: Record<string, any>; // Attribution data for debugging
}

// Modern Performance Monitor with cutting-edge features
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  private vitalsCallbacks: Array<() => void> = [];

  constructor() {
    this.initWebVitals();
    this.initCustomMetrics();
    this.initAdvancedMetrics();
  }

  // Initialize Core Web Vitals monitoring with latest v4 APIs
  private initWebVitals(): void {
    // Largest Contentful Paint
    onLCP((metric) => {
      this.recordMetric('LCP', metric.value, this.getRating('LCP', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
        attribution: (metric as any).attribution, // Attribution debugging
      });
    });

    // Interaction to Next Paint (replaces FID as the new standard)
    onINP((metric) => {
      this.recordMetric('INP', metric.value, this.getRating('INP', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
        attribution: (metric as any).attribution,
      });
    });

    // Keep FID for backward compatibility but prioritize INP
    onFID((metric) => {
      this.recordMetric('FID', metric.value, this.getRating('FID', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
      });
    });

    // Cumulative Layout Shift
    onCLS((metric) => {
      this.recordMetric('CLS', metric.value, this.getRating('CLS', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
        attribution: (metric as any).attribution,
      });
    });

    // First Contentful Paint
    onFCP((metric) => {
      this.recordMetric('FCP', metric.value, this.getRating('FCP', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
      });
    });

    // Time to First Byte
    onTTFB((metric) => {
      this.recordMetric('TTFB', metric.value, this.getRating('TTFB', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
      });
    });
  }

  // Initialize advanced custom metrics
  private initAdvancedMetrics(): void {
    // Monitor Element Timing API for custom elements
    if ('PerformanceObserver' in window) {
      try {
        const elementObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const elementEntry = entry as PerformanceEntry & {
              identifier?: string;
              renderTime?: number;
              loadTime?: number;
            };
            if (elementEntry.identifier) {
              this.recordMetric(
                `ELEMENT_${elementEntry.identifier.toUpperCase()}`,
                elementEntry.renderTime || elementEntry.loadTime || 0,
                this.getRating(
                  'COMPONENT_RENDER',
                  elementEntry.renderTime || elementEntry.loadTime || 0
                )
              );
            }
          }
        });

        elementObserver.observe({ entryTypes: ['element'] });
        this.observers.set('element', elementObserver);
      } catch (e) {
        console.warn('Element timing observer not supported');
      }

      // Monitor Layout Shift API for detailed CLS attribution
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          let cumulativeScore = 0;
          for (const entry of list.getEntries()) {
            const layoutShift = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
              sources?: Array<{ node?: Node; currentRect?: DOMRect; previousRect?: DOMRect }>;
            };

            if (!layoutShift.hadRecentInput) {
              cumulativeScore += layoutShift.value;

              // Track individual layout shifts for debugging
              addBreadcrumb(
                `Layout shift: ${layoutShift.value.toFixed(4)} (cumulative: ${cumulativeScore.toFixed(4)})`,
                'performance',
                layoutShift.value > 0.1 ? 'warning' : 'info',
                {
                  value: layoutShift.value,
                  cumulative: cumulativeScore,
                  sources: layoutShift.sources?.length || 0,
                }
              );
            }
          }
        });

        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('layout-shift', layoutShiftObserver);
      } catch (e) {
        console.warn('Layout shift observer not supported');
      }

      // Monitor User Timing API for custom measurements
      try {
        const userTimingObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure') {
              this.recordMetric(
                `USER_${entry.name.toUpperCase()}`,
                entry.duration,
                this.getRating('COMPONENT_RENDER', entry.duration)
              );
            }
          }
        });

        userTimingObserver.observe({ entryTypes: ['measure'] });
        this.observers.set('user-timing', userTimingObserver);
      } catch (e) {
        console.warn('User timing observer not supported');
      }
    }

    // Monitor memory usage (Chrome-specific)
    if ((performance as any).memory) {
      setInterval(() => {
        const memory = (performance as any).memory;
        const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        if (usedPercent > 80) {
          addBreadcrumb(`High memory usage: ${usedPercent.toFixed(1)}%`, 'performance', 'warning', {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
          });
        }
      }, 30000); // Check every 30 seconds
    }
  }

  // Initialize custom performance metrics
  private initCustomMetrics(): void {
    // Monitor long tasks with enhanced attribution
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const longTask = entry as PerformanceEntry & {
            attribution?: Array<{
              name: string;
              entryType: string;
              startTime: number;
              duration: number;
            }>;
          };

          if (longTask.duration > 50) {
            // Tasks longer than 50ms
            this.recordMetric('LONG_TASK', longTask.duration, 'poor', {
              attribution: longTask.attribution,
            });

            addBreadcrumb(
              `Long task detected: ${longTask.duration.toFixed(2)}ms`,
              'performance',
              'warning',
              {
                duration: longTask.duration,
                attribution: longTask.attribution?.map((a) => a.name) || [],
              }
            );
          }
        }
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (e) {
        console.warn('Long task observer not supported');
      }
    }

    // Enhanced navigation timing
    this.measureNavigationTiming();

    // Enhanced resource loading monitoring
    this.measureResourceTiming();

    // Monitor paint timing
    this.measurePaintTiming();
  }

  // Enhanced navigation timing measurement
  private measureNavigationTiming(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigation = performance.getEntriesByType('navigation')[0];

      if (navigation) {
        // DNS lookup time
        const dnsTime = navigation.domainLookupEnd - navigation.domainLookupStart;
        this.recordMetric('DNS_LOOKUP', dnsTime, this.getRating('TTFB', dnsTime));

        // TCP connection time
        const tcpTime = navigation.connectEnd - navigation.connectStart;
        this.recordMetric('TCP_CONNECTION', tcpTime, this.getRating('TTFB', tcpTime));

        // SSL/TLS negotiation time
        if (navigation.secureConnectionStart > 0) {
          const sslTime = navigation.connectEnd - navigation.secureConnectionStart;
          this.recordMetric('SSL_TIME', sslTime, this.getRating('TTFB', sslTime));
        }

        // Server response time
        const serverTime = navigation.responseEnd - navigation.requestStart;
        this.recordMetric(
          'SERVER_RESPONSE',
          serverTime,
          this.getRating('API_RESPONSE', serverTime)
        );

        // DOM processing time
        const domTime = navigation.domContentLoadedEventEnd - navigation.responseEnd;
        this.recordMetric('DOM_PROCESSING', domTime, this.getRating('COMPONENT_RENDER', domTime));

        // Page load complete time
        const loadTime = navigation.loadEventEnd - navigation.fetchStart;
        this.recordMetric('PAGE_LOAD', loadTime, this.getRating('API_RESPONSE', loadTime));

        // Time to Interactive estimation
        const tti = navigation.domContentLoadedEventEnd - navigation.fetchStart;
        this.recordMetric('TIME_TO_INTERACTIVE', tti, this.getRating('API_RESPONSE', tti));
      }
    }
  }

  // Enhanced paint timing measurement
  private measurePaintTiming(): void {
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const paintEntry = entry as PerformancePaintTiming;

            if (paintEntry.name === 'first-paint') {
              this.recordMetric(
                'FIRST_PAINT',
                paintEntry.startTime,
                this.getRating('FCP', paintEntry.startTime)
              );
            } else if (paintEntry.name === 'first-contentful-paint') {
              this.recordMetric(
                'FIRST_CONTENTFUL_PAINT',
                paintEntry.startTime,
                this.getRating('FCP', paintEntry.startTime)
              );
            }
          }
        });

        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.set('paint', paintObserver);
      } catch (e) {
        console.warn('Paint observer not supported');
      }
    }
  }

  // Enhanced resource loading measurement
  private measureResourceTiming(): void {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resource = entry as PerformanceResourceTiming;

          // Categorize resources
          const resourceType = this.getResourceType(resource.name);

          // Track slow-loading resources with detailed timing
          if (resource.duration > 1000) {
            addBreadcrumb(
              `Slow ${resourceType}: ${resource.name} took ${resource.duration.toFixed(2)}ms`,
              'performance',
              'warning',
              {
                type: resourceType,
                duration: resource.duration,
                size: resource.transferSize,
                cached: resource.transferSize === 0 && resource.duration > 0,
                timing: {
                  dns: resource.domainLookupEnd - resource.domainLookupStart,
                  tcp: resource.connectEnd - resource.connectStart,
                  request: resource.responseStart - resource.requestStart,
                  response: resource.responseEnd - resource.responseStart,
                },
              }
            );
          }

          // Track failed resources
          if (resource.transferSize === 0 && resource.duration > 0) {
            addBreadcrumb(`Failed ${resourceType}: ${resource.name}`, 'performance', 'error', {
              type: resourceType,
            });
          }

          // Track large resources
          if (resource.transferSize > 1024 * 1024) {
            // > 1MB
            addBreadcrumb(
              `Large ${resourceType}: ${resource.name} (${(resource.transferSize / 1024 / 1024).toFixed(2)}MB)`,
              'performance',
              'warning',
              {
                type: resourceType,
                size: resource.transferSize,
                duration: resource.duration,
              }
            );
          }
        }
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('resource', resourceObserver);
      } catch (e) {
        console.warn('Resource observer not supported');
      }
    }
  }

  // Determine resource type from URL
  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  // Record a performance metric with enhanced data
  private recordMetric(
    name: string,
    value: number,
    rating: 'good' | 'needs-improvement' | 'poor',
    additionalData?: Partial<Pick<PerformanceMetric, 'delta' | 'entries' | 'attribution'>>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      rating,
      timestamp: Date.now(),
      id: `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...additionalData,
    };

    this.metrics.push(metric);

    // Keep memory usage reasonable
    if (this.metrics.length > 500) {
      this.metrics = this.metrics.slice(-400); // Keep last 400 metrics
    }

    // Log to Sentry for poor performance with enhanced context
    if (rating === 'poor') {
      captureMessage(`Poor performance detected: ${name} = ${value.toFixed(2)}ms`, 'warning', {
        metric_name: name,
        metric_value: value,
        metric_rating: rating,
        attribution: additionalData?.attribution,
      });
    }

    addBreadcrumb(
      `Performance: ${name} = ${value.toFixed(2)}ms (${rating})`,
      'performance',
      rating === 'poor' ? 'warning' : 'info',
      { value, rating, delta: additionalData?.delta }
    );

    // Dispatch custom event for real-time monitoring
    window.dispatchEvent(
      new CustomEvent('performance-metric', {
        detail: metric,
      })
    );

    // Call registered callbacks
    this.vitalsCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.warn('Performance callback error:', error);
      }
    });
  }

  // Get performance rating based on thresholds
  private getRating(
    metricName: keyof typeof PERFORMANCE_THRESHOLDS,
    value: number
  ): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = PERFORMANCE_THRESHOLDS[metricName];

    // Handle case where threshold doesn't exist
    if (!thresholds) {
      console.warn(`No threshold defined for metric: ${metricName}`);
      // Fallback to generic thresholds for unknown metrics
      if (value <= 500) return 'good';
      if (value <= 2000) return 'needs-improvement';
      return 'poor';
    }

    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs-improvement';
    return 'poor';
  }

  // Safe rating method that handles unknown metric names
  private getSafeRating(metricName: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    // Check if the metric name exists in our thresholds
    if (metricName in PERFORMANCE_THRESHOLDS) {
      return this.getRating(metricName as keyof typeof PERFORMANCE_THRESHOLDS, value);
    }

    // For unknown metrics, use intelligent fallback based on metric type
    if (metricName.includes('CLS') || metricName.includes('SHIFT')) {
      // Layout shift metrics (0-1 scale)
      if (value <= 0.1) return 'good';
      if (value <= 0.25) return 'needs-improvement';
      return 'poor';
    } else if (metricName.includes('API') || metricName.includes('RESPONSE')) {
      // API response time metrics
      if (value <= 1000) return 'good';
      if (value <= 3000) return 'needs-improvement';
      return 'poor';
    } else if (metricName.includes('RENDER') || metricName.includes('COMPONENT')) {
      // Component render metrics
      if (value <= 100) return 'good';
      if (value <= 500) return 'needs-improvement';
      return 'poor';
    } else {
      // Generic time-based metrics
      if (value <= 500) return 'good';
      if (value <= 2000) return 'needs-improvement';
      return 'poor';
    }
  }

  // Enhanced public API for custom measurements
  public measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    return this.measure(name, operation);
  }

  public measureSync<T>(name: string, operation: () => T): T {
    const start = performance.now();

    try {
      const result = operation();
      const duration = performance.now() - start;
      this.recordMetric(name, duration, this.getRating('COMPONENT_RENDER', duration));
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_ERROR`, duration, 'poor');
      throw error;
    }
  }

  private async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - start;
      this.recordMetric(name, duration, this.getRating('API_RESPONSE', duration));
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_ERROR`, duration, 'poor');
      throw error;
    }
  }

  // Register callback for performance updates
  public onVitalsChange(callback: () => void): () => void {
    this.vitalsCallbacks.push(callback);
    return () => {
      const index = this.vitalsCallbacks.indexOf(callback);
      if (index > -1) {
        this.vitalsCallbacks.splice(index, 1);
      }
    };
  }

  // Get current metrics
  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Get metrics summary with enhanced analytics
  public getMetricsSummary() {
    const summary = {
      total: this.metrics.length,
      good: this.metrics.filter((m) => m.rating === 'good').length,
      needsImprovement: this.metrics.filter((m) => m.rating === 'needs-improvement').length,
      poor: this.metrics.filter((m) => m.rating === 'poor').length,
      byType: {} as Record<
        string,
        { count: number; avgValue: number; rating: string; trend?: string }
      >,
      coreWebVitals: {} as Record<string, { value: number; rating: string; delta?: number }>,
    };

    // Group by metric type
    const metricGroups = this.metrics.reduce(
      (acc, metric) => {
        if (!acc[metric.name]) {
          acc[metric.name] = [];
        }
        acc[metric.name].push(metric);
        return acc;
      },
      {} as Record<string, PerformanceMetric[]>
    );

    // Calculate averages and trends
    Object.entries(metricGroups).forEach(([name, metrics]) => {
      const avgValue = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
      const avgRating = this.getSafeRating(name, avgValue);

      // Calculate trend (last 5 vs previous 5)
      let trend = 'stable';
      if (metrics.length >= 10) {
        const recent = metrics.slice(-5);
        const previous = metrics.slice(-10, -5);
        const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
        const previousAvg = previous.reduce((sum, m) => sum + m.value, 0) / previous.length;
        const change = ((recentAvg - previousAvg) / previousAvg) * 100;

        if (change < -10) trend = 'improving';
        else if (change > 10) trend = 'degrading';
      }

      summary.byType[name] = {
        count: metrics.length,
        avgValue,
        rating: avgRating,
        trend,
      };

      // Track Core Web Vitals separately
      if (['LCP', 'FID', 'INP', 'CLS', 'FCP', 'TTFB'].includes(name)) {
        const latest = metrics[metrics.length - 1];
        summary.coreWebVitals[name] = {
          value: latest.value,
          rating: latest.rating,
          delta: latest.delta,
        };
      }
    });

    return summary;
  }

  // Clear metrics (for memory management)
  public clearMetrics(): void {
    this.metrics = [];
  }

  // Disconnect observers
  public disconnect(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.vitalsCallbacks = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Enhanced utility functions with modern patterns
export const measureApiCall = <T>(url: string, operation: () => Promise<T>): Promise<T> => {
  return performanceMonitor.measureAsync(`API_${url.split('/').pop()}`, operation);
};

export const measureComponentRender = <T>(componentName: string, operation: () => T): T => {
  return performanceMonitor.measureSync(`RENDER_${componentName}`, operation);
};

export const measureRouteChange = <T>(
  routeName: string,
  operation: () => Promise<T>
): Promise<T> => {
  return performanceMonitor.measureAsync(`ROUTE_${routeName}`, operation);
};

// Custom measurement using User Timing API
export const startMeasurement = (name: string): void => {
  performance.mark(`${name}-start`);
};

export const endMeasurement = (name: string): number => {
  performance.mark(`${name}-end`);
  performance.measure(name, `${name}-start`, `${name}-end`);

  const entries = performance.getEntriesByName(name, 'measure');
  const latestEntry = entries[entries.length - 1];

  // Cleanup marks
  performance.clearMarks(`${name}-start`);
  performance.clearMarks(`${name}-end`);
  performance.clearMeasures(name);

  return latestEntry?.duration || 0;
};

// Performance report for debugging with enhanced insights
export const getPerformanceReport = () => {
  const metrics = performanceMonitor.getMetrics();
  const summary = performanceMonitor.getMetricsSummary();

  return {
    summary,
    coreWebVitals: summary.coreWebVitals,
    recentMetrics: metrics.slice(-10),
    poorPerformance: metrics.filter((m) => m.rating === 'poor').slice(-5),
    trends: Object.entries(summary.byType)
      .filter(([, data]) => data.trend !== 'stable')
      .reduce((acc, [name, data]) => ({ ...acc, [name]: data.trend }), {}),
    timestamp: new Date().toISOString(),
    pageInfo: {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      connection: (navigator as any).connection?.effectiveType || 'unknown',
      memory: (performance as any).memory
        ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
            limit: (performance as any).memory.jsHeapSizeLimit,
          }
        : undefined,
    },
  };
};

export default performanceMonitor;
