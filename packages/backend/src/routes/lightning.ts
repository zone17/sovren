import express from 'express';
import { z } from 'zod';
import { authenticate, requireCreator } from '../middleware/auth';
import { LightningService } from '../services/lightning-service';
import logger from '../lib/logger';

const router = express.Router();

/**
 * Shape returned to the frontend — camelCase, flat, no internal IDs.
 */
interface FrontendInvoiceShape {
  paymentRequest: string;
  paymentHash: string;
  amount: number;
  description: string;
  createdAt: number;
  expiresAt: number;
  settled: boolean;
}

function mapInvoiceToFrontend(invoice: {
  payment_request: string;
  payment_hash: string;
  amount: number;
  description: string;
  created_at: number;
  expires_at: number;
  status: string;
}): FrontendInvoiceShape {
  return {
    paymentRequest: invoice.payment_request,
    paymentHash: invoice.payment_hash,
    amount: invoice.amount,
    description: invoice.description,
    createdAt: invoice.created_at,
    expiresAt: invoice.expires_at,
    settled: invoice.status === 'paid',
  };
}

const CreateInvoiceBodySchema = z.object({
  amount: z.number().positive(),
  creatorId: z.string().uuid(),
  description: z.string().optional(),
  expirySeconds: z.number().positive().optional(),
});

/**
 * @route POST /api/lightning/invoice
 * @desc Create a Lightning invoice
 * @access Private
 */
router.post('/invoice', authenticate, async (req, res) => {
  try {
    const parsed = CreateInvoiceBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { amount, creatorId, description, expirySeconds } = parsed.data;
    const lightning = LightningService.getInstance();

    const result = await lightning.createInvoice({
      amount,
      description: description || 'Sovren Creator Support',
      creatorId,
      supporterId: req.user.id,
      expiryMinutes: expirySeconds ? Math.ceil(expirySeconds / 60) : undefined,
    });

    if (!result.success || !result.invoice) {
      return res.status(500).json({ error: result.error || 'Failed to create invoice' });
    }

    res.json(mapInvoiceToFrontend(result.invoice));
  } catch (error) {
    logger.error('Error creating invoice:', { error: String(error) });
    res.status(500).json({ error: 'Failed to create Lightning invoice' });
  }
});

/**
 * @route GET /api/lightning/invoice/:paymentHash
 * @desc Check status of a Lightning invoice by payment hash
 * @access Private
 */
router.get('/invoice/:paymentHash', authenticate, async (req, res) => {
  try {
    const { paymentHash } = req.params;
    const lightning = LightningService.getInstance();

    // Look up invoice ID from payment hash via index/persistence
    const invoice = await lightning.getInvoiceByPaymentHash(paymentHash);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Now check live status with LNbits
    const statusResult = await lightning.checkInvoiceStatus(invoice.id);
    if (!statusResult.success || !statusResult.invoice) {
      return res.status(500).json({ error: statusResult.error || 'Failed to check status' });
    }

    res.json(mapInvoiceToFrontend(statusResult.invoice));
  } catch (error) {
    logger.error('Error checking invoice status:', { error: String(error) });
    res.status(500).json({ error: 'Failed to check Lightning invoice status' });
  }
});

/**
 * @route GET /api/lightning/node-info
 * @desc Get Lightning node information
 * @access Private
 */
router.get('/node-info', authenticate, async (req, res) => {
  try {
    const lightning = LightningService.getInstance();
    const stats = await lightning.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting node info:', { error: String(error) });
    res.status(500).json({ error: 'Failed to get Lightning node information' });
  }
});

/**
 * @route POST /api/lightning/subscription
 * @desc Create a new Lightning subscription
 * @access Private
 */
router.post('/subscription', authenticate, async (req, res) => {
  try {
    const { creatorId, tier, amount, interval } = req.body;

    if (!creatorId || !tier || !amount || !interval) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validIntervals = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval' });
    }

    // For now, create an invoice for the first payment
    const lightning = LightningService.getInstance();
    const result = await lightning.createInvoice({
      amount,
      description: `Subscription: ${tier}`,
      creatorId,
      supporterId: req.user.id,
      metadata: { tier, interval },
    });

    if (!result.success || !result.invoice) {
      return res.status(500).json({ error: result.error || 'Failed to create subscription' });
    }

    res.json(mapInvoiceToFrontend(result.invoice));
  } catch (error) {
    logger.error('Error creating subscription:', { error: String(error) });
    res.status(500).json({ error: 'Failed to create Lightning subscription' });
  }
});

/**
 * @route GET /api/lightning/user/payments
 * @desc Get payment history for the authenticated user
 * @access Private
 */
router.get('/user/payments', authenticate, async (req, res) => {
  try {
    const lightning = LightningService.getInstance();
    const payments = await lightning.getCreatorPayments(req.user.id);
    res.json(payments);
  } catch (error) {
    logger.error('Error getting payment history:', { error: String(error) });
    res.status(500).json({ error: 'Failed to get Lightning payment history' });
  }
});

/**
 * @route GET /api/lightning/user/subscriptions
 * @desc Get active subscriptions for the authenticated user
 * @access Private
 */
router.get('/user/subscriptions', authenticate, async (req, res) => {
  try {
    // Placeholder — subscription management is a future slice
    res.json([]);
  } catch (error) {
    logger.error('Error getting subscriptions:', { error: String(error) });
    res.status(500).json({ error: 'Failed to get Lightning subscriptions' });
  }
});

/**
 * @route POST /api/lightning/creator/payout
 * @desc Process a payout to a creator
 * @access Private (Creator only)
 */
router.post('/creator/payout', authenticate, requireCreator, async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      return res
        .status(400)
        .json({ error: 'Idempotency-Key header is required for payout requests' });
    }

    const { amount, destination } = req.body;
    if (!amount || !destination) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Placeholder — payout processing via LNbits is a future slice
    res.json({ status: 'pending', message: 'Payout processing not yet implemented' });
  } catch (error) {
    logger.error('Error processing payout:', { error: String(error) });
    res.status(500).json({ error: 'Failed to process Lightning payout' });
  }
});

/**
 * @route POST /api/lightning/webhook
 * @desc Handle LNbits webhook for payment notifications
 * @access Public (verified by HMAC signature)
 */
router.post('/webhook', async (req, res) => {
  try {
    const lightning = LightningService.getInstance();
    const signature = req.headers['x-webhook-signature'] as string | undefined;

    const result = await lightning.processWebhook(req.body, signature);

    if (!result.success) {
      logger.error('Webhook processing failed:', { error: result.error });
      return res.status(400).json({ error: result.error });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', { error: String(error) });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
