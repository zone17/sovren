/**
 * ⚡ **ELITE BUTTON PERFORMANCE TESTS**
 *
 * **Purpose**: Comprehensive performance testing for Button component
 * **Architecture**: Using our elite performance testing utilities
 * **Security**: Safe performance measurement without data leakage
 * **Performance**: Measuring render time, memory usage, and DOM complexity
 *
 * @author Elite Engineering Team
 * @version 1.0.0 - US-201 Test Infrastructure Repair
 * @lastModified 2024-12-28
 */

import {
  benchmarkComponent,
  createPerformanceTestSuite,
  PerformanceTestOptions,
  PerformanceThresholds,
  testPerformanceThresholds,
  usePerformanceTesting,
} from '../../../test-utils/performance-testing';
import { Button } from '../button';

describe('Button Component Performance Tests', () => {
  const { measure, benchmark, test, createSuite } = usePerformanceTesting();

  // 🎯 **BASIC PERFORMANCE TESTS**
  describe('Basic Performance Measurements', () => {
    it('measures default button render performance', async () => {
      const metrics = await measure(<Button>Default Button</Button>);

      expect(metrics).toHaveProperty('renderTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('domNodes');
      expect(metrics.renderTime).toBeGreaterThan(0);
      expect(metrics.domNodes).toBeGreaterThan(0);
    });

    it('measures loading button render performance', async () => {
      const metrics = await measure(<Button isLoading>Loading Button</Button>, {
        measureMemory: true,
        measureDomNodes: true,
      });

      expect(metrics.renderTime).toBeGreaterThan(0);
      expect(metrics.domNodes).toBeGreaterThan(0);
      // Loading button should have more DOM nodes due to spinner
      expect(metrics.domNodes).toBeGreaterThan(1);
    });

    it('measures disabled button render performance', async () => {
      const metrics = await measure(<Button disabled>Disabled Button</Button>);

      expect(metrics.renderTime).toBeGreaterThan(0);
      expect(metrics.domNodes).toBeGreaterThan(0);
    });
  });

  // 🎯 **BENCHMARK TESTS**
  describe('Button Benchmarking', () => {
    it('benchmarks default button performance', async () => {
      const benchmark = await benchmarkComponent(
        'default-button',
        <Button>Default Button</Button>,
        {
          iterations: 5,
          warmUpIterations: 2,
          measureMemory: true,
          measureDomNodes: true,
        }
      );

      expect(benchmark.name).toBe('default-button');
      expect(benchmark.iterations).toBe(5);
      expect(benchmark.metrics).toHaveLength(5);
      expect(benchmark.average.renderTime).toBeGreaterThan(0);
      expect(benchmark.standardDeviation).toBeGreaterThanOrEqual(0);
    });

    it('benchmarks different button variants', async () => {
      const variants = [
        { name: 'default', variant: 'default' },
        { name: 'destructive', variant: 'destructive' },
        { name: 'lightning', variant: 'lightning' },
        { name: 'sovereign', variant: 'sovereign' },
      ];

      for (const { name, variant } of variants) {
        const benchmark = await benchmarkComponent(
          `${name}-button`,
          <Button variant={variant as any}>{name} Button</Button>,
          {
            iterations: 3,
            warmUpIterations: 1,
            measureMemory: true,
          }
        );

        expect(benchmark.name).toBe(`${name}-button`);
        expect(benchmark.average.renderTime).toBeGreaterThan(0);
        expect(benchmark.average.renderTime).toBeLessThan(100); // Should render in < 100ms
      }
    });

    it('benchmarks loading vs non-loading button', async () => {
      const normalBenchmark = await benchmarkComponent(
        'normal-button',
        <Button>Normal Button</Button>,
        { iterations: 3, warmUpIterations: 1 }
      );

      const loadingBenchmark = await benchmarkComponent(
        'loading-button',
        <Button isLoading>Loading Button</Button>,
        { iterations: 3, warmUpIterations: 1 }
      );

      // Loading button should take slightly longer due to spinner
      expect(loadingBenchmark.average.renderTime).toBeGreaterThanOrEqual(
        normalBenchmark.average.renderTime
      );

      // Both should still be fast
      expect(normalBenchmark.average.renderTime).toBeLessThan(50);
      expect(loadingBenchmark.average.renderTime).toBeLessThan(100);
    });
  });

  // 🎯 **THRESHOLD TESTS**
  describe('Performance Threshold Testing', () => {
    const standardThresholds: PerformanceThresholds = {
      maxRenderTime: 50, // 50ms max render time
      maxMemoryUsage: 1, // 1MB max memory usage
      maxDomNodes: 10, // 10 max DOM nodes
      maxReRenders: 0, // No re-renders for static content
    };

    it('tests default button against thresholds', async () => {
      const result = await testPerformanceThresholds(
        <Button>Default Button</Button>,
        standardThresholds
      );

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.metrics.renderTime).toBeLessThan(50);
    });

    it('tests loading button against relaxed thresholds', async () => {
      const relaxedThresholds: PerformanceThresholds = {
        maxRenderTime: 100, // More lenient for loading state
        maxMemoryUsage: 2,
        maxDomNodes: 15, // More DOM nodes for spinner
        maxReRenders: 0,
      };

      const result = await testPerformanceThresholds(
        <Button isLoading>Loading Button</Button>,
        relaxedThresholds
      );

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('tests large button with long text against thresholds', async () => {
      const longTextThresholds: PerformanceThresholds = {
        maxRenderTime: 75, // Slightly more time for text processing
        maxMemoryUsage: 1.5,
        maxDomNodes: 20, // More nodes for text wrapping
        maxReRenders: 0,
      };

      const result = await testPerformanceThresholds(
        <Button size="lg">This is a very long button text that might affect performance</Button>,
        longTextThresholds
      );

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  // 🎯 **PERFORMANCE TEST SUITE**
  describe('Comprehensive Performance Suite', () => {
    createPerformanceTestSuite('Button Performance Suite', [
      {
        name: 'Default Button',
        component: <Button>Default</Button>,
        thresholds: {
          maxRenderTime: 30,
          maxMemoryUsage: 1,
          maxDomNodes: 5,
        },
      },
      {
        name: 'Destructive Button',
        component: <Button variant="destructive">Delete</Button>,
        thresholds: {
          maxRenderTime: 35,
          maxMemoryUsage: 1,
          maxDomNodes: 5,
        },
      },
      {
        name: 'Lightning Button',
        component: <Button variant="lightning">⚡ Lightning</Button>,
        thresholds: {
          maxRenderTime: 40, // Slightly more for emoji
          maxMemoryUsage: 1,
          maxDomNodes: 5,
        },
      },
      {
        name: 'Loading Button',
        component: <Button isLoading>Loading...</Button>,
        thresholds: {
          maxRenderTime: 60, // More time for spinner
          maxMemoryUsage: 1.5,
          maxDomNodes: 10, // More nodes for spinner
        },
      },
      {
        name: 'Disabled Button',
        component: <Button disabled>Disabled</Button>,
        thresholds: {
          maxRenderTime: 30,
          maxMemoryUsage: 1,
          maxDomNodes: 5,
        },
      },
    ]);
  });

  // 🎯 **COMPARATIVE PERFORMANCE TESTS**
  describe('Comparative Performance Analysis', () => {
    it('compares performance across button sizes', async () => {
      const sizes = ['sm', 'default', 'lg', 'icon'] as const;
      const results = [];

      for (const size of sizes) {
        const metrics = await measure(
          <Button size={size}>{size === 'icon' ? '🏠' : `${size} Button`}</Button>,
          { iterations: 3 }
        );
        results.push({ size, metrics });
      }

      // All sizes should perform similarly
      const renderTimes = results.map((r) => r.metrics.renderTime);
      const maxRenderTime = Math.max(...renderTimes);
      const minRenderTime = Math.min(...renderTimes);

      // Render time variance should be minimal
      expect(maxRenderTime - minRenderTime).toBeLessThan(20);
    });

    it('compares performance across button variants', async () => {
      const variants = [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
        'lightning',
        'sovereign',
        'premium',
      ] as const;

      const results = [];

      for (const variant of variants) {
        const metrics = await measure(<Button variant={variant}>{variant} Button</Button>, {
          iterations: 3,
        });
        results.push({ variant, metrics });
      }

      // All variants should perform within reasonable bounds
      results.forEach(({ variant, metrics }) => {
        expect(metrics.renderTime).toBeLessThan(100);
        expect(metrics.domNodes).toBeLessThan(15);
      });
    });
  });

  // 🎯 **STRESS TESTING**
  describe('Button Stress Testing', () => {
    it('tests button performance under rapid re-renders', async () => {
      const options: PerformanceTestOptions = {
        iterations: 20,
        warmUpIterations: 5,
        measureMemory: true,
        measureDomNodes: true,
      };

      const benchmark = await benchmarkComponent(
        'stress-test-button',
        <Button>Stress Test Button</Button>,
        options
      );

      // Performance should remain consistent
      expect(benchmark.standardDeviation).toBeLessThan(10);
      expect(benchmark.average.renderTime).toBeLessThan(50);
      expect(benchmark.max.renderTime).toBeLessThan(100);
    });

    it('tests button performance with complex children', async () => {
      const complexButton = (
        <Button>
          <span className="flex items-center">
            <span className="mr-2">💡</span>
            Complex Button Content
            <span className="ml-2 text-xs">(with nested elements)</span>
          </span>
        </Button>
      );

      const result = await testPerformanceThresholds(complexButton, {
        maxRenderTime: 80, // More lenient for complex content
        maxMemoryUsage: 2,
        maxDomNodes: 25, // More nodes for nested content
      });

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  // 🎯 **MEMORY LEAK DETECTION**
  describe('Memory Leak Detection', () => {
    it('detects memory leaks in button rendering', async () => {
      const initialMetrics = await measure(<Button>Initial</Button>);

      // Render many buttons
      for (let i = 0; i < 10; i++) {
        await measure(<Button>Button {i}</Button>);
      }

      const finalMetrics = await measure(<Button>Final</Button>);

      // Memory usage should not increase dramatically
      const memoryIncrease =
        finalMetrics.memoryUsage.heapUsed - initialMetrics.memoryUsage.heapUsed;
      const memoryIncreasePercentage = (memoryIncrease / initialMetrics.memoryUsage.heapUsed) * 100;

      // Memory increase should be less than 50%
      expect(memoryIncreasePercentage).toBeLessThan(50);
    });
  });
});
