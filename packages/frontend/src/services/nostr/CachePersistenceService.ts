/**
 * 🗄️ Cache Persistence Service
 * US-317: NOSTR Caching Layer - Subtasks 7-8
 *
 * IndexedDB persistence layer for NOSTR event cache
 *
 * Features:
 * - Automatic persistence to IndexedDB
 * - LRU eviction policy
 * - Size-based limits
 * - Batch operations for performance
 * - Migration support
 */

import type { NostrEvent, NostrFilter } from '@shared/types/nostr';
import { EventCacheService, getEventCache } from './EventCacheService';

/**
 * IndexedDB configuration
 */
const DB_NAME = 'nostr_event_cache';
const DB_VERSION = 2;
const EVENTS_STORE = 'events';
const METADATA_STORE = 'metadata';
const PROFILES_STORE = 'profiles';

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  dbName?: string;
  maxEvents?: number;
  maxSizeBytes?: number;
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
  enableCompression?: boolean;
}

/**
 * Cached event with metadata
 */
export interface PersistedEvent {
  id: string;
  event: NostrEvent;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  relay?: string;
  verified?: boolean;
  compressed?: boolean;
}

/**
 * Profile cache entry
 */
export interface PersistedProfile {
  pubkey: string;
  metadata: any;
  nip05?: string;
  nip05Verified?: boolean;
  timestamp: number;
  lastAccessed: number;
}

/**
 * Cache metadata
 */
export interface CacheMetadata {
  version: number;
  createdAt: number;
  lastUpdated: number;
  totalEvents: number;
  totalSize: number;
  evictionCount: number;
}

/**
 * Cache Persistence Service
 */
export class CachePersistenceService {
  private static instance: CachePersistenceService | null = null;
  private db: IDBDatabase | null = null;
  private config: PersistenceConfig;
  private cacheService: EventCacheService;
  private saveTimer: NodeJS.Timeout | null = null;
  private pendingSaves: Set<string> = new Set();
  private metadata: CacheMetadata;

  private constructor(config: PersistenceConfig = {}) {
    this.config = {
      dbName: DB_NAME,
      maxEvents: 10000,
      maxSizeBytes: 50 * 1024 * 1024, // 50MB
      enableAutoSave: true,
      autoSaveInterval: 5000, // 5 seconds
      enableCompression: false,
      ...config,
    };

    this.cacheService = getEventCache();
    this.metadata = {
      version: DB_VERSION,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      totalEvents: 0,
      totalSize: 0,
      evictionCount: 0,
    };

    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: PersistenceConfig): CachePersistenceService {
    if (!this.instance) {
      this.instance = new CachePersistenceService(config);
    }
    return this.instance;
  }

  /**
   * Initialize IndexedDB
   */
  private async initialize(): Promise<void> {
    await this.openDatabase();
    await this.loadMetadata();
    await this.restoreFromDisk();

    if (this.config.enableAutoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Open IndexedDB connection
   */
  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName!, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create events store
        if (!db.objectStoreNames.contains(EVENTS_STORE)) {
          const eventsStore = db.createObjectStore(EVENTS_STORE, {
            keyPath: 'id',
          });
          eventsStore.createIndex('timestamp', 'timestamp', { unique: false });
          eventsStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          eventsStore.createIndex('pubkey', 'event.pubkey', { unique: false });
          eventsStore.createIndex('kind', 'event.kind', { unique: false });
        }

        // Create profiles store
        if (!db.objectStoreNames.contains(PROFILES_STORE)) {
          const profilesStore = db.createObjectStore(PROFILES_STORE, {
            keyPath: 'pubkey',
          });
          profilesStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          profilesStore.createIndex('nip05', 'nip05', { unique: false });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, {
            keyPath: 'id',
          });
        }
      };
    });
  }

  /**
   * Persist event to IndexedDB
   */
  public async persistEvent(event: NostrEvent, metadata?: any): Promise<void> {
    if (!this.db) return;

    const size = this.calculateEventSize(event);

    // Check size limits
    if (await this.needsEviction(size)) {
      await this.evictLRU(size);
    }

    const persistedEvent: PersistedEvent = {
      id: event.id,
      event,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      size,
      relay: metadata?.relay,
      verified: metadata?.verified,
      compressed: false,
    };

    // Compress if enabled
    if (this.config.enableCompression) {
      persistedEvent.event = await this.compressEvent(event);
      persistedEvent.compressed = true;
    }

    const transaction = this.db.transaction([EVENTS_STORE], 'readwrite');
    const store = transaction.objectStore(EVENTS_STORE);

    return new Promise((resolve, reject) => {
      try {
        const request = store.put(persistedEvent);

        request.onsuccess = () => {
          this.metadata.totalEvents++;
          this.metadata.totalSize += size;
          this.metadata.lastUpdated = Date.now();
          this.saveMetadata();
          resolve();
        };

        request.onerror = () => reject(request.error);
      } catch (err) {
        // Synchronous errors from store.put (e.g. invalid keyPath value)
        reject(err);
      }
    }).catch((err) => {
      console.warn('[CachePersistenceService] persistEvent failed, skipping:', err);
    });
  }

  /**
   * Batch persist events
   */
  public async persistBatch(events: NostrEvent[]): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([EVENTS_STORE], 'readwrite');
    const store = transaction.objectStore(EVENTS_STORE);

    const promises = events.map(event => {
      const size = this.calculateEventSize(event);

      const persistedEvent: PersistedEvent = {
        id: event.id,
        event,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        size,
        compressed: false,
      };

      return new Promise<void>((resolve, reject) => {
        const request = store.put(persistedEvent);
        request.onsuccess = () => {
          this.metadata.totalEvents++;
          this.metadata.totalSize += size;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
    this.metadata.lastUpdated = Date.now();
    await this.saveMetadata();
  }

  /**
   * Retrieve event from IndexedDB
   */
  public async getPersistedEvent(id: string): Promise<NostrEvent | null> {
    if (!this.db) return null;

    const transaction = this.db.transaction([EVENTS_STORE], 'readwrite');
    const store = transaction.objectStore(EVENTS_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = async () => {
        const result: PersistedEvent = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Update access metadata
        result.lastAccessed = Date.now();
        result.accessCount++;
        store.put(result);

        // Decompress if needed
        let event = result.event;
        if (result.compressed) {
          event = await this.decompressEvent(event);
        }

        resolve(event);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Query persisted events
   */
  public async queryPersistedEvents(filter: NostrFilter): Promise<NostrEvent[]> {
    if (!this.db) return [];

    const transaction = this.db.transaction([EVENTS_STORE], 'readonly');
    const store = transaction.objectStore(EVENTS_STORE);

    const events: NostrEvent[] = [];

    return new Promise((resolve, reject) => {
      const request = store.openCursor();

      request.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const persistedEvent: PersistedEvent = cursor.value;
          let nostrEvent = persistedEvent.event;

          // Decompress if needed
          if (persistedEvent.compressed) {
            nostrEvent = await this.decompressEvent(nostrEvent);
          }

          // Apply filter
          if (this.matchesFilter(nostrEvent, filter)) {
            events.push(nostrEvent);

            if (filter.limit && events.length >= filter.limit) {
              resolve(events);
              return;
            }
          }

          cursor.continue();
        } else {
          resolve(events);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Persist profile data
   */
  public async persistProfile(
    pubkey: string,
    metadata: any,
    nip05?: string
  ): Promise<void> {
    if (!this.db) return;

    const profile: PersistedProfile = {
      pubkey,
      metadata,
      nip05,
      nip05Verified: !!nip05,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
    };

    const transaction = this.db.transaction([PROFILES_STORE], 'readwrite');
    const store = transaction.objectStore(PROFILES_STORE);

    return new Promise((resolve, reject) => {
      const request = store.put(profile);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get cached profile
   */
  public async getPersistedProfile(pubkey: string): Promise<PersistedProfile | null> {
    if (!this.db) return null;

    const transaction = this.db.transaction([PROFILES_STORE], 'readwrite');
    const store = transaction.objectStore(PROFILES_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(pubkey);

      request.onsuccess = () => {
        const result: PersistedProfile = request.result;
        if (result) {
          // Update last accessed
          result.lastAccessed = Date.now();
          store.put(result);
        }
        resolve(result || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Implement LRU eviction
   */
  private async evictLRU(neededSpace: number): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([EVENTS_STORE], 'readwrite');
    const store = transaction.objectStore(EVENTS_STORE);
    const index = store.index('lastAccessed');

    let evictedSize = 0;
    let evictedCount = 0;

    return new Promise((resolve, reject) => {
      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && evictedSize < neededSpace) {
          const persistedEvent: PersistedEvent = cursor.value;
          evictedSize += persistedEvent.size;
          evictedCount++;

          cursor.delete();
          cursor.continue();
        } else {
          this.metadata.evictionCount += evictedCount;
          this.metadata.totalEvents -= evictedCount;
          this.metadata.totalSize -= evictedSize;
          this.saveMetadata();
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if eviction is needed
   */
  private async needsEviction(additionalSize: number): Promise<boolean> {
    if (this.metadata.totalEvents >= this.config.maxEvents!) {
      return true;
    }

    if (this.metadata.totalSize + additionalSize > this.config.maxSizeBytes!) {
      return true;
    }

    return false;
  }

  /**
   * Calculate event size in bytes
   */
  private calculateEventSize(event: NostrEvent): number {
    return new Blob([JSON.stringify(event)]).size;
  }

  /**
   * Compress event (placeholder - implement actual compression)
   */
  private async compressEvent(event: NostrEvent): Promise<any> {
    // In production, use CompressionStream or pako library
    return event;
  }

  /**
   * Decompress event (placeholder - implement actual decompression)
   */
  private async decompressEvent(compressed: any): Promise<NostrEvent> {
    // In production, use DecompressionStream or pako library
    return compressed;
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
    if (filter.ids && !filter.ids.includes(event.id)) return false;
    if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
    if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
    if (filter.since && event.created_at < filter.since) return false;
    if (filter.until && event.created_at > filter.until) return false;

    // Check tags
    if (filter['#e']) {
      const eTags = event.tags.filter(t => t[0] === 'e').map(t => t[1]);
      if (!filter['#e'].some(id => eTags.includes(id))) return false;
    }

    if (filter['#p']) {
      const pTags = event.tags.filter(t => t[0] === 'p').map(t => t[1]);
      if (!filter['#p'].some(id => pTags.includes(id))) return false;
    }

    return true;
  }

  /**
   * Load metadata from IndexedDB
   */
  private async loadMetadata(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([METADATA_STORE], 'readonly');
    const store = transaction.objectStore(METADATA_STORE);

    return new Promise((resolve) => {
      const request = store.get('metadata');

      request.onsuccess = () => {
        if (request.result) {
          this.metadata = request.result;
        }
        resolve();
      };

      request.onerror = () => resolve();
    });
  }

  /**
   * Save metadata to IndexedDB
   */
  private async saveMetadata(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);

    store.put({ ...this.metadata, id: 'metadata' });
  }

  /**
   * Restore cache from disk on startup
   */
  private async restoreFromDisk(): Promise<void> {
    // Load most recently accessed events into memory cache
    const recentEvents = await this.queryPersistedEvents({
      limit: 100,
    });

    // Populate memory cache
    for (const event of recentEvents) {
      await this.cacheService.set(event, { persist: false });
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.saveTimer = setInterval(() => {
      this.flushPendingSaves();
    }, this.config.autoSaveInterval!);
  }

  /**
   * Flush pending saves
   */
  private async flushPendingSaves(): Promise<void> {
    if (this.pendingSaves.size === 0) return;

    const events = Array.from(this.pendingSaves).map(id =>
      this.cacheService.get(id)
    );

    const validEvents = events.filter((e): e is NostrEvent => e !== null);

    if (validEvents.length > 0) {
      await this.persistBatch(validEvents);
    }

    this.pendingSaves.clear();
  }

  /**
   * Get cache statistics
   */
  public getStatistics(): {
    totalEvents: number;
    totalSize: number;
    evictionCount: number;
    averageEventSize: number;
    cacheEfficiency: number;
  } {
    const avgSize = this.metadata.totalEvents > 0
      ? this.metadata.totalSize / this.metadata.totalEvents
      : 0;

    const efficiency = this.metadata.totalEvents > 0
      ? 1 - (this.metadata.evictionCount / (this.metadata.totalEvents + this.metadata.evictionCount))
      : 0;

    return {
      totalEvents: this.metadata.totalEvents,
      totalSize: this.metadata.totalSize,
      evictionCount: this.metadata.evictionCount,
      averageEventSize: avgSize,
      cacheEfficiency: efficiency,
    };
  }

  /**
   * Clear all persisted data
   */
  public async clearAll(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(
      [EVENTS_STORE, PROFILES_STORE, METADATA_STORE],
      'readwrite'
    );

    const clearPromises = [
      transaction.objectStore(EVENTS_STORE).clear(),
      transaction.objectStore(PROFILES_STORE).clear(),
      transaction.objectStore(METADATA_STORE).clear(),
    ];

    await Promise.all(clearPromises.map(req =>
      new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(undefined);
        req.onerror = () => reject(req.error);
      })
    ));

    // Reset metadata
    this.metadata = {
      version: DB_VERSION,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      totalEvents: 0,
      totalSize: 0,
      evictionCount: 0,
    };
  }

  /**
   * Cleanup on shutdown
   */
  public cleanup(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }

    // Reset the singleton so subsequent getInstance() calls create a fresh instance
    if (CachePersistenceService.instance === this) {
      CachePersistenceService.instance = null;
    }

    this.flushPendingSaves();

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * Lazy singleton accessor — avoids eager IndexedDB initialization on import
 */
let _cachePersistence: CachePersistenceService | null = null;
export function getCachePersistence(): CachePersistenceService {
  if (!_cachePersistence) {
    _cachePersistence = CachePersistenceService.getInstance();
  }
  return _cachePersistence;
}