/**
 * Payment type definitions for React Query hooks
 */

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'expired' | 'refunded';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due';
export type PaymentMethod = 'lightning' | 'onchain' | 'card';

export interface Invoice {
  id: string;
  creatorId: string;
  userId?: string;
  amount: number; // in sats
  description: string;
  paymentRequest: string; // BOLT11 invoice
  paymentHash: string;
  preimage?: string;
  status: PaymentStatus;
  method: PaymentMethod;
  contentId?: string; // For content purchases
  subscriptionId?: string; // For subscription payments
  expiresAt: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  creatorId: string;
  creatorName: string;
  creatorPicture?: string;
  tier: 'basic' | 'premium' | 'vip';
  price: number; // in sats per interval
  interval: 'monthly' | 'yearly';
  status: SubscriptionStatus;
  benefits: string[];
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  cancelReason?: string;
  autoRenew: boolean;
  paymentMethod?: PaymentMethod;
  lastPaymentId?: string;
  nextBillingDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentFilters {
  userId?: string;
  creatorId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  contentId?: string;
  subscriptionId?: string;
  sortBy?: 'date' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SubscriptionFilters {
  userId?: string;
  creatorId?: string;
  status?: SubscriptionStatus;
  tier?: 'basic' | 'premium' | 'vip';
  autoRenew?: boolean;
  sortBy?: 'date' | 'price' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    totalAmount: number;
    completedAmount: number;
    pendingAmount: number;
    failedAmount: number;
  };
}

export interface SubscriptionsResponse {
  subscriptions: Subscription[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    activeCount: number;
    totalRevenue: number;
    churnRate: number;
  };
}

export interface CreatePaymentInput {
  amount: number; // in sats
  description: string;
  creatorId?: string;
  contentId?: string;
  subscriptionId?: string;
  method?: PaymentMethod;
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionInput {
  tier?: 'basic' | 'premium' | 'vip';
  autoRenew?: boolean;
  paymentMethod?: PaymentMethod;
}

export interface PaymentStatusUpdate {
  status: PaymentStatus;
  preimage?: string;
  paidAt?: string;
  failureReason?: string;
}
