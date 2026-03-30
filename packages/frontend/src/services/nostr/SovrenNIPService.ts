/**
 * 🎯 SOVREN NIP SERVICE
 *
 * US-320: Custom Sovren NOSTR Extensions - Service Layer
 * Epic 003 Wave 5: NOSTR Consolidation
 *
 * Service for publishing and fetching Sovren-specific NOSTR events.
 * Handles custom event kinds 30078-30082 for creator monetization,
 * analytics, subscriptions, and AI-powered recommendations.
 *
 * Features:
 * - Creator profile management with extended metadata
 * - Content monetization settings and paywall configuration
 * - Analytics event tracking and aggregation
 * - Subscription tier management
 * - AI-powered content recommendations
 * - Type-safe event publishing with Zod validation
 * - Comprehensive error handling
 *
 * @author Sovren Development Team
 * @since Epic 003 Wave 5
 */
import {
  SovrenEventKindEnum as SovrenEventKind,
  type CreatorProfileExtendedContent,
  type ContentMonetizationContent,
  type AnalyticsEventContent,
  type SubscriptionManagementContent,
  type ContentRecommendationsContent,
  type CreatorProfileExtendedEvent,
  type ContentMonetizationEvent,
  type AnalyticsEvent,
  type SubscriptionManagementEvent,
  type ContentRecommendationsEvent,
  parseCreatorProfileExtended,
  parseContentMonetization,
  parseAnalyticsEvent,
  parseSubscriptionManagement,
  parseContentRecommendations,
  buildCreatorProfileExtendedTemplate,
  buildContentMonetizationTemplate,
  buildAnalyticsEventTemplate,
  buildSubscriptionManagementTemplate,
  buildContentRecommendationsTemplate,
} from '@shared/types/nostr/index';
import type { NostrEvent } from '@shared/types/nostr/index';
import { EventPublisherService } from './EventPublisherService';
import { KeyManagementService } from './KeyManagementService';
import { RelayPoolManager } from './RelayPoolManager';
import { EventCacheService } from './EventCacheService';
import type { Filter } from 'nostr-tools';
/**
 * Result type for fetching Sovren events
 */
export interface SovrenEventResult<T> {
  success: boolean;
  data?: T;
  event?: NostrEvent;
  error?: string;
  cached?: boolean;
  relay?: string;
}
/**
 * Batch result for multiple events
 */
export interface SovrenBatchResult<T> {
  success: boolean;
  results: Array<SovrenEventResult<T>>;
  totalCount: number;
  successCount: number;
  errorCount: number;
}
/**
 * Service configuration
 */
export interface SovrenNIPServiceConfig {
  /** Enable event caching */
  enableCache?: boolean;
  /** Cache TTL in seconds */
  cacheTTL?: number;
  /** Enable automatic retry on publish failure */
  enableRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Timeout for fetch operations (ms) */
  fetchTimeout?: number;
  /** Enable strict validation */
  strictValidation?: boolean;
}
/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<SovrenNIPServiceConfig> = {
  enableCache: true,
  cacheTTL: 3600, // 1 hour
  enableRetry: true,
  maxRetries: 3,
  fetchTimeout: 15000, // 15 seconds
  strictValidation: true,
};
/**
 * Sovren NIP Service
 * Manages custom Sovren NOSTR event kinds
 */
export class SovrenNIPService {
  private config: Required<SovrenNIPServiceConfig>;
  private publisher: EventPublisherService;
  private keyManager: KeyManagementService;
  private relayPool: RelayPoolManager;
  private cache: EventCacheService;
  constructor(
    publisher: EventPublisherService,
    keyManager: KeyManagementService,
    relayPool: RelayPoolManager,
    cache: EventCacheService,
    config: SovrenNIPServiceConfig = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.publisher = publisher;
    this.keyManager = keyManager;
    this.relayPool = relayPool;
    this.cache = cache;
  }
  // ========================================
  // CREATOR PROFILE EXTENDED (Kind 30078)
  // ========================================
  /**
   * Publish creator profile with extended metadata
   *
   * @param profile - Creator profile content
   * @returns Publish result with event details
   *
   * @example
   * ```typescript
   * const result = await sovrenNIP.publishCreatorProfile({
   *   displayName: 'Alice Creator',
   *   bio: 'Tech educator and content creator',
   *   avatar: 'https://example.com/avatar.jpg',
   *   categories: [CreatorCategory.TECHNOLOGY],
   *   lightningAddress: 'alice@getalby.com',
   *   links: [
   *     { platform: SocialPlatform.TWITTER, url: 'https://twitter.com/alice' }
   *   ],
   *   paymentMethods: [
   *     { type: 'lightning', address: 'alice@getalby.com', preferred: true }
   *   ],
   *   createdAt: Date.now() / 1000,
   *   updatedAt: Date.now() / 1000,
   *   version: '1.0.0',
   * });
   * ```
   */
  async publishCreatorProfile(
    profile: CreatorProfileExtendedContent
  ): Promise<SovrenEventResult<CreatorProfileExtendedEvent>> {
    try {
      // Get current user's public key
      const pubkey = await this.keyManager.getPublicKey();
      if (!pubkey) {
        throw new Error('No public key available. User must be authenticated.');
      }
      // Build event template
      const template = buildCreatorProfileExtendedTemplate(pubkey, profile);
      // Publish event
      const publishResult = await this.publisher.publishEvent(template);
      if (!publishResult.success) {
        return {
          success: false,
          error: 'Failed to publish creator profile',
        };
      }
      // Cache the event
      if (this.config.enableCache) {
        await this.cache.add(publishResult.event, {
          ttl: this.config.cacheTTL,
        });
      }
      return {
        success: true,
        data: publishResult.event as CreatorProfileExtendedEvent,
        event: publishResult.event,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  /**
   * Fetch creator profile by public key
   *
   * @param pubkey - Creator's public key
   * @returns Creator profile or null if not found
   */
  async fetchCreatorProfile(
    pubkey: string
  ): Promise<SovrenEventResult<CreatorProfileExtendedContent>> {
    try {
      // Check cache first
      if (this.config.enableCache) {
        const cached = await this.cache.get(pubkey);
        if (cached && cached.kind === SovrenEventKind.CREATOR_PROFILE_EXTENDED) {
          const content = parseCreatorProfileExtended(cached.content);
          return {
            success: true,
            data: content,
            event: cached,
            cached: true,
          };
        }
      }
      // Query relays
      const filter: Filter = {
        kinds: [SovrenEventKind.CREATOR_PROFILE_EXTENDED],
        authors: [pubkey],
        limit: 1,
      };
      const events = await this.queryEvents(filter);
      if (events.length === 0) {
        return {
          success: false,
          error: 'Creator profile not found',
        };
      }
      // Get most recent event (parameterized replaceable)
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      // Parse and validate content
      const content = parseCreatorProfileExtended(latestEvent.content);
      // Cache the event
      if (this.config.enableCache) {
        await this.cache.add(latestEvent, {
          ttl: this.config.cacheTTL,
        });
      }
      return {
        success: true,
        data: content,
        event: latestEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  // ========================================
  // CONTENT MONETIZATION (Kind 30079)
  // ========================================
  /**
   * Publish content monetization settings
   *
   * @param contentId - Unique content identifier
   * @param settings - Monetization configuration
   * @returns Publish result
   */
  async publishMonetizationSettings(
    contentId: string,
    settings: ContentMonetizationContent
  ): Promise<SovrenEventResult<ContentMonetizationEvent>> {
    try {
      const pubkey = await this.keyManager.getPublicKey();
      if (!pubkey) {
        throw new Error('No public key available');
      }
      const template = buildContentMonetizationTemplate(pubkey, contentId, settings);
      const publishResult = await this.publisher.publishEvent(template);
      if (!publishResult.success) {
        return {
          success: false,
          error: 'Failed to publish monetization settings',
        };
      }
      if (this.config.enableCache) {
        await this.cache.add(publishResult.event, {
          ttl: this.config.cacheTTL,
        });
      }
      return {
        success: true,
        data: publishResult.event as ContentMonetizationEvent,
        event: publishResult.event,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  /**
   * Fetch monetization settings for specific content
   *
   * @param contentId - Content identifier
   * @param pubkey - Optional creator pubkey (for filtering)
   * @returns Monetization settings or null
   */
  async fetchMonetizationSettings(
    contentId: string,
    pubkey?: string
  ): Promise<SovrenEventResult<ContentMonetizationContent>> {
    try {
      const filter: Filter = {
        kinds: [SovrenEventKind.CONTENT_MONETIZATION],
        '#d': [contentId],
        limit: 1,
      };
      if (pubkey) {
        filter.authors = [pubkey];
      }
      const events = await this.queryEvents(filter);
      if (events.length === 0) {
        return {
          success: false,
          error: 'Monetization settings not found',
        };
      }
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      const content = parseContentMonetization(latestEvent.content);
      return {
        success: true,
        data: content,
        event: latestEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  // ========================================
  // ANALYTICS EVENT (Kind 30080)
  // ========================================
  /**
   * Track analytics event
   *
   * @param analyticsId - Unique analytics event identifier
   * @param analyticsData - Analytics metrics
   * @returns Publish result
   */
  async trackAnalyticsEvent(
    analyticsId: string,
    analyticsData: AnalyticsEventContent
  ): Promise<SovrenEventResult<AnalyticsEvent>> {
    try {
      const pubkey = await this.keyManager.getPublicKey();
      if (!pubkey) {
        throw new Error('No public key available');
      }
      const template = buildAnalyticsEventTemplate(pubkey, analyticsId, analyticsData);
      const publishResult = await this.publisher.publishEvent(template);
      if (!publishResult.success) {
        return {
          success: false,
          error: 'Failed to publish analytics event',
        };
      }
      // Cache analytics with shorter TTL (analytics are time-sensitive)
      if (this.config.enableCache) {
        await this.cache.add(publishResult.event, {
          ttl: 1800, // 30 minutes
        });
      }
      return {
        success: true,
        data: publishResult.event as AnalyticsEvent,
        event: publishResult.event,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  /**
   * Fetch analytics for specific content
   *
   * @param contentId - Content identifier
   * @param options - Query options
   * @returns Analytics events
   */
  async fetchAnalytics(
    contentId: string,
    options?: {
      pubkey?: string;
      since?: number;
      until?: number;
      limit?: number;
    }
  ): Promise<SovrenBatchResult<AnalyticsEventContent>> {
    try {
      const filter: Filter = {
        kinds: [SovrenEventKind.ANALYTICS_EVENT],
        '#content': [contentId],
        limit: options?.limit || 50,
      };
      if (options?.pubkey) {
        filter.authors = [options.pubkey];
      }
      if (options?.since) {
        filter.since = options.since;
      }
      if (options?.until) {
        filter.until = options.until;
      }
      const events = await this.queryEvents(filter);
      const results = events.map((event) => {
        try {
          const content = parseAnalyticsEvent(event.content);
          return {
            success: true,
            data: content,
            event,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Parse error',
          };
        }
      });
      const successCount = results.filter((r) => r.success).length;
      return {
        success: true,
        results,
        totalCount: results.length,
        successCount,
        errorCount: results.length - successCount,
      };
    } catch (error) {
      return {
        success: false,
        results: [],
        totalCount: 0,
        successCount: 0,
        errorCount: 0,
      };
    }
  }
  // ========================================
  // SUBSCRIPTION MANAGEMENT (Kind 30081)
  // ========================================
  /**
   * Publish subscription tier information
   *
   * @param subscriptionInfo - Subscription configuration
   * @returns Publish result
   */
  async publishSubscriptionInfo(
    subscriptionInfo: SubscriptionManagementContent
  ): Promise<SovrenEventResult<SubscriptionManagementEvent>> {
    try {
      const pubkey = await this.keyManager.getPublicKey();
      if (!pubkey) {
        throw new Error('No public key available');
      }
      const template = buildSubscriptionManagementTemplate(pubkey, subscriptionInfo);
      const publishResult = await this.publisher.publishEvent(template);
      if (!publishResult.success) {
        return {
          success: false,
          error: 'Failed to publish subscription info',
        };
      }
      if (this.config.enableCache) {
        await this.cache.add(publishResult.event, {
          ttl: this.config.cacheTTL,
        });
      }
      return {
        success: true,
        data: publishResult.event as SubscriptionManagementEvent,
        event: publishResult.event,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  /**
   * Fetch subscription tiers for a creator
   *
   * @param pubkey - Creator's public key
   * @returns Subscription management info
   */
  async fetchSubscriptionInfo(
    pubkey: string
  ): Promise<SovrenEventResult<SubscriptionManagementContent>> {
    try {
      const filter: Filter = {
        kinds: [SovrenEventKind.SUBSCRIPTION_MANAGEMENT],
        authors: [pubkey],
        limit: 1,
      };
      const events = await this.queryEvents(filter);
      if (events.length === 0) {
        return {
          success: false,
          error: 'Subscription info not found',
        };
      }
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      const content = parseSubscriptionManagement(latestEvent.content);
      return {
        success: true,
        data: content,
        event: latestEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  // ========================================
  // CONTENT RECOMMENDATIONS (Kind 30082)
  // ========================================
  /**
   * Publish AI-generated content recommendations
   *
   * @param targetPubkey - User receiving recommendations
   * @param recommendations - Recommendation data
   * @returns Publish result
   */
  async publishRecommendations(
    targetPubkey: string,
    recommendations: ContentRecommendationsContent
  ): Promise<SovrenEventResult<ContentRecommendationsEvent>> {
    try {
      const pubkey = await this.keyManager.getPublicKey();
      if (!pubkey) {
        throw new Error('No public key available');
      }
      const template = buildContentRecommendationsTemplate(pubkey, targetPubkey, recommendations);
      const publishResult = await this.publisher.publishEvent(template);
      if (!publishResult.success) {
        return {
          success: false,
          error: 'Failed to publish recommendations',
        };
      }
      // Cache recommendations with shorter TTL (they expire quickly)
      if (this.config.enableCache) {
        const ttl = Math.min(
          recommendations.expiresAt - Math.floor(Date.now() / 1000),
          this.config.cacheTTL
        );
        await this.cache.add(publishResult.event, { ttl });
      }
      return {
        success: true,
        data: publishResult.event as ContentRecommendationsEvent,
        event: publishResult.event,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  /**
   * Fetch personalized recommendations for user
   *
   * @param targetPubkey - User's public key
   * @returns Latest recommendations
   */
  async fetchRecommendations(
    targetPubkey: string
  ): Promise<SovrenEventResult<ContentRecommendationsContent>> {
    try {
      const filter: Filter = {
        kinds: [SovrenEventKind.CONTENT_RECOMMENDATIONS],
        '#p': [targetPubkey],
        limit: 1,
      };
      const events = await this.queryEvents(filter);
      if (events.length === 0) {
        return {
          success: false,
          error: 'No recommendations found',
        };
      }
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      const content = parseContentRecommendations(latestEvent.content);
      // Check if recommendations are expired
      if (content.expiresAt < Math.floor(Date.now() / 1000)) {
        return {
          success: false,
          error: 'Recommendations have expired',
        };
      }
      return {
        success: true,
        data: content,
        event: latestEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  // ========================================
  // HELPER METHODS
  // ========================================
  /**
   * Query events from relays with timeout
   *
   * @param filter - NOSTR filter
   * @returns Array of events
   */
  private async queryEvents(filter: Filter): Promise<NostrEvent[]> {
    return new Promise((resolve, reject) => {
      const events: NostrEvent[] = [];
      const timeout = setTimeout(() => {
        resolve(events);
      }, this.config.fetchTimeout);
      try {
        const subscription = this.relayPool.subscribe([filter], {
          onEvent: (event) => {
            events.push(event);
          },
          onEose: () => {
            clearTimeout(timeout);
            resolve(events);
          },
          onError: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });
        // Auto-cleanup after timeout
        setTimeout(() => {
          try {
            this.relayPool.unsubscribe(subscription.id);
          } catch (error) {
            // Ignore cleanup errors
          }
        }, this.config.fetchTimeout + 1000);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  /**
   * Update service configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<SovrenNIPServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }
  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getConfig(): Readonly<Required<SovrenNIPServiceConfig>> {
    return { ...this.config };
  }
  /**
   * Clear all cached Sovren events
   */
  async clearCache(): Promise<void> {
    // Clear cache for all Sovren event kinds
    const sovrenKinds = [
      SovrenEventKind.CREATOR_PROFILE_EXTENDED,
      SovrenEventKind.CONTENT_MONETIZATION,
      SovrenEventKind.ANALYTICS_EVENT,
      SovrenEventKind.SUBSCRIPTION_MANAGEMENT,
      SovrenEventKind.CONTENT_RECOMMENDATIONS,
    ];
    // Note: EventCacheService doesn't have kind-specific clear,
    // so this is a placeholder for future implementation
    // In a real implementation, you'd need to add this functionality
    // to the EventCacheService
  }
}
/**
 * Create SovrenNIPService instance with default configuration
 *
 * @param publisher - Event publisher service
 * @param keyManager - Key management service
 * @param relayPool - Relay pool manager
 * @param cache - Event cache service
 * @param config - Optional configuration
 * @returns Configured SovrenNIPService instance
 */
export function createSovrenNIPService(
  publisher: EventPublisherService,
  keyManager: KeyManagementService,
  relayPool: RelayPoolManager,
  cache: EventCacheService,
  config?: SovrenNIPServiceConfig
): SovrenNIPService {
  return new SovrenNIPService(publisher, keyManager, relayPool, cache, config);
}
export default SovrenNIPService;
