/**
 * 📊 **ANALYTICS PERFORMANCE MONITORING UTILITIES**
 *
 * Elite Engineering Standards:
 * - Real-time performance tracking
 * - Comprehensive metrics collection
 * - Performance optimization insights
 * - Error rate monitoring
 */

import { AnalyticsError } from '../types';

// 📈 **PERFORMANCE METRICS INTERFACES**

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorType?: string;
  cacheHit?: boolean;
  dataSize?: number;
  retryCount?: number;
}

export interface AnalyticsPerformanceStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  requestsPerSecond: number;
  slowestOperations: Array<{
    operation: string;
    averageDuration: number;
    count: number;
  }>;
  errorBreakdown: Record<string, number>;
}

export interface PerformanceAlert {
  id: string;
  type: 'slow_response' | 'high_error_rate' | 'cache_miss' | 'timeout';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
  suggestions: string[];
}

export interface OptimizationSuggestion {
  category: 'caching' | 'batching' | 'filtering' | 'timeout' | 'retry';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImprovement: string;
  implementationEffort: 'low' | 'medium' | 'high';
  actionItems: string[];
}

// 🔧 **PERFORMANCE MONITORING CLASS**
class AnalyticsPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private maxMetricsHistory = 1000;
  private alertThresholds = {
    slowResponse: 5000, // 5 seconds
    highErrorRate: 10, // 10%
    lowCacheHit: 70, // 70%
    requestTimeout: 10000, // 10 seconds
  };

  // 📊 **START TRACKING OPERATION**
  startOperation(operation: string): string {
    const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const metric: PerformanceMetric = {
      operation,
      startTime: performance.now(),
      success: false,
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    return operationId;
  }

  // ✅ **END TRACKING OPERATION**
  endOperation(
    operationId: string,
    options: {
      success: boolean;
      errorType?: string;
      cacheHit?: boolean;
      dataSize?: number;
      retryCount?: number;
    }
  ): void {
    // Find the metric by looking for recent operations with matching pattern
    const operation = operationId.split('-')[0];
    const metric = this.metrics
      .slice()
      .reverse()
      .find((m) => m.operation === operation && !m.endTime);

    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.success = options.success;
      metric.errorType = options.errorType;
      metric.cacheHit = options.cacheHit;
      metric.dataSize = options.dataSize;
      metric.retryCount = options.retryCount;

      // Check for performance alerts
      this.checkAlerts(metric);
    }
  }

  // 🚨 **CHECK FOR PERFORMANCE ALERTS**
  private checkAlerts(metric: PerformanceMetric): void {
    const now = new Date().toISOString();

    // Slow response alert
    if (metric.duration && metric.duration > this.alertThresholds.slowResponse) {
      this.alerts.push({
        id: `slow-${Date.now()}`,
        type: 'slow_response',
        severity: metric.duration > 10000 ? 'critical' : 'high',
        message: `Slow response detected: ${metric.operation} took ${metric.duration.toFixed(0)}ms`,
        metric: metric.operation,
        value: metric.duration,
        threshold: this.alertThresholds.slowResponse,
        timestamp: now,
        suggestions: [
          'Check network connectivity',
          'Optimize database queries',
          'Implement caching for this operation',
          'Consider request batching',
        ],
      });
    }

    // Cache miss alert (if caching is expected)
    if (
      metric.cacheHit === false &&
      ['getCreatorEarnings', 'getChartData'].includes(metric.operation)
    ) {
      this.alerts.push({
        id: `cache-miss-${Date.now()}`,
        type: 'cache_miss',
        severity: 'medium',
        message: `Cache miss for operation: ${metric.operation}`,
        metric: metric.operation,
        value: 0,
        threshold: 1,
        timestamp: now,
        suggestions: [
          'Check cache expiration settings',
          'Verify cache invalidation logic',
          'Consider pre-warming cache',
        ],
      });
    }

    // Keep only recent alerts
    this.alerts = this.alerts.slice(-100);
  }

  // 📈 **GET PERFORMANCE STATISTICS**
  getPerformanceStats(timeWindowMs = 300000): AnalyticsPerformanceStats {
    const now = performance.now();
    const recentMetrics = this.metrics.filter((m) => m.endTime && now - m.endTime <= timeWindowMs);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        requestsPerSecond: 0,
        slowestOperations: [],
        errorBreakdown: {},
      };
    }

    const totalRequests = recentMetrics.length;
    const successfulRequests = recentMetrics.filter((m) => m.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const durations = recentMetrics
      .map((m) => m.duration!)
      .filter((d) => d !== undefined)
      .sort((a, b) => a - b);

    const averageResponseTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const medianResponseTime = durations[Math.floor(durations.length / 2)] || 0;
    const p95ResponseTime = durations[Math.floor(durations.length * 0.95)] || 0;

    const errorRate = (failedRequests / totalRequests) * 100;

    const cacheableMetrics = recentMetrics.filter((m) => m.cacheHit !== undefined);
    const cacheHitRate =
      cacheableMetrics.length > 0
        ? (cacheableMetrics.filter((m) => m.cacheHit).length / cacheableMetrics.length) * 100
        : 0;

    const timeWindowSeconds = timeWindowMs / 1000;
    const requestsPerSecond = totalRequests / timeWindowSeconds;

    // Calculate slowest operations
    const operationStats = new Map<string, { totalDuration: number; count: number }>();
    recentMetrics.forEach((m) => {
      if (m.duration) {
        const existing = operationStats.get(m.operation) || { totalDuration: 0, count: 0 };
        operationStats.set(m.operation, {
          totalDuration: existing.totalDuration + m.duration,
          count: existing.count + 1,
        });
      }
    });

    const slowestOperations = Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        averageDuration: stats.totalDuration / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    recentMetrics
      .filter((m) => !m.success && m.errorType)
      .forEach((m) => {
        errorBreakdown[m.errorType!] = (errorBreakdown[m.errorType!] || 0) + 1;
      });

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      medianResponseTime,
      p95ResponseTime,
      errorRate,
      cacheHitRate,
      requestsPerSecond,
      slowestOperations,
      errorBreakdown,
    };
  }

  // 🚨 **GET ACTIVE ALERTS**
  getActiveAlerts(): PerformanceAlert[] {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return this.alerts.filter((alert) => alert.timestamp > oneHourAgo);
  }

  // 💡 **GET OPTIMIZATION SUGGESTIONS**
  getOptimizationSuggestions(stats: AnalyticsPerformanceStats): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Caching suggestions
    if (stats.cacheHitRate < 70) {
      suggestions.push({
        category: 'caching',
        priority: 'high',
        title: 'Improve Cache Hit Rate',
        description: `Current cache hit rate is ${stats.cacheHitRate.toFixed(1)}%. Improving caching can significantly reduce response times.`,
        expectedImprovement: '50-80% reduction in response time',
        implementationEffort: 'medium',
        actionItems: [
          'Review cache TTL settings',
          'Implement cache warming strategies',
          'Add more granular cache keys',
          'Consider using service worker for client-side caching',
        ],
      });
    }

    // Error rate suggestions
    if (stats.errorRate > 5) {
      suggestions.push({
        category: 'retry',
        priority: 'high',
        title: 'Reduce Error Rate',
        description: `Error rate of ${stats.errorRate.toFixed(1)}% is above acceptable threshold. Implementing better error handling can improve reliability.`,
        expectedImprovement: '60-90% reduction in failed requests',
        implementationEffort: 'medium',
        actionItems: [
          'Implement exponential backoff retry logic',
          'Add circuit breaker pattern',
          'Improve error handling and recovery',
          'Add request timeout configurations',
        ],
      });
    }

    // Response time suggestions
    if (stats.averageResponseTime > 2000) {
      suggestions.push({
        category: 'batching',
        priority: 'medium',
        title: 'Optimize Response Times',
        description: `Average response time of ${stats.averageResponseTime.toFixed(0)}ms could be improved through batching and optimization.`,
        expectedImprovement: '30-50% reduction in response time',
        implementationEffort: 'high',
        actionItems: [
          'Implement request batching',
          'Optimize data serialization',
          'Add response compression',
          'Consider GraphQL for efficient data fetching',
        ],
      });
    }

    // Filtering suggestions for high request volume
    if (stats.requestsPerSecond > 10) {
      suggestions.push({
        category: 'filtering',
        priority: 'medium',
        title: 'Optimize High-Volume Operations',
        description: `High request volume (${stats.requestsPerSecond.toFixed(1)} req/s) suggests opportunities for request optimization.`,
        expectedImprovement: '40-60% reduction in server load',
        implementationEffort: 'medium',
        actionItems: [
          'Implement client-side filtering',
          'Add pagination for large datasets',
          'Use debouncing for frequent requests',
          'Consider real-time subscriptions instead of polling',
        ],
      });
    }

    // Timeout suggestions
    if (stats.slowestOperations.some((op) => op.averageDuration > 8000)) {
      suggestions.push({
        category: 'timeout',
        priority: 'high',
        title: 'Address Slow Operations',
        description: 'Some operations are taking too long and may be causing timeouts.',
        expectedImprovement: '70-90% reduction in timeout errors',
        implementationEffort: 'low',
        actionItems: [
          'Set appropriate timeout values',
          'Implement request cancellation',
          'Add loading states for slow operations',
          'Consider breaking down large operations',
        ],
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // 🔄 **RESET METRICS**
  resetMetrics(): void {
    this.metrics = [];
    this.alerts = [];
  }

  // 📊 **GET REAL-TIME PERFORMANCE DASHBOARD DATA**
  getDashboardData(): {
    currentStats: AnalyticsPerformanceStats;
    alerts: PerformanceAlert[];
    suggestions: OptimizationSuggestion[];
    healthScore: number;
  } {
    const currentStats = this.getPerformanceStats();
    const alerts = this.getActiveAlerts();
    const suggestions = this.getOptimizationSuggestions(currentStats);

    // Calculate health score (0-100)
    let healthScore = 100;

    // Penalize for high error rate
    if (currentStats.errorRate > 0) {
      healthScore -= Math.min(currentStats.errorRate * 5, 50);
    }

    // Penalize for slow response times
    if (currentStats.averageResponseTime > 1000) {
      healthScore -= Math.min((currentStats.averageResponseTime - 1000) / 100, 30);
    }

    // Penalize for low cache hit rate
    if (currentStats.cacheHitRate < 80) {
      healthScore -= Math.min((80 - currentStats.cacheHitRate) / 2, 20);
    }

    // Penalize for active alerts
    alerts.forEach((alert) => {
      switch (alert.severity) {
        case 'critical':
          healthScore -= 20;
          break;
        case 'high':
          healthScore -= 10;
          break;
        case 'medium':
          healthScore -= 5;
          break;
        case 'low':
          healthScore -= 2;
          break;
      }
    });

    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      currentStats,
      alerts,
      suggestions,
      healthScore,
    };
  }
}

// 🎯 **SINGLETON INSTANCE**
export const performanceMonitor = new AnalyticsPerformanceMonitor();

// 🔧 **PERFORMANCE TRACKING DECORATOR**
export const trackPerformance = <T extends (...args: any[]) => Promise<any>>(
  operation: string,
  fn: T
): T => {
  return (async (...args: any[]) => {
    const operationId = performanceMonitor.startOperation(operation);
    let cacheHit = false;
    const retryCount = 0;
    let dataSize = 0;

    try {
      const result = await fn(...args);

      // Try to detect cache hits and data size
      if (result && typeof result === 'object') {
        // Check for cache indicators
        cacheHit = result.__fromCache === true;

        // Estimate data size
        try {
          dataSize = JSON.stringify(result).length;
        } catch {
          dataSize = 0;
        }
      }

      performanceMonitor.endOperation(operationId, {
        success: true,
        cacheHit,
        dataSize,
        retryCount,
      });

      return result;
    } catch (error) {
      let errorType = 'unknown';

      if (error instanceof AnalyticsError) {
        errorType = error.code;
      } else if (error instanceof Error) {
        errorType = error.name;
      }

      performanceMonitor.endOperation(operationId, {
        success: false,
        errorType,
        cacheHit,
        dataSize,
        retryCount,
      });

      throw error;
    }
  }) as T;
};

// 📱 **MOBILE PERFORMANCE OPTIMIZATION**
export const optimizeForMobile = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  // Reduce precision for mobile to save bandwidth
  const optimized = { ...data };

  // Round numbers to reasonable precision
  if (Array.isArray(optimized)) {
    return optimized.map((item) => optimizeForMobile(item));
  }

  Object.keys(optimized).forEach((key) => {
    const value = optimized[key];

    if (typeof value === 'number') {
      // Round to 2 decimal places for most numbers
      optimized[key] = Math.round(value * 100) / 100;
    } else if (typeof value === 'object' && value !== null) {
      optimized[key] = optimizeForMobile(value);
    }
  });

  return optimized;
};

// 🔍 **PERFORMANCE ANALYSIS UTILITIES**
export const analyzePerformanceBottlenecks = (
  stats: AnalyticsPerformanceStats
): {
  bottlenecks: Array<{
    issue: string;
    severity: 'low' | 'medium' | 'high';
    impact: string;
    recommendation: string;
  }>;
  overallAssessment: string;
} => {
  const bottlenecks: Array<{
    issue: string;
    severity: 'low' | 'medium' | 'high';
    impact: string;
    recommendation: string;
  }> = [];

  // Analyze error rate
  if (stats.errorRate > 10) {
    bottlenecks.push({
      issue: 'High Error Rate',
      severity: 'high',
      impact: 'Users experiencing frequent failures',
      recommendation: 'Implement better error handling and retry logic',
    });
  }

  // Analyze response times
  if (stats.p95ResponseTime > 5000) {
    bottlenecks.push({
      issue: 'Slow Response Times',
      severity: 'high',
      impact: 'Poor user experience with long wait times',
      recommendation: 'Optimize queries and implement caching',
    });
  }

  // Analyze cache performance
  if (stats.cacheHitRate < 50) {
    bottlenecks.push({
      issue: 'Poor Cache Performance',
      severity: 'medium',
      impact: 'Unnecessary load on backend services',
      recommendation: 'Review cache strategy and TTL settings',
    });
  }

  // Analyze request volume
  if (stats.requestsPerSecond > 50) {
    bottlenecks.push({
      issue: 'High Request Volume',
      severity: 'medium',
      impact: 'Potential for rate limiting and throttling',
      recommendation: 'Implement request batching and optimize polling',
    });
  }

  const overallAssessment =
    bottlenecks.length === 0
      ? '✅ Performance is within acceptable limits'
      : bottlenecks.some((b) => b.severity === 'high')
        ? '🚨 Critical performance issues detected'
        : '⚠️ Some performance optimizations recommended';

  return { bottlenecks, overallAssessment };
};
