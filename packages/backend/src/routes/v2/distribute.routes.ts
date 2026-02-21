/**
 * Distribution Routes (v2)
 * /api/v2/distribute/*
 * EPIC-009: Cross-post, repurpose, status
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { DistributionValidators } from '../../validators/distribution';
import type { ICrossPostService } from '../../interfaces/distribution/ICrossPostService';
import type { IRepurposingService } from '../../interfaces/distribution/IRepurposingService';

const router = Router();

router.use(readOnlyRateLimiter);

const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });

// Lazy service resolution
let _crossPostService: ICrossPostService | null = null;
let _repurposingService: IRepurposingService | null = null;

function getCrossPostService(): ICrossPostService {
  if (!_crossPostService) _crossPostService = container.resolve(TYPES.CrossPostService);
  return _crossPostService;
}

function getRepurposingService(): IRepurposingService {
  if (!_repurposingService) _repurposingService = container.resolve(TYPES.RepurposingService);
  return _repurposingService;
}

// ============================================================================
// POST /publish — Queue content for cross-platform publishing
// ============================================================================

router.post(
  '/publish',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: DistributionValidators.publishBody }),
  asyncHandler(async (req, res) => {
    const result = await getCrossPostService().publish(getAuthUser(req).nostr_pubkey, req.body);
    res.status(202).json(createApiResponse(req, result));
  })
);

// ============================================================================
// GET /status/:contentId — Cross-post status per platform
// ============================================================================

router.get(
  '/status/:contentId',
  authenticate,
  requireCreator,
  validate({ params: DistributionValidators.contentIdParam }),
  asyncHandler(async (req, res) => {
    const data = await getCrossPostService().getStatus(
      getAuthUser(req).nostr_pubkey,
      req.params.contentId
    );
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// POST /:crossPostId/cancel — Cancel a pending/scheduled cross-post
// ============================================================================

router.post(
  '/:crossPostId/cancel',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ params: DistributionValidators.crossPostIdParam }),
  asyncHandler(async (req, res) => {
    const data = await getCrossPostService().cancel(
      getAuthUser(req).nostr_pubkey,
      req.params.crossPostId
    );
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// POST /repurpose — Generate platform-optimized versions
// ============================================================================

router.post(
  '/repurpose',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: DistributionValidators.repurposeBody }),
  asyncHandler(async (req, res) => {
    const data = await getRepurposingService().repurpose(
      getAuthUser(req).nostr_pubkey,
      req.body.content_id,
      req.body.target_platforms
    );
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// GET /repurposed/:contentId — Preview repurposed versions
// ============================================================================

router.get(
  '/repurposed/:contentId',
  authenticate,
  requireCreator,
  validate({ params: DistributionValidators.contentIdParam }),
  asyncHandler(async (req, res) => {
    const data = await getRepurposingService().getRepurposed(
      getAuthUser(req).nostr_pubkey,
      req.params.contentId
    );
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// PUT /repurposed/:id/approve — Approve a repurposed version
// ============================================================================

router.put(
  '/repurposed/:id/approve',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ params: DistributionValidators.repurposedIdParam }),
  asyncHandler(async (req, res) => {
    const data = await getRepurposingService().approve(
      getAuthUser(req).nostr_pubkey,
      req.params.id
    );
    res.json(createApiResponse(req, data));
  })
);

export default router;
