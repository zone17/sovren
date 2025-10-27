/**
 * 🤖 **AI RECOMMENDATIONS API ROUTES - SIMPLIFIED**
 *
 * Elite API endpoints for AI-powered content recommendations
 * Implements US-095 through US-098 (Core functionality)
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import { Request, Response, Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createAIRecommendationService } from '../services/ai-recommendation-service';
import type {
  RecommendationFeedback,
  RecommendationRequest,
  SimilarityCalculationRequest,
  UserBehaviorEvent,
} from '../types/ai-recommendations';

const router = Router();
const aiService = createAIRecommendationService();

// ===== US-095: Personalized Content Recommendations =====

/**
 * @route GET /api/ai-recommendations
 * @desc Get personalized content recommendations
 * @access Private
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userPubkey = req.user?.nostr_pubkey;
    if (!userPubkey) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const request: RecommendationRequest = {
      user_id: userPubkey,
      context: (req.query.context as any) || 'homepage',
      content_id: req.query.content_id as string,
      limit: parseInt(req.query.limit as string) || 10,
      include_explanation: req.query.include_explanation === 'true',
    };

    const recommendations = await aiService.getPersonalizedRecommendations(request);

    res.json({
      success: true,
      data: recommendations,
      metadata: {
        user_pubkey: userPubkey,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Recommendation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations',
      details: error?.message,
    });
  }
});

// ===== US-096: Behavioral Recommendations =====

/**
 * @route POST /api/ai-recommendations/behavior
 * @desc Track user behavior event
 * @access Private
 */
router.post('/behavior', authenticate, async (req: Request, res: Response) => {
  try {
    const userPubkey = req.user?.nostr_pubkey;

    const behaviorEvent: Omit<UserBehaviorEvent, 'id' | 'timestamp'> = {
      user_id: userPubkey,
      session_id: req.headers['x-session-id'] as string,
      processed_for_ml: false,
      ...req.body,
    };

    await aiService.trackBehaviorEvent(behaviorEvent);

    res.status(201).json({
      success: true,
      message: 'Behavior tracked successfully',
    });
  } catch (error: any) {
    console.error('Behavior tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track behavior',
      details: error?.message,
    });
  }
});

/**
 * @route GET /api/ai-recommendations/behavioral
 * @desc Get behavioral recommendations
 * @access Private
 */
router.get('/behavioral', authenticate, async (req: Request, res: Response) => {
  try {
    const userPubkey = req.user?.nostr_pubkey;
    if (!userPubkey) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const recommendations = await aiService.getBehavioralRecommendations(userPubkey, limit);

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to get behavioral recommendations',
      details: error?.message,
    });
  }
});

// ===== US-097: Content Similarity Analysis =====

/**
 * @route GET /api/ai-recommendations/similar/:contentId
 * @desc Get similar content
 * @access Private
 */
router.get('/similar/:contentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;

    const request: SimilarityCalculationRequest = {
      content_id: contentId,
      similarity_threshold: parseFloat(req.query.similarity_threshold as string) || 0.3,
      max_results: parseInt(req.query.max_results as string) || 10,
      include_reasons: req.query.include_reasons === 'true',
    };

    const similarContent = await aiService.calculateContentSimilarity(request);

    res.json({
      success: true,
      data: similarContent,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to calculate similarity',
      details: error?.message,
    });
  }
});

// ===== US-098: Recommendation Feedback =====

/**
 * @route POST /api/ai-recommendations/feedback
 * @desc Submit recommendation feedback
 * @access Private
 */
router.post('/feedback', authenticate, async (req: Request, res: Response) => {
  try {
    const userPubkey = req.user?.nostr_pubkey;
    if (!userPubkey) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
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
    res.status(500).json({
      success: false,
      error: 'Failed to process feedback',
      details: error?.message,
    });
  }
});

// ===== Health Check =====

/**
 * @route GET /api/ai-recommendations/health
 * @desc Health check
 * @access Public
 */
router.get('/health', async (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      personalized_recommendations: true,
      behavioral_tracking: true,
      similarity_analysis: true,
      feedback_processing: true,
    },
  });
});

export default router;
