/**
 * Performance Testing Utilities
 *
 * Shared utilities for performance measurement and analysis
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

export interface PerformanceMetrics {
  timings: number[];
  average: number;
  min: number;
  max: number;
  median: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  stdDev: number;
  throughput: number;
  iterations: number;
}

export interface PerformanceTarget {
  p50?: number;
  p75?: number;
  p90?: number;
  p95: number;
  p99: number;
  throughput?: number;
}

export interface BenchmarkResult {
  name: string;
  metrics: PerformanceMetrics;
  target: PerformanceTarget;
  passed: boolean;
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    cpus: number;
    memory: number;
  };
}

/**
 * Measure performance of an async function
 */
export async function measurePerformance(
  fn: () => Promise<void>,
  iterations = 100
): Promise<PerformanceMetrics> {
  const timings: number[] = [];
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    timings.push(end - start);
  }

  const endTime = performance.now();
  const totalTime = (endTime - startTime) / 1000; // seconds

  return calculateMetrics(timings, iterations, totalTime);
}

/**
 * Measure performance with warmup iterations
 */
export async function measurePerformanceWithWarmup(
  fn: () => Promise<void>,
  iterations = 100,
  warmupIterations = 10
): Promise<PerformanceMetrics> {
  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  // Actual measurement
  return measurePerformance(fn, iterations);
}

/**
 * Calculate performance metrics from timings
 */
export function calculateMetrics(
  timings: number[],
  iterations: number,
  totalTime: number
): PerformanceMetrics {
  const sorted = [...timings].sort((a, b) => a - b);

  const average = timings.reduce((a, b) => a + b, 0) / iterations;
  const median = sorted[Math.floor(iterations * 0.5)];
  const p50 = median;
  const p75 = sorted[Math.floor(iterations * 0.75)];
  const p90 = sorted[Math.floor(iterations * 0.9)];
  const p95 = sorted[Math.floor(iterations * 0.95)];
  const p99 = sorted[Math.floor(iterations * 0.99)];

  // Calculate standard deviation
  const variance = timings.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / iterations;
  const stdDev = Math.sqrt(variance);

  const throughput = iterations / totalTime;

  return {
    timings,
    average,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median,
    p50,
    p75,
    p90,
    p95,
    p99,
    stdDev,
    throughput,
    iterations,
  };
}

/**
 * Percentile calculation
 */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Check if metrics meet targets
 */
export function meetsTargets(metrics: PerformanceMetrics, targets: PerformanceTarget): boolean {
  const checks = [metrics.p95 < targets.p95, metrics.p99 < targets.p99];

  if (targets.p50 !== undefined) {
    checks.push(metrics.p50 < targets.p50);
  }

  if (targets.p75 !== undefined) {
    checks.push(metrics.p75 < targets.p75);
  }

  if (targets.p90 !== undefined) {
    checks.push(metrics.p90 < targets.p90);
  }

  if (targets.throughput !== undefined) {
    checks.push(metrics.throughput > targets.throughput);
  }

  return checks.every((check) => check);
}

/**
 * Generate performance report
 */
export function generateReport(
  name: string,
  metrics: PerformanceMetrics,
  targets: PerformanceTarget
): BenchmarkResult {
  const passed = meetsTargets(metrics, targets);

  return {
    name,
    metrics,
    target: targets,
    passed,
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      cpus: require('os').cpus().length,
      memory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024), // GB
    },
  };
}

/**
 * Save benchmark results to file
 */
export function saveBenchmarkResults(results: BenchmarkResult[], filename: string): void {
  const reportDir = path.join(__dirname, '../reports');

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const filepath = path.join(reportDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
}

/**
 * Load baseline metrics
 */
export function loadBaseline(filename: string): BenchmarkResult[] | null {
  const filepath = path.join(__dirname, '../reports', filename);

  if (!fs.existsSync(filepath)) {
    return null;
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Compare against baseline
 */
export function compareWithBaseline(
  current: BenchmarkResult,
  baseline: BenchmarkResult
): ComparisonResult {
  const regressions: string[] = [];
  const improvements: string[] = [];

  // Compare p95
  const p95Change = ((current.metrics.p95 - baseline.metrics.p95) / baseline.metrics.p95) * 100;
  if (p95Change > 10) {
    regressions.push(`p95: ${p95Change.toFixed(1)}% slower`);
  } else if (p95Change < -10) {
    improvements.push(`p95: ${Math.abs(p95Change).toFixed(1)}% faster`);
  }

  // Compare p99
  const p99Change = ((current.metrics.p99 - baseline.metrics.p99) / baseline.metrics.p99) * 100;
  if (p99Change > 10) {
    regressions.push(`p99: ${p99Change.toFixed(1)}% slower`);
  } else if (p99Change < -10) {
    improvements.push(`p99: ${Math.abs(p99Change).toFixed(1)}% faster`);
  }

  // Compare throughput
  const throughputChange =
    ((current.metrics.throughput - baseline.metrics.throughput) / baseline.metrics.throughput) *
    100;
  if (throughputChange < -10) {
    regressions.push(`throughput: ${Math.abs(throughputChange).toFixed(1)}% lower`);
  } else if (throughputChange > 10) {
    improvements.push(`throughput: ${throughputChange.toFixed(1)}% higher`);
  }

  return {
    current,
    baseline,
    regressions,
    improvements,
    hasRegression: regressions.length > 0,
  };
}

export interface ComparisonResult {
  current: BenchmarkResult;
  baseline: BenchmarkResult;
  regressions: string[];
  improvements: string[];
  hasRegression: boolean;
}

/**
 * Format metrics for console output
 */
export function formatMetrics(
  name: string,
  metrics: PerformanceMetrics,
  targets?: PerformanceTarget
): string {
  const lines = [`\n${name}:`];

  lines.push(`  Average: ${metrics.average.toFixed(2)}ms`);
  lines.push(`  Median: ${metrics.median.toFixed(2)}ms`);
  lines.push(`  Min: ${metrics.min.toFixed(2)}ms`);
  lines.push(`  Max: ${metrics.max.toFixed(2)}ms`);
  lines.push(`  Std Dev: ${metrics.stdDev.toFixed(2)}ms`);

  if (targets) {
    lines.push(
      `  p50: ${metrics.p50.toFixed(2)}ms${targets.p50 ? ` (target: <${targets.p50}ms)` : ''}`
    );
    lines.push(
      `  p75: ${metrics.p75.toFixed(2)}ms${targets.p75 ? ` (target: <${targets.p75}ms)` : ''}`
    );
    lines.push(
      `  p90: ${metrics.p90.toFixed(2)}ms${targets.p90 ? ` (target: <${targets.p90}ms)` : ''}`
    );
    lines.push(
      `  p95: ${metrics.p95.toFixed(2)}ms (target: <${targets.p95}ms) ${metrics.p95 < targets.p95 ? '✓' : '✗'}`
    );
    lines.push(
      `  p99: ${metrics.p99.toFixed(2)}ms (target: <${targets.p99}ms) ${metrics.p99 < targets.p99 ? '✓' : '✗'}`
    );

    if (targets.throughput) {
      lines.push(
        `  Throughput: ${metrics.throughput.toFixed(2)} ops/sec (target: >${targets.throughput}) ${metrics.throughput > targets.throughput ? '✓' : '✗'}`
      );
    }
  } else {
    lines.push(`  p50: ${metrics.p50.toFixed(2)}ms`);
    lines.push(`  p75: ${metrics.p75.toFixed(2)}ms`);
    lines.push(`  p90: ${metrics.p90.toFixed(2)}ms`);
    lines.push(`  p95: ${metrics.p95.toFixed(2)}ms`);
    lines.push(`  p99: ${metrics.p99.toFixed(2)}ms`);
    lines.push(`  Throughput: ${metrics.throughput.toFixed(2)} ops/sec`);
  }

  lines.push(`  Iterations: ${metrics.iterations}`);

  return lines.join('\n');
}

/**
 * Format comparison result
 */
export function formatComparison(comparison: ComparisonResult): string {
  const lines = [`\nPerformance Comparison: ${comparison.current.name}`];
  lines.push(`Current: ${comparison.current.timestamp}`);
  lines.push(`Baseline: ${comparison.baseline.timestamp}`);
  lines.push('');

  if (comparison.improvements.length > 0) {
    lines.push('Improvements:');
    comparison.improvements.forEach((imp) => lines.push(`  ✓ ${imp}`));
    lines.push('');
  }

  if (comparison.regressions.length > 0) {
    lines.push('Regressions:');
    comparison.regressions.forEach((reg) => lines.push(`  ✗ ${reg}`));
    lines.push('');
  }

  if (comparison.regressions.length === 0 && comparison.improvements.length === 0) {
    lines.push('No significant changes detected.');
  }

  return lines.join('\n');
}

/**
 * Run benchmark suite
 */
export async function runBenchmarkSuite(
  benchmarks: Array<{ name: string; fn: () => Promise<void>; targets: PerformanceTarget }>,
  options: { iterations?: number; warmup?: number; saveResults?: boolean } = {}
): Promise<BenchmarkResult[]> {
  const { iterations = 100, warmup = 10, saveResults = true } = options;

  const results: BenchmarkResult[] = [];

  for (const benchmark of benchmarks) {
    console.log(`\nRunning benchmark: ${benchmark.name}`);

    const metrics = await measurePerformanceWithWarmup(benchmark.fn, iterations, warmup);
    const result = generateReport(benchmark.name, metrics, benchmark.targets);

    console.log(formatMetrics(benchmark.name, metrics, benchmark.targets));
    console.log(`Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);

    results.push(result);
  }

  if (saveResults) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    saveBenchmarkResults(results, `benchmark-results-${timestamp}.json`);
  }

  return results;
}

/**
 * Detect performance regression
 */
export function detectRegression(
  current: BenchmarkResult[],
  baseline: BenchmarkResult[]
): { hasRegression: boolean; details: ComparisonResult[] } {
  const details: ComparisonResult[] = [];
  let hasRegression = false;

  for (const currentResult of current) {
    const baselineResult = baseline.find((b) => b.name === currentResult.name);

    if (baselineResult) {
      const comparison = compareWithBaseline(currentResult, baselineResult);
      details.push(comparison);

      if (comparison.hasRegression) {
        hasRegression = true;
      }
    }
  }

  return { hasRegression, details };
}
