/**
 * Follow Routes
 * Slice 8: Creator Network + Notifications
 * /api/v2/network/users/:userId/*
 *
 * Route ordering: /follow-status and /:userId/followers | /following before /:userId/follow
 * to avoid named segments being swallowed by param-only routes.
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireAuth, optionalAuth, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { UuidParamSchema } from '../../validators/community';
import { ValidationError } from '../../utils/errors';
import type { IFollowService } from '../../interfaces/community/IFollowService';

const router = Router({ mergeParams: true });

// Rate limiters
router.use(readOnlyRateLimiter);
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60_000, max: 30 });

// Lazy service resolution
let _followService: IFollowService | null = null;
function getFollowService(): IFollowService {
  if (!_followService) _followService = container.resolve(TYPES.FollowService);
  return _followService;
}

// ============================================================================
// POST /api/v2/network/users/:userId/follow
// ============================================================================

/**
 * POST /api/v2/network/users/:userId/follow
 * Follow a user. Requires authentication.
 */
router.post(
  '/follow',
  authenticate,
  requireAuth,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const targetIdResult = UuidParamSchema.safeParse(req.params.userId);
    if (!targetIdResult.success) {
      throw new ValidationError('Invalid user ID format');
    }

    const data = await getFollowService().follow(
      getAuthUser(req).nostr_pubkey,
      targetIdResult.data
    );

    res.status(201).json(createApiResponse(req, data));
  })
);

// ============================================================================
// DELETE /api/v2/network/users/:userId/follow
// ============================================================================

/**
 * DELETE /api/v2/network/users/:userId/follow
 * Unfollow a user. Requires authentication. Idempotent.
 */
router.delete(
  '/follow',
  authenticate,
  requireAuth,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const targetIdResult = UuidParamSchema.safeParse(req.params.userId);
    if (!targetIdResult.success) {
      throw new ValidationError('Invalid user ID format');
    }

    await getFollowService().unfollow(getAuthUser(req).nostr_pubkey, targetIdResult.data);

    res.json(createApiResponse(req, { unfollowed: true }));
  })
);

// ============================================================================
// GET /api/v2/network/users/:userId/follow-status
// NOTE: Must come before /followers and /following to avoid matching "follow-status" as :userId
// ============================================================================

/**
 * GET /api/v2/network/users/:userId/follow-status
 * Check whether the authenticated user follows the target user.
 * Returns { isFollowing: boolean }.
 */
router.get(
  '/follow-status',
  authenticate,
  requireAuth,
  asyncHandler(async (req, res) => {
    const targetIdResult = UuidParamSchema.safeParse(req.params.userId);
    if (!targetIdResult.success) {
      throw new ValidationError('Invalid user ID format');
    }

    const isFollowing = await getFollowService().isFollowing(
      getAuthUser(req).nostr_pubkey,
      targetIdResult.data
    );

    res.json(createApiResponse(req, { following: isFollowing }));
  })
);

// ============================================================================
// GET /api/v2/network/users/:userId/follow-counts
// NOTE: Must come before /followers to avoid matching "follow-counts" as :userId
// ============================================================================

/**
 * GET /api/v2/network/users/:userId/follow-counts
 * Get follower and following counts for the specified user.
 */
router.get(
  '/follow-counts',
  authenticate,
  requireAuth,
  asyncHandler(async (req, res) => {
    const targetIdResult = UuidParamSchema.safeParse(req.params.userId);
    if (!targetIdResult.success) {
      throw new ValidationError('Invalid user ID format');
    }

    const data = await getFollowService().getFollowCounts(targetIdResult.data);
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// GET /api/v2/network/users/:userId/followers
// ============================================================================

/**
 * GET /api/v2/network/users/:userId/followers
 * List users who follow the given user. Authenticated (public profiles visible to all).
 */
router.get(
  '/followers',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const targetIdResult = UuidParamSchema.safeParse(req.params.userId);
    if (!targetIdResult.success) {
      throw new ValidationError('Invalid user ID format');
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const data = await getFollowService().getFollowers(targetIdResult.data, { page, limit });

    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// GET /api/v2/network/users/:userId/following
// ============================================================================

/**
 * GET /api/v2/network/users/:userId/following
 * List users that the given user is following.
 */
router.get(
  '/following',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const targetIdResult = UuidParamSchema.safeParse(req.params.userId);
    if (!targetIdResult.success) {
      throw new ValidationError('Invalid user ID format');
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const data = await getFollowService().getFollowing(targetIdResult.data, { page, limit });

    res.json(createApiResponse(req, data));
  })
);

export default router;
