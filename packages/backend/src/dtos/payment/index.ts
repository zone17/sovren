/**
 * Payment API Data Transfer Objects
 *
 * Defines request and response schemas for Payment API endpoints
 * Used for type safety and validation in controllers
 */

// ============================================================================
// Invoice DTOs
// ============================================================================

export interface CreateInvoiceRequestDTO {
  amount: number;
  currency: 'SAT' | 'BTC' | 'USD';
  description: string;
  payerInfo?: {
    userId?: string;
    email?: string;
    name?: string;
  };
  metadata?: {
    contentId?: string;
    subscriptionId?: string;
    orderId?: string;
    customData?: Record<string, any>;
  };
  expiresIn?: number; // seconds
  webhookUrl?: string;
}

export interface InvoiceResponseDTO {
  invoiceId: string;
  paymentRequest: string; // BOLT11 invoice
  amount: {
    requested: number;
    currency: string;
    sats: number;
  };
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  description: string;
  createdAt: string;
  expiresAt: string;
  paymentHash: string;
  metadata?: Record<string, any>;
}

export interface GetInvoiceRequestDTO {
  invoiceId: string;
}

export interface PayInvoiceRequestDTO {
  invoiceId: string;
  paymentMethod?: 'lightning' | 'onchain';
  payerMetadata?: {
    userId?: string;
    note?: string;
  };
}

export interface PayInvoiceResponseDTO {
  invoiceId: string;
  paymentId: string;
  status: 'success' | 'pending' | 'failed';
  paidAt?: string;
  amount: {
    paid: number;
    currency: string;
  };
  fees?: {
    network: number;
    platform: number;
  };
  receipt: {
    receiptId: string;
    url: string;
  };
}

// ============================================================================
// Currency Conversion DTOs
// ============================================================================

export interface ConvertCurrencyRequestDTO {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  timestamp?: string; // For historical rates
}

export interface ConvertCurrencyResponseDTO {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  exchangeRate: number;
  timestamp: string;
  source: string;
  expiresAt?: string;
}

// ============================================================================
// Subscription DTOs
// ============================================================================

export interface CreateSubscriptionRequestDTO {
  creatorId: string;
  subscriberId: string;
  plan: {
    planId: string;
    tier: string;
    price: number;
    currency: string;
    interval: 'monthly' | 'yearly';
  };
  paymentMethod: {
    type: 'lightning' | 'card';
    details?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

export interface SubscriptionResponseDTO {
  subscriptionId: string;
  creatorId: string;
  subscriberId: string;
  plan: {
    planId: string;
    tier: string;
    price: number;
    currency: string;
    interval: string;
  };
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  currentPeriod: {
    start: string;
    end: string;
  };
  nextBillingDate?: string;
  createdAt: string;
  cancelledAt?: string;
}

export interface UpdateSubscriptionRequestDTO {
  subscriptionId: string;
  updates: {
    planId?: string;
    status?: 'active' | 'paused' | 'cancelled';
    paymentMethod?: {
      type: string;
      details?: Record<string, any>;
    };
  };
}

export interface CancelSubscriptionRequestDTO {
  subscriptionId: string;
  reason?: string;
  cancelAt?: 'immediately' | 'period_end';
}

export interface CancelSubscriptionResponseDTO {
  subscriptionId: string;
  status: string;
  cancelledAt: string;
  effectiveDate: string;
  refundAmount?: number;
  refundStatus?: string;
}

// ============================================================================
// Refund DTOs
// ============================================================================

export interface CreateRefundRequestDTO {
  paymentId: string;
  amount?: number; // Partial refund amount
  reason: string;
  refundType?: 'full' | 'partial';
  metadata?: Record<string, any>;
}

export interface RefundResponseDTO {
  refundId: string;
  paymentId: string;
  invoiceId: string;
  amount: {
    requested: number;
    processed: number;
    currency: string;
  };
  status: 'pending' | 'completed' | 'failed';
  reason: string;
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
}

// ============================================================================
// Payment Analytics DTOs
// ============================================================================

export interface GetPaymentAnalyticsRequestDTO {
  userId?: string;
  timeRange?: {
    start: string;
    end: string;
  };
  groupBy?: 'day' | 'week' | 'month';
  metrics?: string[];
}

export interface PaymentAnalyticsResponseDTO {
  timeRange: {
    start: string;
    end: string;
  };
  overview: {
    totalRevenue: {
      sats: number;
      usd: number;
    };
    totalTransactions: number;
    successRate: number;
    averageTransactionValue: number;
    totalFees: number;
  };
  transactions: {
    successful: number;
    failed: number;
    pending: number;
    refunded: number;
  };
  revenue: Array<{
    date: string;
    amount: number;
    currency: string;
    count: number;
  }>;
  paymentMethods: Record<
    string,
    {
      count: number;
      amount: number;
    }
  >;
  topProducts: Array<{
    productId: string;
    name: string;
    revenue: number;
    transactions: number;
  }>;
  subscriptions: {
    active: number;
    new: number;
    cancelled: number;
    churnRate: number;
    mrr: number; // Monthly Recurring Revenue
  };
  refunds: {
    total: number;
    amount: number;
    refundRate: number;
  };
}

// ============================================================================
// Webhook DTOs
// ============================================================================

export interface RegisterWebhookRequestDTO {
  url: string;
  events: string[]; // e.g., ['payment.completed', 'subscription.created']
  secret?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface WebhookResponseDTO {
  webhookId: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'failed';
  secret: string;
  createdAt: string;
  lastTriggeredAt?: string;
  deliveryStats: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface UpdateWebhookRequestDTO {
  webhookId: string;
  updates: {
    url?: string;
    events?: string[];
    status?: 'active' | 'inactive';
    secret?: string;
  };
}

export interface DeleteWebhookRequestDTO {
  webhookId: string;
}

export interface WebhookEventDTO {
  eventId: string;
  eventType: string;
  timestamp: string;
  data: Record<string, any>;
  retryCount: number;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
}

// ============================================================================
// Transaction History DTOs
// ============================================================================

export interface GetTransactionHistoryRequestDTO {
  userId?: string;
  filters?: {
    type?: ('payment' | 'refund' | 'subscription' | 'withdrawal')[];
    status?: string[];
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
  };
  pagination?: {
    page: number;
    limit: number;
  };
  sort?: 'date' | 'amount' | 'status';
  order?: 'asc' | 'desc';
}

export interface TransactionDTO {
  transactionId: string;
  type: string;
  status: string;
  amount: {
    value: number;
    currency: string;
  };
  description: string;
  createdAt: string;
  completedAt?: string;
  relatedId?: string; // invoiceId, subscriptionId, etc.
  metadata?: Record<string, any>;
}

export interface GetTransactionHistoryResponseDTO {
  transactions: TransactionDTO[];
  totalTransactions: number;
  currentPage: number;
  totalPages: number;
  summary: {
    totalAmount: number;
    avgAmount: number;
    successfulCount: number;
    failedCount: number;
  };
}

// ============================================================================
// Balance DTOs
// ============================================================================

export interface GetBalanceRequestDTO {
  userId: string;
}

export interface BalanceResponseDTO {
  userId: string;
  balance: {
    available: number;
    pending: number;
    currency: string;
  };
  conversionRates: Record<string, number>;
  lastUpdated: string;
}

// ============================================================================
// Common Response Wrapper
// ============================================================================

export interface PaymentApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    processingTime: number;
  };
}
