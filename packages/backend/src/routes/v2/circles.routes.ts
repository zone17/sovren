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
import {
  CreateCircleSchema,
  CreateCirclePostSchema,
  UuidParamSchema,
} from '../../validators/community';
import { ValidationError } from '../../utils/errors';
import type { ICreatorCircleService } from '../../interfaces/community/ICreatorCircleService';

const router = Router();

// Rate limiters
router.use(readOnlyRateLimiter);
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60_000, max: 20 });
// Circle posts are higher flood risk — 10/min per user (D5)
const postRateLimiter = createUserRateLimiter({ windowMs: 60_000, max: 10 });

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
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    const data = await getCircleService().createCircle(getAuthUser(req).nostr_pubkey, result.data);
    res.status(201).json(createApiResponse(req, data));
  })
);

/**
 * GET /api/v2/circles
 * List circles (my circles + discoverable)
 * #382/#713: DB-level pagination via service
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
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid circle ID format');
    }

    const circle = await getCircleService().getCircleById(idResult.data);
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
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid circle ID format');
    }

    await getCircleService().joinCircle(getAuthUser(req).nostr_pubkey, idResult.data);
    res.json(createApiResponse(req, { joined: true }));
  })
);

/**
 * DELETE /api/v2/circles/:id/leave
 * Leave a circle (member only — admin cannot leave their own circle)
 */
router.delete(
  '/:id/leave',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid circle ID format');
    }

    await getCircleService().leaveCircle(getAuthUser(req).nostr_pubkey, idResult.data);
    res.json(createApiResponse(req, { left: true }));
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
    const idResult = UuidParamSchema.safeParse(req.params.id);
    const memberIdResult = UuidParamSchema.safeParse(req.params.memberId);

    if (!idResult.success) {
      throw new ValidationError('Invalid circle ID format');
    }
    if (!memberIdResult.success) {
      throw new ValidationError('Invalid member ID format');
    }

    await getCircleService().removeMember(
      idResult.data,
      memberIdResult.data,
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
 * #382/#713: DB-level pagination via service (limit 50 in service)
 */
router.get(
  '/:id/posts',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid circle ID format');
    }

    const data = await getCircleService().getCirclePosts(
      idResult.data,
      getAuthUser(req).nostr_pubkey
    );
    res.json(createApiResponse(req, data));
  })
);

/**
 * POST /api/v2/circles/:id/posts
 * Create a post in a circle
 * Rate limited: 10/min per user (D5 — higher flood risk)
 */
router.post(
  '/:id/posts',
  authenticate,
  requireCreator,
  postRateLimiter,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid circle ID format');
    }

    const result = CreateCirclePostSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    const data = await getCircleService().createPost(
      idResult.data,
      getAuthUser(req).nostr_pubkey,
      result.data.content
    );
    res.status(201).json(createApiResponse(req, data));
  })
);

export default router;
