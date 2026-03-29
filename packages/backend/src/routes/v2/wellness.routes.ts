/**
 * Wellness API Routes (v2)
 * /api/v2/wellness/*
 * EPIC-007: Creator Wellness System
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { readOnlyRateLimiter, createUserRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
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
  asyncHandler(async (req, res) => {
    const data = await getWellnessService().recordWorkPattern(
      getAuthUser(req).nostr_pubkey,
      req.body
    );
    res.status(201).json(createApiResponse(req, data));
  })
);

router.get(
  '/patterns',
  authenticate,
  requireCreator,
  validate({ query: WellnessValidators.getWorkPatterns }),
  asyncHandler(async (req, res) => {
    const data = await getWellnessService().getWorkPatterns(
      getAuthUser(req).nostr_pubkey,
      req.query.period as '7d' | '30d' | '90d'
    );
    res.json(createApiResponse(req, data));
  })
);

router.get(
  '/patterns/heatmap',
  authenticate,
  requireCreator,
  validate({ query: WellnessValidators.getHeatmap }),
  asyncHandler(async (req, res) => {
    const data = await getWellnessService().getHeatmap(
      getAuthUser(req).nostr_pubkey,
      req.query.period as '7d' | '30d'
    );
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Burnout Risk Score
// ============================================================================

router.get(
  '/risk-score',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const data = await getBurnoutService().calculateScore(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, data));
  })
);

router.put(
  '/risk-score/sensitivity',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: WellnessValidators.setSensitivity }),
  asyncHandler(async (req, res) => {
    const data = await getBurnoutService().setSensitivity(
      getAuthUser(req).nostr_pubkey,
      req.body.sensitivity
    );
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Sustainable Scheduling
// ============================================================================

router.get(
  '/schedule/recommendations',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const data = await getScheduleService().getRecommendations(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, data));
  })
);

router.get(
  '/buffer-depth',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const data = await getScheduleService().getBufferDepth(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Creator Boundaries
// ============================================================================

router.get(
  '/boundaries',
  authenticate,
  requireCreator,
  asyncHandler(async (req, res) => {
    const data = await getBoundaryService().getBoundaries(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, data));
  })
);

router.put(
  '/boundaries',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: WellnessValidators.updateBoundaries }),
  asyncHandler(async (req, res) => {
    const data = await getBoundaryService().updateBoundaries(
      getAuthUser(req).nostr_pubkey,
      req.body
    );
    res.json(createApiResponse(req, data));
  })
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
  asyncHandler(async (req, res) => {
    // #655: No eligibility pre-check — let the UNIQUE constraint enforce one-per-day.
    // recordPulse throws ConflictError on duplicate; the error handler maps it to 409.
    const data = await getWellnessService().recordPulse(getAuthUser(req).nostr_pubkey, req.body);
    res.status(201).json(createApiResponse(req, data));
  })
);

router.get(
  '/pulse/history',
  authenticate,
  requireCreator,
  validate({ query: WellnessValidators.getPulseHistory }),
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const data = await getWellnessService().getPulseHistory(
      getAuthUser(req).nostr_pubkey,
      req.query.period as '30d' | '90d' | 'all',
      limit,
      offset
    );
    res.json(createApiResponse(req, data));
  })
);

router.get(
  '/benchmark',
  authenticate,
  // requireCreator intentionally omitted: benchmarks return anonymous aggregate
  // community data accessible to all authenticated users, not creator-specific content
  expensiveRateLimiter,
  asyncHandler(async (req, res) => {
    const data = await getWellnessService().getBenchmark();
    if (!data) {
      res.json(
        createApiResponse(req, {
          benchmark: null,
          message: 'Insufficient participants for anonymous benchmarking (minimum: 10)',
        })
      );
      return;
    }
    res.json(createApiResponse(req, data));
  })
);

router.delete(
  '/pulse',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const deleted_count = await getWellnessService().deletePulseHistory(
      getAuthUser(req).nostr_pubkey
    );
    res.json(createApiResponse(req, { deleted_count }));
  })
);

router.delete(
  '/data',
  authenticate,
  requireCreator,
  expensiveRateLimiter,
  asyncHandler(async (req, res) => {
    const deleted = await getWellnessService().deleteAllWellnessData(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, { deleted }));
  })
);

export default router;
