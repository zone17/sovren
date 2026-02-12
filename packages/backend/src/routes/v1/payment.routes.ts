/**
 * Payment API Routes (v1)
 *
 * RESTful endpoints for payment operations
 * All routes use /api/v1/payments prefix
 */

import { Request, Response, NextFunction, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { rateLimiters } from '../../middleware/rate-limit-middleware';
import { PaymentValidators } from '../../validators/payment';

const router = Router();

/**
 * Lazily resolve the PaymentController from the DI container.
 */
let _paymentController: any = null;
function getController() {
  if (!_paymentController) {
    _paymentController = container.get(TYPES.PaymentController);
  }
  return _paymentController;
}

// Invoice endpoints
router.post(
  '/invoices',
  authenticate,
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
  (req: Request, res: Response, next: NextFunction) => getController().convertCurrency(req, res, next)
);

// Subscription endpoints
router.post(
  '/subscriptions',
  authenticate,
  rateLimiters.payment.createSubscription,
  validate({ body: PaymentValidators.createSubscription }),
  (req: Request, res: Response, next: NextFunction) => getController().createSubscription(req, res, next)
);

router.put(
  '/subscriptions/:id',
  authenticate,
  rateLimiters.payment.read,
  validate({ params: PaymentValidators.subscriptionIdParam, body: PaymentValidators.updateSubscription }),
  (req: Request, res: Response, next: NextFunction) => getController().updateSubscription(req, res, next)
);

router.delete(
  '/subscriptions/:id',
  authenticate,
  rateLimiters.payment.read,
  validate({ params: PaymentValidators.subscriptionIdParam, body: PaymentValidators.cancelSubscription }),
  (req: Request, res: Response, next: NextFunction) => getController().cancelSubscription(req, res, next)
);

// Refund endpoint
router.post(
  '/refunds',
  authenticate,
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
  (req: Request, res: Response, next: NextFunction) => getController().getPaymentAnalytics(req, res, next)
);

// Webhook endpoint
router.post(
  '/webhooks',
  authenticate,
  rateLimiters.payment.webhook,
  validate({ body: PaymentValidators.registerWebhook }),
  (req: Request, res: Response, next: NextFunction) => getController().registerWebhook(req, res, next)
);

export default router;
