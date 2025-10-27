/**
 * Payment API Routes (v1)
 *
 * RESTful endpoints for payment operations
 * All routes use /api/v1/payments prefix
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { PaymentController } from '../../controllers/payment/PaymentController';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { rateLimiters } from '../../middleware/rate-limit-middleware';
import { PaymentValidators } from '../../validators/payment';

const router = Router();
const paymentController = container.get<PaymentController>(TYPES.PaymentController);

// Invoice endpoints
router.post(
  '/invoices',
  authenticate,
  rateLimiters.payment.createInvoice,
  validate({ body: PaymentValidators.createInvoice }),
  paymentController.createInvoice
);

router.get(
  '/invoices/:id',
  authenticate,
  rateLimiters.payment.read,
  validate({ params: PaymentValidators.invoiceIdParam }),
  paymentController.getInvoice
);

router.post(
  '/invoices/:id/pay',
  authenticate,
  rateLimiters.payment.payInvoice,
  validate({ params: PaymentValidators.invoiceIdParam, body: PaymentValidators.payInvoice }),
  paymentController.payInvoice
);

// Currency conversion endpoint
router.get(
  '/currency/convert',
  authenticate,
  rateLimiters.payment.read,
  validate({ query: PaymentValidators.convertCurrency }),
  paymentController.convertCurrency
);

// Subscription endpoints
router.post(
  '/subscriptions',
  authenticate,
  rateLimiters.payment.createSubscription,
  validate({ body: PaymentValidators.createSubscription }),
  paymentController.createSubscription
);

router.put(
  '/subscriptions/:id',
  authenticate,
  rateLimiters.payment.read,
  validate({ params: PaymentValidators.subscriptionIdParam, body: PaymentValidators.updateSubscription }),
  paymentController.updateSubscription
);

router.delete(
  '/subscriptions/:id',
  authenticate,
  rateLimiters.payment.read,
  validate({ params: PaymentValidators.subscriptionIdParam, body: PaymentValidators.cancelSubscription }),
  paymentController.cancelSubscription
);

// Refund endpoint
router.post(
  '/refunds',
  authenticate,
  rateLimiters.payment.createRefund,
  validate({ body: PaymentValidators.createRefund }),
  paymentController.createRefund
);

// Analytics endpoint
router.get(
  '/analytics',
  authenticate,
  rateLimiters.payment.analytics,
  validate({ query: PaymentValidators.getPaymentAnalytics }),
  paymentController.getPaymentAnalytics
);

// Webhook endpoint
router.post(
  '/webhooks',
  authenticate,
  rateLimiters.payment.webhook,
  validate({ body: PaymentValidators.registerWebhook }),
  paymentController.registerWebhook
);

export default router;
