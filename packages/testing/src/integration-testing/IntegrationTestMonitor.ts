/**
 * @file IntegrationTestMonitor.ts
 * @description Integration test monitoring with autonomous failure analysis
 */

import { Logger } from '../common/Logger';

/**
 * Test execution metrics
 */
export interface TestExecutionMetrics {
  testId: string;
  testName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'running' | 'passed' | 'failed' | 'skipped' | 'timeout';
  category: 'api' | 'database' | 'third_party' | 'scenario' | 'performance';
  assertions: {
    total: number;
    passed: number;
    failed: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    networkIO: number;
    diskIO: number;
  };
  errors: TestError[];
  warnings: string[];
  retryCount: number;
  environment: string;
}

/**
 * Test error information
 */
export interface TestError {
  type: 'assertion' | 'timeout' | 'network' | 'database' | 'runtime' | 'environment';
  message: string;
  stack?: string;
  context: Record<string, unknown>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Failure pattern analysis
 */
export interface FailurePattern {
  pattern: string;
  description: string;
  occurrences: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedTests: string[];
  suggestedAction: string;
  firstSeen: Date;
  lastSeen: Date;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * System health status
 */
export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    responseTime: number;
    errorRate: number;
    lastCheck: Date;
  }[];
  metrics: {
    totalTests: number;
    passRate: number;
    averageExecutionTime: number;
    errorCount: number;
    warningCount: number;
  };
  timestamp: Date;
}

/**
 * Monitor configuration options
 */
export interface IntegrationTestMonitorOptions {
  enabled: boolean;
  enableAutonomous: boolean;
  realTimeMonitoring?: boolean;
  alertThresholds?: {
    failureRate: number;
    responseTime: number;
    errorRate: number;
  };
  retentionPeriod?: number;
  samplingRate?: number;
}

/**
 * Integration test monitoring with autonomous failure analysis
 */
export class IntegrationTestMonitor {
  private options: IntegrationTestMonitorOptions;
  private logger: Logger;
  private metrics: Map<string, TestExecutionMetrics>;
  private failurePatterns: Map<string, FailurePattern>;
  private systemHealth: SystemHealth;
  private isMonitoring: boolean;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(options: IntegrationTestMonitorOptions) {
    this.options = {
      realTimeMonitoring: true,
      alertThresholds: {
        failureRate: 0.1, // 10%
        responseTime: 5000, // 5 seconds
        errorRate: 0.05, // 5%
      },
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      samplingRate: 1000, // 1 second
      ...options,
    };

    this.logger = new Logger('IntegrationTestMonitor');
    this.metrics = new Map();
    this.failurePatterns = new Map();
    this.isMonitoring = false;

    this.systemHealth = {
      overall: 'healthy',
      components: [],
      metrics: {
        totalTests: 0,
        passRate: 100,
        averageExecutionTime: 0,
        errorCount: 0,
        warningCount: 0,
      },
      timestamp: new Date(),
    };

    if (this.options.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Starts real-time monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.logger.info('Starting integration test monitoring');

    if (this.options.realTimeMonitoring) {
      this.monitoringInterval = setInterval(() => {
        this.collectSystemMetrics();
        this.analyzeFailurePatterns();
        this.updateSystemHealth();
        this.checkAlertThresholds();
      }, this.options.samplingRate);
    }
  }

  /**
   * Stops monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.logger.info('Stopped integration test monitoring');
  }

  /**
   * Records test execution start
   */
  public recordTestStart(
    testId: string,
    testName: string,
    category: TestExecutionMetrics['category'],
    environment: string
  ): void {
    const metrics: TestExecutionMetrics = {
      testId,
      testName,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      status: 'running',
      category,
      assertions: { total: 0, passed: 0, failed: 0 },
      resources: { cpuUsage: 0, memoryUsage: 0, networkIO: 0, diskIO: 0 },
      errors: [],
      warnings: [],
      retryCount: 0,
      environment,
    };

    this.metrics.set(testId, metrics);
    this.collectSystemMetrics();
  }

  /**
   * Records test execution completion
   */
  public recordTestCompletion(
    testId: string,
    status: Exclude<TestExecutionMetrics['status'], 'running'>,
    assertions: TestExecutionMetrics['assertions'],
    errors: TestError[] = [],
    warnings: string[] = []
  ): void {
    const metrics = this.metrics.get(testId);
    if (!metrics) {
      this.logger.warn(`Test metrics not found for test ID: ${testId}`);
      return;
    }

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    metrics.status = status;
    metrics.assertions = assertions;
    metrics.errors = errors;
    metrics.warnings = warnings;

    // Record resource usage
    metrics.resources = this.collectResourceMetrics();

    // Analyze errors for patterns
    if (errors.length > 0) {
      this.analyzeTestErrors(testId, errors);
    }

    this.collectSystemMetrics();
    this.logger.info(`Test ${testId} completed with status: ${status} in ${metrics.duration}ms`);
  }

  /**
   * Records test retry
   */
  public recordTestRetry(testId: string): void {
    const metrics = this.metrics.get(testId);
    if (metrics) {
      metrics.retryCount++;
      this.logger.info(`Test ${testId} retry count: ${metrics.retryCount}`);
    }
  }

  /**
   * Collects system metrics
   */
  private collectSystemMetrics(): void {
    // Mock system metrics collection
    const currentMetrics = Array.from(this.metrics.values());

    this.systemHealth.metrics = {
      totalTests: currentMetrics.length,
      passRate: this.calculatePassRate(currentMetrics),
      averageExecutionTime: this.calculateAverageExecutionTime(currentMetrics),
      errorCount: this.calculateErrorCount(currentMetrics),
      warningCount: this.calculateWarningCount(currentMetrics),
    };

    this.systemHealth.timestamp = new Date();
  }

  /**
   * Collects resource metrics
   */
  private collectResourceMetrics(): TestExecutionMetrics['resources'] {
    // Mock resource metrics - in real implementation would use system monitoring
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 8192, // MB
      networkIO: Math.random() * 1000, // KB/s
      diskIO: Math.random() * 500, // KB/s
    };
  }

  /**
   * Analyzes test errors for patterns
   */
  private analyzeTestErrors(testId: string, errors: TestError[]): void {
    errors.forEach((error) => {
      const pattern = this.extractErrorPattern(error);
      const existing = this.failurePatterns.get(pattern.pattern);

      if (existing) {
        existing.occurrences++;
        existing.lastSeen = new Date();
        existing.affectedTests.push(testId);
        existing.trend = this.calculateTrend(existing);
      } else {
        this.failurePatterns.set(pattern.pattern, {
          ...pattern,
          affectedTests: [testId],
          firstSeen: new Date(),
          lastSeen: new Date(),
          trend: 'stable',
        });
      }
    });
  }

  /**
   * Extracts error pattern from error
   */
  private extractErrorPattern(
    error: TestError
  ): Omit<FailurePattern, 'affectedTests' | 'firstSeen' | 'lastSeen' | 'trend'> {
    let pattern = '';
    let description = '';
    let suggestedAction = '';

    switch (error.type) {
      case 'timeout':
        pattern = 'timeout_error';
        description = 'Test execution timeout';
        suggestedAction = 'Increase timeout values or optimize test performance';
        break;
      case 'network':
        pattern = 'network_error';
        description = 'Network connectivity issues';
        suggestedAction = 'Check network configuration and service availability';
        break;
      case 'database':
        pattern = 'database_error';
        description = 'Database connection or query issues';
        suggestedAction = 'Verify database connectivity and query performance';
        break;
      case 'assertion':
        pattern = `assertion_error_${error.message.substring(0, 50)}`;
        description = 'Test assertion failure';
        suggestedAction = 'Review test expectations and application logic';
        break;
      default:
        pattern = `${error.type}_error`;
        description = `${error.type} related error`;
        suggestedAction = 'Investigate specific error details';
    }

    return {
      pattern,
      description,
      occurrences: 1,
      severity: error.severity,
      suggestedAction,
    };
  }

  /**
   * Analyzes failure patterns
   */
  private analyzeFailurePatterns(): void {
    if (!this.options.enableAutonomous) return;

    const patterns = Array.from(this.failurePatterns.values());
    const criticalPatterns = patterns.filter((p) => p.severity === 'critical' && p.occurrences > 3);

    if (criticalPatterns.length > 0) {
      this.logger.warn(`Detected ${criticalPatterns.length} critical failure patterns`);
      criticalPatterns.forEach((pattern) => {
        this.logger.warn(
          `Pattern: ${pattern.pattern} - ${pattern.description} (${pattern.occurrences} occurrences)`
        );
      });
    }

    // Clean old patterns
    this.cleanupOldPatterns();
  }

  /**
   * Calculates trend for failure pattern
   */
  private calculateTrend(pattern: FailurePattern): 'increasing' | 'decreasing' | 'stable' {
    // Simple trend calculation based on recent occurrences
    const recentThreshold = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const recentOccurrences = pattern.lastSeen.getTime() > now.getTime() - recentThreshold;

    if (recentOccurrences && pattern.occurrences > 5) {
      return 'increasing';
    } else if (!recentOccurrences && pattern.occurrences < 3) {
      return 'decreasing';
    }
    return 'stable';
  }

  /**
   * Updates system health status
   */
  private updateSystemHealth(): void {
    const metrics = this.systemHealth.metrics;
    let overall: SystemHealth['overall'] = 'healthy';

    // Determine overall health based on metrics
    if (metrics.passRate < 50 || metrics.errorCount > 10) {
      overall = 'critical';
    } else if (metrics.passRate < 80 || metrics.errorCount > 5) {
      overall = 'warning';
    }

    this.systemHealth.overall = overall;

    // Update component health (mock implementation)
    this.systemHealth.components = [
      {
        name: 'API Gateway',
        status: this.getRandomComponentStatus(),
        responseTime: Math.random() * 1000,
        errorRate: Math.random() * 0.1,
        lastCheck: new Date(),
      },
      {
        name: 'Database',
        status: this.getRandomComponentStatus(),
        responseTime: Math.random() * 500,
        errorRate: Math.random() * 0.05,
        lastCheck: new Date(),
      },
      {
        name: 'Third-party Services',
        status: this.getRandomComponentStatus(),
        responseTime: Math.random() * 2000,
        errorRate: Math.random() * 0.15,
        lastCheck: new Date(),
      },
    ];
  }

  /**
   * Gets random component status for mock data
   */
  private getRandomComponentStatus(): 'healthy' | 'warning' | 'critical' {
    const rand = Math.random();
    if (rand < 0.8) return 'healthy';
    if (rand < 0.95) return 'warning';
    return 'critical';
  }

  /**
   * Checks alert thresholds
   */
  private checkAlertThresholds(): void {
    const metrics = this.systemHealth.metrics;
    const thresholds = this.options.alertThresholds!;

    if (metrics.passRate < (1 - thresholds.failureRate) * 100) {
      this.logger.warn(`High failure rate detected: ${(100 - metrics.passRate).toFixed(2)}%`);
    }

    if (metrics.averageExecutionTime > thresholds.responseTime) {
      this.logger.warn(`High response time detected: ${metrics.averageExecutionTime.toFixed(2)}ms`);
    }

    if (metrics.errorCount / metrics.totalTests > thresholds.errorRate) {
      this.logger.warn(
        `High error rate detected: ${((metrics.errorCount / metrics.totalTests) * 100).toFixed(2)}%`
      );
    }
  }

  /**
   * Cleans up old failure patterns
   */
  private cleanupOldPatterns(): void {
    const cutoffTime = new Date(Date.now() - this.options.retentionPeriod!);

    for (const [key, pattern] of this.failurePatterns.entries()) {
      if (pattern.lastSeen < cutoffTime) {
        this.failurePatterns.delete(key);
      }
    }
  }

  /**
   * Calculates pass rate
   */
  private calculatePassRate(metrics: TestExecutionMetrics[]): number {
    if (metrics.length === 0) return 100;

    const completedTests = metrics.filter((m) => m.status !== 'running');
    if (completedTests.length === 0) return 100;

    const passedTests = completedTests.filter((m) => m.status === 'passed').length;
    return (passedTests / completedTests.length) * 100;
  }

  /**
   * Calculates average execution time
   */
  private calculateAverageExecutionTime(metrics: TestExecutionMetrics[]): number {
    const completedTests = metrics.filter((m) => m.status !== 'running' && m.duration > 0);
    if (completedTests.length === 0) return 0;

    const totalTime = completedTests.reduce((sum, m) => sum + m.duration, 0);
    return totalTime / completedTests.length;
  }

  /**
   * Calculates total error count
   */
  private calculateErrorCount(metrics: TestExecutionMetrics[]): number {
    return metrics.reduce((sum, m) => sum + m.errors.length, 0);
  }

  /**
   * Calculates total warning count
   */
  private calculateWarningCount(metrics: TestExecutionMetrics[]): number {
    return metrics.reduce((sum, m) => sum + m.warnings.length, 0);
  }

  /**
   * Gets current system health
   */
  public getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * Gets test metrics
   */
  public getTestMetrics(testId?: string): TestExecutionMetrics[] {
    if (testId) {
      const metric = this.metrics.get(testId);
      return metric ? [metric] : [];
    }
    return Array.from(this.metrics.values());
  }

  /**
   * Gets failure patterns
   */
  public getFailurePatterns(): FailurePattern[] {
    return Array.from(this.failurePatterns.values());
  }

  /**
   * Gets monitoring summary
   */
  public getMonitoringSummary(): {
    isMonitoring: boolean;
    totalTests: number;
    failurePatterns: number;
    systemHealth: SystemHealth['overall'];
    uptime: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      totalTests: this.metrics.size,
      failurePatterns: this.failurePatterns.size,
      systemHealth: this.systemHealth.overall,
      uptime: this.isMonitoring ? Date.now() - this.systemHealth.timestamp.getTime() : 0,
    };
  }

  /**
   * Exports monitoring data
   */
  public exportMonitoringData(): {
    metrics: TestExecutionMetrics[];
    failurePatterns: FailurePattern[];
    systemHealth: SystemHealth;
    exportTimestamp: Date;
  } {
    return {
      metrics: this.getTestMetrics(),
      failurePatterns: this.getFailurePatterns(),
      systemHealth: this.getSystemHealth(),
      exportTimestamp: new Date(),
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopMonitoring();
    this.metrics.clear();
    this.failurePatterns.clear();
    this.logger.info('Integration test monitor cleaned up');
  }
}
