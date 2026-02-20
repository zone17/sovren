/**
 * 🧪 SOVREN NIP SERVICE TESTS
 *
 * US-320: Custom Sovren NOSTR Extensions - Service Tests
 * Epic 003 Wave 5: NOSTR Consolidation
 *
 * Comprehensive test suite for SovrenNIPService covering:
 * - Creator profile publishing and fetching
 * - Content monetization settings
 * - Analytics event tracking
 * - Subscription management
 * - AI-powered recommendations
 * - Error handling and edge cases
 *
 * Test Coverage Target: 95%+
 */

import { SovrenNIPService } from '../SovrenNIPService';
import {
  SovrenEventKind,
  CreatorCategory,
  SocialPlatform,
  AnalyticsEventType,
  RecommendationSource,
} from '@shared/types/nostr';
import type {
  CreatorProfileExtendedContent,
  ContentMonetizationContent,
  AnalyticsEventContent,
  SubscriptionManagementContent,
  ContentRecommendationsContent,
} from '@shared/types/nostr';

// Mock dependencies
vi.mock('../EventPublisherService');
vi.mock('../KeyManagementService');
vi.mock('../RelayPoolManager');
vi.mock('../EventCacheService');

describe('SovrenNIPService', () => {
  let service: SovrenNIPService;
  let mockPublisher: any;
  let mockKeyManager: any;
  let mockRelayPool: any;
  let mockCache: any;

  beforeEach(() => {
    // Setup mocks
    mockPublisher = {
      publishEvent: vi.fn().mockResolvedValue({
        success: true,
        event: {
          id: 'event123',
          kind: 30078,
          pubkey: 'pubkey123',
          created_at: Math.floor(Date.now() / 1000),
          content: '{}',
          tags: [],
          sig: 'signature',
        },
      }),
    };

    mockKeyManager = {
      getPublicKey: vi.fn().mockResolvedValue('pubkey123'),
    };

    mockRelayPool = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    mockCache = {
      add: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    };

    service = new SovrenNIPService(
      mockPublisher,
      mockKeyManager,
      mockRelayPool,
      mockCache,
      {
        enableCache: true,
        cacheTTL: 3600,
        strictValidation: true,
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // CREATOR PROFILE TESTS
  // ========================================

  describe('Creator Profile Extended (Kind 30078)', () => {
    const validProfile: CreatorProfileExtendedContent = {
      displayName: 'Test Creator',
      bio: 'Test bio',
      avatar: 'https://example.com/avatar.jpg',
      banner: 'https://example.com/banner.jpg',
      categories: [CreatorCategory.TECHNOLOGY],
      lightningAddress: 'test@getalby.com',
      website: 'https://example.com',
      links: [
        {
          platform: SocialPlatform.TWITTER,
          url: 'https://twitter.com/test',
          username: 'test',
          verified: false,
        },
      ],
      paymentMethods: [
        {
          type: 'lightning',
          address: 'test@getalby.com',
          preferred: true,
          enabled: true,
        },
      ],
      acceptsDonations: true,
      defaultCurrency: 'sats',
      nip05Verified: false,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
      version: '1.0.0',
    };

    it('should publish creator profile successfully', async () => {
      const result = await service.publishCreatorProfile(validProfile);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(mockPublisher.publishEvent).toHaveBeenCalledTimes(1);
      expect(mockCache.add).toHaveBeenCalledTimes(1);
    });

    it('should fail when no public key available', async () => {
      mockKeyManager.getPublicKey.mockResolvedValue(null);

      const result = await service.publishCreatorProfile(validProfile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('public key');
    });

    it('should handle publish failure gracefully', async () => {
      mockPublisher.publishEvent.mockResolvedValue({
        success: false,
      });

      const result = await service.publishCreatorProfile(validProfile);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fetch creator profile from cache', async () => {
      const cachedEvent = {
        kind: SovrenEventKind.CREATOR_PROFILE_EXTENDED,
        content: JSON.stringify(validProfile),
        id: 'cached-event',
      };

      mockCache.get.mockResolvedValue(cachedEvent);

      const result = await service.fetchCreatorProfile('pubkey123');

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(result.data).toEqual(validProfile);
    });

    it('should fetch creator profile from relays when not cached', async () => {
      // Mock relay subscription
      const mockEvent = {
        kind: SovrenEventKind.CREATOR_PROFILE_EXTENDED,
        content: JSON.stringify(validProfile),
        created_at: Math.floor(Date.now() / 1000),
        id: 'relay-event',
      };

      mockRelayPool.subscribe.mockImplementation((filters, options) => {
        setTimeout(() => {
          options.onEvent(mockEvent);
          options.onEose?.();
        }, 10);

        return { id: 'sub123' };
      });

      const result = await service.fetchCreatorProfile('pubkey123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validProfile);
      expect(result.cached).toBeUndefined();
    });
  });

  // ========================================
  // MONETIZATION TESTS
  // ========================================

  describe('Content Monetization (Kind 30079)', () => {
    const validMonetization: ContentMonetizationContent = {
      contentId: 'content-123',
      contentType: 'article',
      title: 'Test Article',
      monetizationModel: 'pay-per-view',
      paywall: {
        enabled: true,
        type: 'partial',
        previewLength: 500,
      },
      pricingTiers: [
        {
          id: 'tier-1',
          name: 'Basic',
          description: 'Basic access',
          price: 1000,
          currency: 'sats',
          interval: 'one-time',
          benefits: ['Read article'],
          enabled: true,
        },
      ],
      defaultTierId: 'tier-1',
      requiresVerification: false,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
      version: '1.0.0',
    };

    it('should publish monetization settings successfully', async () => {
      const result = await service.publishMonetizationSettings(
        'content-123',
        validMonetization
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockPublisher.publishEvent).toHaveBeenCalled();
    });

    it('should fetch monetization settings by content ID', async () => {
      const mockEvent = {
        kind: SovrenEventKind.CONTENT_MONETIZATION,
        content: JSON.stringify(validMonetization),
        created_at: Math.floor(Date.now() / 1000),
      };

      mockRelayPool.subscribe.mockImplementation((filters, options) => {
        setTimeout(() => {
          options.onEvent(mockEvent);
          options.onEose?.();
        }, 10);

        return { id: 'sub123' };
      });

      const result = await service.fetchMonetizationSettings('content-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validMonetization);
    });
  });

  // ========================================
  // ANALYTICS TESTS
  // ========================================

  describe('Analytics Event (Kind 30080)', () => {
    const validAnalytics: AnalyticsEventContent = {
      eventType: AnalyticsEventType.VIEW,
      contentId: 'content-123',
      viewCount: 100,
      uniqueViewers: 80,
      periodStart: Math.floor(Date.now() / 1000) - 3600,
      periodEnd: Math.floor(Date.now() / 1000),
      granularity: 'hourly',
      version: '1.0.0',
    };

    it('should track analytics event successfully', async () => {
      const result = await service.trackAnalyticsEvent(
        'analytics-123',
        validAnalytics
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockCache.add).toHaveBeenCalled();
    });

    it('should fetch analytics for content', async () => {
      const mockEvent = {
        kind: SovrenEventKind.ANALYTICS_EVENT,
        content: JSON.stringify(validAnalytics),
        created_at: Math.floor(Date.now() / 1000),
      };

      mockRelayPool.subscribe.mockImplementation((filters, options) => {
        setTimeout(() => {
          options.onEvent(mockEvent);
          options.onEose?.();
        }, 10);

        return { id: 'sub123' };
      });

      const result = await service.fetchAnalytics('content-123');

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.successCount).toBeGreaterThan(0);
    });

    it('should handle analytics fetch with time range', async () => {
      const since = Math.floor(Date.now() / 1000) - 86400; // 24h ago
      const until = Math.floor(Date.now() / 1000);

      mockRelayPool.subscribe.mockImplementation((filters, options) => {
        expect(filters[0].since).toBe(since);
        expect(filters[0].until).toBe(until);

        setTimeout(() => options.onEose?.(), 10);
        return { id: 'sub123' };
      });

      await service.fetchAnalytics('content-123', { since, until });

      expect(mockRelayPool.subscribe).toHaveBeenCalled();
    });
  });

  // ========================================
  // SUBSCRIPTION TESTS
  // ========================================

  describe('Subscription Management (Kind 30081)', () => {
    const validSubscription: SubscriptionManagementContent = {
      creatorId: 'pubkey123',
      creatorName: 'Test Creator',
      tiers: [
        {
          id: 'tier-1',
          name: 'Premium',
          description: 'Premium access',
          price: 21000,
          currency: 'sats',
          interval: 'monthly',
          benefits: {
            accessLevel: 'premium',
            features: ['All content'],
            exclusiveContent: true,
            earlyAccess: true,
            adFree: true,
          },
          subscriberCount: 50,
          enabled: true,
        },
      ],
      stats: {
        totalSubscribers: 50,
        activeSubscribers: 48,
        cancelledSubscribers: 2,
        totalRevenue: 1050000,
        monthlyRecurringRevenue: 1008000,
      },
      allowGifting: true,
      allowTrial: false,
      autoRenew: true,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
      version: '1.0.0',
    };

    it('should publish subscription info successfully', async () => {
      const result = await service.publishSubscriptionInfo(validSubscription);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should fetch subscription info by creator pubkey', async () => {
      const mockEvent = {
        kind: SovrenEventKind.SUBSCRIPTION_MANAGEMENT,
        content: JSON.stringify(validSubscription),
        created_at: Math.floor(Date.now() / 1000),
      };

      mockRelayPool.subscribe.mockImplementation((filters, options) => {
        setTimeout(() => {
          options.onEvent(mockEvent);
          options.onEose?.();
        }, 10);

        return { id: 'sub123' };
      });

      const result = await service.fetchSubscriptionInfo('pubkey123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validSubscription);
    });
  });

  // ========================================
  // RECOMMENDATIONS TESTS
  // ========================================

  describe('Content Recommendations (Kind 30082)', () => {
    const validRecommendations: ContentRecommendationsContent = {
      targetPubkey: 'user-pubkey',
      recommendations: [
        {
          contentId: 'content-456',
          creatorPubkey: 'creator-pubkey',
          title: 'Test Content',
          contentType: 'article',
          score: {
            confidence: 0.9,
            relevance: 0.85,
            quality: 0.95,
            engagement: 0.8,
            overall: 0.87,
          },
          source: RecommendationSource.AI_HYBRID,
          reason: 'Based on your interests',
        },
      ],
      feedType: 'personalized',
      algorithm: 'hybrid-ml-v1',
      algorithmVersion: '1.0.0',
      generatedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      refreshInterval: 1800,
      version: '1.0.0',
    };

    it('should publish recommendations successfully', async () => {
      const result = await service.publishRecommendations(
        'user-pubkey',
        validRecommendations
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should fetch active recommendations', async () => {
      const mockEvent = {
        kind: SovrenEventKind.CONTENT_RECOMMENDATIONS,
        content: JSON.stringify(validRecommendations),
        created_at: Math.floor(Date.now() / 1000),
      };

      mockRelayPool.subscribe.mockImplementation((filters, options) => {
        setTimeout(() => {
          options.onEvent(mockEvent);
          options.onEose?.();
        }, 10);

        return { id: 'sub123' };
      });

      const result = await service.fetchRecommendations('user-pubkey');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validRecommendations);
    });

    it('should reject expired recommendations', async () => {
      const expiredRecommendations = {
        ...validRecommendations,
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired 1h ago
      };

      const mockEvent = {
        kind: SovrenEventKind.CONTENT_RECOMMENDATIONS,
        content: JSON.stringify(expiredRecommendations),
        created_at: Math.floor(Date.now() / 1000),
      };

      mockRelayPool.subscribe.mockImplementation((filters, options) => {
        setTimeout(() => {
          options.onEvent(mockEvent);
          options.onEose?.();
        }, 10);

        return { id: 'sub123' };
      });

      const result = await service.fetchRecommendations('user-pubkey');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  // ========================================
  // CONFIGURATION TESTS
  // ========================================

  describe('Service Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableCache: false,
        cacheTTL: 7200,
      };

      service.updateConfig(newConfig);

      const config = service.getConfig();

      expect(config.enableCache).toBe(false);
      expect(config.cacheTTL).toBe(7200);
    });

    it('should preserve existing config when updating', () => {
      service.updateConfig({ cacheTTL: 5000 });

      const config = service.getConfig();

      expect(config.cacheTTL).toBe(5000);
      expect(config.enableCache).toBe(true); // Original value
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    it('should handle relay timeout gracefully', async () => {
      // Don't call onEose or onError - simulate timeout
      mockRelayPool.subscribe.mockImplementation(() => {
        return { id: 'sub123' };
      });

      const result = await service.fetchCreatorProfile('pubkey123');

      // Should timeout and return empty results
      expect(result.success).toBe(false);
    });

    it('should handle invalid JSON in event content', async () => {
      const invalidEvent = {
        kind: SovrenEventKind.CREATOR_PROFILE_EXTENDED,
        content: 'invalid-json{',
        created_at: Math.floor(Date.now() / 1000),
      };

      mockRelayPool.subscribe.mockImplementation((filters, options) => {
        setTimeout(() => {
          options.onEvent(invalidEvent);
          options.onEose?.();
        }, 10);

        return { id: 'sub123' };
      });

      const result = await service.fetchCreatorProfile('pubkey123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
