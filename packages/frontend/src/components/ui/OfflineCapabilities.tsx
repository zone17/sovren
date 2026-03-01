import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { Alert, AlertDescription } from './alert';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Progress } from './progress';

// ===================================================================
// US-091: SERVICE WORKER IMPLEMENTATION - LEGENDARY TIER
// ===================================================================

// 6.9.1. Design offline functionality architecture
const OfflineArchitectureSchema = z.object({
  serviceWorkerSupported: z.boolean(),
  offlineCapable: z.boolean(),
  cacheStrategy: z.enum(['networkFirst', 'cacheFirst', 'staleWhileRevalidate']),
  syncEnabled: z.boolean(),
  notificationPermission: z.enum(['granted', 'denied', 'default']),
});

const ServiceWorkerStatusSchema = z.object({
  state: z.enum(['installing', 'installed', 'activating', 'activated', 'redundant']),
  scope: z.string(),
  scriptURL: z.string(),
  updateAvailable: z.boolean(),
});

const OfflineStateSchema = z.object({
  isOnline: z.boolean(),
  connectionType: z.enum(['wifi', 'cellular', '4g', '3g', '2g', 'unknown']).optional(),
  effectiveType: z.enum(['slow-2g', '2g', '3g', '4g']).optional(),
  downlink: z.number().optional(),
  rtt: z.number().optional(),
});

const CacheStatusSchema = z.object({
  name: z.string(),
  size: z.number(),
  itemCount: z.number(),
  lastUpdated: z.date(),
  hitRate: z.number().min(0).max(1),
});

const SyncQueueItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  data: z.record(z.any()),
  timestamp: z.date(),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
});

// Types
type OfflineArchitecture = z.infer<typeof OfflineArchitectureSchema>;
type ServiceWorkerStatus = z.infer<typeof ServiceWorkerStatusSchema>;
type OfflineState = z.infer<typeof OfflineStateSchema>;
type CacheStatus = z.infer<typeof CacheStatusSchema>;
type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;

interface OfflineCapabilitiesProps {
  enableServiceWorker?: boolean;
  enableOfflineMode?: boolean;
  enableBackgroundSync?: boolean;
  enableOfflineIndicators?: boolean;
  cacheStrategy?: 'networkFirst' | 'cacheFirst' | 'staleWhileRevalidate';
  maxCacheSize?: number;
  syncRetryDelay?: number;
  className?: string;
}

// 6.9.2. Implement service worker registration
class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: Set<(status: ServiceWorkerStatus) => void> = new Set();

  static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }

  async register(scriptURL: string = '/sw.js'): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    try {
      this.registration = await navigator.serviceWorker.register(scriptURL, {
        scope: '/',
        updateViaCache: 'none',
      });

      this.setupEventListeners();
      this.notifyListeners();

      return this.registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.registration) return;

    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          this.notifyListeners();
        });
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.notifyListeners();
    });
  }

  private notifyListeners(): void {
    if (!this.registration) return;

    const status: ServiceWorkerStatus = {
      state: (this.registration.active?.state || 'installing') as ServiceWorkerStatus['state'],
      scope: this.registration.scope,
      scriptURL: this.registration.active?.scriptURL || '',
      updateAvailable: !!this.registration.waiting,
    };

    this.listeners.forEach((listener) => listener(status));
  }

  addListener(listener: (status: ServiceWorkerStatus) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (status: ServiceWorkerStatus) => void): void {
    this.listeners.delete(listener);
  }

  async update(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
    }
  }

  async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }
}

// 6.9.3. Create offline content caching strategies
class CacheManager {
  private static instance: CacheManager;
  private cacheNames = {
    static: 'sovren-static-v1',
    dynamic: 'sovren-dynamic-v1',
    content: 'sovren-content-v1',
    images: 'sovren-images-v1',
  };

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  async cacheResource(
    url: string,
    response?: Response,
    cacheName: string = 'dynamic'
  ): Promise<void> {
    try {
      const cache = await caches.open(this.cacheNames[cacheName as keyof typeof this.cacheNames]);

      if (response) {
        await cache.put(url, response.clone());
      } else {
        await cache.add(url);
      }
    } catch (error) {
      console.error('Failed to cache resource:', error);
    }
  }

  async getCachedResource(url: string): Promise<Response | undefined> {
    try {
      for (const cacheName of Object.values(this.cacheNames)) {
        const cache = await caches.open(cacheName);
        const response = await cache.match(url);
        if (response) {
          return response;
        }
      }
    } catch (error) {
      console.error('Failed to get cached resource:', error);
    }
    return undefined;
  }

  async getCacheStatus(): Promise<CacheStatus[]> {
    const statuses: CacheStatus[] = [];

    for (const [name, cacheName] of Object.entries(this.cacheNames)) {
      try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();

        let totalSize = 0;
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }

        statuses.push({
          name,
          size: totalSize,
          itemCount: keys.length,
          lastUpdated: new Date(),
          hitRate: 0.85, // Would be calculated from actual usage
        });
      } catch (error) {
        console.error(`Failed to get cache status for ${name}:`, error);
      }
    }

    return statuses;
  }

  async clearCache(cacheName?: string): Promise<void> {
    try {
      if (cacheName) {
        await caches.delete(this.cacheNames[cacheName as keyof typeof this.cacheNames]);
      } else {
        for (const cache of Object.values(this.cacheNames)) {
          await caches.delete(cache);
        }
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}

// 6.9.4. Add offline UI state management
const useOfflineState = () => {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: '4g',
  });

  useEffect(() => {
    const updateOnlineStatus = () => {
      const connection =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;

      setOfflineState({
        isOnline: navigator.onLine,
        connectionType: connection?.type || 'unknown',
        effectiveType: connection?.effectiveType || '4g',
        downlink: connection?.downlink,
        rtt: connection?.rtt,
      });
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateOnlineStatus);
    }

    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      if (connection) {
        connection.removeEventListener('change', updateOnlineStatus);
      }
    };
  }, []);

  return offlineState;
};

// 6.9.5. Implement offline data synchronization
class SyncManager {
  private static instance: SyncManager;
  private queue: SyncQueueItem[] = [];
  private isProcessing = false;
  private listeners: Set<(queue: SyncQueueItem[]) => void> = new Set();

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): void {
    const syncItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
    };

    this.queue.push(syncItem);
    this.queue.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    this.notifyListeners();
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 && navigator.onLine) {
      const item = this.queue[0];

      try {
        await this.processItem(item);
        this.queue.shift();
        this.notifyListeners();
      } catch (error) {
        console.error('Sync item failed:', error);

        item.retryCount++;
        if (item.retryCount >= item.maxRetries) {
          this.queue.shift(); // Remove failed item
        }

        this.notifyListeners();
        break; // Stop processing on failure
      }
    }

    this.isProcessing = false;
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    // Simulate API call processing
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          // 90% success rate
          resolve();
        } else {
          reject(new Error('Network error'));
        }
      }, 1000);
    });
  }

  getQueue(): SyncQueueItem[] {
    return [...this.queue];
  }

  addListener(listener: (queue: SyncQueueItem[]) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (queue: SyncQueueItem[]) => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getQueue()));
  }

  clearQueue(): void {
    this.queue = [];
    this.notifyListeners();
  }
}

// 6.9.6. Create offline error handling
const useOfflineErrorHandler = () => {
  const [errors, setErrors] = useState<Array<{ id: string; message: string; timestamp: Date }>>([]);

  const addError = useCallback((message: string) => {
    const error = {
      id: `error_${Date.now()}`,
      message,
      timestamp: new Date(),
    };
    setErrors((prev) => [...prev, error]);

    // Auto-remove error after 5 seconds
    setTimeout(() => {
      setErrors((prev) => prev.filter((e) => e.id !== error.id));
    }, 5000);
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return { errors, addError, removeError, clearErrors };
};

// Main Component
export const OfflineCapabilities: React.FC<OfflineCapabilitiesProps> = ({
  enableServiceWorker = true,
  enableOfflineMode = true,
  enableBackgroundSync = true,
  enableOfflineIndicators = true,
  cacheStrategy = 'staleWhileRevalidate',
  maxCacheSize = 50 * 1024 * 1024, // 50MB
  syncRetryDelay = 5000,
  className = '',
}) => {
  // Feature flags
  const { flags } = useFeatureFlags();
  const isEnabled = flags?.enableOfflineCapabilities && enableOfflineMode;

  // State management
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<ServiceWorkerStatus | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [architecture, setArchitecture] = useState<OfflineArchitecture>({
    serviceWorkerSupported: 'serviceWorker' in navigator,
    offlineCapable: false,
    cacheStrategy,
    syncEnabled: enableBackgroundSync,
    notificationPermission: 'default',
  });

  // Hooks
  const offlineState = useOfflineState();
  const { errors, addError, clearErrors } = useOfflineErrorHandler();

  // Managers
  const swManager = useMemo(() => ServiceWorkerManager.getInstance(), []);
  const cacheManager = useMemo(() => CacheManager.getInstance(), []);
  const syncManager = useMemo(() => SyncManager.getInstance(), []);

  // 6.9.2. Service worker registration
  useEffect(() => {
    if (!isEnabled || !enableServiceWorker) return;

    const initializeServiceWorker = async () => {
      try {
        setIsInstalling(true);
        await swManager.register();

        setArchitecture((prev) => ({ ...prev, offlineCapable: true }));

        swManager.addListener(setServiceWorkerStatus);
      } catch (error) {
        addError('Failed to initialize service worker');
        console.error('Service worker initialization failed:', error);
      } finally {
        setIsInstalling(false);
      }
    };

    initializeServiceWorker();

    return () => {
      swManager.removeListener(setServiceWorkerStatus);
    };
  }, [isEnabled, enableServiceWorker, swManager, addError]);

  // Cache status monitoring
  useEffect(() => {
    if (!isEnabled) return;

    const updateCacheStatus = async () => {
      try {
        const status = await cacheManager.getCacheStatus();
        setCacheStatus(status);
      } catch (error) {
        addError('Failed to update cache status');
      }
    };

    updateCacheStatus();
    const interval = setInterval(updateCacheStatus, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [isEnabled, cacheManager, addError]);

  // Sync queue monitoring
  useEffect(() => {
    if (!isEnabled || !enableBackgroundSync) return;

    syncManager.addListener(setSyncQueue);

    return () => {
      syncManager.removeListener(setSyncQueue);
    };
  }, [isEnabled, enableBackgroundSync, syncManager]);

  // 6.9.7. Add offline mode indicators
  const getConnectionQuality = useCallback(() => {
    if (!offlineState.isOnline) return 'offline';
    if (offlineState.effectiveType === 'slow-2g' || offlineState.effectiveType === '2g')
      return 'poor';
    if (offlineState.effectiveType === '3g') return 'good';
    return 'excellent';
  }, [offlineState]);

  const getConnectionColor = useCallback(() => {
    const quality = getConnectionQuality();
    switch (quality) {
      case 'offline':
        return 'bg-red-500';
      case 'poor':
        return 'bg-orange-500';
      case 'good':
        return 'bg-yellow-500';
      case 'excellent':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  }, [getConnectionQuality]);

  // Event handlers
  const handleUpdateServiceWorker = useCallback(async () => {
    try {
      await swManager.skipWaiting();
      window.location.reload();
    } catch (error) {
      addError('Failed to update service worker');
    }
  }, [swManager, addError]);

  const handleClearCache = useCallback(
    async (cacheName?: string) => {
      try {
        await cacheManager.clearCache(cacheName);
        const status = await cacheManager.getCacheStatus();
        setCacheStatus(status);
      } catch (error) {
        addError('Failed to clear cache');
      }
    },
    [cacheManager, addError]
  );

  const handleAddSyncItem = useCallback(() => {
    syncManager.addToQueue({
      action: 'test_sync',
      data: { message: 'Test sync item', timestamp: Date.now() },
      retryCount: 0,
      maxRetries: 3,
      priority: 'normal',
    });
  }, [syncManager]);

  const totalCacheSize = useMemo(() => {
    return cacheStatus.reduce((total, cache) => total + cache.size, 0);
  }, [cacheStatus]);

  const cacheUsagePercentage = useMemo(() => {
    return Math.round((totalCacheSize / maxCacheSize) * 100);
  }, [totalCacheSize, maxCacheSize]);

  if (!isEnabled) {
    return null;
  }

  return (
    <div className={`offline-capabilities space-y-6 ${className}`}>
      {/* 6.9.7. Offline mode indicators */}
      {enableOfflineIndicators && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Connection Status
              <div className={`w-3 h-3 rounded-full ${getConnectionColor()}`} />
            </CardTitle>
            <CardDescription>Current network status and connection quality</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Status</p>
                <Badge variant={offlineState.isOnline ? 'default' : 'destructive'}>
                  {offlineState.isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Connection Type</p>
                <p className="text-sm text-muted-foreground">
                  {offlineState.connectionType || 'Unknown'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Speed</p>
                <p className="text-sm text-muted-foreground">
                  {offlineState.effectiveType || 'Unknown'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Latency</p>
                <p className="text-sm text-muted-foreground">
                  {offlineState.rtt ? `${offlineState.rtt}ms` : 'Unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Worker Status */}
      <Card>
        <CardHeader>
          <CardTitle>Service Worker Status</CardTitle>
          <CardDescription>
            Progressive Web App functionality and offline capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInstalling ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Installing service worker...</span>
            </div>
          ) : serviceWorkerStatus ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">State</p>
                  <Badge
                    variant={serviceWorkerStatus.state === 'activated' ? 'default' : 'secondary'}
                  >
                    {serviceWorkerStatus.state}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Scope</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {serviceWorkerStatus.scope}
                  </p>
                </div>
              </div>

              {serviceWorkerStatus.updateAvailable && (
                <Alert>
                  <AlertDescription className="flex items-center justify-between">
                    <span>A new version is available</span>
                    <Button size="sm" onClick={handleUpdateServiceWorker}>
                      Update
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                Service Worker not available or failed to initialize
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Management</CardTitle>
          <CardDescription>Offline content storage and management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Cache Usage</span>
              <span>
                {cacheUsagePercentage}% of {Math.round(maxCacheSize / 1024 / 1024)}MB
              </span>
            </div>
            <Progress value={cacheUsagePercentage} className="h-2" />
          </div>

          <div className="space-y-3">
            {cacheStatus.map((cache, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium capitalize">{cache.name} Cache</p>
                  <p className="text-sm text-muted-foreground">
                    {cache.itemCount} items • {Math.round(cache.size / 1024)}KB •{' '}
                    {Math.round(cache.hitRate * 100)}% hit rate
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleClearCache(cache.name)}>
                  Clear
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClearCache()}>
              Clear All Caches
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Background Sync */}
      {enableBackgroundSync && (
        <Card>
          <CardHeader>
            <CardTitle>Background Synchronization</CardTitle>
            <CardDescription>Offline actions queue and synchronization status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Sync Queue ({syncQueue.length} items)</span>
              <Button size="sm" onClick={handleAddSyncItem}>
                Add Test Item
              </Button>
            </div>

            {syncQueue.length > 0 ? (
              <div className="space-y-2">
                {syncQueue.slice(0, 5).map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-xs text-muted-foreground">
                        Priority: {item.priority} • Retries: {item.retryCount}/{item.maxRetries}
                      </p>
                    </div>
                    <Badge variant={item.retryCount > 0 ? 'destructive' : 'secondary'}>
                      {item.retryCount > 0 ? 'Retrying' : 'Pending'}
                    </Badge>
                  </div>
                ))}
                {syncQueue.length > 5 && (
                  <p className="text-sm text-muted-foreground">
                    +{syncQueue.length - 5} more items...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No items in sync queue</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Offline Errors
              <Button variant="outline" size="sm" onClick={clearErrors}>
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errors.map((error) => (
                <Alert key={error.id} variant="destructive">
                  <AlertDescription className="flex items-center justify-between">
                    <span>{error.message}</span>
                    <span className="text-xs">{error.timestamp.toLocaleTimeString()}</span>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Architecture Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Offline Architecture</CardTitle>
          <CardDescription>Current offline capabilities and configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Service Worker Support</span>
                <Badge variant={architecture.serviceWorkerSupported ? 'default' : 'destructive'}>
                  {architecture.serviceWorkerSupported ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Offline Capable</span>
                <Badge variant={architecture.offlineCapable ? 'default' : 'secondary'}>
                  {architecture.offlineCapable ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Cache Strategy</span>
                <Badge variant="outline">{architecture.cacheStrategy}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Background Sync</span>
                <Badge variant={architecture.syncEnabled ? 'default' : 'secondary'}>
                  {architecture.syncEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OfflineCapabilities;

// Export types for external use
export type {
  CacheStatus,
  OfflineArchitecture,
  OfflineCapabilitiesProps,
  OfflineState,
  ServiceWorkerStatus,
  SyncQueueItem,
};

export { CacheManager, ServiceWorkerManager, SyncManager, useOfflineErrorHandler, useOfflineState };
