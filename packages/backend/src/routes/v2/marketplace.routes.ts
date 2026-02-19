/**
 * Marketplace Routes
 * EPIC-010: Creator Network — Service listings and orders with custodial Lightning escrow
 * /api/v2/marketplace/*
 *
 * Authorization rules (enforced at BOTH route and service layer — C-7 defense in depth):
 * - complete: Only buyer can mark complete
 * - start: Only seller can mark in_progress
 * - dispute: Either buyer or seller can dispute
 *
 * Rate limits (H-6):
 * - Escrow creation (POST /orders): 5/min per user — tighter than general mutations
 * - Revenue split modifications: 10/min per user
 * - General mutations (create listing, review): 20/min per user
 * - Read endpoints: standard readOnlyRateLimiter
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import {
  CreateListingSchema,
  PlaceOrderSchema,
  ReviewOrderSchema,
} from '../../validators/community';
import type { IMarketplaceService } from '../../interfaces/community/IMarketplaceService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';

const router = Router();

// Rate limiters
router.use(readOnlyRateLimiter);

// H-6: General mutations (create listing, review)
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });

// H-6: Strict rate limit for escrow creation — 5 per minute per user
// Prevents abuse of invoice generation which creates external Lightning state
const escrowCreationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 5 });

// H-6: Order state transitions — 10 per minute per user
// Looser than escrow creation but stricter than general mutations
const orderTransitionRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 10 });

// Lazy service resolution
let _marketplaceService: IMarketplaceService | null = null;
let _db: ISupabaseClient | null = null;

function getMarketplaceService(): IMarketplaceService {
  if (!_marketplaceService) _marketplaceService = container.resolve(TYPES.MarketplaceService);
  return _marketplaceService;
}

function getDb(): ISupabaseClient {
  if (!_db) _db = container.resolve(TYPES.Database) as unknown as ISupabaseClient;
  return _db;
}

// ============================================================================
// C-7: Authorization middleware helpers
// Defense-in-depth: route layer checks mirror service layer checks.
// These run BEFORE the service call to fail fast with clear 403 responses.
// ============================================================================

/**
 * C-7: Verify the authenticated user is the buyer of the specified order.
 * #275: Actually checks order ownership instead of being a noop.
 */
const requireBuyer = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = getAuthUser(req).nostr_pubkey;
  const orderId = req.params.id;

  const { data: order, error } = await getDb()
    .from('service_orders')
    .select('buyer_id')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }
  if (order.buyer_id !== userId) {
    res.status(403).json({ success: false, error: 'Only the buyer can perform this action' });
    return;
  }
  next();
});

/**
 * C-7: Verify the authenticated user is the seller of the specified order.
 * #275: Actually checks order ownership instead of being a noop.
 */
const requireSeller = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = getAuthUser(req).nostr_pubkey;
  const orderId = req.params.id;

  const { data: order, error } = await getDb()
    .from('service_orders')
    .select('seller_id')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }
  if (order.seller_id !== userId) {
    res.status(403).json({ success: false, error: 'Only the seller can perform this action' });
    return;
  }
  next();
});

// ============================================================================
// Service Listings
// ============================================================================

/**
 * POST /api/v2/marketplace/listings
 * Create a service listing
 * H-4: portfolioUrls validated as https:// in service layer
 */
router.post(
  '/listings',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = CreateListingSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }

    const data = await getMarketplaceService().createListing(
      getAuthUser(req).nostr_pubkey,
      result.data
    );
    res.status(201).json({ success: true, data });
  })
);

/**
 * GET /api/v2/marketplace/listings
 * Browse listings with optional filters
 */
router.get(
  '/listings',
  authenticate,
  asyncHandler(async (req, res) => {
    const filters: { serviceType?: string; active?: boolean } = {};

    if (req.query.serviceType && typeof req.query.serviceType === 'string') {
      filters.serviceType = req.query.serviceType;
    }

    if (req.query.active !== undefined) {
      filters.active = req.query.active === 'true';
    }

    const data = await getMarketplaceService().getListings(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    res.json({ success: true, data });
  })
);

// ============================================================================
// Orders
// ============================================================================

/**
 * POST /api/v2/marketplace/orders
 * Place an order (creates custodial escrow invoice)
 * H-6: Strict 5/min rate limit — each call creates external Lightning state
 */
router.post(
  '/orders',
  authenticate,
  requireCreator,
  escrowCreationRateLimiter, // H-6: 5/min — tighter than general mutations
  asyncHandler(async (req, res) => {
    const result = PlaceOrderSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }

    const data = await getMarketplaceService().placeOrder(
      getAuthUser(req).nostr_pubkey,
      result.data.listingId,
      result.data.idempotencyKey
    );

    res.status(201).json({ success: true, data });
  })
);

/**
 * PUT /api/v2/marketplace/orders/:id/start
 * Mark order as in_progress (seller only)
 * C-7: requireSeller middleware + service-layer enforcement (defense in depth)
 */
router.put(
  '/orders/:id/start',
  authenticate,
  requireCreator,
  orderTransitionRateLimiter,
  requireSeller, // C-7: belt-and-suspenders auth check
  asyncHandler(async (req, res) => {
    await getMarketplaceService().startOrder(req.params.id, getAuthUser(req).nostr_pubkey);
    res.json({ success: true });
  })
);

/**
 * PUT /api/v2/marketplace/orders/:id/complete
 * Release escrow to seller (buyer only)
 * C-1: Payout happens in service before status transitions to 'completed'
 * C-7: requireBuyer middleware + service-layer enforcement (defense in depth)
 */
router.put(
  '/orders/:id/complete',
  authenticate,
  requireCreator,
  orderTransitionRateLimiter,
  requireBuyer, // C-7: belt-and-suspenders auth check
  asyncHandler(async (req, res) => {
    await getMarketplaceService().completeOrder(req.params.id, getAuthUser(req).nostr_pubkey);
    res.json({ success: true });
  })
);

/**
 * PUT /api/v2/marketplace/orders/:id/dispute
 * Flag an order as disputed (buyer or seller)
 * C-7: Either participant may dispute — service enforces this
 */
router.put(
  '/orders/:id/dispute',
  authenticate,
  requireCreator,
  orderTransitionRateLimiter,
  asyncHandler(async (req, res) => {
    await getMarketplaceService().disputeOrder(req.params.id, getAuthUser(req).nostr_pubkey);
    res.json({ success: true });
  })
);

/**
 * POST /api/v2/marketplace/orders/:id/review
 * Submit a review for a completed order (buyer only)
 */
router.post(
  '/orders/:id/review',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = ReviewOrderSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }

    const data = await getMarketplaceService().reviewOrder(
      req.params.id,
      getAuthUser(req).nostr_pubkey,
      result.data
    );
    res.status(201).json({ success: true, data });
  })
);

export default router;
