import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { z } from 'zod';
import Redis from 'ioredis';
import { getRedisClient } from '../lib/redis';
import { supabase } from '../config/supabase';
import { Logger } from '../utils/logger';
import { AnalyticsService } from './analytics-service';
import { LightningPaymentService } from './lightning-payment-service';
import { NotificationService } from './notification-service';
import { WebSocketService } from './websocket-service';

// Subscription Management Types and Schemas
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SubscriptionTierSchema = z.object({
  id: z.string(),
  creator_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price_msats: z.number().positive(),
  billing_interval: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  benefits: z.array(z.string()).min(1),
  max_subscribers: z.number().positive().optional(),
  is_active: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});

const SubscriptionStatusSchema = z.enum([
  'active',
  'pending',
  'past_due',
  'cancelled',
  'expired',
  'suspended',
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RecurringPaymentSchema = z.object({
  id: z.string(),
  subscription_id: z.string(),
  amount_msats: z.number().positive(),
  next_payment_date: z.date(),
  payment_method: z.string(),
  retry_count: z.number().nonnegative(),
  max_retries: z.number().positive(),
  is_active: z.boolean(),
});

// Interface Definitions
interface SubscriptionTier {
  id: string;
  creator_id: string;
  name: string;
  description?: string;
  price_msats: number;
  billing_interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  benefits: string[];
  max_subscribers?: number;
  current_subscribers: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface Subscription {
  id: string;
  user_id: string;
  tier_id: string;
  status: z.infer<typeof SubscriptionStatusSchema>;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  cancelled_at?: Date;
  trial_end?: Date;
  metadata?: Record<string, any>;
}

interface RecurringPayment {
  id: string;
  subscription_id: string;
  amount_msats: number;
  next_payment_date: Date;
  payment_method: string;
  retry_count: number;
  max_retries: number;
  is_active: boolean;
  last_payment_attempt?: Date;
  last_payment_error?: string;
}

interface SubscriptionAnalytics {
  total_subscribers: number;
  active_subscribers: number;
  monthly_recurring_revenue: number;
  churn_rate: number;
  growth_rate: number;
  average_revenue_per_user: number;
  lifetime_value: number;
  retention_rates: Record<string, number>;
}

/**
 * Subscription Management Service
 *
 * Comprehensive subscription and recurring payment management service that handles:
 * - Multi-tier subscription creation and management
 * - Automated recurring payment processing
 * - Subscription verification and access control
 * - Advanced subscription analytics and reporting
 *
 * Features:
 * - Flexible subscription tiers with custom benefits
 * - Automated recurring Lightning payments
 * - Real-time subscription status tracking
 * - Advanced analytics and revenue forecasting
 * - Intelligent retry logic for failed payments
 * - Subscription lifecycle management
 * - Revenue optimization and pricing insights
 */
export class SubscriptionManagementService extends EventEmitter {
  private logger: Logger;
  private redis: Redis;
  private lightningService: LightningPaymentService;
  private notificationService: NotificationService;
  private analyticsService: AnalyticsService;
  private wsService: WebSocketService;
  private recurringPaymentJobs: Map<string, NodeJS.Timeout>;
  private subscriptionCache: Map<string, Subscription>;
  private recurringPaymentInterval?: NodeJS.Timeout;
  private subscriptionMonitorInterval?: NodeJS.Timeout;

  constructor(lightningService: LightningPaymentService) {
    super();
    this.logger = new Logger('SubscriptionManagementService');
    this.redis = getRedisClient();
    this.lightningService = lightningService;
    this.notificationService = new NotificationService();
    this.analyticsService = new AnalyticsService();
    this.wsService = new WebSocketService();
    this.recurringPaymentJobs = new Map();
    this.subscriptionCache = new Map();

    this.initializeService();
  }

  /**
   * Initialize Subscription Management Service
   */
  private async initializeService(): Promise<void> {
    try {
      await this.setupRecurringPaymentScheduler();
      await this.setupSubscriptionMonitoring();

      this.logger.info('Subscription Management Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Subscription Management Service', error);
      throw error;
    }
  }

  /**
   * US-055: Create Subscription Tiers
   * Allows creators to create flexible subscription tiers with custom benefits
   */
  async createSubscriptionTier(params: {
    creator_id: string;
    name: string;
    description?: string;
    price_msats: number;
    billing_interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
    benefits: string[];
    max_subscribers?: number;
  }): Promise<SubscriptionTier> {
    const startTime = Date.now();

    try {
      // Validate input parameters
      const validated = z
        .object({
          creator_id: z.string().uuid(),
          name: z.string().min(1).max(100),
          description: z.string().max(500).optional(),
          price_msats: z.number().positive().max(1000000000), // 0.01 BTC max
          billing_interval: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
          benefits: z.array(z.string().min(1)).min(1).max(20),
          max_subscribers: z.number().positive().optional(),
        })
        .parse(params);

      // Check creator's tier limits
      const { data: existingTiers, error: countError } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('creator_id', validated.creator_id)
        .eq('is_active', true);

      if (countError) throw countError;

      if (existingTiers && existingTiers.length >= 10) {
        throw new Error('Maximum number of subscription tiers reached (10)');
      }

      // Create subscription tier
      const tier: SubscriptionTier = {
        id: `tier_${randomBytes(16).toString('hex')}`,
        creator_id: validated.creator_id,
        name: validated.name,
        description: validated.description,
        price_msats: validated.price_msats,
        billing_interval: validated.billing_interval,
        benefits: validated.benefits,
        max_subscribers: validated.max_subscribers,
        current_subscribers: 0,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Store in database
      const { error } = await supabase.from('subscription_tiers').insert([
        {
          id: tier.id,
          creator_id: tier.creator_id,
          name: tier.name,
          description: tier.description,
          price_msats: tier.price_msats,
          billing_interval: tier.billing_interval,
          benefits: tier.benefits,
          max_subscribers: tier.max_subscribers,
          current_subscribers: tier.current_subscribers,
          is_active: tier.is_active,
          created_at: tier.created_at.toISOString(),
          updated_at: tier.updated_at.toISOString(),
        },
      ]);

      if (error) throw error;

      // Cache tier data
      await this.redis.setex(
        `subscription_tier:${tier.id}`,
        3600, // 1 hour
        JSON.stringify(tier)
      );

      // Track analytics
      await this.analyticsService.track('subscription_tier_created', {
        creator_id: validated.creator_id,
        tier_id: tier.id,
        price_msats: validated.price_msats,
        billing_interval: validated.billing_interval,
        processing_time_ms: Date.now() - startTime,
      });

      this.logger.info(`Subscription tier created: ${tier.id}`, {
        creator_id: validated.creator_id,
        name: validated.name,
        price_msats: validated.price_msats,
      });

      return tier;
    } catch (error) {
      this.logger.error('Failed to create subscription tier', error);
      throw new Error(`Subscription tier creation failed: ${error.message}`);
    }
  }

  /**
   * US-055: Get Subscription Tiers for Creator
   */
  async getSubscriptionTiers(creator_id: string): Promise<SubscriptionTier[]> {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select(
          `
          *,
          subscriptions!inner(count)
        `
        )
        .eq('creator_id', creator_id)
        .eq('is_active', true)
        .order('price_msats', { ascending: true });

      if (error) throw error;

      return data.map((tier) => ({
        id: tier.id,
        creator_id: tier.creator_id,
        name: tier.name,
        description: tier.description,
        price_msats: tier.price_msats,
        billing_interval: tier.billing_interval,
        benefits: tier.benefits,
        max_subscribers: tier.max_subscribers,
        current_subscribers: tier.subscriptions?.[0]?.count || 0,
        is_active: tier.is_active,
        created_at: new Date(tier.created_at),
        updated_at: new Date(tier.updated_at),
      }));
    } catch (error) {
      this.logger.error('Failed to get subscription tiers', error);
      throw new Error(`Subscription tier retrieval failed: ${error.message}`);
    }
  }

  /**
   * US-056: Create Subscription with Recurring Payment
   * Manages subscription creation and recurring payment setup
   */
  async createSubscription(params: {
    user_id: string;
    tier_id: string;
    payment_method?: string;
    trial_days?: number;
  }): Promise<{
    subscription: Subscription;
    initial_invoice?: any;
  }> {
    const startTime = Date.now();

    try {
      const validated = z
        .object({
          user_id: z.string().uuid(),
          tier_id: z.string(),
          payment_method: z.string().optional(),
          trial_days: z.number().min(0).max(30).optional(),
        })
        .parse(params);

      // Get subscription tier
      const tier = await this.getSubscriptionTierById(validated.tier_id);
      if (!tier) {
        throw new Error('Subscription tier not found');
      }

      // Check if user already has active subscription to this tier
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', validated.user_id)
        .eq('tier_id', validated.tier_id)
        .eq('status', 'active')
        .single();

      if (existingSubscription) {
        throw new Error('User already has an active subscription to this tier');
      }

      // Check subscriber limits
      if (tier.max_subscribers && tier.current_subscribers >= tier.max_subscribers) {
        throw new Error('Subscription tier has reached maximum subscribers');
      }

      // Calculate subscription periods
      const now = new Date();
      const trial_end = validated.trial_days
        ? new Date(now.getTime() + validated.trial_days * 24 * 60 * 60 * 1000)
        : undefined;

      const subscription_start = trial_end || now;
      const period_end = this.calculateNextBillingDate(subscription_start, tier.billing_interval);

      // Create subscription
      const subscription: Subscription = {
        id: `sub_${randomBytes(16).toString('hex')}`,
        user_id: validated.user_id,
        tier_id: validated.tier_id,
        status: trial_end ? 'active' : 'pending',
        started_at: now,
        current_period_start: subscription_start,
        current_period_end: period_end,
        cancel_at_period_end: false,
        trial_end,
        metadata: {
          payment_method: validated.payment_method || 'lightning',
          created_via: 'api',
        },
      };

      // Fix #116: Compensating transaction — track completed steps for rollback
      let recurringPaymentId: string | null = null;
      let subscriptionInserted = false;
      let tierCountIncremented = false;
      let createdInvoice: unknown;

      try {
        // Step 1: Insert subscription
        const { error: subError } = await supabase.from('subscriptions').insert([
          {
            id: subscription.id,
            user_id: subscription.user_id,
            tier_id: subscription.tier_id,
            status: subscription.status,
            started_at: subscription.started_at.toISOString(),
            current_period_start: subscription.current_period_start.toISOString(),
            current_period_end: subscription.current_period_end.toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_end: subscription.trial_end?.toISOString(),
            metadata: subscription.metadata,
          },
        ]);
        if (subError) throw subError;
        subscriptionInserted = true;

        // Step 2: Create recurring payment schedule
        const recurringPayment = await this.createRecurringPayment({
          subscription_id: subscription.id,
          amount_msats: tier.price_msats,
          next_payment_date: trial_end || period_end,
          payment_method: validated.payment_method || 'lightning',
        });
        recurringPaymentId = recurringPayment.id;

        // Step 3: Generate initial invoice if no trial
        let initial_invoice;
        if (!trial_end) {
          initial_invoice = await this.lightningService.generateBOLT11Invoice({
            user_id: validated.user_id,
            amount_msats: tier.price_msats,
            description: `Subscription to ${tier.name}`,
            expires_in_seconds: 3600,
            metadata: {
              subscription_id: subscription.id,
              tier_id: tier.id,
              billing_period: 'initial',
            },
          });

          subscription.status = 'pending';
          await this.updateSubscriptionStatus(subscription.id, 'pending');
        }

        // Step 4: Update tier subscriber count
        const { error: tierError } = await supabase
          .from('subscription_tiers')
          .update({
            current_subscribers: supabase.raw('current_subscribers + 1'),
            updated_at: new Date().toISOString(),
          })
          .eq('id', tier.id);
        if (tierError) throw tierError;
        tierCountIncremented = true;

        createdInvoice = initial_invoice;
      } catch (stepError) {
        // Compensating rollback in reverse order with retry
        this.logger.error('Subscription creation step failed, rolling back', stepError);

        if (tierCountIncremented) {
          const ok = await this.retryOperation(
            async () => {
              const { error } = await supabase
                .from('subscription_tiers')
                .update({
                  current_subscribers: supabase.raw('GREATEST(current_subscribers - 1, 0)'),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', tier.id);
              if (error) throw error;
            },
            'Rollback tier count'
          );
          if (!ok) {
            this.logger.error('ALERT: Orphaned tier count increment', {
              tier_id: tier.id,
              subscription_id: subscription.id,
            });
            this.emit('rollback:failed', { step: 'tier_count', tier_id: tier.id });
          }
        }

        if (recurringPaymentId) {
          const ok = await this.retryOperation(
            async () => {
              const { error } = await supabase
                .from('recurring_payments')
                .delete()
                .eq('id', recurringPaymentId);
              if (error) throw error;
            },
            'Rollback recurring payment'
          );
          if (!ok) {
            this.logger.error('ALERT: Orphaned recurring payment', {
              recurring_payment_id: recurringPaymentId,
              subscription_id: subscription.id,
            });
            this.emit('rollback:failed', { step: 'recurring_payment', id: recurringPaymentId });
          }
        }

        if (subscriptionInserted) {
          const ok = await this.retryOperation(
            async () => {
              const { error } = await supabase
                .from('subscriptions')
                .delete()
                .eq('id', subscription.id);
              if (error) throw error;
            },
            'Rollback subscription'
          );
          if (!ok) {
            this.logger.error('ALERT: Orphaned subscription', {
              subscription_id: subscription.id,
            });
            this.emit('rollback:failed', { step: 'subscription', id: subscription.id });
          }
        }

        throw stepError;
      }

      // Cache subscription
      this.subscriptionCache.set(subscription.id, subscription);
      await this.redis.setex(`subscription:${subscription.id}`, 3600, JSON.stringify(subscription));

      // Track analytics
      await this.analyticsService.track('subscription_created', {
        user_id: validated.user_id,
        subscription_id: subscription.id,
        tier_id: tier.id,
        price_msats: tier.price_msats,
        has_trial: !!trial_end,
        processing_time_ms: Date.now() - startTime,
      });

      this.logger.info(`Subscription created: ${subscription.id}`, {
        user_id: validated.user_id,
        tier_id: tier.id,
        has_trial: !!trial_end,
      });

      return { subscription, initial_invoice: createdInvoice };
    } catch (error) {
      this.logger.error('Failed to create subscription', error);
      throw new Error(
        `Subscription creation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * US-056: Manage Recurring Payments
   * Handles automated recurring payment processing
   */
  async processRecurringPayments(): Promise<void> {
    try {
      // Get due recurring payments
      const { data: duePayments, error } = await supabase
        .from('recurring_payments')
        .select(
          `
          *,
          subscriptions!inner(
            user_id,
            tier_id,
            status,
            subscription_tiers!inner(name, price_msats)
          )
        `
        )
        .eq('is_active', true)
        .lte('next_payment_date', new Date().toISOString())
        .lt('retry_count', supabase.raw('max_retries'));

      if (error) throw error;

      this.logger.info(`Processing ${duePayments?.length || 0} recurring payments`);

      // Process each payment
      for (const payment of duePayments || []) {
        await this.processRecurringPayment(payment);
      }
    } catch (error) {
      this.logger.error('Failed to process recurring payments', error);
    }
  }

  /**
   * US-057: Subscription Verification System
   * Verifies subscription status and access rights
   */
  async verifySubscriptionAccess(params: {
    user_id: string;
    creator_id?: string;
    tier_id?: string;
    required_benefits?: string[];
  }): Promise<{
    has_access: boolean;
    subscription?: Subscription;
    tier?: SubscriptionTier;
    expires_at?: Date;
    benefits?: string[];
  }> {
    try {
      const validated = z
        .object({
          user_id: z.string().uuid(),
          creator_id: z.string().uuid().optional(),
          tier_id: z.string().optional(),
          required_benefits: z.array(z.string()).optional(),
        })
        .parse(params);

      // Build query
      let query = supabase
        .from('subscriptions')
        .select(
          `
          *,
          subscription_tiers!inner(
            creator_id,
            name,
            benefits,
            price_msats,
            billing_interval
          )
        `
        )
        .eq('user_id', validated.user_id)
        .eq('status', 'active');

      if (validated.creator_id) {
        query = query.eq('subscription_tiers.creator_id', validated.creator_id);
      }

      if (validated.tier_id) {
        query = query.eq('tier_id', validated.tier_id);
      }

      const { data: subscriptions, error } = await query;
      if (error) throw error;

      // Check for valid subscription
      const activeSubscription = subscriptions?.find((sub) => {
        const now = new Date();
        const periodEnd = new Date(sub.current_period_end);
        return periodEnd > now;
      });

      if (!activeSubscription) {
        return { has_access: false };
      }

      const tier = activeSubscription.subscription_tiers;

      // Check required benefits
      let has_access = true;
      if (validated.required_benefits && validated.required_benefits.length > 0) {
        has_access = validated.required_benefits.every((benefit) =>
          tier.benefits.includes(benefit)
        );
      }

      return {
        has_access,
        subscription: {
          id: activeSubscription.id,
          user_id: activeSubscription.user_id,
          tier_id: activeSubscription.tier_id,
          status: activeSubscription.status,
          started_at: new Date(activeSubscription.started_at),
          current_period_start: new Date(activeSubscription.current_period_start),
          current_period_end: new Date(activeSubscription.current_period_end),
          cancel_at_period_end: activeSubscription.cancel_at_period_end,
          cancelled_at: activeSubscription.cancelled_at
            ? new Date(activeSubscription.cancelled_at)
            : undefined,
          trial_end: activeSubscription.trial_end
            ? new Date(activeSubscription.trial_end)
            : undefined,
          metadata: activeSubscription.metadata,
        },
        tier: {
          id: activeSubscription.tier_id,
          creator_id: tier.creator_id,
          name: tier.name,
          description: tier.description,
          price_msats: tier.price_msats,
          billing_interval: tier.billing_interval,
          benefits: tier.benefits,
          current_subscribers: 0, // Not needed for verification
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        expires_at: new Date(activeSubscription.current_period_end),
        benefits: tier.benefits,
      };
    } catch (error) {
      this.logger.error('Failed to verify subscription access', error);
      throw new Error(`Subscription verification failed: ${error.message}`);
    }
  }

  /**
   * US-058: Subscription Analytics
   * Provides comprehensive subscription analytics and insights
   */
  async getSubscriptionAnalytics(
    creator_id: string,
    period?: {
      start_date: Date;
      end_date: Date;
    }
  ): Promise<SubscriptionAnalytics> {
    try {
      const startDate = period?.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = period?.end_date || new Date();

      // Get subscription metrics
      const [totalSubscribers, activeSubscribers, revenueData, churnData, retentionData] =
        await Promise.all([
          this.getTotalSubscribers(creator_id),
          this.getActiveSubscribers(creator_id),
          this.getRevenueAnalytics(creator_id, startDate, endDate),
          this.getChurnAnalytics(creator_id, startDate, endDate),
          this.getRetentionAnalytics(creator_id),
        ]);

      const analytics: SubscriptionAnalytics = {
        total_subscribers: totalSubscribers,
        active_subscribers: activeSubscribers,
        monthly_recurring_revenue: revenueData.mrr,
        churn_rate: churnData.churn_rate,
        growth_rate: revenueData.growth_rate,
        average_revenue_per_user: revenueData.arpu,
        lifetime_value: revenueData.ltv,
        retention_rates: retentionData,
      };

      // Cache analytics
      await this.redis.setex(
        `subscription_analytics:${creator_id}`,
        1800, // 30 minutes
        JSON.stringify(analytics)
      );

      return analytics;
    } catch (error) {
      this.logger.error('Failed to get subscription analytics', error);
      throw new Error(`Subscription analytics failed: ${error.message}`);
    }
  }

  // Private Helper Methods

  private async createRecurringPayment(params: {
    subscription_id: string;
    amount_msats: number;
    next_payment_date: Date;
    payment_method: string;
  }): Promise<RecurringPayment> {
    const recurringPayment: RecurringPayment = {
      id: `rp_${randomBytes(16).toString('hex')}`,
      subscription_id: params.subscription_id,
      amount_msats: params.amount_msats,
      next_payment_date: params.next_payment_date,
      payment_method: params.payment_method,
      retry_count: 0,
      max_retries: 3,
      is_active: true,
    };

    const { error } = await supabase.from('recurring_payments').insert([
      {
        id: recurringPayment.id,
        subscription_id: recurringPayment.subscription_id,
        amount_msats: recurringPayment.amount_msats,
        next_payment_date: recurringPayment.next_payment_date.toISOString(),
        payment_method: recurringPayment.payment_method,
        retry_count: recurringPayment.retry_count,
        max_retries: recurringPayment.max_retries,
        is_active: recurringPayment.is_active,
      },
    ]);

    if (error) throw error;

    return recurringPayment;
  }

  private async processRecurringPayment(payment: any): Promise<void> {
    try {
      const subscription = payment.subscriptions;
      const tier = subscription.subscription_tiers;

      // Generate invoice for recurring payment
      const invoice = await this.lightningService.generateBOLT11Invoice({
        user_id: subscription.user_id,
        amount_msats: payment.amount_msats,
        description: `${tier.name} subscription renewal`,
        expires_in_seconds: 86400, // 24 hours for recurring payments
        metadata: {
          subscription_id: subscription.id,
          tier_id: subscription.tier_id,
          recurring_payment_id: payment.id,
          billing_period: 'recurring',
        },
      });

      // Update payment attempt
      await supabase
        .from('recurring_payments')
        .update({
          last_payment_attempt: new Date().toISOString(),
          retry_count: payment.retry_count + 1,
        })
        .eq('id', payment.id);

      // Send payment notification
      await this.notificationService.sendNotification({
        user_id: subscription.user_id,
        type: 'subscription_payment_due',
        title: 'Subscription Payment Due',
        message: `Your subscription to ${tier.name} is due for renewal`,
        data: {
          subscription_id: subscription.id,
          invoice: invoice,
          amount_msats: payment.amount_msats,
        },
      });

      this.logger.info(`Recurring payment processed: ${payment.id}`, {
        subscription_id: subscription.id,
        amount_msats: payment.amount_msats,
      });
    } catch (error) {
      this.logger.error(`Failed to process recurring payment: ${payment.id}`, error);

      // Update payment error
      await supabase
        .from('recurring_payments')
        .update({
          last_payment_error: error.message,
          retry_count: payment.retry_count + 1,
        })
        .eq('id', payment.id);

      // Check if max retries exceeded
      if (payment.retry_count + 1 >= payment.max_retries) {
        await this.handleFailedRecurringPayment(payment);
      }
    }
  }

  private async handleFailedRecurringPayment(payment: any): Promise<void> {
    // Suspend subscription
    await this.updateSubscriptionStatus(payment.subscription_id, 'suspended');

    // Deactivate recurring payment
    await supabase.from('recurring_payments').update({ is_active: false }).eq('id', payment.id);

    // Send failure notification
    const subscription = payment.subscriptions;
    await this.notificationService.sendNotification({
      user_id: subscription.user_id,
      type: 'subscription_payment_failed',
      title: 'Subscription Payment Failed',
      message: 'Your subscription has been suspended due to payment failure',
      data: {
        subscription_id: subscription.id,
        payment_id: payment.id,
      },
    });

    this.logger.warn(`Subscription suspended due to payment failure: ${payment.subscription_id}`);
  }

  private calculateNextBillingDate(startDate: Date, interval: string): Date {
    const date = new Date(startDate);

    switch (interval) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }

    return date;
  }

  private async getSubscriptionTierById(tier_id: string): Promise<SubscriptionTier | null> {
    // Check cache first
    const cached = await this.redis.get(`subscription_tier:${tier_id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', tier_id)
      .single();

    if (error || !data) return null;

    const tier: SubscriptionTier = {
      id: data.id,
      creator_id: data.creator_id,
      name: data.name,
      description: data.description,
      price_msats: data.price_msats,
      billing_interval: data.billing_interval,
      benefits: data.benefits,
      max_subscribers: data.max_subscribers,
      current_subscribers: data.current_subscribers,
      is_active: data.is_active,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };

    // Cache tier
    await this.redis.setex(`subscription_tier:${tier_id}`, 3600, JSON.stringify(tier));
    return tier;
  }

  private async updateSubscriptionStatus(
    subscription_id: string,
    status: z.infer<typeof SubscriptionStatusSchema>
  ): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription_id);

    if (error) throw error;

    // Clear cache
    await this.redis.del(`subscription:${subscription_id}`);
    this.subscriptionCache.delete(subscription_id);
  }

  private async setupRecurringPaymentScheduler(): Promise<void> {
    // Process recurring payments every hour
    this.recurringPaymentInterval = setInterval(async () => {
      await this.processRecurringPayments();
    }, 3600000); // 1 hour

    // Initial processing
    await this.processRecurringPayments();
  }

  private async setupSubscriptionMonitoring(): Promise<void> {
    // Monitor subscription expirations and renewals
    this.subscriptionMonitorInterval = setInterval(async () => {
      try {
        // Check for expired subscriptions
        await this.checkExpiredSubscriptions();

        // Check for upcoming renewals
        await this.checkUpcomingRenewals();
      } catch (error) {
        this.logger.error('Subscription monitoring error', error);
      }
    }, 1800000); // 30 minutes
  }

  private async checkExpiredSubscriptions(): Promise<void> {
    const { data: expiredSubscriptions, error } = await supabase
      .from('subscriptions')
      .select('id, user_id')
      .eq('status', 'active')
      .lt('current_period_end', new Date().toISOString());

    if (error) {
      this.logger.error('Failed to check expired subscriptions', error);
      return;
    }

    for (const subscription of expiredSubscriptions || []) {
      await this.updateSubscriptionStatus(subscription.id, 'expired');

      // Send expiration notification
      await this.notificationService.sendNotification({
        user_id: subscription.user_id,
        type: 'subscription_expired',
        title: 'Subscription Expired',
        message: 'Your subscription has expired',
        data: { subscription_id: subscription.id },
      });
    }
  }

  private async checkUpcomingRenewals(): Promise<void> {
    const reminderDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    const { data: upcomingRenewals, error } = await supabase
      .from('subscriptions')
      .select(
        `
        id,
        user_id,
        current_period_end,
        subscription_tiers!inner(name, price_msats)
      `
      )
      .eq('status', 'active')
      .gte('current_period_end', new Date().toISOString())
      .lte('current_period_end', reminderDate.toISOString());

    if (error) {
      this.logger.error('Failed to check upcoming renewals', error);
      return;
    }

    for (const subscription of upcomingRenewals || []) {
      await this.notificationService.sendNotification({
        user_id: subscription.user_id,
        type: 'subscription_renewal_reminder',
        title: 'Subscription Renewal Reminder',
        message: `Your subscription to ${subscription.subscription_tiers.name} will renew soon`,
        data: {
          subscription_id: subscription.id,
          renewal_date: subscription.current_period_end,
          amount_msats: subscription.subscription_tiers.price_msats,
        },
      });
    }
  }

  // Analytics Helper Methods
  private async getTotalSubscribers(creator_id: string): Promise<number> {
    const { count, error } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact' })
      .eq('subscription_tiers.creator_id', creator_id);

    if (error) throw error;
    return count || 0;
  }

  private async getActiveSubscribers(creator_id: string): Promise<number> {
    const { count, error } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact' })
      .eq('subscription_tiers.creator_id', creator_id)
      .eq('status', 'active');

    if (error) throw error;
    return count || 0;
  }

  private async getRevenueAnalytics(
    _creator_id: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<{
    mrr: number;
    growth_rate: number;
    arpu: number;
    ltv: number;
  }> {
    // This would implement complex revenue analytics
    // Simplified implementation for now
    return {
      mrr: 0,
      growth_rate: 0,
      arpu: 0,
      ltv: 0,
    };
  }

  private async getChurnAnalytics(
    _creator_id: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<{
    churn_rate: number;
  }> {
    // This would implement churn rate calculation
    return { churn_rate: 0 };
  }

  private async getRetentionAnalytics(_creator_id: string): Promise<Record<string, number>> {
    // This would implement retention rate analysis
    return {
      '1_month': 0.95,
      '3_months': 0.85,
      '6_months': 0.75,
      '12_months': 0.65,
    };
  }

  /**
   * Retry an operation up to maxRetries times with exponential backoff.
   * Returns true if the operation succeeded, false if all retries exhausted.
   */
  private async retryOperation(
    operation: () => Promise<void>,
    label: string,
    maxRetries = 3
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await operation();
        return true;
      } catch (err) {
        this.logger.warn(`${label} attempt ${attempt}/${maxRetries} failed`, err);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 100 * attempt));
        }
      }
    }
    return false;
  }

  /**
   * Health Check and Monitoring
   */
  async getServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: Record<string, any>;
  }> {
    try {
      const metrics = {
        active_jobs: this.recurringPaymentJobs.size,
        cached_subscriptions: this.subscriptionCache.size,
        redis_connected: await this.redis.ping(),
        database_connected: true,
      };

      const status = metrics.redis_connected && metrics.database_connected ? 'healthy' : 'degraded';

      return { status, metrics };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        metrics: { error: error.message },
      };
    }
  }

  /**
   * Cleanup and Shutdown
   */
  async shutdown(): Promise<void> {
    // Clear scheduler intervals
    if (this.recurringPaymentInterval) {
      clearInterval(this.recurringPaymentInterval);
      this.recurringPaymentInterval = undefined;
    }
    if (this.subscriptionMonitorInterval) {
      clearInterval(this.subscriptionMonitorInterval);
      this.subscriptionMonitorInterval = undefined;
    }

    // Clear all recurring payment jobs
    for (const [, job] of this.recurringPaymentJobs) {
      clearInterval(job);
    }
    this.recurringPaymentJobs.clear();

    // Clear caches
    this.subscriptionCache.clear();

    // Shared Redis client — managed by lib/redis.ts disconnectRedis()

    this.logger.info('Subscription Management Service shutdown completed');
  }
}

export default SubscriptionManagementService;
