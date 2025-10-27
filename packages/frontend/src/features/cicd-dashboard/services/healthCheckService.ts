/**
 * CI/CD Dashboard - Health Check Monitoring Service
 *
 * Service for monitoring application health endpoints across environments.
 * Supports periodic polling and caching of health check results.
 */

import type { HealthCheckResult, HealthCheckDetails } from '../types';

/**
 * Health check endpoint configuration
 */
interface HealthCheckEndpoint {
  /** Endpoint path */
  path: '/health' | '/ready' | '/live' | '/detailed';

  /** Base URL (e.g., https://api-staging.sovren.dev) */
  baseUrl: string;

  /** Expected response time threshold (ms) */
  threshold: number;
}

/**
 * Health check service configuration
 */
interface HealthCheckServiceConfig {
  /** Staging base URL */
  stagingBaseUrl: string;

  /** Production base URL */
  productionBaseUrl: string;

  /** Polling interval in milliseconds */
  pollingInterval?: number;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Enable caching */
  enableCache?: boolean;

  /** Cache TTL in milliseconds */
  cacheTTL?: number;
}

/**
 * Health check response thresholds
 */
const RESPONSE_TIME_THRESHOLDS = {
  '/health': 500, // 500ms
  '/ready': 1000, // 1s
  '/live': 100, // 100ms
  '/detailed': 2000, // 2s
};

/**
 * Health status determination
 */
function determineHealthStatus(
  responseTime: number,
  threshold: number,
  statusCode: number
): 'healthy' | 'degraded' | 'unhealthy' {
  if (statusCode !== 200) {
    return 'unhealthy';
  }

  if (responseTime <= threshold) {
    return 'healthy';
  }

  if (responseTime <= threshold * 1.5) {
    return 'degraded';
  }

  return 'unhealthy';
}

/**
 * Health check monitoring service
 */
export class HealthCheckService {
  private readonly stagingBaseUrl: string;
  private readonly productionBaseUrl: string;
  private readonly pollingInterval: number;
  private readonly timeout: number;
  private readonly enableCache: boolean;
  private readonly cacheTTL: number;

  private pollingIntervalId: NodeJS.Timeout | null = null;
  private cache: Map<string, { result: HealthCheckResult; timestamp: number }> = new Map();
  private listeners: Set<(results: HealthCheckResult[]) => void> = new Set();

  constructor(config: HealthCheckServiceConfig) {
    this.stagingBaseUrl = config.stagingBaseUrl;
    this.productionBaseUrl = config.productionBaseUrl;
    this.pollingInterval = config.pollingInterval ?? 30000; // Default: 30 seconds
    this.timeout = config.timeout ?? 5000; // Default: 5 seconds
    this.enableCache = config.enableCache ?? true;
    this.cacheTTL = config.cacheTTL ?? 10000; // Default: 10 seconds
  }

  /**
   * Check a single health endpoint
   */
  async checkEndpoint(endpoint: HealthCheckEndpoint): Promise<HealthCheckResult> {
    const cacheKey = `${endpoint.baseUrl}${endpoint.path}`;

    // Check cache
    if (this.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.result;
      }
    }

    const url = `${endpoint.baseUrl}${endpoint.path}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const statusCode = response.status;

      const status = determineHealthStatus(
        responseTime,
        endpoint.threshold,
        statusCode
      );

      let details: HealthCheckDetails | undefined;

      // Parse detailed response for /detailed endpoint
      if (endpoint.path === '/detailed' && response.ok) {
        try {
          const data = await response.json();
          details = data as HealthCheckDetails;
        } catch {
          // Ignore JSON parse errors
        }
      }

      const result: HealthCheckResult = {
        endpoint: endpoint.path,
        status,
        responseTime,
        timestamp: new Date(),
        statusCode,
        details,
      };

      // Update cache
      if (this.enableCache) {
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      const result: HealthCheckResult = {
        endpoint: endpoint.path,
        status: 'unhealthy',
        responseTime,
        timestamp: new Date(),
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      // Update cache even on error (to prevent spam)
      if (this.enableCache) {
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });
      }

      return result;
    }
  }

  /**
   * Check all health endpoints for an environment
   */
  async checkEnvironment(
    environment: 'staging' | 'production'
  ): Promise<HealthCheckResult[]> {
    const baseUrl =
      environment === 'staging' ? this.stagingBaseUrl : this.productionBaseUrl;

    const endpoints: HealthCheckEndpoint[] = [
      { path: '/health', baseUrl, threshold: RESPONSE_TIME_THRESHOLDS['/health'] },
      { path: '/ready', baseUrl, threshold: RESPONSE_TIME_THRESHOLDS['/ready'] },
      { path: '/live', baseUrl, threshold: RESPONSE_TIME_THRESHOLDS['/live'] },
      { path: '/detailed', baseUrl, threshold: RESPONSE_TIME_THRESHOLDS['/detailed'] },
    ];

    // Check all endpoints in parallel
    const results = await Promise.all(
      endpoints.map((endpoint) => this.checkEndpoint(endpoint))
    );

    return results;
  }

  /**
   * Check all environments (staging and production)
   */
  async checkAllEnvironments(): Promise<{
    staging: HealthCheckResult[];
    production: HealthCheckResult[];
  }> {
    const [staging, production] = await Promise.all([
      this.checkEnvironment('staging'),
      this.checkEnvironment('production'),
    ]);

    return { staging, production };
  }

  /**
   * Start periodic health check polling
   */
  startPolling(callback: (results: HealthCheckResult[]) => void): void {
    // Add callback to listeners
    this.listeners.add(callback);

    // Start polling if not already started
    if (!this.pollingIntervalId) {
      this.pollingIntervalId = setInterval(() => {
        this.pollHealthChecks();
      }, this.pollingInterval);

      // Initial poll
      this.pollHealthChecks();
    }
  }

  /**
   * Stop health check polling
   */
  stopPolling(callback?: (results: HealthCheckResult[]) => void): void {
    if (callback) {
      this.listeners.delete(callback);
    } else {
      this.listeners.clear();
    }

    // Stop polling if no listeners
    if (this.listeners.size === 0 && this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  /**
   * Internal polling method
   */
  private async pollHealthChecks(): Promise<void> {
    try {
      const { staging, production } = await this.checkAllEnvironments();
      const allResults = [...staging, ...production];

      // Notify all listeners
      this.listeners.forEach((listener) => {
        try {
          listener(allResults);
        } catch (error) {
          console.error('Error in health check listener:', error);
        }
      });
    } catch (error) {
      console.error('Error polling health checks:', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ key: string; age: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPolling();
    this.clearCache();
    this.listeners.clear();
  }
}

/**
 * Singleton instance
 */
let healthCheckServiceInstance: HealthCheckService | null = null;

/**
 * Initialize health check service
 */
export function initHealthCheckService(
  config: HealthCheckServiceConfig
): HealthCheckService {
  healthCheckServiceInstance = new HealthCheckService(config);
  return healthCheckServiceInstance;
}

/**
 * Get health check service instance
 */
export function getHealthCheckService(): HealthCheckService {
  if (!healthCheckServiceInstance) {
    throw new Error(
      'HealthCheckService not initialized. Call initHealthCheckService first.'
    );
  }
  return healthCheckServiceInstance;
}

/**
 * Default export
 */
export default {
  init: initHealthCheckService,
  getInstance: getHealthCheckService,
};
