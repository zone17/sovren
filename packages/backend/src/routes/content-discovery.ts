/**
 * 🔍 CONTENT DISCOVERY ROUTES
 *
 * Elite implementation of US-006: Content Discovery
 * Provides personalized content recommendations, trending content, and search capabilities
 *
 * @module routes/content-discovery
 */

import express from 'express';
import { z } from 'zod';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation-middleware';
import { ContentDiscoveryService } from '../services/content-discovery-service';
import { RecommendationService } from '../services/recommendation-service';

const router = express.Router();

// Initialize services
const discoveryService = new ContentDiscoveryService();
const recommendationService = new RecommendationService();

// Validation schemas
const SearchSchema = z.object({
  query: z.string().min(1).max(200),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  creator_id: z.string().optional(),
  premium_only: z.boolean().optional(),
  sort: z.enum(['relevance', 'recent', 'popular', 'trending']).optional().default('relevance'),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
});

const FeedSchema = z.object({
  categories: z.array(z.string()).optional(),
  exclude_categories: z.array(z.string()).optional(),
  following_only: z.boolean().optional().default(false),
  premium_only: z.boolean().optional().default(false),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
});

const TrendingSchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d', 'all']).optional().default('24h'),
  category: z.string().max(100).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

const CategoryParamSchema = z.object({
  category: z.string().min(1).max(100),
});

const CategoryQuerySchema = z.object({
  sort: z.enum(['recent', 'popular', 'trending']).optional().default('recent'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

const FeedbackSchema = z.object({
  content_id: z.string().uuid('content_id must be a valid UUID'),
  action: z.enum(['view', 'like', 'subscribe', 'share', 'hide', 'report']),
  rating: z.number().min(1).max(5).optional(),
});

/**
 * GET /api/content/discovery/feed
 * Get personalized content feed for the authenticated user
 * US-006: Content Discovery - Personalized Feed
 */
router.get(
  '/feed',
  optionalAuth,
  validateRequest(FeedSchema, 'query'),
  async (req, res) => {
    try {
      const userId = req.user?.id || req.user?.nostr_pubkey;
      const {
        categories,
        exclude_categories,
        following_only,
        premium_only,
        page,
        limit,
      } = req.query as z.infer<typeof FeedSchema>;

      // Get personalized feed based on user preferences and history
      const feedItems = await discoveryService.getPersonalizedFeed({
        user_id: userId,
        categories,
        exclude_categories,
        following_only,
        premium_only,
        page,
        limit,
      });

      res.json({
        success: true,
        data: feedItems.items,
        meta: {
          pagination: {
            page,
            limit,
            total: feedItems.total,
            totalPages: Math.ceil(feedItems.total / limit),
          },
          personalization: {
            enabled: !!userId,
            following_count: feedItems.following_count || 0,
          },
        },
      });
    } catch (error) {
      console.error('Failed to get personalized feed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve content feed',
        code: 'FEED_ERROR',
      });
    }
  }
);

/**
 * GET /api/content/discovery/trending
 * Get trending content across the platform
 * US-006: Content Discovery - Trending Content
 */
router.get('/trending', validateRequest(TrendingSchema, 'query'), async (req, res) => {
  try {
    const { timeframe, category, limit } = req.query as unknown as z.infer<typeof TrendingSchema>;

    const trendingContent = await discoveryService.getTrendingContent({
      timeframe,
      category,
      limit,
    });

    res.json({
      success: true,
      data: trendingContent,
      meta: {
        timeframe,
        category: category || 'all',
        count: trendingContent.length,
      },
    });
  } catch (error) {
    console.error('Failed to get trending content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trending content',
      code: 'TRENDING_ERROR',
    });
  }
});

/**
 * GET /api/content/discovery/categories
 * Get available content categories with content counts
 * US-006: Content Discovery - Category Browsing
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await discoveryService.getCategories();

    res.json({
      success: true,
      data: categories,
      meta: {
        count: categories.length,
      },
    });
  } catch (error) {
    console.error('Failed to get categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories',
      code: 'CATEGORIES_ERROR',
    });
  }
});

/**
 * GET /api/content/discovery/category/:category
 * Browse content by specific category
 * US-006: Content Discovery - Category Browsing
 */
router.get(
  '/category/:category',
  validateRequest(CategoryParamSchema, 'params'),
  validateRequest(CategoryQuerySchema, 'query'),
  async (req, res) => {
    try {
      const { category } = req.params as unknown as z.infer<typeof CategoryParamSchema>;
      const { sort, page, limit } = req.query as unknown as z.infer<typeof CategoryQuerySchema>;

      const content = await discoveryService.getContentByCategory({
        category,
        sort,
        page,
        limit,
      });

      res.json({
        success: true,
        data: content.items,
        meta: {
          category,
          pagination: {
            page,
            limit,
            total: content.total,
            totalPages: Math.ceil(content.total / limit),
          },
        },
      });
    } catch (error) {
      console.error('Failed to get category content:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve category content',
        code: 'CATEGORY_ERROR',
      });
    }
  }
);

/**
 * POST /api/content/discovery/search
 * Search for content with advanced filters
 * US-006: Content Discovery - Search
 */
router.post(
  '/search',
  optionalAuth,
  validateRequest(SearchSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id || req.user?.nostr_pubkey;
      const searchParams = req.body as z.infer<typeof SearchSchema>;

      const searchResults = await discoveryService.searchContent({
        ...searchParams,
        user_id: userId,
      });

      // Track search for analytics and recommendations
      if (userId) {
        await recommendationService.trackSearch(userId, searchParams.query);
      }

      res.json({
        success: true,
        data: searchResults.items,
        meta: {
          query: searchParams.query,
          pagination: {
            page: searchParams.page,
            limit: searchParams.limit,
            total: searchResults.total,
            totalPages: Math.ceil(searchResults.total / searchParams.limit),
          },
          filters: {
            category: searchParams.category,
            tags: searchParams.tags,
            premium_only: searchParams.premium_only,
          },
        },
      });
    } catch (error) {
      console.error('Failed to search content:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search content',
        code: 'SEARCH_ERROR',
      });
    }
  }
);

/**
 * GET /api/content/discovery/recommendations/creators
 * Get recommended creators based on user preferences
 * US-006: Content Discovery - Creator Recommendations
 */
router.get('/recommendations/creators', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.nostr_pubkey;
    const { limit = 10 } = req.query;

    const recommendedCreators = await recommendationService.getCreatorRecommendations({
      user_id: userId,
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: recommendedCreators,
      meta: {
        count: recommendedCreators.length,
        algorithm: 'collaborative_filtering_v2',
      },
    });
  } catch (error) {
    console.error('Failed to get creator recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve creator recommendations',
      code: 'RECOMMENDATIONS_ERROR',
    });
  }
});

/**
 * GET /api/content/discovery/recommendations/content
 * Get recommended content based on user history
 * US-006: Content Discovery - Content Recommendations
 */
router.get('/recommendations/content', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.nostr_pubkey;
    const { limit = 20, exclude_viewed = false } = req.query;

    const recommendedContent = await recommendationService.getContentRecommendations({
      user_id: userId,
      limit: Number(limit),
      exclude_viewed: exclude_viewed === 'true',
    });

    res.json({
      success: true,
      data: recommendedContent,
      meta: {
        count: recommendedContent.length,
        algorithm: 'hybrid_recommendation_v2',
        personalization_score: recommendedContent.personalization_score || 0,
      },
    });
  } catch (error) {
    console.error('Failed to get content recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve content recommendations',
      code: 'RECOMMENDATIONS_ERROR',
    });
  }
});

/**
 * GET /api/content/discovery/similar/:contentId
 * Get content similar to a specific piece of content
 * US-006: Content Discovery - Similar Content
 */
router.get('/similar/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { limit = 10 } = req.query;

    const similarContent = await discoveryService.getSimilarContent({
      content_id: contentId,
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: similarContent,
      meta: {
        source_content_id: contentId,
        count: similarContent.length,
      },
    });
  } catch (error) {
    console.error('Failed to get similar content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve similar content',
      code: 'SIMILAR_CONTENT_ERROR',
    });
  }
});

/**
 * POST /api/content/discovery/feedback
 * Provide feedback on recommendations to improve personalization
 * US-006: Content Discovery - Feedback Loop
 */
router.post('/feedback', authenticate, validateRequest(FeedbackSchema), async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.nostr_pubkey;
    const { content_id, action, rating } = req.body as z.infer<typeof FeedbackSchema>;

    await recommendationService.processFeedback({
      user_id: userId,
      content_id,
      action,
      rating: rating || undefined,
    });

    res.json({
      success: true,
      message: 'Feedback recorded successfully',
    });
  } catch (error) {
    console.error('Failed to process feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process feedback',
      code: 'FEEDBACK_ERROR',
    });
  }
});

/**
 * GET /api/content/discovery/explore
 * Explore new content outside user's usual preferences
 * US-006: Content Discovery - Exploration
 */
router.get('/explore', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.nostr_pubkey;
    const { limit = 20 } = req.query;

    const explorationContent = await discoveryService.getExplorationContent({
      user_id: userId,
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: explorationContent,
      meta: {
        count: explorationContent.length,
        exploration_mode: 'serendipity',
      },
    });
  } catch (error) {
    console.error('Failed to get exploration content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve exploration content',
      code: 'EXPLORATION_ERROR',
    });
  }
});

export default router;