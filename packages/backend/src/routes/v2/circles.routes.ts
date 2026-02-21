/**
 * Creator Circles Routes
 * EPIC-010: Creator Network — Circle management and posts
 * /api/v2/circles/*
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { CreateCircleSchema, CreateCirclePostSchema } from '../../validators/community';
import type { ICreatorCircleService } from '../../interfaces/community/ICreatorCircleService';

const router = Router();

// Rate limiters
router.use(readOnlyRateLimiter);
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });

// Lazy service resolution
let _circleService: ICreatorCircleService | null = null;
function getCircleService(): ICreatorCircleService {
  if (!_circleService) _circleService = container.resolve(TYPES.CreatorCircleService);
  return _circleService;
}

// ============================================================================
// Circle CRUD
// ============================================================================

/**
 * POST /api/v2/circles
 * Create a new creator circle
 */
router.post(
  '/',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = CreateCircleSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }

    const data = await getCircleService().createCircle(getAuthUser(req).nostr_pubkey, result.data);
    res.status(201).json(createApiResponse(req, data));
  })
);

/**
 * GET /api/v2/circles
 * List circles (my circles + discoverable)
 */
router.get(
  '/',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const data = await getCircleService().getCircles(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, data));
  })
);

/**
 * GET /api/v2/circles/suggested
 * Get suggested circles based on niche matching
 * NOTE: This route must come before /:id to avoid name being matched as ID
 */
router.get(
  '/suggested',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const data = await getCircleService().getSuggestedCircles(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, data));
  })
);

/**
 * GET /api/v2/circles/:id
 * Get a single circle by ID
 */
router.get(
  '/:id',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const circles = await getCircleService().getCircles(getAuthUser(req).nostr_pubkey);
    const circle = circles.find((c) => c.id === req.params.id);
    if (!circle) {
      res.status(404).json({ success: false, error: 'Circle not found' });
      return;
    }
    res.json(createApiResponse(req, circle));
  })
);

// ============================================================================
// Circle Membership
// ============================================================================

/**
 * POST /api/v2/circles/:id/join
 * Join a circle
 */
router.post(
  '/:id/join',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    await getCircleService().joinCircle(getAuthUser(req).nostr_pubkey, req.params.id);
    res.json(createApiResponse(req, { joined: true }));
  })
);

/**
 * DELETE /api/v2/circles/:id/members/:memberId
 * Remove a member from a circle (admin only)
 */
router.delete(
  '/:id/members/:memberId',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    await getCircleService().removeMember(
      req.params.id,
      req.params.memberId,
      getAuthUser(req).nostr_pubkey
    );
    res.json(createApiResponse(req, { removed: true }));
  })
);

// ============================================================================
// Circle Posts
// ============================================================================

/**
 * GET /api/v2/circles/:id/posts
 * Get posts in a circle feed
 */
router.get(
  '/:id/posts',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const data = await getCircleService().getCirclePosts(
      req.params.id,
      getAuthUser(req).nostr_pubkey
    );
    res.json(createApiResponse(req, data));
  })
);

/**
 * POST /api/v2/circles/:id/posts
 * Create a post in a circle
 */
router.post(
  '/:id/posts',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = CreateCirclePostSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }

    const data = await getCircleService().createPost(
      req.params.id,
      getAuthUser(req).nostr_pubkey,
      result.data.content
    );
    res.status(201).json(createApiResponse(req, data));
  })
);

export default router;
