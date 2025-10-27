// ===================================================================
// SOVREN OFFLINE CAPABILITIES SERVICE WORKER - LEGENDARY TIER
// US-091: Service Worker Implementation
// ===================================================================

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  static: `sovren-static-${CACHE_VERSION}`,
  dynamic: `sovren-dynamic-${CACHE_VERSION}`,
  content: `sovren-content-${CACHE_VERSION}`,
  images: `sovren-images-${CACHE_VERSION}`,
};

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/static/css/main.css',
  '/static/js/main.js',
];

const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// ===================================================================
// INSTALLATION AND ACTIVATION
// ===================================================================

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches
      .open(CACHE_NAMES.static)
      .then((cache) => {
        console.log('Service Worker: Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            const isOldCache = Object.values(CACHE_NAMES).indexOf(cacheName) === -1;
            if (isOldCache) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim(),
    ]).then(() => {
      console.log('Service Worker: Activation complete');
    })
  );
});

// ===================================================================
// FETCH HANDLING AND CACHING STRATEGIES
// ===================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Determine caching strategy based on request type
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.static));
  } else if (isImageRequest(url)) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.images));
  } else if (isAPIRequest(url)) {
    event.respondWith(networkFirst(request, CACHE_NAMES.dynamic));
  } else if (isContentRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.content));
  } else {
    event.respondWith(networkFirst(request, CACHE_NAMES.dynamic));
  }
});

// ===================================================================
// CACHING STRATEGIES
// ===================================================================

// Cache First - Good for static assets that rarely change
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.status === 200) {
      await trimCache(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Cache First strategy failed:', error);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network First - Good for API calls and dynamic content
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      await trimCache(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);

    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Stale While Revalidate - Good for content that changes occasionally
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.status === 200) {
        trimCache(cacheName);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

// ===================================================================
// BACKGROUND SYNC
// ===================================================================

self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  try {
    // Get sync queue from IndexedDB
    const syncQueue = await getSyncQueue();

    for (const item of syncQueue) {
      try {
        await processSyncItem(item);
        await removeSyncItem(item.id);
      } catch (error) {
        console.error('Sync item failed:', error);
        await updateSyncItem(item.id, { retryCount: item.retryCount + 1 });

        if (item.retryCount >= item.maxRetries) {
          await removeSyncItem(item.id);
        }
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function processSyncItem(item) {
  const response = await fetch(item.url, {
    method: item.method,
    headers: item.headers,
    body: item.body,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

// ===================================================================
// PUSH NOTIFICATIONS
// ===================================================================

self.addEventListener('push', (event) => {
  const options = {
    body: 'You have new content available offline!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'View Content',
        icon: '/icon-view.png',
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-close.png',
      },
    ],
  };

  if (event.data) {
    const data = event.data.json();
    options.body = data.body || options.body;
    options.title = data.title || 'Sovren';
  }

  event.waitUntil(self.registration.showNotification('Sovren', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(clients.openWindow('/'));
  }
});

// ===================================================================
// MESSAGE HANDLING
// ===================================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_RESOURCE':
      handleCacheResource(payload);
      break;

    case 'CLEAR_CACHE':
      handleClearCache(payload);
      break;

    case 'GET_CACHE_STATUS':
      handleGetCacheStatus(event);
      break;

    default:
      console.log('Unknown message type:', type);
  }
});

async function handleCacheResource(payload) {
  try {
    const { url, cacheName = 'dynamic' } = payload;
    const cache = await caches.open(CACHE_NAMES[cacheName]);
    await cache.add(url);
  } catch (error) {
    console.error('Failed to cache resource:', error);
  }
}

async function handleClearCache(payload) {
  try {
    const { cacheName } = payload;

    if (cacheName) {
      await caches.delete(CACHE_NAMES[cacheName]);
    } else {
      for (const name of Object.values(CACHE_NAMES)) {
        await caches.delete(name);
      }
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

async function handleGetCacheStatus(event) {
  try {
    const statuses = [];

    for (const [name, cacheName] of Object.entries(CACHE_NAMES)) {
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
        lastUpdated: new Date().toISOString(),
      });
    }

    event.ports[0].postMessage({ type: 'CACHE_STATUS', payload: statuses });
  } catch (error) {
    console.error('Failed to get cache status:', error);
    event.ports[0].postMessage({ type: 'ERROR', payload: error.message });
  }
}

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

function isStaticAsset(url) {
  return url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/);
}

function isImageRequest(url) {
  return url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp)$/);
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/graphql');
}

function isContentRequest(url) {
  return url.pathname.startsWith('/content/') || url.pathname.startsWith('/posts/');
}

async function trimCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length <= 100) return; // Max 100 items per cache

  // Remove oldest entries
  const sortedKeys = keys.sort((a, b) => {
    return new Date(a.headers.get('date')) - new Date(b.headers.get('date'));
  });

  const keysToDelete = sortedKeys.slice(0, keys.length - 100);

  await Promise.all(keysToDelete.map((key) => cache.delete(key)));
}

// ===================================================================
// INDEXEDDB HELPERS FOR SYNC QUEUE
// ===================================================================

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SovrenSync', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('priority', 'priority');
      }
    };
  });
}

async function getSyncQueue() {
  const db = await openDB();
  const transaction = db.transaction(['syncQueue'], 'readonly');
  const store = transaction.objectStore('syncQueue');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function removeSyncItem(id) {
  const db = await openDB();
  const transaction = db.transaction(['syncQueue'], 'readwrite');
  const store = transaction.objectStore('syncQueue');

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function updateSyncItem(id, updates) {
  const db = await openDB();
  const transaction = db.transaction(['syncQueue'], 'readwrite');
  const store = transaction.objectStore('syncQueue');

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = { ...getRequest.result, ...updates };
      const putRequest = store.put(item);

      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

console.log('Service Worker: Loaded successfully');
