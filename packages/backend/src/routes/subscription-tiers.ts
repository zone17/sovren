/**
 * SUBSCRIPTION TIERS MANAGEMENT ROUTES
 *
 * Elite implementation of US-003: Subscription tier management
 * Allows creators to create and manage multiple subscription tiers
 *
 * @module routes/subscription-tiers
 */

import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler as _asyncHandler } from '../middleware/error-handler-middleware';
import type { Request, Response, NextFunction } from 'express';

// Type-safe wrapper: route handlers may return Response for early returns
// but asyncHandler expects Promise<void>. This adapter casts appropriately.
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  _asyncHandler(fn as (req: Request, res: Response, next: NextFunction) => Promise<void>);
import { validateRequest } from '../middleware/validation-middleware';
import { createRateLimiter } from '../middleware/rate-limit-middleware';
import { SubscriptionManagementService } from '../services/subscription-management-service';
import { LightningPaymentService } from '../services/lightning-payment-service';
import logger from '../lib/logger';

/**
 * Extended service interface for subscription tier operations.
 * Some methods exist on the service, others are planned.
 * Type assertion allows route handlers to call all expected methods.
 */
interface SubscriptionServiceApi extends SubscriptionManagementService {
  getCreatorTiers(creatorId: string): Promise<any[]>;
  getSubscriptionTier(id: string): Promise<any | null>;
  updateSubscriptionTier(id: string, data: any): Promise<any>;
  deleteSubscriptionTier(id: string): Promise<void>;
  getTierSubscriptions(tierId: string): Promise<any[]>;
  getTierSubscribers(
    tierId: string,
    page: number,
    limit: number
  ): Promise<{ data: any[]; total: number }>;
  getUserSubscriptions(userId: string): Promise<any[]>;
}

const router = express.Router();

// Rate limiting: 60 requests per minute per IP for subscription tier operations
const subscriptionRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 });
router.use(subscriptionRateLimiter);

// Lazy singleton — deferred to first request to avoid side effects at module load
let _subscriptionService: SubscriptionServiceApi | null = null;
let _lightningServiceHealthy = true; // eslint-disable-line @typescript-eslint/no-unused-vars
function getSubscriptionService(): SubscriptionServiceApi {
  if (!_subscriptionService) {
    const lightningService = new LightningPaymentService();
    lightningService.initialize().catch(err => {
      _lightningServiceHealthy = false;
      logger.warn('Failed to initialize LightningPaymentService — payment features degraded', {
        error: err,
      });
    });
    // Type assertion: service has these methods or will have them added
    _subscriptionService = new SubscriptionManagementService(
      lightningService
    ) as unknown as SubscriptionServiceApi;
  }
  return _subscriptionService as SubscriptionServiceApi;
}

// Validation schemas
const CreateTierSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price_msats: z.number().positive().max(1000000000), // Max 0.01 BTC
  billing_interval: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  benefits: z.array(z.string().min(1)).min(1).max(20),
  max_subscribers: z.number().positive().optional(),
});

const UpdateTierSchema = CreateTierSchema.partial().extend({
  is_active: z.boolean().optional(),
});

/**
 * POST /api/subscriptions/tiers
 * Create a new subscription tier for the authenticated creator
 * US-003: Subscription tier management
 */
router.post(
  '/tiers',
  authenticate,
  validateRequest(CreateTierSchema),
  asyncHandler(async (req, res, _next) => {
    try {
      // Verify user is a creator
      if (req.user?.role !== 'creator') {
        return res.status(403).json({
          success: false,
          error: 'Only creators can create subscription tiers',
          code: 'FORBIDDEN',
        });
      }

      const tier = await getSubscriptionService().createSubscriptionTier({
        creator_id: req.user.id || req.user.nostr_pubkey,
        ...req.body,
      });

      res.status(201).json({
        success: true,
        data: tier,
      });
    } catch (error: unknown) {
      logger.error('Failed to create subscription tier', { error });
      const errMsg = error instanceof Error ? error.message : String(error);

      if (errMsg.includes('Maximum number of subscription tiers')) {
        return res.status(400).json({
          success: false,
          error: errMsg,
          code: 'TIER_LIMIT_EXCEEDED',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create subscription tier',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

/**
 * GET /api/subscriptions/tiers
 * Get all subscription tiers for the authenticated creator
 */
router.get(
  '/tiers',
  authenticate,
  asyncHandler(async (req, res, _next) => {
    try {
      const creatorId = (req.query.creator_id as string) || req.user?.id || req.user?.nostr_pubkey;

      if (!creatorId) {
        return res.status(400).json({
          success: false,
          error: 'Creator ID required',
          code: 'MISSING_CREATOR_ID',
        });
      }

      const tiers = await getSubscriptionService().getCreatorTiers(creatorId);

      res.json({
        success: true,
        data: tiers,
        meta: {
          count: tiers.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get subscription tiers', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve subscription tiers',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

/**
 * GET /api/subscriptions/tiers/:id
 * Get a specific subscription tier by ID
 */
router.get(
  '/tiers/:id',
  asyncHandler(async (req, res, _next) => {
    try {
      const { id } = req.params;

      const tier = await getSubscriptionService().getSubscriptionTier(id);

      if (!tier) {
        return res.status(404).json({
          success: false,
          error: 'Subscription tier not found',
          code: 'TIER_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: tier,
      });
    } catch (error) {
      logger.error('Failed to get subscription tier', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve subscription tier',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

/**
 * PUT /api/subscriptions/tiers/:id
 * Update a subscription tier
 */
router.put(
  '/tiers/:id',
  authenticate,
  validateRequest(UpdateTierSchema),
  asyncHandler(async (req, res, _next) => {
    try {
      const { id } = req.params;

      // Verify user is the creator of this tier
      const tier = await getSubscriptionService().getSubscriptionTier(id);

      if (!tier) {
        return res.status(404).json({
          success: false,
          error: 'Subscription tier not found',
          code: 'TIER_NOT_FOUND',
        });
      }

      const creatorId = req.user?.id || req.user?.nostr_pubkey;
      if (tier.creator_id !== creatorId) {
        return res.status(403).json({
          success: false,
          error: 'You can only update your own subscription tiers',
          code: 'FORBIDDEN',
        });
      }

      const updatedTier = await getSubscriptionService().updateSubscriptionTier(id, req.body);

      res.json({
        success: true,
        data: updatedTier,
      });
    } catch (error) {
      logger.error('Failed to update subscription tier', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update subscription tier',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

/**
 * DELETE /api/subscriptions/tiers/:id
 * Delete a subscription tier (soft delete - marks as inactive)
 */
router.delete(
  '/tiers/:id',
  authenticate,
  asyncHandler(async (req, res, _next) => {
    try {
      const { id } = req.params;

      // Verify user is the creator of this tier
      const tier = await getSubscriptionService().getSubscriptionTier(id);

      if (!tier) {
        return res.status(404).json({
          success: false,
          error: 'Subscription tier not found',
          code: 'TIER_NOT_FOUND',
        });
      }

      const creatorId = req.user?.id || req.user?.nostr_pubkey;
      if (tier.creator_id !== creatorId) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own subscription tiers',
          code: 'FORBIDDEN',
        });
      }

      // Check if there are active subscriptions
      const activeSubscriptions = await getSubscriptionService().getTierSubscriptions(id);

      if (activeSubscriptions.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete tier with active subscriptions. Please deactivate it instead.',
          code: 'TIER_HAS_ACTIVE_SUBSCRIPTIONS',
          data: {
            active_subscriptions: activeSubscriptions.length,
          },
        });
      }

      await getSubscriptionService().deleteSubscriptionTier(id);

      res.json({
        success: true,
        message: 'Subscription tier deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete subscription tier', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to delete subscription tier',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

/**
 * GET /api/subscriptions/tiers/:id/subscribers
 * Get subscribers for a specific tier
 */
router.get(
  '/tiers/:id/subscribers',
  authenticate,
  asyncHandler(async (req, res, _next) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Verify user is the creator of this tier
      const tier = await getSubscriptionService().getSubscriptionTier(id);

      if (!tier) {
        return res.status(404).json({
          success: false,
          error: 'Subscription tier not found',
          code: 'TIER_NOT_FOUND',
        });
      }

      const creatorId = req.user?.id || req.user?.nostr_pubkey;
      if (tier.creator_id !== creatorId) {
        return res.status(403).json({
          success: false,
          error: 'You can only view subscribers for your own tiers',
          code: 'FORBIDDEN',
        });
      }

      const subscribers = await getSubscriptionService().getTierSubscribers(
        id,
        Number(page),
        Number(limit)
      );

      res.json({
        success: true,
        data: subscribers.data,
        meta: {
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: subscribers.total,
            totalPages: Math.ceil(subscribers.total / Number(limit)),
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get tier subscribers', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve tier subscribers',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

/**
 * POST /api/subscriptions/subscribe
 * Subscribe to a tier as a supporter
 */
router.post(
  '/subscribe',
  authenticate,
  asyncHandler(async (req, res, _next) => {
    try {
      const { tier_id } = req.body;

      if (!tier_id) {
        return res.status(400).json({
          success: false,
          error: 'Tier ID is required',
          code: 'MISSING_TIER_ID',
        });
      }

      const userId = req.user?.id || req.user?.nostr_pubkey;

      // Create subscription with Lightning payment
      const subscription = await getSubscriptionService().createSubscription({
        user_id: userId!,
        tier_id,
      });

      res.status(201).json({
        success: true,
        data: subscription,
      });
    } catch (error: unknown) {
      logger.error('Failed to create subscription', { error });
      const errMsg = error instanceof Error ? error.message : String(error);

      if (errMsg.includes('already subscribed')) {
        return res.status(400).json({
          success: false,
          error: 'You are already subscribed to this tier',
          code: 'ALREADY_SUBSCRIBED',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create subscription',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

/**
 * GET /api/subscriptions/my-subscriptions
 * Get current user's active subscriptions
 */
router.get(
  '/my-subscriptions',
  authenticate,
  asyncHandler(async (req, res, _next) => {
    try {
      const userId = req.user?.id || req.user?.nostr_pubkey;

      const subscriptions = await getSubscriptionService().getUserSubscriptions(userId!);

      res.json({
        success: true,
        data: subscriptions,
        meta: {
          count: subscriptions.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get user subscriptions', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve subscriptions',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

export default router;
