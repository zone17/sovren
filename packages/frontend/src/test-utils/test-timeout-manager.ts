/**
 * 🧪 **ELITE TEST TIMEOUT MANAGER**
 *
 * **Purpose**: Comprehensive timeout management for all test files
 * **Architecture**: Centralized timeout handling with smart defaults
 * **Security**: Safe timeout handling with proper cleanup
 * **Performance**: Optimized timeout values for different test types
 *
 * @author Elite Engineering Team
 * @version 1.0.0 - US-201 Test Infrastructure Repair
 * @lastModified 2024-12-28
 */

import { jest } from '@jest/globals';

// 🎯 **TIMEOUT CONSTANTS**
export const TEST_TIMEOUTS = {
  FAST: 5000, // 5 seconds - quick operations
  NORMAL: 10000, // 10 seconds - standard operations
  SLOW: 15000, // 15 seconds - heavy operations
  ANALYTICS: 20000, // 20 seconds - analytics operations
  INTEGRATION: 30000, // 30 seconds - integration tests
  E2E: 45000, // 45 seconds - end-to-end tests
} as const;

// 🔧 **TIMEOUT MANAGER CLASS**
export class TestTimeoutManager {
  private activeTimeouts: Set<NodeJS.Timeout> = new Set();
  private useFakeTimers: boolean = false;

  /**
   * Set up fake timers for consistent testing
   */
  public setupFakeTimers(): void {
    this.clearAllTimeouts();
    jest.useFakeTimers();
    this.useFakeTimers = true;
  }

  /**
   * Restore real timers
   */
  public restoreRealTimers(): void {
    this.clearAllTimeouts();
    if (this.useFakeTimers) {
      jest.useRealTimers();
      this.useFakeTimers = false;
    }
  }

  /**
   * Create a safe timeout that gets cleaned up automatically
   */
  public createTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeout = setTimeout(() => {
      this.activeTimeouts.delete(timeout);
      callback();
    }, delay);

    this.activeTimeouts.add(timeout);
    return timeout;
  }

  /**
   * Clear a specific timeout
   */
  public clearTimeout(timeout: NodeJS.Timeout): void {
    clearTimeout(timeout);
    this.activeTimeouts.delete(timeout);
  }

  /**
   * Clear all active timeouts
   */
  public clearAllTimeouts(): void {
    this.activeTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.activeTimeouts.clear();
  }

  /**
   * Advance timers by specified time (for fake timers)
   */
  public advanceTimers(milliseconds: number): void {
    if (this.useFakeTimers) {
      jest.advanceTimersByTime(milliseconds);
    }
  }

  /**
   * Run all pending timers (for fake timers)
   */
  public runAllTimers(): void {
    if (this.useFakeTimers) {
      jest.runAllTimers();
    }
  }

  /**
   * Wait for a specific amount of time
   */
  public async wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const timeout = this.createTimeout(resolve, milliseconds);
      // Don't need to clear this timeout as it's auto-cleaned
    });
  }

  /**
   * Create a timeout-aware promise
   */
  public createTimeoutPromise<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = 'Operation timed out'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = this.createTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);

      promise
        .then((result) => {
          this.clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          this.clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Clean up all resources
   */
  public cleanup(): void {
    this.clearAllTimeouts();
    this.restoreRealTimers();
  }
}

// 🌍 **GLOBAL TIMEOUT MANAGER INSTANCE**
export const globalTimeoutManager = new TestTimeoutManager();

// 🧹 **AUTOMATIC CLEANUP HOOKS**
beforeEach(() => {
  globalTimeoutManager.clearAllTimeouts();
});

afterEach(() => {
  globalTimeoutManager.clearAllTimeouts();
});

afterAll(() => {
  globalTimeoutManager.cleanup();
});

// 🎭 **HELPER FUNCTIONS**

/**
 * Wait for condition to be true with timeout
 */
export async function waitForCondition(
  condition: () => boolean,
  timeoutMs: number = TEST_TIMEOUTS.NORMAL,
  intervalMs: number = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (condition()) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('Condition not met within timeout'));
        return;
      }

      globalTimeoutManager.createTimeout(check, intervalMs);
    };

    check();
  });
}

/**
 * Debounce a function with timeout management
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null;

  return ((...args: Parameters<T>) => {
    if (timeout) {
      globalTimeoutManager.clearTimeout(timeout);
    }

    timeout = globalTimeoutManager.createTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  }) as T;
}

/**
 * Create a mock async function with configurable delay
 */
export function createMockAsyncFunction<T>(
  returnValue: T,
  delay: number = 100
): jest.MockedFunction<() => Promise<T>> {
  return jest.fn(async () => {
    await globalTimeoutManager.wait(delay);
    return returnValue;
  }) as jest.MockedFunction<() => Promise<T>>;
}

/**
 * Create a mock function that times out
 */
export function createMockTimeoutFunction<T>(
  delay: number = 1000,
  errorMessage: string = 'Mock timeout'
): jest.MockedFunction<() => Promise<T>> {
  return jest.fn(async () => {
    await globalTimeoutManager.wait(delay);
    throw new Error(errorMessage);
  }) as jest.MockedFunction<() => Promise<T>>;
}

// 🚨 **ANALYTICS-SPECIFIC TIMEOUT HELPERS**

/**
 * Wait for analytics data to load
 */
export async function waitForAnalyticsData(
  dataSelector: () => any,
  timeoutMs: number = TEST_TIMEOUTS.ANALYTICS
): Promise<void> {
  return waitForCondition(() => {
    const data = dataSelector();
    return data !== null && data !== undefined && data !== '';
  }, timeoutMs);
}

/**
 * Mock analytics service with realistic delays
 */
export function createMockAnalyticsService() {
  return {
    getMetrics: createMockAsyncFunction({ metrics: 'mock_data' }, 200),
    getChartData: createMockAsyncFunction({ charts: 'mock_data' }, 300),
    getInsights: createMockAsyncFunction({ insights: 'mock_data' }, 400),
    exportData: createMockAsyncFunction({ export: 'mock_data' }, 1000),

    // Timeout scenarios
    getMetricsTimeout: createMockTimeoutFunction(TEST_TIMEOUTS.ANALYTICS, 'Analytics timeout'),
    getChartDataTimeout: createMockTimeoutFunction(TEST_TIMEOUTS.ANALYTICS, 'Chart data timeout'),
  };
}

// 📊 **PERFORMANCE TESTING HELPERS**

/**
 * Measure operation performance with timeout protection
 */
export async function measurePerformance<T>(
  operation: () => Promise<T>,
  maxTimeMs: number = TEST_TIMEOUTS.NORMAL
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();

  const result = await globalTimeoutManager.createTimeoutPromise(
    operation(),
    maxTimeMs,
    `Operation exceeded ${maxTimeMs}ms limit`
  );

  const duration = Date.now() - startTime;
  return { result, duration };
}

/**
 * Test concurrent operations with timeout protection
 */
export async function testConcurrentOperations<T>(
  operations: (() => Promise<T>)[],
  maxTimeMs: number = TEST_TIMEOUTS.NORMAL
): Promise<T[]> {
  const promises = operations.map((op) =>
    globalTimeoutManager.createTimeoutPromise(op(), maxTimeMs, 'Concurrent operation timed out')
  );

  return Promise.all(promises);
}

// 🔍 **INTEGRATION TEST HELPERS**

/**
 * Setup integration test environment with proper timeouts
 */
export function setupIntegrationTest(
  options: {
    useFakeTimers?: boolean;
    defaultTimeout?: number;
  } = {}
) {
  const { useFakeTimers = false, defaultTimeout = TEST_TIMEOUTS.INTEGRATION } = options;

  beforeEach(() => {
    if (useFakeTimers) {
      globalTimeoutManager.setupFakeTimers();
    }
  });

  afterEach(() => {
    if (useFakeTimers) {
      globalTimeoutManager.restoreRealTimers();
    }
  });

  return {
    timeout: defaultTimeout,
    waitFor: (condition: () => boolean, timeout?: number) =>
      waitForCondition(condition, timeout || defaultTimeout),
    createMockAsync: <T>(value: T, delay?: number) => createMockAsyncFunction(value, delay),
  };
}

/**
 * Create test suite with timeout configuration
 */
export function createTestSuite(
  suiteName: string,
  tests: () => void,
  options: {
    timeout?: number;
    useFakeTimers?: boolean;
  } = {}
) {
  const { timeout = TEST_TIMEOUTS.NORMAL, useFakeTimers = false } = options;

  describe(suiteName, () => {
    const integration = setupIntegrationTest({ useFakeTimers, defaultTimeout: timeout });

    beforeAll(() => {
      jest.setTimeout(timeout);
    });

    tests();
  });
}

// 🎯 **EXPORT ALIAS FOR CONVENIENCE**
export const timeoutManager = globalTimeoutManager;
