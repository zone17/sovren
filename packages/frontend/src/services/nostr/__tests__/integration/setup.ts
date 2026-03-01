/**
 * 🧪 Integration Test Setup & Configuration
 * US-318: Comprehensive Integration Tests
 *
 * Central configuration for integration tests with real relay connections
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

/**
 * Test Relay Configuration
 * Uses environment variables with fallback to public test relays
 */
export const TEST_RELAYS = {
  // Primary test relay (local or public)
  primary: process.env.TEST_RELAY_PRIMARY || 'wss://relay.damus.io',

  // Secondary test relays for multi-relay tests
  secondary: [
    process.env.TEST_RELAY_SECONDARY_1 || 'wss://nos.lol',
    process.env.TEST_RELAY_SECONDARY_2 || 'wss://relay.nostr.band',
  ],

  // All test relays combined
  all: [
    process.env.TEST_RELAY_PRIMARY || 'wss://relay.damus.io',
    process.env.TEST_RELAY_SECONDARY_1 || 'wss://nos.lol',
    process.env.TEST_RELAY_SECONDARY_2 || 'wss://relay.nostr.band',
  ],
};

/**
 * Test Configuration
 */
export const TEST_CONFIG = {
  // Test timeouts
  timeout: {
    default: 10000, // 10s default timeout
    connection: 5000, // 5s for relay connections
    publish: 3000, // 3s for event publishing
    subscription: 2000, // 2s for subscriptions
    eose: 5000, // 5s for EOSE
  },

  // Performance thresholds
  performance: {
    publishLatency: 100, // <100ms p95
    subscriptionEOSE: 500, // <500ms EOSE
    cacheOperation: 5, // <5ms cache ops
  },

  // Test data limits
  limits: {
    maxEvents: 100,
    maxSubscriptions: 50,
    maxCacheSize: 5000,
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    backoffMs: 500,
  },
};

/**
 * Global test setup
 */
export function setupIntegrationTests() {
  // Setup IndexedDB mock
  beforeAll(() => {
    console.log('🧪 Integration Test Suite Starting...');
    console.log(`📡 Test Relays: ${TEST_RELAYS.all.join(', ')}`);
  });

  // Cleanup between tests
  beforeEach(() => {
    // Clear any existing timers
    vi.clearAllTimers();
  });

  afterEach(() => {
    // Ensure all async operations complete
    vi.clearAllTimers();
  });

  afterAll(() => {
    console.log('✅ Integration Test Suite Complete');
  });
}

/**
 * Wait utility with timeout
 */
export async function waitFor<T>(
  fn: () => T | Promise<T>,
  options: {
    timeout?: number;
    interval?: number;
    condition?: (result: T) => boolean;
  } = {}
): Promise<T> {
  const { timeout = 5000, interval = 100, condition } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await Promise.resolve(fn());

      if (!condition || condition(result)) {
        return result;
      }
    } catch (error) {
      // Continue waiting
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timeout after ${timeout}ms`);
}

/**
 * Cleanup utility for services
 */
export async function cleanupServices(...services: Array<{ destroy?: () => Promise<void> }>) {
  for (const service of services) {
    if (service && typeof service.destroy === 'function') {
      try {
        await service.destroy();
      } catch (error) {
        console.warn('Service cleanup error:', error);
      }
    }
  }
}

/**
 * Performance measurement utility
 */
export class PerformanceTracker {
  private measurements: Map<string, number[]> = new Map();

  measure<T>(name: string, value: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(value);
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.measure(name, duration);
    }
  }

  getP95(name: string): number {
    const values = this.measurements.get(name);
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }

  getAverage(name: string): number {
    const values = this.measurements.get(name);
    if (!values || values.length === 0) return 0;

    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  getStats(name: string) {
    const values = this.measurements.get(name);
    if (!values || values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p95: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: this.getAverage(name),
      p95: this.getP95(name),
    };
  }

  printReport(): void {
    console.log('\n📊 Performance Report:\n');

    for (const [name, values] of this.measurements) {
      const stats = this.getStats(name);
      console.log(`${name}:`);
      console.log(`  Count: ${stats.count}`);
      console.log(`  Min: ${stats.min.toFixed(2)}ms`);
      console.log(`  Max: ${stats.max.toFixed(2)}ms`);
      console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
    }
  }

  clear(): void {
    this.measurements.clear();
  }
}

/**
 * Test event generator
 */
export function generateTestEvent(kind: number = 1, content: string = 'Test event') {
  return {
    kind,
    content,
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Deterministic test key generator (for testing only)
 */
export function generateTestKeys() {
  // Use deterministic keys for testing
  const privateKey = 'a'.repeat(64);
  const publicKey = 'b'.repeat(64);

  return {
    privateKey,
    publicKey,
    nsec: 'nsec1' + privateKey.substring(0, 58),
    npub: 'npub1' + publicKey.substring(0, 58),
  };
}

/**
 * Assert helpers
 */
export function assertEventValid(event: any): void {
  if (!event) throw new Error('Event is null/undefined');
  if (!event.id) throw new Error('Event missing id');
  if (!event.pubkey) throw new Error('Event missing pubkey');
  if (!event.sig) throw new Error('Event missing signature');
  if (typeof event.kind !== 'number') throw new Error('Event missing kind');
  if (typeof event.created_at !== 'number') throw new Error('Event missing created_at');
  if (!Array.isArray(event.tags)) throw new Error('Event tags must be array');
  if (typeof event.content !== 'string') throw new Error('Event content must be string');
}

/**
 * Memory leak detector
 */
export class MemoryLeakDetector {
  private initialHeapSize: number = 0;

  start(): void {
    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    this.initialHeapSize = process.memoryUsage().heapUsed;
  }

  check(threshold: number = 10 * 1024 * 1024): { leaked: boolean; growth: number } {
    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const currentHeapSize = process.memoryUsage().heapUsed;
    const growth = currentHeapSize - this.initialHeapSize;
    const leaked = growth > threshold;

    return { leaked, growth };
  }
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    backoffMs?: number;
    maxBackoffMs?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, backoffMs = 100, maxBackoffMs = 5000 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = Math.min(backoffMs * Math.pow(2, attempt), maxBackoffMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
