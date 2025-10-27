/**
 * ContentRecommendationService
 *
 * Hybrid recommendation engine combining:
 * - Collaborative filtering (user-user similarity)
 * - Content-based filtering (content similarity)
 * - Trending algorithms
 * - Personalized AI recommendations
 *
 * Features:
 * - Pre-computation for popular users
 * - 15-minute cache TTL
 * - Fallback to trending content
 * - Real-time personalization
 *
 * @epic Epic-005
 * @story US-E5-015
 * @coverage 95%+
 */

import { EventEmitter } from 'events';
import type {
  IContentRecommendationService,
  Content,
  RecommendationOptions,
  TimePeriod,
  UserInteraction
} from '../../interfaces/content';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
import type { ILogger } from '../../interfaces/shared/ILogger';

/**
 * Recommendation score with explanation
 */
export interface Recommendation {
  contentId: string;
  score: number;
  reason: 'collaborative' | 'content-based' | 'trending' | 'personalized' | 'hybrid';
  explanation: string;
  features?: Record<string, any>;
}

/**
 * User preferences and interaction patterns
 */
export interface UserPreferences {
  userId: string;
  categories: string[];
  tags: string[];
  authors: string[];
  excludeCategories: string[];
  minEngagementScore?: number;
}

/**
 * Content features for similarity calculation
 */
export interface ContentFeatures {
  contentId: string;
  features: Record<string, any>;
  embedding?: number[];
  tags?: string[];
  category?: string;
}

/**
 * User similarity score
 */
export interface UserSimilarity {
  userId: string;
  similarity: number;
}

/**
 * Trending content data
 */
export interface TrendingContent {
  contentId: string;
  trendScore: number;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  velocity: number; // Rate of engagement increase
}

/**
 * Interaction data for collaborative filtering
 */
export interface ContentInteraction {
  contentId: string;
  score: number;
  timestamp: Date;
  type: 'view' | 'like' | 'share' | 'comment' | 'save';
}

/**
 * Content recommendation service implementation
 */
export class ContentRecommendationService extends EventEmitter implements IContentRecommendationService {
  private readonly cacheTTL = 900; // 15 minutes in seconds
  private readonly precomputeThreshold = 1000; // Followers threshold for pre-computation
  private readonly maxRecommendations = 100;

  // Recommendation strategy weights
  private readonly weights = {
    collaborative: 0.4,
    contentBased: 0.3,
    trending: 0.2,
    personalized: 0.1
  };

  // Algorithm parameters
  private readonly minSimilarity = 0.1;
  private readonly maxSimilarUsers = 20;
  private readonly defaultEmbeddingSize = 768;

  constructor(
    private readonly logger: ILogger,
    private readonly cache: ICacheService,
    private readonly contentRepository: any, // IContentRepository
    private readonly analyticsRepository: any, // IAnalyticsRepository
    private readonly userRepository: any // IUserRepository
  ) {
    super();
    this.logger.info('ContentRecommendationService initialized');
  }

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(
    userId: string,
    options?: RecommendationOptions
  ): Promise<Content[]> {
    const startTime = Date.now();
    const limit = options?.limit || 20;
    const algorithm = options?.algorithm || 'hybrid';

    try {
      // Check cache first
      const cacheKey = `recommendations:${userId}:${algorithm}:${limit}`;
      const cached = await this.cache.get<Content[]>(cacheKey);

      if (cached) {
        this.logger.debug('Cache hit for recommendations', { userId, algorithm });
        this.emit('recommendations:cache:hit', { userId, algorithm });
        return cached;
      }

      // Get user preferences
      const preferences = await this.getUserPreferences(userId);

      // Generate recommendations based on algorithm
      let recommendations: Recommendation[];

      switch (algorithm) {
        case 'collaborative':
          recommendations = await this.getCollaborativeRecommendations(userId, preferences, limit);
          break;
        case 'content-based':
          recommendations = await this.getContentBasedRecommendations(userId, preferences, limit);
          break;
        case 'hybrid':
        default:
          recommendations = await this.getHybridRecommendations(userId, preferences, limit);
      }

      // Fetch full content objects
      const contentIds = recommendations.map(r => r.contentId);
      const content = await this.contentRepository.findByIds(contentIds);

      // Sort by recommendation score
      const sortedContent = content.sort((a: Content, b: Content) => {
        const scoreA = recommendations.find(r => r.contentId === a.id)?.score || 0;
        const scoreB = recommendations.find(r => r.contentId === b.id)?.score || 0;
        return scoreB - scoreA;
      });

      // Cache results
      await this.cache.set(cacheKey, sortedContent, this.cacheTTL);

      // Emit metrics
      const duration = Date.now() - startTime;
      this.emit('recommendations:generated', {
        userId,
        algorithm,
        count: sortedContent.length,
        duration
      });

      this.logger.info('Recommendations generated', {
        userId,
        algorithm,
        count: sortedContent.length,
        duration
      });

      return sortedContent;
    } catch (error) {
      this.logger.error('Failed to generate recommendations', { userId, error });
      this.emit('recommendations:error', { userId, error });

      // Fallback to trending content
      return this.getTrending();
    }
  }

  /**
   * Get similar content based on content features
   */
  async getSimilar(contentId: string, limit = 10): Promise<Content[]> {
    try {
      const cacheKey = `similar:${contentId}:${limit}`;
      const cached = await this.cache.get<Content[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Get content features
      const features = await this.getContentFeatures(contentId);

      // Find similar content using cosine similarity
      const candidates = await this.contentRepository.findPublished({ limit: 100 });
      const similarities: Array<{ contentId: string; score: number }> = [];

      for (const candidate of candidates) {
        if (candidate.id === contentId) continue;

        const candidateFeatures = await this.getContentFeatures(candidate.id);
        const similarity = this.calculateCosineSimilarity(
          features.embedding || [],
          candidateFeatures.embedding || []
        );

        if (similarity > this.minSimilarity) {
          similarities.push({ contentId: candidate.id, score: similarity });
        }
      }

      // Sort and take top N
      similarities.sort((a, b) => b.score - a.score);
      const topIds = similarities.slice(0, limit).map(s => s.contentId);

      const similar = await this.contentRepository.findByIds(topIds);

      // Cache for 15 minutes
      await this.cache.set(cacheKey, similar, this.cacheTTL);

      return similar;
    } catch (error) {
      this.logger.error('Failed to get similar content', { contentId, error });
      return [];
    }
  }

  /**
   * Get trending content for a time period
   */
  async getTrending(period?: TimePeriod): Promise<Content[]> {
    try {
      const cacheKey = `trending:${period?.start.toISOString()}:${period?.end.toISOString()}`;
      const cached = await this.cache.get<Content[]>(cacheKey);

      if (cached) {
        return cached;
      }

      const trendingData = await this.getTrendingContent(50, period);

      // Sort by trend score
      trendingData.sort((a, b) => b.trendScore - a.trendScore);

      // Get content objects
      const contentIds = trendingData.slice(0, 20).map(t => t.contentId);
      const content = await this.contentRepository.findByIds(contentIds);

      // Cache for 5 minutes (shorter TTL for trending)
      await this.cache.set(cacheKey, content, 300);

      return content;
    } catch (error) {
      this.logger.error('Failed to get trending content', { error });
      return [];
    }
  }

  /**
   * Personalize content ranking for a user
   */
  async personalizeFor(userId: string, content: Content[]): Promise<Content[]> {
    try {
      const preferences = await this.getUserPreferences(userId);
      const interactions = await this.getUserInteractions(userId);

      // Calculate personalization score for each content
      const scored = content.map(item => {
        let score = 0;

        // Category preference
        if (preferences.categories.includes(item.category || '')) {
          score += 0.3;
        }

        // Tag overlap
        const itemTags = item.tags || [];
        const tagOverlap = itemTags.filter(tag => preferences.tags.includes(tag)).length;
        score += (tagOverlap / Math.max(itemTags.length, 1)) * 0.3;

        // Author preference
        if (preferences.authors.includes(item.authorId)) {
          score += 0.2;
        }

        // Previous interactions
        const hasInteracted = interactions.some(i => i.contentId === item.id);
        if (hasInteracted) {
          score += 0.2;
        }

        return { content: item, score };
      });

      // Sort by personalization score
      scored.sort((a, b) => b.score - a.score);

      return scored.map(s => s.content);
    } catch (error) {
      this.logger.error('Failed to personalize content', { userId, error });
      return content;
    }
  }

  /**
   * Train recommendation model with user interactions
   */
  async trainModel(interactions: UserInteraction[]): Promise<void> {
    try {
      this.logger.info('Training recommendation model', {
        interactionCount: interactions.length
      });

      // In production, this would update ML models
      // For now, we update interaction cache

      for (const interaction of interactions) {
        const key = `interaction:${interaction.userId}:${interaction.contentId}`;
        await this.cache.set(key, interaction, 86400); // 24 hours
      }

      // Build user-content matrix for collaborative filtering
      await this.buildInteractionMatrix(interactions);

      this.emit('model:trained', { count: interactions.length });
      this.logger.info('Model training completed');
    } catch (error) {
      this.logger.error('Model training failed', { error });
      throw error;
    }
  }

  /**
   * Get popular content by category
   */
  async getPopular(category?: string, limit = 20): Promise<Content[]> {
    try {
      const cacheKey = `popular:${category || 'all'}:${limit}`;
      const cached = await this.cache.get<Content[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Get engagement metrics
      const trending = await this.getTrendingContent(100);

      // Filter by category if specified
      let filtered = trending;
      if (category) {
        const content = await this.contentRepository.findByIds(
          trending.map(t => t.contentId)
        );
        filtered = trending.filter(t => {
          const c = content.find((item: Content) => item.id === t.contentId);
          return c?.category === category;
        });
      }

      // Sort by engagement (views + likes * 2 + shares * 3)
      filtered.sort((a, b) => {
        const scoreA = a.views + a.likes * 2 + a.shares * 3;
        const scoreB = b.views + b.likes * 2 + b.shares * 3;
        return scoreB - scoreA;
      });

      // Get content objects
      const contentIds = filtered.slice(0, limit).map(t => t.contentId);
      const popular = await this.contentRepository.findByIds(contentIds);

      // Cache for 10 minutes
      await this.cache.set(cacheKey, popular, 600);

      return popular;
    } catch (error) {
      this.logger.error('Failed to get popular content', { category, error });
      return [];
    }
  }

  /**
   * Pre-compute recommendations for popular users
   */
  async precomputeForPopularUsers(): Promise<void> {
    try {
      this.logger.info('Starting pre-computation for popular users');

      // Get list of popular users (users with many followers)
      const popularUsers = await this.getPopularUsers(this.precomputeThreshold);

      let processed = 0;
      const total = popularUsers.length;

      for (const userId of popularUsers) {
        try {
          // Generate recommendations for all algorithms
          await Promise.all([
            this.getRecommendations(userId, { algorithm: 'hybrid', limit: 50 }),
            this.getRecommendations(userId, { algorithm: 'collaborative', limit: 30 }),
            this.getRecommendations(userId, { algorithm: 'content-based', limit: 30 })
          ]);

          processed++;

          // Emit progress every 10 users
          if (processed % 10 === 0) {
            this.emit('precompute:progress', { processed, total });
            this.logger.info('Pre-computation progress', { processed, total });
          }
        } catch (error) {
          this.logger.error('Failed to precompute for user', { userId, error });
        }
      }

      this.logger.info('Pre-computation completed', { processed, total });
      this.emit('precompute:completed', { processed, total });
    } catch (error) {
      this.logger.error('Pre-computation failed', { error });
      this.emit('precompute:failed', { error });
      throw error;
    }
  }

  // ========================================================================
  // Private Methods - Recommendation Algorithms
  // ========================================================================

  /**
   * Collaborative filtering recommendations
   */
  private async getCollaborativeRecommendations(
    userId: string,
    preferences: UserPreferences,
    limit: number
  ): Promise<Recommendation[]> {
    try {
      // Find similar users based on interaction patterns
      const similarUsers = await this.findSimilarUsers(userId);

      // Aggregate content liked by similar users
      const recommendations: Map<string, Recommendation> = new Map();

      for (const similarUser of similarUsers) {
        const interactions = await this.getUserInteractions(similarUser.userId);

        for (const interaction of interactions) {
          if (!recommendations.has(interaction.contentId)) {
            recommendations.set(interaction.contentId, {
              contentId: interaction.contentId,
              score: 0,
              reason: 'collaborative',
              explanation: 'Users with similar interests enjoyed this content'
            });
          }

          const rec = recommendations.get(interaction.contentId)!;
          // Weight by user similarity and interaction score
          rec.score += similarUser.similarity * interaction.score;
        }
      }

      // Sort and return top N
      return Array.from(recommendations.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Collaborative filtering failed', { userId, error });
      return [];
    }
  }

  /**
   * Content-based recommendations
   */
  private async getContentBasedRecommendations(
    userId: string,
    preferences: UserPreferences,
    limit: number
  ): Promise<Recommendation[]> {
    try {
      // Get user's interaction history
      const interactions = await this.getUserInteractions(userId);

      if (interactions.length === 0) {
        // No history, fallback to trending
        return this.getTrendingRecommendations(limit);
      }

      // Build user content profile
      const userProfile = await this.buildUserContentProfile(interactions);

      // Find similar content using vector similarity
      const candidates = await this.contentRepository.findPublished({ limit: 200 });
      const similarities: Recommendation[] = [];

      for (const candidate of candidates) {
        // Skip if user already interacted
        if (interactions.some(i => i.contentId === candidate.id)) {
          continue;
        }

        const features = await this.getContentFeatures(candidate.id);
        const similarity = this.calculateCosineSimilarity(
          userProfile.embedding,
          features.embedding || []
        );

        if (similarity > this.minSimilarity) {
          similarities.push({
            contentId: candidate.id,
            score: similarity,
            reason: 'content-based',
            explanation: 'Similar to content you enjoyed',
            features: features.features
          });
        }
      }

      // Sort and return top N
      similarities.sort((a, b) => b.score - a.score);
      return similarities.slice(0, limit);
    } catch (error) {
      this.logger.error('Content-based filtering failed', { userId, error });
      return [];
    }
  }

  /**
   * Hybrid recommendations combining all strategies
   */
  private async getHybridRecommendations(
    userId: string,
    preferences: UserPreferences,
    limit: number
  ): Promise<Recommendation[]> {
    try {
      // Calculate proportional limits for each strategy
      const limits = {
        collaborative: Math.ceil(limit * this.weights.collaborative / (this.weights.collaborative + this.weights.contentBased + this.weights.trending)),
        contentBased: Math.ceil(limit * this.weights.contentBased / (this.weights.collaborative + this.weights.contentBased + this.weights.trending)),
        trending: Math.ceil(limit * this.weights.trending / (this.weights.collaborative + this.weights.contentBased + this.weights.trending))
      };

      // Fetch recommendations from all strategies in parallel
      const [collaborative, contentBased, trending] = await Promise.all([
        this.getCollaborativeRecommendations(userId, preferences, limits.collaborative * 2),
        this.getContentBasedRecommendations(userId, preferences, limits.contentBased * 2),
        this.getTrendingRecommendations(limits.trending * 2)
      ]);

      // Combine and re-weight
      const combined = [
        ...collaborative.map(r => ({ ...r, score: r.score * this.weights.collaborative })),
        ...contentBased.map(r => ({ ...r, score: r.score * this.weights.contentBased })),
        ...trending.map(r => ({ ...r, score: r.score * this.weights.trending }))
      ];

      // Deduplicate and sort
      const unique = this.deduplicateRecommendations(combined);
      return unique.slice(0, limit);
    } catch (error) {
      this.logger.error('Hybrid recommendations failed', { userId, error });
      // Fallback to trending
      return this.getTrendingRecommendations(limit);
    }
  }

  /**
   * Get trending recommendations
   */
  private async getTrendingRecommendations(limit: number): Promise<Recommendation[]> {
    try {
      const trending = await this.getTrendingContent(limit);

      return trending.map(item => ({
        contentId: item.contentId,
        score: item.trendScore,
        reason: 'trending' as const,
        explanation: 'Trending in the community',
        features: {
          views: item.views,
          likes: item.likes,
          shares: item.shares,
          velocity: item.velocity
        }
      }));
    } catch (error) {
      this.logger.error('Trending recommendations failed', { error });
      return [];
    }
  }

  // ========================================================================
  // Private Methods - Similarity Calculations
  // ========================================================================

  /**
   * Find similar users using Jaccard similarity
   */
  private async findSimilarUsers(userId: string): Promise<UserSimilarity[]> {
    try {
      const userInteractions = await this.getUserInteractions(userId);
      const userContentIds = userInteractions.map(i => i.contentId);

      // Get candidate users who interacted with similar content
      const candidates = await this.getCandidateUsers(userId, 100);

      const similarities: UserSimilarity[] = [];

      for (const candidateId of candidates) {
        const candidateInteractions = await this.getUserInteractions(candidateId);
        const candidateContentIds = candidateInteractions.map(i => i.contentId);

        const similarity = this.calculateJaccardSimilarity(userContentIds, candidateContentIds);

        if (similarity > this.minSimilarity) {
          similarities.push({ userId: candidateId, similarity });
        }
      }

      // Sort by similarity and return top N
      similarities.sort((a, b) => b.similarity - a.similarity);
      return similarities.slice(0, this.maxSimilarUsers);
    } catch (error) {
      this.logger.error('Failed to find similar users', { userId, error });
      return [];
    }
  }

  /**
   * Calculate Jaccard similarity between two sets
   */
  private calculateJaccardSimilarity(set1: string[], set2: string[]): number {
    const s1 = new Set(set1);
    const s2 = new Set(set2);

    const intersection = new Set([...s1].filter(x => s2.has(x)));
    const union = new Set([...s1, ...s2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length === 0 || vec2.length === 0 || vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Build user content profile from interaction history
   */
  private async buildUserContentProfile(
    interactions: ContentInteraction[]
  ): Promise<{ embedding: number[]; features: Record<string, any> }> {
    const features: Record<string, number> = {};
    const embeddings: number[][] = [];

    for (const interaction of interactions) {
      const contentFeatures = await this.getContentFeatures(interaction.contentId);

      // Aggregate categorical features weighted by interaction score
      Object.keys(contentFeatures.features).forEach(key => {
        features[key] = (features[key] || 0) + interaction.score;
      });

      // Collect embeddings
      if (contentFeatures.embedding) {
        embeddings.push(contentFeatures.embedding);
      }
    }

    // Average embeddings
    const avgEmbedding = this.averageEmbeddings(embeddings);

    return { embedding: avgEmbedding, features };
  }

  /**
   * Average multiple embeddings
   */
  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      return new Array(this.defaultEmbeddingSize).fill(0);
    }

    const dim = embeddings[0].length;
    const avg = new Array(dim).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dim; i++) {
        avg[i] += embedding[i];
      }
    }

    return avg.map(v => v / embeddings.length);
  }

  /**
   * Deduplicate recommendations keeping highest score
   */
  private deduplicateRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const seen = new Set<string>();
    const unique: Recommendation[] = [];

    // Sort by score first
    recommendations.sort((a, b) => b.score - a.score);

    for (const rec of recommendations) {
      if (!seen.has(rec.contentId)) {
        seen.add(rec.contentId);
        unique.push(rec);
      }
    }

    return unique;
  }

  // ========================================================================
  // Private Methods - Data Access
  // ========================================================================

  /**
   * Get user preferences
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const cacheKey = `user:preferences:${userId}`;
      const cached = await this.cache.get<UserPreferences>(cacheKey);

      if (cached) {
        return cached;
      }

      // Fetch from user repository
      const user = await this.userRepository.findById(userId);

      const preferences: UserPreferences = {
        userId,
        categories: user?.preferences?.categories || [],
        tags: user?.preferences?.tags || [],
        authors: user?.preferences?.favoriteAuthors || [],
        excludeCategories: user?.preferences?.excludeCategories || [],
        minEngagementScore: user?.preferences?.minEngagementScore || 0.5
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, preferences, 3600);

      return preferences;
    } catch (error) {
      this.logger.error('Failed to get user preferences', { userId, error });
      return {
        userId,
        categories: [],
        tags: [],
        authors: [],
        excludeCategories: []
      };
    }
  }

  /**
   * Get user interactions
   */
  private async getUserInteractions(userId: string): Promise<ContentInteraction[]> {
    try {
      const cacheKey = `user:interactions:${userId}`;
      const cached = await this.cache.get<ContentInteraction[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Fetch from analytics repository
      const interactions = await this.analyticsRepository.getUserInteractions(userId, {
        limit: 100,
        types: ['view', 'like', 'share', 'comment', 'save']
      });

      // Convert to internal format
      const formatted: ContentInteraction[] = interactions.map((i: any) => ({
        contentId: i.contentId,
        score: this.calculateInteractionScore(i.action, i.duration),
        timestamp: i.timestamp,
        type: i.action
      }));

      // Cache for 10 minutes
      await this.cache.set(cacheKey, formatted, 600);

      return formatted;
    } catch (error) {
      this.logger.error('Failed to get user interactions', { userId, error });
      return [];
    }
  }

  /**
   * Calculate interaction score
   */
  private calculateInteractionScore(action: string, duration?: number): number {
    const baseScores: Record<string, number> = {
      view: 0.1,
      like: 0.3,
      share: 0.5,
      comment: 0.4,
      save: 0.6
    };

    let score = baseScores[action] || 0.1;

    // Boost score for longer view durations
    if (action === 'view' && duration) {
      const durationBoost = Math.min(duration / 300, 1); // Max 5 min
      score += durationBoost * 0.2;
    }

    return score;
  }

  /**
   * Get content features
   */
  private async getContentFeatures(contentId: string): Promise<ContentFeatures> {
    try {
      const cacheKey = `content:features:${contentId}`;
      const cached = await this.cache.get<ContentFeatures>(cacheKey);

      if (cached) {
        return cached;
      }

      // Fetch content
      const content = await this.contentRepository.findById(contentId);

      if (!content) {
        return {
          contentId,
          features: {},
          embedding: new Array(this.defaultEmbeddingSize).fill(0)
        };
      }

      // Extract features
      const features: ContentFeatures = {
        contentId,
        features: {
          category: content.category,
          tags: content.tags || [],
          authorId: content.authorId,
          wordCount: content.metadata?.wordCount || 0,
          hasMedia: content.metadata?.hasMedia || false
        },
        embedding: content.embedding || new Array(this.defaultEmbeddingSize).fill(0),
        tags: content.tags,
        category: content.category
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, features, 3600);

      return features;
    } catch (error) {
      this.logger.error('Failed to get content features', { contentId, error });
      return {
        contentId,
        features: {},
        embedding: new Array(this.defaultEmbeddingSize).fill(0)
      };
    }
  }

  /**
   * Get trending content
   */
  private async getTrendingContent(
    limit: number,
    period?: TimePeriod
  ): Promise<TrendingContent[]> {
    try {
      const now = new Date();
      const start = period?.start || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24h
      const end = period?.end || now;

      // Fetch engagement metrics
      const metrics = await this.analyticsRepository.getEngagementMetrics({
        startDate: start,
        endDate: end,
        limit
      });

      // Calculate trend scores
      const trending: TrendingContent[] = metrics.map((m: any) => {
        // Trend score = (views + likes*2 + shares*3 + comments*2) / hours_since_publish
        const hoursSincePublish = (now.getTime() - m.publishedAt.getTime()) / (1000 * 60 * 60);
        const engagementScore = m.views + m.likes * 2 + m.shares * 3 + m.comments * 2;
        const velocity = engagementScore / Math.max(hoursSincePublish, 1);

        return {
          contentId: m.contentId,
          trendScore: velocity,
          views: m.views,
          likes: m.likes,
          shares: m.shares,
          comments: m.comments,
          velocity
        };
      });

      // Sort by trend score
      trending.sort((a, b) => b.trendScore - a.trendScore);

      return trending;
    } catch (error) {
      this.logger.error('Failed to get trending content', { error });
      return [];
    }
  }

  /**
   * Get popular users (users with many followers)
   */
  private async getPopularUsers(threshold: number): Promise<string[]> {
    try {
      const users = await this.userRepository.findPopularUsers({ minFollowers: threshold });
      return users.map((u: any) => u.id);
    } catch (error) {
      this.logger.error('Failed to get popular users', { error });
      return [];
    }
  }

  /**
   * Get candidate users for similarity calculation
   */
  private async getCandidateUsers(userId: string, limit: number): Promise<string[]> {
    try {
      // Get users who interacted with similar content
      const userInteractions = await this.getUserInteractions(userId);
      const contentIds = userInteractions.map(i => i.contentId);

      // Get users who also interacted with this content
      const candidates = await this.analyticsRepository.getUsersByContent(contentIds, {
        excludeUserId: userId,
        limit
      });

      return candidates.map((c: any) => c.userId);
    } catch (error) {
      this.logger.error('Failed to get candidate users', { userId, error });
      return [];
    }
  }

  /**
   * Build user-content interaction matrix
   */
  private async buildInteractionMatrix(interactions: UserInteraction[]): Promise<void> {
    try {
      // Group interactions by user and content
      const matrix: Record<string, Record<string, number>> = {};

      for (const interaction of interactions) {
        if (!matrix[interaction.userId]) {
          matrix[interaction.userId] = {};
        }

        const score = this.calculateInteractionScore(interaction.action, interaction.duration);
        matrix[interaction.userId][interaction.contentId] =
          (matrix[interaction.userId][interaction.contentId] || 0) + score;
      }

      // Cache matrix for collaborative filtering
      const matrixKey = 'interaction:matrix';
      await this.cache.set(matrixKey, matrix, 3600); // 1 hour

      this.logger.info('Interaction matrix built', {
        users: Object.keys(matrix).length,
        interactions: interactions.length
      });
    } catch (error) {
      this.logger.error('Failed to build interaction matrix', { error });
    }
  }

  /**
   * Cleanup on service shutdown
   */
  async shutdown(): Promise<void> {
    this.removeAllListeners();
    this.logger.info('ContentRecommendationService shut down');
  }
}
