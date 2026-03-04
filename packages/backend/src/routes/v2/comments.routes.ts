/**
 * Comments Routes
 * Slice 6: Comments CRUD with Threading and Moderation
 * /api/v2/comments/*
 *
 * Rate limit: 10/min per user on POST/DELETE (higher spam risk than circles)
 * Route ordering: /:commentId/replies BEFORE /:commentId (named segment before param-only)
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, optionalAuth, requireAuth, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { CreateCommentSchema, CommentsPaginationSchema } from '../../validators/community';
import { ValidationError } from '../../utils/errors';
import type { ICommentsService } from '../../interfaces/community/ICommentsService';

const router = Router();

// Rate limiters
// NOTE: Must use createUserRateLimiter (user-keyed), NOT createRateLimiter (IP-keyed)
// as specified in D11 — 10 comments/minute per user to limit spam
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60_000, max: 10 });

// Lazy service resolution — matches existing v2 route pattern
let _commentsService: ICommentsService | null = null;
function getCommentsService(): ICommentsService {
  if (!_commentsService) {
    _commentsService = container.resolve(TYPES.CommentsService);
  }
  return _commentsService;
}

// ============================================================================
// GET /api/v2/comments/:commentId/replies
// IMPORTANT: This route MUST come before /:contentId to avoid the named segment
// "replies" being matched as a contentId value.
// ============================================================================

/**
 * GET /api/v2/comments/:commentId/replies
 * List replies to a top-level comment. Public endpoint (anonymous access).
 */
router.get(
  '/:commentId/replies',
  optionalAuth,
  readOnlyRateLimiter,
  asyncHandler(async (req, res) => {
    const paginationResult = CommentsPaginationSchema.safeParse(req.query);
    if (!paginationResult.success) {
      throw new ValidationError(paginationResult.error.issues[0]?.message ?? 'Invalid pagination');
    }

    const data = await getCommentsService().listReplies(
      req.params.commentId,
      paginationResult.data
    );

    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// GET /api/v2/comments/:contentId
// ============================================================================

/**
 * GET /api/v2/comments/:contentId
 * List top-level comments for a content item. Public endpoint (anonymous access).
 * Content must be published — returns 404 for missing or non-published content.
 */
router.get(
  '/:contentId',
  optionalAuth,
  readOnlyRateLimiter,
  asyncHandler(async (req, res) => {
    const paginationResult = CommentsPaginationSchema.safeParse(req.query);
    if (!paginationResult.success) {
      throw new ValidationError(paginationResult.error.issues[0]?.message ?? 'Invalid pagination');
    }

    const callerPubkey = req.user?.nostr_pubkey ?? null;
    const data = await getCommentsService().listComments(
      req.params.contentId,
      callerPubkey,
      paginationResult.data
    );

    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// POST /api/v2/comments/:contentId
// ============================================================================

/**
 * POST /api/v2/comments/:contentId
 * Create a top-level comment or reply. Requires authentication.
 * Rate limited: 10/minute per user.
 */
router.post(
  '/:contentId',
  authenticate,
  requireAuth,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = CreateCommentSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    const data = await getCommentsService().createComment(
      getAuthUser(req).nostr_pubkey,
      req.params.contentId,
      result.data
    );

    res.status(201).json(createApiResponse(req, data));
  })
);

// ============================================================================
// DELETE /api/v2/comments/:commentId
// ============================================================================

/**
 * DELETE /api/v2/comments/:commentId
 * Soft-delete a comment (own → 'deleted') or moderate it (content creator → 'moderated').
 * Requires authentication. Rate limited: 10/minute per user.
 */
router.delete(
  '/:commentId',
  authenticate,
  requireAuth,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    await getCommentsService().deleteComment(getAuthUser(req).nostr_pubkey, req.params.commentId);

    res.json(createApiResponse(req, null));
  })
);

export default router;
