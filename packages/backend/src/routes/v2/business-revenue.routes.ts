/**
 * Business Revenue Routes
 * EPIC-011: Business Manager — Revenue tracking and diversification
 * /api/v2/business/revenue/*
 *
 * Security:
 * H-7: All mutating endpoints validated with Zod schemas
 * L-4: target_distribution validated via SetDiversificationGoalsSchema (sum-to-100 in service)
 */

import { Request, Response, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { RecordRevenueSchema, SetDiversificationGoalsSchema } from '../../validators/finance';
import type { IRevenueService } from '../../interfaces/finance/IRevenueService';

const router = Router();

let _revenueService: IRevenueService | null = null;
function getRevenueService(): IRevenueService {
  if (!_revenueService) _revenueService = container.resolve(TYPES.RevenueService);
  return _revenueService;
}

// ============================================================================
// Revenue Analysis
// ============================================================================

/**
 * GET /business/revenue/breakdown
 * Revenue by source with optional period filter
 */
router.get(
  '/breakdown',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const { start, end } = req.query as { start?: string; end?: string };
    const period = start && end ? { start, end } : undefined;
    const data = await getRevenueService().getRevenueBreakdown(creatorId, period);
    res.json(createApiResponse(req, data));
  })
);

/**
 * GET /business/revenue/risk
 * Concentration risk analysis (warns if >50% from single source)
 */
router.get(
  '/risk',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const data = await getRevenueService().getConcentrationRisk(creatorId);
    res.json(createApiResponse(req, data));
  })
);

/**
 * GET /business/revenue/goals
 * Diversification goals
 */
router.get(
  '/goals',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const data = await getRevenueService().getDiversificationGoals(creatorId);
    res.json(createApiResponse(req, data));
  })
);

/**
 * PUT /business/revenue/goals
 * Set diversification targets (percentages must sum to 100)
 * L-4: targets keys restricted to known revenue source enum
 */
router.put(
  '/goals',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const result = SetDiversificationGoalsSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const creatorId = getAuthUser(req).nostr_pubkey;
    await getRevenueService().setDiversificationGoals(creatorId, result.data.targets);
    res.json(createApiResponse(req, { updated: true }));
  })
);

/**
 * POST /business/revenue
 * Record a revenue entry (H-5: BTC/USD rate provenance recorded in service)
 */
router.post(
  '/',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const result = RecordRevenueSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const creatorId = getAuthUser(req).nostr_pubkey;
    const { source, amountSats, description } = result.data;
    const data = await getRevenueService().recordRevenue(creatorId, {
      source,
      amountSats,
      description,
    });
    res.status(201).json(createApiResponse(req, data));
  })
);

export default router;
