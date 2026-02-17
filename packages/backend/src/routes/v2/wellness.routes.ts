/**
 * Wellness API Routes (v2)
 * /api/v2/wellness/*
 * EPIC-007: Creator Wellness System
 */

import { Request, Response, NextFunction, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, optionalAuth, AuthenticatedRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import {
  readOnlyRateLimiter,
  createUserRateLimiter,
} from '../../middleware/rate-limit-middleware';
import { WellnessValidators } from '../../validators/wellness';
import type { IWellnessService } from '../../interfaces/wellness/IWellnessService';
import type { IBurnoutScoringService } from '../../interfaces/wellness/IBurnoutScoringService';
import type { IScheduleService } from '../../interfaces/wellness/IScheduleService';
import type { IBoundaryService } from '../../interfaces/wellness/IBoundaryService';

const router = Router();

// Rate limiting: baseline read limit for all GET endpoints
router.use(readOnlyRateLimiter);

// Stricter rate limiters for mutations and expensive operations
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });
const expensiveRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 5 });

// Lazy service resolution
let _wellnessService: IWellnessService | null = null;
let _burnoutService: IBurnoutScoringService | null = null;
let _scheduleService: IScheduleService | null = null;
let _boundaryService: IBoundaryService | null = null;

function getWellnessService(): IWellnessService {
  if (!_wellnessService) _wellnessService = container.resolve(TYPES.WellnessService);
  return _wellnessService;
}
function getBurnoutService(): IBurnoutScoringService {
  if (!_burnoutService) _burnoutService = container.resolve(TYPES.BurnoutScoringService);
  return _burnoutService;
}
function getScheduleService(): IScheduleService {
  if (!_scheduleService) _scheduleService = container.resolve(TYPES.ScheduleService);
  return _scheduleService;
}
function getBoundaryService(): IBoundaryService {
  if (!_boundaryService) _boundaryService = container.resolve(TYPES.BoundaryService);
  return _boundaryService;
}

// ============================================================================
// Work Patterns
// ============================================================================

router.post(
  '/patterns',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: WellnessValidators.recordWorkPattern }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getWellnessService().recordWorkPattern(req.user.nostr_pubkey, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/patterns',
  authenticate,
  requireCreator,
  validate({ query: WellnessValidators.getWorkPatterns }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getWellnessService().getWorkPatterns(
        req.user.nostr_pubkey,
        req.query.period as '7d' | '30d' | '90d'
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/patterns/heatmap',
  authenticate,
  requireCreator,
  validate({ query: WellnessValidators.getHeatmap }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getWellnessService().getHeatmap(
        req.user.nostr_pubkey,
        req.query.period as '7d' | '30d'
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Burnout Risk Score
// ============================================================================

router.get(
  '/risk-score',
  authenticate,
  requireCreator,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getBurnoutService().calculateScore(req.user.nostr_pubkey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/risk-score/sensitivity',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: WellnessValidators.setSensitivity }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getBurnoutService().setSensitivity(req.user.nostr_pubkey, req.body.sensitivity);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Sustainable Scheduling
// ============================================================================

router.get(
  '/schedule/recommendations',
  authenticate,
  requireCreator,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getScheduleService().getRecommendations(req.user.nostr_pubkey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/buffer-depth',
  authenticate,
  requireCreator,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getScheduleService().getBufferDepth(req.user.nostr_pubkey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Creator Boundaries
// ============================================================================

router.get(
  '/boundaries',
  authenticate,
  requireCreator,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getBoundaryService().getBoundaries(req.user.nostr_pubkey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/boundaries',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: WellnessValidators.updateBoundaries }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getBoundaryService().updateBoundaries(req.user.nostr_pubkey, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Wellness Pulse Check-Ins
// ============================================================================

router.post(
  '/pulse',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: WellnessValidators.recordPulse }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await getWellnessService().recordPulse(req.user.nostr_pubkey, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/pulse/history',
  authenticate,
  requireCreator,
  validate({ query: WellnessValidators.getPulseHistory }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const data = await getWellnessService().getPulseHistory(
        req.user.nostr_pubkey,
        req.query.period as '30d' | '90d' | 'all',
        limit,
        offset
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/benchmark',
  optionalAuth,
  expensiveRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getWellnessService().getBenchmark();
      if (!data) {
        res.json({
          success: true,
          data: null,
          message: 'Insufficient participants for anonymous benchmarking (minimum: 10)',
        });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/pulse',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const deleted_count = await getWellnessService().deletePulseHistory(req.user.nostr_pubkey);
      res.json({ success: true, data: { deleted_count } });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/data',
  authenticate,
  requireCreator,
  expensiveRateLimiter,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const deleted = await getWellnessService().deleteAllWellnessData(req.user.nostr_pubkey);
      res.json({ success: true, data: { deleted } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
