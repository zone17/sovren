/* eslint-disable no-console */
// Web Vitals imports with test compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VitalsCallback = (callback: (metric: any) => void) => void;
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop: VitalsCallback = () => {};
let onCLS: VitalsCallback = noop,
  onFCP: VitalsCallback = noop,
  onFID: VitalsCallback = noop,
  onINP: VitalsCallback = noop,
  onLCP: VitalsCallback = noop,
  onTTFB: VitalsCallback = noop;

if (
  typeof window !== 'undefined' &&
  typeof (globalThis as Record<string, unknown>).jest === 'undefined'
) {
  // Only import web-vitals in browser environment (not test runners)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const webVitals = require('web-vitals') as Record<string, VitalsCallback>;
    ({ onCLS, onFCP, onFID, onINP, onLCP, onTTFB } = webVitals);
  } catch (_error) {
    // Fallback if web-vitals is not available
    // eslint-disable-next-line no-console
    console.warn('web-vitals library not available');
    onCLS = onFCP = onFID = onINP = onLCP = onTTFB = noop;
  }
}

import { addBreadcrumb } from './simpleMonitoring';

// 🛡️ **ELITE BROWSER API INTERFACES**
interface PerformanceMemory {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

interface NavigatorConnection {
  readonly effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  readonly downlink?: number;
  readonly rtt?: number;
  readonly saveData?: boolean;
}

interface ExtendedNavigator extends Navigator {
  readonly connection?: NavigatorConnection;
}

interface ExtendedPerformance extends Performance {
  readonly memory?: PerformanceMemory;
}

interface WebVitalsAttribution {
  readonly largestShiftTarget?: string;
  readonly largestShiftTime?: number;
  readonly largestShiftValue?: number;
  readonly largestShiftEntry?: PerformanceEntry;
  readonly loadState?: 'loading' | 'dom-interactive' | 'dom-content-loaded' | 'complete';
  readonly navigationEntry?: PerformanceNavigationTiming;
  readonly fcpEntry?: PerformanceEntry;
  readonly lcpEntry?: PerformanceEntry;
  readonly ttfbEntry?: PerformanceEntry;
}

interface WebVitalsMetric {
  readonly name: string;
  readonly value: number;
  readonly rating: 'good' | 'needs-improvement' | 'poor';
  readonly delta: number;
  readonly entries: PerformanceEntry[];
  readonly id: string;
  readonly attribution?: WebVitalsAttribution;
}

interface ElementTimingEntry extends PerformanceEntry {
  readonly identifier?: string;
  readonly renderTime?: number;
  readonly loadTime?: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  readonly value: number;
  readonly hadRecentInput: boolean;
  readonly sources?: ReadonlyArray<{
    readonly node?: Node;
    readonly currentRect?: DOMRect;
    readonly previousRect?: DOMRect;
  }>;
}

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
  attribution?: WebVitalsAttribution; // Attribution data for debugging
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
    onLCP((metric: WebVitalsMetric) => {
      this.recordMetric('LCP', metric.value, this.getRating('LCP', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
        attribution: metric.attribution,
      });
    });

    // Interaction to Next Paint (replaces FID as the new standard)
    onINP((metric: WebVitalsMetric) => {
      this.recordMetric('INP', metric.value, this.getRating('INP', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
        attribution: metric.attribution,
      });
    });

    // Keep FID for backward compatibility but prioritize INP
    onFID((metric: WebVitalsMetric) => {
      this.recordMetric('FID', metric.value, this.getRating('FID', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
      });
    });

    // Cumulative Layout Shift
    onCLS((metric: WebVitalsMetric) => {
      this.recordMetric('CLS', metric.value, this.getRating('CLS', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
        attribution: metric.attribution,
      });
    });

    // First Contentful Paint
    onFCP((metric: WebVitalsMetric) => {
      this.recordMetric('FCP', metric.value, this.getRating('FCP', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
      });
    });

    // Time to First Byte
    onTTFB((metric: WebVitalsMetric) => {
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
        const elementObserver = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const elementEntry = entry as ElementTimingEntry;
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
        const layoutShiftObserver = new PerformanceObserver(list => {
          let cumulativeScore = 0;
          for (const entry of list.getEntries()) {
            const layoutShift = entry as LayoutShiftEntry;

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
        const userTimingObserver = new PerformanceObserver(list => {
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
    const extendedPerformance = performance as ExtendedPerformance;
    if (extendedPerformance.memory) {
      setInterval(() => {
        const memory = extendedPerformance.memory;
        if (memory) {
          const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

          if (usedPercent > 80) {
            addBreadcrumb(
              `High memory usage: ${usedPercent.toFixed(1)}%`,
              'performance',
              'warning',
              {
                used: memory.usedJSHeapSize,
                total: memory.totalJSHeapSize,
                limit: memory.jsHeapSizeLimit,
              }
            );
          }
        }
      }, 10000); // Check every 10 seconds
    }
  }

  // Initialize custom performance monitoring
  private initCustomMetrics(): void {
    // Navigation timing
    this.measureNavigationTiming();

    // Paint timing
    this.measurePaintTiming();

    // Resource timing
    this.measureResourceTiming();

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            this.recordMetric(
              'LONG_TASK',
              entry.duration,
              this.getRating('COMPONENT_RENDER', entry.duration)
            );

            // Log warning for long tasks
            if (entry.duration > 50) {
              addBreadcrumb(
                `Long task detected: ${entry.duration.toFixed(2)}ms`,
                'performance',
                'warning',
                {
                  duration: entry.duration,
                  startTime: entry.startTime,
                }
              );
            }
          }
        });

        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (e) {
        console.warn('Long task observer not supported');
      }
    }
  }

  // Measure navigation timing
  private measureNavigationTiming(): void {
    if ('PerformanceObserver' in window) {
      try {
        const navigationObserver = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const navEntry = entry as PerformanceNavigationTiming;

            // DNS lookup time
            if (navEntry.domainLookupEnd && navEntry.domainLookupStart) {
              this.recordMetric(
                'DNS_LOOKUP',
                navEntry.domainLookupEnd - navEntry.domainLookupStart,
                this.getRating(
                  'API_RESPONSE',
                  navEntry.domainLookupEnd - navEntry.domainLookupStart
                )
              );
            }

            // Connection time
            if (navEntry.connectEnd && navEntry.connectStart) {
              this.recordMetric(
                'CONNECTION',
                navEntry.connectEnd - navEntry.connectStart,
                this.getRating('API_RESPONSE', navEntry.connectEnd - navEntry.connectStart)
              );
            }

            // Server response time
            if (navEntry.responseStart && navEntry.requestStart) {
              this.recordMetric(
                'SERVER_RESPONSE',
                navEntry.responseStart - navEntry.requestStart,
                this.getRating('API_RESPONSE', navEntry.responseStart - navEntry.requestStart)
              );
            }

            // DOM processing time
            if (navEntry.domContentLoadedEventEnd && navEntry.domContentLoadedEventStart) {
              this.recordMetric(
                'DOM_PROCESSING',
                navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
                this.getRating(
                  'COMPONENT_RENDER',
                  navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart
                )
              );
            }
          }
        });

        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.set('navigation', navigationObserver);
      } catch (e) {
        console.warn('Navigation timing observer not supported');
      }
    }
  }

  // Measure paint timing
  private measurePaintTiming(): void {
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-paint') {
              this.recordMetric(
                'FIRST_PAINT',
                entry.startTime,
                this.getRating('FCP', entry.startTime)
              );
            } else if (entry.name === 'first-contentful-paint') {
              this.recordMetric(
                'FIRST_CONTENTFUL_PAINT',
                entry.startTime,
                this.getRating('FCP', entry.startTime)
              );
            }
          }
        });

        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.set('paint', paintObserver);
      } catch (e) {
        console.warn('Paint timing observer not supported');
      }
    }
  }

  // Measure resource timing for critical resources
  private measureResourceTiming(): void {
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const resourceEntry = entry as PerformanceResourceTiming;
            const resourceType = this.getResourceType(resourceEntry.name);

            // Only monitor critical resources
            if (['script', 'css', 'font', 'image'].includes(resourceType)) {
              const duration = resourceEntry.responseEnd - resourceEntry.fetchStart;

              this.recordMetric(
                `RESOURCE_${resourceType.toUpperCase()}`,
                duration,
                this.getRating('API_RESPONSE', duration)
              );

              // Check for slow resources
              if (duration > 3000) {
                addBreadcrumb(
                  `Slow resource: ${resourceEntry.name} (${duration.toFixed(2)}ms)`,
                  'performance',
                  'warning',
                  {
                    url: resourceEntry.name,
                    duration,
                    type: resourceType,
                    size: resourceEntry.transferSize || 0,
                  }
                );
              }
            }
          }
        });

        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('resource', resourceObserver);
      } catch (e) {
        console.warn('Resource timing observer not supported');
      }
    }
  }

  // Get resource type from URL
  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'css';
    if (url.includes('.woff') || url.includes('.ttf')) return 'font';
    if (url.includes('.jpg') || url.includes('.png') || url.includes('.webp')) return 'image';
    return 'other';
  }

  // Record performance metric
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
      id: crypto.randomUUID(),
      ...additionalData,
    };

    this.metrics.push(metric);

    // Trigger callbacks
    this.vitalsCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Performance callback error:', error);
      }
    });

    // Log poor performance immediately
    if (rating === 'poor') {
      addBreadcrumb(`Poor performance: ${name} = ${value.toFixed(2)}ms`, 'performance', 'warning', {
        name,
        value,
        rating,
        timestamp: Date.now(),
      });
    }

    // Limit metrics storage (memory management)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500); // Keep last 500 metrics
    }
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
  public getMetricsSummary(): {
    total: number;
    good: number;
    needsImprovement: number;
    poor: number;
    byType: Record<string, { count: number; avgValue: number; rating: string; trend?: string }>;
    coreWebVitals: Record<string, { value: number; rating: string; delta?: number }>;
  } {
    const summary = {
      total: this.metrics.length,
      good: this.metrics.filter(m => m.rating === 'good').length,
      needsImprovement: this.metrics.filter(m => m.rating === 'needs-improvement').length,
      poor: this.metrics.filter(m => m.rating === 'poor').length,
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
    this.observers.forEach(observer => observer.disconnect());
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
export const getPerformanceReport = (): {
  summary: ReturnType<PerformanceMonitor['getMetricsSummary']>;
  coreWebVitals: Record<string, { value: number; rating: string; delta?: number }>;
  recentMetrics: PerformanceMetric[];
  poorPerformance: PerformanceMetric[];
  trends: Record<string, string>;
  timestamp: string;
  pageInfo: {
    url: string;
    title: string;
    referrer: string;
    userAgent: string;
    connection: string;
    memory?: {
      used: number;
      total: number;
      limit: number;
    };
  };
} => {
  const metrics = performanceMonitor.getMetrics();
  const summary = performanceMonitor.getMetricsSummary();

  const extendedNavigator = navigator as ExtendedNavigator;
  const extendedPerformance = performance as ExtendedPerformance;

  return {
    summary,
    coreWebVitals: summary.coreWebVitals,
    recentMetrics: metrics.slice(-10),
    poorPerformance: metrics.filter(m => m.rating === 'poor').slice(-5),
    trends: Object.entries(summary.byType)
      .filter(([, data]) => data.trend !== 'stable')
      .reduce((acc, [name, data]) => ({ ...acc, [name]: data.trend }), {}),
    timestamp: new Date().toISOString(),
    pageInfo: {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      connection: extendedNavigator.connection?.effectiveType || 'unknown',
      memory: extendedPerformance.memory
        ? {
            used: extendedPerformance.memory.usedJSHeapSize,
            total: extendedPerformance.memory.totalJSHeapSize,
            limit: extendedPerformance.memory.jsHeapSizeLimit,
          }
        : undefined,
    },
  };
};

export default performanceMonitor;
