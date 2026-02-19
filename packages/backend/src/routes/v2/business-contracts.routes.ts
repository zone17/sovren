/**
 * Business Contracts Routes
 * EPIC-011: Business Manager — Contract templates and management
 * /api/v2/business/contracts/*
 *
 * Security:
 * H-7: All mutating endpoints validated with Zod schemas (max-length + type enforcement)
 * H-3: filledText is stored raw — never rendered server-side
 */

import { Request, Response, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import {
  CreateContractSchema,
  UpdateContractSchema,
  AnalyzeContractSchema,
  CreateTemplateSchema,
} from '../../validators/finance';
import type { IContractService } from '../../interfaces/finance/IContractService';

const router = Router();

// #261: Apply rate limiters to all routes
router.use(readOnlyRateLimiter);
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });

// Lazy service resolution
let _contractService: IContractService | null = null;
function getContractService(): IContractService {
  if (!_contractService) _contractService = container.resolve(TYPES.ContractService);
  return _contractService;
}

// ============================================================================
// Contract Templates (public read, no auth required)
// ============================================================================

/**
 * GET /business/contracts/templates
 * List templates by category
 */
router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;
    const data = await getContractService().getTemplates(category);
    res.json(createApiResponse(req, data));
  })
);

/**
 * POST /business/contracts/templates
 * Create a user-owned contract template (authenticated)
 */
router.post(
  '/templates',
  authenticate,
  mutationRateLimiter,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const result = CreateTemplateSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const creatorId = getAuthUser(req).nostr_pubkey;
    const data = await getContractService().createTemplate(creatorId, result.data);
    res.status(201).json(createApiResponse(req, data));
  })
);

/**
 * GET /business/contracts/templates/:id
 * Single template
 */
router.get(
  '/templates/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getContractService().getTemplate(req.params.id);
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Contract Analysis (authenticated)
// ============================================================================

/**
 * POST /business/contracts/analyze
 * Red flag analysis on contract text
 */
router.post(
  '/analyze',
  authenticate,
  mutationRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const result = AnalyzeContractSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const data = await getContractService().analyzeRedFlags(result.data.text);
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Creator Contracts (authenticated + creator role)
// ============================================================================

/**
 * POST /business/contracts
 * Create contract from template
 */
router.post(
  '/',
  authenticate,
  mutationRateLimiter,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const result = CreateContractSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const creatorId = getAuthUser(req).nostr_pubkey;
    const data = await getContractService().createContract(creatorId, result.data);
    res.status(201).json(createApiResponse(req, data));
  })
);

/**
 * GET /business/contracts
 * List creator's contracts
 */
router.get(
  '/',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const data = await getContractService().getContracts(creatorId);
    res.json(createApiResponse(req, data));
  })
);

/**
 * PUT /business/contracts/:id
 * Update contract (filledText or status)
 */
router.put(
  '/:id',
  authenticate,
  mutationRateLimiter,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const result = UpdateContractSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const creatorId = getAuthUser(req).nostr_pubkey;
    await getContractService().updateContract(req.params.id, creatorId, result.data);
    res.json(createApiResponse(req, { updated: true }));
  })
);

export default router;
