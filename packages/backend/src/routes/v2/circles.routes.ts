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
  UpdateCircleSchema,
  CreateCirclePostSchema,
  UuidParamSchema,
} from '../../validators/community';
import { ValidationError } from '../../utils/errors';
import { getUserIdByPubkey } from '../../utils/getUserIdByPubkey';
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

/** Resolve supabase DB client from DI container (safe cast — DI guarantees ISupabaseClient) */
function resolveDb(): Parameters<typeof getUserIdByPubkey>[0] {
  return container.resolve(TYPES.Database) as unknown as Parameters<typeof getUserIdByPubkey>[0];
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

    const db = resolveDb();
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    const data = await getCircleService().createCircle(creatorId, result.data);
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
    const db = resolveDb();
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    const data = await getCircleService().getCircles(creatorId);
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
    const db = resolveDb();
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    const data = await getCircleService().getSuggestedCircles(creatorId);
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

/**
 * PATCH /api/v2/circles/:id
 * Update circle details (owner only)
 */
router.patch(
  '/:id',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid circle ID format');
    }

    const result = UpdateCircleSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    const db = resolveDb();
    const requesterId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    await getCircleService().updateCircle(idResult.data, requesterId, result.data);
    res.json(createApiResponse(req, { updated: true }));
  })
);

/**
 * DELETE /api/v2/circles/:id
 * Delete a circle (owner only — cascades memberships and posts)
 */
router.delete(
  '/:id',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid circle ID format');
    }

    const db = resolveDb();
    const requesterId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    await getCircleService().deleteCircle(idResult.data, requesterId);
    res.json(createApiResponse(req, { deleted: true }));
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

    const db = resolveDb();
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    await getCircleService().joinCircle(creatorId, idResult.data);
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

    const db = resolveDb();
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    await getCircleService().leaveCircle(creatorId, idResult.data);
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

    const db = resolveDb();
    const requesterId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    await getCircleService().removeMember(idResult.data, memberIdResult.data, requesterId);
    res.json(createApiResponse(req, { removed: true }));
  })
);

/**
 * GET /api/v2/circles/:id/members
 * List circle members (paginated)
 */
router.get(
  '/:id/members',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const idResult = UuidParamSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid circle ID format');
    }

    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const data = await getCircleService().getCircleMembers(idResult.data, { offset, limit });
    res.json(createApiResponse(req, data));
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

    const db = resolveDb();
    const creatorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const data = await getCircleService().getCirclePosts(idResult.data, creatorId, {
      offset,
      limit,
    });
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

    const db = resolveDb();
    const authorId = await getUserIdByPubkey(db, getAuthUser(req).nostr_pubkey);
    const data = await getCircleService().createPost(idResult.data, authorId, result.data.content);
    res.status(201).json(createApiResponse(req, data));
  })
);

export default router;
