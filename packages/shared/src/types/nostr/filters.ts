/**
 * NOSTR Filter Types - Consolidated Type Definitions
 *
 * US-308: Consolidate NOSTR Type Definitions
 * Epic 003: NOSTR Consolidation
 *
 * Complete type definitions for NOSTR filters and subscriptions
 * Implements NIP-01 filters and subscription management
 */

import { z } from 'zod';
import type { Filter as NostrToolsFilter } from 'nostr-tools';
import type { NostrEvent } from './events';

// ========================================
// Filter Schema (NIP-01)
// ========================================

/**
 * NOSTR Filter Schema
 * Used to request specific events from relays
 */
export const NostrFilterSchema = z.object({
  ids: z.array(z.string().length(64)).optional(),
  authors: z.array(z.string().length(64)).optional(),
  kinds: z.array(z.number().int().min(0).max(40000)).optional(),
  since: z.number().int().optional(),
  until: z.number().int().optional(),
  limit: z.number().int().positive().max(5000).optional(),
  search: z.string().optional(),
  // Generic tag filters (#e, #p, #a, etc.)
  '#e': z.array(z.string()).optional(),
  '#p': z.array(z.string()).optional(),
  '#a': z.array(z.string()).optional(),
  '#d': z.array(z.string()).optional(),
  '#t': z.array(z.string()).optional(),
  '#r': z.array(z.string()).optional(),
  '#g': z.array(z.string()).optional(),
});

export type NostrFilter = z.infer<typeof NostrFilterSchema>;

// ========================================
// Filter Builder
// ========================================

/**
 * Filter Builder for constructing complex filters
 */
export class NostrFilterBuilder {
  private filter: Partial<NostrFilter> = {};

  /**
   * Filter by event IDs
   */
  ids(ids: string[]): this {
    this.filter.ids = ids;
    return this;
  }

  /**
   * Filter by authors (pubkeys)
   */
  authors(authors: string[]): this {
    this.filter.authors = authors;
    return this;
  }

  /**
   * Filter by event kinds
   */
  kinds(kinds: number[]): this {
    this.filter.kinds = kinds;
    return this;
  }

  /**
   * Filter events since timestamp
   */
  since(timestamp: number): this {
    this.filter.since = timestamp;
    return this;
  }

  /**
   * Filter events until timestamp
   */
  until(timestamp: number): this {
    this.filter.until = timestamp;
    return this;
  }

  /**
   * Limit number of events
   */
  limit(limit: number): this {
    this.filter.limit = limit;
    return this;
  }

  /**
   * Search text in events
   */
  search(query: string): this {
    this.filter.search = query;
    return this;
  }

  /**
   * Filter by event references (#e tags)
   */
  eventRefs(eventIds: string[]): this {
    this.filter['#e'] = eventIds;
    return this;
  }

  /**
   * Filter by pubkey references (#p tags)
   */
  pubkeyRefs(pubkeys: string[]): this {
    this.filter['#p'] = pubkeys;
    return this;
  }

  /**
   * Filter by hashtags (#t tags)
   */
  hashtags(tags: string[]): this {
    this.filter['#t'] = tags;
    return this;
  }

  /**
   * Filter by identifiers (#d tags)
   */
  identifiers(ids: string[]): this {
    this.filter['#d'] = ids;
    return this;
  }

  /**
   * Add custom tag filter
   */
  tag(tagName: string, values: string[]): this {
    const key = `#${tagName}` as keyof NostrFilter;
    this.filter[key] = values as never;
    return this;
  }

  /**
   * Build the filter
   */
  build(): NostrFilter {
    return this.filter as NostrFilter;
  }

  /**
   * Validate the filter
   */
  validate(): { valid: boolean; errors: string[] } {
    const result = NostrFilterSchema.safeParse(this.filter);
    if (result.success) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: result.error.issues.map(issue => issue.message),
    };
  }
}

// ========================================
// Subscription Management
// ========================================

/**
 * Subscription Information
 */
export interface SubscriptionInfo {
  id: string;
  filters: NostrFilter[];
  relays: string[];
  active: boolean;
  createdAt: number;
  eventCount: number;
  lastEvent?: number;
  eoseReceived: boolean;
  eoseRelays: string[];
}

/**
 * Subscription Options
 */
export interface SubscriptionOptions {
  filters: NostrFilter[];
  relays?: string[];
  onEvent: EventCallback;
  onEOSE?: EOSECallback;
  onError?: SubscriptionErrorCallback;
  autoUnsubscribe?: boolean;
  maxEvents?: number;
  timeout?: number;
  id?: string;  // Custom subscription ID
}

/**
 * Subscription Callbacks
 */
export type EventCallback = (event: NostrEvent, relay: string) => void | Promise<void>;
export type EOSECallback = (relay: string) => void | Promise<void>;
export type SubscriptionErrorCallback = (error: Error, relay: string) => void | Promise<void>;

/**
 * Subscription State
 */
export enum SubscriptionState {
  PENDING = 'pending',
  ACTIVE = 'active',
  CLOSING = 'closing',
  CLOSED = 'closed',
  ERROR = 'error',
}

/**
 * Enhanced Subscription Info
 */
export const SubscriptionInfoSchema = z.object({
  id: z.string().min(1),
  filters: z.array(NostrFilterSchema),
  relays: z.array(z.string().url()),
  state: z.nativeEnum(SubscriptionState),
  active: z.boolean().default(true),
  createdAt: z.number().positive(),
  lastEvent: z.number().optional(),
  eventCount: z.number().default(0),
  eoseReceived: z.boolean().default(false),
  eoseRelays: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
});

export type EnhancedSubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>;

// ========================================
// Query Options
// ========================================

/**
 * Query Options for Event Retrieval
 */
export interface QueryOptions {
  relays?: string[];
  timeout?: number;
  eoseTimeout?: number;
  maxEvents?: number;
  cacheResults?: boolean;
  skipCache?: boolean;
  verifySignatures?: boolean;
}

/**
 * Query Result
 */
export interface QueryResult {
  events: NostrEvent[];
  relays: string[];
  eose: boolean;
  cached: boolean;
  timestamp: number;
  duration: number;
  errors?: string[];
}

// ========================================
// Common Filter Patterns
// ========================================

/**
 * Common filter patterns for typical use cases
 */
export class CommonFilters {
  /**
   * Get user profile metadata
   */
  static userMetadata(pubkey: string): NostrFilter {
    return {
      authors: [pubkey],
      kinds: [0],
      limit: 1,
    };
  }

  /**
   * Get user's contact list
   */
  static userContacts(pubkey: string): NostrFilter {
    return {
      authors: [pubkey],
      kinds: [3],
      limit: 1,
    };
  }

  /**
   * Get user's text notes
   */
  static userNotes(pubkey: string, limit = 50): NostrFilter {
    return {
      authors: [pubkey],
      kinds: [1],
      limit,
    };
  }

  /**
   * Get replies to an event
   */
  static eventReplies(eventId: string, limit = 100): NostrFilter {
    return {
      kinds: [1],
      '#e': [eventId],
      limit,
    };
  }

  /**
   * Get reactions to an event
   */
  static eventReactions(eventId: string, limit = 100): NostrFilter {
    return {
      kinds: [7],
      '#e': [eventId],
      limit,
    };
  }

  /**
   * Get events mentioning a pubkey
   */
  static mentions(pubkey: string, limit = 50): NostrFilter {
    return {
      kinds: [1],
      '#p': [pubkey],
      limit,
    };
  }

  /**
   * Get direct messages between two users
   */
  static directMessages(pubkey1: string, pubkey2: string, limit = 50): NostrFilter {
    return {
      kinds: [4],
      authors: [pubkey1],
      '#p': [pubkey2],
      limit,
    };
  }

  /**
   * Get events with specific hashtags
   */
  static hashtags(tags: string[], limit = 50): NostrFilter {
    return {
      kinds: [1],
      '#t': tags,
      limit,
    };
  }

  /**
   * Get recent global feed
   */
  static globalFeed(limit = 50): NostrFilter {
    return {
      kinds: [1],
      limit,
    };
  }

  /**
   * Get events from multiple authors
   */
  static multiAuthorFeed(pubkeys: string[], limit = 50): NostrFilter {
    return {
      kinds: [1],
      authors: pubkeys,
      limit,
    };
  }

  /**
   * Get long-form content
   */
  static longFormContent(pubkey?: string, limit = 20): NostrFilter {
    return {
      kinds: [30023],
      ...(pubkey && { authors: [pubkey] }),
      limit,
    };
  }
}

// ========================================
// Filter Validation and Optimization
// ========================================

/**
 * Filter Validation Result
 */
export interface FilterValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Validate filter
 */
export function validateFilter(filter: NostrFilter): FilterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Validate with Zod schema
  const result = NostrFilterSchema.safeParse(filter);
  if (!result.success) {
    errors.push(...result.error.issues.map(issue => issue.message));
  }

  // Check for potentially expensive queries
  if (!filter.authors && !filter.ids && !filter.kinds) {
    warnings.push('Filter has no constraints - may return many events');
    suggestions.push('Consider adding authors, ids, or kinds to narrow the query');
  }

  // Check limit
  if (filter.limit && filter.limit > 1000) {
    warnings.push('Large limit may cause performance issues');
    suggestions.push('Consider using pagination with smaller limits');
  }

  // Check time range
  if (filter.since && filter.until && filter.until < filter.since) {
    errors.push('until timestamp must be greater than since timestamp');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Optimize filter for better performance
 */
export function optimizeFilter(filter: NostrFilter): NostrFilter {
  const optimized = { ...filter };

  // Remove empty arrays
  Object.keys(optimized).forEach(key => {
    const value = optimized[key as keyof NostrFilter];
    if (Array.isArray(value) && value.length === 0) {
      delete optimized[key as keyof NostrFilter];
    }
  });

  // Cap limit at reasonable maximum
  if (optimized.limit && optimized.limit > 5000) {
    optimized.limit = 5000;
  }

  // Remove duplicate values from arrays
  if (optimized.ids) {
    optimized.ids = Array.from(new Set(optimized.ids));
  }
  if (optimized.authors) {
    optimized.authors = Array.from(new Set(optimized.authors));
  }
  if (optimized.kinds) {
    optimized.kinds = Array.from(new Set(optimized.kinds));
  }

  return optimized;
}

/**
 * Check if an event matches a filter
 */
export function eventMatchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
  // Check IDs
  if (filter.ids && !filter.ids.includes(event.id)) {
    return false;
  }

  // Check authors
  if (filter.authors && !filter.authors.includes(event.pubkey)) {
    return false;
  }

  // Check kinds
  if (filter.kinds && !filter.kinds.includes(event.kind)) {
    return false;
  }

  // Check time range
  if (filter.since && event.created_at < filter.since) {
    return false;
  }
  if (filter.until && event.created_at > filter.until) {
    return false;
  }

  // Check tag filters
  const tagFilters = Object.keys(filter).filter(key => key.startsWith('#'));
  for (const tagFilter of tagFilters) {
    const tagName = tagFilter.substring(1);
    const filterValues = filter[tagFilter as keyof NostrFilter] as string[] | undefined;

    if (filterValues && filterValues.length > 0) {
      const eventTags = event.tags
        .filter(tag => tag[0] === tagName)
        .map(tag => tag[1]);

      const hasMatch = filterValues.some(value => eventTags.includes(value));
      if (!hasMatch) {
        return false;
      }
    }
  }

  return true;
}

// ========================================
// Type Compatibility
// ========================================

/**
 * Ensure compatibility with nostr-tools Filter type
 */
export type NostrToolsFilterCompat = NostrToolsFilter;

// ========================================
// Export Schemas for Validation
// ========================================

export const NostrFilterSchemas = {
  Filter: NostrFilterSchema,
  SubscriptionInfo: SubscriptionInfoSchema,
} as const;
