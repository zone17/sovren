/**
 * SubscriptionService Interface
 * User Story: US-E5-026
 * Comprehensive subscription management interface with recurring billing
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionInvoice,
  SubscriptionEvent,
  SubscriptionAnalytics,
  SubscriptionStatistics,
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  SubscriptionQuery,
  ProrationResult,
  RenewalResult,
  BulkRenewalResult,
  CancelSubscriptionOptions,
  PauseSubscriptionOptions,
  SubscriptionWebhookEvent,
  SubscriptionEventType,
  SubscriptionStatus,
  BillingInterval,
  SubscriptionTier,
  SubscriptionUsage
} from '../../types/subscription';
import type { Currency } from '../../types/currency';

/**
 * Subscription service interface
 * Handles subscription lifecycle, billing, upgrades/downgrades, and analytics
 */
export interface ISubscriptionService {
  /**
   * SUBSCRIPTION MANAGEMENT
   */

  /**
   * Create a new subscription
   * @param params - Subscription creation parameters
   * @returns Created subscription
   * @throws Error if subscription creation fails
   */
  createSubscription(params: CreateSubscriptionParams): Promise<Subscription>;

  /**
   * Get subscription by ID
   * @param subscriptionId - Subscription ID
   * @returns Subscription or null if not found
   */
  getSubscription(subscriptionId: string): Promise<Subscription | null>;

  /**
   * Get active subscription for user
   * @param userId - User ID
   * @returns Active subscription or null
   */
  getUserSubscription(userId: string): Promise<Subscription | null>;

  /**
   * Query subscriptions
   * @param query - Query parameters
   * @returns List of subscriptions
   */
  querySubscriptions(query: SubscriptionQuery): Promise<Subscription[]>;

  /**
   * Count subscriptions matching query
   * @param query - Query parameters
   * @returns Count of matching subscriptions
   */
  countSubscriptions(query: SubscriptionQuery): Promise<number>;

  /**
   * Update subscription
   * @param subscriptionId - Subscription ID
   * @param params - Update parameters
   * @returns Updated subscription
   */
  updateSubscription(
    subscriptionId: string,
    params: UpdateSubscriptionParams
  ): Promise<Subscription>;

  /**
   * PLAN MANAGEMENT
   */

  /**
   * Create subscription plan
   * @param plan - Plan details
   * @returns Created plan
   */
  createPlan(plan: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan>;

  /**
   * Get plan by ID
   * @param planId - Plan ID
   * @returns Plan or null if not found
   */
  getPlan(planId: string): Promise<SubscriptionPlan | null>;

  /**
   * List all active plans
   * @param tier - Optional tier filter
   * @returns List of active plans
   */
  listPlans(tier?: SubscriptionTier): Promise<SubscriptionPlan[]>;

  /**
   * Update plan
   * @param planId - Plan ID
   * @param updates - Plan updates
   * @returns Updated plan
   */
  updatePlan(
    planId: string,
    updates: Partial<Omit<SubscriptionPlan, 'id' | 'createdAt'>>
  ): Promise<SubscriptionPlan>;

  /**
   * Deactivate plan (soft delete)
   * @param planId - Plan ID
   */
  deactivatePlan(planId: string): Promise<void>;

  /**
   * SUBSCRIPTION LIFECYCLE
   */

  /**
   * Cancel subscription
   * @param subscriptionId - Subscription ID
   * @param options - Cancellation options
   * @returns Updated subscription
   */
  cancelSubscription(
    subscriptionId: string,
    options: CancelSubscriptionOptions
  ): Promise<Subscription>;

  /**
   * Undo pending cancellation
   * @param subscriptionId - Subscription ID
   * @returns Updated subscription
   */
  undoCancellation(subscriptionId: string): Promise<Subscription>;

  /**
   * Pause subscription
   * @param subscriptionId - Subscription ID
   * @param options - Pause options
   * @returns Updated subscription
   */
  pauseSubscription(
    subscriptionId: string,
    options?: PauseSubscriptionOptions
  ): Promise<Subscription>;

  /**
   * Resume paused subscription
   * @param subscriptionId - Subscription ID
   * @returns Updated subscription
   */
  resumeSubscription(subscriptionId: string): Promise<Subscription>;

  /**
   * Expire subscription (move to expired status)
   * @param subscriptionId - Subscription ID
   */
  expireSubscription(subscriptionId: string): Promise<void>;

  /**
   * TRIAL MANAGEMENT
   */

  /**
   * Start trial period
   * @param subscriptionId - Subscription ID
   * @param trialDays - Trial duration in days
   * @returns Updated subscription
   */
  startTrial(subscriptionId: string, trialDays: number): Promise<Subscription>;

  /**
   * End trial and convert to paid
   * @param subscriptionId - Subscription ID
   * @param immediate - End immediately or at trial end date
   * @returns Updated subscription
   */
  endTrial(subscriptionId: string, immediate: boolean): Promise<Subscription>;

  /**
   * Check if subscription is in trial
   * @param subscriptionId - Subscription ID
   * @returns Whether subscription is trialing
   */
  isTrialing(subscriptionId: string): Promise<boolean>;

  /**
   * Get trials ending soon
   * @param daysAhead - Number of days to look ahead
   * @returns Subscriptions with trials ending
   */
  getTrialsEndingSoon(daysAhead: number): Promise<Subscription[]>;

  /**
   * UPGRADE & DOWNGRADE
   */

  /**
   * Upgrade subscription to higher tier
   * @param subscriptionId - Subscription ID
   * @param newPlanId - New plan ID
   * @returns Updated subscription with proration
   */
  upgradeSubscription(subscriptionId: string, newPlanId: string): Promise<{
    subscription: Subscription;
    proration: ProrationResult;
    invoice?: SubscriptionInvoice;
  }>;

  /**
   * Downgrade subscription to lower tier
   * @param subscriptionId - Subscription ID
   * @param newPlanId - New plan ID
   * @param immediate - Apply immediately or at period end
   * @returns Updated subscription with proration
   */
  downgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
    immediate: boolean
  ): Promise<{
    subscription: Subscription;
    proration: ProrationResult;
  }>;

  /**
   * Calculate proration for plan change
   * @param subscriptionId - Subscription ID
   * @param newPlanId - New plan ID
   * @returns Proration calculation
   */
  calculateProration(
    subscriptionId: string,
    newPlanId: string
  ): Promise<ProrationResult>;

  /**
   * Apply pending plan change
   * @param subscriptionId - Subscription ID
   * @returns Updated subscription
   */
  applyPendingPlanChange(subscriptionId: string): Promise<Subscription>;

  /**
   * RENEWAL & BILLING
   */

  /**
   * Process subscription renewal
   * @param subscriptionId - Subscription ID
   * @returns Renewal result
   */
  renewSubscription(subscriptionId: string): Promise<RenewalResult>;

  /**
   * Process renewals for all due subscriptions
   * @param dueDate - Optional due date (defaults to today)
   * @returns Bulk renewal results
   */
  processDueRenewals(dueDate?: Date): Promise<BulkRenewalResult>;

  /**
   * Retry failed payment
   * @param subscriptionId - Subscription ID
   * @returns Renewal result
   */
  retryFailedPayment(subscriptionId: string): Promise<RenewalResult>;

  /**
   * Update payment method
   * @param subscriptionId - Subscription ID
   * @param paymentMethodId - New payment method ID
   * @returns Updated subscription
   */
  updatePaymentMethod(
    subscriptionId: string,
    paymentMethodId: string
  ): Promise<Subscription>;

  /**
   * Get next billing date
   * @param subscriptionId - Subscription ID
   * @returns Next billing date
   */
  getNextBillingDate(subscriptionId: string): Promise<Date>;

  /**
   * Update billing interval
   * @param subscriptionId - Subscription ID
   * @param interval - New billing interval
   * @returns Updated subscription
   */
  updateBillingInterval(
    subscriptionId: string,
    interval: BillingInterval
  ): Promise<Subscription>;

  /**
   * INVOICING
   */

  /**
   * Create invoice for subscription
   * @param subscriptionId - Subscription ID
   * @param invoiceType - Type of invoice
   * @returns Created invoice
   */
  createInvoice(
    subscriptionId: string,
    invoiceType: string
  ): Promise<SubscriptionInvoice>;

  /**
   * Get invoices for subscription
   * @param subscriptionId - Subscription ID
   * @param limit - Result limit
   * @returns List of invoices
   */
  getSubscriptionInvoices(
    subscriptionId: string,
    limit?: number
  ): Promise<SubscriptionInvoice[]>;

  /**
   * Get invoice by ID
   * @param invoiceId - Invoice ID
   * @returns Invoice or null if not found
   */
  getInvoice(invoiceId: string): Promise<SubscriptionInvoice | null>;

  /**
   * Mark invoice as paid
   * @param invoiceId - Invoice ID
   * @param paymentTransactionId - Payment transaction ID
   */
  markInvoicePaid(invoiceId: string, paymentTransactionId: string): Promise<void>;

  /**
   * USAGE-BASED BILLING
   */

  /**
   * Record usage metric
   * @param subscriptionId - Subscription ID
   * @param metricName - Metric name (e.g., 'api_calls')
   * @param quantity - Quantity used
   * @param timestamp - Usage timestamp (optional, defaults to now)
   */
  recordUsage(
    subscriptionId: string,
    metricName: string,
    quantity: number,
    timestamp?: Date
  ): Promise<void>;

  /**
   * Get usage for current period
   * @param subscriptionId - Subscription ID
   * @returns Current usage data
   */
  getCurrentUsage(subscriptionId: string): Promise<SubscriptionUsage | null>;

  /**
   * Calculate usage charges
   * @param subscriptionId - Subscription ID
   * @returns Total usage charges
   */
  calculateUsageCharges(subscriptionId: string): Promise<number>;

  /**
   * GRACE PERIOD & RETRY
   */

  /**
   * Start grace period for failed payment
   * @param subscriptionId - Subscription ID
   * @param days - Grace period duration in days
   * @returns Updated subscription
   */
  startGracePeriod(subscriptionId: string, days: number): Promise<Subscription>;

  /**
   * Get subscriptions in grace period
   * @returns Subscriptions in grace period
   */
  getSubscriptionsInGracePeriod(): Promise<Subscription[]>;

  /**
   * Schedule payment retry
   * @param subscriptionId - Subscription ID
   * @param retryDate - When to retry
   */
  schedulePaymentRetry(subscriptionId: string, retryDate: Date): Promise<void>;

  /**
   * Get retry schedule for subscription
   * @param subscriptionId - Subscription ID
   * @returns List of retry dates
   */
  getRetrySchedule(subscriptionId: string): Promise<Date[]>;

  /**
   * ANALYTICS & REPORTING
   */

  /**
   * Get subscription analytics
   * @param periodType - Period type (day, week, month, year)
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Analytics data
   */
  getAnalytics(
    periodType: 'day' | 'week' | 'month' | 'year',
    startDate: Date,
    endDate: Date
  ): Promise<SubscriptionAnalytics[]>;

  /**
   * Get subscription statistics
   * @returns Current statistics
   */
  getStatistics(): Promise<SubscriptionStatistics>;

  /**
   * Calculate MRR (Monthly Recurring Revenue)
   * @returns Current MRR
   */
  calculateMRR(): Promise<number>;

  /**
   * Calculate ARR (Annual Recurring Revenue)
   * @returns Current ARR
   */
  calculateARR(): Promise<number>;

  /**
   * Calculate churn rate
   * @param periodDays - Period in days (default: 30)
   * @returns Churn rate percentage
   */
  calculateChurnRate(periodDays?: number): Promise<number>;

  /**
   * Calculate average LTV (Lifetime Value)
   * @returns Average customer LTV
   */
  calculateAverageLTV(): Promise<number>;

  /**
   * Get retention rate
   * @param periodDays - Period in days (default: 30)
   * @returns Retention rate percentage
   */
  getRetentionRate(periodDays?: number): Promise<number>;

  /**
   * EVENTS & WEBHOOKS
   */

  /**
   * Subscribe to subscription events
   * @param eventType - Event type
   * @param callback - Event handler
   * @returns Subscription ID
   */
  subscribeToEvents(
    eventType: SubscriptionEventType,
    callback: (event: SubscriptionWebhookEvent) => void | Promise<void>
  ): string;

  /**
   * Unsubscribe from events
   * @param subscriptionId - Event subscription ID
   */
  unsubscribeFromEvents(subscriptionId: string): void;

  /**
   * Get subscription event history
   * @param subscriptionId - Subscription ID
   * @param limit - Result limit
   * @returns Event history
   */
  getEventHistory(subscriptionId: string, limit?: number): Promise<SubscriptionEvent[]>;

  /**
   * CURRENCY SUPPORT
   */

  /**
   * Get subscription in user's preferred currency
   * @param subscriptionId - Subscription ID
   * @param currency - Target currency
   * @returns Subscription with converted prices
   */
  getSubscriptionInCurrency(
    subscriptionId: string,
    currency: Currency
  ): Promise<Subscription>;

  /**
   * Update subscription currency
   * @param subscriptionId - Subscription ID
   * @param newCurrency - New currency
   * @returns Updated subscription
   */
  updateCurrency(subscriptionId: string, newCurrency: Currency): Promise<Subscription>;

  /**
   * HEALTH & MAINTENANCE
   */

  /**
   * Health check for subscription service
   * @returns Whether service is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get service metrics
   * @returns Service metrics
   */
  getMetrics(): Promise<{
    uptime: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    mrr: number;
    arr: number;
    churnRate: number;
    averageProcessingTime: number;
  }>;

  /**
   * Clean up expired subscriptions
   * @param retentionDays - Days to retain after expiration
   * @returns Number of cleaned subscriptions
   */
  cleanupExpiredSubscriptions(retentionDays: number): Promise<number>;

  /**
   * Dispose resources
   */
  dispose(): Promise<void>;
}
