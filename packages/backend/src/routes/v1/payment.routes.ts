/**
 * Payment API Routes (v1)
 *
 * RESTful endpoints for payment operations
 * All routes use /api/v1/payments prefix
 */

import { Request, Response, NextFunction, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireNostrSignature } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { rateLimiters } from '../../middleware/rate-limit-middleware';
import { PaymentValidators } from '../../validators/payment';
import { PaymentController } from '../../controllers/payment/PaymentController';

const router = Router();

/**
 * Lazily resolve the PaymentController from the DI container.
 */
let _paymentController: PaymentController | null = null;
function getController(): PaymentController {
  if (!_paymentController) {
    _paymentController = container.get<PaymentController>(TYPES.PaymentController);
  }
  return _paymentController;
}

// Invoice endpoints
router.post(
  '/invoices',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.createInvoice,
  validate({ body: PaymentValidators.createInvoice }),
  (req: Request, res: Response, next: NextFunction) => getController().createInvoice(req, res, next)
);

router.get(
  '/invoices/:id',
  authenticate,
  rateLimiters.payment.read,
  validate({ params: PaymentValidators.invoiceIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getInvoice(req, res, next)
);

router.post(
  '/invoices/:id/pay',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.payInvoice,
  validate({ params: PaymentValidators.invoiceIdParam, body: PaymentValidators.payInvoice }),
  (req: Request, res: Response, next: NextFunction) => getController().payInvoice(req, res, next)
);

// Currency conversion endpoint
router.get(
  '/currency/convert',
  authenticate,
  rateLimiters.payment.read,
  validate({ query: PaymentValidators.convertCurrency }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().convertCurrency(req, res, next)
);

// Subscription tier listing (public)
router.get(
  '/subscriptions/tiers',
  rateLimiters.payment.read,
  (req: Request, res: Response, next: NextFunction) =>
    getController().getSubscriptionTiers(req, res, next)
);

// Get specific subscription
router.get(
  '/subscriptions/:id',
  authenticate,
  rateLimiters.payment.read,
  validate({ params: PaymentValidators.subscriptionIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getSubscription(req, res, next)
);

// Subscription endpoints
router.post(
  '/subscriptions',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.createSubscription,
  validate({ body: PaymentValidators.createSubscription }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().createSubscription(req, res, next)
);

router.put(
  '/subscriptions/:id',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.read,
  validate({
    params: PaymentValidators.subscriptionIdParam,
    body: PaymentValidators.updateSubscription,
  }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().updateSubscription(req, res, next)
);

router.delete(
  '/subscriptions/:id',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.read,
  validate({
    params: PaymentValidators.subscriptionIdParam,
    body: PaymentValidators.cancelSubscription,
  }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().cancelSubscription(req, res, next)
);

// Refund endpoint
router.post(
  '/refunds',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.createRefund,
  validate({ body: PaymentValidators.createRefund }),
  (req: Request, res: Response, next: NextFunction) => getController().createRefund(req, res, next)
);

// Analytics endpoint
router.get(
  '/analytics',
  authenticate,
  rateLimiters.payment.analytics,
  validate({ query: PaymentValidators.getPaymentAnalytics }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getPaymentAnalytics(req, res, next)
);

// Webhook endpoints
router.post(
  '/webhooks',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.webhook,
  validate({ body: PaymentValidators.registerWebhook }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().registerWebhook(req, res, next)
);

router.put(
  '/webhooks/:id',
  authenticate,
  rateLimiters.payment.webhook,
  validate({ params: PaymentValidators.webhookIdParam, body: PaymentValidators.updateWebhook }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().updateWebhook(req, res, next)
);

router.delete(
  '/webhooks/:id',
  authenticate,
  rateLimiters.payment.webhook,
  validate({ params: PaymentValidators.webhookIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().deleteWebhook(req, res, next)
);

// === Payment API Expansion (Todo 120) ===

// Transaction history
router.get(
  '/transactions',
  authenticate,
  rateLimiters.payment.read,
  validate({ query: PaymentValidators.getTransactionHistory }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getTransactionHistory(req, res, next)
);

// Balance
router.get(
  '/balance',
  authenticate,
  rateLimiters.payment.read,
  (req: Request, res: Response, next: NextFunction) =>
    getController().getBalance(req, res, next)
);

// Invoice listing
router.get(
  '/invoices',
  authenticate,
  rateLimiters.payment.read,
  (req: Request, res: Response, next: NextFunction) =>
    getController().listInvoices(req, res, next)
);

// Invoice retry
router.post(
  '/invoices/:id/retry',
  authenticate,
  rateLimiters.payment.payInvoice,
  validate({ params: PaymentValidators.invoiceIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().retryInvoice(req, res, next)
);

export default router;
