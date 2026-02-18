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
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
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
    const { contentId, collaboratorId, revenueSplitBps } = req.body;

    if (!contentId || typeof contentId !== 'string') {
      res.status(400).json({ success: false, error: 'contentId is required' });
      return;
    }

    if (!collaboratorId || typeof collaboratorId !== 'string') {
      res.status(400).json({ success: false, error: 'collaboratorId is required' });
      return;
    }

    if (!Number.isInteger(revenueSplitBps) || revenueSplitBps <= 0) {
      res
        .status(400)
        .json({ success: false, error: 'revenueSplitBps must be a positive integer (1-10000)' });
      return;
    }

    const data = await getCollaborationService().inviteCollaborator(
      contentId,
      getAuthUser(req).nostr_pubkey,
      collaboratorId,
      revenueSplitBps
    );

    res.status(201).json({ success: true, data });
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
    const { splits } = req.body;

    if (!Array.isArray(splits) || splits.length === 0) {
      res.status(400).json({ success: false, error: 'splits must be a non-empty array' });
      return;
    }

    for (const split of splits) {
      if (!split.creatorId || !Number.isInteger(split.bps)) {
        res
          .status(400)
          .json({
            success: false,
            error: 'Each split must have creatorId (string) and bps (integer)',
          });
        return;
      }
    }

    await getCollaborationService().updateRevenueSplit(
      req.params.id,
      getAuthUser(req).nostr_pubkey,
      splits
    );

    res.json({ success: true });
  })
);

/**
 * GET /api/v2/content/:id/collaborators
 * List collaborators and their revenue splits
 */
router.get(
  '/:id/collaborators',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const data = await getCollaborationService().getCollaborators(
      req.params.id,
      getAuthUser(req).nostr_pubkey
    );
    res.json({ success: true, data });
  })
);

export default router;
