/**
 * Collaboration Routes
 * EPIC-010: Creator Network — Co-authoring and revenue splits (basis points)
 * /api/v2/content/* (collaboration endpoints)
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import {
  InviteCollaboratorSchema,
  RespondCollaborationSchema,
  UpdateRevenueSplitSchema,
} from '../../validators/community';
import { ValidationError } from '../../utils/errors';
import type { ICollaborativeContentService } from '../../interfaces/community/ICollaborativeContentService';

const router = Router();

// Rate limiters
router.use(readOnlyRateLimiter);
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });
// H-6: Revenue split modifications get stricter limit — 10/min per user
// Changes to revenue splits affect financial entitlements and need closer scrutiny
const revenueSplitRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 10 });

// Lazy service resolution
let _collaborationService: ICollaborativeContentService | null = null;
function getCollaborationService(): ICollaborativeContentService {
  if (!_collaborationService)
    _collaborationService = container.resolve(TYPES.CollaborativeContentService);
  return _collaborationService;
}

// ============================================================================
// Co-authoring
// ============================================================================

/**
 * POST /api/v2/content/collaborate
 * Invite co-authors to a piece of content
 */
router.post(
  '/collaborate',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = InviteCollaboratorSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    const data = await getCollaborationService().inviteCollaborator(
      result.data.contentId,
      getAuthUser(req).nostr_pubkey,
      result.data.collaboratorId,
      result.data.revenueSplitBps
    );

    res.status(201).json(createApiResponse(req, data));
  })
);

/**
 * PUT /api/v2/content/:id/revenue-split
 * Configure revenue splits for a piece of content (bps, must sum to 10000)
 * H-6: Stricter 10/min rate limit — revenue split changes affect financial entitlements
 */
router.put(
  '/:id/revenue-split',
  authenticate,
  requireCreator,
  revenueSplitRateLimiter, // H-6: 10/min — stricter than general mutations
  asyncHandler(async (req, res) => {
    const result = UpdateRevenueSplitSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    await getCollaborationService().updateRevenueSplit(
      req.params.id,
      getAuthUser(req).nostr_pubkey,
      result.data.splits
    );

    res.json(createApiResponse(req, { updated: true }));
  })
);

/**
 * PUT /api/v2/content/collaborations/:id/respond
 * Accept or decline a collaboration invitation (#266)
 */
router.put(
  '/collaborations/:id/respond',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const result = RespondCollaborationSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
    }

    await getCollaborationService().respondToInvitation(
      req.params.id,
      getAuthUser(req).nostr_pubkey,
      result.data.accept
    );

    res.json(createApiResponse(req, { accepted: result.data.accept }));
  })
);

/**
 * GET /api/v2/content/:id/collaborators
 * List collaborators and their revenue splits
 * #382: Pagination support
 */
router.get(
  '/:id/collaborators',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const data = await getCollaborationService().getCollaborators(
      req.params.id,
      getAuthUser(req).nostr_pubkey
    );
    const paginated = data.slice(offset, offset + limit);
    res.json(createApiResponse(req, { items: paginated, total: data.length, limit, offset }));
  })
);

export default router;
