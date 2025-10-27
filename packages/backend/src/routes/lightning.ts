import express from 'express';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { lightningService } from '../services/lightning/lightningService';
import { CreateInvoiceRequestSchema } from '../types/lightning';

const router = express.Router();

/**
 * @route GET /api/lightning/node-info
 * @desc Get Lightning node information
 * @access Private
 */
router.get('/node-info', authenticate, async (req, res) => {
  try {
    const nodeInfo = await lightningService.getNodeInfo();
    res.json(nodeInfo);
  } catch (error) {
    console.error('Error getting node info:', error);
    res.status(500).json({ error: 'Failed to get Lightning node information' });
  }
});

/**
 * @route POST /api/lightning/invoice
 * @desc Create a Lightning invoice
 * @access Private
 */
router.post(
  '/invoice',
  authenticate,
  validateRequest(CreateInvoiceRequestSchema),
  async (req, res) => {
    try {
      const invoice = await lightningService.createInvoice(req.body);
      res.json(invoice);
    } catch (error) {
      console.error('Error creating invoice:', error);
      res.status(500).json({ error: 'Failed to create Lightning invoice' });
    }
  }
);

/**
 * @route GET /api/lightning/invoice/:paymentHash
 * @desc Check status of a Lightning invoice
 * @access Private
 */
router.get('/invoice/:paymentHash', authenticate, async (req, res) => {
  try {
    const { paymentHash } = req.params;
    const invoice = await lightningService.checkInvoiceStatus(paymentHash);
    res.json(invoice);
  } catch (error) {
    console.error('Error checking invoice status:', error);
    res.status(500).json({ error: 'Failed to check Lightning invoice status' });
  }
});

/**
 * @route POST /api/lightning/payment
 * @desc Make a Lightning payment
 * @access Private
 */
router.post('/payment', authenticate, async (req, res) => {
  try {
    const { paymentRequest } = req.body;

    if (!paymentRequest) {
      return res.status(400).json({ error: 'Payment request is required' });
    }

    const result = await lightningService.makePayment(paymentRequest);
    res.json(result);
  } catch (error) {
    console.error('Error making payment:', error);
    res.status(500).json({ error: 'Failed to make Lightning payment' });
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

    // Validate required fields
    if (!creatorId || !tier || !amount || !interval) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate interval
    const validIntervals = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval' });
    }

    const subscription = await lightningService.createSubscription(
      req.user.id,
      creatorId,
      tier,
      amount,
      interval
    );

    res.json(subscription);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create Lightning subscription' });
  }
});

/**
 * @route PUT /api/lightning/subscription/:subscriptionId/cancel
 * @desc Cancel a Lightning subscription
 * @access Private
 */
router.put('/subscription/:subscriptionId/cancel', authenticate, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await lightningService.cancelSubscription(subscriptionId);
    res.json(subscription);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel Lightning subscription' });
  }
});

/**
 * @route GET /api/lightning/user/payments
 * @desc Get payment history for the authenticated user
 * @access Private
 */
router.get('/user/payments', authenticate, async (req, res) => {
  try {
    const payments = await lightningService.getUserPaymentHistory(req.user.id);
    res.json(payments);
  } catch (error) {
    console.error('Error getting payment history:', error);
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
    const subscriptions = await lightningService.getUserSubscriptions(req.user.id);
    res.json(subscriptions);
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    res.status(500).json({ error: 'Failed to get Lightning subscriptions' });
  }
});

/**
 * @route POST /api/lightning/creator/payout
 * @desc Process a payout to a creator
 * @access Private (Creator only)
 */
router.post('/creator/payout', authenticate, async (req, res) => {
  try {
    const { amount, destination } = req.body;

    // Validate required fields
    if (!amount || !destination) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // In a real implementation, we would check if the user is a creator
    // For now, we'll use the authenticated user's ID
    const payout = await lightningService.processPayout(req.user.id, amount, destination);
    res.json(payout);
  } catch (error) {
    console.error('Error processing payout:', error);
    res.status(500).json({ error: 'Failed to process Lightning payout' });
  }
});

/**
 * @route GET /api/lightning/creator/payouts
 * @desc Get payout history for the authenticated creator
 * @access Private (Creator only)
 */
router.get('/creator/payouts', authenticate, async (req, res) => {
  try {
    // In a real implementation, we would check if the user is a creator
    // For now, we'll use the authenticated user's ID
    const payouts = await lightningService.getCreatorPayoutHistory(req.user.id);
    res.json(payouts);
  } catch (error) {
    console.error('Error getting payout history:', error);
    res.status(500).json({ error: 'Failed to get Lightning payout history' });
  }
});

/**
 * @route GET /api/lightning/creator/subscribers
 * @desc Get subscribers for the authenticated creator
 * @access Private (Creator only)
 */
router.get('/creator/subscribers', authenticate, async (req, res) => {
  try {
    // In a real implementation, we would check if the user is a creator
    // For now, we'll use the authenticated user's ID
    const subscribers = await lightningService.getCreatorSubscribers(req.user.id);
    res.json(subscribers);
  } catch (error) {
    console.error('Error getting subscribers:', error);
    res.status(500).json({ error: 'Failed to get Lightning subscribers' });
  }
});

export default router;
