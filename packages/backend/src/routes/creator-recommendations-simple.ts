/**
 * 🎭 CREATOR RECOMMENDATIONS API ROUTES (SIMPLIFIED)
 * Elite API endpoints for AI-powered creator recommendations
 * Part of US-099 through US-102 implementation
 */

import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CreatorRecommendationService } from '../services/creator-recommendation-service';
import {
  AudienceLevel,
  ContentStyle,
  CreatorRecommendationError,
  CreatorRecommendationValidationError,
  DiscoveryMethod,
  RecommendationAlgorithm,
  VerificationStatus,
} from '../types/creator-recommendations';

const router = Router();

// Lazy singleton — deferred to first request to avoid side effects at module load
let _creatorRecService: CreatorRecommendationService | null = null;
function getCreatorRecService(): CreatorRecommendationService {
  if (!_creatorRecService) {
    _creatorRecService = new CreatorRecommendationService();
  }
  return _creatorRecService;
}

// Rate limiting for recommendation endpoints
const recommendationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many recommendation requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for intensive operations
const heavyOperationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many intensive operations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware using existing auth system
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }

  // Use the existing NOSTR auth - req.user will have nostr_pubkey
  if (!req.user?.nostr_pubkey) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid authentication' },
    });
  }

  next();
};

/**
 * Global error handler for creator recommendations
 */
const handleCreatorRecommendationError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Creator Recommendation Error:', error);

  if (error instanceof CreatorRecommendationValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: { field: error.field, value: error.value },
      },
    });
  }

  if (error instanceof CreatorRecommendationError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};

// ============================================================================
// US-099: CREATOR MATCHING BASED ON INTERESTS
// ============================================================================

/**
 * POST /api/creator-recommendations/profiles
 * Create or update creator profile
 */
router.post(
  '/profiles',
  requireAuth,
  recommendationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const creatorId = req.user?.nostr_pubkey;
      if (!creatorId) {
        throw new CreatorRecommendationValidationError(
          'Creator ID is required',
          'creatorId',
          undefined
        );
      }

      const profile = await getCreatorRecService().createOrUpdateCreatorProfile(creatorId, req.body);

      res.json({
        success: true,
        data: profile,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: 0,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/creator-recommendations/profiles/:creatorId
 * Get creator profile by ID
 */
router.get(
  '/profiles/:creatorId',
  requireAuth,
  recommendationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { creatorId } = req.params;
      const profile = await getCreatorRecService().getCreatorProfile(creatorId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Creator profile not found',
          },
        });
      }

      res.json({
        success: true,
        data: profile,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: 0,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/creator-recommendations/similar
 * Find similar creators based on profile matching
 */
router.post(
  '/similar',
  requireAuth,
  heavyOperationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matches = await getCreatorRecService().findSimilarCreators(req.body);

      res.json({
        success: true,
        data: matches,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: matches.processingTimeMs,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// US-100: INTEREST-BASED CREATOR SUGGESTIONS
// ============================================================================

/**
 * POST /api/creator-recommendations/interests
 * Create interest taxonomy entry
 */
router.post(
  '/interests',
  requireAuth,
  recommendationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interest = await getCreatorRecService().createInterest(req.body);

      res.json({
        success: true,
        data: interest,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: 0,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/creator-recommendations/interests/user/:userId
 * Get user interests
 */
router.get(
  '/interests/user/:userId',
  requireAuth,
  recommendationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const interests = await getCreatorRecService().getUserInterests(userId);

      res.json({
        success: true,
        data: interests,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: 0,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/creator-recommendations/suggestions/interests
 * Get interest-based creator suggestions
 */
router.post(
  '/suggestions/interests',
  requireAuth,
  recommendationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const suggestions = await getCreatorRecService().getInterestBasedSuggestions(req.body);

      res.json({
        success: true,
        data: suggestions,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: suggestions.processingTimeMs,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// US-101: DISCOVERY INTERFACE FOR NEW CREATORS
// ============================================================================

/**
 * POST /api/creator-recommendations/discovery/session
 * Start creator discovery session
 */
router.post(
  '/discovery/session',
  requireAuth,
  recommendationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.nostr_pubkey;
      if (!userId) {
        throw new CreatorRecommendationValidationError('User ID is required', 'userId', undefined);
      }

      const session = await getCreatorRecService().startDiscoverySession(
        userId,
        req.body.discoveryMethod || DiscoveryMethod.RECOMMENDATIONS
      );

      res.json({
        success: true,
        data: session,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: 0,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/creator-recommendations/discovery
 * Discover new creators
 */
router.post(
  '/discovery',
  requireAuth,
  recommendationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const discovery = await getCreatorRecService().discoverCreators(req.body);

      res.json({
        success: true,
        data: discovery,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: discovery.processingTimeMs,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// US-102: FOLLOW RECOMMENDATIONS
// ============================================================================

/**
 * POST /api/creator-recommendations/follow
 * Get follow recommendations for a user
 */
router.post(
  '/follow',
  requireAuth,
  recommendationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const recommendations = await getCreatorRecService().getFollowRecommendations(req.body);

      res.json({
        success: true,
        data: recommendations,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: recommendations.processingTimeMs,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/creator-recommendations/follow/track
 * Track follow relationship
 */
router.post(
  '/follow/track',
  requireAuth,
  recommendationRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { followerId, followingId, followSource, recommendationId } = req.body;

      const relationship = await getCreatorRecService().trackFollowRelationship(
        followerId,
        followingId,
        followSource,
        recommendationId
      );

      res.json({
        success: true,
        data: relationship,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          processingTimeMs: 0,
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

/**
 * GET /api/creator-recommendations/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'creator-recommendations',
      version: '1.0.0',
      timestamp: new Date(),
      uptime: process.uptime(),
    },
  });
});

/**
 * GET /api/creator-recommendations/config
 * Get current service configuration
 */
router.get('/config', requireAuth, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      algorithms: Object.values(RecommendationAlgorithm),
      discoveryMethods: Object.values(DiscoveryMethod),
      contentStyles: Object.values(ContentStyle),
      audienceLevels: Object.values(AudienceLevel),
      verificationStatuses: Object.values(VerificationStatus),
      rateLimits: {
        recommendations: '100 requests per 15 minutes',
        heavyOperations: '10 requests per hour',
      },
    },
  });
});

// Apply error handler
router.use(handleCreatorRecommendationError);

export default router;
