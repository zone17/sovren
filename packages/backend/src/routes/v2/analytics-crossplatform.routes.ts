/**
 * Cross-Platform Analytics Routes (v2)
 * /api/v2/analytics/cross-platform/*
 * EPIC-009: Aggregate cross-platform metrics
 */

import { Request, Response, NextFunction, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { DistributionValidators } from '../../validators/distribution';
import type { ICrossPlatformAnalyticsService } from '../../interfaces/distribution/ICrossPlatformAnalyticsService';

const router = Router();

router.use(readOnlyRateLimiter);

// Lazy service resolution
let _analyticsService: ICrossPlatformAnalyticsService | null = null;

function getAnalyticsService(): ICrossPlatformAnalyticsService {
  if (!_analyticsService) _analyticsService = container.resolve(TYPES.CrossPlatformAnalyticsService);
  return _analyticsService;
}

// ============================================================================
// GET /overview — Aggregate followers/engagement
// ============================================================================

router.get(
  '/overview',
  authenticate,
  requireCreator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getAnalyticsService().getOverview(req.user!.nostr_pubkey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// GET /comparison/:contentId — Same content, different platforms
// ============================================================================

router.get(
  '/comparison/:contentId',
  authenticate,
  requireCreator,
  validate({ params: DistributionValidators.analyticsContentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getAnalyticsService().getContentComparison(
        req.user!.nostr_pubkey,
        req.params.contentId
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// GET /roi — Engagement per hour invested per platform
// ============================================================================

router.get(
  '/roi',
  authenticate,
  requireCreator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getAnalyticsService().getROI(req.user!.nostr_pubkey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
