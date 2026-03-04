// @ts-nocheck
/**
 * Lightning Network API Routes
 * /api/lightning/*
 *
 * #627: Uses getAuthUser(req).nostr_pubkey instead of req.user.id
 * #635: All handlers use asyncHandler + createApiResponse (v2 pattern)
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireCreator, getAuthUser } from '../middleware/auth';
import { validate } from '../middleware/validation-middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { createApiResponse } from '../utils/api-response';
import { ValidationError } from '../utils/errors';
import { lightningService } from '../services/lightning/lightningService';

const router = express.Router();

const CreateSubscriptionBodySchema = z.object({
  creatorId: z.string().min(1),
  tier: z.string().min(1),
  amount: z.number().positive(),
  interval: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
});

// GET /api/lightning/node-info
router.get(
  '/node-info',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const nodeInfo = await lightningService.getNodeInfo();
    res.json(createApiResponse(req, nodeInfo, { raw: true }));
  })
);

// POST /api/lightning/invoice
router.post(
  '/invoice',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await lightningService.createInvoice(req.body);
    res.json(createApiResponse(req, result, { raw: true }));
  })
);

// GET /api/lightning/invoice/:paymentHash
router.get(
  '/invoice/:paymentHash',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentHash } = req.params;
    const invoice = await lightningService.checkInvoiceStatus(paymentHash);
    res.json(createApiResponse(req, invoice, { raw: true }));
  })
);

// POST /api/lightning/payment
router.post(
  '/payment',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentRequest } = req.body;
    if (!paymentRequest) {
      throw new ValidationError('Payment request is required');
    }
    const result = await lightningService.makePayment(paymentRequest);
    res.json(createApiResponse(req, result, { raw: true }));
  })
);

// POST /api/lightning/subscription
router.post(
  '/subscription',
  authenticate,
  validate({ body: CreateSubscriptionBodySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { creatorId, tier, amount, interval } = req.body;
    const subscription = await lightningService.createSubscription(
      getAuthUser(req).nostr_pubkey,
      creatorId,
      tier,
      amount,
      interval
    );
    res.json(createApiResponse(req, subscription, { raw: true }));
  })
);

// PUT /api/lightning/subscription/:subscriptionId/cancel
router.put(
  '/subscription/:subscriptionId/cancel',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { subscriptionId } = req.params;
    const subscription = await lightningService.cancelSubscription(subscriptionId);
    res.json(createApiResponse(req, subscription, { raw: true }));
  })
);

// GET /api/lightning/user/payments
router.get(
  '/user/payments',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const payments = await lightningService.getUserPaymentHistory(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, payments, { raw: true }));
  })
);

// GET /api/lightning/user/subscriptions
router.get(
  '/user/subscriptions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const subscriptions = await lightningService.getUserSubscriptions(
      getAuthUser(req).nostr_pubkey
    );
    res.json(createApiResponse(req, subscriptions, { raw: true }));
  })
);

// POST /api/lightning/creator/payout
router.post(
  '/creator/payout',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key header is required for payout requests');
    }

    const { amount, destination } = req.body;
    if (!amount || !destination) {
      throw new ValidationError('Missing required fields: amount, destination');
    }

    const payout = await lightningService.processPayout(
      getAuthUser(req).nostr_pubkey,
      amount,
      destination,
      idempotencyKey
    );
    res.json(createApiResponse(req, payout, { raw: true }));
  })
);

// GET /api/lightning/creator/payouts
router.get(
  '/creator/payouts',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const payouts = await lightningService.getCreatorPayoutHistory(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, payouts, { raw: true }));
  })
);

// GET /api/lightning/creator/subscribers
router.get(
  '/creator/subscribers',
  authenticate,
  requireCreator,
  asyncHandler(async (req: Request, res: Response) => {
    const subscribers = await lightningService.getCreatorSubscribers(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, subscribers, { raw: true }));
  })
);

export default router;
