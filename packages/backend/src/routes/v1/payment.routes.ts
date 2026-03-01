// @ts-nocheck
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

/**
 * @openapi
 * /api/v1/payments/invoices:
 *   post:
 *     summary: Create a Lightning invoice
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *       - NostrSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInvoiceRequest'
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/invoices',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.createInvoice,
  validate({ body: PaymentValidators.createInvoice }),
  (req: Request, res: Response, next: NextFunction) => getController().createInvoice(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice details
 *       404:
 *         description: Invoice not found
 */
router.get(
  '/invoices/:id',
  authenticate,
  rateLimiters.payment.read,
  validate({ params: PaymentValidators.invoiceIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getInvoice(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/invoices/{id}/pay:
 *   post:
 *     summary: Pay a Lightning invoice
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *       - NostrSignature: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PayInvoiceRequest'
 *     responses:
 *       200:
 *         description: Payment processed
 *       400:
 *         description: Validation error
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/invoices/:id/pay',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.payInvoice,
  validate({ params: PaymentValidators.invoiceIdParam, body: PaymentValidators.payInvoice }),
  (req: Request, res: Response, next: NextFunction) => getController().payInvoice(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/currency/convert:
 *   get:
 *     summary: Convert between currencies
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Conversion result
 *       400:
 *         description: Validation error
 */
router.get(
  '/currency/convert',
  authenticate,
  rateLimiters.payment.read,
  validate({ query: PaymentValidators.convertCurrency }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().convertCurrency(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/subscriptions/tiers:
 *   get:
 *     summary: List available subscription tiers
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of subscription tiers
 */
router.get(
  '/subscriptions/tiers',
  rateLimiters.payment.read,
  (req: Request, res: Response, next: NextFunction) =>
    getController().getSubscriptionTiers(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/subscriptions/{id}:
 *   get:
 *     summary: Get subscription by ID
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription details
 *       404:
 *         description: Subscription not found
 */
router.get(
  '/subscriptions/:id',
  authenticate,
  rateLimiters.payment.read,
  validate({ params: PaymentValidators.subscriptionIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getSubscription(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/subscriptions:
 *   post:
 *     summary: Create a new subscription
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *       - NostrSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSubscriptionRequest'
 *     responses:
 *       201:
 *         description: Subscription created
 *       400:
 *         description: Validation error
 */
router.post(
  '/subscriptions',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.createSubscription,
  validate({ body: PaymentValidators.createSubscription }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().createSubscription(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/subscriptions/{id}:
 *   put:
 *     summary: Update a subscription
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *       - NostrSignature: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSubscriptionRequest'
 *     responses:
 *       200:
 *         description: Subscription updated
 *       404:
 *         description: Subscription not found
 */
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

/**
 * @openapi
 * /api/v1/payments/subscriptions/{id}:
 *   delete:
 *     summary: Cancel a subscription
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *       - NostrSignature: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription cancelled
 *       404:
 *         description: Subscription not found
 */
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

/**
 * @openapi
 * /api/v1/payments/refunds:
 *   post:
 *     summary: Create a refund
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *       - NostrSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRefundRequest'
 *     responses:
 *       201:
 *         description: Refund created
 *       400:
 *         description: Validation error
 */
router.post(
  '/refunds',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.createRefund,
  validate({ body: PaymentValidators.createRefund }),
  (req: Request, res: Response, next: NextFunction) => getController().createRefund(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/analytics:
 *   get:
 *     summary: Get payment analytics
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Payment analytics data
 */
router.get(
  '/analytics',
  authenticate,
  rateLimiters.payment.analytics,
  validate({ query: PaymentValidators.getPaymentAnalytics }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getPaymentAnalytics(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/webhooks:
 *   post:
 *     summary: Register a payment webhook
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *       - NostrSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterWebhookRequest'
 *     responses:
 *       201:
 *         description: Webhook registered
 */
router.post(
  '/webhooks',
  authenticate,
  requireNostrSignature,
  rateLimiters.payment.webhook,
  validate({ body: PaymentValidators.registerWebhook }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().registerWebhook(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/webhooks/{id}:
 *   put:
 *     summary: Update a webhook
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook updated
 */
router.put(
  '/webhooks/:id',
  authenticate,
  rateLimiters.payment.webhook,
  validate({ params: PaymentValidators.webhookIdParam, body: PaymentValidators.updateWebhook }),
  (req: Request, res: Response, next: NextFunction) => getController().updateWebhook(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/webhooks/{id}:
 *   delete:
 *     summary: Delete a webhook
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook deleted
 */
router.delete(
  '/webhooks/:id',
  authenticate,
  rateLimiters.payment.webhook,
  validate({ params: PaymentValidators.webhookIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().deleteWebhook(req, res, next)
);

// === Payment API Expansion (Todo 120) ===

/**
 * @openapi
 * /api/v1/payments/transactions:
 *   get:
 *     summary: Get transaction history
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction history
 */
router.get(
  '/transactions',
  authenticate,
  rateLimiters.payment.read,
  validate({ query: PaymentValidators.getTransactionHistory }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getTransactionHistory(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/balance:
 *   get:
 *     summary: Get user balance
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current balance
 */
router.get(
  '/balance',
  authenticate,
  rateLimiters.payment.read,
  (req: Request, res: Response, next: NextFunction) => getController().getBalance(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/invoices:
 *   get:
 *     summary: List all invoices
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of invoices
 */
router.get(
  '/invoices',
  authenticate,
  rateLimiters.payment.read,
  (req: Request, res: Response, next: NextFunction) => getController().listInvoices(req, res, next)
);

/**
 * @openapi
 * /api/v1/payments/invoices/{id}/retry:
 *   post:
 *     summary: Retry a failed invoice payment
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice retried
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/invoices/:id/retry',
  authenticate,
  rateLimiters.payment.payInvoice,
  validate({ params: PaymentValidators.invoiceIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().retryInvoice(req, res, next)
);

export default router;
