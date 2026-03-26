// @ts-nocheck
/**
 * 🤖 **AI-ENHANCED FEATURES API ROUTES**
 *
 * Complete API implementation for US-103 through US-106
 * Elite engineering with comprehensive validation and error handling
 *
 * Routes:
 * - US-103: /api/ai/content/tags/* - Automatic Content Tagging
 * - US-104: /api/ai/content/topics/* - Topic Extraction
 * - US-105: /api/ai/content/clusters/* - Content Clustering
 * - US-106: /api/ai/content/related/* - Related Content Suggestions
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { createAIEnhancedFeaturesService } from '../services/ai-enhanced-features-service';
import {
  ContentClusteringError,
  ContentTaggingError,
  RelatedContentError,
  TopicExtractionError,
} from '../types/ai-enhanced-features';

const router = Router();
const aiService = createAIEnhancedFeaturesService();

// =====================================================
// VALIDATION MIDDLEWARE
// =====================================================

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

// =====================================================
// RATE LIMITING CONFIGURATION
// =====================================================

const tagGenerationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many tag generation requests',
  standardHeaders: true,
  legacyHeaders: false,
});

const topicExtractionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // More expensive operation
  message: 'Too many topic extraction requests',
});

const clusteringLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Very expensive operation
  message: 'Too many clustering requests',
});

const relatedContentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Frequent operation
  message: 'Too many related content requests',
});

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const tagGenerationSchema = z.object({
  body: z.object({
    contentId: z.string().uuid(),
    contentText: z.string().min(10),
    config: z.record(z.any()).optional(),
  }),
});

const tagFeedbackSchema = z.object({
  body: z.object({
    contentId: z.string().uuid(),
    approvedTags: z.array(z.string()).optional(),
    rejectedTags: z.array(z.string()).optional(),
    addedTags: z.array(z.string()).optional(),
    feedback: z.string().optional(),
  }),
});

const topicExtractionSchema = z.object({
  body: z.object({
    contentId: z.string().uuid(),
    contentText: z.string().min(50),
    config: z.record(z.any()).optional(),
  }),
});

const clusteringSchema = z.object({
  body: z.object({
    contentIds: z.array(z.string().uuid()).min(5),
    config: z.record(z.any()).optional(),
  }),
});

const relatedContentFeedbackSchema = z.object({
  body: z.object({
    suggestionId: z.string().uuid(),
    contentId: z.string().uuid(),
    targetContentId: z.string().uuid(),
    interactionType: z.enum(['click', 'view', 'like', 'share', 'dismiss']),
  }),
});

const enhanceContentSchema = z.object({
  body: z.object({
    contentId: z.string().uuid(),
    contentText: z.string().min(50),
    contentMetadata: z.record(z.any()),
    enhancements: z.array(z.enum(['tagging', 'topic_extraction', 'clustering', 'related_content'])),
    options: z.record(z.any()).optional(),
  }),
});

// =====================================================
// US-103: AUTOMATIC CONTENT TAGGING ROUTES
// =====================================================

/**
 * POST /api/ai/content/tags/generate
 * 7.9.1-7.9.3: Generate automatic tags for content
 */
router.post(
  '/tags/generate',
  authenticate,
  tagGenerationLimiter,
  validateRequest(tagGenerationSchema),
  async (req, res) => {
    try {
      const { contentId, contentText, config } = req.body;

      const result = await aiService.generateContentTags(contentId, contentText, config);

      res.json({
        success: true,
        data: result,
        metadata: {
          processingTime: result.processingTime,
          algorithm: result.algorithm,
          modelVersion: result.modelVersion,
        },
      });
    } catch (error) {
      if (error instanceof ContentTaggingError) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            contentId: error.contentId,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to generate content tags',
          },
        });
      }
    }
  }
);

/**
 * POST /api/ai/content/tags/feedback
 * 7.9.6-7.9.7: Submit tag feedback for learning
 */
router.post(
  '/tags/feedback',
  authenticate,
  validateRequest(tagFeedbackSchema),
  async (req, res) => {
    try {
      const {
        contentId,
        approvedTags = [],
        rejectedTags = [],
        addedTags = [],
        feedback,
      } = req.body;
      const userId = req.user?.nostr_pubkey;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'User authentication required' },
        });
      }

      await aiService.procesTagFeedback(contentId, userId, {
        approvedTags,
        rejectedTags,
        addedTags,
        feedback,
      });

      res.json({
        success: true,
        message: 'Tag feedback processed successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FEEDBACK_ERROR',
          message: error.message,
        },
      });
    }
  }
);

/**
 * GET /api/ai/content/tags/:contentId
 * Retrieve tags for specific content
 */
router.get('/tags/:contentId', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { category, minConfidence = 0.5 } = req.query;

    const tags = await aiService.getContentTags(contentId, {
      category: category as string,
      minConfidence: parseFloat(minConfidence as string),
    });

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'TAG_RETRIEVAL_ERROR',
        message: error.message,
      },
    });
  }
});

// =====================================================
// US-104: TOPIC EXTRACTION ROUTES
// =====================================================

/**
 * POST /api/ai/content/topics/extract
 * 7.10.1-7.10.3: Extract topics from content
 */
router.post(
  '/topics/extract',
  authenticate,
  topicExtractionLimiter,
  validateRequest(topicExtractionSchema),
  async (req, res) => {
    try {
      const { contentId, contentText, config } = req.body;

      const topics = await aiService.extractContentTopics(contentId, contentText, config);

      res.json({
        success: true,
        data: topics,
        metadata: {
          extractionMethod: 'hybrid',
          topicCount: topics.length,
          processingTime: Date.now(),
        },
      });
    } catch (error) {
      if (error instanceof TopicExtractionError) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            contentId: error.contentId,
            algorithm: error.algorithm,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to extract topics',
          },
        });
      }
    }
  }
);

/**
 * GET /api/ai/content/topics/trends/:topicId
 * 7.10.7: Analyze topic trends
 */
router.get('/topics/trends/:topicId', authenticate, async (req, res) => {
  try {
    const { topicId } = req.params;
    const { timeframe = 'week' } = req.query;

    const trends = await aiService.analyzeTopicTrends(
      topicId,
      timeframe as 'day' | 'week' | 'month' | 'year'
    );

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'TREND_ANALYSIS_ERROR',
        message: error.message,
      },
    });
  }
});

/**
 * GET /api/ai/content/topics/hierarchy
 * 7.10.5: Get topic hierarchy
 */
router.get('/topics/hierarchy', authenticate, async (req, res) => {
  try {
    const { rootTopic, maxDepth = 3 } = req.query;

    const hierarchy = await aiService.getTopicHierarchy(
      rootTopic as string,
      parseInt(maxDepth as string)
    );

    res.json({
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'HIERARCHY_ERROR',
        message: error.message,
      },
    });
  }
});

// =====================================================
// US-105: CONTENT CLUSTERING ROUTES
// =====================================================

/**
 * POST /api/ai/content/clusters/create
 * 7.11.1-7.11.3: Perform content clustering
 */
router.post(
  '/clusters/create',
  authenticate,
  clusteringLimiter,
  validateRequest(clusteringSchema),
  async (req, res) => {
    try {
      const { contentIds, config } = req.body;

      const clusters = await aiService.performContentClustering(contentIds, config);

      res.json({
        success: true,
        data: clusters,
        metadata: {
          clusterCount: clusters.length,
          totalContent: contentIds.length,
          algorithm: config?.algorithm || 'kmeans',
        },
      });
    } catch (error) {
      if (error instanceof ContentClusteringError) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            algorithm: error.algorithm,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to perform clustering',
          },
        });
      }
    }
  }
);

/**
 * GET /api/ai/content/clusters
 * 7.11.6: Get content clusters with management options
 */
router.get('/clusters', authenticate, async (req, res) => {
  try {
    const { algorithm, minQuality = 0.5, isActive = true, page = 1, limit = 20 } = req.query;

    const clusters = await aiService.getClusters({
      algorithm: algorithm as string,
      minQuality: parseFloat(minQuality as string),
      isActive: isActive === 'true',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.json({
      success: true,
      data: clusters,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CLUSTER_RETRIEVAL_ERROR',
        message: error.message,
      },
    });
  }
});

/**
 * GET /api/ai/content/clusters/:clusterId/analytics
 * 7.11.4 & 7.11.8: Cluster quality metrics and analytics
 */
router.get('/clusters/:clusterId/analytics', authenticate, async (req, res) => {
  try {
    const { clusterId } = req.params;
    const { timeframe = 'week' } = req.query;

    const analytics = await aiService.getClusterAnalytics(
      clusterId,
      timeframe as 'day' | 'week' | 'month'
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'ANALYTICS_ERROR',
        message: error.message,
      },
    });
  }
});

// =====================================================
// US-106: RELATED CONTENT SUGGESTIONS ROUTES
// =====================================================

/**
 * GET /api/ai/content/related/:contentId
 * 7.12.1-7.12.3: Generate related content suggestions
 */
router.get('/related/:contentId', authenticate, relatedContentLimiter, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { maxSuggestions = 10, minRelevance = 0.5, diversityEnabled = true } = req.query;

    const userId = req.user?.nostr_pubkey;

    const suggestions = await aiService.generateRelatedContentSuggestions(contentId, userId, {
      maxSuggestions: parseInt(maxSuggestions as string),
      filtering: {
        minRelevanceScore: parseFloat(minRelevance as string),
        excludeSameContent: true,
        excludeAlreadyViewed: false,
        respectUserPreferences: true,
      },
      diversification: {
        enabled: diversityEnabled === 'true',
        diversityWeight: 0.2,
        maxSameCreator: 3,
        maxSameCategory: 5,
      },
    });

    res.json({
      success: true,
      data: suggestions,
      metadata: {
        suggestionCount: suggestions.length,
        algorithm: 'hybrid',
        personalized: !!userId,
      },
    });
  } catch (error) {
    if (error instanceof RelatedContentError) {
      res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          contentId: error.contentId,
          algorithm: error.algorithm,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate related content suggestions',
        },
      });
    }
  }
});

/**
 * GET /api/ai/content/related/:contentId/analytics
 * 7.12.6: Related content analytics
 */
router.get('/related/:contentId/analytics', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { timeframe = 'week' } = req.query;

    const analytics = await aiService.analyzeRelatedContentPerformance(
      contentId,
      timeframe as 'day' | 'week' | 'month'
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'ANALYTICS_ERROR',
        message: error.message,
      },
    });
  }
});

/**
 * POST /api/ai/content/related/feedback
 * Track interaction with related content suggestions
 */
router.post(
  '/related/feedback',
  authenticate,
  validateRequest(relatedContentFeedbackSchema),
  async (req, res) => {
    try {
      const { suggestionId, contentId, targetContentId, interactionType } = req.body;
      const userId = req.user?.nostr_pubkey;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'User authentication required' },
        });
      }

      await aiService.trackRelatedContentInteraction({
        suggestionId,
        contentId,
        targetContentId,
        userId,
        interactionType,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: 'Interaction tracked successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TRACKING_ERROR',
          message: error.message,
        },
      });
    }
  }
);

// =====================================================
// COMPREHENSIVE ENHANCEMENT ENDPOINT
// =====================================================

/**
 * POST /api/ai/content/enhance
 * Complete AI enhancement for content (all features)
 */
router.post(
  '/enhance',
  authenticate,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // Very comprehensive operation
    message: 'Too many content enhancement requests',
  }),
  validateRequest(enhanceContentSchema),
  async (req, res) => {
    try {
      const enhancementRequest = req.body;
      const userId = req.user?.nostr_pubkey;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'User authentication required' },
        });
      }

      const results = await aiService.enhanceContent(enhancementRequest, userId);

      res.json({
        success: true,
        data: results,
        metadata: {
          processingTime: results.processingTime,
          enhancementsApplied: enhancementRequest.enhancements,
          qualityScore: results.metadata.qualityScore,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'ENHANCEMENT_ERROR',
          message: error.message,
        },
      });
    }
  }
);

// =====================================================
// HEALTH CHECK AND CONFIGURATION
// =====================================================

/**
 * GET /api/ai/health
 * Health check for AI services
 */
router.get('/health', async (req, res) => {
  try {
    const health = await aiService.getHealthStatus();

    res.json({
      success: true,
      status: 'healthy',
      services: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/ai/config
 * Get AI service configuration
 */
router.get('/config', authenticate, async (req, res) => {
  try {
    const config = await aiService.getConfiguration();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: error.message,
      },
    });
  }
});

export default router;
