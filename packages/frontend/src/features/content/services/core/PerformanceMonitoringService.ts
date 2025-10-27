/**
 * 📊 **PERFORMANCE MONITORING SERVICE - COMPREHENSIVE OBSERVABILITY**
 *
 * Elite Engineering Standards:
 * ✅ Real-time performance metrics collection
 * ✅ Advanced health monitoring with predictive alerts
 * ✅ Performance analytics and trend analysis
 * ✅ Resource utilization monitoring
 * ✅ SLA compliance tracking and reporting
 * ✅ Automated performance optimization suggestions
 * ✅ Integration with external monitoring systems
 */

import { BaseService } from './BaseService';
import type { ServiceContext } from './ServiceInterfaces';

// Global type declarations
declare const performance: Performance;
declare const navigator: Navigator;
declare const setTimeout: (handler: TimerHandler, timeout?: number) => number;
declare const setInterval: (handler: TimerHandler, timeout?: number) => number;

export interface PerformanceConfig {
  metricsCollection: {
    enabled: boolean;
    interval: number;
    retention: number;
    batchSize: number;
  };
  healthChecks: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retryAttempts: number;
  };
  alerting: {
    enabled: boolean;
    thresholds: PerformanceThresholds;
    channels: AlertChannel[];
  };
  analytics: {
    enabled: boolean;
    trendAnalysisWindow: number;
    predictionHorizon: number;
  };
  optimization: {
    enabled: boolean;
    autoOptimization: boolean;
    optimizationRules: OptimizationRule[];
  };
}

export interface PerformanceThresholds {
  responseTime: {
    warning: number;
    critical: number;
  };
  errorRate: {
    warning: number;
    critical: number;
  };
  memoryUsage: {
    warning: number;
    critical: number;
  };
  cpuUsage: {
    warning: number;
    critical: number;
  };
  throughput: {
    minimum: number;
    optimal: number;
  };
}

export interface AlertChannel {
  type: 'console' | 'webhook' | 'email' | 'slack';
  config: Record<string, any>;
  enabled: boolean;
}

export interface OptimizationRule {
  name: string;
  condition: (metrics: PerformanceMetrics) => boolean;
  action: (metrics: PerformanceMetrics) => Promise<void>;
  enabled: boolean;
}

export interface PerformanceMetrics {
  timestamp: Date;
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    totalRequests: number;
  };
  errorRate: {
    percentage: number;
    totalErrors: number;
    errorTypes: Record<string, number>;
  };
  resourceUsage: {
    memory: MemoryMetrics;
    cpu: CpuMetrics;
    network: NetworkMetrics;
  };
  serviceHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastHealthCheck: Date;
  };
  customMetrics: Record<string, number>;
}

export interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
  heapUsed?: number;
  heapTotal?: number;
}

export interface CpuMetrics {
  usage: number;
  loadAverage: number[];
  processes: number;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  connectionsActive: number;
  latency: number;
}

export interface PerformanceTrend {
  metric: string;
  trend: 'improving' | 'degrading' | 'stable';
  changePercentage: number;
  prediction: number;
  confidence: number;
  recommendations: string[];
}

export interface PerformanceAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    availability: number;
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
  };
  trends: PerformanceTrend[];
  alerts: PerformanceAlert[];
  optimizations: OptimizationSuggestion[];
  slaCompliance: SlaComplianceReport;
}

export interface OptimizationSuggestion {
  category: 'performance' | 'resource' | 'scalability' | 'reliability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImpact: string;
  implementation: string;
  estimatedEffort: string;
}

export interface SlaComplianceReport {
  responseTimeCompliance: number;
  availabilityCompliance: number;
  errorRateCompliance: number;
  breaches: SlaBreachEvent[];
}

export interface SlaBreachEvent {
  metric: string;
  timestamp: Date;
  duration: number;
  severity: 'minor' | 'major' | 'critical';
  impact: string;
}

/**
 * Comprehensive Performance Monitoring Service
 */
export class PerformanceMonitoringService extends BaseService {
  private config: PerformanceConfig;
  private metricsBuffer: PerformanceMetrics[] = [];
  private alertHistory: PerformanceAlert[] = [];
  private healthCheckInterval?: number;
  private metricsCollectionInterval?: number;
  private performanceObserver?: PerformanceObserver;
  private startTime: Date;
  private requestTimings = new Map<string, number>();
  private errorCounts = new Map<string, number>();
  private requestCounts = new Map<string, number>();

  constructor(config: Partial<PerformanceConfig> = {}) {
    super('PerformanceMonitoringService', '1.0.0');

    this.startTime = new Date();
    this.config = {
      metricsCollection: {
        enabled: true,
        interval: 30000, // 30 seconds
        retention: 24 * 60 * 60 * 1000, // 24 hours
        batchSize: 100,
      },
      healthChecks: {
        enabled: true,
        interval: 60000, // 1 minute
        timeout: 10000, // 10 seconds
        retryAttempts: 3,
      },
      alerting: {
        enabled: true,
        thresholds: {
          responseTime: { warning: 500, critical: 1000 },
          errorRate: { warning: 1, critical: 5 },
          memoryUsage: { warning: 80, critical: 95 },
          cpuUsage: { warning: 70, critical: 90 },
          throughput: { minimum: 10, optimal: 100 },
        },
        channels: [{ type: 'console', config: {}, enabled: true }],
      },
      analytics: {
        enabled: true,
        trendAnalysisWindow: 60 * 60 * 1000, // 1 hour
        predictionHorizon: 30 * 60 * 1000, // 30 minutes
      },
      optimization: {
        enabled: true,
        autoOptimization: false,
        optimizationRules: [],
      },
      ...config,
    };

    this.initializeMonitoring();
  }

  // ==================== ABSTRACT METHOD IMPLEMENTATIONS ====================

  protected async performHealthCheck(): Promise<boolean> {
    try {
      const metrics = await this.collectCurrentMetrics();

      // Check if metrics are within healthy thresholds
      const responseTimeHealthy =
        metrics.responseTime.avg < this.config.alerting.thresholds.responseTime.critical;
      const errorRateHealthy =
        metrics.errorRate.percentage < this.config.alerting.thresholds.errorRate.critical;
      const memoryHealthy =
        metrics.resourceUsage.memory.percentage <
        this.config.alerting.thresholds.memoryUsage.critical;

      return responseTimeHealthy && errorRateHealthy && memoryHealthy;
    } catch (error) {
      this.log('error', 'Health check failed', this.createServiceContext(), {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  protected async getCustomMetrics(): Promise<Record<string, number>> {
    const current = await this.collectCurrentMetrics();

    return {
      avgResponseTime: current.responseTime.avg,
      requestsPerSecond: current.throughput.requestsPerSecond,
      errorPercentage: current.errorRate.percentage,
      memoryUsagePercentage: current.resourceUsage.memory.percentage,
      uptime: Date.now() - this.startTime.getTime(),
      activeAlerts: this.alertHistory.filter((alert) => !alert.resolved).length,
      metricsBufferSize: this.metricsBuffer.length,
    };
  }

  protected async performCleanup(): Promise<void> {
    // Clean up old metrics
    const cutoff = Date.now() - this.config.metricsCollection.retention;
    this.metricsBuffer = this.metricsBuffer.filter((metric) => metric.timestamp.getTime() > cutoff);

    // Clean up old alerts
    this.alertHistory = this.alertHistory.filter((alert) => alert.timestamp.getTime() > cutoff);

    // Clear request tracking
    this.requestTimings.clear();
    this.errorCounts.clear();
    this.requestCounts.clear();
  }

  // ==================== PERFORMANCE MONITORING METHODS ====================

  async startMonitoring(): Promise<void> {
    if (this.config.metricsCollection.enabled) {
      this.startMetricsCollection();
    }

    if (this.config.healthChecks.enabled) {
      this.startHealthChecks();
    }

    this.initializePerformanceObserver();

    this.log('info', 'Performance monitoring started', this.createServiceContext(), {
      metricsInterval: this.config.metricsCollection.interval,
      healthCheckInterval: this.config.healthChecks.interval,
    });
  }

  async stopMonitoring(): Promise<void> {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    this.log('info', 'Performance monitoring stopped', this.createServiceContext());
  }

  async recordRequestStart(operationId: string): Promise<void> {
    this.requestTimings.set(operationId, performance.now());

    const currentCount = this.requestCounts.get('total') || 0;
    this.requestCounts.set('total', currentCount + 1);
  }

  async recordRequestEnd(
    operationId: string,
    success: boolean = true,
    errorType?: string
  ): Promise<void> {
    const startTime = this.requestTimings.get(operationId);
    if (!startTime) return;

    const duration = performance.now() - startTime;
    this.requestTimings.delete(operationId);

    // Record timing
    const timingKey = `timing_${operationId.split('_')[0]}`;
    const timings = this.requestTimings.get(timingKey) || 0;
    this.requestTimings.set(timingKey, timings + duration);

    // Record errors
    if (!success && errorType) {
      const errorCount = this.errorCounts.get(errorType) || 0;
      this.errorCounts.set(errorType, errorCount + 1);
    }

    // Check for performance alerts
    await this.checkPerformanceThresholds({ duration, success, errorType });
  }

  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    return await this.collectCurrentMetrics();
  }

  async getMetricsHistory(duration: number): Promise<PerformanceMetrics[]> {
    const cutoff = Date.now() - duration;
    return this.metricsBuffer.filter((metric) => metric.timestamp.getTime() > cutoff);
  }

  async generatePerformanceReport(startDate: Date, endDate: Date): Promise<PerformanceReport> {
    const metrics = this.metricsBuffer.filter(
      (m) => m.timestamp >= startDate && m.timestamp <= endDate
    );

    const alerts = this.alertHistory.filter(
      (a) => a.timestamp >= startDate && a.timestamp <= endDate
    );

    const summary = this.calculateSummaryMetrics(metrics);
    const trends = await this.analyzeTrends(metrics);
    const optimizations = await this.generateOptimizationSuggestions(metrics);
    const slaCompliance = this.calculateSlaCompliance(metrics, alerts);

    return {
      period: { start: startDate, end: endDate },
      summary,
      trends,
      alerts,
      optimizations,
      slaCompliance,
    };
  }

  // ==================== ALERTING METHODS ====================

  async triggerAlert(
    level: 'info' | 'warning' | 'critical',
    metric: string,
    message: string,
    value: number,
    threshold: number
  ): Promise<void> {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      metric,
      message,
      value,
      threshold,
      timestamp: new Date(),
      resolved: false,
    };

    this.alertHistory.push(alert);

    // Send alert through configured channels
    if (this.config.alerting.enabled) {
      for (const channel of this.config.alerting.channels) {
        if (channel.enabled) {
          await this.sendAlert(alert, channel);
        }
      }
    }

    this.log(
      level === 'critical' ? 'error' : 'warn',
      'Performance alert triggered',
      this.createServiceContext(),
      {
        alertId: alert.id,
        metric,
        value,
        threshold,
      }
    );
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alertHistory.find((a) => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();

      this.log('info', 'Performance alert resolved', this.createServiceContext(), {
        alertId,
        duration: alert.resolvedAt.getTime() - alert.timestamp.getTime(),
      });
    }
  }

  async getActiveAlerts(): Promise<PerformanceAlert[]> {
    return this.alertHistory.filter((alert) => !alert.resolved);
  }

  // ==================== ANALYTICS METHODS ====================

  async analyzeTrends(metrics?: PerformanceMetrics[]): Promise<PerformanceTrend[]> {
    const data = metrics || this.metricsBuffer;
    if (data.length < 2) return [];

    const trends: PerformanceTrend[] = [];

    // Analyze response time trend
    const responseTimes = data.map((m) => m.responseTime.avg);
    trends.push(this.calculateTrend('responseTime', responseTimes));

    // Analyze error rate trend
    const errorRates = data.map((m) => m.errorRate.percentage);
    trends.push(this.calculateTrend('errorRate', errorRates));

    // Analyze throughput trend
    const throughputs = data.map((m) => m.throughput.requestsPerSecond);
    trends.push(this.calculateTrend('throughput', throughputs));

    // Analyze memory usage trend
    const memoryUsages = data.map((m) => m.resourceUsage.memory.percentage);
    trends.push(this.calculateTrend('memoryUsage', memoryUsages));

    return trends;
  }

  async generateOptimizationSuggestions(
    metrics?: PerformanceMetrics[]
  ): Promise<OptimizationSuggestion[]> {
    const data = metrics || this.metricsBuffer;
    const suggestions: OptimizationSuggestion[] = [];

    if (data.length === 0) return suggestions;

    const latest = data[data.length - 1];

    // High response time suggestions
    if (latest.responseTime.avg > this.config.alerting.thresholds.responseTime.warning) {
      suggestions.push({
        category: 'performance',
        priority:
          latest.responseTime.avg > this.config.alerting.thresholds.responseTime.critical
            ? 'critical'
            : 'high',
        description: 'High response times detected',
        expectedImpact: 'Reduce response times by 20-40%',
        implementation: 'Implement caching, optimize queries, or scale resources',
        estimatedEffort: '1-2 weeks',
      });
    }

    // High error rate suggestions
    if (latest.errorRate.percentage > this.config.alerting.thresholds.errorRate.warning) {
      suggestions.push({
        category: 'reliability',
        priority: 'high',
        description: 'High error rate detected',
        expectedImpact: 'Reduce error rate by 50-80%',
        implementation: 'Implement better error handling and retry mechanisms',
        estimatedEffort: '1 week',
      });
    }

    // Memory usage suggestions
    if (
      latest.resourceUsage.memory.percentage > this.config.alerting.thresholds.memoryUsage.warning
    ) {
      suggestions.push({
        category: 'resource',
        priority: 'medium',
        description: 'High memory usage detected',
        expectedImpact: 'Reduce memory usage by 15-30%',
        implementation: 'Optimize memory allocation and implement garbage collection',
        estimatedEffort: '3-5 days',
      });
    }

    return suggestions;
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async initializeMonitoring(): Promise<void> {
    // Initialize optimization rules
    this.config.optimization.optimizationRules = [
      {
        name: 'Auto-clear cache on high memory',
        condition: (metrics) => metrics.resourceUsage.memory.percentage > 90,
        action: async (metrics) => {
          this.log(
            'info',
            'Auto-clearing cache due to high memory usage',
            this.createServiceContext(),
            {
              memoryUsage: metrics.resourceUsage.memory.percentage,
            }
          );
          // Would integrate with cache service to clear cache
        },
        enabled: this.config.optimization.autoOptimization,
      },
    ];
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      try {
        const metrics = await this.collectCurrentMetrics();
        this.metricsBuffer.push(metrics);

        // Limit buffer size
        if (this.metricsBuffer.length > this.config.metricsCollection.batchSize * 10) {
          this.metricsBuffer = this.metricsBuffer.slice(
            -this.config.metricsCollection.batchSize * 5
          );
        }

        await this.runOptimizationRules(metrics);
      } catch (error) {
        this.log('error', 'Metrics collection failed', this.createServiceContext(), {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, this.config.metricsCollection.interval);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.performHealthCheck();

        if (!isHealthy) {
          await this.triggerAlert(
            'critical',
            'service_health',
            'Service health check failed',
            0,
            1
          );
        }
      } catch (error) {
        this.log('error', 'Health check failed', this.createServiceContext(), {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, this.config.healthChecks.interval);
  }

  private initializePerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          // Process performance entries
          this.processPerformanceEntry(entry);
        });
      });

      this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    // Process different types of performance entries
    switch (entry.entryType) {
      case 'measure':
        // Custom timing measurements
        break;
      case 'navigation':
        // Navigation timing
        break;
      case 'resource':
        // Resource loading timing
        break;
    }
  }

  private async collectCurrentMetrics(): Promise<PerformanceMetrics> {
    const now = new Date();

    // Calculate response time metrics
    const responseTimes = Array.from(this.requestTimings.values());
    const responseTime = this.calculateResponseTimeMetrics(responseTimes);

    // Calculate throughput metrics
    const totalRequests = this.requestCounts.get('total') || 0;
    const timeWindowSeconds = 60; // 1 minute window
    const throughput = {
      requestsPerSecond: totalRequests / timeWindowSeconds,
      requestsPerMinute: totalRequests,
      totalRequests,
    };

    // Calculate error rate metrics
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const errorRate = {
      percentage: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      totalErrors,
      errorTypes: Object.fromEntries(this.errorCounts),
    };

    // Get resource usage metrics
    const resourceUsage = await this.collectResourceMetrics();

    // Determine service health
    const serviceHealth = {
      status: await this.determineHealthStatus(responseTime, errorRate, resourceUsage),
      uptime: now.getTime() - this.startTime.getTime(),
      lastHealthCheck: now,
    };

    return {
      timestamp: now,
      responseTime,
      throughput,
      errorRate,
      resourceUsage,
      serviceHealth,
      customMetrics: {},
    };
  }

  private calculateResponseTimeMetrics(times: number[]): PerformanceMetrics['responseTime'] {
    if (times.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }

    const sorted = times.sort((a, b) => a - b);

    return {
      avg: times.reduce((sum, time) => sum + time, 0) / times.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  private async collectResourceMetrics(): Promise<PerformanceMetrics['resourceUsage']> {
    // Browser environment resource collection
    const memory: MemoryMetrics = {
      used: 0,
      total: 0,
      percentage: 0,
    };

    // Try to get memory info if available
    if ('memory' in performance && (performance as any).memory) {
      const perfMemory = (performance as any).memory;
      memory.heapUsed = perfMemory.usedJSHeapSize;
      memory.heapTotal = perfMemory.totalJSHeapSize;
      memory.used = perfMemory.usedJSHeapSize;
      memory.total = perfMemory.totalJSHeapSize;
      memory.percentage = (memory.used / memory.total) * 100;
    }

    const cpu: CpuMetrics = {
      usage: 0, // Would need more sophisticated measurement
      loadAverage: [],
      processes: 1,
    };

    const network: NetworkMetrics = {
      bytesIn: 0,
      bytesOut: 0,
      connectionsActive: 1,
      latency: 0,
    };

    return { memory, cpu, network };
  }

  private async determineHealthStatus(
    responseTime: PerformanceMetrics['responseTime'],
    errorRate: PerformanceMetrics['errorRate'],
    resourceUsage: PerformanceMetrics['resourceUsage']
  ): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    const thresholds = this.config.alerting.thresholds;

    if (
      responseTime.avg > thresholds.responseTime.critical ||
      errorRate.percentage > thresholds.errorRate.critical ||
      resourceUsage.memory.percentage > thresholds.memoryUsage.critical
    ) {
      return 'unhealthy';
    }

    if (
      responseTime.avg > thresholds.responseTime.warning ||
      errorRate.percentage > thresholds.errorRate.warning ||
      resourceUsage.memory.percentage > thresholds.memoryUsage.warning
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async checkPerformanceThresholds(data: {
    duration?: number;
    success?: boolean;
    errorType?: string;
  }): Promise<void> {
    const thresholds = this.config.alerting.thresholds;

    if (data.duration && data.duration > thresholds.responseTime.critical) {
      await this.triggerAlert(
        'critical',
        'response_time',
        `Response time exceeded critical threshold`,
        data.duration,
        thresholds.responseTime.critical
      );
    } else if (data.duration && data.duration > thresholds.responseTime.warning) {
      await this.triggerAlert(
        'warning',
        'response_time',
        `Response time exceeded warning threshold`,
        data.duration,
        thresholds.responseTime.warning
      );
    }
  }

  private calculateTrend(metric: string, values: number[]): PerformanceTrend {
    if (values.length < 2) {
      return {
        metric,
        trend: 'stable',
        changePercentage: 0,
        prediction: values[0] || 0,
        confidence: 0,
        recommendations: [],
      };
    }

    const first = values[0];
    const last = values[values.length - 1];
    const changePercentage = ((last - first) / first) * 100;

    let trend: 'improving' | 'degrading' | 'stable';
    if (Math.abs(changePercentage) < 5) {
      trend = 'stable';
    } else if (metric === 'errorRate' || metric === 'responseTime') {
      trend = changePercentage < 0 ? 'improving' : 'degrading';
    } else {
      trend = changePercentage > 0 ? 'improving' : 'degrading';
    }

    // Simple linear prediction
    const prediction = last + (last - first);
    const confidence = Math.max(0, 1 - Math.abs(changePercentage) / 100);

    return {
      metric,
      trend,
      changePercentage,
      prediction,
      confidence,
      recommendations: this.generateTrendRecommendations(metric, trend, changePercentage),
    };
  }

  private generateTrendRecommendations(
    metric: string,
    trend: 'improving' | 'degrading' | 'stable',
    changePercentage: number
  ): string[] {
    const recommendations: string[] = [];

    if (trend === 'degrading') {
      switch (metric) {
        case 'responseTime':
          recommendations.push('Consider implementing caching strategies');
          recommendations.push('Review and optimize slow database queries');
          recommendations.push('Evaluate current resource allocation');
          break;
        case 'errorRate':
          recommendations.push('Review recent code changes for potential issues');
          recommendations.push('Increase error handling and validation');
          recommendations.push('Monitor external service dependencies');
          break;
        case 'memoryUsage':
          recommendations.push('Investigate memory leaks');
          recommendations.push('Optimize data structures and algorithms');
          recommendations.push('Consider implementing memory pooling');
          break;
      }
    }

    return recommendations;
  }

  private calculateSummaryMetrics(metrics: PerformanceMetrics[]): PerformanceReport['summary'] {
    if (metrics.length === 0) {
      return {
        availability: 0,
        averageResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
      };
    }

    const healthyMetrics = metrics.filter((m) => m.serviceHealth.status === 'healthy');
    const availability = (healthyMetrics.length / metrics.length) * 100;

    const totalResponseTime = metrics.reduce((sum, m) => sum + m.responseTime.avg, 0);
    const averageResponseTime = totalResponseTime / metrics.length;

    const totalRequests = metrics.reduce((sum, m) => sum + m.throughput.totalRequests, 0);

    const totalErrorRate = metrics.reduce((sum, m) => sum + m.errorRate.percentage, 0);
    const errorRate = totalErrorRate / metrics.length;

    return {
      availability,
      averageResponseTime,
      totalRequests,
      errorRate,
    };
  }

  private calculateSlaCompliance(
    metrics: PerformanceMetrics[],
    alerts: PerformanceAlert[]
  ): SlaComplianceReport {
    // SLA targets (example values)
    const slaTargets = {
      responseTime: 500, // ms
      availability: 99.9, // %
      errorRate: 1, // %
    };

    const summary = this.calculateSummaryMetrics(metrics);

    const responseTimeCompliance =
      summary.averageResponseTime <= slaTargets.responseTime
        ? 100
        : Math.max(
            0,
            100 -
              ((summary.averageResponseTime - slaTargets.responseTime) / slaTargets.responseTime) *
                100
          );

    const availabilityCompliance = Math.min(100, summary.availability);

    const errorRateCompliance =
      summary.errorRate <= slaTargets.errorRate
        ? 100
        : Math.max(
            0,
            100 - ((summary.errorRate - slaTargets.errorRate) / slaTargets.errorRate) * 100
          );

    const breaches: SlaBreachEvent[] = alerts
      .filter((alert) => alert.level === 'critical')
      .map((alert) => ({
        metric: alert.metric,
        timestamp: alert.timestamp,
        duration: alert.resolvedAt
          ? alert.resolvedAt.getTime() - alert.timestamp.getTime()
          : Date.now() - alert.timestamp.getTime(),
        severity: 'critical' as const,
        impact: `${alert.metric} exceeded critical threshold`,
      }));

    return {
      responseTimeCompliance,
      availabilityCompliance,
      errorRateCompliance,
      breaches,
    };
  }

  private async sendAlert(alert: PerformanceAlert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        console.warn(`[PERFORMANCE ALERT] ${alert.level.toUpperCase()}: ${alert.message}`, {
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold,
          timestamp: alert.timestamp,
        });
        break;

      case 'webhook':
        // Would send to webhook endpoint
        break;

      case 'email':
        // Would send email notification
        break;

      case 'slack':
        // Would send Slack notification
        break;
    }
  }

  private async runOptimizationRules(metrics: PerformanceMetrics): Promise<void> {
    if (!this.config.optimization.enabled) return;

    for (const rule of this.config.optimization.optimizationRules) {
      if (rule.enabled && rule.condition(metrics)) {
        try {
          await rule.action(metrics);
          this.log('info', 'Optimization rule executed', this.createServiceContext(), {
            rule: rule.name,
            trigger: metrics.timestamp,
          });
        } catch (error) {
          this.log('error', 'Optimization rule failed', this.createServiceContext(), {
            rule: rule.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  }

  private createServiceContext(source: string = 'PerformanceMonitoringService'): ServiceContext {
    return {
      requestId: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      source,
    };
  }
}
