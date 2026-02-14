/**
 * Payment API Controller
 *
 * Handles HTTP requests for payment-related operations
 * Integrates with Payment Services via DI container
 */

import { Request, Response } from 'express';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../container/types';
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

@injectable()
export class PaymentController {
  constructor(
    @inject(TYPES.PaymentProcessingService) private paymentService: PaymentProcessingService,
    @inject(TYPES.InvoiceService) private invoiceService: InvoiceService,
    @inject(TYPES.CurrencyService) private currencyService: CurrencyService,
    @inject(TYPES.SubscriptionService) private subscriptionService: SubscriptionService,
    @inject(TYPES.RefundService) private refundService: RefundService,
    @inject(TYPES.PaymentAnalyticsService) private analyticsService: PaymentAnalyticsService,
    @inject(TYPES.WebhookService) private webhookService: WebhookService
  ) {}

  public createInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const invoiceData = req.body;
    const invoice = await this.invoiceService.createInvoice(invoiceData);

    res.status(201).json({ success: true, data: invoice });
  });

  public getInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const invoiceId = req.params.id;
    const invoice = await this.invoiceService.getInvoice(invoiceId);

    res.status(200).json({ success: true, data: invoice });
  });

  public payInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const invoiceId = req.params.id;
    const paymentResult = await this.paymentService.processPayment(invoiceId, req.body);

    res.status(200).json({ success: true, data: paymentResult });
  });

  public convertCurrency = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { amount, fromCurrency, toCurrency } = req.query;

    const result = await this.currencyService.convert(
      parseFloat(amount as string),
      fromCurrency as string,
      toCurrency as string
    );

    res.status(200).json({ success: true, data: result });
  });

  public createSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const subscriptionData = req.body;
    const subscription = await this.subscriptionService.createSubscription(subscriptionData);

    res.status(201).json({ success: true, data: subscription });
  });

  public updateSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const subscriptionId = req.params.id;
    const updates = req.body.updates;

    const subscription = await this.subscriptionService.updateSubscription(subscriptionId, updates);
    res.status(200).json({ success: true, data: subscription });
  });

  public cancelSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const subscriptionId = req.params.id;
    const { reason, cancelAt } = req.body;

    const result = await this.subscriptionService.cancelSubscription(subscriptionId, {
      reason,
      cancelAt,
    });
    res.status(200).json({ success: true, data: result });
  });

  public createRefund = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const refundData = req.body;
    const refund = await this.refundService.createRefund(refundData);

    res.status(201).json({ success: true, data: refund });
  });

  public getPaymentAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.query.userId as string;
    const analytics = await this.analyticsService.getAnalytics(userId, {
      startDate: req.query.start ? new Date(req.query.start as string) : undefined,
      endDate: req.query.end ? new Date(req.query.end as string) : undefined,
    });

    res.status(200).json({ success: true, data: analytics });
  });

  public registerWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const webhookData = req.body;
    const webhook = await this.webhookService.registerWebhook(webhookData);

    res.status(201).json({ success: true, data: webhook });
  });

  public getSubscriptionTiers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tier = req.query.tier as string | undefined;
    const plans = await this.subscriptionService.listPlans(tier as any);

    res.status(200).json({ success: true, data: plans });
  });

  public getSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const subscriptionId = req.params.id;
    const subscription = await this.subscriptionService.getSubscription(subscriptionId);

    res.status(200).json({ success: true, data: subscription });
  });
}
