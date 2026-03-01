// @ts-nocheck
/**
 * SubscriptionService Implementation
 * User Story: US-E5-026
 * Complete subscription management service with recurring billing
 * Part of Epic 005 - Backend Service Layer Refactoring
 *
 * CRITICAL: Payment services require 100% test coverage
 */

import type { ISubscriptionService } from '../../interfaces/payment/ISubscriptionService';
import type { IPaymentProcessingService } from '../../interfaces/payment/IPaymentProcessingService';
import type { ICurrencyService } from '../../interfaces/payment/ICurrencyService';
import type { IAuditLogService } from '../../interfaces/shared/IAuditLogService';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
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
  SubscriptionUsage,
  InvoiceLineItem,
} from '../../types/subscription';
import {
  SubscriptionEventType,
  SubscriptionStatus,
  BillingInterval,
  SubscriptionTier,
  InvoiceType,
  InvoiceStatus,
} from '../../types/subscription';
import { Currency } from '../../types/currency';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

/**
 * Subscription repository interface
 */
interface ISubscriptionRepository {
  saveSubscription(subscription: Subscription): Promise<void>;
  getSubscription(id: string): Promise<Subscription | null>;
  getUserSubscription(userId: string): Promise<Subscription | null>;
  querySubscriptions(query: SubscriptionQuery): Promise<Subscription[]>;
  countSubscriptions(query: SubscriptionQuery): Promise<number>;
  updateSubscription(subscription: Subscription): Promise<void>;

  savePlan(plan: SubscriptionPlan): Promise<void>;
  getPlan(id: string): Promise<SubscriptionPlan | null>;
  listPlans(tier?: SubscriptionTier): Promise<SubscriptionPlan[]>;
  updatePlan(plan: SubscriptionPlan): Promise<void>;

  saveInvoice(invoice: SubscriptionInvoice): Promise<void>;
  getInvoice(id: string): Promise<SubscriptionInvoice | null>;
  listSubscriptionInvoices(subscriptionId: string, limit?: number): Promise<SubscriptionInvoice[]>;
  updateInvoice(invoice: SubscriptionInvoice): Promise<void>;

  saveEvent(event: SubscriptionEvent): Promise<void>;
  getEventHistory(subscriptionId: string, limit?: number): Promise<SubscriptionEvent[]>;

  saveUsage(usage: SubscriptionUsage): Promise<void>;
  getCurrentUsage(subscriptionId: string): Promise<SubscriptionUsage | null>;
}

/**
 * In-memory subscription repository (for development/testing)
 */
class InMemorySubscriptionRepository implements ISubscriptionRepository {
  private subscriptions = new Map<string, Subscription>();
  private userSubscriptions = new Map<string, Subscription>();
  private plans = new Map<string, SubscriptionPlan>();
  private invoices = new Map<string, SubscriptionInvoice>();
  private events: SubscriptionEvent[] = [];
  private usage = new Map<string, SubscriptionUsage>();

  async saveSubscription(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.id, subscription);
    this.userSubscriptions.set(subscription.userId, subscription);
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    return this.subscriptions.get(id) || null;
  }

  async getUserSubscription(userId: string): Promise<Subscription | null> {
    return this.userSubscriptions.get(userId) || null;
  }

  async querySubscriptions(query: SubscriptionQuery): Promise<Subscription[]> {
    let results = Array.from(this.subscriptions.values());

    if (query.userId) {
      results = results.filter((s) => s.userId === query.userId);
    }
    if (query.status) {
      results = results.filter((s) => s.status === query.status);
    }
    if (query.planId) {
      results = results.filter((s) => s.planId === query.planId);
    }
    if (query.startDate) {
      results = results.filter((s) => s.createdAt >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter((s) => s.createdAt <= query.endDate!);
    }

    // Sort
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    results.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'desc' ? (bVal > aVal ? 1 : -1) : aVal > bVal ? 1 : -1;
    });

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }

  async countSubscriptions(query: SubscriptionQuery): Promise<number> {
    const results = await this.querySubscriptions({ ...query, limit: Number.MAX_SAFE_INTEGER });
    return results.length;
  }

  async updateSubscription(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.id, subscription);
    this.userSubscriptions.set(subscription.userId, subscription);
  }

  async savePlan(plan: SubscriptionPlan): Promise<void> {
    this.plans.set(plan.id, plan);
  }

  async getPlan(id: string): Promise<SubscriptionPlan | null> {
    return this.plans.get(id) || null;
  }

  async listPlans(tier?: SubscriptionTier): Promise<SubscriptionPlan[]> {
    let plans = Array.from(this.plans.values()).filter((p) => p.active);
    if (tier) {
      plans = plans.filter((p) => p.tier === tier);
    }
    return plans;
  }

  async updatePlan(plan: SubscriptionPlan): Promise<void> {
    this.plans.set(plan.id, plan);
  }

  async saveInvoice(invoice: SubscriptionInvoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
  }

  async getInvoice(id: string): Promise<SubscriptionInvoice | null> {
    return this.invoices.get(id) || null;
  }

  async listSubscriptionInvoices(
    subscriptionId: string,
    limit = 100
  ): Promise<SubscriptionInvoice[]> {
    return Array.from(this.invoices.values())
      .filter((inv) => inv.subscriptionId === subscriptionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async updateInvoice(invoice: SubscriptionInvoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
  }

  async saveEvent(event: SubscriptionEvent): Promise<void> {
    this.events.push(event);
  }

  async getEventHistory(subscriptionId: string, limit = 100): Promise<SubscriptionEvent[]> {
    return this.events
      .filter((e) => e.subscriptionId === subscriptionId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }

  async saveUsage(usage: SubscriptionUsage): Promise<void> {
    this.usage.set(usage.subscriptionId, usage);
  }

  async getCurrentUsage(subscriptionId: string): Promise<SubscriptionUsage | null> {
    return this.usage.get(subscriptionId) || null;
  }
}

/**
 * SubscriptionService implementation
 */
export class SubscriptionService implements ISubscriptionService {
  private readonly paymentService: IPaymentProcessingService;
  private readonly currencyService: ICurrencyService;
  private readonly auditLog: IAuditLogService;
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache?: ICacheService;
  private readonly repository: ISubscriptionRepository;
  private readonly eventSubscriptions = new Map<
    string,
    (event: SubscriptionWebhookEvent) => void | Promise<void>
  >();
  private readonly metrics = {
    totalSubscriptions: 0,
    totalRenewals: 0,
    averageProcessingTime: 0,
    uptime: Date.now(),
  };

  constructor(
    paymentService: IPaymentProcessingService,
    currencyService: ICurrencyService,
    auditLog: IAuditLogService,
    eventBus: IEventBus,
    logger: ILogger,
    repository?: ISubscriptionRepository,
    cache?: ICacheService
  ) {
    this.paymentService = paymentService;
    this.currencyService = currencyService;
    this.auditLog = auditLog;
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;
    this.repository = repository || new InMemorySubscriptionRepository();
  }

  /**
   * SUBSCRIPTION MANAGEMENT
   */

  async createSubscription(params: CreateSubscriptionParams): Promise<Subscription> {
    const startTime = performance.now();

    try {
      // Validate plan exists
      const plan = await this.repository.getPlan(params.planId);
      if (!plan) {
        throw new Error(`Plan not found: ${params.planId}`);
      }

      // Check for existing active subscription
      const existing = await this.repository.getUserSubscription(params.userId);
      if (existing && existing.status === SubscriptionStatus.ACTIVE) {
        throw new Error('User already has an active subscription');
      }

      // Determine trial period
      const trialDays = params.trialDays !== undefined ? params.trialDays : plan.trialDays;
      const isTrialing = trialDays > 0;

      // Calculate dates
      const now = new Date();
      const trialEndDate = isTrialing ? new Date(now.getTime() + trialDays * 86400000) : undefined;
      const currentPeriodStart = now;
      const currentPeriodEnd = this.calculatePeriodEnd(now, params.billingInterval);
      const nextBillingDate = isTrialing ? trialEndDate! : currentPeriodEnd;

      // Get price based on interval
      const price =
        params.billingInterval === BillingInterval.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;
      const currency = params.currency || plan.currency;

      // Create subscription
      const subscription: Subscription = {
        id: randomUUID(),
        userId: params.userId,
        planId: params.planId,
        status: isTrialing ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
        price,
        currency,
        billingInterval: params.billingInterval,
        trialStartDate: isTrialing ? now : undefined,
        trialEndDate,
        isTrialing,
        currentPeriodStart,
        currentPeriodEnd,
        nextBillingDate,
        cancelAtPeriodEnd: false,
        autoRenew: true,
        gracePeriodDays: 7,
        retryCount: 0,
        maxRetries: 3,
        creditBalance: 0,
        metadata: params.metadata,
        createdAt: now,
        updatedAt: now,
      };

      // Save subscription
      await this.repository.saveSubscription(subscription);

      // Create initial invoice if not trialing
      if (!isTrialing) {
        await this.createInvoice(subscription.id, InvoiceType.INITIAL);
      }

      // Record event
      await this.recordEvent(
        subscription.id,
        isTrialing ? SubscriptionEventType.TRIAL_STARTED : SubscriptionEventType.CREATED,
        {
          newStatus: subscription.status,
          newPlanId: subscription.planId,
        }
      );

      // Audit log
      await this.auditLog.log({
        actor: { type: 'user', id: params.userId, name: 'User' },
        action: 'subscription.create',
        resource: { type: 'subscription', id: subscription.id },
        outcome: 'success',
        details: { planId: params.planId, billingInterval: params.billingInterval, isTrialing },
      });

      // Emit event
      await this.emitWebhookEvent(
        subscription,
        isTrialing ? SubscriptionEventType.TRIAL_STARTED : SubscriptionEventType.CREATED
      );

      this.metrics.totalSubscriptions++;
      this.updateMetrics(performance.now() - startTime);

      return subscription;
    } catch (error) {
      this.logger.error('Failed to create subscription', error);
      throw error;
    }
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get<Subscription>(`subscription:${subscriptionId}`);
      if (cached) return cached;
    }

    const subscription = await this.repository.getSubscription(subscriptionId);

    // Cache result
    if (subscription && this.cache) {
      await this.cache.set(`subscription:${subscriptionId}`, subscription, 300);
    }

    return subscription;
  }

  async getUserSubscription(userId: string): Promise<Subscription | null> {
    return this.repository.getUserSubscription(userId);
  }

  async querySubscriptions(query: SubscriptionQuery): Promise<Subscription[]> {
    return this.repository.querySubscriptions(query);
  }

  async countSubscriptions(query: SubscriptionQuery): Promise<number> {
    return this.repository.countSubscriptions(query);
  }

  async updateSubscription(
    subscriptionId: string,
    params: UpdateSubscriptionParams
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (params.autoRenew !== undefined) {
      subscription.autoRenew = params.autoRenew;
    }

    if (params.metadata) {
      subscription.metadata = { ...subscription.metadata, ...params.metadata };
    }

    subscription.updatedAt = new Date();
    await this.repository.updateSubscription(subscription);

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(`subscription:${subscriptionId}`);
    }

    await this.auditLog.log({
      actor: { type: 'user', id: subscription.userId, name: 'User' },
      action: 'subscription.update',
      resource: { type: 'subscription', id: subscriptionId },
      outcome: 'success',
      details: params,
    });

    return subscription;
  }

  /**
   * PLAN MANAGEMENT
   */

  async createPlan(
    planData: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SubscriptionPlan> {
    const now = new Date();
    const plan: SubscriptionPlan = {
      ...planData,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.savePlan(plan);

    await this.auditLog.log({
      actor: { type: 'system', id: 'subscription-service', name: 'Subscription Service' },
      action: 'plan.create',
      resource: { type: 'subscription_plan', id: plan.id },
      outcome: 'success',
      details: { tier: plan.tier, monthlyPrice: plan.monthlyPrice },
    });

    return plan;
  }

  async getPlan(planId: string): Promise<SubscriptionPlan | null> {
    return this.repository.getPlan(planId);
  }

  async listPlans(tier?: SubscriptionTier): Promise<SubscriptionPlan[]> {
    return this.repository.listPlans(tier);
  }

  async updatePlan(
    planId: string,
    updates: Partial<Omit<SubscriptionPlan, 'id' | 'createdAt'>>
  ): Promise<SubscriptionPlan> {
    const plan = await this.repository.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const updated: SubscriptionPlan = {
      ...plan,
      ...updates,
      updatedAt: new Date(),
    };

    await this.repository.updatePlan(updated);
    return updated;
  }

  async deactivatePlan(planId: string): Promise<void> {
    await this.updatePlan(planId, { active: false });
  }

  /**
   * SUBSCRIPTION LIFECYCLE
   */

  async cancelSubscription(
    subscriptionId: string,
    options: CancelSubscriptionOptions
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const now = new Date();

    if (options.immediate) {
      subscription.status = SubscriptionStatus.CANCELED;
      subscription.canceledAt = now;
      subscription.endedAt = now;
      subscription.autoRenew = false;

      await this.recordEvent(subscriptionId, SubscriptionEventType.CANCELED, {
        previousStatus: subscription.status,
        newStatus: SubscriptionStatus.CANCELED,
      });

      await this.emitWebhookEvent(subscription, SubscriptionEventType.CANCELED);
    } else {
      subscription.cancelAtPeriodEnd = true;
      subscription.canceledAt = now;
      subscription.status = SubscriptionStatus.PENDING_CANCELLATION;

      await this.recordEvent(subscriptionId, SubscriptionEventType.CANCELLATION_SCHEDULED, {
        previousStatus: subscription.status,
        newStatus: SubscriptionStatus.PENDING_CANCELLATION,
      });

      await this.emitWebhookEvent(subscription, SubscriptionEventType.CANCELLATION_SCHEDULED);
    }

    subscription.updatedAt = now;
    await this.repository.updateSubscription(subscription);

    await this.auditLog.log({
      actor: { type: 'user', id: subscription.userId, name: 'User' },
      action: 'subscription.cancel',
      resource: { type: 'subscription', id: subscriptionId },
      outcome: 'success',
      details: { immediate: options.immediate, reason: options.reason },
    });

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(`subscription:${subscriptionId}`);
    }

    return subscription;
  }

  async undoCancellation(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status !== SubscriptionStatus.PENDING_CANCELLATION) {
      throw new Error('Subscription is not pending cancellation');
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.cancelAtPeriodEnd = false;
    subscription.canceledAt = undefined;
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);

    await this.recordEvent(subscriptionId, SubscriptionEventType.ACTIVATED, {
      previousStatus: SubscriptionStatus.PENDING_CANCELLATION,
      newStatus: SubscriptionStatus.ACTIVE,
    });

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(`subscription:${subscriptionId}`);
    }

    return subscription;
  }

  async pauseSubscription(
    subscriptionId: string,
    options?: PauseSubscriptionOptions
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.status = SubscriptionStatus.PAUSED;
    subscription.updatedAt = new Date();
    subscription.metadata = {
      ...subscription.metadata,
      pausedAt: new Date().toISOString(),
      pauseReason: options?.pauseReason,
      resumeAt: options?.resumeAt?.toISOString(),
    };

    await this.repository.updateSubscription(subscription);

    await this.recordEvent(subscriptionId, SubscriptionEventType.PAUSED, {
      newStatus: SubscriptionStatus.PAUSED,
    });

    await this.emitWebhookEvent(subscription, SubscriptionEventType.PAUSED);

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(`subscription:${subscriptionId}`);
    }

    return subscription;
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status !== SubscriptionStatus.PAUSED) {
      throw new Error('Subscription is not paused');
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);

    await this.recordEvent(subscriptionId, SubscriptionEventType.RESUMED, {
      previousStatus: SubscriptionStatus.PAUSED,
      newStatus: SubscriptionStatus.ACTIVE,
    });

    await this.emitWebhookEvent(subscription, SubscriptionEventType.RESUMED);

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(`subscription:${subscriptionId}`);
    }

    return subscription;
  }

  async expireSubscription(subscriptionId: string): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return;

    subscription.status = SubscriptionStatus.EXPIRED;
    subscription.endedAt = new Date();
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);

    await this.recordEvent(subscriptionId, SubscriptionEventType.EXPIRED, {
      newStatus: SubscriptionStatus.EXPIRED,
    });

    await this.emitWebhookEvent(subscription, SubscriptionEventType.EXPIRED);

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(`subscription:${subscriptionId}`);
    }
  }

  /**
   * TRIAL MANAGEMENT
   */

  async startTrial(subscriptionId: string, trialDays: number): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const now = new Date();
    const trialEndDate = new Date(now.getTime() + trialDays * 86400000);

    subscription.status = SubscriptionStatus.TRIAL;
    subscription.isTrialing = true;
    subscription.trialStartDate = now;
    subscription.trialEndDate = trialEndDate;
    subscription.nextBillingDate = trialEndDate;
    subscription.updatedAt = now;

    await this.repository.updateSubscription(subscription);

    await this.recordEvent(subscriptionId, SubscriptionEventType.TRIAL_STARTED, {
      newStatus: SubscriptionStatus.TRIAL,
    });

    return subscription;
  }

  async endTrial(subscriptionId: string, immediate: boolean): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (!subscription.isTrialing) {
      throw new Error('Subscription is not in trial');
    }

    if (immediate) {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.isTrialing = false;
      subscription.trialEndDate = new Date();
      subscription.nextBillingDate = this.calculatePeriodEnd(
        new Date(),
        subscription.billingInterval
      );
      subscription.updatedAt = new Date();

      await this.repository.updateSubscription(subscription);

      await this.recordEvent(subscriptionId, SubscriptionEventType.TRIAL_ENDED, {
        previousStatus: SubscriptionStatus.TRIAL,
        newStatus: SubscriptionStatus.ACTIVE,
      });

      // Create first invoice
      await this.createInvoice(subscriptionId, InvoiceType.INITIAL);
    }

    return subscription;
  }

  async isTrialing(subscriptionId: string): Promise<boolean> {
    const subscription = await this.getSubscription(subscriptionId);
    return subscription?.isTrialing || false;
  }

  async getTrialsEndingSoon(daysAhead: number): Promise<Subscription[]> {
    const allSubscriptions = await this.repository.querySubscriptions({
      status: SubscriptionStatus.TRIAL,
      limit: 10000,
    });
    const cutoffDate = new Date(Date.now() + daysAhead * 86400000);

    return allSubscriptions.filter((sub) => sub.trialEndDate && sub.trialEndDate <= cutoffDate);
  }

  /**
   * UPGRADE & DOWNGRADE
   */

  async upgradeSubscription(
    subscriptionId: string,
    newPlanId: string
  ): Promise<{
    subscription: Subscription;
    proration: ProrationResult;
    invoice?: SubscriptionInvoice;
  }> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const proration = await this.calculateProration(subscriptionId, newPlanId);

    if (!proration.isUpgrade) {
      throw new Error('This is not an upgrade. Use downgradeSubscription instead.');
    }

    let invoice: SubscriptionInvoice | undefined;

    // If there's a charge due, create and process invoice
    if (proration.amountDue > 0) {
      invoice = await this.createProrationInvoice(subscription, proration);

      // Process payment
      const paymentResult = await this.paymentService.processPayment({
        userId: subscription.userId,
        amount: proration.amountDue,
        currency: subscription.currency as any,
        description: `Upgrade to ${proration.newPlan.name}`,
        metadata: { subscriptionId, invoiceId: invoice.id },
      });

      if (paymentResult.success) {
        await this.markInvoicePaid(invoice.id, paymentResult.transactionId);
      } else {
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }
    }

    // Apply plan change
    subscription.planId = newPlanId;
    subscription.price =
      subscription.billingInterval === BillingInterval.YEARLY
        ? proration.newPlan.yearlyPrice
        : proration.newPlan.monthlyPrice;
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);

    await this.recordEvent(subscriptionId, SubscriptionEventType.UPGRADED, {
      previousPlanId: proration.currentPlan.id,
      newPlanId: proration.newPlan.id,
    });

    await this.emitWebhookEvent(subscription, SubscriptionEventType.UPGRADED);

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(`subscription:${subscriptionId}`);
    }

    return { subscription, proration, invoice };
  }

  async downgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
    immediate: boolean
  ): Promise<{
    subscription: Subscription;
    proration: ProrationResult;
  }> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const proration = await this.calculateProration(subscriptionId, newPlanId);

    if (proration.isUpgrade) {
      throw new Error('This is not a downgrade. Use upgradeSubscription instead.');
    }

    if (immediate) {
      // Apply immediately and credit balance
      subscription.planId = newPlanId;
      subscription.price =
        subscription.billingInterval === BillingInterval.YEARLY
          ? proration.newPlan.yearlyPrice
          : proration.newPlan.monthlyPrice;
      subscription.creditBalance += Math.abs(proration.amountDue);
      subscription.updatedAt = new Date();

      await this.recordEvent(subscriptionId, SubscriptionEventType.DOWNGRADED, {
        previousPlanId: proration.currentPlan.id,
        newPlanId: proration.newPlan.id,
      });
    } else {
      // Schedule for end of period
      subscription.pendingPlanChange = newPlanId;
      subscription.pendingPlanChangeDate = subscription.currentPeriodEnd;
      subscription.updatedAt = new Date();

      await this.recordEvent(subscriptionId, SubscriptionEventType.DOWNGRADE_SCHEDULED, {
        previousPlanId: proration.currentPlan.id,
        newPlanId: proration.newPlan.id,
      });
    }

    await this.repository.updateSubscription(subscription);

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(`subscription:${subscriptionId}`);
    }

    return { subscription, proration };
  }

  async calculateProration(subscriptionId: string, newPlanId: string): Promise<ProrationResult> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const currentPlan = await this.repository.getPlan(subscription.planId);
    const newPlan = await this.repository.getPlan(newPlanId);

    if (!currentPlan || !newPlan) {
      throw new Error('Plan not found');
    }

    const now = new Date();
    const daysRemaining = Math.ceil(
      (subscription.currentPeriodEnd.getTime() - now.getTime()) / 86400000
    );
    const totalDays = Math.ceil(
      (subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime()) /
        86400000
    );

    // Calculate unused credit
    const dailyRate = subscription.price / totalDays;
    const unusedCredit = dailyRate * daysRemaining;

    // Calculate new plan cost (prorated)
    const newDailyRate =
      (subscription.billingInterval === BillingInterval.YEARLY
        ? newPlan.yearlyPrice
        : newPlan.monthlyPrice) / totalDays;
    const newPlanCost = newDailyRate * daysRemaining;

    // Net amount due (positive = charge, negative = credit)
    const amountDue = newPlanCost - unusedCredit;

    return {
      currentPlan,
      newPlan,
      daysRemaining,
      unusedCredit,
      newPlanCost,
      amountDue,
      isUpgrade: newPlanCost > unusedCredit,
      effectiveDate: now,
    };
  }

  async applyPendingPlanChange(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription || !subscription.pendingPlanChange) {
      throw new Error('No pending plan change');
    }

    const newPlan = await this.repository.getPlan(subscription.pendingPlanChange);
    if (!newPlan) {
      throw new Error('Pending plan not found');
    }

    subscription.planId = subscription.pendingPlanChange;
    subscription.price =
      subscription.billingInterval === BillingInterval.YEARLY
        ? newPlan.yearlyPrice
        : newPlan.monthlyPrice;
    subscription.pendingPlanChange = undefined;
    subscription.pendingPlanChangeDate = undefined;
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);

    await this.recordEvent(subscriptionId, SubscriptionEventType.PLAN_CHANGED, {
      newPlanId: newPlan.id,
    });

    return subscription;
  }

  /**
   * RENEWAL & BILLING
   */

  async renewSubscription(subscriptionId: string): Promise<RenewalResult> {
    const startTime = performance.now();

    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        return {
          subscriptionId,
          success: false,
          error: 'Subscription not found',
          nextBillingDate: new Date(),
        };
      }

      // Create renewal invoice
      const invoice = await this.createInvoice(subscriptionId, InvoiceType.RENEWAL);

      // Process payment
      const paymentResult = await this.paymentService.processPayment({
        userId: subscription.userId,
        amount: invoice.totalAmount,
        currency: subscription.currency as any,
        description: `Subscription renewal`,
        metadata: { subscriptionId, invoiceId: invoice.id },
      });

      if (paymentResult.success) {
        // Mark invoice paid
        await this.markInvoicePaid(invoice.id, paymentResult.transactionId);

        // Update subscription
        subscription.lastPaymentId = paymentResult.transactionId;
        subscription.lastPaymentDate = new Date();
        subscription.currentPeriodStart = subscription.currentPeriodEnd;
        subscription.currentPeriodEnd = this.calculatePeriodEnd(
          subscription.currentPeriodEnd,
          subscription.billingInterval
        );
        subscription.nextBillingDate = subscription.currentPeriodEnd;
        subscription.retryCount = 0;
        subscription.updatedAt = new Date();

        await this.repository.updateSubscription(subscription);

        await this.recordEvent(subscriptionId, SubscriptionEventType.RENEWED);
        await this.emitWebhookEvent(subscription, SubscriptionEventType.RENEWED);

        this.metrics.totalRenewals++;
        this.updateMetrics(performance.now() - startTime);

        return {
          subscriptionId,
          success: true,
          invoiceId: invoice.id,
          paymentTransactionId: paymentResult.transactionId,
          nextBillingDate: subscription.nextBillingDate,
        };
      } else {
        // Payment failed - update status and schedule retry
        subscription.status = SubscriptionStatus.PAST_DUE;
        subscription.retryCount++;
        subscription.updatedAt = new Date();

        await this.repository.updateSubscription(subscription);

        await this.recordEvent(subscriptionId, SubscriptionEventType.PAYMENT_FAILED);
        await this.emitWebhookEvent(subscription, SubscriptionEventType.PAYMENT_FAILED);

        // Schedule retry
        const retryDate = this.calculateRetryDate(subscription.retryCount);
        await this.schedulePaymentRetry(subscriptionId, retryDate);

        return {
          subscriptionId,
          success: false,
          error: paymentResult.error,
          nextBillingDate: subscription.nextBillingDate,
          retryScheduled: retryDate,
        };
      }
    } catch (error) {
      this.logger.error('Renewal failed', error);
      return {
        subscriptionId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        nextBillingDate: new Date(),
      };
    }
  }

  async processDueRenewals(dueDate?: Date): Promise<BulkRenewalResult> {
    const targetDate = dueDate || new Date();

    // Get all subscriptions due for renewal
    const dueSubscriptions = await this.repository.querySubscriptions({
      status: SubscriptionStatus.ACTIVE,
      limit: 10000,
    });

    const subscriptionsToBill = dueSubscriptions.filter(
      (sub) => sub.autoRenew && sub.nextBillingDate <= targetDate
    );

    const results: RenewalResult[] = [];
    const errors: Array<{ subscriptionId: string; error: string }> = [];

    for (const subscription of subscriptionsToBill) {
      try {
        const result = await this.renewSubscription(subscription.id);
        results.push(result);

        if (!result.success && result.error) {
          errors.push({ subscriptionId: subscription.id, error: result.error });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ subscriptionId: subscription.id, error: errorMsg });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      totalProcessed: results.length,
      successful,
      failed,
      results,
      errors,
    };
  }

  async retryFailedPayment(subscriptionId: string): Promise<RenewalResult> {
    return this.renewSubscription(subscriptionId);
  }

  async updatePaymentMethod(
    subscriptionId: string,
    paymentMethodId: string
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.metadata = {
      ...subscription.metadata,
      paymentMethodId,
    };
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);

    await this.recordEvent(subscriptionId, SubscriptionEventType.PAYMENT_METHOD_UPDATED);

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(`subscription:${subscriptionId}`);
    }

    return subscription;
  }

  async getNextBillingDate(subscriptionId: string): Promise<Date> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    return subscription.nextBillingDate;
  }

  async updateBillingInterval(
    subscriptionId: string,
    interval: BillingInterval
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const plan = await this.repository.getPlan(subscription.planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    subscription.billingInterval = interval;
    subscription.price = interval === BillingInterval.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;
    subscription.nextBillingDate = this.calculatePeriodEnd(subscription.currentPeriodEnd, interval);
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);

    return subscription;
  }

  /**
   * INVOICING
   */

  async createInvoice(subscriptionId: string, invoiceType: string): Promise<SubscriptionInvoice> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const plan = await this.repository.getPlan(subscription.planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const now = new Date();
    const lineItems: InvoiceLineItem[] = [
      {
        description: `${plan.name} - ${subscription.billingInterval}`,
        quantity: 1,
        unitPrice: subscription.price,
        amount: subscription.price,
        period: {
          start: subscription.currentPeriodStart,
          end: subscription.currentPeriodEnd,
        },
      },
    ];

    // Add usage charges if applicable
    const usageCharges = await this.calculateUsageCharges(subscriptionId);
    if (usageCharges > 0) {
      lineItems.push({
        description: 'Usage charges',
        quantity: 1,
        unitPrice: usageCharges,
        amount: usageCharges,
      });
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = 0; // Tax calculation would go here
    const discountAmount =
      subscription.creditBalance > 0 ? Math.min(subscription.creditBalance, subtotal) : 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoice: SubscriptionInvoice = {
      id: randomUUID(),
      subscriptionId,
      invoiceType: invoiceType as InvoiceType,
      amount: subtotal,
      currency: subscription.currency,
      taxAmount,
      discountAmount,
      totalAmount,
      status: InvoiceStatus.PENDING,
      dueDate: subscription.nextBillingDate,
      lineItems,
      createdAt: now,
    };

    await this.repository.saveInvoice(invoice);

    // Apply credit if used
    if (discountAmount > 0) {
      subscription.creditBalance -= discountAmount;
      await this.repository.updateSubscription(subscription);
    }

    return invoice;
  }

  async getSubscriptionInvoices(
    subscriptionId: string,
    limit?: number
  ): Promise<SubscriptionInvoice[]> {
    return this.repository.listSubscriptionInvoices(subscriptionId, limit);
  }

  async getInvoice(invoiceId: string): Promise<SubscriptionInvoice | null> {
    return this.repository.getInvoice(invoiceId);
  }

  async markInvoicePaid(invoiceId: string, paymentTransactionId: string): Promise<void> {
    const invoice = await this.repository.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    invoice.paymentTransactionId = paymentTransactionId;

    await this.repository.updateInvoice(invoice);
  }

  /**
   * USAGE-BASED BILLING
   */

  async recordUsage(
    subscriptionId: string,
    metricName: string,
    quantity: number,
    timestamp?: Date
  ): Promise<void> {
    let usage = await this.repository.getCurrentUsage(subscriptionId);

    if (!usage) {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) return;

      usage = {
        subscriptionId,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        metrics: {},
        totalCost: 0,
        currency: subscription.currency,
      };
    }

    // Update or create metric
    if (!usage.metrics[metricName]) {
      usage.metrics[metricName] = {
        name: metricName,
        quantity: 0,
        unit: 'unit',
        unitPrice: 0,
        totalCost: 0,
        limitExceeded: false,
      };
    }

    usage.metrics[metricName].quantity += quantity;
    usage.metrics[metricName].totalCost =
      usage.metrics[metricName].quantity * usage.metrics[metricName].unitPrice;

    usage.totalCost = Object.values(usage.metrics).reduce((sum, m) => sum + m.totalCost, 0);

    await this.repository.saveUsage(usage);
  }

  async getCurrentUsage(subscriptionId: string): Promise<SubscriptionUsage | null> {
    return this.repository.getCurrentUsage(subscriptionId);
  }

  async calculateUsageCharges(subscriptionId: string): Promise<number> {
    const usage = await this.repository.getCurrentUsage(subscriptionId);
    return usage?.totalCost || 0;
  }

  /**
   * GRACE PERIOD & RETRY
   */

  async startGracePeriod(subscriptionId: string, days: number): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.status = SubscriptionStatus.GRACE_PERIOD;
    subscription.gracePeriodDays = days;
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);

    await this.recordEvent(subscriptionId, SubscriptionEventType.GRACE_PERIOD_STARTED);

    return subscription;
  }

  async getSubscriptionsInGracePeriod(): Promise<Subscription[]> {
    return this.repository.querySubscriptions({
      status: SubscriptionStatus.GRACE_PERIOD,
      limit: 10000,
    });
  }

  async schedulePaymentRetry(subscriptionId: string, retryDate: Date): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return;

    subscription.nextRetryDate = retryDate;
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);
  }

  async getRetrySchedule(subscriptionId: string): Promise<Date[]> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return [];

    const schedule: Date[] = [];
    for (let i = 1; i <= subscription.maxRetries; i++) {
      schedule.push(this.calculateRetryDate(i));
    }
    return schedule;
  }

  /**
   * ANALYTICS & REPORTING
   */

  async getAnalytics(
    periodType: 'day' | 'week' | 'month' | 'year',
    startDate: Date,
    endDate: Date
  ): Promise<SubscriptionAnalytics[]> {
    // This would typically query aggregated analytics data
    // For now, return a single period
    const analytics: SubscriptionAnalytics = {
      periodDate: new Date(),
      periodType,
      activeSubscriptions: await this.countSubscriptions({ status: SubscriptionStatus.ACTIVE }),
      newSubscriptions: 0,
      canceledSubscriptions: 0,
      churnedSubscriptions: 0,
      trialingSubscriptions: await this.countSubscriptions({ status: SubscriptionStatus.TRIAL }),
      mrr: await this.calculateMRR(),
      arr: await this.calculateARR(),
      newMrr: 0,
      expansionMrr: 0,
      contractionMrr: 0,
      churnedMrr: 0,
      totalRevenue: 0,
      averageRevenuePerUser: 0,
      averageLifetimeValue: await this.calculateAverageLTV(),
      trialConversionRate: 0,
      churnRate: await this.calculateChurnRate(),
      retentionRate: await this.getRetentionRate(),
      tierBreakdown: {
        [SubscriptionTier.FREE]: { count: 0, mrr: 0, percentage: 0 },
        [SubscriptionTier.CREATOR]: { count: 0, mrr: 0, percentage: 0 },
        [SubscriptionTier.PRO]: { count: 0, mrr: 0, percentage: 0 },
        [SubscriptionTier.ENTERPRISE]: { count: 0, mrr: 0, percentage: 0 },
      },
      calculatedAt: new Date(),
    };

    return [analytics];
  }

  async getStatistics(): Promise<SubscriptionStatistics> {
    return {
      totalSubscriptions: this.metrics.totalSubscriptions,
      activeSubscriptions: await this.countSubscriptions({ status: SubscriptionStatus.ACTIVE }),
      trialingSubscriptions: await this.countSubscriptions({ status: SubscriptionStatus.TRIAL }),
      churnedThisMonth: 0,
      mrr: await this.calculateMRR(),
      arr: await this.calculateARR(),
      averageLTV: await this.calculateAverageLTV(),
      churnRate: await this.calculateChurnRate(),
      retentionRate: await this.getRetentionRate(),
    };
  }

  async calculateMRR(): Promise<number> {
    const activeSubscriptions = await this.repository.querySubscriptions({
      status: SubscriptionStatus.ACTIVE,
      limit: 100000,
    });

    return activeSubscriptions.reduce((total, sub) => {
      const monthlyRevenue =
        sub.billingInterval === BillingInterval.YEARLY ? sub.price / 12 : sub.price;
      return total + monthlyRevenue;
    }, 0);
  }

  async calculateARR(): Promise<number> {
    const mrr = await this.calculateMRR();
    return mrr * 12;
  }

  async calculateChurnRate(periodDays = 30): Promise<number> {
    const periodStart = new Date(Date.now() - periodDays * 86400000);

    const startActive = await this.countSubscriptions({
      status: SubscriptionStatus.ACTIVE,
      endDate: periodStart,
    });

    const churned = await this.countSubscriptions({
      status: SubscriptionStatus.CANCELED,
      startDate: periodStart,
    });

    return startActive > 0 ? (churned / startActive) * 100 : 0;
  }

  async calculateAverageLTV(): Promise<number> {
    const mrr = await this.calculateMRR();
    const churnRate = await this.calculateChurnRate();

    if (churnRate === 0) return mrr * 36; // 3 years if no churn

    const avgLifetimeMonths = 1 / (churnRate / 100);
    return mrr * avgLifetimeMonths;
  }

  async getRetentionRate(periodDays = 30): Promise<number> {
    const churnRate = await this.calculateChurnRate(periodDays);
    return 100 - churnRate;
  }

  /**
   * EVENTS & WEBHOOKS
   */

  subscribeToEvents(
    eventType: SubscriptionEventType,
    callback: (event: SubscriptionWebhookEvent) => void | Promise<void>
  ): string {
    const id = randomUUID();
    this.eventSubscriptions.set(id, callback);
    return id;
  }

  unsubscribeFromEvents(subscriptionId: string): void {
    this.eventSubscriptions.delete(subscriptionId);
  }

  async getEventHistory(subscriptionId: string, limit?: number): Promise<SubscriptionEvent[]> {
    return this.repository.getEventHistory(subscriptionId, limit);
  }

  /**
   * CURRENCY SUPPORT
   */

  async getSubscriptionInCurrency(
    subscriptionId: string,
    currency: Currency
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.currency === currency) {
      return subscription;
    }

    // Convert price to target currency
    const converted = await this.currencyService.convert({
      amount: subscription.price,
      from: subscription.currency,
      to: currency,
    });

    return {
      ...subscription,
      price: converted.convertedAmount,
      currency,
    };
  }

  async updateCurrency(subscriptionId: string, newCurrency: Currency): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    // Convert current price to new currency
    const converted = await this.currencyService.convert({
      amount: subscription.price,
      from: subscription.currency,
      to: newCurrency,
    });

    subscription.price = converted.convertedAmount;
    subscription.currency = newCurrency;
    subscription.updatedAt = new Date();

    await this.repository.updateSubscription(subscription);

    return subscription;
  }

  /**
   * HEALTH & MAINTENANCE
   */

  async healthCheck(): Promise<boolean> {
    try {
      // Check repository
      await this.repository.querySubscriptions({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async getMetrics(): Promise<{
    uptime: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    mrr: number;
    arr: number;
    churnRate: number;
    averageProcessingTime: number;
  }> {
    return {
      uptime: Date.now() - this.metrics.uptime,
      totalSubscriptions: this.metrics.totalSubscriptions,
      activeSubscriptions: await this.countSubscriptions({ status: SubscriptionStatus.ACTIVE }),
      mrr: await this.calculateMRR(),
      arr: await this.calculateARR(),
      churnRate: await this.calculateChurnRate(),
      averageProcessingTime: this.metrics.averageProcessingTime,
    };
  }

  async cleanupExpiredSubscriptions(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 86400000);

    const expiredSubscriptions = await this.repository.querySubscriptions({
      status: SubscriptionStatus.EXPIRED,
      endDate: cutoffDate,
      limit: 10000,
    });

    // In production, would delete or archive these subscriptions
    return expiredSubscriptions.length;
  }

  async dispose(): Promise<void> {
    this.eventSubscriptions.clear();
    this.logger.info('SubscriptionService disposed');
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private calculatePeriodEnd(startDate: Date, interval: BillingInterval): Date {
    const end = new Date(startDate);

    switch (interval) {
      case BillingInterval.MONTHLY:
        end.setMonth(end.getMonth() + 1);
        break;
      case BillingInterval.QUARTERLY:
        end.setMonth(end.getMonth() + 3);
        break;
      case BillingInterval.YEARLY:
        end.setFullYear(end.getFullYear() + 1);
        break;
      default:
        end.setMonth(end.getMonth() + 1);
    }

    return end;
  }

  private calculateRetryDate(retryCount: number): Date {
    const retrySchedule = [1, 3, 7]; // Days
    const daysToAdd = retrySchedule[Math.min(retryCount - 1, retrySchedule.length - 1)];
    return new Date(Date.now() + daysToAdd * 86400000);
  }

  private async createProrationInvoice(
    subscription: Subscription,
    proration: ProrationResult
  ): Promise<SubscriptionInvoice> {
    const lineItems: InvoiceLineItem[] = [
      {
        description: `Remaining time credit: ${proration.currentPlan.name}`,
        quantity: 1,
        unitPrice: -proration.unusedCredit,
        amount: -proration.unusedCredit,
      },
      {
        description: `Upgrade to ${proration.newPlan.name} (${proration.daysRemaining} days)`,
        quantity: 1,
        unitPrice: proration.newPlanCost,
        amount: proration.newPlanCost,
      },
    ];

    const invoice: SubscriptionInvoice = {
      id: randomUUID(),
      subscriptionId: subscription.id,
      invoiceType: InvoiceType.PRORATION,
      amount: proration.amountDue,
      currency: subscription.currency,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: proration.amountDue,
      status: InvoiceStatus.PENDING,
      dueDate: new Date(),
      lineItems,
      createdAt: new Date(),
    };

    await this.repository.saveInvoice(invoice);
    return invoice;
  }

  private async recordEvent(
    subscriptionId: string,
    eventType: SubscriptionEventType,
    data?: Partial<SubscriptionEvent>
  ): Promise<void> {
    const event: SubscriptionEvent = {
      id: randomUUID(),
      subscriptionId,
      eventType,
      ...data,
      occurredAt: new Date(),
    };

    await this.repository.saveEvent(event);
  }

  private async emitWebhookEvent(
    subscription: Subscription,
    eventType: SubscriptionEventType
  ): Promise<void> {
    const event: SubscriptionWebhookEvent = {
      id: randomUUID(),
      type: eventType,
      subscription,
      timestamp: new Date(),
    };

    // Emit to event bus
    await this.eventBus.emit(eventType, event);

    // Call registered callbacks
    for (const callback of this.eventSubscriptions.values()) {
      try {
        await callback(event);
      } catch (error) {
        this.logger.error('Webhook callback failed', error);
      }
    }
  }

  private updateMetrics(processingTime: number): void {
    const count = this.metrics.totalRenewals || 1;
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (count - 1) + processingTime) / count;
  }
}
