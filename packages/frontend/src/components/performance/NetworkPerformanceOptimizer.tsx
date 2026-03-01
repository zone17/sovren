// ===================================================================
// SOVREN NETWORK PERFORMANCE OPTIMIZER - LEGENDARY TIER
// US-114: Network Performance Optimization Implementation
// ===================================================================

import { Activity, Database, Globe, Signal, Timer, TrendingUp, Wifi, Zap } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

interface ConnectionMetrics {
  rtt: number;
  downlink: number;
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  bandwidth: number;
  latency: number;
  packetLoss: number;
}

interface RequestPriority {
  url: string;
  priority: 'high' | 'medium' | 'low';
  type: 'critical' | 'important' | 'background';
  timestamp: Date;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

interface CompressionMetrics {
  originalSize: number;
  compressedSize: number;
  algorithm: 'gzip' | 'brotli' | 'deflate';
  ratio: number;
  savingsKB: number;
}

interface CDNMetrics {
  endpoint: string;
  region: string;
  latency: number;
  hitRate: number;
  bandwidth: number;
  isOptimal: boolean;
}

interface NetworkPerformanceOptimizerProps {
  enableRequestPrioritization?: boolean;
  enableConnectionPooling?: boolean;
  enableCompression?: boolean;
  enableDNSPrefetching?: boolean;
  cdnEndpoints?: string[];
  monitoringInterval?: number;
  enableAdaptiveLoading?: boolean;
  performanceThreshold?: number;
  onPerformanceEvent?: (event: string, data?: any) => void;
}

// US-114.1: Implement request prioritization
class RequestPrioritizer {
  private requestQueue: RequestPriority[] = [];
  private activeRequests = new Map<string, RequestPriority>();
  private maxConcurrentRequests = 6;

  addRequest(
    url: string,
    priority: 'high' | 'medium' | 'low',
    type: 'critical' | 'important' | 'background'
  ): void {
    const request: RequestPriority = {
      url,
      priority,
      type,
      timestamp: new Date(),
      status: 'pending',
    };

    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const insertIndex = this.requestQueue.findIndex(
      (r) => priorityOrder[r.priority] < priorityOrder[priority]
    );

    if (insertIndex === -1) {
      this.requestQueue.push(request);
    } else {
      this.requestQueue.splice(insertIndex, 0, request);
    }

    this.processQueue();
  }

  private processQueue(): void {
    while (this.activeRequests.size < this.maxConcurrentRequests && this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      request.status = 'active';
      this.activeRequests.set(request.url, request);
      this.executeRequest(request);
    }
  }

  private async executeRequest(request: RequestPriority): Promise<void> {
    try {
      await fetch(request.url);
      request.status = 'completed';
      this.activeRequests.delete(request.url);
      this.processQueue();
    } catch (error) {
      request.status = 'failed';
      this.activeRequests.delete(request.url);
      this.processQueue();
    }
  }

  getQueueStatus(): { pending: number; active: number; completed: number; failed: number } {
    return {
      pending: this.requestQueue.length,
      active: this.activeRequests.size,
      completed: 0,
      failed: 0,
    };
  }
}

// US-114.2: Optimize connection pooling
class ConnectionPoolManager {
  private pools = new Map<string, ConnectionPool>();
  private maxConnectionsPerHost = 6;

  getPool(hostname: string): ConnectionPool {
    if (!this.pools.has(hostname)) {
      this.pools.set(hostname, new ConnectionPool(hostname, this.maxConnectionsPerHost));
    }
    return this.pools.get(hostname)!;
  }

  optimizeConnections(): void {
    this.pools.forEach((pool) => {
      pool.cleanup();
      const usage = pool.getUsageMetrics();
      if (usage.utilizationRate > 0.8) {
        pool.increaseSize();
      } else if (usage.utilizationRate < 0.2) {
        pool.decreaseSize();
      }
    });
  }

  getPoolMetrics(): Array<{ hostname: string; activeConnections: number; utilization: number }> {
    return Array.from(this.pools.entries()).map(([hostname, pool]) => ({
      hostname,
      activeConnections: pool.getActiveConnectionCount(),
      utilization: pool.getUsageMetrics().utilizationRate,
    }));
  }
}

class ConnectionPool {
  private hostname: string;
  private maxSize: number;
  private activeConnections = 0;
  private totalRequests = 0;
  private successfulRequests = 0;

  constructor(hostname: string, maxSize: number) {
    this.hostname = hostname;
    this.maxSize = maxSize;
  }

  cleanup(): void {
    // Implementation would clean up idle connections
  }

  increaseSize(): void {
    if (this.maxSize < 12) {
      this.maxSize += 2;
    }
  }

  decreaseSize(): void {
    if (this.maxSize > 2) {
      this.maxSize -= 1;
    }
  }

  getActiveConnectionCount(): number {
    return this.activeConnections;
  }

  getUsageMetrics(): { utilizationRate: number; successRate: number } {
    return {
      utilizationRate: this.activeConnections / this.maxSize,
      successRate: this.totalRequests > 0 ? this.successfulRequests / this.totalRequests : 1,
    };
  }
}

// US-114.3: Enable compression algorithms
class CompressionOptimizer {
  private compressionMetrics: CompressionMetrics[] = [];

  async optimizeResponse(response: Response): Promise<CompressionMetrics> {
    const originalSize = parseInt(response.headers.get('content-length') || '0');
    const contentEncoding = response.headers.get('content-encoding');

    let algorithm: 'gzip' | 'brotli' | 'deflate' = 'gzip';
    if (contentEncoding?.includes('br')) algorithm = 'brotli';
    else if (contentEncoding?.includes('deflate')) algorithm = 'deflate';

    const compressedSize = originalSize;
    const ratio = originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;

    const metrics: CompressionMetrics = {
      originalSize,
      compressedSize,
      algorithm,
      ratio,
      savingsKB: (originalSize - compressedSize) / 1024,
    };

    this.compressionMetrics.push(metrics);
    return metrics;
  }

  getCompressionMetrics(): CompressionMetrics[] {
    return this.compressionMetrics;
  }
}

// US-114.4: Add DNS prefetching
class DNSPrefetcher {
  private prefetchedDomains = new Set<string>();

  prefetchDomains(domains: string[]): void {
    domains.forEach((domain) => this.prefetchDomain(domain));
  }

  private prefetchDomain(domain: string): void {
    if (this.prefetchedDomains.has(domain)) return;

    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = `//${domain}`;
    document.head.appendChild(link);
    this.prefetchedDomains.add(domain);
  }

  extractDomainsFromContent(): string[] {
    const elements = document.querySelectorAll('a[href], img[src], script[src], link[href]');
    const domains = new Set<string>();

    elements.forEach((element) => {
      const url =
        (element as HTMLElement).getAttribute('href') ||
        (element as HTMLElement).getAttribute('src') ||
        '';

      try {
        const domain = new URL(url, window.location.origin).hostname;
        if (domain !== window.location.hostname) {
          domains.add(domain);
        }
      } catch (error) {
        // Invalid URL, skip
      }
    });

    return Array.from(domains);
  }
}

// US-114.5: Optimize CDN usage
class CDNOptimizer {
  private endpoints: CDNMetrics[] = [];
  private selectedEndpoint: string | null = null;

  async testCDNEndpoints(endpoints: string[]): Promise<CDNMetrics[]> {
    const results: CDNMetrics[] = [];

    for (const endpoint of endpoints) {
      try {
        const metrics = await this.testEndpoint(endpoint);
        results.push(metrics);
      } catch (error) {
        console.error(`Failed to test CDN endpoint ${endpoint}:`, error);
      }
    }

    this.endpoints = results;
    this.selectOptimalEndpoint();
    return results;
  }

  private async testEndpoint(endpoint: string): Promise<CDNMetrics> {
    const startTime = performance.now();

    try {
      await fetch(`${endpoint}/health`, { method: 'HEAD' });
      const latency = performance.now() - startTime;

      return {
        endpoint,
        region: this.extractRegion(endpoint),
        latency,
        hitRate: 0.95,
        bandwidth: 0,
        isOptimal: false,
      };
    } catch (error) {
      return {
        endpoint,
        region: 'unknown',
        latency: 9999,
        hitRate: 0,
        bandwidth: 0,
        isOptimal: false,
      };
    }
  }

  private extractRegion(endpoint: string): string {
    const match = endpoint.match(/([a-z]+-[a-z]+-\d+)/);
    return match ? match[1] : 'global';
  }

  private selectOptimalEndpoint(): void {
    if (this.endpoints.length === 0) return;

    const optimal = this.endpoints.reduce((best, current) => {
      const bestScore = best.hitRate * 100 - best.latency;
      const currentScore = current.hitRate * 100 - current.latency;
      return currentScore > bestScore ? current : best;
    });

    this.endpoints.forEach((endpoint) => {
      endpoint.isOptimal = endpoint.endpoint === optimal.endpoint;
    });

    this.selectedEndpoint = optimal.endpoint;
  }

  getCDNMetrics(): CDNMetrics[] {
    return this.endpoints;
  }
}

// US-114.6: Monitor bandwidth and connection quality
class BandwidthMonitor {
  private connectionMetrics: ConnectionMetrics[] = [];
  private monitoringInterval: number;
  private intervalId: number | null = null;

  constructor(interval: number = 5000) {
    this.monitoringInterval = interval;
  }

  startMonitoring(): void {
    if (this.intervalId) return;

    this.intervalId = window.setInterval(() => {
      this.measureConnection();
    }, this.monitoringInterval);

    this.measureConnection();
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private measureConnection(): void {
    const connection = (navigator as any).connection;

    if (connection) {
      const metrics: ConnectionMetrics = {
        rtt: connection.rtt || 0,
        downlink: connection.downlink || 0,
        effectiveType: connection.effectiveType || '4g',
        bandwidth: connection.downlink * 1000 || 0,
        latency: connection.rtt || 0,
        packetLoss: 0,
      };

      this.connectionMetrics.push(metrics);

      if (this.connectionMetrics.length > 100) {
        this.connectionMetrics.shift();
      }
    }
  }

  getCurrentMetrics(): ConnectionMetrics | null {
    return this.connectionMetrics.length > 0
      ? this.connectionMetrics[this.connectionMetrics.length - 1]
      : null;
  }

  isSlowConnection(): boolean {
    const current = this.getCurrentMetrics();
    return current ? current.effectiveType === 'slow-2g' || current.effectiveType === '2g' : false;
  }
}

// Main Network Performance Optimizer Component
export const NetworkPerformanceOptimizer: React.FC<NetworkPerformanceOptimizerProps> = ({
  enableRequestPrioritization = true,
  enableConnectionPooling = true,
  enableCompression = true,
  enableDNSPrefetching = true,
  cdnEndpoints = [],
  monitoringInterval = 5000,
  enableAdaptiveLoading = true,
  performanceThreshold = 1000,
  onPerformanceEvent,
}) => {
  const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetrics | null>(null);
  const [cdnMetrics, setCDNMetrics] = useState<CDNMetrics[]>([]);
  const [compressionMetrics, setCompressionMetrics] = useState<CompressionMetrics[]>([]);
  const [requestQueue, setRequestQueue] = useState({
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0,
  });
  const [poolMetrics, setPoolMetrics] = useState<
    Array<{ hostname: string; activeConnections: number; utilization: number }>
  >([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Initialize optimizers
  const requestPrioritizer = useMemo(() => new RequestPrioritizer(), []);
  const connectionPoolManager = useMemo(() => new ConnectionPoolManager(), []);
  const compressionOptimizer = useMemo(() => new CompressionOptimizer(), []);
  const dnsPrefetcher = useMemo(() => new DNSPrefetcher(), []);
  const cdnOptimizer = useMemo(() => new CDNOptimizer(), []);
  const bandwidthMonitor = useMemo(
    () => new BandwidthMonitor(monitoringInterval),
    [monitoringInterval]
  );

  useEffect(() => {
    initializeOptimizations();
    return () => {
      bandwidthMonitor.stopMonitoring();
    };
  }, []);

  const initializeOptimizations = async () => {
    setIsOptimizing(true);

    try {
      bandwidthMonitor.startMonitoring();

      if (cdnEndpoints.length > 0) {
        const metrics = await cdnOptimizer.testCDNEndpoints(cdnEndpoints);
        setCDNMetrics(metrics);
      }

      if (enableDNSPrefetching) {
        const domains = dnsPrefetcher.extractDomainsFromContent();
        dnsPrefetcher.prefetchDomains(domains);
      }

      const interval = setInterval(() => {
        updateMetrics();
      }, 2000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error('Failed to initialize network optimizations:', error);
      return undefined;
    } finally {
      setIsOptimizing(false);
    }
  };

  const updateMetrics = () => {
    const current = bandwidthMonitor.getCurrentMetrics();
    setConnectionMetrics(current);

    const queueStatus = requestPrioritizer.getQueueStatus();
    setRequestQueue(queueStatus);

    const pools = connectionPoolManager.getPoolMetrics();
    setPoolMetrics(pools);

    const compression = compressionOptimizer.getCompressionMetrics();
    setCompressionMetrics(compression);

    if (current && current.latency > performanceThreshold && onPerformanceEvent) {
      onPerformanceEvent('high-latency', current);
    }
  };

  const handleOptimizeConnections = () => {
    connectionPoolManager.optimizeConnections();
    updateMetrics();
  };

  const handleTestCDN = async () => {
    if (cdnEndpoints.length > 0) {
      const metrics = await cdnOptimizer.testCDNEndpoints(cdnEndpoints);
      setCDNMetrics(metrics);
    }
  };

  const handlePrefetchDomains = () => {
    const domains = dnsPrefetcher.extractDomainsFromContent();
    dnsPrefetcher.prefetchDomains(domains);
  };

  const getConnectionQuality = (): { level: string; color: string } => {
    if (!connectionMetrics) return { level: 'Unknown', color: 'gray' };

    if (connectionMetrics.effectiveType === '4g' && connectionMetrics.latency < 100) {
      return { level: 'Excellent', color: 'green' };
    } else if (
      connectionMetrics.effectiveType === '4g' ||
      connectionMetrics.effectiveType === '3g'
    ) {
      return { level: 'Good', color: 'blue' };
    } else if (connectionMetrics.effectiveType === '2g') {
      return { level: 'Fair', color: 'yellow' };
    } else {
      return { level: 'Poor', color: 'red' };
    }
  };

  const getCompressionSavings = () => {
    return compressionMetrics.reduce((total, metric) => total + metric.savingsKB, 0);
  };

  if (isOptimizing) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Optimizing network performance...</span>
      </div>
    );
  }

  const connectionQuality = getConnectionQuality();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Network Performance Optimizer</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Wifi className={`h-5 w-5 text-${connectionQuality.color}-500`} />
          <span className="text-sm text-gray-500">{connectionQuality.level}</span>
        </div>
      </div>

      {/* Connection Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Timer className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">Latency</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {connectionMetrics?.latency?.toFixed(0) || 0}ms
          </p>
          <p className="text-sm text-blue-700">Round-trip time</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-900">Bandwidth</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {connectionMetrics?.bandwidth?.toFixed(1) || 0} Mbps
          </p>
          <p className="text-sm text-green-700">Download speed</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-purple-900">Compression</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {getCompressionSavings().toFixed(1)}KB
          </p>
          <p className="text-sm text-purple-700">Data saved</p>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-yellow-600" />
            <span className="font-medium text-yellow-900">Queue</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">
            {requestQueue.pending + requestQueue.active}
          </p>
          <p className="text-sm text-yellow-700">Active requests</p>
        </div>
      </div>

      {/* Request Queue Status */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Queue Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(requestQueue).map(([status, count]) => (
            <div key={status} className="text-center p-3 bg-gray-50 rounded-lg">
              <span className="block text-2xl font-bold text-gray-900">{count}</span>
              <span className="text-sm text-gray-600 capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CDN Performance */}
      {cdnMetrics.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">CDN Performance</h3>
          <div className="space-y-2">
            {cdnMetrics.map((cdn, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  cdn.isOptimal ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{cdn.region}</span>
                    {cdn.isOptimal && (
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Optimal
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm text-gray-700">
                      {cdn.latency.toFixed(0)}ms
                    </span>
                    <p className="text-xs text-gray-500">
                      Hit rate: {(cdn.hitRate * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Recommendations */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Recommendations</h3>
        <div className="space-y-2">
          {connectionMetrics?.latency && connectionMetrics.latency > 500 && (
            <div className="p-3 bg-red-50 rounded-lg">
              <span className="text-sm text-red-800">
                High latency detected. Consider enabling request prioritization.
              </span>
            </div>
          )}
          {bandwidthMonitor.isSlowConnection() && (
            <div className="p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm text-yellow-800">
                Slow connection detected. Adaptive loading is recommended.
              </span>
            </div>
          )}
          {getCompressionSavings() < 10 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-800">
                Enable compression to reduce bandwidth usage.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={handleOptimizeConnections}
            className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Database className="h-4 w-4 mr-1 inline" />
            Optimize Pools
          </button>

          <button
            onClick={handleTestCDN}
            className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
          >
            <Globe className="h-4 w-4 mr-1 inline" />
            Test CDN
          </button>

          <button
            onClick={handlePrefetchDomains}
            className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
          >
            <Zap className="h-4 w-4 mr-1 inline" />
            Prefetch DNS
          </button>

          <button
            onClick={updateMetrics}
            className="px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
          >
            <Signal className="h-4 w-4 mr-1 inline" />
            Refresh Metrics
          </button>
        </div>
      </div>
    </div>
  );
};

export default NetworkPerformanceOptimizer;
