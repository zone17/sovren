/**
 * Cross-Platform Analytics Routes (v2)
 * /api/v2/analytics/cross-platform/*
 * EPIC-009 + EPIC-009B: Aggregate cross-platform metrics, ROI, content comparison
 */

import { Request, Response, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { DistributionValidators } from '../../validators/distribution';
import type { ICrossPlatformAnalyticsService } from '../../interfaces/distribution/ICrossPlatformAnalyticsService';

const router = Router();

router.use(readOnlyRateLimiter);

// Lazy service resolution
let _analyticsService: ICrossPlatformAnalyticsService | null = null;

function getAnalyticsService(): ICrossPlatformAnalyticsService {
  if (!_analyticsService)
    _analyticsService = container.resolve(TYPES.CrossPlatformAnalyticsService);
  return _analyticsService;
}

// ============================================================================
// GET /overview — Aggregate followers/engagement across all platforms
// Uses Supabase DISTINCT ON via service layer to avoid N+1 queries
// ============================================================================

router.get(
  '/overview',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getAnalyticsService().getOverview(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// GET /comparison/:contentId — Same content performance across platforms
// ============================================================================

router.get(
  '/comparison/:contentId',
  authenticate,
  requireCreator,
  validate({ params: DistributionValidators.contentIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getAnalyticsService().getContentComparison(
      getAuthUser(req).nostr_pubkey,
      req.params.contentId
    );
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// GET /roi — Engagement per hour invested per platform
// ============================================================================

router.get(
  '/roi',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getAnalyticsService().getROI(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, data));
  })
);

export default router;
