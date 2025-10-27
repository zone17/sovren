/**
 * ⚡ **ELITE PERFORMANCE TESTING UTILITIES**
 *
 * **Purpose**: Comprehensive performance testing for React components and critical paths
 * **Architecture**: Web Performance APIs integration with React Testing Library
 * **Security**: Safe performance measurement without data leakage
 * **Performance**: Sub-millisecond measurement accuracy for performance optimization
 *
 * @author Elite Engineering Team
 * @version 1.0.0 - US-201 Test Infrastructure Repair
 * @lastModified 2024-12-28
 */

import { cleanup, render, RenderOptions } from '@testing-library/react';
import * as React from 'react';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

// 🎯 **TYPE DEFINITIONS**
export interface PerformanceMetrics {
  renderTime: number;
  paintTime: number;
  layoutTime: number;
  scriptTime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  domNodes: number;
  reRenders: number;
  timestamp: number;
}

export interface PerformanceBenchmark {
  name: string;
  component: ReactElement;
  iterations: number;
  metrics: PerformanceMetrics[];
  average: PerformanceMetrics;
  min: PerformanceMetrics;
  max: PerformanceMetrics;
  standardDeviation: number;
  percentile95: PerformanceMetrics;
}

export interface PerformanceTestOptions {
  /** Number of iterations for benchmarking */
  iterations?: number;
  /** Warm-up iterations before measurement */
  warmUpIterations?: number;
  /** Custom render options */
  renderOptions?: RenderOptions;
  /** Whether to measure memory usage */
  measureMemory?: boolean;
  /** Whether to measure DOM node count */
  measureDomNodes?: boolean;
  /** Custom performance thresholds */
  thresholds?: PerformanceThresholds;
  /** Whether to cleanup after each iteration */
  cleanupAfterEach?: boolean;
  /** Custom props for the component */
  props?: Record<string, any>;
  /** Whether to wrap with providers */
  withProviders?: boolean;
}

export interface PerformanceThresholds {
  /** Maximum acceptable render time in milliseconds */
  maxRenderTime?: number;
  /** Maximum acceptable paint time in milliseconds */
  maxPaintTime?: number;
  /** Maximum acceptable memory usage in MB */
  maxMemoryUsage?: number;
  /** Maximum acceptable DOM nodes */
  maxDomNodes?: number;
  /** Maximum acceptable re-renders */
  maxReRenders?: number;
}

export interface PerformanceTestResult {
  passed: boolean;
  metrics: PerformanceMetrics;
  thresholds: PerformanceThresholds;
  violations: string[];
  timestamp: number;
}

export interface PerformanceReport {
  testName: string;
  component: string;
  timestamp: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  benchmarks: PerformanceBenchmark[];
  results: PerformanceTestResult[];
  summary: {
    averageRenderTime: number;
    averageMemoryUsage: number;
    averageDomNodes: number;
    performanceScore: number;
  };
}

// 🏗️ **DEFAULT PROVIDERS WRAPPER**
const DefaultProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <MemoryRouter>{children}</MemoryRouter>;
};

// 🎯 **PERFORMANCE MEASUREMENT UTILITIES**
export class PerformanceMeasurer {
  private static instance: PerformanceMeasurer;
  private measurementHistory: Map<string, PerformanceMetrics[]> = new Map();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMeasurer {
    if (!this.instance) {
      this.instance = new PerformanceMeasurer();
    }
    return this.instance;
  }

  /**
   * Measure render performance of a React component
   */
  async measureRenderPerformance(
    component: ReactElement,
    options: PerformanceTestOptions = {}
  ): Promise<PerformanceMetrics> {
    const {
      renderOptions = {},
      measureMemory = true,
      measureDomNodes = true,
      withProviders = true,
      props = {},
    } = options;

    // Clear previous measurements
    performance.clearMarks();
    performance.clearMeasures();

    // Record initial memory usage
    const initialMemory = measureMemory ? this.getMemoryUsage() : null;

    // Start timing
    const startTime = performance.now();
    performance.mark('render-start');

    // Clone component and merge props
    const componentWithProps = {
      ...component,
      props: { ...component.props, ...props },
    };

    // Render component
    const renderResult = withProviders
      ? render(componentWithProps, {
          wrapper: DefaultProviders,
          ...renderOptions,
        })
      : render(componentWithProps, renderOptions);

    // End timing
    performance.mark('render-end');
    performance.measure('render-time', 'render-start', 'render-end');

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Get performance entries
    const paintEntries = performance.getEntriesByType('paint');
    const navigationEntries = performance.getEntriesByType('navigation');
    const measureEntries = performance.getEntriesByName('render-time');

    // Calculate metrics
    const paintTime = paintEntries.length > 0 ? paintEntries[0].startTime : 0;
    const layoutTime =
      navigationEntries.length > 0
        ? (navigationEntries[0] as PerformanceNavigationTiming).domComplete
        : 0;
    const scriptTime = measureEntries.length > 0 ? measureEntries[0].duration : renderTime;

    // Measure memory usage
    const finalMemory = measureMemory ? this.getMemoryUsage() : null;
    const memoryUsage = finalMemory || {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
    };

    // Count DOM nodes
    const domNodes = measureDomNodes ? renderResult.container.querySelectorAll('*').length : 0;

    const metrics: PerformanceMetrics = {
      renderTime,
      paintTime,
      layoutTime,
      scriptTime,
      memoryUsage,
      domNodes,
      reRenders: 0, // TODO: Implement re-render counting
      timestamp: Date.now(),
    };

    // Cleanup
    cleanup();

    return metrics;
  }

  /**
   * Run performance benchmark with multiple iterations
   */
  async benchmarkComponent(
    name: string,
    component: ReactElement,
    options: PerformanceTestOptions = {}
  ): Promise<PerformanceBenchmark> {
    const { iterations = 10, warmUpIterations = 3, cleanupAfterEach = true } = options;

    const metrics: PerformanceMetrics[] = [];

    // Warm-up iterations
    for (let i = 0; i < warmUpIterations; i++) {
      await this.measureRenderPerformance(component, options);
      if (cleanupAfterEach) {
        await this.cleanup();
      }
    }

    // Benchmark iterations
    for (let i = 0; i < iterations; i++) {
      const metric = await this.measureRenderPerformance(component, options);
      metrics.push(metric);

      if (cleanupAfterEach) {
        await this.cleanup();
      }
    }

    // Calculate statistics
    const average = this.calculateAverage(metrics);
    const min = this.calculateMin(metrics);
    const max = this.calculateMax(metrics);
    const standardDeviation = this.calculateStandardDeviation(metrics, average);
    const percentile95 = this.calculatePercentile(metrics, 0.95);

    const benchmark: PerformanceBenchmark = {
      name,
      component,
      iterations,
      metrics,
      average,
      min,
      max,
      standardDeviation,
      percentile95,
    };

    // Store in history
    this.measurementHistory.set(name, metrics);

    return benchmark;
  }

  /**
   * Test component performance against thresholds
   */
  async testPerformanceThresholds(
    component: ReactElement,
    thresholds: PerformanceThresholds,
    options: PerformanceTestOptions = {}
  ): Promise<PerformanceTestResult> {
    const metrics = await this.measureRenderPerformance(component, options);
    const violations: string[] = [];

    // Check thresholds
    if (thresholds.maxRenderTime && metrics.renderTime > thresholds.maxRenderTime) {
      violations.push(
        `Render time (${metrics.renderTime.toFixed(2)}ms) exceeds threshold (${thresholds.maxRenderTime}ms)`
      );
    }

    if (thresholds.maxPaintTime && metrics.paintTime > thresholds.maxPaintTime) {
      violations.push(
        `Paint time (${metrics.paintTime.toFixed(2)}ms) exceeds threshold (${thresholds.maxPaintTime}ms)`
      );
    }

    if (
      thresholds.maxMemoryUsage &&
      metrics.memoryUsage.heapUsed / 1024 / 1024 > thresholds.maxMemoryUsage
    ) {
      violations.push(
        `Memory usage (${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB) exceeds threshold (${thresholds.maxMemoryUsage}MB)`
      );
    }

    if (thresholds.maxDomNodes && metrics.domNodes > thresholds.maxDomNodes) {
      violations.push(
        `DOM nodes (${metrics.domNodes}) exceeds threshold (${thresholds.maxDomNodes})`
      );
    }

    if (thresholds.maxReRenders && metrics.reRenders > thresholds.maxReRenders) {
      violations.push(
        `Re-renders (${metrics.reRenders}) exceeds threshold (${thresholds.maxReRenders})`
      );
    }

    return {
      passed: violations.length === 0,
      metrics,
      thresholds,
      violations,
      timestamp: Date.now(),
    };
  }

  /**
   * Create performance report
   */
  createReport(
    testName: string,
    component: string,
    benchmarks: PerformanceBenchmark[],
    results: PerformanceTestResult[]
  ): PerformanceReport {
    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    // Calculate summary metrics
    const allMetrics = results.map((r) => r.metrics);
    const averageRenderTime =
      allMetrics.reduce((sum, m) => sum + m.renderTime, 0) / allMetrics.length;
    const averageMemoryUsage =
      allMetrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / allMetrics.length;
    const averageDomNodes = allMetrics.reduce((sum, m) => sum + m.domNodes, 0) / allMetrics.length;

    // Calculate performance score (0-100)
    const performanceScore = Math.max(
      0,
      Math.min(
        100,
        100 - averageRenderTime / 10 - averageMemoryUsage / 1024 / 1024 - averageDomNodes / 100
      )
    );

    return {
      testName,
      component,
      timestamp: Date.now(),
      totalTests,
      passedTests,
      failedTests,
      benchmarks,
      results,
      summary: {
        averageRenderTime,
        averageMemoryUsage,
        averageDomNodes,
        performanceScore,
      },
    };
  }

  /**
   * Get memory usage (if available)
   */
  private getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number } {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        heapUsed: memory.usedJSHeapSize || 0,
        heapTotal: memory.totalJSHeapSize || 0,
        external: memory.externalJSHeapSize || 0,
      };
    }
    return { heapUsed: 0, heapTotal: 0, external: 0 };
  }

  /**
   * Calculate average metrics
   */
  private calculateAverage(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const count = metrics.length;
    return {
      renderTime: metrics.reduce((sum, m) => sum + m.renderTime, 0) / count,
      paintTime: metrics.reduce((sum, m) => sum + m.paintTime, 0) / count,
      layoutTime: metrics.reduce((sum, m) => sum + m.layoutTime, 0) / count,
      scriptTime: metrics.reduce((sum, m) => sum + m.scriptTime, 0) / count,
      memoryUsage: {
        heapUsed: metrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / count,
        heapTotal: metrics.reduce((sum, m) => sum + m.memoryUsage.heapTotal, 0) / count,
        external: metrics.reduce((sum, m) => sum + m.memoryUsage.external, 0) / count,
      },
      domNodes: metrics.reduce((sum, m) => sum + m.domNodes, 0) / count,
      reRenders: metrics.reduce((sum, m) => sum + m.reRenders, 0) / count,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate minimum metrics
   */
  private calculateMin(metrics: PerformanceMetrics[]): PerformanceMetrics {
    return metrics.reduce((min, current) => ({
      renderTime: Math.min(min.renderTime, current.renderTime),
      paintTime: Math.min(min.paintTime, current.paintTime),
      layoutTime: Math.min(min.layoutTime, current.layoutTime),
      scriptTime: Math.min(min.scriptTime, current.scriptTime),
      memoryUsage: {
        heapUsed: Math.min(min.memoryUsage.heapUsed, current.memoryUsage.heapUsed),
        heapTotal: Math.min(min.memoryUsage.heapTotal, current.memoryUsage.heapTotal),
        external: Math.min(min.memoryUsage.external, current.memoryUsage.external),
      },
      domNodes: Math.min(min.domNodes, current.domNodes),
      reRenders: Math.min(min.reRenders, current.reRenders),
      timestamp: Date.now(),
    }));
  }

  /**
   * Calculate maximum metrics
   */
  private calculateMax(metrics: PerformanceMetrics[]): PerformanceMetrics {
    return metrics.reduce((max, current) => ({
      renderTime: Math.max(max.renderTime, current.renderTime),
      paintTime: Math.max(max.paintTime, current.paintTime),
      layoutTime: Math.max(max.layoutTime, current.layoutTime),
      scriptTime: Math.max(max.scriptTime, current.scriptTime),
      memoryUsage: {
        heapUsed: Math.max(max.memoryUsage.heapUsed, current.memoryUsage.heapUsed),
        heapTotal: Math.max(max.memoryUsage.heapTotal, current.memoryUsage.heapTotal),
        external: Math.max(max.memoryUsage.external, current.memoryUsage.external),
      },
      domNodes: Math.max(max.domNodes, current.domNodes),
      reRenders: Math.max(max.reRenders, current.reRenders),
      timestamp: Date.now(),
    }));
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(
    metrics: PerformanceMetrics[],
    average: PerformanceMetrics
  ): number {
    const variance =
      metrics.reduce((sum, m) => {
        const diff = m.renderTime - average.renderTime;
        return sum + diff * diff;
      }, 0) / metrics.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(
    metrics: PerformanceMetrics[],
    percentile: number
  ): PerformanceMetrics {
    const sorted = metrics.slice().sort((a, b) => a.renderTime - b.renderTime);
    const index = Math.ceil(percentile * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Cleanup performance measurements
   */
  private async cleanup(): Promise<void> {
    performance.clearMarks();
    performance.clearMeasures();

    // Force garbage collection if available
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }

    // Small delay to allow cleanup
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  /**
   * Get measurement history
   */
  getHistory(name?: string): Map<string, PerformanceMetrics[]> | PerformanceMetrics[] {
    if (name) {
      return this.measurementHistory.get(name) || [];
    }
    return this.measurementHistory;
  }

  /**
   * Clear measurement history
   */
  clearHistory(): void {
    this.measurementHistory.clear();
  }
}

// 🎯 **CONVENIENCE FUNCTIONS**
export const performanceMeasurer = PerformanceMeasurer.getInstance();

/**
 * Quick performance measurement for components
 */
export const measureComponentPerformance = async (
  component: ReactElement,
  options: PerformanceTestOptions = {}
): Promise<PerformanceMetrics> => {
  return performanceMeasurer.measureRenderPerformance(component, options);
};

/**
 * Run performance benchmark
 */
export const benchmarkComponent = async (
  name: string,
  component: ReactElement,
  options: PerformanceTestOptions = {}
): Promise<PerformanceBenchmark> => {
  return performanceMeasurer.benchmarkComponent(name, component, options);
};

/**
 * Test performance thresholds
 */
export const testPerformanceThresholds = async (
  component: ReactElement,
  thresholds: PerformanceThresholds,
  options: PerformanceTestOptions = {}
): Promise<PerformanceTestResult> => {
  return performanceMeasurer.testPerformanceThresholds(component, thresholds, options);
};

/**
 * Create performance test suite
 */
export const createPerformanceTestSuite = (
  suiteName: string,
  tests: Array<{
    name: string;
    component: ReactElement;
    thresholds: PerformanceThresholds;
    options?: PerformanceTestOptions;
  }>
): void => {
  describe(`${suiteName} Performance Tests`, () => {
    tests.forEach(({ name, component, thresholds, options = {} }) => {
      it(`${name} meets performance thresholds`, async () => {
        const result = await testPerformanceThresholds(component, thresholds, options);

        if (!result.passed) {
          console.warn(`Performance violations for ${name}:`, result.violations);
        }

        expect(result.passed).toBe(true);
        expect(result.violations).toHaveLength(0);
      });
    });
  });
};

/**
 * Performance testing hook
 */
export const usePerformanceTesting = () => {
  return {
    measure: measureComponentPerformance,
    benchmark: benchmarkComponent,
    test: testPerformanceThresholds,
    createSuite: createPerformanceTestSuite,
    measurer: performanceMeasurer,
  };
};
