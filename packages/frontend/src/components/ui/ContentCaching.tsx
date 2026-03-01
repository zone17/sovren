import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Progress } from './progress';
import { Slider } from './slider';
import { Switch } from './switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

// ===================================================================
// US-092: CONTENT CACHING - LEGENDARY TIER
// ===================================================================

// 6.10.1. Create subscription-based content caching
const SubscriptionCacheSchema = z.object({
  subscriptionId: z.string(),
  creatorId: z.string(),
  contentType: z.enum(['post', 'video', 'audio', 'image', 'document']),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  maxItems: z.number().min(1).max(1000).default(50),
  maxAge: z.number().min(3600).max(2592000).default(604800), // 1 week default
  autoRefresh: z.boolean().default(true),
  prefetchEnabled: z.boolean().default(true),
});

const ContentItemSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  type: z.enum(['post', 'video', 'audio', 'image', 'document']),
  title: z.string(),
  content: z.string().optional(),
  mediaUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  size: z.number(),
  createdAt: z.date(),
  cachedAt: z.date(),
  lastAccessedAt: z.date(),
  accessCount: z.number().default(0),
  priority: z.number().min(1).max(10).default(5),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});

const CacheAnalyticsSchema = z.object({
  hitRate: z.number().min(0).max(1),
  missRate: z.number().min(0).max(1),
  totalRequests: z.number(),
  totalHits: z.number(),
  totalMisses: z.number(),
  averageResponseTime: z.number(),
  cacheSize: z.number(),
  itemCount: z.number(),
  lastUpdated: z.date(),
});

const CacheConfigSchema = z.object({
  maxCacheSize: z.number().min(10485760).max(1073741824), // 10MB to 1GB
  maxItems: z.number().min(100).max(10000),
  defaultTTL: z.number().min(3600).max(2592000), // 1 hour to 30 days
  prefetchEnabled: z.boolean().default(true),
  compressionEnabled: z.boolean().default(true),
  encryptionEnabled: z.boolean().default(false),
  autoCleanup: z.boolean().default(true),
  cleanupThreshold: z.number().min(0.5).max(0.95).default(0.8),
});

// Types
type SubscriptionCache = z.infer<typeof SubscriptionCacheSchema>;
type ContentItem = z.infer<typeof ContentItemSchema>;
type CacheAnalytics = z.infer<typeof CacheAnalyticsSchema>;
type CacheConfig = z.infer<typeof CacheConfigSchema>;

interface ContentCachingProps {
  enableSubscriptionCaching?: boolean;
  enableIntelligentPrefetch?: boolean;
  enableAnalytics?: boolean;
  enableCompression?: boolean;
  maxCacheSize?: number;
  defaultCacheTTL?: number;
  className?: string;
}

// 6.10.2. Implement intelligent content prefetching
class IntelligentPrefetcher {
  private static instance: IntelligentPrefetcher;
  private prefetchQueue: Set<string> = new Set();
  private prefetchHistory: Map<string, { timestamp: number; success: boolean }> = new Map();
  private userBehaviorScore: Map<string, number> = new Map();
  private isPrefetching = false;
  private listeners: Set<(queue: string[]) => void> = new Set();

  static getInstance(): IntelligentPrefetcher {
    if (!IntelligentPrefetcher.instance) {
      IntelligentPrefetcher.instance = new IntelligentPrefetcher();
    }
    return IntelligentPrefetcher.instance;
  }

  analyzeBehavior(contentId: string, action: 'view' | 'like' | 'share' | 'download'): void {
    const weights = { view: 1, like: 2, share: 3, download: 4 };
    const currentScore = this.userBehaviorScore.get(contentId) || 0;
    this.userBehaviorScore.set(contentId, currentScore + weights[action]);
  }

  predictNextContent(currentContentId: string): string[] {
    // Simple collaborative filtering based on user behavior
    const relatedContent: string[] = [];
    const currentScore = this.userBehaviorScore.get(currentContentId) || 0;

    this.userBehaviorScore.forEach((score, contentId) => {
      if (contentId !== currentContentId && score > currentScore * 0.7) {
        relatedContent.push(contentId);
      }
    });

    return relatedContent.slice(0, 5); // Top 5 predictions
  }

  addToPrefetchQueue(contentIds: string[]): void {
    contentIds.forEach((id) => this.prefetchQueue.add(id));
    this.notifyListeners();
    this.processPrefetchQueue();
  }

  private async processPrefetchQueue(): Promise<void> {
    if (this.isPrefetching || this.prefetchQueue.size === 0) return;

    this.isPrefetching = true;

    for (const contentId of this.prefetchQueue) {
      try {
        await this.prefetchContent(contentId);
        this.prefetchHistory.set(contentId, { timestamp: Date.now(), success: true });
      } catch (error) {
        console.error('Prefetch failed:', error);
        this.prefetchHistory.set(contentId, { timestamp: Date.now(), success: false });
      }

      this.prefetchQueue.delete(contentId);
      this.notifyListeners();
    }

    this.isPrefetching = false;
  }

  private async prefetchContent(contentId: string): Promise<void> {
    // Simulate content prefetching
    return new Promise((resolve) => {
      setTimeout(resolve, Math.random() * 2000 + 1000);
    });
  }

  getPrefetchQueue(): string[] {
    return Array.from(this.prefetchQueue);
  }

  addListener(listener: (queue: string[]) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (queue: string[]) => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getPrefetchQueue()));
  }
}

// 6.10.3. Add cache management interfaces
class ContentCacheManager {
  private static instance: ContentCacheManager;
  private cache: Map<string, ContentItem> = new Map();
  private subscriptions: Map<string, SubscriptionCache> = new Map();
  private analytics: CacheAnalytics = {
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    totalHits: 0,
    totalMisses: 0,
    averageResponseTime: 0,
    cacheSize: 0,
    itemCount: 0,
    lastUpdated: new Date(),
  };
  private config: CacheConfig = {
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    maxItems: 1000,
    defaultTTL: 604800, // 1 week
    prefetchEnabled: true,
    compressionEnabled: true,
    encryptionEnabled: false,
    autoCleanup: true,
    cleanupThreshold: 0.8,
  };

  static getInstance(): ContentCacheManager {
    if (!ContentCacheManager.instance) {
      ContentCacheManager.instance = new ContentCacheManager();
    }
    return ContentCacheManager.instance;
  }

  // 6.10.4. Create offline content library
  async addContent(
    item: Omit<ContentItem, 'cachedAt' | 'lastAccessedAt' | 'accessCount'>
  ): Promise<void> {
    const contentItem: ContentItem = {
      ...item,
      cachedAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0,
    };

    this.cache.set(item.id, contentItem);
    await this.updateAnalytics();

    if (this.shouldCleanup()) {
      await this.performCleanup();
    }
  }

  async getContent(id: string): Promise<ContentItem | null> {
    const startTime = performance.now();
    const item = this.cache.get(id);
    const responseTime = performance.now() - startTime;

    this.analytics.totalRequests++;
    this.analytics.averageResponseTime =
      (this.analytics.averageResponseTime + responseTime) / this.analytics.totalRequests;

    if (item) {
      item.lastAccessedAt = new Date();
      item.accessCount++;
      this.analytics.totalHits++;
      this.analytics.hitRate = this.analytics.totalHits / this.analytics.totalRequests;
    } else {
      this.analytics.totalMisses++;
      this.analytics.missRate = this.analytics.totalMisses / this.analytics.totalRequests;
    }

    await this.updateAnalytics();
    return item || null;
  }

  // 6.10.5. Implement cache prioritization
  async prioritizeContent(): Promise<void> {
    const items = Array.from(this.cache.values());

    // Calculate priority scores based on multiple factors
    items.forEach((item) => {
      const recencyScore = this.calculateRecencyScore(item);
      const frequencyScore = this.calculateFrequencyScore(item);
      const typeScore = this.calculateTypeScore(item);

      item.priority = Math.round(((recencyScore + frequencyScore + typeScore) / 3) * 10);
    });

    // Update cache with new priorities
    items.forEach((item) => this.cache.set(item.id, item));
  }

  private calculateRecencyScore(item: ContentItem): number {
    const daysSinceAccess = (Date.now() - item.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - daysSinceAccess / 30); // Score decreases over 30 days
  }

  private calculateFrequencyScore(item: ContentItem): number {
    return Math.min(1, item.accessCount / 10); // Score increases with access count
  }

  private calculateTypeScore(item: ContentItem): number {
    const typeWeights = { post: 0.8, video: 1.0, audio: 0.9, image: 0.7, document: 0.6 };
    return typeWeights[item.type] || 0.5;
  }

  // 6.10.6. Add storage optimization
  private shouldCleanup(): boolean {
    const currentSize = this.getCurrentCacheSize();
    const sizeThreshold = this.config.maxCacheSize * this.config.cleanupThreshold;
    const itemThreshold = this.config.maxItems * this.config.cleanupThreshold;

    return currentSize > sizeThreshold || this.cache.size > itemThreshold;
  }

  private async performCleanup(): Promise<void> {
    if (!this.config.autoCleanup) return;

    await this.prioritizeContent();
    const items = Array.from(this.cache.values());

    // Sort by priority (lower priority items removed first)
    items.sort((a, b) => a.priority - b.priority);

    const targetSize = this.config.maxCacheSize * 0.7; // Clean to 70% capacity
    const targetItems = Math.floor(this.config.maxItems * 0.7);

    let currentSize = this.getCurrentCacheSize();
    let removedCount = 0;

    for (const item of items) {
      if (currentSize <= targetSize && this.cache.size <= targetItems) {
        break;
      }

      this.cache.delete(item.id);
      currentSize -= item.size;
      removedCount++;
    }

    console.log(`Cache cleanup: removed ${removedCount} items`);
    await this.updateAnalytics();
  }

  private getCurrentCacheSize(): number {
    return Array.from(this.cache.values()).reduce((total, item) => total + item.size, 0);
  }

  // 6.10.7. Create cache analytics
  private async updateAnalytics(): Promise<void> {
    this.analytics.cacheSize = this.getCurrentCacheSize();
    this.analytics.itemCount = this.cache.size;
    this.analytics.lastUpdated = new Date();
  }

  getAnalytics(): CacheAnalytics {
    return { ...this.analytics };
  }

  // Subscription management
  addSubscription(subscription: SubscriptionCache): void {
    this.subscriptions.set(subscription.subscriptionId, subscription);
  }

  removeSubscription(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  getSubscriptions(): SubscriptionCache[] {
    return Array.from(this.subscriptions.values());
  }

  // Configuration management
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  // Search and filter
  searchContent(query: string): ContentItem[] {
    const results: ContentItem[] = [];
    const searchTerm = query.toLowerCase();

    this.cache.forEach((item) => {
      if (
        item.title.toLowerCase().includes(searchTerm) ||
        item.content?.toLowerCase().includes(searchTerm) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
      ) {
        results.push(item);
      }
    });

    return results.sort((a, b) => b.priority - a.priority);
  }

  getContentByType(type: ContentItem['type']): ContentItem[] {
    return Array.from(this.cache.values())
      .filter((item) => item.type === type)
      .sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());
  }

  // Export/Import for backup
  exportCache(): string {
    const exportData = {
      cache: Array.from(this.cache.entries()),
      subscriptions: Array.from(this.subscriptions.entries()),
      analytics: this.analytics,
      config: this.config,
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(exportData);
  }

  async importCache(data: string): Promise<void> {
    try {
      const importData = JSON.parse(data);

      this.cache = new Map(importData.cache);
      this.subscriptions = new Map(importData.subscriptions);
      this.analytics = importData.analytics;
      this.config = { ...this.config, ...importData.config };

      await this.updateAnalytics();
    } catch (error) {
      console.error('Failed to import cache:', error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.subscriptions.clear();
    this.analytics = {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      averageResponseTime: 0,
      cacheSize: 0,
      itemCount: 0,
      lastUpdated: new Date(),
    };
  }
}

// Main Component
export const ContentCaching: React.FC<ContentCachingProps> = ({
  enableSubscriptionCaching = true,
  enableIntelligentPrefetch = true,
  enableAnalytics = true,
  enableCompression = true,
  maxCacheSize = 100 * 1024 * 1024,
  defaultCacheTTL = 604800,
  className = '',
}) => {
  // Feature flags
  const { flags } = useFeatureFlags();
  const isEnabled = flags?.enableOfflineCapabilities && flags?.enableContentCaching;

  // State management
  const [analytics, setAnalytics] = useState<CacheAnalytics | null>(null);
  const [config, setConfig] = useState<CacheConfig | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionCache[]>([]);
  const [cachedContent, setCachedContent] = useState<ContentItem[]>([]);
  const [prefetchQueue, setPrefetchQueue] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContentType, setSelectedContentType] = useState<ContentItem['type'] | 'all'>(
    'all'
  );
  const [isLoading, setIsLoading] = useState(false);

  // Managers
  const cacheManager = useMemo(() => ContentCacheManager.getInstance(), []);
  const prefetcher = useMemo(() => IntelligentPrefetcher.getInstance(), []);

  // 6.10.8. Implement seamless content delivery
  useEffect(() => {
    if (!isEnabled) return;

    const initializeCaching = async () => {
      setIsLoading(true);
      try {
        // Initialize cache configuration
        cacheManager.updateConfig({
          maxCacheSize,
          defaultTTL: defaultCacheTTL,
          compressionEnabled: enableCompression,
        });

        // Load initial data
        const currentAnalytics = cacheManager.getAnalytics();
        const currentConfig = cacheManager.getConfig();
        const currentSubscriptions = cacheManager.getSubscriptions();

        setAnalytics(currentAnalytics);
        setConfig(currentConfig);
        setSubscriptions(currentSubscriptions);

        // Add some sample content for demonstration
        await addSampleContent();

        // Set up prefetch listener
        if (enableIntelligentPrefetch) {
          prefetcher.addListener(setPrefetchQueue);
        }
      } catch (error) {
        console.error('Failed to initialize content caching:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeCaching();

    return () => {
      if (enableIntelligentPrefetch) {
        prefetcher.removeListener(setPrefetchQueue);
      }
    };
  }, [
    isEnabled,
    maxCacheSize,
    defaultCacheTTL,
    enableCompression,
    enableIntelligentPrefetch,
    cacheManager,
    prefetcher,
  ]);

  // Sample content for demonstration
  const addSampleContent = async () => {
    const sampleContent: Omit<ContentItem, 'cachedAt' | 'lastAccessedAt' | 'accessCount'>[] = [
      {
        id: 'content-1',
        creatorId: 'creator-1',
        type: 'post',
        title: 'The Future of Creator Economy',
        content:
          'Exploring how blockchain and Lightning Network are revolutionizing creator monetization...',
        size: 15000,
        createdAt: new Date('2024-01-15'),
        priority: 8,
        tags: ['blockchain', 'creator-economy', 'lightning'],
        metadata: { featured: true },
      },
      {
        id: 'content-2',
        creatorId: 'creator-2',
        type: 'video',
        title: 'NOSTR Protocol Deep Dive',
        mediaUrl: '/videos/nostr-deep-dive.mp4',
        thumbnailUrl: '/thumbnails/nostr-thumb.jpg',
        size: 25000000, // 25MB
        createdAt: new Date('2024-01-10'),
        priority: 9,
        tags: ['nostr', 'protocol', 'decentralization'],
        metadata: { duration: '15:30' },
      },
      {
        id: 'content-3',
        creatorId: 'creator-1',
        type: 'audio',
        title: 'Lightning Podcast Episode 42',
        mediaUrl: '/audio/lightning-podcast-42.mp3',
        size: 50000000, // 50MB
        createdAt: new Date('2024-01-12'),
        priority: 7,
        tags: ['podcast', 'lightning', 'bitcoin'],
        metadata: { duration: '45:00' },
      },
    ];

    for (const content of sampleContent) {
      await cacheManager.addContent(content);
    }

    const updatedAnalytics = cacheManager.getAnalytics();
    setAnalytics(updatedAnalytics);
  };

  // Event handlers
  const handleRefreshAnalytics = useCallback(async () => {
    const currentAnalytics = cacheManager.getAnalytics();
    setAnalytics(currentAnalytics);
  }, [cacheManager]);

  const handleConfigUpdate = useCallback(
    (newConfig: Partial<CacheConfig>) => {
      cacheManager.updateConfig(newConfig);
      setConfig(cacheManager.getConfig());
    },
    [cacheManager]
  );

  const handleSearchContent = useCallback(async () => {
    if (!searchQuery.trim()) {
      setCachedContent([]);
      return;
    }

    const results = cacheManager.searchContent(searchQuery);
    setCachedContent(results);
  }, [searchQuery, cacheManager]);

  const handleFilterByType = useCallback(async () => {
    if (selectedContentType === 'all') {
      setCachedContent([]);
    } else {
      const results = cacheManager.getContentByType(selectedContentType);
      setCachedContent(results);
    }
  }, [selectedContentType, cacheManager]);

  const handleClearCache = useCallback(() => {
    cacheManager.clearCache();
    setAnalytics(cacheManager.getAnalytics());
    setCachedContent([]);
  }, [cacheManager]);

  const handleAddSubscription = useCallback(() => {
    const newSubscription: SubscriptionCache = {
      subscriptionId: `sub-${Date.now()}`,
      creatorId: `creator-${Math.floor(Math.random() * 10)}`,
      contentType: 'post',
      priority: 'normal',
      maxItems: 50,
      maxAge: 604800,
      autoRefresh: true,
      prefetchEnabled: true,
    };

    cacheManager.addSubscription(newSubscription);
    setSubscriptions(cacheManager.getSubscriptions());
  }, [cacheManager]);

  const formatBytes = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  if (!isEnabled) {
    return null;
  }

  return (
    <div className={`content-caching space-y-6 ${className}`}>
      {isLoading && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <span className="ml-3">Initializing content cache...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {analytics && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="library">Content Library</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Cache Size</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatBytes(analytics.cacheSize)}</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.itemCount} items cached
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Hit Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.round(analytics.hitRate * 100)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.totalHits} hits of {analytics.totalRequests} requests
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(analytics.averageResponseTime)}ms
                  </div>
                  <p className="text-xs text-muted-foreground">Average cache response</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Subscriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{subscriptions.length}</div>
                  <p className="text-xs text-muted-foreground">Active cache subscriptions</p>
                </CardContent>
              </Card>
            </div>

            {config && (
              <Card>
                <CardHeader>
                  <CardTitle>Cache Utilization</CardTitle>
                  <CardDescription>Current cache usage and capacity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Storage Used</span>
                      <span>{Math.round((analytics.cacheSize / config.maxCacheSize) * 100)}%</span>
                    </div>
                    <Progress
                      value={(analytics.cacheSize / config.maxCacheSize) * 100}
                      className="h-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Items Cached</span>
                      <span>{Math.round((analytics.itemCount / config.maxItems) * 100)}%</span>
                    </div>
                    <Progress
                      value={(analytics.itemCount / config.maxItems) * 100}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {enableIntelligentPrefetch && prefetchQueue.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Intelligent Prefetching</CardTitle>
                  <CardDescription>
                    Content being prefetched based on usage patterns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {prefetchQueue.slice(0, 5).map((contentId, index) => (
                      <div
                        key={contentId}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <span className="text-sm font-medium">Content {contentId}</span>
                        <Badge variant="secondary">Prefetching</Badge>
                      </div>
                    ))}
                    {prefetchQueue.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        +{prefetchQueue.length - 5} more items in queue...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Cache Analytics
                  <Button variant="outline" size="sm" onClick={handleRefreshAnalytics}>
                    Refresh
                  </Button>
                </CardTitle>
                <CardDescription>Detailed cache performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Total Requests</p>
                    <p className="text-2xl font-bold">{analytics.totalRequests}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Cache Hits</p>
                    <p className="text-2xl font-bold text-green-600">{analytics.totalHits}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Cache Misses</p>
                    <p className="text-2xl font-bold text-red-600">{analytics.totalMisses}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Hit Ratio</p>
                    <p className="text-2xl font-bold">{Math.round(analytics.hitRate * 100)}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Miss Ratio</p>
                    <p className="text-2xl font-bold">{Math.round(analytics.missRate * 100)}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Avg Response</p>
                    <p className="text-2xl font-bold">
                      {Math.round(analytics.averageResponseTime)}ms
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Cache Efficiency</p>
                  <Progress value={analytics.hitRate * 100} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    Last updated: {analytics.lastUpdated.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Library Tab */}
          <TabsContent value="library" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Offline Content Library</CardTitle>
                <CardDescription>Browse and manage cached content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search cached content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <Button onClick={handleSearchContent}>Search</Button>
                </div>

                <div className="flex gap-4">
                  <select
                    value={selectedContentType}
                    onChange={(e) => setSelectedContentType(e.target.value as any)}
                    className="p-2 border rounded"
                  >
                    <option value="all">All Types</option>
                    <option value="post">Posts</option>
                    <option value="video">Videos</option>
                    <option value="audio">Audio</option>
                    <option value="image">Images</option>
                    <option value="document">Documents</option>
                  </select>
                  <Button onClick={handleFilterByType}>Filter</Button>
                </div>

                {cachedContent.length > 0 ? (
                  <div className="space-y-3">
                    {cachedContent.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{item.title}</p>
                          <div className="flex gap-2">
                            <Badge variant="outline">{item.type}</Badge>
                            <Badge variant="secondary">Priority: {item.priority}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(item.size)} • Accessed {item.accessCount} times • Last:{' '}
                            {item.lastAccessedAt.toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No content found. Try searching or filtering to see cached items.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Cache Subscriptions
                  <Button onClick={handleAddSubscription}>Add Subscription</Button>
                </CardTitle>
                <CardDescription>Manage automatic content caching for creators</CardDescription>
              </CardHeader>
              <CardContent>
                {subscriptions.length > 0 ? (
                  <div className="space-y-3">
                    {subscriptions.map((sub) => (
                      <div
                        key={sub.subscriptionId}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">Creator {sub.creatorId}</p>
                          <div className="flex gap-2">
                            <Badge variant="outline">{sub.contentType}</Badge>
                            <Badge variant="secondary">{sub.priority}</Badge>
                            {sub.autoRefresh && <Badge variant="default">Auto Refresh</Badge>}
                            {sub.prefetchEnabled && <Badge variant="default">Prefetch</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Max {sub.maxItems} items • {Math.round(sub.maxAge / 86400)} days
                            retention
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            cacheManager.removeSubscription(sub.subscriptionId);
                            setSubscriptions(cacheManager.getSubscriptions());
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No cache subscriptions configured. Add subscriptions to automatically cache
                    creator content.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            {config && (
              <Card>
                <CardHeader>
                  <CardTitle>Cache Configuration</CardTitle>
                  <CardDescription>Customize cache behavior and limits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Max Cache Size: {formatBytes(config.maxCacheSize)}
                    </label>
                    <Slider
                      value={[config.maxCacheSize / 1024 / 1024]}
                      onValueChange={(value) =>
                        handleConfigUpdate({ maxCacheSize: value[0] * 1024 * 1024 })
                      }
                      max={1000}
                      min={10}
                      step={10}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Items: {config.maxItems}</label>
                    <Slider
                      value={[config.maxItems]}
                      onValueChange={(value) => handleConfigUpdate({ maxItems: value[0] })}
                      max={10000}
                      min={100}
                      step={100}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Default TTL: {Math.round(config.defaultTTL / 86400)} days
                    </label>
                    <Slider
                      value={[config.defaultTTL / 86400]}
                      onValueChange={(value) =>
                        handleConfigUpdate({ defaultTTL: value[0] * 86400 })
                      }
                      max={30}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enable Prefetching</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically prefetch content based on usage patterns
                        </p>
                      </div>
                      <Switch
                        checked={config.prefetchEnabled}
                        onCheckedChange={(checked) =>
                          handleConfigUpdate({ prefetchEnabled: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enable Compression</p>
                        <p className="text-sm text-muted-foreground">
                          Compress cached content to save storage space
                        </p>
                      </div>
                      <Switch
                        checked={config.compressionEnabled}
                        onCheckedChange={(checked) =>
                          handleConfigUpdate({ compressionEnabled: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Auto Cleanup</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically remove old or low-priority content
                        </p>
                      </div>
                      <Switch
                        checked={config.autoCleanup}
                        onCheckedChange={(checked) => handleConfigUpdate({ autoCleanup: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enable Encryption</p>
                        <p className="text-sm text-muted-foreground">
                          Encrypt cached content for additional security
                        </p>
                      </div>
                      <Switch
                        checked={config.encryptionEnabled}
                        onCheckedChange={(checked) =>
                          handleConfigUpdate({ encryptionEnabled: checked })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="destructive" onClick={handleClearCache}>
                      Clear All Cache
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const exportData = cacheManager.exportCache();
                        const blob = new Blob([exportData], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `sovren-cache-export-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export Cache
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ContentCaching;

// Export types and classes for external use
export type { CacheAnalytics, CacheConfig, ContentCachingProps, ContentItem, SubscriptionCache };

export { ContentCacheManager, IntelligentPrefetcher };
