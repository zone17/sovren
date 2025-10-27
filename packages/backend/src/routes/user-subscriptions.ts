/**
 * 💳 **USER SUBSCRIPTION API ROUTES**
 *
 * API endpoints for user subscription management
 * Stories: US-079, US-080, US-081, US-082
 */

import express from 'express';
import { UserSubscriptionService } from '../services/user-subscription-service';

const router = express.Router();

// US-079: Get user subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    const subscriptions = await service.getUserSubscriptions(userId);

    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// US-080: Toggle auto-renewal
router.patch('/subscriptions/:id/auto-renew', async (req, res) => {
  try {
    const userId = req.user?.id;
    const subscriptionId = req.params.id;
    const { auto_renew } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    await service.toggleAutoRenewal(userId, subscriptionId, auto_renew);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update auto-renewal' });
  }
});

// Cancel subscription
router.post('/subscriptions/:id/cancel', async (req, res) => {
  try {
    const userId = req.user?.id;
    const subscriptionId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    await service.cancelSubscription(userId, subscriptionId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Pause subscription
router.post('/subscriptions/:id/pause', async (req, res) => {
  try {
    const userId = req.user?.id;
    const subscriptionId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    await service.pauseSubscription(userId, subscriptionId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause subscription' });
  }
});

// Resume subscription
router.post('/subscriptions/:id/resume', async (req, res) => {
  try {
    const userId = req.user?.id;
    const subscriptionId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    await service.resumeSubscription(userId, subscriptionId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
});

// US-081: Get payment methods
router.get('/payment-methods', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    const paymentMethods = await service.getUserPaymentMethods(userId);

    res.json(paymentMethods);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Add payment method
router.post('/payment-methods', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    const paymentMethod = await service.addPaymentMethod(userId, req.body);

    res.status(201).json(paymentMethod);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add payment method' });
  }
});

// Set default payment method
router.post('/payment-methods/:id/set-default', async (req, res) => {
  try {
    const userId = req.user?.id;
    const methodId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    await service.setDefaultPaymentMethod(userId, methodId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
});

// Delete payment method
router.delete('/payment-methods/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const methodId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    await service.deletePaymentMethod(userId, methodId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// US-082: Get subscription history
router.get('/subscription-history', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const service = new UserSubscriptionService();
    const history = await service.getSubscriptionHistory(userId, limit, offset);

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscription history' });
  }
});

// Export subscription history
router.get('/subscription-history/export', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const service = new UserSubscriptionService();
    const csvData = await service.exportSubscriptionHistory(userId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=subscription-history.csv');
    res.send(csvData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export subscription history' });
  }
});

export default router;
