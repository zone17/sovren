import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/providers/NotificationProvider';
import {
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  Globe,
  RefreshCw,
  Settings,
  Timer,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

// API Cache Entry Interface
interface APICacheEntry {
  key: string;
  url: string;
  method: string;
  data: any;
  headers: Record<string, string>;
  timestamp: number;
  expires: number;
  etag?: string;
  version: string;
  hitCount: number;
  lastModified?: string;
  size: number;
  compressionRatio: number;
}

// Cache Key Generation Strategy
interface CacheKeyStrategy {
  includeHeaders: string[];
  includeParams: string[];
  ignoreParams: string[];
  caseSensitive: boolean;
  hashLongKeys: boolean;
}

// Cache Policy Configuration
interface CachePolicyConfig {
  defaultTTL: number;
  maxTTL: number;
  staleWhileRevalidate: number;
  maxEntries: number;
  compressionThreshold: number;
  versioningEnabled: boolean;
  eTagEnabled: boolean;
}

// Cache Analytics
interface APICacheAnalytics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatio: number;
  avgResponseTime: number;
  cacheHitResponseTime: number;
  cacheMissResponseTime: number;
  totalDataTransferred: number;
  bandwidthSaved: number;
  compressionSavings: number;
  purgeCount: number;
  lastPurgeTime?: Date;
}

// HTTP Cache Headers Manager
class HTTPCacheHeadersManager {
  static generateCacheHeaders(
    ttl: number,
    options: {
      etag?: string;
      lastModified?: string;
      staleWhileRevalidate?: number;
      mustRevalidate?: boolean;
    } = {}
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    // Cache-Control header
    const cacheControl = [];

    if (options.mustRevalidate) {
      cacheControl.push('must-revalidate');
    } else {
      cacheControl.push('public');
    }

    cacheControl.push(`max-age=${Math.floor(ttl / 1000)}`);

    if (options.staleWhileRevalidate) {
      cacheControl.push(
        `stale-while-revalidate=${Math.floor(options.staleWhileRevalidate / 1000)}`
      );
    }

    headers['Cache-Control'] = cacheControl.join(', ');

    // ETag header
    if (options.etag) {
      headers['ETag'] = options.etag;
    }

    // Last-Modified header
    if (options.lastModified) {
      headers['Last-Modified'] = options.lastModified;
    }

    // Expires header (fallback for older browsers)
    headers['Expires'] = new Date(Date.now() + ttl).toUTCString();

    return headers;
  }

  static parseCacheHeaders(headers: Record<string, string>): {
    maxAge?: number;
    etag?: string;
    lastModified?: string;
    expires?: Date;
    mustRevalidate: boolean;
  } {
    const cacheControl = headers['cache-control'] || headers['Cache-Control'] || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const mustRevalidate = cacheControl.includes('must-revalidate');

    return {
      maxAge: maxAgeMatch ? parseInt(maxAgeMatch[1]) * 1000 : undefined,
      etag: headers['etag'] || headers['ETag'],
      lastModified: headers['last-modified'] || headers['Last-Modified'],
      expires:
        headers['expires'] || headers['Expires']
          ? new Date(headers['expires'] || headers['Expires'])
          : undefined,
      mustRevalidate,
    };
  }
}

// Cache Key Generator
class CacheKeyGenerator {
  private strategy: CacheKeyStrategy;

  constructor(strategy: CacheKeyStrategy) {
    this.strategy = strategy;
  }

  generateKey(
    url: string,
    method: string,
    headers: Record<string, string> = {},
    params: Record<string, any> = {}
  ): string {
    const components = [method.toUpperCase()];

    // Process URL
    const urlObj = new URL(url, window.location.origin);
    components.push(this.strategy.caseSensitive ? urlObj.pathname : urlObj.pathname.toLowerCase());

    // Process query parameters
    const searchParams = new URLSearchParams(urlObj.search);
    const relevantParams: string[] = [];

    for (const [key, value] of searchParams) {
      if (this.strategy.ignoreParams.includes(key)) continue;
      if (this.strategy.includeParams.length > 0 && !this.strategy.includeParams.includes(key))
        continue;

      relevantParams.push(`${key}=${value}`);
    }

    if (relevantParams.length > 0) {
      components.push(relevantParams.sort().join('&'));
    }

    // Process headers
    const relevantHeaders: string[] = [];
    for (const headerName of this.strategy.includeHeaders) {
      const headerValue = headers[headerName] || headers[headerName.toLowerCase()];
      if (headerValue) {
        relevantHeaders.push(`${headerName}:${headerValue}`);
      }
    }

    if (relevantHeaders.length > 0) {
      components.push(relevantHeaders.sort().join('|'));
    }

    const key = components.join('::');

    // Hash long keys if enabled
    if (this.strategy.hashLongKeys && key.length > 250) {
      return this.hashString(key);
    }

    return key;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }
}

// API Response Cache Manager
class APIResponseCacheManager {
  private cache: Map<string, APICacheEntry> = new Map();
  private config: CachePolicyConfig;
  private keyGenerator: CacheKeyGenerator;
  private analytics: APICacheAnalytics;
  private observers: ((analytics: APICacheAnalytics) => void)[] = [];

  constructor(config: CachePolicyConfig, keyStrategy: CacheKeyStrategy) {
    this.config = config;
    this.keyGenerator = new CacheKeyGenerator(keyStrategy);
    this.analytics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRatio: 0,
      avgResponseTime: 0,
      cacheHitResponseTime: 0,
      cacheMissResponseTime: 0,
      totalDataTransferred: 0,
      bandwidthSaved: 0,
      compressionSavings: 0,
      purgeCount: 0,
    };

    // Start cleanup interval
    this.startCleanupInterval();
  }

  // Cache GET Request
  async get(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      params?: Record<string, any>;
      ttl?: number;
      version?: string;
    } = {}
  ): Promise<any> {
    const startTime = Date.now();
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const version = options.version || '1.0';

    // Generate cache key
    const cacheKey = this.keyGenerator.generateKey(url, method, headers, options.params);

    this.analytics.totalRequests++;

    // Check cache
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && this.isEntryValid(cachedEntry, version)) {
      // Cache hit
      cachedEntry.hitCount++;
      this.analytics.cacheHits++;
      this.analytics.cacheHitResponseTime =
        (this.analytics.cacheHitResponseTime * (this.analytics.cacheHits - 1) +
          (Date.now() - startTime)) /
        this.analytics.cacheHits;
      this.analytics.bandwidthSaved += cachedEntry.size;
      this.updateAnalytics();

      return cachedEntry.data;
    }

    // Cache miss - fetch from network
    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...headers,
          ...HTTPCacheHeadersManager.generateCacheHeaders(options.ttl || this.config.defaultTTL),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const responseHeaders = this.extractHeaders(response);
      const size = JSON.stringify(data).length;

      // Create cache entry
      const entry: APICacheEntry = {
        key: cacheKey,
        url,
        method,
        data,
        headers: responseHeaders,
        timestamp: Date.now(),
        expires: Date.now() + (options.ttl || this.config.defaultTTL),
        etag: response.headers.get('etag') || undefined,
        version,
        hitCount: 0,
        lastModified: response.headers.get('last-modified') || undefined,
        size,
        compressionRatio: this.calculateCompressionRatio(data),
      };

      // Store in cache
      await this.set(cacheKey, entry);

      // Update analytics
      this.analytics.cacheMisses++;
      this.analytics.cacheMissResponseTime =
        (this.analytics.cacheMissResponseTime * (this.analytics.cacheMisses - 1) +
          (Date.now() - startTime)) /
        this.analytics.cacheMisses;
      this.analytics.totalDataTransferred += size;
      this.updateAnalytics();

      return data;
    } catch (error) {
      // Return stale data if available and stale-while-revalidate is enabled
      if (cachedEntry && this.config.staleWhileRevalidate > 0) {
        const staleness = Date.now() - cachedEntry.expires;
        if (staleness <= this.config.staleWhileRevalidate) {
          // Serve stale data and revalidate in background
          this.revalidateInBackground(url, options);
          return cachedEntry.data;
        }
      }

      throw error;
    }
  }

  // Set Cache Entry
  private async set(key: string, entry: APICacheEntry): Promise<void> {
    // Check storage limits
    if (this.cache.size >= this.config.maxEntries) {
      await this.evictLRU();
    }

    this.cache.set(key, entry);
  }

  // Cache Invalidation and Purging
  async purge(pattern?: string | RegExp, version?: string): Promise<number> {
    let purgedCount = 0;

    if (!pattern && !version) {
      // Purge all
      purgedCount = this.cache.size;
      this.cache.clear();
    } else {
      const keysToDelete: string[] = [];

      for (const [key, entry] of this.cache) {
        let shouldDelete = false;

        // Pattern matching
        if (pattern) {
          if (typeof pattern === 'string') {
            shouldDelete = entry.url.includes(pattern) || key.includes(pattern);
          } else {
            shouldDelete = pattern.test(entry.url) || pattern.test(key);
          }
        }

        // Version matching
        if (version && entry.version !== version) {
          shouldDelete = true;
        }

        if (shouldDelete) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => this.cache.delete(key));
      purgedCount = keysToDelete.length;
    }

    this.analytics.purgeCount += purgedCount;
    this.analytics.lastPurgeTime = new Date();
    this.updateAnalytics();

    return purgedCount;
  }

  // Cache Versioning
  async updateVersion(pattern: string | RegExp, newVersion: string): Promise<number> {
    let updatedCount = 0;

    for (const [key, entry] of this.cache) {
      let shouldUpdate = false;

      if (typeof pattern === 'string') {
        shouldUpdate = entry.url.includes(pattern);
      } else {
        shouldUpdate = pattern.test(entry.url);
      }

      if (shouldUpdate) {
        entry.version = newVersion;
        updatedCount++;
      }
    }

    return updatedCount;
  }

  // Performance Testing
  async performanceTest(
    testRequests: Array<{
      url: string;
      method?: string;
      headers?: Record<string, string>;
    }>
  ): Promise<{
    totalTime: number;
    avgTime: number;
    cacheHitTime: number;
    cacheMissTime: number;
    hitRate: number;
  }> {
    const results: number[] = [];
    let hits = 0;
    let misses = 0;
    const hitTimes: number[] = [];
    const missTimes: number[] = [];

    for (const request of testRequests) {
      const startTime = Date.now();
      const cacheKey = this.keyGenerator.generateKey(
        request.url,
        request.method || 'GET',
        request.headers || {}
      );

      const wasHit = this.cache.has(cacheKey);

      try {
        await this.get(request.url, request);
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        results.push(responseTime);

        if (wasHit) {
          hits++;
          hitTimes.push(responseTime);
        } else {
          misses++;
          missTimes.push(responseTime);
        }
      } catch (error) {
        console.error('Performance test request failed:', error);
      }
    }

    return {
      totalTime: results.reduce((sum, time) => sum + time, 0),
      avgTime:
        results.length > 0 ? results.reduce((sum, time) => sum + time, 0) / results.length : 0,
      cacheHitTime:
        hitTimes.length > 0 ? hitTimes.reduce((sum, time) => sum + time, 0) / hitTimes.length : 0,
      cacheMissTime:
        missTimes.length > 0
          ? missTimes.reduce((sum, time) => sum + time, 0) / missTimes.length
          : 0,
      hitRate: testRequests.length > 0 ? (hits / testRequests.length) * 100 : 0,
    };
  }

  // Analytics and Monitoring
  getAnalytics(): APICacheAnalytics {
    return { ...this.analytics };
  }

  getCacheEntries(): APICacheEntry[] {
    return Array.from(this.cache.values());
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  // Utility Methods
  private isEntryValid(entry: APICacheEntry, version: string): boolean {
    if (Date.now() > entry.expires) return false;
    if (this.config.versioningEnabled && entry.version !== version) return false;
    return true;
  }

  private async evictLRU(): Promise<void> {
    let oldestKey = '';
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private calculateCompressionRatio(data: any): number {
    const originalSize = JSON.stringify(data).length;
    const compressedSize = JSON.stringify(data).replace(/\s+/g, '').length;
    return originalSize > 0 ? (originalSize - compressedSize) / originalSize : 0;
  }

  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private async revalidateInBackground(url: string, options: any): Promise<void> {
    try {
      await this.get(url, { ...options, ttl: this.config.defaultTTL });
    } catch (error) {
      console.warn('Background revalidation failed:', error);
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, entry] of this.cache) {
        if (now > entry.expires) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => this.cache.delete(key));
    }, 60000); // Cleanup every minute
  }

  private updateAnalytics(): void {
    if (this.analytics.totalRequests > 0) {
      this.analytics.hitRatio = (this.analytics.cacheHits / this.analytics.totalRequests) * 100;
      this.analytics.avgResponseTime =
        (this.analytics.cacheHitResponseTime * this.analytics.cacheHits +
          this.analytics.cacheMissResponseTime * this.analytics.cacheMisses) /
        this.analytics.totalRequests;
    }

    this.notifyObservers();
  }

  private notifyObservers(): void {
    this.observers.forEach((observer) => observer(this.analytics));
  }

  subscribe(observer: (analytics: APICacheAnalytics) => void): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }
}

// React Component
interface APIResponseCacheProps {
  enabled?: boolean;
  config?: Partial<CachePolicyConfig>;
  keyStrategy?: Partial<CacheKeyStrategy>;
  onCacheHit?: (key: string, url: string) => void;
  onCacheMiss?: (key: string, url: string) => void;
}

export default function APIResponseCache({
  enabled = true,
  config = {},
  keyStrategy = {},
  onCacheHit,
  onCacheMiss,
}: APIResponseCacheProps) {
  const [cacheManager] = useState(
    () =>
      new APIResponseCacheManager(
        {
          defaultTTL: 300000, // 5 minutes
          maxTTL: 3600000, // 1 hour
          staleWhileRevalidate: 60000, // 1 minute
          maxEntries: 500,
          compressionThreshold: 1024,
          versioningEnabled: true,
          eTagEnabled: true,
          ...config,
        },
        {
          includeHeaders: ['authorization', 'content-type'],
          includeParams: [],
          ignoreParams: ['_t', 'timestamp'],
          caseSensitive: false,
          hashLongKeys: true,
          ...keyStrategy,
        }
      )
  );

  const [analytics, setAnalytics] = useState<APICacheAnalytics | null>(null);
  const [cacheEntries, setCacheEntries] = useState<APICacheEntry[]>([]);
  const [isTestingPerformance, setIsTestingPerformance] = useState(false);
  const [performanceResults, setPerformanceResults] = useState<any>(null);
  const [purgePattern, setPurgePattern] = useState('');
  const toast = useToast();

  // Analytics Monitoring
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = cacheManager.subscribe((newAnalytics) => {
      setAnalytics(newAnalytics);
      setCacheEntries(cacheManager.getCacheEntries());
    });

    // Initial load
    setAnalytics(cacheManager.getAnalytics());
    setCacheEntries(cacheManager.getCacheEntries());

    return unsubscribe;
  }, [cacheManager, enabled]);

  // Performance Testing
  const handlePerformanceTest = useCallback(async () => {
    setIsTestingPerformance(true);

    const testRequests = [
      { url: '/api/content/popular' },
      { url: '/api/user/profile' },
      { url: '/api/analytics/dashboard' },
      { url: '/api/content/recent' },
      { url: '/api/notifications' },
    ];

    try {
      const results = await cacheManager.performanceTest(testRequests);
      setPerformanceResults(results);
    } catch (error) {
      console.error('Performance test failed:', error);
    } finally {
      setIsTestingPerformance(false);
    }
  }, [cacheManager]);

  // Cache Purging
  const handlePurge = useCallback(async () => {
    const purgedCount = await cacheManager.purge(purgePattern || undefined);
    toast.success(`Purged ${purgedCount} cache entries`);
    setPurgePattern('');
  }, [cacheManager, purgePattern, toast]);

  // Cache Effectiveness Score
  const cacheEffectivenessScore = useMemo(() => {
    if (!analytics) return 0;

    const hitRatioScore = Math.min(analytics.hitRatio, 100);
    const performanceScore =
      analytics.cacheHitResponseTime > 0 && analytics.cacheMissResponseTime > 0
        ? Math.min(
            ((analytics.cacheMissResponseTime - analytics.cacheHitResponseTime) /
              analytics.cacheMissResponseTime) *
              100,
            100
          )
        : 0;
    const bandwidthScore = Math.min((analytics.bandwidthSaved / 1024 / 1024) * 10, 100);

    return Math.round((hitRatioScore + performanceScore + bandwidthScore) / 3);
  }, [analytics]);

  if (!enabled) {
    return (
      <Alert>
        <AlertDescription>
          API Response Caching is currently disabled. Enable it to improve API performance.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cache Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-green-500" />
            API Response Cache
          </CardTitle>
          <CardDescription>
            Intelligent API response caching with versioning and analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hit Ratio</p>
                  <p className="text-2xl font-bold text-green-600">
                    {analytics?.hitRatio.toFixed(1) || 0}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cache Entries</p>
                  <p className="text-2xl font-bold text-blue-600">{cacheEntries.length}</p>
                </div>
                <Database className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Response</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {analytics?.avgResponseTime.toFixed(0) || 0}ms
                  </p>
                </div>
                <Timer className="h-8 w-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Bandwidth Saved</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {analytics ? (analytics.bandwidthSaved / 1024 / 1024).toFixed(1) : 0}MB
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Performance Metrics</CardTitle>
          <CardDescription>Detailed performance analysis of cache hits vs misses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">Response Time Comparison</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cache Hit</span>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={
                        analytics?.cacheHitResponseTime
                          ? (analytics.cacheHitResponseTime /
                              Math.max(
                                analytics.cacheHitResponseTime,
                                analytics.cacheMissResponseTime || 1
                              )) *
                            100
                          : 0
                      }
                      className="w-24"
                    />
                    <span className="text-sm font-medium text-green-600">
                      {analytics?.cacheHitResponseTime.toFixed(0) || 0}ms
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cache Miss</span>
                  <div className="flex items-center gap-2">
                    <Progress value={analytics?.cacheMissResponseTime ? 100 : 0} className="w-24" />
                    <span className="text-sm font-medium text-red-600">
                      {analytics?.cacheMissResponseTime.toFixed(0) || 0}ms
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Request Statistics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-green-50 p-3 rounded border">
                  <p className="text-green-800 font-medium">Cache Hits</p>
                  <p className="text-2xl font-bold text-green-600">{analytics?.cacheHits || 0}</p>
                </div>
                <div className="bg-red-50 p-3 rounded border">
                  <p className="text-red-800 font-medium">Cache Misses</p>
                  <p className="text-2xl font-bold text-red-600">{analytics?.cacheMisses || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cache Management
          </CardTitle>
          <CardDescription>
            Manage cache entries, perform testing, and purge operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Performance Testing */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium">Performance Testing</h4>
                  <p className="text-sm text-muted-foreground">
                    Test cache performance with sample requests
                  </p>
                </div>
                <Button
                  onClick={handlePerformanceTest}
                  disabled={isTestingPerformance}
                  className="flex items-center gap-2"
                >
                  {isTestingPerformance ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4" />
                      Run Test
                    </>
                  )}
                </Button>
              </div>

              {performanceResults && (
                <div className="bg-muted p-4 rounded border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Time</p>
                      <p className="font-semibold">{performanceResults.totalTime.toFixed(0)}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Time</p>
                      <p className="font-semibold">{performanceResults.avgTime.toFixed(0)}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hit Rate</p>
                      <p className="font-semibold">{performanceResults.hitRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cache Benefit</p>
                      <p className="font-semibold text-green-600">
                        {performanceResults.cacheMissTime > 0
                          ? (
                              ((performanceResults.cacheMissTime -
                                performanceResults.cacheHitTime) /
                                performanceResults.cacheMissTime) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cache Purging */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium">Cache Purging</h4>
                  <p className="text-sm text-muted-foreground">
                    Remove specific cache entries or clear all
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter URL pattern to purge (optional)"
                  value={purgePattern}
                  onChange={(e) => setPurgePattern(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handlePurge} variant="outline">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Purge
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Effectiveness Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-500" />
            API Cache Effectiveness
          </CardTitle>
          <CardDescription>Overall API caching performance and efficiency score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
              {cacheEffectivenessScore}
            </div>
            <div className="text-lg text-muted-foreground">API Cache Effectiveness Score</div>
            <Progress value={cacheEffectivenessScore} className="w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-green-50 p-3 rounded">
                <p className="font-medium text-green-800">Hit Ratio</p>
                <p className="text-green-600">{analytics?.hitRatio.toFixed(1) || 0}%</p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-medium text-blue-800">Performance Gain</p>
                <p className="text-blue-600">
                  {analytics && analytics.cacheMissResponseTime > 0
                    ? (
                        ((analytics.cacheMissResponseTime - analytics.cacheHitResponseTime) /
                          analytics.cacheMissResponseTime) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <p className="font-medium text-purple-800">Bandwidth Saved</p>
                <p className="text-purple-600">
                  {analytics ? (analytics.bandwidthSaved / 1024 / 1024).toFixed(1) : 0}MB
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Cache Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Cache Entries</CardTitle>
          <CardDescription>
            Latest cached API responses and their performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cacheEntries.slice(0, 5).map((entry) => (
              <div key={entry.key} className="flex items-center justify-between p-3 border rounded">
                <div className="flex-1">
                  <p className="font-medium truncate">{entry.url}</p>
                  <p className="text-sm text-muted-foreground">
                    {entry.method} • Version {entry.version} • {entry.hitCount} hits
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant={Date.now() > entry.expires ? 'secondary' : 'default'}>
                    {Date.now() > entry.expires ? 'Expired' : 'Active'}
                  </Badge>
                  <span className="text-muted-foreground">{(entry.size / 1024).toFixed(1)}KB</span>
                  <span className="text-muted-foreground">
                    {Math.floor((Date.now() - entry.timestamp) / 1000)}s ago
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
