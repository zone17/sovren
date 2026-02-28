/**
 * 💎 SUBSCRIPTION TIERS MANAGEMENT ROUTES
 *
 * Elite implementation of US-003: Subscription tier management
 * Allows creators to create and manage multiple subscription tiers
 *
 * @module routes/subscription-tiers
 */

import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation-middleware';
import { SubscriptionManagementService } from '../services/subscription-management-service';
import { LightningPaymentService } from '../services/lightning-payment-service';

const router = express.Router();

// Lazy singleton — deferred to first request to avoid side effects at module load
let _subscriptionService: SubscriptionManagementService | null = null;
function getSubscriptionService(): SubscriptionManagementService {
  if (!_subscriptionService) {
    const lightningService = new LightningPaymentService();
    lightningService.initialize().catch(err => {
      console.error('Failed to initialize LightningPaymentService:', err);
    });
    _subscriptionService = new SubscriptionManagementService(lightningService);
  }
  return _subscriptionService;
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
  async (req, res) => {
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
    } catch (error: any) {
      console.error('Failed to create subscription tier:', error);

      if (error.message?.includes('Maximum number of subscription tiers')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'TIER_LIMIT_EXCEEDED',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create subscription tier',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * GET /api/subscriptions/tiers
 * Get all subscription tiers for the authenticated creator
 */
router.get('/tiers', authenticate, async (req, res) => {
  try {
    const creatorId = req.query.creator_id as string || req.user?.id || req.user?.nostr_pubkey;

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
    console.error('Failed to get subscription tiers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription tiers',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/subscriptions/tiers/:id
 * Get a specific subscription tier by ID
 */
router.get('/tiers/:id', async (req, res) => {
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
    console.error('Failed to get subscription tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription tier',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * PUT /api/subscriptions/tiers/:id
 * Update a subscription tier
 */
router.put(
  '/tiers/:id',
  authenticate,
  validateRequest(UpdateTierSchema),
  async (req, res) => {
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
      console.error('Failed to update subscription tier:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update subscription tier',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * DELETE /api/subscriptions/tiers/:id
 * Delete a subscription tier (soft delete - marks as inactive)
 */
router.delete('/tiers/:id', authenticate, async (req, res) => {
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
    console.error('Failed to delete subscription tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete subscription tier',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/subscriptions/tiers/:id/subscribers
 * Get subscribers for a specific tier
 */
router.get('/tiers/:id/subscribers', authenticate, async (req, res) => {
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
    console.error('Failed to get tier subscribers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tier subscribers',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/subscriptions/subscribe
 * Subscribe to a tier as a supporter
 */
router.post('/subscribe', authenticate, async (req, res) => {
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
      user_id: userId,
      tier_id,
    });

    res.status(201).json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    console.error('Failed to create subscription:', error);

    if (error.message?.includes('already subscribed')) {
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
});

/**
 * GET /api/subscriptions/my-subscriptions
 * Get current user's active subscriptions
 */
router.get('/my-subscriptions', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.nostr_pubkey;

    const subscriptions = await getSubscriptionService().getUserSubscriptions(userId);

    res.json({
      success: true,
      data: subscriptions,
      meta: {
        count: subscriptions.length,
      },
    });
  } catch (error) {
    console.error('Failed to get user subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscriptions',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;