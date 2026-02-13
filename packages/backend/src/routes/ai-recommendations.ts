/**
 * 🤖 **AI RECOMMENDATIONS API ROUTES**
 *
 * Elite API endpoints for AI-powered content recommendations
 * Implements US-095 through US-098
 *
 * Routes:
 * - GET /api/ai-recommendations - Get personalized recommendations (US-095)
 * - POST /api/ai-recommendations/behavior - Track behavior events (US-096)
 * - GET /api/ai-recommendations/similar/:contentId - Get similar content (US-097)
 * - POST /api/ai-recommendations/feedback - Submit feedback (US-098)
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rate-limit-middleware';
import { createAIRecommendationService } from '../services/ai-recommendation-service';
import type {
  RecommendationFeedback,
  RecommendationRequest,
  SimilarityCalculationRequest,
  UserBehaviorEvent,
} from '../types/ai-recommendations';

const router = Router();
const aiService = createAIRecommendationService();

// Simple validation middleware
const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      next(error);
    }
  };
};

// Rate limiter configuration
const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
});

// ===== Validation Schemas =====

const recommendationRequestSchema = z.object({
  query: z.object({
    context: z.enum([
      'homepage',
      'post_read',
      'search_results',
      'category_browse',
      'profile_visit',
    ]),
    content_id: z.string().uuid().optional(),
    limit: z.coerce.number().min(1).max(50).default(10),
    algorithm_preference: z
      .array(z.enum(['collaborative', 'content_based', 'hybrid', 'behavioral', 'trending']))
      .optional(),
    include_explanation: z.coerce.boolean().default(true),
  }),
});

const behaviorEventSchema = z.object({
  body: z.object({
    event_type: z.enum([
      'content_view',
      'content_like',
      'content_unlike',
      'content_comment',
      'content_share',
      'content_bookmark',
      'content_purchase',
      'creator_follow',
      'creator_unfollow',
      'search_query',
      'category_browse',
      'recommendation_click',
      'recommendation_dismiss',
      'feedback_positive',
      'feedback_negative',
    ]),
    content_id: z.string().uuid().optional(),
    content_type: z.string().optional(),
    content_tags: z.array(z.string()).optional(),
    creator_id: z.string().uuid().optional(),
    dwell_time: z.number().min(0).default(0),
    scroll_depth: z.number().min(0).max(1).default(0),
    interaction_quality: z.number().min(0).max(1).default(0.5),
    source_location: z.string().optional(),
    device_type: z.string().optional(),
    referrer_url: z.string().url().optional(),
    search_query: z.string().optional(),
  }),
});

const feedbackSchema = z.object({
  body: z.object({
    content_id: z.string().uuid(),
    recommendation_id: z.string().uuid().optional(),
    feedback_type: z.enum([
      'like',
      'dislike',
      'not_interested',
      'irrelevant',
      'inappropriate',
      'spam',
    ]),
    rating: z.number().min(1).max(5).optional(),
    recommendation_source: z.string().optional(),
    recommendation_algorithm: z.string().optional(),
    position_in_list: z.number().min(0).optional(),
    explanation_helpful: z.boolean().optional(),
    would_recommend_to_others: z.boolean().optional(),
    comments: z.string().max(500).optional(),
  }),
});

// ===== US-095: Personalized Content Recommendations =====

/**
 * @route GET /api/ai-recommendations
 * @desc Get personalized content recommendations for authenticated user
 * @access Private
 */
router.get(
  '/',
  authenticate,
  aiRateLimiter,
  validateRequest(recommendationRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const userPubkey = req.user?.nostr_pubkey;
      if (!userPubkey) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const request: RecommendationRequest = {
        user_id: userPubkey, // Using nostr_pubkey as user identifier
        context: req.query.context as any,
        content_id: req.query.content_id as string,
        limit: parseInt(req.query.limit as string) || 10,
        algorithm_preference: req.query.algorithm_preference as any,
        include_explanation: req.query.include_explanation === 'true',
      };

      const recommendations = await aiService.getPersonalizedRecommendations(request);

      res.json({
        success: true,
        data: recommendations,
        metadata: {
          user_pubkey: userPubkey,
          timestamp: new Date().toISOString(),
          api_version: '1.0',
        },
      });
    } catch (error: any) {
      console.error('Recommendation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recommendations',
        code: 'RECOMMENDATION_ERROR',
        details: error?.message || 'Unknown error',
      });
    }
  }
);

/**
 * @route PUT /api/ai-recommendations/preferences
 * @desc Update user preferences for personalized recommendations
 * @access Private
 */
router.put(
  '/preferences',
  authenticateToken,
  createRateLimiter({ windowMs: 60 * 1000, max: 10 }), // 10 updates per minute
  validateRequest(z.object({ body: userPreferencesSchema })),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const preferences = await aiService.updateUserPreferences(userId, req.body);

      res.json({
        success: true,
        data: preferences,
        message: 'User preferences updated successfully',
      });
    } catch (error) {
      console.error('Preferences update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences',
        code: 'PREFERENCES_ERROR',
        details: error.message,
      });
    }
  }
);

// ===== US-096: Behavioral Recommendations =====

/**
 * @route POST /api/ai-recommendations/behavior
 * @desc Track user behavior event for recommendation learning
 * @access Private
 */
router.post(
  '/behavior',
  authenticate,
  aiRateLimiter,
  validateRequest(behaviorEventSchema),
  async (req: Request, res: Response) => {
    try {
      const userPubkey = req.user?.nostr_pubkey;
      const sessionId = req.headers['x-session-id'] as string;

      const behaviorEvent: Omit<UserBehaviorEvent, 'id' | 'timestamp'> = {
        user_id: userPubkey,
        session_id: sessionId,
        processed_for_ml: false,
        ...req.body,
      };

      await aiService.trackBehaviorEvent(behaviorEvent);

      res.status(201).json({
        success: true,
        message: 'Behavior event tracked successfully',
        data: {
          event_type: behaviorEvent.event_type,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Behavior tracking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track behavior event',
        code: 'BEHAVIOR_TRACKING_ERROR',
        details: error?.message || 'Unknown error',
      });
    }
  }
);

/**
 * @route GET /api/ai-recommendations/behavioral
 * @desc Get behavioral recommendations based on user patterns
 * @access Private
 */
router.get('/behavioral', authenticate, aiRateLimiter, async (req: Request, res: Response) => {
  try {
    const userPubkey = req.user?.nostr_pubkey;
    if (!userPubkey) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const recommendations = await aiService.getBehavioralRecommendations(userPubkey, limit);

    res.json({
      success: true,
      data: recommendations,
      metadata: {
        algorithm: 'behavioral',
        user_pubkey: userPubkey,
        count: recommendations.length,
      },
    });
  } catch (error: any) {
    console.error('Behavioral recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get behavioral recommendations',
      code: 'BEHAVIORAL_ERROR',
      details: error?.message || 'Unknown error',
    });
  }
});

// ===== US-097: Content Similarity Analysis =====

/**
 * @route GET /api/ai-recommendations/similar/:contentId
 * @desc Get content similar to specified content
 * @access Private
 */
router.get(
  '/similar/:contentId',
  authenticate,
  aiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;

      if (!contentId) {
        return res.status(400).json({
          success: false,
          error: 'Content ID is required',
          code: 'MISSING_CONTENT_ID',
        });
      }

      const request: SimilarityCalculationRequest = {
        content_id: contentId,
        similarity_threshold: parseFloat(req.query.similarity_threshold as string) || 0.3,
        max_results: parseInt(req.query.max_results as string) || 10,
        include_reasons: req.query.include_reasons === 'true',
        calculation_method: (req.query.calculation_method as any) || 'hybrid',
      };

      const similarContent = await aiService.calculateContentSimilarity(request);

      res.json({
        success: true,
        data: similarContent,
        metadata: {
          content_id: contentId,
          algorithm: 'similarity_analysis',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Similarity calculation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate content similarity',
        code: 'SIMILARITY_ERROR',
        details: error?.message || 'Unknown error',
      });
    }
  }
);

/**
 * @route POST /api/ai-recommendations/similarity
 * @desc Calculate and store content similarity between two pieces of content
 * @access Private
 */
router.post(
  '/similarity',
  authenticateToken,
  createRateLimiter({ windowMs: 60 * 1000, max: 20 }), // 20 calculations per minute
  validateRequest(
    z.object({
      body: z.object({
        content_a_id: z.string().uuid(),
        content_b_id: z.string().uuid(),
        calculation_method: z
          .enum(['semantic', 'collaborative', 'content_based', 'hybrid'])
          .default('hybrid'),
      }),
    })
  ),
  async (req, res) => {
    try {
      const { content_a_id, content_b_id, calculation_method } = req.body;

      if (content_a_id === content_b_id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot calculate similarity between the same content',
          code: 'INVALID_COMPARISON',
        });
      }

      // Calculate similarity using the service
      const request: SimilarityCalculationRequest = {
        content_id: content_a_id,
        comparison_content_ids: [content_b_id],
        calculation_method,
      };

      const result = await aiService.calculateContentSimilarity(request);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Content similarity calculated successfully',
      });
    } catch (error) {
      console.error('Similarity storage error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate similarity',
        code: 'SIMILARITY_CALCULATION_ERROR',
        details: error.message,
      });
    }
  }
);

// ===== US-098: Recommendation Feedback =====

/**
 * @route POST /api/ai-recommendations/feedback
 * @desc Submit feedback on recommendation quality
 * @access Private
 */
router.post(
  '/feedback',
  authenticate,
  aiRateLimiter,
  validateRequest(feedbackSchema),
  async (req: Request, res: Response) => {
    try {
      const userPubkey = req.user?.nostr_pubkey;
      if (!userPubkey) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const feedbackData: Omit<RecommendationFeedback, 'id' | 'created_at'> = {
        user_id: userPubkey,
        processed_for_learning: false,
        impact_on_model: 0,
        ...req.body,
      };

      const feedback = await aiService.processFeedback(feedbackData);

      res.status(201).json({
        success: true,
        data: feedback,
        message: 'Feedback submitted successfully',
      });
    } catch (error: any) {
      console.error('Feedback processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process feedback',
        code: 'FEEDBACK_ERROR',
        details: error?.message || 'Unknown error',
      });
    }
  }
);

/**
 * @route GET /api/ai-recommendations/feedback/analytics
 * @desc Get feedback analytics for recommendations
 * @access Private (Admin only)
 */
router.get(
  '/feedback/analytics',
  authenticateToken,
  createRateLimiter({ windowMs: 60 * 1000, max: 10 }), // 10 requests per minute
  async (req, res) => {
    try {
      // Check if user has admin privileges
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      const startDate =
        (req.query.start_date as string) ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = (req.query.end_date as string) || new Date().toISOString();
      const algorithmType = req.query.algorithm_type as string;

      const analytics = await aiService.getFeedbackAnalytics(
        { start: startDate, end: endDate },
        { algorithm_type: algorithmType }
      );

      res.json({
        success: true,
        data: analytics,
        metadata: {
          time_range: { start: startDate, end: endDate },
          filters: { algorithm_type: algorithmType },
        },
      });
    } catch (error) {
      console.error('Feedback analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get feedback analytics',
        code: 'ANALYTICS_ERROR',
        details: error.message,
      });
    }
  }
);

// ===== Health Check =====

/**
 * @route GET /api/ai-recommendations/health
 * @desc Health check for AI recommendation service
 * @access Public
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: {
        personalized_recommendations: true,
        behavioral_tracking: true,
        similarity_analysis: true,
        feedback_processing: true,
      },
    };

    res.json({
      success: true,
      data: health,
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      details: error?.message || 'Unknown error',
    });
  }
});

// ===== Error Handling Middleware =====

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('AI Recommendations API Error:', error);

  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

export default router;
