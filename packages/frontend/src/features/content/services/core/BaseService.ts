/**
 * 🔧 **BASE SERVICE CLASS - COMMON SERVICE FUNCTIONALITY**
 *
 * Elite Engineering Standards:
 * ✅ Common service functionality and utilities
 * ✅ Health monitoring and metrics collection
 * ✅ Error handling and recovery patterns
 * ✅ Performance tracking and optimization
 * ✅ Service lifecycle management
 * ✅ Logging and debugging support
 */

import type { IService, ServiceContext, ServiceError, ServiceMetrics } from './ServiceInterfaces';

// Global type declarations for browser APIs
declare const console: Console;
declare const performance: Performance;
declare const setTimeout: (handler: TimerHandler, timeout?: number) => number;

/**
 * Base service class providing common functionality
 */
export abstract class BaseService implements IService {
  protected startTime: Date;
  protected requestCount: number = 0;
  protected successCount: number = 0;
  protected errorCount: number = 0;
  protected responseTimeSum: number = 0;
  protected lastRequestTime: Date | null = null;
  protected isDisposed: boolean = false;

  constructor(
    public readonly name: string,
    public readonly version: string
  ) {
    this.startTime = new Date();
  }

  /**
   * Check service health
   */
  async isHealthy(): Promise<boolean> {
    if (this.isDisposed) {
      return false;
    }

    try {
      // Perform health check specific to the service
      return await this.performHealthCheck();
    } catch (error) {
      console.error(`Health check failed for service ${this.name}:`, error);
      return false;
    }
  }

  /**
   * Get service metrics
   */
  async getMetrics(): Promise<ServiceMetrics> {
    const uptime = Date.now() - this.startTime.getTime();
    const averageResponseTime =
      this.requestCount > 0 ? this.responseTimeSum / this.requestCount : 0;

    return {
      name: this.name,
      uptime,
      totalRequests: this.requestCount,
      successfulRequests: this.successCount,
      failedRequests: this.errorCount,
      averageResponseTime,
      lastRequestTime: this.lastRequestTime,
      customMetrics: await this.getCustomMetrics(),
    };
  }

  /**
   * Dispose of the service
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    try {
      await this.performCleanup();
      this.isDisposed = true;
    } catch (error) {
      console.error(`Failed to dispose service ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Execute an operation with performance tracking and error handling
   */
  protected async executeOperation<T>(
    operation: string,
    context: ServiceContext,
    handler: () => Promise<T>
  ): Promise<T> {
    if (this.isDisposed) {
      throw this.createServiceError(
        'SERVICE_DISPOSED',
        `Service ${this.name} has been disposed`,
        operation,
        context,
        false
      );
    }

    const startTime = performance.now();
    this.requestCount++;
    this.lastRequestTime = new Date();

    try {
      await this.beforeOperation(operation, context);
      const result = await handler();

      const endTime = performance.now();
      const responseTime = endTime - startTime;
      this.responseTimeSum += responseTime;
      this.successCount++;

      await this.afterOperation(operation, context, responseTime, null);

      return result;
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      this.responseTimeSum += responseTime;
      this.errorCount++;

      await this.afterOperation(operation, context, responseTime, error as Error);

      // Re-throw as ServiceErrorImpl if not already one
      if (error instanceof ServiceErrorImpl || (error as any).code) {
        throw error;
      }

      throw this.createServiceError(
        'OPERATION_FAILED',
        error instanceof Error ? error.message : 'Unknown error',
        operation,
        context,
        true
      );
    }
  }

  /**
   * Create a standardized service error
   */
  protected createServiceError(
    code: string,
    message: string,
    operation: string,
    context: ServiceContext,
    retryable: boolean,
    details?: any
  ): ServiceError {
    return {
      code,
      message,
      details,
      timestamp: new Date(),
      serviceName: this.name,
      operation,
      retryable,
    };
  }

  /**
   * Log service events
   */
  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: ServiceContext,
    metadata?: any
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.name,
      level,
      message,
      context: context
        ? {
            userId: context.userId,
            requestId: context.requestId,
            source: context.source,
          }
        : undefined,
      metadata,
    };

    switch (level) {
      case 'debug':
        console.debug('[DEBUG]', JSON.stringify(logEntry));
        break;
      case 'info':
        console.info('[INFO]', JSON.stringify(logEntry));
        break;
      case 'warn':
        console.warn('[WARN]', JSON.stringify(logEntry));
        break;
      case 'error':
        console.error('[ERROR]', JSON.stringify(logEntry));
        break;
    }
  }

  /**
   * Validate service context
   */
  protected validateContext(context: ServiceContext): void {
    if (!context.requestId) {
      throw new Error('Service context must include requestId');
    }
    if (!context.timestamp) {
      throw new Error('Service context must include timestamp');
    }
    if (!context.source) {
      throw new Error('Service context must include source');
    }
  }

  /**
   * Create a service context for internal operations
   */
  protected createInternalContext(operation: string): ServiceContext {
    return {
      requestId: `internal_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      source: `${this.name}.${operation}`,
      metadata: {
        internal: true,
        operation,
      },
    };
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 10000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if ((error as any).retryable === false) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
          maxDelay
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  // Abstract methods to be implemented by derived services

  /**
   * Perform service-specific health check
   */
  protected abstract performHealthCheck(): Promise<boolean>;

  /**
   * Get service-specific custom metrics
   */
  protected abstract getCustomMetrics(): Promise<Record<string, any>>;

  /**
   * Perform service-specific cleanup
   */
  protected async performCleanup(): Promise<void> {
    // Default no-op — subclasses override for custom cleanup
  }

  /**
   * Hook called before each operation
   */
  protected async beforeOperation(operation: string, context: ServiceContext): Promise<void> {
    this.validateContext(context);
    this.log('debug', `Starting operation: ${operation}`, context);
  }

  /**
   * Hook called after each operation
   */
  protected async afterOperation(
    operation: string,
    context: ServiceContext,
    responseTime: number,
    error: Error | null
  ): Promise<void> {
    if (error) {
      this.log('error', `Operation failed: ${operation}`, context, {
        responseTime,
        error: error.message,
      });
    } else {
      this.log('debug', `Operation completed: ${operation}`, context, {
        responseTime,
      });
    }
  }
}

/**
 * Service error class for standardized error handling
 */
export class ServiceErrorImpl extends Error implements ServiceError {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: any = null,
    public readonly timestamp: Date = new Date(),
    public readonly serviceName: string,
    public readonly operation: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Performance monitor utility for service operations
 */
export class ServicePerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();

  /**
   * Record a performance measurement
   */
  record(operation: string, duration: number): void {
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }

    const measurements = this.measurements.get(operation)!;
    measurements.push(duration);

    // Keep only the last 1000 measurements
    if (measurements.length > 1000) {
      measurements.shift();
    }
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operation: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } | null {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const average = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    return {
      count,
      average,
      min,
      max,
      p95,
      p99,
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): Record<string, ReturnType<ServicePerformanceMonitor['getStats']>> {
    const results: Record<string, any> = {};
    for (const operation of this.measurements.keys()) {
      results[operation] = this.getStats(operation);
    }
    return results;
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }
}

/**
 * Service health checker utility
 */
export class ServiceHealthChecker {
  private readonly checks: Map<string, () => Promise<boolean>> = new Map();

  /**
   * Register a health check
   */
  register(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  /**
   * Unregister a health check
   */
  unregister(name: string): void {
    this.checks.delete(name);
  }

  /**
   * Run all health checks
   */
  async checkAll(): Promise<{ healthy: boolean; results: Record<string, boolean> }> {
    const results: Record<string, boolean> = {};
    let overallHealthy = true;

    for (const [name, check] of this.checks) {
      try {
        results[name] = await check();
        if (!results[name]) {
          overallHealthy = false;
        }
      } catch (error) {
        console.error(`Health check ${name} failed:`, error);
        results[name] = false;
        overallHealthy = false;
      }
    }

    return {
      healthy: overallHealthy,
      results,
    };
  }
}
