/**
 * Payment API Validation Schemas
 *
 * Zod validation schemas for all Payment API endpoints
 * Ensures type safety and input validation
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const TimeRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

// ============================================================================
// Invoice Validation
// ============================================================================

export const CreateInvoiceSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['SAT', 'BTC', 'USD']),
  description: z.string().min(1).max(1000),
  payerInfo: z
    .object({
      userId: z.string().uuid().optional(),
      email: z.string().email().optional(),
      name: z.string().max(200).optional(),
    })
    .optional(),
  metadata: z
    .object({
      contentId: z.string().uuid().optional(),
      subscriptionId: z.string().uuid().optional(),
      orderId: z.string().optional(),
      customData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    })
    .optional(),
  expiresIn: z.number().int().min(60).max(86400).optional().default(3600), // 1 hour default
  webhookUrl: z.string().url().optional(),
});

export const GetInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
});

export const PayInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  paymentMethod: z.enum(['lightning', 'onchain']).optional().default('lightning'),
  payerMetadata: z
    .object({
      userId: z.string().uuid().optional(),
      note: z.string().max(500).optional(),
    })
    .optional(),
});

// ============================================================================
// Currency Conversion Validation
// ============================================================================

export const ConvertCurrencySchema = z.object({
  amount: z.number().positive(),
  fromCurrency: z.string().length(3).toUpperCase(),
  toCurrency: z.string().length(3).toUpperCase(),
  timestamp: z.string().datetime().optional(),
});

// ============================================================================
// Subscription Validation
// ============================================================================

export const CreateSubscriptionSchema = z.object({
  creatorId: z.string().uuid(),
  subscriberId: z.string().uuid(),
  plan: z.object({
    planId: z.string().uuid(),
    tier: z.string().min(1).max(100),
    price: z.number().positive(),
    currency: z.string().length(3),
    interval: z.enum(['monthly', 'yearly']),
  }),
  paymentMethod: z.object({
    type: z.enum(['lightning', 'card']),
    details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const UpdateSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  updates: z.object({
    planId: z.string().uuid().optional(),
    status: z.enum(['active', 'paused', 'cancelled']).optional(),
    paymentMethod: z
      .object({
        type: z.string(),
        details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
      })
      .optional(),
  }),
});

export const CancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  reason: z.string().max(1000).optional(),
  cancelAt: z.enum(['immediately', 'period_end']).optional().default('period_end'),
});

// ============================================================================
// Refund Validation
// ============================================================================

export const CreateRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().positive().optional(), // Optional for partial refunds
  reason: z.string().min(1).max(1000),
  refundType: z.enum(['full', 'partial']).optional().default('full'),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// ============================================================================
// Analytics Validation
// ============================================================================

export const GetPaymentAnalyticsSchema = z.object({
  userId: z.string().uuid().optional(),
  timeRange: TimeRangeSchema.optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
  metrics: z.array(z.string()).max(20).optional(),
});

// ============================================================================
// Webhook Validation
// ============================================================================

export const RegisterWebhookSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(z.string()).min(1).max(50),
  secret: z.string().min(32).max(256).optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const UpdateWebhookSchema = z.object({
  webhookId: z.string().uuid(),
  updates: z.object({
    url: z.string().url().max(2000).optional(),
    events: z.array(z.string()).min(1).max(50).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    secret: z.string().min(32).max(256).optional(),
  }),
});

export const DeleteWebhookSchema = z.object({
  webhookId: z.string().uuid(),
});

// ============================================================================
// Transaction History Validation
// ============================================================================

export const GetTransactionHistorySchema = z.object({
  userId: z.string().uuid().optional(),
  filters: z
    .object({
      type: z.array(z.enum(['payment', 'refund', 'subscription', 'withdrawal'])).optional(),
      status: z.array(z.string()).optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      minAmount: z.number().min(0).optional(),
      maxAmount: z.number().min(0).optional(),
    })
    .optional(),
  pagination: PaginationSchema.optional(),
  sort: z.enum(['date', 'amount', 'status']).optional().default('date'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================================================
// Balance Validation
// ============================================================================

export const GetBalanceSchema = z.object({
  userId: z.string().uuid(),
});

// ============================================================================
// Parameter Validation
// ============================================================================

export const InvoiceIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const SubscriptionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const WebhookIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// Query Parameter Validation
// ============================================================================

export const PaymentQuerySchema = z.object({
  includeMetadata: z.coerce.boolean().optional().default(true),
  currency: z.string().length(3).optional(),
});

// ============================================================================
// Validation Middleware Helper
// ============================================================================

export const PaymentValidators = {
  createInvoice: CreateInvoiceSchema,
  getInvoice: GetInvoiceSchema,
  payInvoice: PayInvoiceSchema,
  convertCurrency: ConvertCurrencySchema,
  createSubscription: CreateSubscriptionSchema,
  updateSubscription: UpdateSubscriptionSchema,
  cancelSubscription: CancelSubscriptionSchema,
  createRefund: CreateRefundSchema,
  getPaymentAnalytics: GetPaymentAnalyticsSchema,
  registerWebhook: RegisterWebhookSchema,
  updateWebhook: UpdateWebhookSchema,
  deleteWebhook: DeleteWebhookSchema,
  getTransactionHistory: GetTransactionHistorySchema,
  getBalance: GetBalanceSchema,
  invoiceIdParam: InvoiceIdParamSchema,
  subscriptionIdParam: SubscriptionIdParamSchema,
  webhookIdParam: WebhookIdParamSchema,
  paymentQuery: PaymentQuerySchema,
} as const;

export type PaymentValidatorKeys = keyof typeof PaymentValidators;
