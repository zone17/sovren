// ===================================================================
// SOVREN PWA SERVICE WORKER - LEGENDARY TIER
// US-113: Progressive Web App Features Implementation
// ===================================================================

import { Activity, Bell, Download, Globe, HardDrive, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface ServiceWorkerStatus {
  isSupported: boolean;
  isInstalled: boolean;
  isActive: boolean;
  isUpdateAvailable: boolean;
  scope: string;
  state: ServiceWorkerState | 'not-supported';
}

interface CacheStatus {
  name: string;
  size: number;
  entryCount: number;
  lastUpdated: Date;
  hitRate: number;
}

interface OfflineCapability {
  isOffline: boolean;
  cachedPages: string[];
  unavailableFeatures: string[];
  queuedActions: number;
  lastSync: Date | null;
}

interface PWAServiceWorkerProps {
  /** Enable automatic service worker registration */
  autoRegister?: boolean;
  /** Service worker file path */
  swPath?: string;
  /** Cache strategy configuration */
  cacheStrategy?: 'cache-first' | 'network-first' | 'stale-while-revalidate';
  /** Enable push notifications */
  enablePushNotifications?: boolean;
  /** Enable background sync */
  enableBackgroundSync?: boolean;
  /** Cache size limit in MB */
  cacheSizeLimit?: number;
  /** Update check interval in milliseconds */
  updateCheckInterval?: number;
  /** Callback for service worker events */
  onServiceWorkerEvent?: (event: string, data?: any) => void;
}

// US-113.1: Install and configure service worker
class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private swPath: string;
  private updateCheckInterval: number;
  private eventCallbacks: Map<string, Function[]> = new Map();

  constructor(swPath: string = '/sw.js', updateCheckInterval: number = 60000) {
    this.swPath = swPath;
    this.updateCheckInterval = updateCheckInterval;
  }

  async install(): Promise<ServiceWorkerStatus> {
    if (!('serviceWorker' in navigator)) {
      return {
        isSupported: false,
        isInstalled: false,
        isActive: false,
        isUpdateAvailable: false,
        scope: '',
        state: 'not-supported',
      };
    }

    try {
      this.registration = await navigator.serviceWorker.register(this.swPath);

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        this.emit('updatefound', this.registration?.installing);
      });

      // Check for updates periodically
      this.startUpdateChecker();

      return this.getStatus();
    } catch (error) {
      console.error('Service worker registration failed:', error);
      throw error;
    }
  }

  private startUpdateChecker(): void {
    setInterval(() => {
      if (this.registration) {
        this.registration.update();
      }
    }, this.updateCheckInterval);
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

  getStatus(): ServiceWorkerStatus {
    if (!this.registration) {
      return {
        isSupported: 'serviceWorker' in navigator,
        isInstalled: false,
        isActive: false,
        isUpdateAvailable: false,
        scope: '',
        state: 'not-supported',
      };
    }

    const sw =
      this.registration.active || this.registration.installing || this.registration.waiting;

    return {
      isSupported: true,
      isInstalled: !!this.registration,
      isActive: !!this.registration.active,
      isUpdateAvailable: !!this.registration.waiting,
      scope: this.registration.scope,
      state: sw?.state || 'redundant',
    };
  }

  on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.eventCallbacks.get(event) || [];
    callbacks.forEach((callback) => callback(data));
  }
}

// US-113.2: Implement resource caching strategies
class CacheStrategyManager {
  private cacheNames = {
    static: 'static-cache-v1',
    dynamic: 'dynamic-cache-v1',
    images: 'images-cache-v1',
    api: 'api-cache-v1',
  };

  async getCacheStatus(): Promise<CacheStatus[]> {
    const cacheStatuses: CacheStatus[] = [];

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

        cacheStatuses.push({
          name: name,
          size: totalSize,
          entryCount: keys.length,
          lastUpdated: new Date(),
          hitRate: 0, // Would need to track hits/misses
        });
      } catch (error) {
        console.error(`Failed to get status for cache ${name}:`, error);
      }
    }

    return cacheStatuses;
  }

  async clearCache(cacheName?: string): Promise<void> {
    if (cacheName) {
      await caches.delete(this.cacheNames[cacheName as keyof typeof this.cacheNames]);
    } else {
      for (const name of Object.values(this.cacheNames)) {
        await caches.delete(name);
      }
    }
  }
}

// US-113.3: Add offline functionality
class OfflineManager {
  private offlineQueue: Array<{ request: Request; timestamp: Date }> = [];
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.setupOnlineListener();
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private async processOfflineQueue(): Promise<void> {
    while (this.offlineQueue.length > 0 && this.isOnline) {
      const { request } = this.offlineQueue.shift()!;

      try {
        await fetch(request);
        console.log('Offline request processed successfully');
      } catch (error) {
        console.error('Failed to process offline request:', error);
        // Re-queue if network is still failing
        if (!navigator.onLine) {
          this.offlineQueue.unshift({ request, timestamp: new Date() });
          break;
        }
      }
    }
  }

  getOfflineCapability(): OfflineCapability {
    return {
      isOffline: !this.isOnline,
      cachedPages: [], // Would need to track cached pages
      unavailableFeatures: this.isOnline
        ? []
        : ['Real-time notifications', 'Live data updates', 'File uploads'],
      queuedActions: this.offlineQueue.length,
      lastSync: this.isOnline ? new Date() : null,
    };
  }
}

// US-113.4: Enable push notifications
class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;
  private publicKey: string = ''; // Would be configured

  constructor(registration: ServiceWorkerRegistration | null = null) {
    this.registration = registration;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.publicKey),
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    // Implementation would send subscription to backend
    console.log('Sending subscription to server:', subscription);
  }

  async showNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    await this.registration.showNotification(title, {
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      ...options,
    });
  }
}

// Main PWA Service Worker Component
export const PWAServiceWorker: React.FC<PWAServiceWorkerProps> = ({
  autoRegister = true,
  swPath = '/sw.js',
  cacheStrategy = 'stale-while-revalidate',
  enablePushNotifications = true,
  enableBackgroundSync = true,
  cacheSizeLimit = 50,
  updateCheckInterval = 60000,
  onServiceWorkerEvent,
}) => {
  const [swStatus, setSWStatus] = useState<ServiceWorkerStatus>({
    isSupported: false,
    isInstalled: false,
    isActive: false,
    isUpdateAvailable: false,
    scope: '',
    state: 'not-supported',
  });

  const [cacheStatuses, setCacheStatuses] = useState<CacheStatus[]>([]);
  const [offlineCapability, setOfflineCapability] = useState<OfflineCapability>({
    isOffline: false,
    cachedPages: [],
    unavailableFeatures: [],
    queuedActions: 0,
    lastSync: null,
  });

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize managers
  const swManager = useMemo(
    () => new ServiceWorkerManager(swPath, updateCheckInterval),
    [swPath, updateCheckInterval]
  );
  const cacheManager = useMemo(() => new CacheStrategyManager(), []);
  const offlineManager = useMemo(() => new OfflineManager(), []);
  const pushManager = useMemo(() => new PushNotificationManager(), []);

  useEffect(() => {
    if (autoRegister) {
      initializeServiceWorker();
    }

    // Setup event listeners
    if (onServiceWorkerEvent) {
      swManager.on('updatefound', (sw: ServiceWorker) => onServiceWorkerEvent('updatefound', sw));
    }

    // Update status periodically
    const interval = setInterval(updateStatus, 10000);
    return () => clearInterval(interval);
  }, [autoRegister, onServiceWorkerEvent]);

  const initializeServiceWorker = async () => {
    setIsLoading(true);

    try {
      const status = await swManager.install();
      setSWStatus(status);

      if (status.isInstalled) {
        await updateCacheStatus();
        updateOfflineStatus();

        if (enablePushNotifications) {
          await initializePushNotifications();
        }
      }
    } catch (error) {
      console.error('Failed to initialize service worker:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = useCallback(() => {
    const status = swManager.getStatus();
    setSWStatus(status);
    updateOfflineStatus();
  }, [swManager]);

  const updateCacheStatus = async () => {
    try {
      const statuses = await cacheManager.getCacheStatus();
      setCacheStatuses(statuses);
    } catch (error) {
      console.error('Failed to update cache status:', error);
    }
  };

  const updateOfflineStatus = () => {
    const capability = offlineManager.getOfflineCapability();
    setOfflineCapability(capability);
  };

  const initializePushNotifications = async () => {
    try {
      const permission = await pushManager.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        await pushManager.subscribeToPush();
      }
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  };

  const handleUpdate = async () => {
    try {
      await swManager.update();
      if (swStatus.isUpdateAvailable) {
        await swManager.skipWaiting();
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to update service worker:', error);
    }
  };

  const handleClearCache = async () => {
    try {
      await cacheManager.clearCache();
      await updateCacheStatus();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const getTotalCacheSize = useMemo(() => {
    return cacheStatuses.reduce((total, cache) => total + cache.size, 0);
  }, [cacheStatuses]);

  const getStatusIcon = () => {
    if (!swStatus.isSupported) return <Globe className="h-5 w-5 text-gray-500" />;
    if (!swStatus.isActive) return <RefreshCw className="h-5 w-5 text-yellow-500" />;
    return <Activity className="h-5 w-5 text-green-500" />;
  };

  const getConnectionIcon = () => {
    return offlineCapability.isOffline ? (
      <WifiOff className="h-5 w-5 text-red-500" />
    ) : (
      <Wifi className="h-5 w-5 text-green-500" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Initializing PWA...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <h2 className="text-xl font-semibold text-gray-900">PWA Service Worker</h2>
        </div>
        <div className="flex items-center space-x-2">
          {getConnectionIcon()}
          <span className="text-sm text-gray-500">
            {offlineCapability.isOffline ? 'Offline' : 'Online'}
          </span>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">Service Worker</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {swStatus.isActive ? 'Active' : 'Inactive'}
          </p>
          <p className="text-sm text-blue-700">State: {swStatus.state}</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <HardDrive className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-900">Cache Size</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {(getTotalCacheSize / (1024 * 1024)).toFixed(1)}MB
          </p>
          <p className="text-sm text-green-700">Limit: {cacheSizeLimit}MB</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-purple-900">Notifications</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {notificationPermission === 'granted' ? 'Enabled' : 'Disabled'}
          </p>
          <p className="text-sm text-purple-700">Status: {notificationPermission}</p>
        </div>
      </div>

      {/* Cache Status */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cache Status</h3>
        <div className="space-y-2">
          {cacheStatuses.map((cache, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <span className="font-medium text-gray-900">{cache.name}</span>
                <p className="text-sm text-gray-600">{cache.entryCount} entries</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm text-gray-700">
                  {(cache.size / 1024).toFixed(1)}KB
                </span>
                <p className="text-xs text-gray-500">Hit rate: {cache.hitRate.toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offline Capabilities */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Offline Capabilities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Available Offline</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Cached pages and assets</li>
              <li>• Basic app functionality</li>
              <li>• Previously viewed content</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Requires Connection</h4>
            {offlineCapability.unavailableFeatures.map((feature, index) => (
              <li key={index} className="text-sm text-gray-600">
                • {feature}
              </li>
            ))}
          </div>
        </div>

        {offlineCapability.queuedActions > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              {offlineCapability.queuedActions} actions queued for when connection returns
            </p>
          </div>
        )}
      </div>

      {/* Update Available */}
      {swStatus.isUpdateAvailable && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900">Update Available</h4>
              <p className="text-sm text-blue-700">A new version of the app is ready to install</p>
            </div>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2 inline" />
              Update Now
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={initializeServiceWorker}
            disabled={swStatus.isActive}
            className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-1 inline" />
            Install SW
          </button>

          <button
            onClick={handleUpdate}
            className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-1 inline" />
            Check Update
          </button>

          <button
            onClick={handleClearCache}
            className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            <HardDrive className="h-4 w-4 mr-1 inline" />
            Clear Cache
          </button>

          <button
            onClick={initializePushNotifications}
            disabled={notificationPermission === 'granted'}
            className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
          >
            <Bell className="h-4 w-4 mr-1 inline" />
            Enable Push
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAServiceWorker;
