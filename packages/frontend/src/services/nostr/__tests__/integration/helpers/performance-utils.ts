/**
 * ⚡ Performance Testing Utilities
 * US-318: Comprehensive Integration Tests
 *
 * Utilities for measuring and benchmarking performance
 */

/**
 * Performance benchmark configuration
 */
export interface BenchmarkConfig {
  name: string;
  thresholdMs: number;
  warmupRuns?: number;
  testRuns?: number;
  parallel?: boolean;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  name: string;
  runs: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  passed: boolean;
  threshold: number;
}

/**
 * Performance Benchmark Suite
 */
export class PerformanceBenchmark {
  private measurements: Map<string, number[]> = new Map();
  private thresholds: Map<string, number> = new Map();

  /**
   * Run benchmark
   */
  async benchmark<T>(
    config: BenchmarkConfig,
    fn: () => Promise<T>
  ): Promise<BenchmarkResult> {
    const { name, thresholdMs, warmupRuns = 3, testRuns = 10, parallel = false } = config;

    // Warmup runs
    for (let i = 0; i < warmupRuns; i++) {
      await fn();
    }

    // Test runs
    const measurements: number[] = [];

    if (parallel) {
      // Run in parallel
      const promises = Array.from({ length: testRuns }, async () => {
        const start = performance.now();
        await fn();
        return performance.now() - start;
      });

      measurements.push(...(await Promise.all(promises)));
    } else {
      // Run sequentially
      for (let i = 0; i < testRuns; i++) {
        const start = performance.now();
        await fn();
        const duration = performance.now() - start;
        measurements.push(duration);
      }
    }

    // Store measurements
    this.measurements.set(name, measurements);
    this.thresholds.set(name, thresholdMs);

    // Calculate statistics
    return this.calculateStats(name, measurements, thresholdMs);
  }

  /**
   * Measure single operation
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return { result, duration };
  }

  /**
   * Calculate statistics
   */
  private calculateStats(name: string, measurements: number[], threshold: number): BenchmarkResult {
    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;

    const result: BenchmarkResult = {
      name,
      runs: count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sorted.reduce((sum, v) => sum + v, 0) / count,
      median: sorted[Math.floor(count / 2)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      passed: sorted[Math.floor(count * 0.95)] <= threshold,
      threshold,
    };

    return result;
  }

  /**
   * Get statistics for a measurement
   */
  getStats(name: string): BenchmarkResult | null {
    const measurements = this.measurements.get(name);
    const threshold = this.thresholds.get(name);

    if (!measurements || measurements.length === 0) {
      return null;
    }

    return this.calculateStats(name, measurements, threshold || 0);
  }

  /**
   * Get all results
   */
  getAllResults(): BenchmarkResult[] {
    const results: BenchmarkResult[] = [];

    for (const [name] of this.measurements) {
      const stats = this.getStats(name);
      if (stats) {
        results.push(stats);
      }
    }

    return results;
  }

  /**
   * Print detailed report
   */
  printReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE BENCHMARK REPORT');
    console.log('='.repeat(80) + '\n');

    const results = this.getAllResults();

    if (results.length === 0) {
      console.log('No benchmark results available.\n');
      return;
    }

    // Summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    console.log(`Overall: ${passed}/${results.length} benchmarks passed\n`);

    // Detailed results
    results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const statusColor = result.passed ? '\x1b[32m' : '\x1b[31m';
      const resetColor = '\x1b[0m';

      console.log(`${statusColor}${status}${resetColor} ${result.name}`);
      console.log(`  Runs:      ${result.runs}`);
      console.log(`  Min:       ${result.min.toFixed(2)}ms`);
      console.log(`  Max:       ${result.max.toFixed(2)}ms`);
      console.log(`  Avg:       ${result.avg.toFixed(2)}ms`);
      console.log(`  Median:    ${result.median.toFixed(2)}ms`);
      console.log(`  P95:       ${result.p95.toFixed(2)}ms (threshold: ${result.threshold}ms)`);
      console.log(`  P99:       ${result.p99.toFixed(2)}ms`);
      console.log('');
    });

    console.log('='.repeat(80) + '\n');

    // Fail if any benchmark failed
    if (failed > 0) {
      throw new Error(`${failed} performance benchmark(s) failed`);
    }
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
    this.thresholds.clear();
  }
}

/**
 * Latency measurement utility
 */
export class LatencyMeasurement {
  private measurements: number[] = [];

  /**
   * Record latency
   */
  record(latencyMs: number): void {
    this.measurements.push(latencyMs);
  }

  /**
   * Get P95 latency
   */
  getP95(): number {
    if (this.measurements.length === 0) return 0;

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }

  /**
   * Get P99 latency
   */
  getP99(): number {
    if (this.measurements.length === 0) return 0;

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.99);
    return sorted[index];
  }

  /**
   * Get average latency
   */
  getAverage(): number {
    if (this.measurements.length === 0) return 0;

    return this.measurements.reduce((sum, v) => sum + v, 0) / this.measurements.length;
  }

  /**
   * Get all percentiles
   */
  getPercentiles(): {
    p50: number;
    p75: number;
    p95: number;
    p99: number;
  } {
    if (this.measurements.length === 0) {
      return { p50: 0, p75: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);

    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Check if threshold met
   */
  meetsThreshold(thresholdMs: number, percentile: number = 0.95): boolean {
    if (percentile === 0.95) {
      return this.getP95() <= thresholdMs;
    } else if (percentile === 0.99) {
      return this.getP99() <= thresholdMs;
    } else {
      return this.getAverage() <= thresholdMs;
    }
  }

  /**
   * Clear measurements
   */
  clear(): void {
    this.measurements = [];
  }
}

/**
 * Throughput measurement utility
 */
export class ThroughputMeasurement {
  private startTime: number = 0;
  private operationCount: number = 0;

  /**
   * Start measurement
   */
  start(): void {
    this.startTime = performance.now();
    this.operationCount = 0;
  }

  /**
   * Record operation
   */
  recordOperation(): void {
    this.operationCount++;
  }

  /**
   * Get operations per second
   */
  getOpsPerSecond(): number {
    if (this.startTime === 0) return 0;

    const elapsedMs = performance.now() - this.startTime;
    const elapsedSeconds = elapsedMs / 1000;

    return this.operationCount / elapsedSeconds;
  }

  /**
   * Get total operations
   */
  getTotalOperations(): number {
    return this.operationCount;
  }

  /**
   * Check if threshold met
   */
  meetsThreshold(minOpsPerSecond: number): boolean {
    return this.getOpsPerSecond() >= minOpsPerSecond;
  }

  /**
   * Reset measurement
   */
  reset(): void {
    this.startTime = 0;
    this.operationCount = 0;
  }
}

/**
 * Load test runner
 */
export class LoadTest {
  /**
   * Run load test with concurrent operations
   */
  async run<T>(
    name: string,
    operationFn: () => Promise<T>,
    config: {
      concurrency: number;
      duration: number;
      warmup?: number;
    }
  ): Promise<{
    totalOperations: number;
    opsPerSecond: number;
    errors: number;
    latency: {
      min: number;
      max: number;
      avg: number;
      p95: number;
      p99: number;
    };
  }> {
    const { concurrency, duration, warmup = 0 } = config;

    // Warmup
    if (warmup > 0) {
      console.log(`🔥 Warming up for ${warmup}ms...`);
      const warmupEnd = Date.now() + warmup;
      while (Date.now() < warmupEnd) {
        await operationFn();
      }
    }

    // Run load test
    console.log(`🚀 Running load test: ${name}`);
    console.log(`   Concurrency: ${concurrency}`);
    console.log(`   Duration: ${duration}ms`);

    const startTime = performance.now();
    const endTime = startTime + duration;
    const latencies: number[] = [];
    let totalOperations = 0;
    let errors = 0;

    // Run concurrent operations
    const workers = Array.from({ length: concurrency }, async () => {
      while (performance.now() < endTime) {
        const opStart = performance.now();

        try {
          await operationFn();
          totalOperations++;

          const latency = performance.now() - opStart;
          latencies.push(latency);
        } catch (error) {
          errors++;
        }
      }
    });

    await Promise.all(workers);

    const actualDuration = performance.now() - startTime;
    const opsPerSecond = (totalOperations / actualDuration) * 1000;

    // Calculate latency statistics
    const sorted = latencies.sort((a, b) => a - b);

    return {
      totalOperations,
      opsPerSecond,
      errors,
      latency: {
        min: sorted[0] || 0,
        max: sorted[sorted.length - 1] || 0,
        avg: sorted.reduce((sum, v) => sum + v, 0) / sorted.length || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      },
    };
  }
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private samples: number[] = [];

  /**
   * Take memory snapshot
   */
  snapshot(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.samples.push(process.memoryUsage().heapUsed);
    }
  }

  /**
   * Get memory growth
   */
  getGrowth(): number {
    if (this.samples.length < 2) return 0;

    return this.samples[this.samples.length - 1] - this.samples[0];
  }

  /**
   * Get memory growth in MB
   */
  getGrowthMB(): number {
    return this.getGrowth() / (1024 * 1024);
  }

  /**
   * Clear samples
   */
  clear(): void {
    this.samples = [];
  }
}
