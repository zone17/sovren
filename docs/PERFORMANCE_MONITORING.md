# Performance Monitoring Implementation Guide

*Elite Engineering Documentation - Sovren Platform*

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Web Vitals Integration](#core-web-vitals-integration)
3. [Error Handling & Recovery](#error-handling--recovery)
4. [Performance Thresholds](#performance-thresholds)
5. [Monitoring Dashboard](#monitoring-dashboard)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Architecture Overview

The Sovren performance monitoring system implements cutting-edge performance tracking with enterprise-grade reliability and intelligent error handling.

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                Performance Monitoring System                │
├─────────────────────────────────────────────────────────────┤
│  Core Web Vitals v4  │  Custom Metrics  │  Error Handling  │
│  ─────────────────── │  ─────────────── │  ─────────────── │
│  • LCP              │  • API Response  │  • Safe Rating   │
│  • INP (new)        │  • Component     │  • Fallbacks     │
│  • CLS              │  • Navigation    │  • Recovery      │
│  • FCP              │  • Memory Usage  │  • Boundaries    │
│  • TTFB             │  • Long Tasks    │  • Logging       │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- **Real-time Monitoring**: Live performance metrics collection
- **Intelligent Fallbacks**: Safe handling of unknown metrics
- **Attribution Debugging**: Detailed performance attribution data
- **Memory Monitoring**: Chrome DevTools integration for memory tracking
- **Error Recovery**: Comprehensive error boundaries and graceful degradation

## Core Web Vitals Integration

### Implementation

```typescript
// packages/frontend/src/monitoring/performance.ts

import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals';

class PerformanceMonitor {
  private initWebVitals(): void {
    // Largest Contentful Paint - Core Web Vital
    onLCP((metric) => {
      this.recordMetric('LCP', metric.value, this.getRating('LCP', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
        attribution: (metric as any).attribution, // v4 attribution debugging
      });
    });

    // Interaction to Next Paint - NEW Core Web Vital (replaces FID)
    onINP((metric) => {
      this.recordMetric('INP', metric.value, this.getRating('INP', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
        attribution: (metric as any).attribution,
      });
    });

    // Cumulative Layout Shift - Core Web Vital
    onCLS((metric) => {
      this.recordMetric('CLS', metric.value, this.getRating('CLS', metric.value), {
        delta: metric.delta,
        entries: metric.entries,
        attribution: (metric as any).attribution,
      });
    });
  }
}
```

### 2024 Core Web Vitals Standards

| Metric | Good | Needs Improvement | Poor | Description |
|--------|------|-------------------|------|-------------|
| **LCP** | ≤ 2.5s | 2.5s - 4.0s | > 4.0s | Largest Contentful Paint |
| **INP** | ≤ 200ms | 200ms - 500ms | > 500ms | Interaction to Next Paint (NEW) |
| **CLS** | ≤ 0.1 | 0.1 - 0.25 | > 0.25 | Cumulative Layout Shift |
| **FCP** | ≤ 1.8s | 1.8s - 3.0s | > 3.0s | First Contentful Paint |
| **TTFB** | ≤ 800ms | 800ms - 1.8s | > 1.8s | Time to First Byte |

## Error Handling & Recovery

### The Critical Fix

**Problem Solved:** Runtime error `TypeError: Cannot read properties of undefined (reading 'good')`

**Root Cause:**
```typescript
// BEFORE (problematic)
private getRating(metricName: keyof typeof PERFORMANCE_THRESHOLDS, value: number) {
  const thresholds = PERFORMANCE_THRESHOLDS[metricName];
  // If metricName doesn't exist, thresholds is undefined
  if (value <= thresholds.good) return 'good'; // ❌ Error: undefined.good
}
```

**Solution Implemented:**
```typescript
// AFTER (elite solution)
private getRating(metricName: keyof typeof PERFORMANCE_THRESHOLDS, value: number) {
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

// Safe rating method with intelligent fallbacks
private getSafeRating(metricName: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  // Check if metric exists in thresholds
  if (metricName in PERFORMANCE_THRESHOLDS) {
    return this.getRating(metricName as keyof typeof PERFORMANCE_THRESHOLDS, value);
  }

  // Intelligent fallbacks based on metric type
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
```

### Why This Solution Works

1. **Null Safety**: Prevents undefined property access
2. **Intelligent Fallbacks**: Provides reasonable defaults based on metric type
3. **Maintains Functionality**: Continues monitoring without losing data
4. **Future-Proof**: Handles new metrics automatically
5. **Performance**: Minimal overhead with smart categorization

## Performance Thresholds

### Threshold Configuration

```typescript
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
```

### Fallback Strategy

```typescript
// Intelligent fallback categorization
const getMetricCategory = (metricName: string) => {
  if (metricName.includes('CLS') || metricName.includes('SHIFT')) {
    return 'layout'; // 0-1 scale metrics
  }
  if (metricName.includes('API') || metricName.includes('RESPONSE')) {
    return 'api'; // Network-related metrics
  }
  if (metricName.includes('RENDER') || metricName.includes('COMPONENT')) {
    return 'render'; // UI rendering metrics
  }
  if (metricName.includes('MEMORY') || metricName.includes('HEAP')) {
    return 'memory'; // Memory-related metrics
  }
  return 'generic'; // Default time-based metrics
};
```

## Monitoring Dashboard

### Real-time Performance Display

```typescript
// packages/frontend/src/components/MonitoringDashboard.tsx

const MonitoringDashboard: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);

  useEffect(() => {
    const updateData = () => {
      try {
        const report = getPerformanceReport();
        setPerformanceData(report);
      } catch (error) {
        console.warn('Performance data update failed:', error);
        // Graceful degradation - continue with last known data
      }
    };

    // Update every 2 seconds
    const interval = setInterval(updateData, 2000);
    updateData(); // Initial load

    return () => clearInterval(interval);
  }, []);

  if (!performanceData) {
    return (
      <div className="p-4 text-center">
        <div className="animate-pulse">Loading performance data...</div>
      </div>
    );
  }

  return (
    <div className="performance-dashboard">
      {/* Core Web Vitals Display */}
      <CoreWebVitalsSection data={performanceData.summary.coreWebVitals} />

      {/* Performance Issues Alerts */}
      <PerformanceIssues issues={performanceData.poorPerformance} />

      {/* Real-time Metrics */}
      <RealtimeMetrics metrics={performanceData.recentMetrics} />
    </div>
  );
};
```

### Dashboard Features

- **Real-time Updates**: Live performance metrics every 2 seconds
- **Error Recovery**: Graceful degradation when data unavailable
- **Visual Indicators**: Color-coded performance status
- **Trend Analysis**: Performance trends over time
- **Issue Alerts**: Immediate alerts for poor performance

## Advanced Features

### Memory Monitoring

```typescript
// Chrome DevTools Integration
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
```

### Long Task Detection

```typescript
// Monitor tasks longer than 50ms
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
```

### Layout Shift Attribution

```typescript
// Detailed CLS tracking with source attribution
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
```

## Troubleshooting

### Common Issues

#### 1. Performance Monitoring Not Working

**Symptoms:**
- No performance data in dashboard
- Console warnings about observers

**Solution:**
```typescript
// Check browser support
if ('PerformanceObserver' in window) {
  // Initialize observers
} else {
  console.warn('PerformanceObserver not supported - using fallback metrics');
  // Implement fallback performance tracking
}
```

#### 2. Memory Leaks in Monitoring

**Symptoms:**
- Increasing memory usage over time
- Browser becomes sluggish

**Solution:**
```typescript
// Proper cleanup in PerformanceMonitor
public disconnect(): void {
  this.observers.forEach((observer) => observer.disconnect());
  this.observers.clear();
  this.vitalsCallbacks = [];

  // Clear old metrics to prevent memory buildup
  if (this.metrics.length > 500) {
    this.metrics = this.metrics.slice(-400);
  }
}
```

#### 3. Incorrect Performance Ratings

**Symptoms:**
- All metrics showing as "poor"
- Warnings about unknown metrics

**Solution:**
```typescript
// Verify threshold configuration
console.log('Available thresholds:', Object.keys(PERFORMANCE_THRESHOLDS));

// Check metric names
console.log('Recorded metrics:', this.metrics.map(m => m.name));

// Use safe rating method
const rating = this.getSafeRating(metricName, value);
```

### Debug Tools

```typescript
// Performance debugging utilities
export const debugPerformance = () => {
  const report = getPerformanceReport();

  console.group('🔍 Performance Debug Report');
  console.log('Summary:', report.summary);
  console.log('Core Web Vitals:', report.coreWebVitals);
  console.log('Poor Performance:', report.poorPerformance);
  console.log('Trends:', report.trends);
  console.groupEnd();

  return report;
};

// Browser console usage:
// debugPerformance()
```

## Best Practices

### 1. Metric Collection

- **Selective Monitoring**: Only collect metrics that provide actionable insights
- **Memory Management**: Limit stored metrics to prevent memory leaks
- **Error Handling**: Always use safe rating methods for unknown metrics
- **Attribution**: Include attribution data for debugging performance issues

### 2. Threshold Configuration

- **Evidence-Based**: Set thresholds based on actual user experience data
- **Regular Updates**: Review and update thresholds based on performance improvements
- **Context-Aware**: Consider different thresholds for different user segments
- **Documentation**: Document why specific thresholds were chosen

### 3. Dashboard Design

- **Real-time Updates**: Show live performance data for immediate feedback
- **Actionable Alerts**: Only alert on issues that require immediate attention
- **Trend Analysis**: Show performance trends to identify gradual degradations
- **Error Recovery**: Handle data collection failures gracefully

### 4. Production Deployment

- **Gradual Rollout**: Deploy performance monitoring incrementally
- **Error Monitoring**: Use Sentry integration for production error tracking
- **Performance Impact**: Ensure monitoring doesn't impact app performance
- **User Privacy**: Respect user privacy when collecting performance data

## Integration Examples

### API Response Monitoring

```typescript
// Wrap API calls with performance monitoring
export const measureApiCall = <T>(url: string, operation: () => Promise<T>): Promise<T> => {
  return performanceMonitor.measureAsync(`API_${url.split('/').pop()}`, operation);
};

// Usage
const fetchUserData = () =>
  measureApiCall('/api/users', () => fetch('/api/users').then(r => r.json()));
```

### Component Render Monitoring

```typescript
// Monitor React component render performance
export const measureComponentRender = <T>(componentName: string, operation: () => T): T => {
  return performanceMonitor.measureSync(`RENDER_${componentName}`, operation);
};

// Usage in React component
const MyComponent = () => {
  return measureComponentRender('MyComponent', () => {
    // Component render logic
    return <div>Component content</div>;
  });
};
```

### Route Change Monitoring

```typescript
// Monitor navigation performance
export const measureRouteChange = <T>(routeName: string, operation: () => Promise<T>): Promise<T> => {
  return performanceMonitor.measureAsync(`ROUTE_${routeName}`, operation);
};

// Usage with React Router
const navigate = useNavigate();
const handleNavigation = (route: string) => {
  measureRouteChange(route, () => navigate(route));
};
```

---

*This documentation represents elite engineering practices with comprehensive performance monitoring, intelligent error handling, and production-ready implementations. The system ensures reliable performance tracking while maintaining application stability and user experience.*
