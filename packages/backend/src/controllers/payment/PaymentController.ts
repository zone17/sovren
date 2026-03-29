/**
 * Payment API Controller
 *
 * Handles HTTP requests for payment-related operations
 * Integrates with Payment Services via DI container
 */

import { Request, Response } from 'express';
import {
  PaymentProcessingService,
  InvoiceService,
  CurrencyService,
  SubscriptionService,
  RefundService,
  PaymentAnalyticsService,
  WebhookService,
} from '../../services/payment';
import { asyncHandler } from '../../middleware/error-handler-middleware';
import { createApiResponse } from '../../utils/api-response';
import { businessMetrics } from '../../middleware/deployment-monitoring';
import { Currency } from '../../types/currency';
import { AnalyticsPeriod } from '../../types/payment-analytics';
import { SubscriptionTier } from '../../types/subscription';

export class PaymentController {
  constructor(
    private paymentService: PaymentProcessingService,
    private invoiceService: InvoiceService,
    private currencyService: CurrencyService,
    private subscriptionService: SubscriptionService,
    private refundService: RefundService,
    private analyticsService: PaymentAnalyticsService,
    private webhookService: WebhookService
  ) {}

  public createInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const invoiceData = req.body;
    const invoice = await this.invoiceService.create(invoiceData);

    res.status(201).json(createApiResponse(req, invoice, startTime));
  });

  public getInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const invoiceId = req.params.id;
    const invoice = await this.invoiceService.getInvoice(invoiceId);

    // Ownership check: only the invoice owner or admin can view it.
    // invoice.userId may be a UUID or nostr pubkey depending on how it was created,
    // so check against both req.user.id (UUID) and req.user.nostr_pubkey (hex).
    if (invoice && req.user?.role !== 'admin') {
      const ownsInvoice =
        invoice.userId === req.user?.nostr_pubkey ||
        (req.user?.id && invoice.userId === req.user.id);
      if (!ownsInvoice) {
        res
          .status(403)
          .json({ success: false, error: 'Forbidden: you can only access your own invoices' });
        return;
      }
    }

    res.status(200).json(createApiResponse(req, invoice, startTime));
  });

  public payInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const invoiceId = req.params.id;
    try {
      const paymentResult = await this.paymentService.processPayment({
        invoiceId,
        ...req.body,
      });
      businessMetrics.paymentsTotal.inc({ status: 'success' });
      res.status(200).json(createApiResponse(req, paymentResult, startTime));
    } catch (err) {
      businessMetrics.paymentsTotal.inc({ status: 'failure' });
      throw err;
    }
  });

  public convertCurrency = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const { amount, fromCurrency, toCurrency } = req.query;

    const result = await this.currencyService.convert({
      amount: parseFloat(amount as string),
      from: fromCurrency as Currency,
      to: toCurrency as Currency,
    });

    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public createSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const subscriptionData = req.body;
    const subscription = await this.subscriptionService.createSubscription(subscriptionData);

    res.status(201).json(createApiResponse(req, subscription, startTime));
  });

  public updateSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const subscriptionId = req.params.id;
    const updates = req.body.updates;

    // Ownership check: only the subscription owner or admin can update it
    const existing = await this.subscriptionService.getSubscription(subscriptionId);
    if (existing && req.user?.role !== 'admin') {
      const ownsSubscription =
        existing.userId === req.user?.nostr_pubkey ||
        (req.user?.id && existing.userId === req.user.id);
      if (!ownsSubscription) {
        res
          .status(403)
          .json({ success: false, error: 'Forbidden: you can only update your own subscriptions' });
        return;
      }
    }

    const subscription = await this.subscriptionService.updateSubscription(subscriptionId, updates);
    res.status(200).json(createApiResponse(req, subscription, startTime));
  });

  public cancelSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const subscriptionId = req.params.id;
    const { reason, cancelAt } = req.body;

    // Ownership check: only the subscription owner or admin can cancel it
    const existing = await this.subscriptionService.getSubscription(subscriptionId);
    if (existing && req.user?.role !== 'admin') {
      const ownsSubscription =
        existing.userId === req.user?.nostr_pubkey ||
        (req.user?.id && existing.userId === req.user.id);
      if (!ownsSubscription) {
        res
          .status(403)
          .json({ success: false, error: 'Forbidden: you can only cancel your own subscriptions' });
        return;
      }
    }

    const result = await this.subscriptionService.cancelSubscription(subscriptionId, {
      immediate: cancelAt === 'now',
      reason,
    });
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public createRefund = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const refundData = req.body;
    const refund = await this.refundService.createRefund(refundData);

    res.status(201).json(createApiResponse(req, refund, startTime));
  });

  public getPaymentAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    // Always use authenticated user's pubkey — never accept userId from query params
    const userId = req.user?.nostr_pubkey;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    const analytics = await this.analyticsService.getAnalyticsSummary({
      period: (req.query.period as AnalyticsPeriod) || AnalyticsPeriod.MONTHLY,
      userId,
      startDate: req.query.start ? new Date(req.query.start as string) : undefined,
      endDate: req.query.end ? new Date(req.query.end as string) : undefined,
    });

    res.status(200).json(createApiResponse(req, analytics, startTime));
  });

  public registerWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const webhookData = req.body;
    const webhook = await this.webhookService.registerEndpoint(webhookData);

    res.status(201).json(createApiResponse(req, webhook, startTime));
  });

  public getSubscriptionTiers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tier = req.query.tier as string | undefined;
    const plans = await this.subscriptionService.listPlans(tier as SubscriptionTier | undefined);

    res.status(200).json(createApiResponse(req, plans, startTime));
  });

  public getSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const subscriptionId = req.params.id;
    const subscription = await this.subscriptionService.getSubscription(subscriptionId);

    // Ownership check: only the subscription owner or admin can view their subscription
    if (subscription && req.user?.role !== 'admin') {
      const ownsSubscription =
        subscription.userId === req.user?.nostr_pubkey ||
        (req.user?.id && subscription.userId === req.user.id);
      if (!ownsSubscription) {
        res
          .status(403)
          .json({ success: false, error: 'Forbidden: you can only access your own subscriptions' });
        return;
      }
    }

    res.status(200).json(createApiResponse(req, subscription, startTime));
  });

  // === Payment API Expansion (Todo 120) ===

  public getTransactionHistory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const startTime = Date.now();
      // Always use authenticated user's pubkey — never accept userId from query params
      const userId = req.user?.nostr_pubkey;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }
      const result = await this.analyticsService.getAnalyticsSummary({
        period: (req.query.period as AnalyticsPeriod) || AnalyticsPeriod.MONTHLY,
        userId,
        startDate: req.query.start ? new Date(req.query.start as string) : undefined,
        endDate: req.query.end ? new Date(req.query.end as string) : undefined,
      });

      res.status(200).json(createApiResponse(req, result, startTime));
    }
  );

  public getBalance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    // Always use authenticated user's pubkey — never accept userId from query params
    const userId = req.user?.nostr_pubkey;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    const analytics = await this.analyticsService.getAnalyticsSummary({
      period: AnalyticsPeriod.ALL_TIME,
      userId,
    });

    res.status(200).json(createApiResponse(req, { userId, balance: analytics }, startTime));
  });

  public updateWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const webhookId = req.params.id;
    const updates = req.body;

    // Ownership check: only the webhook owner or admin can update it
    const existing = await this.webhookService.getEndpoint(webhookId);
    if (existing && req.user?.role !== 'admin') {
      const ownsWebhook =
        existing.userId === req.user?.nostr_pubkey ||
        (req.user?.id && existing.userId === req.user.id);
      if (!ownsWebhook) {
        res
          .status(403)
          .json({ success: false, error: 'Forbidden: you can only update your own webhooks' });
        return;
      }
    }

    const webhook = await this.webhookService.updateEndpoint(webhookId, updates);
    res.status(200).json(createApiResponse(req, webhook, startTime));
  });

  public deleteWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const webhookId = req.params.id;

    // Ownership check: only the webhook owner or admin can delete it
    const existing = await this.webhookService.getEndpoint(webhookId);
    if (existing && req.user?.role !== 'admin') {
      const ownsWebhook =
        existing.userId === req.user?.nostr_pubkey ||
        (req.user?.id && existing.userId === req.user.id);
      if (!ownsWebhook) {
        res
          .status(403)
          .json({ success: false, error: 'Forbidden: you can only delete your own webhooks' });
        return;
      }
    }

    await this.webhookService.deleteEndpoint(webhookId);
    res.status(204).send();
  });

  public listInvoices = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.user?.nostr_pubkey || '';
    const invoices = await this.invoiceService.getInvoicesByCustomer(userId);

    res.status(200).json(createApiResponse(req, invoices, startTime));
  });

  public retryInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const invoiceId = req.params.id;

    // Verify the invoice belongs to the authenticated user before retrying
    const invoice = await this.invoiceService.getInvoice(invoiceId);
    if (invoice && req.user?.role !== 'admin') {
      const ownsInvoice =
        invoice.userId === req.user?.nostr_pubkey ||
        (req.user?.id && invoice.userId === req.user.id);
      if (!ownsInvoice) {
        res
          .status(403)
          .json({ success: false, error: 'Forbidden: you can only retry your own invoices' });
        return;
      }
    }

    const result = await this.paymentService.processPayment({ invoiceId });

    res.status(200).json(createApiResponse(req, result, startTime));
  });
}
