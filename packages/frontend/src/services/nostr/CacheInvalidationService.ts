/**
 * 🗄️ Cache Invalidation Service
 * US-317: Implement NOSTR Caching Layer - Subtask 4
 * US-309: Remove Hardcoded Relay URLs - Subtask 4
 *
 * Intelligent cache invalidation strategy for NOSTR events
 *
 * Features:
 * - Time-based invalidation (TTL)
 * - Event-based invalidation (new events)
 * - Selective invalidation by filter
 * - Cascade invalidation for related data
 * - Cache warming for predicted queries
 */

import type { NostrEvent, NostrFilter } from '@shared/types/nostr';
import { EventCacheService } from './EventCacheService';

/**
 * Invalidation strategy types
 */
export enum InvalidationStrategy {
  /** Invalidate immediately */
  IMMEDIATE = 'immediate',
  /** Mark as stale but keep in cache */
  STALE_WHILE_REVALIDATE = 'stale-while-revalidate',
  /** Invalidate after a delay */
  DELAYED = 'delayed',
  /** Cascade to related items */
  CASCADE = 'cascade',
}

/**
 * Cache invalidation rule
 */
export interface InvalidationRule {
  /** Event kinds that trigger this rule */
  kinds?: number[];
  /** Authors whose events trigger this rule */
  authors?: string[];
  /** Tags that trigger this rule */
  tags?: string[][];
  /** Invalidation strategy */
  strategy: InvalidationStrategy;
  /** Delay in ms (for DELAYED strategy) */
  delay?: number;
  /** Related filters to invalidate (for CASCADE) */
  cascadeFilters?: NostrFilter[];
  /** Custom condition function */
  condition?: (event: NostrEvent) => boolean;
}

/**
 * Invalidation event metadata
 */
export interface InvalidationEvent {
  type: 'time' | 'event' | 'manual' | 'cascade';
  timestamp: number;
  reason?: string;
  sourceEvent?: NostrEvent;
  affectedFilters?: NostrFilter[];
  itemsInvalidated: number;
}

/**
 * Cache Invalidation Service
 */
export class CacheInvalidationService {
  private static instance: CacheInvalidationService | null = null;
  private cacheService: EventCacheService;
  private rules: InvalidationRule[] = [];
  private invalidationHistory: InvalidationEvent[] = [];
  private scheduledInvalidations: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.cacheService = EventCacheService.getInstance();
    this.setupDefaultRules();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CacheInvalidationService {
    if (!this.instance) {
      this.instance = new CacheInvalidationService();
    }
    return this.instance;
  }

  /**
   * Setup default invalidation rules
   */
  private setupDefaultRules(): void {
    // Profile updates invalidate profile cache
    this.addRule({
      kinds: [0], // Metadata events
      strategy: InvalidationStrategy.CASCADE,
      cascadeFilters: [{ kinds: [0] }],
    });

    // New posts invalidate feed cache
    this.addRule({
      kinds: [1], // Text notes
      strategy: InvalidationStrategy.STALE_WHILE_REVALIDATE,
    });

    // Reactions invalidate related posts
    this.addRule({
      kinds: [7], // Reactions
      strategy: InvalidationStrategy.CASCADE,
      condition: (event) => {
        // Get 'e' tags for event references
        const eTags = event.tags.filter(tag => tag[0] === 'e');
        return eTags.length > 0;
      },
    });

    // Deletions immediately invalidate
    this.addRule({
      kinds: [5], // Deletion events
      strategy: InvalidationStrategy.IMMEDIATE,
    });

    // Contact lists invalidate follow-related caches
    this.addRule({
      kinds: [3], // Contact lists
      strategy: InvalidationStrategy.CASCADE,
      cascadeFilters: [{ kinds: [3] }],
    });
  }

  /**
   * Add invalidation rule
   */
  public addRule(rule: InvalidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Process new event for cache invalidation
   */
  public async processNewEvent(event: NostrEvent): Promise<void> {
    const applicableRules = this.findApplicableRules(event);

    for (const rule of applicableRules) {
      await this.applyRule(rule, event);
    }
  }

  /**
   * Find rules that apply to an event
   */
  private findApplicableRules(event: NostrEvent): InvalidationRule[] {
    return this.rules.filter(rule => {
      // Check event kind
      if (rule.kinds && !rule.kinds.includes(event.kind)) {
        return false;
      }

      // Check author
      if (rule.authors && !rule.authors.includes(event.pubkey)) {
        return false;
      }

      // Check tags
      if (rule.tags) {
        const eventTags = event.tags.map(tag => tag.join(':'));
        const ruleTags = rule.tags.map(tag => tag.join(':'));
        const hasMatchingTag = ruleTags.some(ruleTag =>
          eventTags.includes(ruleTag)
        );
        if (!hasMatchingTag) return false;
      }

      // Check custom condition
      if (rule.condition && !rule.condition(event)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Apply invalidation rule
   */
  private async applyRule(rule: InvalidationRule, event: NostrEvent): Promise<void> {
    switch (rule.strategy) {
      case InvalidationStrategy.IMMEDIATE:
        await this.invalidateImmediate(event);
        break;

      case InvalidationStrategy.STALE_WHILE_REVALIDATE:
        await this.markStale(event);
        break;

      case InvalidationStrategy.DELAYED:
        await this.scheduleInvalidation(event, rule.delay || 5000);
        break;

      case InvalidationStrategy.CASCADE:
        await this.cascadeInvalidation(event, rule.cascadeFilters || []);
        break;
    }
  }

  /**
   * Immediate invalidation
   */
  private async invalidateImmediate(event: NostrEvent): Promise<void> {
    const filters = this.getAffectedFilters(event);
    let itemsInvalidated = 0;

    for (const filter of filters) {
      const result = await this.cacheService.invalidateByFilter(filter);
      itemsInvalidated += result.invalidatedCount;
    }

    this.recordInvalidation({
      type: 'event',
      timestamp: Date.now(),
      sourceEvent: event,
      affectedFilters: filters,
      itemsInvalidated,
    });
  }

  /**
   * Mark cache entries as stale
   */
  private async markStale(event: NostrEvent): Promise<void> {
    const filters = this.getAffectedFilters(event);

    for (const filter of filters) {
      await this.cacheService.markStaleByFilter(filter);
    }
  }

  /**
   * Schedule delayed invalidation
   */
  private async scheduleInvalidation(
    event: NostrEvent,
    delay: number
  ): Promise<void> {
    const key = `${event.id}-${Date.now()}`;

    const timeout = setTimeout(async () => {
      await this.invalidateImmediate(event);
      this.scheduledInvalidations.delete(key);
    }, delay);

    this.scheduledInvalidations.set(key, timeout);
  }

  /**
   * Cascade invalidation to related data
   */
  private async cascadeInvalidation(
    event: NostrEvent,
    cascadeFilters: NostrFilter[]
  ): Promise<void> {
    // Invalidate primary event
    await this.invalidateImmediate(event);

    // Invalidate cascaded filters
    let totalInvalidated = 0;
    for (const filter of cascadeFilters) {
      const result = await this.cacheService.invalidateByFilter(filter);
      totalInvalidated += result.invalidatedCount;
    }

    this.recordInvalidation({
      type: 'cascade',
      timestamp: Date.now(),
      sourceEvent: event,
      affectedFilters: cascadeFilters,
      itemsInvalidated: totalInvalidated,
    });
  }

  /**
   * Get filters affected by an event
   */
  private getAffectedFilters(event: NostrEvent): NostrFilter[] {
    const filters: NostrFilter[] = [];

    // Events of the same kind
    filters.push({ kinds: [event.kind] });

    // Events from the same author
    filters.push({ authors: [event.pubkey] });

    // Events with referenced IDs
    const eTags = event.tags.filter(tag => tag[0] === 'e');
    if (eTags.length > 0) {
      filters.push({ ids: eTags.map(tag => tag[1]) });
    }

    // Events with referenced pubkeys
    const pTags = event.tags.filter(tag => tag[0] === 'p');
    if (pTags.length > 0) {
      filters.push({ authors: pTags.map(tag => tag[1]) });
    }

    return filters;
  }

  /**
   * Invalidate all cache entries
   */
  public async invalidateAll(reason?: string): Promise<void> {
    const result = await this.cacheService.clear();

    this.recordInvalidation({
      type: 'manual',
      timestamp: Date.now(),
      reason: reason || 'Manual cache clear',
      itemsInvalidated: result.clearedCount,
    });
  }

  /**
   * Invalidate by age
   */
  public async invalidateByAge(maxAge: number): Promise<void> {
    const cutoff = Date.now() - maxAge;
    const result = await this.cacheService.invalidateOlderThan(cutoff);

    this.recordInvalidation({
      type: 'time',
      timestamp: Date.now(),
      reason: `Age-based invalidation (>${maxAge}ms)`,
      itemsInvalidated: result.invalidatedCount,
    });
  }

  /**
   * Record invalidation event
   */
  private recordInvalidation(event: InvalidationEvent): void {
    this.invalidationHistory.push(event);

    // Keep only last 100 events
    if (this.invalidationHistory.length > 100) {
      this.invalidationHistory = this.invalidationHistory.slice(-100);
    }
  }

  /**
   * Get invalidation history
   */
  public getInvalidationHistory(): InvalidationEvent[] {
    return [...this.invalidationHistory];
  }

  /**
   * Get invalidation statistics
   */
  public getStatistics(): {
    totalInvalidations: number;
    byType: Record<string, number>;
    averageItemsPerInvalidation: number;
    lastInvalidation?: InvalidationEvent;
  } {
    const byType: Record<string, number> = {};
    let totalItems = 0;

    for (const event of this.invalidationHistory) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      totalItems += event.itemsInvalidated;
    }

    return {
      totalInvalidations: this.invalidationHistory.length,
      byType,
      averageItemsPerInvalidation:
        this.invalidationHistory.length > 0
          ? totalItems / this.invalidationHistory.length
          : 0,
      lastInvalidation: this.invalidationHistory[this.invalidationHistory.length - 1],
    };
  }

  /**
   * Clear all scheduled invalidations
   */
  public clearScheduled(): void {
    for (const timeout of this.scheduledInvalidations.values()) {
      clearTimeout(timeout);
    }
    this.scheduledInvalidations.clear();
  }

  /**
   * Cleanup service
   */
  public cleanup(): void {
    this.clearScheduled();
    this.rules = [];
    this.invalidationHistory = [];
  }
}

/**
 * Export singleton instance
 */
export const cacheInvalidation = CacheInvalidationService.getInstance();