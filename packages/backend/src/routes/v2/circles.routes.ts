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
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
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
    const { name, description, niche, maxMembers } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const data = await getCircleService().createCircle(getAuthUser(req).nostr_pubkey, {
      name,
      description,
      niche,
      maxMembers: maxMembers ? Number(maxMembers) : undefined,
    });

    res.status(201).json({ success: true, data });
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
    res.json({ success: true, data });
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
    res.json({ success: true, data });
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
    res.json({ success: true });
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
    res.json({ success: true });
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
    const data = await getCircleService().getCirclePosts(req.params.id, getAuthUser(req).nostr_pubkey);
    res.json({ success: true, data });
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
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, error: 'content is required' });
      return;
    }

    const data = await getCircleService().createPost(req.params.id, getAuthUser(req).nostr_pubkey, content);
    res.status(201).json({ success: true, data });
  })
);

export default router;
