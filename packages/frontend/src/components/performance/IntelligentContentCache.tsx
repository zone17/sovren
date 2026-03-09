import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Clock,
  Database,
  HardDrive,
  RefreshCw,
  TrendingUp,
  Wifi,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Cache Layer Types
interface CacheLayer {
  id: string;
  name: string;
  type: 'browser' | 'cdn' | 'application' | 'database';
  hitRate: number;
  missRate: number;
  size: number;
  maxSize: number;
  enabled: boolean;
  lastAccessed: Date;
}

// Cache Entry Interface
interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expires: number;
  tags: string[];
  hitCount: number;
  size: number;
  layer: string;
}

// Cache Configuration
interface CacheConfig {
  maxAge: number;
  staleWhileRevalidate: number;
  maxEntries: number;
  purgeThreshold: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

// Cache Analytics
interface CacheAnalytics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatio: number;
  avgResponseTime: number;
  bandwidthSaved: number;
  storageUsed: number;
  evictionCount: number;
}

// Cache Performance Metrics
interface CachePerformanceMetrics {
  layer: string;
  hitRate: number;
  missRate: number;
  avgAccessTime: number;
  totalSize: number;
  itemCount: number;
  lastUpdate: Date;
}

// Multi-layer Cache Architecture
class MultiLayerCache {
  private layers: Map<string, Map<string, CacheEntry>> = new Map();
  private config: CacheConfig;
  private analytics: CacheAnalytics;
  private observers: ((metrics: CachePerformanceMetrics[]) => void)[] = [];

  constructor(config: CacheConfig) {
    this.config = config;
    this.analytics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRatio: 0,
      avgResponseTime: 0,
      bandwidthSaved: 0,
      storageUsed: 0,
      evictionCount: 0,
    };

    // Initialize cache layers
    this.initializeLayers();
  }

  private initializeLayers(): void {
    this.layers.set('browser', new Map());
    this.layers.set('cdn', new Map());
    this.layers.set('application', new Map());
    this.layers.set('database', new Map());
  }

  // Cache Storage with Multi-layer Strategy
  async set(
    key: string,
    data: any,
    options: {
      layer?: string;
      ttl?: number;
      tags?: string[];
    } = {}
  ): Promise<void> {
    const layer = options.layer || 'application';
    const ttl = options.ttl || this.config.maxAge;
    const tags = options.tags || [];

    const entry: CacheEntry = {
      key,
      data: this.config.compressionEnabled ? this.compress(data) : data,
      timestamp: Date.now(),
      expires: Date.now() + ttl,
      tags,
      hitCount: 0,
      size: this.calculateSize(data),
      layer,
    };

    const layerCache = this.layers.get(layer);
    if (layerCache) {
      // Check storage limits
      if (layerCache.size >= this.config.maxEntries) {
        await this.evictLRU(layer);
      }

      layerCache.set(key, entry);
      this.updateAnalytics('set', entry);
      this.notifyObservers();
    }
  }

  // Cache Retrieval with Fallback Strategy
  async get(
    key: string,
    layers: string[] = ['browser', 'cdn', 'application', 'database']
  ): Promise<any> {
    this.analytics.totalRequests++;

    for (const layerName of layers) {
      const layerCache = this.layers.get(layerName);
      if (!layerCache) continue;

      const entry = layerCache.get(key);
      if (entry) {
        // Check expiration
        if (Date.now() > entry.expires) {
          layerCache.delete(key);
          continue;
        }

        // Update hit statistics
        entry.hitCount++;
        entry.timestamp = Date.now();
        this.analytics.cacheHits++;
        this.updateHitRatio();

        // Promote to higher layers if needed
        await this.promoteToHigherLayers(key, entry, layerName, layers);

        return this.config.compressionEnabled ? this.decompress(entry.data) : entry.data;
      }
    }

    this.analytics.cacheMisses++;
    this.updateHitRatio();
    return null;
  }

  // Cache Invalidation Strategies
  async invalidate(pattern: string | RegExp, tags?: string[]): Promise<void> {
    for (const [layerName, layerCache] of this.layers) {
      const keysToDelete: string[] = [];

      for (const [key, entry] of layerCache) {
        let shouldDelete = false;

        // Pattern matching
        if (typeof pattern === 'string') {
          shouldDelete = key.includes(pattern);
        } else {
          shouldDelete = pattern.test(key);
        }

        // Tag-based invalidation
        if (tags && entry.tags.some((tag) => tags.includes(tag))) {
          shouldDelete = true;
        }

        if (shouldDelete) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => layerCache.delete(key));
    }

    this.notifyObservers();
  }

  // Cache Warming Mechanisms
  async warmCache(urls: string[], priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const concurrency = priority === 'high' ? 10 : priority === 'medium' ? 5 : 2;
    const chunks = this.chunkArray(urls, concurrency);

    for (const chunk of chunks) {
      await Promise.all(chunk.map((url) => this.warmSingleResource(url)));
    }
  }

  private async warmSingleResource(url: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'X-Cache-Warm': 'true',
        },
      });

      if (response.ok) {
        const data = await response.json();
        await this.set(url, data, {
          layer: 'application',
          ttl: this.config.maxAge,
          tags: ['preloaded'],
        });
      }
    } catch (error) {
      console.warn(`Cache warming failed for ${url}:`, error);
    }
  }

  // Performance Monitoring
  getPerformanceMetrics(): CachePerformanceMetrics[] {
    const metrics: CachePerformanceMetrics[] = [];

    for (const [layerName, layerCache] of this.layers) {
      const entries = Array.from(layerCache.values());
      const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
      const totalAccesses = totalHits + entries.length * 0.1; // Estimate misses

      metrics.push({
        layer: layerName,
        hitRate: totalAccesses > 0 ? (totalHits / totalAccesses) * 100 : 0,
        missRate: totalAccesses > 0 ? ((totalAccesses - totalHits) / totalAccesses) * 100 : 0,
        avgAccessTime: this.calculateAverageAccessTime(entries),
        totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
        itemCount: entries.length,
        lastUpdate: new Date(),
      });
    }

    return metrics;
  }

  // Analytics and Monitoring
  getAnalytics(): CacheAnalytics {
    return { ...this.analytics };
  }

  // Utility Methods
  private async promoteToHigherLayers(
    key: string,
    entry: CacheEntry,
    currentLayer: string,
    layers: string[]
  ): Promise<void> {
    const currentIndex = layers.indexOf(currentLayer);
    if (currentIndex > 0) {
      const higherLayer = layers[currentIndex - 1];
      await this.set(key, entry.data, {
        layer: higherLayer,
        ttl: entry.expires - Date.now(),
        tags: entry.tags,
      });
    }
  }

  private async evictLRU(layerName: string): Promise<void> {
    const layerCache = this.layers.get(layerName);
    if (!layerCache) return;

    let oldestKey = '';
    let oldestTimestamp = Date.now();

    for (const [key, entry] of layerCache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      layerCache.delete(oldestKey);
      this.analytics.evictionCount++;
    }
  }

  private compress(data: any): string {
    // Simple compression simulation
    return JSON.stringify(data);
  }

  private decompress(data: string): any {
    return JSON.parse(data);
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }

  private calculateAverageAccessTime(entries: CacheEntry[]): number {
    if (entries.length === 0) return 0;

    const totalTime = entries.reduce((sum, entry) => {
      return sum + (Date.now() - entry.timestamp);
    }, 0);

    return totalTime / entries.length;
  }

  private updateAnalytics(operation: string, entry: CacheEntry): void {
    this.analytics.storageUsed += entry.size;
    if (operation === 'hit') {
      this.analytics.bandwidthSaved += entry.size;
    }
  }

  private updateHitRatio(): void {
    if (this.analytics.totalRequests > 0) {
      this.analytics.hitRatio = (this.analytics.cacheHits / this.analytics.totalRequests) * 100;
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private notifyObservers(): void {
    const metrics = this.getPerformanceMetrics();
    this.observers.forEach((observer) => observer(metrics));
  }

  subscribe(observer: (metrics: CachePerformanceMetrics[]) => void): () => void {
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
interface IntelligentContentCacheProps {
  enabled?: boolean;
  config?: Partial<CacheConfig>;
  onCacheHit?: (key: string, layer: string) => void;
  onCacheMiss?: (key: string) => void;
}

export default function IntelligentContentCache({
  enabled = true,
  config = {},
  onCacheHit,
  onCacheMiss,
}: IntelligentContentCacheProps) {
  const [cache] = useState(
    () =>
      new MultiLayerCache({
        maxAge: 3600000, // 1 hour
        staleWhileRevalidate: 300000, // 5 minutes
        maxEntries: 1000,
        purgeThreshold: 0.8,
        compressionEnabled: true,
        encryptionEnabled: false,
        ...config,
      })
  );

  const [metrics, setMetrics] = useState<CachePerformanceMetrics[]>([]);
  const [analytics, setAnalytics] = useState<CacheAnalytics | null>(null);
  const [isWarming, setIsWarming] = useState(false);
  const [warmingProgress, setWarmingProgress] = useState(0);

  // Performance Metrics Monitoring
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = cache.subscribe((newMetrics) => {
      setMetrics(newMetrics);
      setAnalytics(cache.getAnalytics());
    });

    // Initial metrics load
    setMetrics(cache.getPerformanceMetrics());
    setAnalytics(cache.getAnalytics());

    return unsubscribe;
  }, [cache, enabled]);

  // Cache Warming Function
  const handleCacheWarming = useCallback(async () => {
    setIsWarming(true);
    setWarmingProgress(0);

    // Simulate progressive cache warming
    const urls = [
      '/api/content/popular',
      '/api/content/recent',
      '/api/user/profile',
      '/api/analytics/dashboard',
      '/api/content/categories',
    ];

    for (let i = 0; i < urls.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate warming
      setWarmingProgress(((i + 1) / urls.length) * 100);
    }

    await cache.warmCache(urls, 'high');
    setIsWarming(false);
    setWarmingProgress(100);
  }, [cache]);

  // Cache Invalidation
  const handleCacheInvalidation = useCallback(
    async (pattern: string) => {
      await cache.invalidate(pattern);
    },
    [cache]
  );

  // Total Cache Performance Calculation
  const totalCachePerformance = useMemo(() => {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, metric) => sum + metric.hitRate, 0) / metrics.length;
  }, [metrics]);

  // Cache Effectiveness Score
  const cacheEffectivenessScore = useMemo(() => {
    if (!analytics) return 0;

    const hitRatioScore = Math.min(analytics.hitRatio, 100);
    const storageEfficiencyScore = Math.min((analytics.bandwidthSaved / 1024 / 1024) * 10, 100);
    const performanceScore = Math.min(totalCachePerformance, 100);

    return Math.round((hitRatioScore + storageEfficiencyScore + performanceScore) / 3);
  }, [analytics, totalCachePerformance]);

  if (!enabled) {
    return (
      <Alert>
        <AlertDescription>
          Intelligent Content Caching is currently disabled. Enable it to improve performance.
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
            <Zap className="h-5 w-5 text-blue-500" />
            Intelligent Content Cache
          </CardTitle>
          <CardDescription>
            Multi-layer caching system for optimal content delivery performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cache Hit Rate</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {analytics?.hitRatio.toFixed(1) || 0}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Bandwidth Saved</p>
                  <p className="text-2xl font-bold text-green-600">
                    {analytics ? (analytics.bandwidthSaved / 1024 / 1024).toFixed(1) : 0}MB
                  </p>
                </div>
                <Wifi className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Storage Used</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {analytics ? (analytics.storageUsed / 1024 / 1024).toFixed(1) : 0}MB
                  </p>
                </div>
                <HardDrive className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Layer Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Layer Performance</CardTitle>
          <CardDescription>Performance metrics across different cache layers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.map((metric) => (
              <div key={metric.layer} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span className="font-medium capitalize">{metric.layer} Layer</span>
                    <Badge variant={metric.hitRate > 70 ? 'default' : 'secondary'}>
                      {metric.hitRate.toFixed(1)}% Hit Rate
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{metric.itemCount} items</span>
                </div>
                <Progress value={metric.hitRate} className="mb-2" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Hit Rate</p>
                    <p className="font-semibold">{metric.hitRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Miss Rate</p>
                    <p className="font-semibold">{metric.missRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Size</p>
                    <p className="font-semibold">{(metric.totalSize / 1024).toFixed(1)}KB</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Access Time</p>
                    <p className="font-semibold">{metric.avgAccessTime.toFixed(0)}ms</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Management</CardTitle>
          <CardDescription>Manage cache warming, invalidation, and optimization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Cache Warming */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium">Cache Warming</h4>
                  <p className="text-sm text-muted-foreground">
                    Preload frequently accessed content
                  </p>
                </div>
                <Button
                  onClick={handleCacheWarming}
                  disabled={isWarming}
                  className="flex items-center gap-2"
                >
                  {isWarming ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Warming...
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4" />
                      Warm Cache
                    </>
                  )}
                </Button>
              </div>
              {isWarming && (
                <div className="space-y-2">
                  <Progress value={warmingProgress} />
                  <p className="text-sm text-muted-foreground">
                    Warming cache... {warmingProgress.toFixed(0)}%
                  </p>
                </div>
              )}
            </div>

            {/* Cache Invalidation */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Cache Invalidation</h4>
                  <p className="text-sm text-muted-foreground">
                    Clear outdated or invalid cache entries
                  </p>
                </div>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => handleCacheInvalidation('/api/content')}>
                    Clear Content
                  </Button>
                  <Button variant="outline" onClick={() => handleCacheInvalidation('.*')}>
                    Clear All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Effectiveness Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Cache Effectiveness Score
          </CardTitle>
          <CardDescription>
            Overall cache performance and optimization effectiveness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {cacheEffectivenessScore}
            </div>
            <div className="text-lg text-muted-foreground">Cache Effectiveness Score</div>
            <Progress value={cacheEffectivenessScore} className="w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-medium text-blue-800">Hit Ratio</p>
                <p className="text-blue-600">{analytics?.hitRatio.toFixed(1) || 0}%</p>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="font-medium text-green-800">Bandwidth Saved</p>
                <p className="text-green-600">
                  {analytics ? (analytics.bandwidthSaved / 1024 / 1024).toFixed(1) : 0}MB
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <p className="font-medium text-purple-800">Overall Performance</p>
                <p className="text-purple-600">{totalCachePerformance.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
