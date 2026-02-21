/**
 * Business Tax Routes
 * EPIC-011: Business Manager — Tax preparation and expense tracking
 * /api/v2/business/tax/*
 *
 * Security:
 * H-7: All mutating endpoints validated with Zod schemas
 */

import { Request, Response, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { createUserRateLimiter, readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { ExpenseSchema, CreateExpenseCategorySchema } from '../../validators/finance';
import type { ITaxService } from '../../interfaces/finance/ITaxService';

const router = Router();

// #261: Apply rate limiters
router.use(readOnlyRateLimiter);
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });

let _taxService: ITaxService | null = null;
function getTaxService(): ITaxService {
  if (!_taxService) _taxService = container.resolve(TYPES.TaxService);
  return _taxService;
}

// ============================================================================
// Tax Summary
// ============================================================================

/**
 * GET /business/tax/summary
 * Quarterly summary — ?year=2026&quarter=1
 */
router.get(
  '/summary',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const rawQuarter = parseInt(req.query.quarter as string) || 1;

    if (rawQuarter < 1 || rawQuarter > 4 || !Number.isInteger(rawQuarter)) {
      res.status(400).json({ success: false, error: 'quarter must be 1, 2, 3, or 4' });
      return;
    }
    const quarter = rawQuarter as 1 | 2 | 3 | 4;

    const data = await getTaxService().getQuarterlySummary(creatorId, year, quarter);
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Expenses
// ============================================================================

/**
 * GET /business/tax/expenses
 * Expenses with filters — ?categoryId=...&startDate=...&endDate=...
 */
router.get(
  '/expenses',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const { categoryId, startDate, endDate } = req.query as {
      categoryId?: string;
      startDate?: string;
      endDate?: string;
    };
    const data = await getTaxService().getExpenses(creatorId, { categoryId, startDate, endDate });
    res.json(createApiResponse(req, data));
  })
);

/**
 * POST /business/tax/expenses
 * Add expense (H-5: BTC/USD rate provenance recorded in service)
 */
router.post(
  '/expenses',
  authenticate,
  mutationRateLimiter,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const result = ExpenseSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const creatorId = getAuthUser(req).nostr_pubkey;
    const { categoryId, description, amountSats, expenseDate } = result.data;
    const data = await getTaxService().addExpense(creatorId, {
      categoryId,
      description,
      amountSats,
      expenseDate,
    });
    res.status(201).json(createApiResponse(req, data));
  })
);

// ============================================================================
// Expense Categories
// ============================================================================

/**
 * GET /business/tax/categories
 * Expense categories
 */
router.get(
  '/categories',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const data = await getTaxService().getExpenseCategories(creatorId);
    res.json(createApiResponse(req, data));
  })
);

/**
 * POST /business/tax/categories
 * Create expense category
 */
router.post(
  '/categories',
  authenticate,
  mutationRateLimiter,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const result = CreateExpenseCategorySchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const creatorId = getAuthUser(req).nostr_pubkey;
    const data = await getTaxService().createExpenseCategory(creatorId, result.data);
    res.status(201).json(createApiResponse(req, data));
  })
);

/**
 * DELETE /business/tax/expenses/:id
 * Delete an expense
 */
router.delete(
  '/expenses/:id',
  authenticate,
  mutationRateLimiter,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    await getTaxService().deleteExpense(req.params.id, creatorId);
    res.json(createApiResponse(req, { deleted: true }));
  })
);

/**
 * DELETE /business/tax/categories/:id
 * Delete an expense category
 */
router.delete(
  '/categories/:id',
  authenticate,
  mutationRateLimiter,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    await getTaxService().deleteExpenseCategory(req.params.id, creatorId);
    res.json(createApiResponse(req, { deleted: true }));
  })
);

// ============================================================================
// Tax Export
// ============================================================================

/**
 * GET /business/tax/export
 * Export tax report — ?year=2026&format=csv|json
 * L-5: CSV injection protection applied inside TaxService.exportTaxReport
 */
router.get(
  '/export',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const format = (req.query.format as string) === 'json' ? 'json' : 'csv';

    const data = await getTaxService().exportTaxReport(creatorId, year, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tax-report-${year}.csv"`);
      res.send(data);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tax-report-${year}.json"`);
      res.send(data);
    }
  })
);

export default router;
