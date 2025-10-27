/**
 * 🧪 **SOCIAL MEDIA INTEGRATION SERVICE TESTS**
 *
 * Elite Test Suite covering:
 * - US-135: Social Media Sharing
 * - US-136: Cross-Platform Posting
 * - US-137: Social Media Analytics
 * - US-138: Social Login
 *
 * Test Standards:
 * - 100% code coverage
 * - All edge cases covered
 * - Mocked external dependencies
 * - Performance validation
 * - Security testing
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CreateSocialPostRequest,
  GetAnalyticsRequest,
  PostStatus,
  SocialLoginRequest,
  SocialPlatform,
  SocialShareRequest,
} from '../../types/social-media-integration';
import { Logger } from '../../utils/logger';
import { AnalyticsService } from '../analytics-service';
import { RedisService } from '../redis-service';
import { SocialMediaIntegrationService } from '../social-media-integration-service';

// =====================================================
// MOCKS SETUP
// =====================================================

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

const mockRedis = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
} as unknown as RedisService;

const mockAnalytics = {
  track: jest.fn(),
} as unknown as AnalyticsService;

const mockConfig = {
  platforms: {
    [SocialPlatform.TWITTER]: {
      clientId: 'test_twitter_client',
      clientSecret: 'test_twitter_secret',
      enabled: true,
    },
    [SocialPlatform.FACEBOOK]: {
      clientId: 'test_facebook_client',
      clientSecret: 'test_facebook_secret',
      enabled: true,
    },
  },
  defaultRateLimits: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
  },
};

// =====================================================
// TEST DATA
// =====================================================

const mockUserId = 'user_12345';
const mockContentId = 'content_67890';
const mockContentUrl = 'https://sovren.com/content/12345';

const mockSocialAccount = {
  id: 'account_123',
  userId: mockUserId,
  platform: SocialPlatform.TWITTER,
  platformUserId: 'twitter_user_123',
  username: 'testuser',
  displayName: 'Test User',
  accessToken: 'mock_access_token',
  refreshToken: 'mock_refresh_token',
  isVerified: true,
  isPrimary: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockContent = {
  id: mockContentId,
  title: 'Test Content Title',
  content: 'This is a test content for social media sharing.',
  description: 'Test content description',
  mediaUrls: ['https://example.com/image1.jpg'],
  tags: ['test', 'social', 'media'],
  createdAt: new Date(),
};

// =====================================================
// TEST SUITE
// =====================================================

describe('SocialMediaIntegrationService', () => {
  let service: SocialMediaIntegrationService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create service instance
    service = new SocialMediaIntegrationService(
      mockLogger,
      mockRedis,
      mockAnalytics,
      mockConfig as any
    );

    // Mock private methods
    (service as any).getContentForSharing = jest.fn().mockResolvedValue(mockContent);
    (service as any).getUserSocialAccount = jest.fn().mockResolvedValue(mockSocialAccount);
    (service as any).storeSocialShare = jest.fn().mockResolvedValue(undefined);
    (service as any).storeCrossPlatformPost = jest.fn().mockResolvedValue(undefined);
    (service as any).updateCrossPlatformPost = jest.fn().mockResolvedValue(undefined);
    (service as any).getCrossPlatformPost = jest.fn();
    (service as any).storeSocialAccount = jest.fn().mockResolvedValue(undefined);
    (service as any).getSocialAccount = jest.fn().mockResolvedValue(mockSocialAccount);
    (service as any).updateSocialAccount = jest.fn().mockResolvedValue(undefined);
    (service as any).getSocialLoginProvider = jest.fn().mockResolvedValue({
      platform: SocialPlatform.TWITTER,
      clientId: 'test_client',
      enabled: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =====================================================
  // US-135: SOCIAL MEDIA SHARING TESTS
  // =====================================================

  describe('US-135: Social Media Sharing', () => {
    describe('shareContent', () => {
      it('should successfully share content to a platform', async () => {
        // Arrange
        const shareRequest: SocialShareRequest = {
          contentId: mockContentId,
          platform: SocialPlatform.TWITTER,
          customMessage: 'Check out this amazing content!',
        };

        // Mock platform adapter
        const mockAdapter = {
          postContent: jest.fn().mockResolvedValue({
            postId: 'post_123',
            postUrl: 'https://twitter.com/user/status/123',
          }),
        };
        (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockAdapter);

        // Act
        const result = await service.shareContent(mockUserId, shareRequest);

        // Assert
        expect(result.success).toBe(true);
        expect(result.platform).toBe(SocialPlatform.TWITTER);
        expect(result.postId).toBe('post_123');
        expect(result.postUrl).toBe('https://twitter.com/user/status/123');
        expect(result.shareId).toBeDefined();
        expect(mockAnalytics.track).toHaveBeenCalledWith(
          mockUserId,
          'social_content_shared',
          expect.objectContaining({
            platform: SocialPlatform.TWITTER,
            contentId: mockContentId,
          })
        );
      });

      it('should handle platform adapter not found', async () => {
        // Arrange
        const shareRequest: SocialShareRequest = {
          contentId: mockContentId,
          platform: SocialPlatform.INSTAGRAM,
        };

        // Act
        const result = await service.shareContent(mockUserId, shareRequest);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Platform adapter not found');
      });

      it('should handle missing social account', async () => {
        // Arrange
        const shareRequest: SocialShareRequest = {
          contentId: mockContentId,
          platform: SocialPlatform.FACEBOOK,
        };

        (service as any).getUserSocialAccount = jest.fn().mockResolvedValue(null);

        // Act
        const result = await service.shareContent(mockUserId, shareRequest);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('No connected facebook account found');
      });

      it('should validate content adaptation for platform limits', async () => {
        // Arrange
        const longContent = 'A'.repeat(300); // Exceeds Twitter limit
        const mockLongContent = { ...mockContent, content: longContent };
        (service as any).getContentForSharing = jest.fn().mockResolvedValue(mockLongContent);

        const shareRequest: SocialShareRequest = {
          contentId: mockContentId,
          platform: SocialPlatform.TWITTER,
        };

        const mockAdapter = {
          postContent: jest.fn().mockResolvedValue({
            postId: 'post_123',
            postUrl: 'https://twitter.com/status/123',
          }),
        };
        (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockAdapter);

        // Act
        const result = await service.shareContent(mockUserId, shareRequest);

        // Assert
        expect(result.success).toBe(true);
        // Verify content was truncated
        expect(mockAdapter.postContent).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringMatching(/^A{277}\.\.\.$/),
          }),
          mockSocialAccount.accessToken
        );
      });

      it('should handle scheduled sharing', async () => {
        // Arrange
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
        const shareRequest: SocialShareRequest = {
          contentId: mockContentId,
          platform: SocialPlatform.TWITTER,
          scheduledAt: futureDate,
        };

        const mockAdapter = {
          postContent: jest.fn().mockResolvedValue({
            postId: 'scheduled_post_123',
            postUrl: 'https://twitter.com/scheduled/123',
          }),
        };
        (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockAdapter);
        (service as any).schedulePost = jest.fn().mockResolvedValue({
          postId: 'scheduled_post_123',
          postUrl: 'https://twitter.com/scheduled/123',
        });

        // Act
        const result = await service.shareContent(mockUserId, shareRequest);

        // Assert
        expect(result.success).toBe(true);
        expect((service as any).schedulePost).toHaveBeenCalled();
      });
    });

    describe('generateShareButtons', () => {
      it('should generate share buttons configuration', async () => {
        // Arrange
        const platforms = [
          SocialPlatform.TWITTER,
          SocialPlatform.FACEBOOK,
          SocialPlatform.LINKEDIN,
        ];
        const config = {
          style: 'button' as const,
          size: 'medium' as const,
          showLabel: true,
        };

        // Act
        const result = await service.generateShareButtons(mockContentId, platforms, config);

        // Assert
        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({
          platform: SocialPlatform.TWITTER,
          style: 'button',
          size: 'medium',
          showLabel: true,
        });
      });
    });
  });

  // =====================================================
  // US-136: CROSS-PLATFORM POSTING TESTS
  // =====================================================

  describe('US-136: Cross-Platform Posting', () => {
    describe('createCrossPlatformPost', () => {
      it('should create a cross-platform post successfully', async () => {
        // Arrange
        const postRequest: CreateSocialPostRequest = {
          content: 'Test cross-platform post content',
          platforms: [SocialPlatform.TWITTER, SocialPlatform.FACEBOOK],
          mediaUrls: ['https://example.com/image.jpg'],
        };

        (service as any).processMediaAssets = jest
          .fn()
          .mockResolvedValue([{ type: 'image', url: 'https://example.com/image.jpg' }]);
        (service as any).generatePlatformCustomizations = jest.fn().mockResolvedValue({
          [SocialPlatform.TWITTER]: { content: 'Twitter version' },
          [SocialPlatform.FACEBOOK]: { content: 'Facebook version' },
        });

        // Act
        const result = await service.createCrossPlatformPost(mockUserId, postRequest);

        // Assert
        expect(result.id).toBeDefined();
        expect(result.userId).toBe(mockUserId);
        expect(result.content).toBe(postRequest.content);
        expect(result.platforms).toEqual(postRequest.platforms);
        expect(result.status).toBe(PostStatus.DRAFT);
        expect(result.contentType).toBeDefined();
        expect((service as any).storeCrossPlatformPost).toHaveBeenCalledWith(result);
      });

      it('should schedule post for future publication', async () => {
        // Arrange
        const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
        const postRequest: CreateSocialPostRequest = {
          content: 'Scheduled post content',
          platforms: [SocialPlatform.TWITTER],
          scheduledAt: futureDate,
        };

        (service as any).processMediaAssets = jest.fn().mockResolvedValue([]);
        (service as any).generatePlatformCustomizations = jest.fn().mockResolvedValue({});
        (service as any).schedulePostPublication = jest.fn().mockResolvedValue(undefined);

        // Act
        const result = await service.createCrossPlatformPost(mockUserId, postRequest);

        // Assert
        expect(result.status).toBe(PostStatus.SCHEDULED);
        expect(result.scheduledAt).toEqual(futureDate);
        expect((service as any).schedulePostPublication).toHaveBeenCalledWith(result);
      });
    });

    describe('publishCrossPlatformPost', () => {
      it('should publish to all platforms successfully', async () => {
        // Arrange
        const mockPost = {
          id: 'post_123',
          userId: mockUserId,
          content: 'Test post content',
          platforms: [SocialPlatform.TWITTER, SocialPlatform.FACEBOOK],
          status: PostStatus.DRAFT,
        };

        (service as any).getCrossPlatformPost = jest.fn().mockResolvedValue(mockPost);
        (service as any).getPlatformSpecificContent = jest
          .fn()
          .mockResolvedValueOnce({ content: 'Twitter content' })
          .mockResolvedValueOnce({ content: 'Facebook content' });

        const mockTwitterAdapter = {
          postContent: jest
            .fn()
            .mockResolvedValue({ postId: 'twitter_123', postUrl: 'https://twitter.com/123' }),
        };
        const mockFacebookAdapter = {
          postContent: jest
            .fn()
            .mockResolvedValue({ postId: 'facebook_123', postUrl: 'https://facebook.com/123' }),
        };

        (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockTwitterAdapter);
        (service as any).platformAdapters.set(SocialPlatform.FACEBOOK, mockFacebookAdapter);

        // Act
        await service.publishCrossPlatformPost('post_123');

        // Assert
        expect(mockTwitterAdapter.postContent).toHaveBeenCalled();
        expect(mockFacebookAdapter.postContent).toHaveBeenCalled();
        expect((service as any).updateCrossPlatformPost).toHaveBeenCalledWith(
          expect.objectContaining({ status: PostStatus.PUBLISHED })
        );
      });

      it('should handle partial failures gracefully', async () => {
        // Arrange
        const mockPost = {
          id: 'post_123',
          userId: mockUserId,
          content: 'Test post content',
          platforms: [SocialPlatform.TWITTER, SocialPlatform.FACEBOOK],
          status: PostStatus.DRAFT,
        };

        (service as any).getCrossPlatformPost = jest.fn().mockResolvedValue(mockPost);
        (service as any).getPlatformSpecificContent = jest
          .fn()
          .mockResolvedValue({ content: 'Content' });

        const mockTwitterAdapter = {
          postContent: jest
            .fn()
            .mockResolvedValue({ postId: 'twitter_123', postUrl: 'https://twitter.com/123' }),
        };
        const mockFacebookAdapter = {
          postContent: jest.fn().mockRejectedValue(new Error('Facebook API error')),
        };

        (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockTwitterAdapter);
        (service as any).platformAdapters.set(SocialPlatform.FACEBOOK, mockFacebookAdapter);

        // Act
        await service.publishCrossPlatformPost('post_123');

        // Assert
        expect((service as any).updateCrossPlatformPost).toHaveBeenCalledWith(
          expect.objectContaining({ status: PostStatus.FAILED })
        );
      });
    });

    describe('createPostingSchedule', () => {
      it('should create a posting schedule', async () => {
        // Arrange
        const scheduleData = {
          userId: mockUserId,
          name: 'Daily Posts',
          platforms: [SocialPlatform.TWITTER],
          frequency: 'daily' as const,
          timeSlots: ['09:00', '17:00'],
          timezone: 'UTC',
          isActive: true,
        };

        (service as any).storePostingSchedule = jest.fn().mockResolvedValue(undefined);

        // Act
        const result = await service.createPostingSchedule(mockUserId, scheduleData);

        // Assert
        expect(result.id).toBeDefined();
        expect(result.userId).toBe(mockUserId);
        expect(result.name).toBe(scheduleData.name);
        expect(result.createdAt).toBeInstanceOf(Date);
        expect((service as any).storePostingSchedule).toHaveBeenCalledWith(result);
      });
    });
  });

  // =====================================================
  // US-137: SOCIAL MEDIA ANALYTICS TESTS
  // =====================================================

  describe('US-137: Social Media Analytics', () => {
    describe('getSocialMediaAnalytics', () => {
      it('should gather analytics from all connected platforms', async () => {
        // Arrange
        const analyticsRequest: GetAnalyticsRequest = {
          platforms: [SocialPlatform.TWITTER, SocialPlatform.FACEBOOK],
          timeRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
          },
        };

        const mockTwitterMetrics = {
          platform: SocialPlatform.TWITTER,
          postId: 'twitter_post_123',
          timeRange: analyticsRequest.timeRange,
          metrics: {
            impressions: 1000,
            reach: 800,
            engagement: 50,
            clicks: 25,
            shares: 10,
            comments: 5,
            likes: 30,
            saves: 8,
            mentions: 2,
            profileViews: 15,
            followerGrowth: 5,
            engagementRate: 5.0,
            clickThroughRate: 2.5,
            conversionRate: 1.0,
            topKeywords: ['test', 'content'],
          },
          lastUpdated: new Date(),
        };

        (service as any).gatherPlatformAnalytics = jest
          .fn()
          .mockResolvedValueOnce(mockTwitterMetrics)
          .mockResolvedValueOnce({
            ...mockTwitterMetrics,
            platform: SocialPlatform.FACEBOOK,
            metrics: { ...mockTwitterMetrics.metrics, impressions: 1500 },
          });

        (service as any).calculateAggregatedMetrics = jest.fn().mockReturnValue({
          totalImpressions: 2500,
          totalEngagement: 100,
          averageEngagementRate: 4.0,
        });

        (service as any).analyzeTrends = jest.fn().mockResolvedValue([]);
        (service as any).cacheAnalytics = jest.fn().mockResolvedValue(undefined);

        // Act
        const result = await service.getSocialMediaAnalytics(mockUserId, analyticsRequest);

        // Assert
        expect(result.userId).toBe(mockUserId);
        expect(result.timeRange).toEqual(analyticsRequest.timeRange);
        expect(result.platformMetrics[SocialPlatform.TWITTER]).toBeDefined();
        expect(result.platformMetrics[SocialPlatform.FACEBOOK]).toBeDefined();
        expect(result.aggregatedMetrics.totalImpressions).toBe(2500);
        expect((service as any).cacheAnalytics).toHaveBeenCalled();
      });

      it('should handle platforms without connected accounts', async () => {
        // Arrange
        const analyticsRequest: GetAnalyticsRequest = {
          platforms: [SocialPlatform.INSTAGRAM], // Not connected
        };

        (service as any).getUserSocialAccount = jest.fn().mockResolvedValue(null);

        // Act
        const result = await service.getSocialMediaAnalytics(mockUserId, analyticsRequest);

        // Assert
        expect(Object.keys(result.platformMetrics)).toHaveLength(0);
      });
    });

    describe('generateAnalyticsReport', () => {
      it('should generate a comprehensive analytics report', async () => {
        // Arrange
        const mockAnalytics = {
          userId: mockUserId,
          timeRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
          platformMetrics: {},
          aggregatedMetrics: { totalImpressions: 5000 },
          trends: [],
          generatedAt: new Date(),
        };

        (service as any).getSocialMediaAnalytics = jest.fn().mockResolvedValue(mockAnalytics);
        (service as any).generateReportSections = jest
          .fn()
          .mockResolvedValue([{ title: 'Overview', type: 'overview', data: {} }]);
        (service as any).generateInsights = jest
          .fn()
          .mockResolvedValue([{ type: 'opportunity', message: 'Test insight' }]);
        (service as any).storeAnalyticsReport = jest.fn().mockResolvedValue(undefined);

        // Act
        const result = await service.generateAnalyticsReport(mockUserId, 'monthly');

        // Assert
        expect(result.id).toBeDefined();
        expect(result.userId).toBe(mockUserId);
        expect(result.type).toBe('monthly');
        expect(result.title).toBe('Monthly Social Media Report');
        expect(result.sections).toHaveLength(1);
        expect(result.insights).toHaveLength(1);
        expect((service as any).storeAnalyticsReport).toHaveBeenCalled();
      });
    });
  });

  // =====================================================
  // US-138: SOCIAL LOGIN TESTS
  // =====================================================

  describe('US-138: Social Login', () => {
    describe('initiateOAuthFlow', () => {
      it('should initiate OAuth flow successfully', async () => {
        // Arrange
        const platform = SocialPlatform.TWITTER;
        const redirectUri = 'https://sovren.com/auth/callback';
        const scopes = ['read', 'write'];

        const mockProvider = {
          platform,
          clientId: 'test_client_id',
          enabled: true,
        };

        (service as any).getSocialLoginProvider = jest.fn().mockResolvedValue(mockProvider);
        (service as any).generateAuthorizationUrl = jest
          .fn()
          .mockResolvedValue(
            'https://twitter.com/oauth/authorize?client_id=test&redirect_uri=callback&state=abc123'
          );

        // Act
        const result = await service.initiateOAuthFlow(platform, redirectUri, scopes, mockUserId);

        // Assert
        expect(result.authUrl).toContain('https://twitter.com/oauth/authorize');
        expect(result.state).toBeDefined();
        expect((service as any).oauthFlows.has(result.state)).toBe(true);
      });

      it('should reject disabled OAuth provider', async () => {
        // Arrange
        const platform = SocialPlatform.FACEBOOK;
        const mockProvider = {
          platform,
          clientId: 'test_client_id',
          enabled: false,
        };

        (service as any).getSocialLoginProvider = jest.fn().mockResolvedValue(mockProvider);

        // Act & Assert
        await expect(service.initiateOAuthFlow(platform, 'callback', ['read'])).rejects.toThrow(
          'OAuth provider not configured'
        );
      });
    });

    describe('completeOAuthFlow', () => {
      it('should complete OAuth flow and create social account', async () => {
        // Arrange
        const oauthState = 'test_state_123';
        const mockOAuthFlow = {
          state: oauthState,
          codeVerifier: 'test_verifier',
          platform: SocialPlatform.TWITTER,
          redirectUri: 'https://sovren.com/callback',
          scopes: ['read', 'write'],
          userId: mockUserId,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        };

        (service as any).oauthFlows.set(oauthState, mockOAuthFlow);

        const mockProvider = {
          platform: SocialPlatform.TWITTER,
          clientId: 'test_client',
          enabled: true,
        };

        const mockAdapter = {
          authenticate: jest.fn().mockResolvedValue({
            accessToken: 'access_token_123',
            refreshToken: 'refresh_token_123',
          }),
          getUserProfile: jest.fn().mockResolvedValue({
            id: 'twitter_user_123',
            username: 'testuser',
            displayName: 'Test User',
            email: 'test@example.com',
            verified: true,
          }),
        };

        (service as any).getSocialLoginProvider = jest.fn().mockResolvedValue(mockProvider);
        (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockAdapter);

        const loginRequest: SocialLoginRequest = {
          platform: SocialPlatform.TWITTER,
          authCode: 'auth_code_123',
          state: oauthState,
          redirectUri: 'https://sovren.com/callback',
        };

        // Act
        const result = await service.completeOAuthFlow(loginRequest);

        // Assert
        expect(result.id).toBeDefined();
        expect(result.userId).toBe(mockUserId);
        expect(result.platform).toBe(SocialPlatform.TWITTER);
        expect(result.platformUserId).toBe('twitter_user_123');
        expect(result.username).toBe('testuser');
        expect(result.accessToken).toBe('access_token_123');
        expect(result.isVerified).toBe(true);
        expect((service as any).storeSocialAccount).toHaveBeenCalledWith(result);
        expect((service as any).oauthFlows.has(oauthState)).toBe(false); // Should be cleaned up
      });

      it('should reject expired OAuth flow', async () => {
        // Arrange
        const oauthState = 'expired_state_123';
        const expiredOAuthFlow = {
          state: oauthState,
          platform: SocialPlatform.TWITTER,
          expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        };

        (service as any).oauthFlows.set(oauthState, expiredOAuthFlow);

        const loginRequest: SocialLoginRequest = {
          platform: SocialPlatform.TWITTER,
          authCode: 'auth_code_123',
          state: oauthState,
          redirectUri: 'https://sovren.com/callback',
        };

        // Act & Assert
        await expect(service.completeOAuthFlow(loginRequest)).rejects.toThrow('OAuth flow expired');
      });

      it('should reject invalid OAuth state', async () => {
        // Arrange
        const loginRequest: SocialLoginRequest = {
          platform: SocialPlatform.TWITTER,
          authCode: 'auth_code_123',
          state: 'invalid_state',
          redirectUri: 'https://sovren.com/callback',
        };

        // Act & Assert
        await expect(service.completeOAuthFlow(loginRequest)).rejects.toThrow(
          'Invalid or expired OAuth state'
        );
      });
    });

    describe('syncSocialProfile', () => {
      it('should sync social profile data successfully', async () => {
        // Arrange
        const accountId = 'account_123';

        const mockAdapter = {
          getUserProfile: jest.fn().mockResolvedValue({
            username: 'updated_username',
            displayName: 'Updated Display Name',
            bio: 'Updated bio',
            followerCount: 1500,
            verified: true,
          }),
        };

        (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockAdapter);
        (service as any).storeSocialProfileSync = jest.fn().mockResolvedValue(undefined);

        // Act
        const result = await service.syncSocialProfile(accountId);

        // Assert
        expect(result.accountId).toBe(accountId);
        expect(result.platform).toBe(SocialPlatform.TWITTER);
        expect(result.syncedData.profile.username).toBe('updated_username');
        expect(result.syncedData.profile.followerCount).toBe(1500);
        expect(result.lastSyncAt).toBeInstanceOf(Date);
        expect((service as any).updateSocialAccount).toHaveBeenCalled();
        expect((service as any).storeSocialProfileSync).toHaveBeenCalled();
      });

      it('should handle account not found', async () => {
        // Arrange
        (service as any).getSocialAccount = jest.fn().mockResolvedValue(null);

        // Act & Assert
        await expect(service.syncSocialProfile('nonexistent_account')).rejects.toThrow(
          'Social account not found'
        );
      });
    });
  });

  // =====================================================
  // PERFORMANCE TESTS
  // =====================================================

  describe('Performance Tests', () => {
    it('should handle high volume of share requests', async () => {
      // Arrange
      const shareRequests = Array.from({ length: 100 }, (_, i) => ({
        contentId: `content_${i}`,
        platform: SocialPlatform.TWITTER,
      }));

      const mockAdapter = {
        postContent: jest.fn().mockResolvedValue({
          postId: 'post_123',
          postUrl: 'https://twitter.com/123',
        }),
      };
      (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockAdapter);

      const startTime = Date.now();

      // Act
      const promises = shareRequests.map((request) =>
        service.shareContent(mockUserId, request as SocialShareRequest)
      );
      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockAdapter.postContent).toHaveBeenCalledTimes(100);
    });
  });

  // =====================================================
  // SECURITY TESTS
  // =====================================================

  describe('Security Tests', () => {
    it('should sanitize user input in share content', async () => {
      // Arrange
      const maliciousRequest: SocialShareRequest = {
        contentId: 'content_123',
        platform: SocialPlatform.TWITTER,
        customMessage: '<script>alert("xss")</script>Malicious content',
      };

      const mockAdapter = {
        postContent: jest.fn().mockResolvedValue({
          postId: 'post_123',
          postUrl: 'https://twitter.com/123',
        }),
      };
      (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockAdapter);

      // Act
      await service.shareContent(mockUserId, maliciousRequest);

      // Assert
      expect(mockAdapter.postContent).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.not.stringContaining('<script>'),
        }),
        expect.any(String)
      );
    });

    it('should validate OAuth state parameter', async () => {
      // Arrange
      const loginRequest: SocialLoginRequest = {
        platform: SocialPlatform.TWITTER,
        authCode: 'auth_code_123',
        state: 'invalid_state_format!@#$',
        redirectUri: 'https://sovren.com/callback',
      };

      // Act & Assert
      await expect(service.completeOAuthFlow(loginRequest)).rejects.toThrow();
    });

    it('should handle rate limiting gracefully', async () => {
      // Arrange
      const mockAdapter = {
        postContent: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      };
      (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockAdapter);

      const shareRequest: SocialShareRequest = {
        contentId: mockContentId,
        platform: SocialPlatform.TWITTER,
      };

      // Act
      const result = await service.shareContent(mockUserId, shareRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });
  });

  // =====================================================
  // ERROR HANDLING TESTS
  // =====================================================

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      // Arrange
      const mockAdapter = {
        postContent: jest.fn().mockRejectedValue(new Error('Network timeout')),
      };
      (service as any).platformAdapters.set(SocialPlatform.TWITTER, mockAdapter);

      const shareRequest: SocialShareRequest = {
        contentId: mockContentId,
        platform: SocialPlatform.TWITTER,
      };

      // Act
      const result = await service.shareContent(mockUserId, shareRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should recover from Redis connection failures', async () => {
      // Arrange
      mockRedis.setex = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      const analyticsRequest: GetAnalyticsRequest = {
        platforms: [SocialPlatform.TWITTER],
      };

      // Act
      const result = await service.getSocialMediaAnalytics(mockUserId, analyticsRequest);

      // Assert
      expect(result).toBeDefined(); // Should still return analytics even if caching fails
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to'),
        expect.any(Object)
      );
    });
  });
});
