/**
 * @file TestEffectivenessMonitor.ts
 * @description Monitors and analyzes test effectiveness
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../common/Logger';
import { EffectivenessMetrics } from '../common/types';

/**
 * Configuration options for the test effectiveness monitor
 */
export interface TestEffectivenessMonitorOptions {
  /** Minimum required defect detection rate (%) */
  minDefectDetectionRate?: number;
  /** Minimum required test reliability (%) */
  minReliability?: number;
  /** Maximum allowed maintenance cost (hours per month) */
  maxMaintenanceCost?: number;
  /** Enable effectiveness trend analysis */
  enableTrendAnalysis?: boolean;
  /** Effectiveness metrics output directory */
  metricsDir?: string;
}

/**
 * Defect data for effectiveness analysis
 */
export interface DefectData {
  /** Defect ID */
  id: string;
  /** Defect description */
  description: string;
  /** Defect severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Defect was detected by tests */
  detectedByTests: boolean;
  /** Test that detected the defect (if any) */
  detectingTest?: string;
  /** Defect was detected in which environment */
  detectionEnvironment: 'development' | 'testing' | 'staging' | 'production';
  /** Date defect was introduced */
  introductionDate: string;
  /** Date defect was detected */
  detectionDate: string;
  /** Date defect was fixed */
  fixDate?: string;
}

/**
 * Monitors and analyzes test effectiveness
 */
export class TestEffectivenessMonitor {
  private options: TestEffectivenessMonitorOptions;
  private logger: Logger;
  private effectivenessHistory: EffectivenessMetrics[] = [];

  /**
   * Creates a new TestEffectivenessMonitor instance
   * @param options Configuration options
   */
  constructor(options: TestEffectivenessMonitorOptions = {}) {
    this.options = {
      minDefectDetectionRate: 80, // 80%
      minReliability: 95, // 95%
      maxMaintenanceCost: 20, // 20 hours per month
      enableTrendAnalysis: true,
      metricsDir: 'metrics/effectiveness',
      ...options,
    };

    this.logger = new Logger('TestEffectivenessMonitor');
  }

  /**
   * Analyzes test effectiveness
   * @param testFiles Test files to analyze
   * @param defectData Historical defect data
   * @returns Effectiveness metrics
   */
  public async analyzeEffectiveness(
    testFiles: string[],
    defectData: DefectData[]
  ): Promise<EffectivenessMetrics> {
    this.logger.info(`Analyzing effectiveness for ${testFiles.length} test files`);

    // In a real implementation, this would analyze the test files and defect data
    // For this example, we'll simulate it
    const effectivenessMetrics = this.calculateEffectivenessMetrics(testFiles, defectData);

    // Store effectiveness metrics in history for trend analysis
    if (this.options.enableTrendAnalysis) {
      this.effectivenessHistory.push(effectivenessMetrics);
      if (this.effectivenessHistory.length > 10) {
        this.effectivenessHistory.shift(); // Keep only the last 10 results
      }
    }

    // Log effectiveness summary
    this.logEffectivenessSummary(effectivenessMetrics);

    // Check for effectiveness issues
    const issues = this.identifyEffectivenessIssues(effectivenessMetrics);
    if (issues.length > 0) {
      this.logger.warn('Effectiveness issues detected:');
      issues.forEach((issue, index) => {
        this.logger.warn(`${index + 1}. ${issue.message} (Impact: ${issue.impact})`);
      });
    }

    // Generate effectiveness report
    await this.generateEffectivenessReport(effectivenessMetrics);

    return effectivenessMetrics;
  }

  /**
   * Analyzes effectiveness trends over time
   * @returns Effectiveness trend analysis
   */
  public analyzeEffectivenessTrends(): Record<string, unknown> {
    this.logger.info('Analyzing effectiveness trends');

    if (this.effectivenessHistory.length < 2) {
      this.logger.warn('Insufficient effectiveness history for trend analysis');
      return {
        available: false,
        message: 'Insufficient effectiveness history for trend analysis',
      };
    }

    // Calculate trends
    const trends = {
      defectDetectionRate: this.calculateTrend(
        this.effectivenessHistory.map((e) => e.defectDetectionRate)
      ),
      reliability: this.calculateTrend(this.effectivenessHistory.map((e) => e.reliability)),
      maintenanceCost: this.calculateTrend(this.effectivenessHistory.map((e) => e.maintenanceCost)),
      executionSpeed: this.calculateTrend(this.effectivenessHistory.map((e) => e.executionSpeed)),
      coverageEfficiency: this.calculateTrend(
        this.effectivenessHistory.map((e) => e.coverageEfficiency)
      ),
    };

    // Calculate predictions
    const predictions = {
      nextRun: {
        defectDetectionRate: this.predictNextValue(
          this.effectivenessHistory.map((e) => e.defectDetectionRate)
        ),
        reliability: this.predictNextValue(this.effectivenessHistory.map((e) => e.reliability)),
        maintenanceCost: this.predictNextValue(
          this.effectivenessHistory.map((e) => e.maintenanceCost)
        ),
      },
    };

    return {
      available: true,
      history: this.effectivenessHistory.map((e) => ({
        date: e.timestamp || new Date().toISOString(),
        defectDetectionRate: e.defectDetectionRate,
        reliability: e.reliability,
        maintenanceCost: e.maintenanceCost,
      })),
      trends,
      predictions,
    };
  }

  /**
   * Calculates return on investment for testing
   * @param effectivenessMetrics Effectiveness metrics
   * @param costData Cost data for ROI calculation
   * @returns ROI analysis
   */
  public calculateTestingROI(
    effectivenessMetrics: EffectivenessMetrics,
    costData: {
      testingCost: number; // Cost of testing (hours or currency)
      defectFixCostDev: number; // Cost to fix a defect in development
      defectFixCostTest: number; // Cost to fix a defect in testing
      defectFixCostStaging: number; // Cost to fix a defect in staging
      defectFixCostProduction: number; // Cost to fix a defect in production
      defectsPreventedByTesting: number; // Estimated defects prevented by testing
    }
  ): Record<string, unknown> {
    this.logger.info('Calculating testing ROI');

    // Calculate costs
    const testingCost = costData.testingCost;

    // Calculate benefits
    const defectPreventionSavings =
      costData.defectsPreventedByTesting *
      (costData.defectFixCostProduction - costData.defectFixCostDev);

    const earlyDetectionSavings =
      (effectivenessMetrics.defectDetectionRate / 100) *
      costData.defectsPreventedByTesting *
      (costData.defectFixCostProduction - costData.defectFixCostTest);

    const totalBenefits = defectPreventionSavings + earlyDetectionSavings;

    // Calculate ROI
    const roi = ((totalBenefits - testingCost) / testingCost) * 100;

    // Calculate payback period (in months, assuming costs are monthly)
    const paybackPeriod = testingCost / totalBenefits;

    return {
      testingCost,
      benefits: {
        defectPreventionSavings,
        earlyDetectionSavings,
        totalBenefits,
      },
      roi,
      paybackPeriod,
      breakEvenPoint: testingCost / (totalBenefits / costData.defectsPreventedByTesting),
    };
  }

  /**
   * Generates recommendations for improving test effectiveness
   * @param effectivenessMetrics Effectiveness metrics
   * @returns Recommendations
   */
  public generateEffectivenessRecommendations(
    effectivenessMetrics: EffectivenessMetrics
  ): string[] {
    this.logger.info('Generating effectiveness recommendations');

    const recommendations = [];

    // Add recommendations based on metrics
    if (effectivenessMetrics.defectDetectionRate < this.options.minDefectDetectionRate) {
      recommendations.push(
        `Improve defect detection rate (currently ${effectivenessMetrics.defectDetectionRate.toFixed(1)}%, target ${this.options.minDefectDetectionRate}%)`
      );

      // Add specific recommendations based on the gap
      const gap = this.options.minDefectDetectionRate - effectivenessMetrics.defectDetectionRate;

      if (gap > 20) {
        recommendations.push('Implement mutation testing to identify ineffective tests');
        recommendations.push('Review test coverage and focus on critical paths');
        recommendations.push('Implement property-based testing for complex logic');
      } else if (gap > 10) {
        recommendations.push('Increase test coverage for high-risk areas');
        recommendations.push('Add edge case testing for critical functions');
      } else {
        recommendations.push('Fine-tune existing tests to catch more edge cases');
      }
    }

    if (effectivenessMetrics.reliability < this.options.minReliability) {
      recommendations.push(
        `Improve test reliability (currently ${effectivenessMetrics.reliability.toFixed(1)}%, target ${this.options.minReliability}%)`
      );

      // Add specific recommendations based on the gap
      const gap = this.options.minReliability - effectivenessMetrics.reliability;

      if (gap > 10) {
        recommendations.push('Implement test isolation to prevent test interference');
        recommendations.push('Review and fix flaky tests');
        recommendations.push('Implement stable test environments');
      } else if (gap > 5) {
        recommendations.push('Identify and fix intermittent failures');
        recommendations.push('Improve test data management');
      } else {
        recommendations.push('Fine-tune test timeouts and retry mechanisms');
      }
    }

    if (effectivenessMetrics.maintenanceCost > this.options.maxMaintenanceCost) {
      recommendations.push(
        `Reduce maintenance cost (currently ${effectivenessMetrics.maintenanceCost.toFixed(1)} hours/month, target ${this.options.maxMaintenanceCost} hours/month)`
      );

      // Add specific recommendations based on the gap
      const gap = effectivenessMetrics.maintenanceCost - this.options.maxMaintenanceCost;

      if (gap > 20) {
        recommendations.push('Implement test refactoring to reduce duplication');
        recommendations.push('Implement better test abstractions');
        recommendations.push('Consider test generation for repetitive tests');
      } else if (gap > 10) {
        recommendations.push('Reduce test fragility by focusing on behavior, not implementation');
        recommendations.push('Implement better test helpers and utilities');
      } else {
        recommendations.push('Fine-tune existing test structure for better maintainability');
      }
    }

    if (effectivenessMetrics.executionSpeed < 10) {
      // Assuming 10 tests/second is a reasonable threshold
      recommendations.push(
        `Improve test execution speed (currently ${effectivenessMetrics.executionSpeed.toFixed(1)} tests/second)`
      );
      recommendations.push('Optimize slow tests');
      recommendations.push('Implement parallel test execution');
    }

    if (effectivenessMetrics.coverageEfficiency < 0.5) {
      // Assuming 0.5% coverage per test is a reasonable threshold
      recommendations.push(
        `Improve coverage efficiency (currently ${effectivenessMetrics.coverageEfficiency.toFixed(2)}% coverage per test)`
      );
      recommendations.push('Consolidate overlapping tests');
      recommendations.push('Focus tests on uncovered code paths');
    }

    return recommendations;
  }

  /**
   * Calculates effectiveness metrics based on test files and defect data
   * @param testFiles Test files to analyze
   * @param defectData Historical defect data
   * @returns Effectiveness metrics
   */
  private calculateEffectivenessMetrics(
    testFiles: string[],
    defectData: DefectData[]
  ): EffectivenessMetrics {
    // This is a simplified calculation
    // In a real implementation, this would involve more sophisticated analysis

    // Calculate defect detection rate
    const totalDefects = defectData.length;
    const detectedDefects = defectData.filter((d) => d.detectedByTests).length;
    const defectDetectionRate = totalDefects > 0 ? (detectedDefects / totalDefects) * 100 : 100;

    // Simulate other metrics
    const reliability = 90 + Math.random() * 10; // 90-100%
    const maintenanceCost = testFiles.length * 0.5; // 0.5 hours per test file
    const executionSpeed = 5 + Math.random() * 20; // 5-25 tests per second
    const coverageEfficiency = 0.3 + Math.random() * 0.7; // 0.3-1.0% coverage per test

    // Create trends data
    const trendMetrics = [
      'defectDetectionRate',
      'reliability',
      'maintenanceCost',
      'executionSpeed',
      'coverageEfficiency',
    ];
    const trends = trendMetrics.map((metric) => ({
      metric,
      values: Array.from({ length: 6 }, () => Math.random() * 100), // 6 historical data points
      timestamps: Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (5 - i));
        return date.toISOString();
      }),
    }));

    return {
      defectDetectionRate,
      reliability,
      maintenanceCost,
      executionSpeed,
      coverageEfficiency,
      trends,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Logs a summary of effectiveness metrics
   * @param metrics Effectiveness metrics to log
   */
  private logEffectivenessSummary(metrics: EffectivenessMetrics): void {
    this.logger.info('Effectiveness Summary:');
    this.logger.info(`Defect Detection Rate: ${metrics.defectDetectionRate.toFixed(1)}%`);
    this.logger.info(`Reliability: ${metrics.reliability.toFixed(1)}%`);
    this.logger.info(`Maintenance Cost: ${metrics.maintenanceCost.toFixed(1)} hours/month`);
    this.logger.info(`Execution Speed: ${metrics.executionSpeed.toFixed(1)} tests/second`);
    this.logger.info(
      `Coverage Efficiency: ${metrics.coverageEfficiency.toFixed(2)}% coverage per test`
    );
  }

  /**
   * Identifies effectiveness issues based on metrics
   * @param metrics Effectiveness metrics to analyze
   * @returns Identified issues
   */
  private identifyEffectivenessIssues(
    metrics: EffectivenessMetrics
  ): Array<{ type: string; message: string; impact: string }> {
    const issues = [];

    // Check defect detection rate
    if (metrics.defectDetectionRate < this.options.minDefectDetectionRate) {
      issues.push({
        type: 'defect_detection',
        message: `Defect detection rate (${metrics.defectDetectionRate.toFixed(1)}%) is below minimum threshold (${this.options.minDefectDetectionRate}%)`,
        impact: 'High',
      });
    }

    // Check reliability
    if (metrics.reliability < this.options.minReliability) {
      issues.push({
        type: 'reliability',
        message: `Test reliability (${metrics.reliability.toFixed(1)}%) is below minimum threshold (${this.options.minReliability}%)`,
        impact: 'High',
      });
    }

    // Check maintenance cost
    if (metrics.maintenanceCost > this.options.maxMaintenanceCost) {
      issues.push({
        type: 'maintenance_cost',
        message: `Maintenance cost (${metrics.maintenanceCost.toFixed(1)} hours/month) exceeds maximum threshold (${this.options.maxMaintenanceCost} hours/month)`,
        impact: 'Medium',
      });
    }

    // Check execution speed
    if (metrics.executionSpeed < 10) {
      // Assuming 10 tests/second is a reasonable threshold
      issues.push({
        type: 'execution_speed',
        message: `Execution speed (${metrics.executionSpeed.toFixed(1)} tests/second) is slow`,
        impact: 'Medium',
      });
    }

    // Check coverage efficiency
    if (metrics.coverageEfficiency < 0.5) {
      // Assuming 0.5% coverage per test is a reasonable threshold
      issues.push({
        type: 'coverage_efficiency',
        message: `Coverage efficiency (${metrics.coverageEfficiency.toFixed(2)}% coverage per test) is low`,
        impact: 'Low',
      });
    }

    return issues;
  }

  /**
   * Generates an effectiveness report
   * @param metrics Effectiveness metrics
   * @returns Report file path
   */
  private async generateEffectivenessReport(metrics: EffectivenessMetrics): Promise<string> {
    this.logger.info('Generating effectiveness report');

    // Ensure metrics directory exists
    await fs.mkdir(this.options.metricsDir, { recursive: true });

    // Generate report
    const reportFile = path.join(this.options.metricsDir, `effectiveness-${Date.now()}.json`);

    // Add recommendations to metrics
    const reportData = {
      ...metrics,
      recommendations: this.generateEffectivenessRecommendations(metrics),
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));

    this.logger.info(`Effectiveness report generated: ${reportFile}`);
    return reportFile;
  }

  /**
   * Calculates the trend for a series of values
   * @param values Values to analyze
   * @returns Trend information
   */
  private calculateTrend(values: number[]): Record<string, unknown> {
    if (values.length < 2) {
      return {
        direction: 'stable',
        change: 0,
        rate: 0,
      };
    }

    // Calculate changes between consecutive values
    const changes: number[] = [];
    for (let i = 1; i < values.length; i++) {
      changes.push(values[i] - values[i - 1]);
    }

    // Calculate average change
    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;

    // Determine trend direction
    let direction: 'improving' | 'degrading' | 'stable';
    if (Math.abs(avgChange) < 0.5) {
      direction = 'stable';
    } else if (avgChange > 0) {
      // For most metrics, positive change is improvement (except maintenance cost)
      direction = 'improving';
    } else {
      direction = 'degrading';
    }

    return {
      direction,
      change: avgChange,
      rate: (avgChange / values[0]) * 100, // Percentage change rate
      values,
      changes,
    };
  }

  /**
   * Predicts the next value in a series
   * @param values Values to analyze
   * @returns Predicted next value
   */
  private predictNextValue(values: number[]): number {
    if (values.length < 2) {
      return values[0] || 0;
    }

    // Simple linear regression
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);

    // Calculate means
    const meanX = indices.reduce((sum, i) => sum + i, 0) / n;
    const meanY = values.reduce((sum, v) => sum + v, 0) / n;

    // Calculate slope
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (indices[i] - meanX) * (values[i] - meanY);
      denominator += Math.pow(indices[i] - meanX, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    // Predict next value
    return Math.max(0, intercept + slope * n);
  }
}
