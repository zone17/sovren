/**
 * 🔍 CONTENT DISCOVERY SERVICE
 *
 * Elite implementation of content discovery and recommendation algorithms
 * Provides personalized feeds, trending content, and search capabilities
 *
 * @module services/content-discovery-service
 */

import { supabase } from '../config/supabase';
import Redis from 'ioredis';
import { getRedisClient } from '../lib/redis';
import { Logger } from '../utils/logger';
import { escapePostgrestFilter } from '../utils/escapePostgrestFilter';

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  content_type: string;
  creator_id: string;
  creator_name: string;
  creator_avatar?: string;
  thumbnail_url?: string;
  tags: string[];
  category: string;
  is_premium: boolean;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  engagement_score?: number;
}

interface FeedParams {
  user_id?: string;
  categories?: string[];
  exclude_categories?: string[];
  following_only?: boolean;
  premium_only?: boolean;
  page: number;
  limit: number;
}

interface SearchParams {
  query: string;
  category?: string;
  tags?: string[];
  creator_id?: string;
  premium_only?: boolean;
  sort?: 'relevance' | 'recent' | 'popular' | 'trending';
  page?: number;
  limit?: number;
  user_id?: string;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  following_count?: number;
  personalization_score?: number;
}

export class ContentDiscoveryService {
  private logger: Logger;
  private redis: Redis;

  constructor() {
    this.logger = new Logger('ContentDiscoveryService');
    this.redis = getRedisClient();
  }

  /**
   * Get personalized content feed for a user
   */
  async getPersonalizedFeed(params: FeedParams): Promise<PaginatedResult<ContentItem>> {
    try {
      const offset = (params.page - 1) * params.limit;

      // Build query
      let query = supabase
        .from('content')
        .select('*, creators!inner(*)', { count: 'exact' })
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(offset, offset + params.limit - 1);

      // Apply filters
      if (params.categories?.length) {
        query = query.in('category', params.categories);
      }

      if (params.exclude_categories?.length) {
        const CATEGORY_REGEX = /^[a-zA-Z0-9_,-]+$/;
        const safeCategories = params.exclude_categories.filter((c) => CATEGORY_REGEX.test(c));
        if (safeCategories.length > 0) {
          query = query.not('category', 'in', `(${safeCategories.join(',')})`);
        }
      }

      if (params.premium_only) {
        query = query.eq('is_premium', true);
      }

      // If user is authenticated, apply personalization
      if (params.user_id) {
        // Get user's followed creators
        const { data: following } = await supabase
          .from('follows')
          .select('creator_id')
          .eq('follower_id', params.user_id);

        if (params.following_only && following) {
          const creatorIds = following.map((f) => f.creator_id);
          query = query.in('creator_id', creatorIds);
        }

        // TODO: Apply ML-based personalization based on user history
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        items: this.mapContentItems(data || []),
        total: count || 0,
        following_count: params.user_id ? await this.getUserFollowingCount(params.user_id) : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get personalized feed', error);
      throw error;
    }
  }

  /**
   * Get trending content
   */
  async getTrendingContent(params: {
    timeframe: string;
    category?: string;
    limit: number;
  }): Promise<ContentItem[]> {
    try {
      const cacheKey = `trending:${params.timeframe}:${params.category || 'all'}`;

      // Check cache
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate time window
      const timeWindows = {
        '1h': 1 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        all: Date.now(),
      };

      const windowStart = new Date(
        Date.now() - (timeWindows[params.timeframe as keyof typeof timeWindows] || timeWindows['24h'])
      );

      let query = supabase
        .from('content')
        .select('*, creators!inner(*)')
        .eq('status', 'published')
        .gte('created_at', windowStart.toISOString())
        .order('engagement_score', { ascending: false })
        .limit(params.limit);

      if (params.category) {
        query = query.eq('category', params.category);
      }

      const { data, error } = await query;

      if (error) throw error;

      const items = this.mapContentItems(data || []);

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(items));

      return items;
    } catch (error) {
      this.logger.error('Failed to get trending content', error);
      throw error;
    }
  }

  /**
   * Get available content categories
   */
  async getCategories(): Promise<Array<{ name: string; count: number; icon?: string }>> {
    try {
      const { data, error } = await supabase
        .from('content_categories')
        .select('name, icon, content_count')
        .order('content_count', { ascending: false });

      if (error) throw error;

      return (data || []).map((item) => ({
        name: item.name as string,
        count: item.content_count as number,
        icon: item.icon as string | undefined,
      }));
    } catch (error) {
      this.logger.error('Failed to get categories', error);
      throw error;
    }
  }

  /**
   * Get content by category
   */
  async getContentByCategory(params: {
    category: string;
    sort: 'recent' | 'popular' | 'trending';
    page: number;
    limit: number;
  }): Promise<PaginatedResult<ContentItem>> {
    try {
      const offset = (params.page - 1) * params.limit;

      let query = supabase
        .from('content')
        .select('*, creators!inner(*)', { count: 'exact' })
        .eq('status', 'published')
        .eq('category', params.category)
        .range(offset, offset + params.limit - 1);

      // Apply sorting
      switch (params.sort) {
        case 'popular':
          query = query.order('view_count', { ascending: false });
          break;
        case 'trending':
          query = query.order('engagement_score', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        items: this.mapContentItems(data || []),
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get category content', error);
      throw error;
    }
  }

  /**
   * Search content with filters
   */
  async searchContent(params: SearchParams): Promise<PaginatedResult<ContentItem>> {
    try {
      const offset = ((params.page || 1) - 1) * (params.limit || 20);

      // Use full-text search for query
      let query = supabase
        .from('content')
        .select('*, creators!inner(*)', { count: 'exact' })
        .eq('status', 'published')
        .textSearch('search_vector', params.query)
        .range(offset, offset + (params.limit || 20) - 1);

      // Apply filters
      if (params.category) {
        query = query.eq('category', params.category);
      }

      if (params.tags?.length) {
        query = query.contains('tags', params.tags);
      }

      if (params.creator_id) {
        query = query.eq('creator_id', params.creator_id);
      }

      if (params.premium_only) {
        query = query.eq('is_premium', true);
      }

      // Apply sorting
      switch (params.sort) {
        case 'popular':
          query = query.order('view_count', { ascending: false });
          break;
        case 'trending':
          query = query.order('engagement_score', { ascending: false });
          break;
        case 'recent':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          // Relevance sorting is handled by text search
          break;
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        items: this.mapContentItems(data || []),
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Failed to search content', error);
      throw error;
    }
  }

  /**
   * Get similar content based on content ID
   */
  async getSimilarContent(params: { content_id: string; limit: number }): Promise<ContentItem[]> {
    try {
      // Get the source content
      const { data: sourceContent, error: sourceError } = await supabase
        .from('content')
        .select('category, tags, creator_id')
        .eq('id', params.content_id)
        .single();

      if (sourceError) throw sourceError;

      // Find similar content based on category and tags
      const { data, error } = await supabase
        .from('content')
        .select('*, creators!inner(*)')
        .eq('status', 'published')
        .neq('id', params.content_id)
        .or(
          `category.eq.${escapePostgrestFilter(sourceContent.category)},tags.cs.{${sourceContent.tags.map(escapePostgrestFilter).join(',')}}`
        )
        .order('engagement_score', { ascending: false })
        .limit(params.limit);

      if (error) throw error;

      return this.mapContentItems(data || []);
    } catch (error) {
      this.logger.error('Failed to get similar content', error);
      throw error;
    }
  }

  /**
   * Get exploration content (content outside user's usual preferences)
   */
  async getExplorationContent(params: { user_id?: string; limit: number }): Promise<ContentItem[]> {
    try {
      let excludeCategories: string[] = [];

      // If user is authenticated, get their usual categories
      if (params.user_id) {
        const { data: userHistory } = await supabase
          .from('content_views')
          .select('content(category)')
          .eq('user_id', params.user_id)
          .order('viewed_at', { ascending: false })
          .limit(50);

        if (userHistory) {
          const categories = userHistory.map((h: Record<string, any>) => h.content?.category).filter(Boolean) as string[];
          const categoryCounts = categories.reduce(
            (acc: Record<string, number>, cat: string) => {
              acc[cat] = (acc[cat] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );

          // Exclude top 3 most viewed categories
          excludeCategories = Object.entries(categoryCounts)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .map(([cat]) => cat);
        }
      }

      // Get random content from unexplored categories
      let query = supabase
        .from('content')
        .select('*, creators!inner(*)')
        .eq('status', 'published')
        .order('random()')
        .limit(params.limit);

      if (excludeCategories.length) {
        query = query.not('category', 'in', `(${excludeCategories.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return this.mapContentItems(data || []);
    } catch (error) {
      this.logger.error('Failed to get exploration content', error);
      throw error;
    }
  }

  /**
   * Helper: Map raw data to ContentItem format
   */
  private mapContentItems(data: any[]): ContentItem[] {
    return data.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      content_type: item.content_type,
      creator_id: item.creator_id,
      creator_name: item.creators?.name || 'Unknown Creator',
      creator_avatar: item.creators?.avatar_url,
      thumbnail_url: item.thumbnail_url,
      tags: item.tags || [],
      category: item.category,
      is_premium: item.is_premium || false,
      view_count: item.view_count || 0,
      like_count: item.like_count || 0,
      comment_count: item.comment_count || 0,
      created_at: item.created_at,
      updated_at: item.updated_at,
      engagement_score: item.engagement_score || 0,
    }));
  }

  /**
   * Helper: Get user's following count
   */
  private async getUserFollowingCount(userId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      return count || 0;
    } catch (error) {
      this.logger.error('Failed to get following count', error);
      return 0;
    }
  }
}
