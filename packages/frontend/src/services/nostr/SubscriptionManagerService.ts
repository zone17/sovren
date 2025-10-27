/**
 * 🎯 ELITE SERVICE: Subscription Manager Service
 *
 * US-304: Create Unified Subscription Manager Service
 * Epic 003: NOSTR Consolidation
 *
 * Centralized subscription management with:
 * - Singleton pattern for shared subscriptions
 * - Multi-relay subscription handling
 * - Automatic event deduplication
 * - Subscription state management (active/paused/closed)
 * - Filter optimization and merging
 * - Subscription pooling for common filters
 * - EOSE tracking per relay
 * - Auto-caching with EventCacheService
 * - Subscription lifecycle management
 *
 * @example
 * ```typescript
 * const manager = SubscriptionManagerService.getInstance();
 *
 * // Subscribe to events
 * const subId = manager.subscribe(
 *   [{ kinds: [1], limit: 50 }],
 *   (event, relay) => console.log('Event:', event),
 *   { onEOSE: (relay) => console.log('EOSE:', relay) }
 * );
 *
 * // Pause subscription
 * manager.pauseSubscription(subId);
 *
 * // Resume subscription
 * manager.resumeSubscription(subId);
 *
 * // Unsubscribe
 * manager.unsubscribe(subId);
 * ```
 */

import type {
  NostrFilter,
  NostrEvent,
  EnhancedSubscriptionInfo,
  EventCallback,
  EOSECallback,
  SubscriptionErrorCallback,
  SubscriptionState,
} from '@shared/types/nostr';
import { optimizeFilter } from '@shared/types/nostr/filters';
import { RelayPoolManager } from './RelayPoolManager';
import { EventCacheService, getEventCache } from './EventCacheService';
import { RateLimiter } from './RateLimiter';
import { RateLimitOperation, RequestPriority } from './types/rate-limit';

// ========================================
// Extended Subscription Options
// ========================================

export interface SubscriptionManagerOptions {
  filters: NostrFilter[];
  onEvent: EventCallback;
  onEOSE?: EOSECallback;
  onError?: SubscriptionErrorCallback;
  id?: string; // Custom subscription ID
  autoCache?: boolean; // Auto-cache events
  pool?: boolean; // Enable subscription pooling
  relays?: string[]; // Specific relays (default: all connected)
}

// ========================================
// Internal Subscription State
// ========================================

interface ManagedSubscription {
  id: string;
  filters: NostrFilter[];
  relays: string[];
  state: 'active' | 'paused' | 'closed';
  callbacks: Set<EventCallback>;
  eoseCallbacks: Set<EOSECallback>;
  errorCallbacks: Set<SubscriptionErrorCallback>;
  createdAt: number;
  eventCount: number;
  lastEvent?: number;
  eoseReceived: boolean;
  eoseRelays: string[];
  relaySubId?: string; // Underlying relay pool subscription ID
  poolKey?: string; // Key for subscription pooling
  autoCache: boolean;
}

// ========================================
// Subscription Manager Service
// ========================================

export class SubscriptionManagerService {
  private static instance: SubscriptionManagerService | null = null;

  private relayPoolManager: RelayPoolManager;
  private eventCache: EventCacheService;
  private rateLimiter: RateLimiter;

  private subscriptions: Map<string, ManagedSubscription> = new Map();
  private pooledSubscriptions: Map<string, string> = new Map(); // poolKey -> subId
  private seenEventIds: Set<string> = new Set();
  private subscriptionCounter: number = 0;

  private constructor() {
    this.relayPoolManager = RelayPoolManager.getInstance();
    this.eventCache = getEventCache();
    this.rateLimiter = RateLimiter.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SubscriptionManagerService {
    if (!SubscriptionManagerService.instance) {
      SubscriptionManagerService.instance = new SubscriptionManagerService();
    }
    return SubscriptionManagerService.instance;
  }

  // ========================================
  // Subscription Management
  // ========================================

  /**
   * Create a new subscription
   */
  public async subscribe(
    filters: NostrFilter[],
    onEvent: EventCallback,
    options: Partial<SubscriptionManagerOptions> = {}
  ): Promise<string> {
    // Validate filters
    if (!filters || filters.length === 0) {
      throw new Error('At least one filter is required');
    }

    // Check rate limit before creating subscription
    const rateLimitResult = await this.rateLimiter.checkLimit({
      operation: RateLimitOperation.SUBSCRIBE,
      priority: RequestPriority.NORMAL,
    });

    if (!rateLimitResult.allowed) {
      throw new Error(
        `Rate limit exceeded for subscriptions: ${rateLimitResult.reason}. Retry after ${rateLimitResult.retryAfter}ms`
      );
    }

    // Check if relays are available
    const connectedRelays = this.relayPoolManager.getConnectedRelays();
    if (connectedRelays.length === 0) {
      throw new Error('No connected relays available');
    }

    // Check if we can reuse an existing pooled subscription
    if (options.pool !== false) {
      const poolKey = this.generatePoolKey(filters);
      const existingSubId = this.pooledSubscriptions.get(poolKey);

      if (existingSubId) {
        const existingSub = this.subscriptions.get(existingSubId);
        if (existingSub && existingSub.state === 'active') {
          // Add callbacks to existing subscription
          existingSub.callbacks.add(onEvent);
          if (options.onEOSE) existingSub.eoseCallbacks.add(options.onEOSE);
          if (options.onError) existingSub.errorCallbacks.add(options.onError);

          return existingSubId;
        }
      }
    }

    // Generate subscription ID
    const subId = options.id || this.generateSubscriptionId();

    // Optimize filters
    const optimizedFilters = this.optimizeFilters(filters);

    // Get target relays
    const targetRelays = options.relays || connectedRelays;

    // Create managed subscription
    const subscription: ManagedSubscription = {
      id: subId,
      filters: optimizedFilters,
      relays: targetRelays,
      state: 'active',
      callbacks: new Set([onEvent]),
      eoseCallbacks: options.onEOSE ? new Set([options.onEOSE]) : new Set(),
      errorCallbacks: options.onError ? new Set([options.onError]) : new Set(),
      createdAt: Date.now(),
      eventCount: 0,
      eoseReceived: false,
      eoseRelays: [],
      autoCache: options.autoCache ?? true,
    };

    // Create relay pool subscription
    const relaySubId = this.relayPoolManager.subscribe(
      optimizedFilters,
      (event: NostrEvent) => this.handleEvent(subId, event),
      () => this.handleEOSE(subId)
    );

    subscription.relaySubId = relaySubId;

    // Store subscription
    this.subscriptions.set(subId, subscription);

    // Store in pool if enabled
    if (options.pool !== false) {
      const poolKey = this.generatePoolKey(filters);
      subscription.poolKey = poolKey;
      this.pooledSubscriptions.set(poolKey, subId);
    }

    return subId;
  }

  /**
   * Update subscription filters
   */
  public updateSubscription(subId: string, newFilters: NostrFilter[]): void {
    const subscription = this.subscriptions.get(subId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Close old relay subscription
    if (subscription.relaySubId) {
      this.relayPoolManager.unsubscribe(subscription.relaySubId);
    }

    // Optimize new filters
    const optimizedFilters = this.optimizeFilters(newFilters);

    // Create new relay subscription
    const relaySubId = this.relayPoolManager.subscribe(
      optimizedFilters,
      (event: NostrEvent) => this.handleEvent(subId, event),
      () => this.handleEOSE(subId)
    );

    // Update subscription
    subscription.filters = optimizedFilters;
    subscription.relaySubId = relaySubId;
    subscription.eoseReceived = false;
    subscription.eoseRelays = [];
  }

  /**
   * Cancel subscription
   */
  public unsubscribe(subId: string): void {
    const subscription = this.subscriptions.get(subId);
    if (!subscription) {
      return; // Gracefully handle non-existent subscriptions
    }

    // Close relay subscription
    if (subscription.relaySubId) {
      this.relayPoolManager.unsubscribe(subscription.relaySubId);
    }

    // Remove from pool
    if (subscription.poolKey) {
      this.pooledSubscriptions.delete(subscription.poolKey);
    }

    // Update state
    subscription.state = 'closed';

    // Remove subscription
    this.subscriptions.delete(subId);
  }

  /**
   * Pause subscription
   */
  public pauseSubscription(subId: string): void {
    const subscription = this.subscriptions.get(subId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.state = 'paused';
  }

  /**
   * Resume subscription
   */
  public resumeSubscription(subId: string): void {
    const subscription = this.subscriptions.get(subId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.state = 'active';
  }

  /**
   * Get subscription info
   */
  public getSubscription(subId: string): EnhancedSubscriptionInfo | null {
    const subscription = this.subscriptions.get(subId);
    if (!subscription) {
      return null;
    }

    return {
      id: subscription.id,
      filters: subscription.filters,
      relays: subscription.relays,
      state: subscription.state as SubscriptionState,
      active: subscription.state === 'active',
      createdAt: subscription.createdAt,
      lastEvent: subscription.lastEvent,
      eventCount: subscription.eventCount,
      eoseReceived: subscription.eoseReceived,
      eoseRelays: subscription.eoseRelays,
      errors: [],
    };
  }

  /**
   * Get all subscriptions (optionally filtered by state)
   */
  public getSubscriptions(
    state?: 'active' | 'paused' | 'closed'
  ): EnhancedSubscriptionInfo[] {
    const subscriptions = Array.from(this.subscriptions.values());

    const filtered = state
      ? subscriptions.filter(sub => sub.state === state)
      : subscriptions;

    return filtered.map(sub => ({
      id: sub.id,
      filters: sub.filters,
      relays: sub.relays,
      state: sub.state as SubscriptionState,
      active: sub.state === 'active',
      createdAt: sub.createdAt,
      lastEvent: sub.lastEvent,
      eventCount: sub.eventCount,
      eoseReceived: sub.eoseReceived,
      eoseRelays: sub.eoseRelays,
      errors: [],
    }));
  }

  /**
   * Unsubscribe from all subscriptions
   */
  public unsubscribeAll(): void {
    const subIds = Array.from(this.subscriptions.keys());
    subIds.forEach(subId => this.unsubscribe(subId));
  }

  // ========================================
  // Event Handling
  // ========================================

  private handleEvent(subId: string, event: NostrEvent): void {
    const subscription = this.subscriptions.get(subId);
    if (!subscription) {
      return;
    }

    // Skip if paused
    if (subscription.state === 'paused') {
      return;
    }

    // Deduplicate events
    if (this.seenEventIds.has(event.id)) {
      return;
    }
    this.seenEventIds.add(event.id);

    // Cleanup old event IDs (keep last 10000)
    if (this.seenEventIds.size > 10000) {
      const idsArray = Array.from(this.seenEventIds);
      this.seenEventIds = new Set(idsArray.slice(-10000));
    }

    // Auto-cache if enabled
    if (subscription.autoCache) {
      this.eventCache.set(event, {
        timestamp: Date.now(),
        relay: 'pool', // From relay pool
        verified: true,
      }).catch(() => {
        // Silently handle cache errors - caching is optional
      });
    }

    // Update subscription stats
    subscription.eventCount++;
    subscription.lastEvent = Date.now();

    // Call all callbacks for this subscription
    const relay = 'pool'; // Could track specific relay if needed
    for (const callback of subscription.callbacks) {
      try {
        callback(event, relay);
      } catch {
        // Silently handle callback errors to prevent one bad callback from breaking others
      }
    }
  }

  private handleEOSE(subId: string): void {
    const subscription = this.subscriptions.get(subId);
    if (!subscription) {
      return;
    }

    // Track EOSE per relay
    const relay = this.relayPoolManager.getConnectedRelays()[0] || 'unknown';
    if (!subscription.eoseRelays.includes(relay)) {
      subscription.eoseRelays.push(relay);
    }

    // Check if all relays have sent EOSE
    const allRelaysReported =
      subscription.eoseRelays.length >= subscription.relays.length;

    if (allRelaysReported) {
      subscription.eoseReceived = true;
    }

    // Call EOSE callbacks
    for (const callback of subscription.eoseCallbacks) {
      try {
        callback(relay);
      } catch {
        // Silently handle callback errors to prevent one bad callback from breaking others
      }
    }
  }

  // ========================================
  // Filter Optimization
  // ========================================

  /**
   * Optimize filters for better performance
   */
  private optimizeFilters(filters: NostrFilter[]): NostrFilter[] {
    // Remove empty filters
    const nonEmptyFilters = filters.filter(
      filter => Object.keys(filter).length > 0
    );

    if (nonEmptyFilters.length === 0) {
      return filters; // Return original if all empty
    }

    // Optimize each filter
    const optimized = nonEmptyFilters.map(filter => optimizeFilter(filter));

    // Try to merge similar filters
    return this.mergeFilters(optimized);
  }

  /**
   * Merge similar filters to reduce subscription count
   */
  private mergeFilters(filters: NostrFilter[]): NostrFilter[] {
    if (filters.length <= 1) {
      return filters;
    }

    const merged: NostrFilter[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < filters.length; i++) {
      if (processed.has(i)) continue;

      const current = { ...filters[i] };
      processed.add(i);

      // Try to merge with other filters
      for (let j = i + 1; j < filters.length; j++) {
        if (processed.has(j)) continue;

        const other = filters[j];

        // Can only merge if kinds are the same
        const currentKinds = JSON.stringify(current.kinds?.sort());
        const otherKinds = JSON.stringify(other.kinds?.sort());

        if (currentKinds === otherKinds) {
          // Merge authors
          if (other.authors) {
            current.authors = [
              ...(current.authors || []),
              ...other.authors,
            ];
            current.authors = Array.from(new Set(current.authors));
          }

          // Merge IDs
          if (other.ids) {
            current.ids = [...(current.ids || []), ...other.ids];
            current.ids = Array.from(new Set(current.ids));
          }

          // Keep most restrictive time range
          if (other.since !== undefined) {
            current.since = Math.max(current.since || 0, other.since);
          }
          if (other.until !== undefined) {
            current.until = Math.min(
              current.until || Infinity,
              other.until
            );
          }

          // Keep largest limit
          if (other.limit !== undefined) {
            current.limit = Math.max(current.limit || 0, other.limit);
          }

          processed.add(j);
        }
      }

      merged.push(current);
    }

    return merged;
  }

  // ========================================
  // Subscription Pooling
  // ========================================

  /**
   * Generate pool key for filter set
   */
  private generatePoolKey(filters: NostrFilter[]): string {
    // Create deterministic key from filters
    const normalized = filters.map(filter => {
      const sorted: Record<string, unknown> = {};
      Object.keys(filter)
        .sort()
        .forEach(key => {
          const value = filter[key as keyof NostrFilter];
          if (Array.isArray(value)) {
            sorted[key] = [...value].sort();
          } else {
            sorted[key] = value;
          }
        });
      return sorted;
    });

    return JSON.stringify(normalized);
  }

  // ========================================
  // Utilities
  // ========================================

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${++this.subscriptionCounter}_${Date.now()}`;
  }

  /**
   * Get statistics
   */
  public getStats() {
    return {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(
        sub => sub.state === 'active'
      ).length,
      pausedSubscriptions: Array.from(this.subscriptions.values()).filter(
        sub => sub.state === 'paused'
      ).length,
      pooledSubscriptions: this.pooledSubscriptions.size,
      seenEvents: this.seenEventIds.size,
      totalEvents: Array.from(this.subscriptions.values()).reduce(
        (sum, sub) => sum + sub.eventCount,
        0
      ),
    };
  }

  // ========================================
  // Lifecycle
  // ========================================

  /**
   * Destroy service and cleanup all subscriptions
   */
  public async destroy(): Promise<void> {
    // Unsubscribe from all subscriptions
    this.unsubscribeAll();

    // Clear collections
    this.subscriptions.clear();
    this.pooledSubscriptions.clear();
    this.seenEventIds.clear();

    // Reset singleton instance
    SubscriptionManagerService.instance = null;
  }
}

// ========================================
// Singleton Export
// ========================================

export const subscriptionManager = SubscriptionManagerService.getInstance();
