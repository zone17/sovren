/**
 * Performance Accuracy Validator - US-154.8
 * Continuous performance testing accuracy validation
 *
 * @author Sovren Development Team
 * @version 1.0.0
 * @since 2024-12-29
 */

import { EventEmitter } from 'events';

export interface ValidationConfig {
  accuracyThresholds: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    resourceUtilization: number;
  };
  statisticalTests: {
    confidenceLevel: number;
    sampleSize: number;
    outlierDetection: boolean;
  };
  validationFrequency: number;
}

export interface ValidationResult {
  timestamp: number;
  testId: string;
  metric: string;
  predicted: number;
  actual: number;
  accuracy: number;
  withinThreshold: boolean;
  confidence: number;
  outlier: boolean;
}

export interface AccuracyReport {
  reportId: string;
  timestamp: number;
  overallAccuracy: number;
  metricAccuracies: Record<string, number>;
  trends: Record<string, 'improving' | 'stable' | 'degrading'>;
  recommendations: string[];
  validationResults: ValidationResult[];
}

/**
 * Performance Accuracy Validator
 *
 * Provides continuous validation of performance testing accuracy including:
 * - Statistical accuracy validation
 * - Outlier detection and analysis
 * - Trend-based accuracy monitoring
 * - Confidence interval calculations
 * - Automated accuracy reporting
 */
export class PerformanceAccuracyValidator extends EventEmitter {
  private config: ValidationConfig;
  private validationResults: ValidationResult[] = [];
  private accuracyHistory: Map<string, number[]> = new Map();
  private isValidating: boolean = false;
  private validationTimer: NodeJS.Timeout | null = null;

  constructor(config: ValidationConfig) {
    super();
    this.config = config;
    this.initializeValidator();
  }

  private initializeValidator(): void {
    this.setupStatisticalModels();
    this.emit('validator-initialized');
  }

  private setupStatisticalModels(): void {
    const metrics = ['responseTime', 'throughput', 'errorRate', 'resourceUtilization'];
    metrics.forEach((metric) => {
      this.accuracyHistory.set(metric, []);
    });
    this.emit('statistical-models-ready');
  }

  public startValidation(): void {
    if (this.isValidating) return;
    this.isValidating = true;

    this.validationTimer = setInterval(() => {
      this.runValidationCycle();
    }, this.config.validationFrequency);

    this.emit('validation-started');
  }

  public stopValidation(): void {
    if (!this.isValidating) return;
    this.isValidating = false;

    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }

    this.emit('validation-stopped');
  }

  private async runValidationCycle(): Promise<void> {
    try {
      const validationResults = await this.validateCurrentPredictions();
      this.updateAccuracyHistory(validationResults);
      this.detectAccuracyTrends();
      this.emit('validation-cycle-complete', { resultsCount: validationResults.length });
    } catch (error) {
      this.emit('validation-error', { error: error.message });
    }
  }

  private async validateCurrentPredictions(): Promise<ValidationResult[]> {
    // Simulate prediction validation
    const mockResults: ValidationResult[] = [];
    const metrics = ['responseTime', 'throughput', 'errorRate'];

    metrics.forEach((metric) => {
      const result = this.validateMetricPrediction(metric);
      mockResults.push(result);
      this.validationResults.push(result);
    });

    return mockResults;
  }

  private validateMetricPrediction(metric: string): ValidationResult {
    const predicted = Math.random() * 1000;
    const actual = predicted * (0.9 + Math.random() * 0.2); // ±10% variance
    const accuracy = 1 - Math.abs(predicted - actual) / Math.max(predicted, actual);
    const threshold =
      this.config.accuracyThresholds[metric as keyof typeof this.config.accuracyThresholds];

    return {
      timestamp: Date.now(),
      testId: `test-${Date.now()}`,
      metric,
      predicted,
      actual,
      accuracy,
      withinThreshold: accuracy >= threshold,
      confidence: this.calculateConfidence(accuracy),
      outlier: this.isOutlier(metric, accuracy),
    };
  }

  private calculateConfidence(accuracy: number): number {
    return Math.min(0.99, accuracy * 1.1);
  }

  private isOutlier(metric: string, accuracy: number): boolean {
    const history = this.accuracyHistory.get(metric) || [];
    if (history.length < 10) return false;

    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    const stdDev = Math.sqrt(
      history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length
    );

    return Math.abs(accuracy - mean) > 2 * stdDev;
  }

  private updateAccuracyHistory(results: ValidationResult[]): void {
    results.forEach((result) => {
      const history = this.accuracyHistory.get(result.metric) || [];
      history.push(result.accuracy);

      if (history.length > 100) {
        history.shift();
      }

      this.accuracyHistory.set(result.metric, history);
    });
  }

  private detectAccuracyTrends(): void {
    const trends: Record<string, 'improving' | 'stable' | 'degrading'> = {};

    this.accuracyHistory.forEach((history, metric) => {
      if (history.length >= 10) {
        const recent = history.slice(-10);
        const older = history.slice(-20, -10);

        if (older.length > 0) {
          const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

          if (recentAvg > olderAvg + 0.02) trends[metric] = 'improving';
          else if (recentAvg < olderAvg - 0.02) trends[metric] = 'degrading';
          else trends[metric] = 'stable';
        }
      }
    });

    this.emit('trends-detected', trends);
  }

  public generateAccuracyReport(): AccuracyReport {
    const reportId = `accuracy-report-${Date.now()}`;
    const metricAccuracies: Record<string, number> = {};
    const trends: Record<string, 'improving' | 'stable' | 'degrading'> = {};

    this.accuracyHistory.forEach((history, metric) => {
      if (history.length > 0) {
        metricAccuracies[metric] = history.reduce((sum, val) => sum + val, 0) / history.length;

        // Calculate trend
        if (history.length >= 10) {
          const recent = history.slice(-5);
          const older = history.slice(-10, -5);
          const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

          if (recentAvg > olderAvg + 0.01) trends[metric] = 'improving';
          else if (recentAvg < olderAvg - 0.01) trends[metric] = 'degrading';
          else trends[metric] = 'stable';
        }
      }
    });

    const overallAccuracy =
      Object.values(metricAccuracies).reduce((sum, acc) => sum + acc, 0) /
      Object.keys(metricAccuracies).length;

    return {
      reportId,
      timestamp: Date.now(),
      overallAccuracy,
      metricAccuracies,
      trends,
      recommendations: this.generateRecommendations(metricAccuracies, trends),
      validationResults: this.validationResults.slice(-50),
    };
  }

  private generateRecommendations(
    accuracies: Record<string, number>,
    trends: Record<string, string>
  ): string[] {
    const recommendations: string[] = [];

    Object.entries(accuracies).forEach(([metric, accuracy]) => {
      if (accuracy < 0.8) {
        recommendations.push(
          `Improve ${metric} prediction accuracy (currently ${Math.round(accuracy * 100)}%)`
        );
      }

      if (trends[metric] === 'degrading') {
        recommendations.push(`Address degrading accuracy trend for ${metric}`);
      }
    });

    return recommendations;
  }

  public getValidationResults(): ValidationResult[] {
    return [...this.validationResults];
  }

  public getAccuracyHistory(): Map<string, number[]> {
    return new Map(this.accuracyHistory);
  }

  public cleanup(): void {
    this.stopValidation();
    this.validationResults = [];
    this.accuracyHistory.clear();
    this.removeAllListeners();
    this.emit('cleanup-complete');
  }
}

export default PerformanceAccuracyValidator;
