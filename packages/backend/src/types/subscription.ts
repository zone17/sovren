/**
 * Subscription Type Definitions
 * User Story: US-E5-026 (SubscriptionService)
 * Comprehensive subscription management types for recurring billing
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { Currency } from './currency';

/**
 * Subscription status state machine
 */
export enum SubscriptionStatus {
  TRIAL = 'trial',                    // Trial period active
  ACTIVE = 'active',                  // Subscription active and paid
  PAST_DUE = 'past_due',             // Payment failed, in retry/grace period
  GRACE_PERIOD = 'grace_period',     // Grace period active after failed payment
  PAUSED = 'paused',                 // Subscription temporarily paused by user
  PENDING_CANCELLATION = 'pending_cancellation', // Cancelled but active until period end
  CANCELED = 'canceled',             // Subscription cancelled
  EXPIRED = 'expired',               // Subscription expired (after retention period)
  UPGRADING = 'upgrading',           // Upgrade in progress
  DOWNGRADING = 'downgrading'        // Downgrade in progress
}

/**
 * Subscription tier levels
 */
export enum SubscriptionTier {
  FREE = 'free',                     // Free tier
  CREATOR = 'creator',               // Creator tier ($9/mo)
  PRO = 'pro',                       // Pro tier ($29/mo)
  ENTERPRISE = 'enterprise'          // Enterprise tier (custom pricing)
}

/**
 * Billing intervals
 */
export enum BillingInterval {
  MONTHLY = 'monthly',               // Monthly billing
  YEARLY = 'yearly',                 // Yearly billing (17% discount)
  QUARTERLY = 'quarterly',           // Quarterly billing
  CUSTOM = 'custom'                  // Custom interval
}

/**
 * Subscription event types
 */
export enum SubscriptionEventType {
  CREATED = 'subscription.created',
  TRIAL_STARTED = 'subscription.trial_started',
  TRIAL_ENDING = 'subscription.trial_ending',
  TRIAL_ENDED = 'subscription.trial_ended',
  ACTIVATED = 'subscription.activated',
  RENEWED = 'subscription.renewed',
  PAYMENT_FAILED = 'subscription.payment_failed',
  GRACE_PERIOD_STARTED = 'subscription.grace_period_started',
  UPGRADED = 'subscription.upgraded',
  DOWNGRADED = 'subscription.downgraded',
  DOWNGRADE_SCHEDULED = 'subscription.downgrade_scheduled',
  PLAN_CHANGED = 'subscription.plan_changed',
  PAUSED = 'subscription.paused',
  RESUMED = 'subscription.resumed',
  CANCELED = 'subscription.canceled',
  CANCELLATION_SCHEDULED = 'subscription.cancellation_scheduled',
  EXPIRED = 'subscription.expired',
  PAYMENT_METHOD_UPDATED = 'subscription.payment_method_updated'
}

/**
 * Subscription plan definition
 */
export interface SubscriptionPlan {
  id: string;                        // Plan ID
  name: string;                      // Plan display name
  tier: SubscriptionTier;            // Plan tier
  monthlyPrice: number;              // Monthly price (in smallest unit)
  yearlyPrice: number;               // Yearly price (17% discount applied)
  currency: Currency;                // Base currency
  features: SubscriptionFeatures;    // Included features
  limits: SubscriptionLimits;        // Usage limits
  trialDays: number;                 // Trial period in days (0 for no trial)
  active: boolean;                   // Whether plan is available for new subscriptions
  metadata?: Record<string, any>;    // Additional metadata
  createdAt: Date;                   // Creation timestamp
  updatedAt: Date;                   // Last update timestamp
}

/**
 * Features included in subscription
 */
export interface SubscriptionFeatures {
  basicContent: boolean;             // Basic content creation
  advancedContent: boolean;          // Advanced content features
  analytics: boolean;                // Analytics dashboard
  aiRecommendations: boolean;        // AI-powered recommendations
  prioritySupport: boolean;          // Priority customer support
  apiAccess: boolean;                // API access
  customBranding: boolean;           // Custom branding options
  teamCollaboration: boolean;        // Team collaboration features
  advancedSecurity: boolean;         // Advanced security features
  exportData: boolean;               // Data export capabilities
  webhooks: boolean;                 // Webhook integrations
  dedicatedAccount: boolean;         // Dedicated account manager
  customFeatures?: string[];         // Custom features list
}

/**
 * Usage limits for subscription
 */
export interface SubscriptionLimits {
  maxUsers: number;                  // Maximum users allowed
  maxStorageGB: number;              // Storage limit in GB
  maxContentItems: number;           // Maximum content items
  maxMonthlyViews: number;           // Monthly view limit
  maxApiCalls: number;               // API call limit per month
  maxWebhooks: number;               // Webhook limit
}

/**
 * Subscription record
 */
export interface Subscription {
  id: string;                        // Subscription ID
  userId: string;                    // User ID
  planId: string;                    // Current plan ID
  status: SubscriptionStatus;        // Current status
  price: number;                     // Current price (in smallest currency unit)
  currency: Currency;                // Billing currency
  billingInterval: BillingInterval;  // Billing frequency

  // Trial information
  trialStartDate?: Date;             // Trial start date
  trialEndDate?: Date;               // Trial end date
  isTrialing: boolean;               // Whether in trial period

  // Billing cycle
  currentPeriodStart: Date;          // Current billing period start
  currentPeriodEnd: Date;            // Current billing period end
  nextBillingDate: Date;             // Next billing date

  // Cancellation
  canceledAt?: Date;                 // Cancellation timestamp
  cancelAtPeriodEnd: boolean;        // Whether to cancel at period end
  endedAt?: Date;                    // Subscription end timestamp

  // Renewal settings
  autoRenew: boolean;                // Auto-renewal enabled
  gracePeriodDays: number;           // Grace period for failed payments
  retryCount: number;                // Current retry count for failed payments
  maxRetries: number;                // Maximum retry attempts

  // Proration and credits
  creditBalance: number;             // Credit balance (for downgrades)
  pendingPlanChange?: string;        // Pending plan change ID
  pendingPlanChangeDate?: Date;      // When pending change takes effect

  // Payment information
  lastPaymentId?: string;            // Last successful payment transaction ID
  lastPaymentDate?: Date;            // Last payment date
  nextRetryDate?: Date;              // Next payment retry date

  // Usage tracking
  usageThisMonth?: SubscriptionUsage; // Current month usage

  // Metadata
  metadata?: Record<string, any>;    // Additional metadata
  createdAt: Date;                   // Creation timestamp
  updatedAt: Date;                   // Last update timestamp
}

/**
 * Subscription usage tracking
 */
export interface SubscriptionUsage {
  subscriptionId: string;            // Subscription ID
  periodStart: Date;                 // Usage period start
  periodEnd: Date;                   // Usage period end
  metrics: {
    [key: string]: UsageMetric;      // Usage metrics by name
  };
  totalCost: number;                 // Total usage-based cost
  currency: Currency;                // Currency
}

/**
 * Individual usage metric
 */
export interface UsageMetric {
  name: string;                      // Metric name (e.g., 'api_calls', 'storage_gb')
  quantity: number;                  // Quantity used
  unit: string;                      // Unit of measurement
  unitPrice: number;                 // Price per unit
  totalCost: number;                 // Total cost for this metric
  limit?: number;                    // Usage limit (if applicable)
  limitExceeded: boolean;            // Whether limit was exceeded
}

/**
 * Subscription invoice
 */
export interface SubscriptionInvoice {
  id: string;                        // Invoice ID
  subscriptionId: string;            // Subscription ID
  paymentTransactionId?: string;     // Associated payment transaction ID
  invoiceType: InvoiceType;          // Type of invoice
  amount: number;                    // Subtotal amount
  currency: Currency;                // Currency
  taxAmount: number;                 // Tax amount
  discountAmount: number;            // Discount amount
  totalAmount: number;               // Total amount due
  status: InvoiceStatus;             // Invoice status
  dueDate: Date;                     // Payment due date
  paidAt?: Date;                     // Payment timestamp
  lineItems: InvoiceLineItem[];      // Invoice line items
  metadata?: Record<string, any>;    // Additional metadata
  createdAt: Date;                   // Creation timestamp
}

/**
 * Invoice types
 */
export enum InvoiceType {
  INITIAL = 'initial',               // Initial subscription invoice
  RENEWAL = 'renewal',               // Recurring renewal invoice
  UPGRADE = 'upgrade',               // Upgrade invoice
  DOWNGRADE = 'downgrade',           // Downgrade invoice (credit)
  PRORATION = 'proration',           // Proration adjustment
  USAGE = 'usage',                   // Usage-based charges
  ADDON = 'addon'                    // Add-on purchase
}

/**
 * Invoice status
 */
export enum InvoiceStatus {
  DRAFT = 'draft',                   // Invoice draft
  PENDING = 'pending',               // Payment pending
  PAID = 'paid',                     // Invoice paid
  FAILED = 'failed',                 // Payment failed
  VOID = 'void'                      // Invoice voided
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  description: string;               // Line item description
  quantity: number;                  // Quantity
  unitPrice: number;                 // Unit price
  amount: number;                    // Line item amount
  period?: {                         // Billing period (if applicable)
    start: Date;
    end: Date;
  };
  metadata?: Record<string, any>;    // Additional metadata
}

/**
 * Subscription event record
 */
export interface SubscriptionEvent {
  id: string;                        // Event ID
  subscriptionId: string;            // Subscription ID
  eventType: SubscriptionEventType;  // Event type
  previousStatus?: SubscriptionStatus; // Previous status
  newStatus?: SubscriptionStatus;    // New status
  previousPlanId?: string;           // Previous plan ID
  newPlanId?: string;                // New plan ID
  metadata?: Record<string, any>;    // Event metadata
  occurredAt: Date;                  // Event timestamp
}

/**
 * Subscription analytics metrics
 */
export interface SubscriptionAnalytics {
  periodDate: Date;                  // Analytics period date
  periodType: 'day' | 'week' | 'month' | 'year'; // Period granularity

  // Subscription counts
  activeSubscriptions: number;       // Total active subscriptions
  newSubscriptions: number;          // New subscriptions this period
  canceledSubscriptions: number;     // Canceled this period
  churnedSubscriptions: number;      // Churned (expired) this period
  trialingSubscriptions: number;     // Subscriptions in trial

  // Revenue metrics
  mrr: number;                       // Monthly Recurring Revenue
  arr: number;                       // Annual Recurring Revenue
  newMrr: number;                    // New MRR this period
  expansionMrr: number;              // MRR from upgrades
  contractionMrr: number;            // MRR from downgrades
  churnedMrr: number;                // MRR lost to churn

  // Financial metrics
  totalRevenue: number;              // Total revenue this period
  averageRevenuePerUser: number;     // ARPU
  averageLifetimeValue: number;      // Average LTV

  // Conversion metrics
  trialConversionRate: number;       // Trial to paid conversion %
  churnRate: number;                 // Churn rate %
  retentionRate: number;             // Retention rate %

  // Tier breakdown
  tierBreakdown: {
    [key in SubscriptionTier]: {
      count: number;
      mrr: number;
      percentage: number;
    };
  };

  calculatedAt: Date;                // Calculation timestamp
}

/**
 * Proration calculation result
 */
export interface ProrationResult {
  currentPlan: SubscriptionPlan;     // Current plan
  newPlan: SubscriptionPlan;         // New plan
  daysRemaining: number;             // Days remaining in current period
  unusedCredit: number;              // Credit from current plan
  newPlanCost: number;               // Cost for new plan (prorated)
  amountDue: number;                 // Net amount due (can be negative)
  isUpgrade: boolean;                // Whether this is an upgrade
  effectiveDate: Date;               // When change takes effect
}

/**
 * Subscription create parameters
 */
export interface CreateSubscriptionParams {
  userId: string;                    // User ID
  planId: string;                    // Plan ID
  billingInterval: BillingInterval;  // Billing frequency
  currency?: Currency;               // Preferred currency (defaults to plan currency)
  paymentMethodId?: string;          // Payment method ID
  trialDays?: number;                // Override default trial period
  metadata?: Record<string, any>;    // Additional metadata
  idempotencyKey?: string;           // Idempotency key
}

/**
 * Subscription update parameters
 */
export interface UpdateSubscriptionParams {
  autoRenew?: boolean;               // Update auto-renewal
  paymentMethodId?: string;          // Update payment method
  metadata?: Record<string, any>;    // Update metadata
}

/**
 * Subscription query parameters
 */
export interface SubscriptionQuery {
  userId?: string;                   // Filter by user
  status?: SubscriptionStatus;       // Filter by status
  planId?: string;                   // Filter by plan
  tier?: SubscriptionTier;           // Filter by tier
  startDate?: Date;                  // Filter by creation date (from)
  endDate?: Date;                    // Filter by creation date (to)
  limit?: number;                    // Result limit
  offset?: number;                   // Result offset
  sortBy?: 'createdAt' | 'updatedAt' | 'nextBillingDate'; // Sort field
  sortOrder?: 'asc' | 'desc';        // Sort order
}

/**
 * Subscription webhook event
 */
export interface SubscriptionWebhookEvent {
  id: string;                        // Event ID
  type: SubscriptionEventType;       // Event type
  subscription: Subscription;        // Subscription snapshot
  previousAttributes?: Partial<Subscription>; // Changed attributes
  timestamp: Date;                   // Event timestamp
}

/**
 * Subscription cancellation options
 */
export interface CancelSubscriptionOptions {
  immediate: boolean;                // Cancel immediately or at period end
  reason?: string;                   // Cancellation reason
  feedback?: string;                 // User feedback
  refund?: boolean;                  // Whether to issue prorated refund
}

/**
 * Subscription pause options
 */
export interface PauseSubscriptionOptions {
  resumeAt?: Date;                   // Scheduled resume date (optional)
  pauseReason?: string;              // Reason for pausing
}

/**
 * Subscription statistics
 */
export interface SubscriptionStatistics {
  totalSubscriptions: number;        // Total subscription count
  activeSubscriptions: number;       // Active subscriptions
  trialingSubscriptions: number;     // Subscriptions in trial
  churnedThisMonth: number;          // Churned this month
  mrr: number;                       // Current MRR
  arr: number;                       // Current ARR
  averageLTV: number;                // Average customer LTV
  churnRate: number;                 // Current churn rate
  retentionRate: number;             // Current retention rate
}

/**
 * Subscription renewal result
 */
export interface RenewalResult {
  subscriptionId: string;            // Subscription ID
  success: boolean;                  // Whether renewal succeeded
  invoiceId?: string;                // Created invoice ID
  paymentTransactionId?: string;     // Payment transaction ID
  error?: string;                    // Error message if failed
  nextBillingDate: Date;             // Next billing date
  retryScheduled?: Date;             // Retry date if failed
}

/**
 * Bulk renewal result
 */
export interface BulkRenewalResult {
  totalProcessed: number;            // Total subscriptions processed
  successful: number;                // Successful renewals
  failed: number;                    // Failed renewals
  results: RenewalResult[];          // Individual results
  errors: Array<{
    subscriptionId: string;
    error: string;
  }>;
}

/**
 * Subscription export data
 */
export interface SubscriptionExport {
  subscriptions: Subscription[];     // Subscription data
  plans: SubscriptionPlan[];         // Associated plans
  invoices: SubscriptionInvoice[];   // Associated invoices
  analytics: SubscriptionAnalytics;  // Analytics summary
  exportDate: Date;                  // Export timestamp
  format: 'json' | 'csv';            // Export format
}
