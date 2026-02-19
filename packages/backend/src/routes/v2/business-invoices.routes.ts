/**
 * Business Invoices Routes
 * EPIC-011: Business Manager — Invoicing with LNURL-pay payment links
 * /api/v2/business/invoices/*
 *
 * Security:
 * H-7: All mutating endpoints validated with Zod schemas
 * M-8: recurrenceEndDate threaded through to service for limit enforcement
 * L-4: lineItems validated via LineItemSchema (type + positive integer checks)
 */

import { Request, Response, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { InvoiceSchema, UpdateInvoiceStatusSchema } from '../../validators/finance';
import type { IBusinessInvoiceService } from '../../interfaces/finance/IBusinessInvoiceService';

const router = Router();

// #261: Apply rate limiters
router.use(readOnlyRateLimiter);

let _invoiceService: IBusinessInvoiceService | null = null;
function getInvoiceService(): IBusinessInvoiceService {
  if (!_invoiceService) _invoiceService = container.resolve(TYPES.BusinessInvoiceService);
  return _invoiceService;
}

// ============================================================================
// Invoice CRUD
// ============================================================================

/**
 * POST /business/invoices
 * Create invoice with line items
 * L-4: lineItems array strictly validated via LineItemSchema
 * M-8: recurrenceEndDate passed to service for limit enforcement
 */
router.post(
  '/',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const result = InvoiceSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const creatorId = getAuthUser(req).nostr_pubkey;
    const { clientName, lineItems, dueDate, recurringInterval, recurrenceEndDate } = result.data;
    const data = await getInvoiceService().createInvoice(creatorId, {
      clientName,
      lineItems,
      dueDate,
      recurringInterval,
      recurrenceEndDate,
    });
    res.status(201).json(createApiResponse(req, data));
  })
);

/**
 * GET /business/invoices
 * List invoices with status filters
 */
router.get(
  '/',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const status = req.query.status as string | undefined;
    const data = await getInvoiceService().getInvoices(creatorId, { status });
    res.json(createApiResponse(req, data));
  })
);

/**
 * GET /business/invoices/:id
 * Single invoice
 */
router.get(
  '/:id',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const data = await getInvoiceService().getInvoice(req.params.id, creatorId);
    res.json(createApiResponse(req, data));
  })
);

/**
 * PUT /business/invoices/:id/status
 * Update invoice status (state machine enforced by DB trigger)
 */
router.put(
  '/:id/status',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const result = UpdateInvoiceStatusSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ success: false, error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    const creatorId = getAuthUser(req).nostr_pubkey;
    await getInvoiceService().updateInvoiceStatus(req.params.id, creatorId, result.data.status);
    res.json(createApiResponse(req, { updated: true }));
  })
);

/**
 * POST /business/invoices/:id/payment-link
 * Generate LNURL-pay link (dynamic BOLT11 on each scan — no expiry issues)
 */
router.post(
  '/:id/payment-link',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const creatorId = getAuthUser(req).nostr_pubkey;
    const data = await getInvoiceService().generatePaymentLink(req.params.id, creatorId);
    res.json(createApiResponse(req, data));
  })
);

export default router;
