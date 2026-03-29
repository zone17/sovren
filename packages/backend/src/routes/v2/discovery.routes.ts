/**
 * Discovery API Routes (v2)
 * /api/v2/discovery/*
 * Slice 2: Discovery MVP — public creator search
 *
 * Todo #568: Delegates to DI-resolved DiscoveryService (extracted from inline logic).
 */

import { Router } from 'express';
import { z } from 'zod';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { expensiveOperationRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { DISCOVERY_CATEGORIES } from '@shared/types/discovery';
import type { IDiscoveryService } from '../../interfaces/discovery/IDiscoveryService';

const router = Router();

router.use(expensiveOperationRateLimiter);

// Lazy service resolution (same pattern as follow.routes.ts)
let _discoveryService: IDiscoveryService | null = null;
function getDiscoveryService(): IDiscoveryService {
  if (!_discoveryService) _discoveryService = container.resolve(TYPES.DiscoveryService);
  return _discoveryService;
}

const searchCreatorsSchema = z.object({
  q: z.string().min(2).max(100).optional(),
  category: z.enum(DISCOVERY_CATEGORIES).optional(),
  sortBy: z.enum(['relevance', 'followers', 'newest']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get(
  '/creators',
  optionalAuth,
  validate({ query: searchCreatorsSchema }),
  asyncHandler(async (req, res) => {
    const params = req.query as unknown as z.infer<typeof searchCreatorsSchema>;
    const responseData = await getDiscoveryService().searchCreators(params);
    res.json(createApiResponse(req, responseData, { raw: true }));
  })
);

// ── GET /creators/:id — Individual creator profile ──

const creatorIdParamSchema = z.object({
  id: z.string().uuid(),
});

router.get(
  '/creators/:id',
  optionalAuth,
  validate({ params: creatorIdParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof creatorIdParamSchema>;
    const profile = await getDiscoveryService().getCreatorProfile(id);
    res.json(createApiResponse(req, profile, { raw: true }));
  })
);

// Re-export for tests that import this directly
export { escapePostgrestFilter } from '../../services/discovery/DiscoveryService';
export default router;
