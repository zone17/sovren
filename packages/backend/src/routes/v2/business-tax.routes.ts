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
import { ValidationError } from '../../utils/errors';
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
 * If ?quarter= is provided, returns single quarterly summary (backward compat).
 * If no quarter param, returns all 4 quarters for the year.
 */
router.get(
  '/summary',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    if (req.query.quarter) {
      const rawQuarter = parseInt(req.query.quarter as string);
      if (rawQuarter < 1 || rawQuarter > 4 || !Number.isInteger(rawQuarter)) {
        throw new ValidationError('quarter must be 1, 2, 3, or 4');
      }
      const quarter = rawQuarter as 1 | 2 | 3 | 4;
      const data = await getTaxService().getQuarterlySummary(creatorId, year, quarter);
      res.json(createApiResponse(req, data));
      return;
    }

    const data = await getTaxService().getAnnualSummary(creatorId, year);
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Expenses
// ============================================================================

/**
 * GET /business/tax/expenses
 * Expenses with filters — ?categoryId=...&startDate=...&endDate=...
 * #382: Pagination support
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
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const data = await getTaxService().getExpenses(creatorId, { categoryId, startDate, endDate });
    const paginated = data.slice(offset, offset + limit);
    res.json(createApiResponse(req, { items: paginated, total: data.length, limit, offset }));
  })
);

/**
 * POST /business/tax/expenses
 * Add expense (H-5: BTC/USD rate provenance recorded in service)
 */
router.post(
  '/expenses',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const result = ExpenseSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
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
 * #382: Pagination support
 */
router.get(
  '/categories',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const data = await getTaxService().getExpenseCategories(creatorId);
    const paginated = data.slice(offset, offset + limit);
    res.json(createApiResponse(req, { items: paginated, total: data.length, limit, offset }));
  })
);

/**
 * POST /business/tax/categories
 * Create expense category
 */
router.post(
  '/categories',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const result = CreateExpenseCategorySchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
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
  requireCreator,
  mutationRateLimiter,
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
  requireCreator,
  mutationRateLimiter,
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
