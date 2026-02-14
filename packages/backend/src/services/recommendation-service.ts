/**
 * 🤖 RECOMMENDATION SERVICE
 *
 * Elite AI-powered recommendation engine using collaborative filtering
 * and content-based filtering for personalized recommendations
 *
 * @module services/recommendation-service
 */

import { supabase } from '../config/supabase';
import Redis from 'ioredis';
import { getRedisClient } from '../lib/redis';
import { Logger } from '../utils/logger';

interface Creator {
  id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  subscriber_count: number;
  content_count: number;
  categories: string[];
  average_rating: number;
  similarity_score?: number;
}

interface Content {
  id: string;
  title: string;
  description?: string;
  creator_id: string;
  creator_name: string;
  category: string;
  tags: string[];
  is_premium: boolean;
  view_count: number;
  engagement_score: number;
  recommendation_score?: number;
  personalization_score?: number;
}

interface FeedbackData {
  user_id: string;
  content_id: string;
  action: 'view' | 'like' | 'subscribe' | 'share' | 'hide' | 'report';
  rating?: number;
}

export class RecommendationService {
  private logger: Logger;
  private redis: Redis;

  constructor() {
    this.logger = new Logger('RecommendationService');
    this.redis = getRedisClient();
  }

  /**
   * Get creator recommendations based on user behavior
   */
  async getCreatorRecommendations(params: {
    user_id: string;
    limit: number;
  }): Promise<Creator[]> {
    try {
      // Get user's followed creators
      const { data: following } = await supabase
        .from('follows')
        .select('creator_id')
        .eq('follower_id', params.user_id);

      const followedCreatorIds = following?.map(f => f.creator_id) || [];

      if (followedCreatorIds.length === 0) {
        // New user - return popular creators
        return this.getPopularCreators(params.limit);
      }

      // Get categories from followed creators
      const { data: followedCreators } = await supabase
        .from('creators')
        .select('categories')
        .in('id', followedCreatorIds);

      const userCategories = new Set<string>();
      followedCreators?.forEach(creator => {
        creator.categories?.forEach((cat: string) => userCategories.add(cat));
      });

      // Find similar creators using collaborative filtering
      const { data: similarUsers } = await supabase
        .from('follows')
        .select('follower_id')
        .in('creator_id', followedCreatorIds)
        .neq('follower_id', params.user_id)
        .limit(100);

      const similarUserIds = similarUsers?.map(u => u.follower_id) || [];

      // Get creators followed by similar users
      const { data: recommendedCreators } = await supabase
        .from('follows')
        .select('creator_id, creators!inner(*)')
        .in('follower_id', similarUserIds)
        .not('creator_id', 'in', `(${followedCreatorIds.join(',')})`)
        .limit(params.limit * 2);

      // Score and rank recommendations
      const creatorScores = new Map<string, number>();
      const creatorData = new Map<string, any>();

      recommendedCreators?.forEach(rec => {
        const creatorId = rec.creator_id;
        const creator = rec.creators;

        if (!creatorScores.has(creatorId)) {
          creatorScores.set(creatorId, 0);
          creatorData.set(creatorId, creator);
        }

        // Increase score for each similar user who follows this creator
        creatorScores.set(creatorId, creatorScores.get(creatorId)! + 1);

        // Bonus score for matching categories
        const matchingCategories = creator.categories?.filter(
          (cat: string) => userCategories.has(cat)
        );
        creatorScores.set(
          creatorId,
          creatorScores.get(creatorId)! + matchingCategories.length * 0.5
        );
      });

      // Sort by score and return top recommendations
      const sortedCreators = Array.from(creatorScores.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, params.limit)
        .map(([creatorId, score]) => {
          const creator = creatorData.get(creatorId);
          return {
            id: creator.id,
            name: creator.name,
            avatar_url: creator.avatar_url,
            bio: creator.bio,
            subscriber_count: creator.subscriber_count || 0,
            content_count: creator.content_count || 0,
            categories: creator.categories || [],
            average_rating: creator.average_rating || 0,
            similarity_score: score,
          };
        });

      return sortedCreators;
    } catch (error) {
      this.logger.error('Failed to get creator recommendations', error);
      throw error;
    }
  }

  /**
   * Get content recommendations based on user history
   */
  async getContentRecommendations(params: {
    user_id: string;
    limit: number;
    exclude_viewed?: boolean;
  }): Promise<Content[]> {
    try {
      // Get user's content interaction history
      const { data: viewHistory } = await supabase
        .from('content_views')
        .select('content_id, content(*)')
        .eq('user_id', params.user_id)
        .order('viewed_at', { ascending: false })
        .limit(50);

      const viewedContentIds = viewHistory?.map(v => v.content_id) || [];

      if (viewedContentIds.length === 0) {
        // New user - return trending content
        return this.getTrendingContent(params.limit);
      }

      // Analyze user preferences from history
      const categoryCount = new Map<string, number>();
      const tagCount = new Map<string, number>();

      viewHistory?.forEach(view => {
        const content = view.content;
        if (content) {
          categoryCount.set(content.category, (categoryCount.get(content.category) || 0) + 1);
          content.tags?.forEach((tag: string) => {
            tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
          });
        }
      });

      // Get top preferences
      const topCategories = Array.from(categoryCount.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([cat]) => cat);

      const topTags = Array.from(tagCount.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag);

      // Build recommendation query
      let query = supabase
        .from('content')
        .select('*, creators!inner(*)')
        .eq('status', 'published')
        .or(`category.in.(${topCategories.join(',')}),tags.cs.{${topTags.join(',')}}`)
        .order('engagement_score', { ascending: false })
        .limit(params.limit * 2);

      if (params.exclude_viewed) {
        query = query.not('id', 'in', `(${viewedContentIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Score and rank recommendations
      const recommendations = (data || []).map(content => {
        let score = content.engagement_score || 0;

        // Boost score for matching categories
        if (topCategories.includes(content.category)) {
          score += 10 * (topCategories.indexOf(content.category) === 0 ? 2 : 1);
        }

        // Boost score for matching tags
        content.tags?.forEach((tag: string) => {
          if (topTags.includes(tag)) {
            score += 5;
          }
        });

        return {
          id: content.id,
          title: content.title,
          description: content.description,
          creator_id: content.creator_id,
          creator_name: content.creators?.name || 'Unknown',
          category: content.category,
          tags: content.tags || [],
          is_premium: content.is_premium || false,
          view_count: content.view_count || 0,
          engagement_score: content.engagement_score || 0,
          recommendation_score: score,
          personalization_score: this.calculatePersonalizationScore(
            content,
            topCategories,
            topTags
          ),
        };
      });

      // Sort by recommendation score and return top items
      return recommendations
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, params.limit);
    } catch (error) {
      this.logger.error('Failed to get content recommendations', error);
      throw error;
    }
  }

  /**
   * Track user search for improving recommendations
   */
  async trackSearch(userId: string, query: string): Promise<void> {
    try {
      await supabase.from('search_history').insert({
        user_id: userId,
        query,
        searched_at: new Date().toISOString(),
      });

      // Update user preferences based on search terms
      // This could trigger a background job for ML model update
    } catch (error) {
      this.logger.error('Failed to track search', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Process user feedback to improve recommendations
   */
  async processFeedback(data: FeedbackData): Promise<void> {
    try {
      // Store feedback
      await supabase.from('content_feedback').insert({
        user_id: data.user_id,
        content_id: data.content_id,
        action: data.action,
        rating: data.rating,
        created_at: new Date().toISOString(),
      });

      // Update user preferences based on feedback
      if (data.action === 'like' || data.action === 'subscribe') {
        // Positive signal - boost similar content
        await this.updateUserPreferences(data.user_id, data.content_id, 1);
      } else if (data.action === 'hide' || data.action === 'report') {
        // Negative signal - reduce similar content
        await this.updateUserPreferences(data.user_id, data.content_id, -1);
      }

      // Clear recommendation cache for user
      await this.redis.del(`recommendations:${data.user_id}`);
    } catch (error) {
      this.logger.error('Failed to process feedback', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Helper: Get popular creators for new users
   */
  private async getPopularCreators(limit: number): Promise<Creator[]> {
    try {
      const { data, error } = await supabase
        .from('creators')
        .select('*')
        .order('subscriber_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(creator => ({
        id: creator.id,
        name: creator.name,
        avatar_url: creator.avatar_url,
        bio: creator.bio,
        subscriber_count: creator.subscriber_count || 0,
        content_count: creator.content_count || 0,
        categories: creator.categories || [],
        average_rating: creator.average_rating || 0,
      }));
    } catch (error) {
      this.logger.error('Failed to get popular creators', error);
      return [];
    }
  }

  /**
   * Helper: Get trending content for new users
   */
  private async getTrendingContent(limit: number): Promise<Content[]> {
    try {
      const { data, error } = await supabase
        .from('content')
        .select('*, creators!inner(*)')
        .eq('status', 'published')
        .order('engagement_score', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(content => ({
        id: content.id,
        title: content.title,
        description: content.description,
        creator_id: content.creator_id,
        creator_name: content.creators?.name || 'Unknown',
        category: content.category,
        tags: content.tags || [],
        is_premium: content.is_premium || false,
        view_count: content.view_count || 0,
        engagement_score: content.engagement_score || 0,
      }));
    } catch (error) {
      this.logger.error('Failed to get trending content', error);
      return [];
    }
  }

  /**
   * Helper: Calculate personalization score
   */
  private calculatePersonalizationScore(
    content: any,
    userCategories: string[],
    userTags: string[]
  ): number {
    let score = 0;

    // Category match
    if (userCategories.includes(content.category)) {
      score += 30;
      if (userCategories[0] === content.category) {
        score += 20; // Top category bonus
      }
    }

    // Tag matches
    const matchingTags = content.tags?.filter((tag: string) => userTags.includes(tag)) || [];
    score += matchingTags.length * 10;

    // Normalize to 0-100
    return Math.min(100, score);
  }

  /**
   * Helper: Update user preferences based on interactions
   */
  private async updateUserPreferences(
    userId: string,
    contentId: string,
    weight: number
  ): Promise<void> {
    try {
      // Get content details
      const { data: content } = await supabase
        .from('content')
        .select('category, tags')
        .eq('id', contentId)
        .single();

      if (!content) return;

      // Update category preference
      await supabase.from('user_preferences').upsert({
        user_id: userId,
        preference_type: 'category',
        preference_value: content.category,
        weight,
        updated_at: new Date().toISOString(),
      });

      // Update tag preferences
      for (const tag of content.tags || []) {
        await supabase.from('user_preferences').upsert({
          user_id: userId,
          preference_type: 'tag',
          preference_value: tag,
          weight: weight * 0.5,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error('Failed to update user preferences', error);
    }
  }
}