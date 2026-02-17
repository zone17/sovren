/**
 * Cross-Platform Analytics Service
 * EPIC-009: Aggregate metrics across connected platforms
 */

import type { ICrossPlatformAnalyticsService } from '../../interfaces/distribution/ICrossPlatformAnalyticsService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type {
  PlatformOverview,
  ContentComparison,
  PlatformROI,
  SupportedPlatform,
} from '@sovren/shared/types/distribution';
import type { PlatformConnectionService } from './PlatformConnectionService';

export class CrossPlatformAnalyticsService implements ICrossPlatformAnalyticsService {
  private readonly db: any;
  private readonly platformService: PlatformConnectionService;
  private readonly logger: ILogger;

  constructor(db: any, platformService: PlatformConnectionService, logger: ILogger) {
    this.db = db;
    this.platformService = platformService;
    this.logger = logger;
  }

  async getOverview(creatorId: string): Promise<PlatformOverview> {
    // Get latest metrics for each platform
    const { data: metrics, error } = await this.db
      .from('platform_metrics_history')
      .select('platform, followers, engagement_rate, impressions_30d, recorded_at')
      .eq('creator_id', creatorId)
      .order('recorded_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Get unique latest entry per platform
    const latestByPlatform = new Map<string, any>();
    for (const row of metrics || []) {
      if (!latestByPlatform.has(row.platform)) {
        latestByPlatform.set(row.platform, row);
      }
    }

    // Calculate 30-day growth per platform
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: oldMetrics } = await this.db
      .from('platform_metrics_history')
      .select('platform, followers')
      .eq('creator_id', creatorId)
      .lte('recorded_at', thirtyDaysAgo)
      .order('recorded_at', { ascending: false });

    const oldByPlatform = new Map<string, any>();
    for (const row of oldMetrics || []) {
      if (!oldByPlatform.has(row.platform)) {
        oldByPlatform.set(row.platform, row);
      }
    }

    let totalFollowers = 0;
    let totalEngagement = 0;
    const platforms = [];

    for (const [platform, latest] of latestByPlatform) {
      const oldData = oldByPlatform.get(platform);
      const growth = oldData && oldData.followers > 0
        ? ((latest.followers - oldData.followers) / oldData.followers) * 100
        : 0;

      totalFollowers += latest.followers || 0;
      totalEngagement += latest.impressions_30d || 0;

      platforms.push({
        platform: platform as any,
        followers: latest.followers || 0,
        engagement_rate: parseFloat(latest.engagement_rate) || 0,
        impressions_30d: latest.impressions_30d || 0,
        growth_30d: Math.round(growth * 100) / 100,
      });
    }

    return {
      total_followers: totalFollowers,
      total_engagement_30d: totalEngagement,
      platforms,
      updated_at: new Date().toISOString(),
    };
  }

  async getContentComparison(creatorId: string, contentId: string): Promise<ContentComparison[]> {
    const { data: crossPosts, error } = await this.db
      .from('cross_posts')
      .select('platform, platform_post_id, published_at, metrics_json')
      .eq('creator_id', creatorId)
      .eq('content_id', contentId)
      .eq('status', 'published');

    if (error) {
      throw error;
    }

    return (crossPosts || []).map((post: any) => {
      const metrics = post.metrics_json || {};
      return {
        platform: post.platform,
        platform_post_id: post.platform_post_id || '',
        views: metrics.views || 0,
        likes: metrics.likes || 0,
        shares: metrics.shares || 0,
        comments: metrics.comments || 0,
        engagement_rate: metrics.engagement_rate || 0,
        published_at: post.published_at,
      };
    });
  }

  async getROI(creatorId: string): Promise<PlatformROI[]> {
    // Get latest metrics per platform
    const { data: metrics } = await this.db
      .from('platform_metrics_history')
      .select('platform, impressions_30d, engagement_rate')
      .eq('creator_id', creatorId)
      .order('recorded_at', { ascending: false });

    const latestByPlatform = new Map<string, any>();
    for (const row of metrics || []) {
      if (!latestByPlatform.has(row.platform)) {
        latestByPlatform.set(row.platform, row);
      }
    }

    // Get work patterns to estimate hours per platform
    // (For MVP, use a simple estimate based on cross-post count)
    const { data: crossPosts } = await this.db
      .from('cross_posts')
      .select('platform')
      .eq('creator_id', creatorId)
      .eq('status', 'published')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const postCountByPlatform = new Map<string, number>();
    for (const post of crossPosts || []) {
      postCountByPlatform.set(post.platform, (postCountByPlatform.get(post.platform) || 0) + 1);
    }

    const roiList: PlatformROI[] = [];

    for (const [platform, latest] of latestByPlatform) {
      const totalEngagement = latest.impressions_30d || 0;
      const postCount = postCountByPlatform.get(platform) || 1;
      // Rough estimate: 0.5 hours per post for automated cross-posting
      const estimatedHours = postCount * 0.5;

      roiList.push({
        platform: platform as any,
        engagement_per_hour: estimatedHours > 0 ? Math.round(totalEngagement / estimatedHours) : 0,
        total_engagement_30d: totalEngagement,
        estimated_hours_30d: estimatedHours,
        rank: 0, // Will be set below
      });
    }

    // Sort by engagement per hour and assign ranks
    roiList.sort((a, b) => b.engagement_per_hour - a.engagement_per_hour);
    roiList.forEach((item, index) => {
      item.rank = index + 1;
    });

    return roiList;
  }

  async snapshotMetrics(creatorId: string): Promise<void> {
    const statuses = await this.platformService.getStatus(creatorId);

    for (const status of statuses) {
      if (!status.connected) continue;

      try {
        const adapter = this.platformService.getAdapter(status.platform);
        const accessToken = await this.platformService.getDecryptedToken(creatorId, status.platform);

        const metrics = await adapter.getMetrics({
          access_token: accessToken,
          refresh_token: null,
          expires_at: null,
          scopes: [],
        });

        await this.db.from('platform_metrics_history').upsert(
          {
            creator_id: creatorId,
            platform: status.platform,
            followers: metrics.followers,
            following: metrics.following,
            posts: metrics.posts,
            engagement_rate: metrics.engagement_rate,
            impressions_30d: metrics.impressions_30d,
            recorded_at: new Date().toISOString().split('T')[0],
          },
          { onConflict: 'creator_id,platform,recorded_at' }
        );
      } catch (err) {
        this.logger.error('[CrossPlatformAnalyticsService] Metrics snapshot failed', {
          creatorId,
          platform: status.platform,
          error: (err as Error).message,
        });
      }
    }
  }
}
