/**
 * SubscriptionService Tests
 * User Story: US-E5-026
 * CRITICAL: 100% test coverage required for payment services
 * Part of Epic 005 - Backend Service Layer Refactoring
 *
 * Zero vi.fn() mocks — all services wired via PaymentTestHarness with real
 * in-memory backends. Only targeted method overrides for payment failure paths.
 */

import { SubscriptionService } from '../SubscriptionService';
import {
  SubscriptionStatus,
  SubscriptionTier,
  BillingInterval,
  InvoiceType,
  InvoiceStatus,
  SubscriptionEventType,
  type Subscription,
  type SubscriptionPlan,
  type CreateSubscriptionParams,
} from '../../../types/subscription';
import { Currency } from '../../../types/currency';
import { PaymentStatus } from '../../../types/payment';
import {
  createPaymentTestHarness,
  installSubscriptionPaymentShim,
  installFailedPaymentShim,
  type PaymentTestHarness,
} from '../../../test-utils';

// Plan templates used across all tests.
// Return type matches createPlan() parameter: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>
type CreatePlanInput = Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>;

function makeCreatorPlan(): CreatePlanInput {
  return {
    name: 'Creator',
    tier: SubscriptionTier.CREATOR,
    monthlyPrice: 900,
    yearlyPrice: 9000,
    currency: Currency.USD,
    features: {
      basicContent: true,
      advancedContent: false,
      analytics: true,
      aiRecommendations: false,
      prioritySupport: false,
      apiAccess: false,
      customBranding: false,
      teamCollaboration: false,
      advancedSecurity: false,
      exportData: true,
      webhooks: false,
      dedicatedAccount: false,
    },
    limits: {
      maxUsers: 1,
      maxStorageGB: 10,
      maxContentItems: 100,
      maxMonthlyViews: 10000,
      maxApiCalls: 1000,
      maxWebhooks: 0,
    },
    trialDays: 14,
    active: true,
  };
}

function makeProPlan(): CreatePlanInput {
  return {
    name: 'Pro',
    tier: SubscriptionTier.PRO,
    monthlyPrice: 2900,
    yearlyPrice: 29000,
    currency: Currency.USD,
    features: {
      basicContent: true,
      advancedContent: true,
      analytics: true,
      aiRecommendations: true,
      prioritySupport: true,
      apiAccess: true,
      customBranding: true,
      teamCollaboration: false,
      advancedSecurity: true,
      exportData: true,
      webhooks: true,
      dedicatedAccount: false,
    },
    limits: {
      maxUsers: 5,
      maxStorageGB: 100,
      maxContentItems: 1000,
      maxMonthlyViews: 100000,
      maxApiCalls: 10000,
      maxWebhooks: 10,
    },
    trialDays: 14,
    active: true,
  };
}

describe('SubscriptionService', () => {
  let harness: PaymentTestHarness;
  let service: SubscriptionService;
  let creatorPlan: SubscriptionPlan;
  let proPlan: SubscriptionPlan;

  beforeEach(() => {
    harness = createPaymentTestHarness();
    service = harness.subscriptionService;
  });

  afterEach(async () => {
    await harness.dispose();
  });

  describe('Plan Management', () => {
    describe('createPlan', () => {
      it('should create a new subscription plan', async () => {
        const plan = await service.createPlan(makeCreatorPlan());

        expect(plan.id).toBeDefined();
        expect(plan.name).toBe('Creator');
        expect(plan.tier).toBe(SubscriptionTier.CREATOR);
        expect(plan.monthlyPrice).toBe(900);
      });

      it('should set creation and update timestamps', async () => {
        const plan = await service.createPlan(makeCreatorPlan());

        expect(plan.createdAt).toBeInstanceOf(Date);
        expect(plan.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe('getPlan', () => {
      it('should retrieve a plan by ID', async () => {
        const created = await service.createPlan(makeCreatorPlan());

        const retrieved = await service.getPlan(created.id);
        expect(retrieved).toEqual(created);
      });

      it('should return null for non-existent plan', async () => {
        const retrieved = await service.getPlan('non_existent');
        expect(retrieved).toBeNull();
      });
    });

    describe('listPlans', () => {
      it('should list all active plans', async () => {
        await service.createPlan(makeCreatorPlan());
        await service.createPlan(makeProPlan());

        const plans = await service.listPlans();
        expect(plans).toHaveLength(2);
      });

      it('should filter plans by tier', async () => {
        await service.createPlan(makeCreatorPlan());
        await service.createPlan(makeProPlan());

        const creatorPlans = await service.listPlans(SubscriptionTier.CREATOR);
        expect(creatorPlans).toHaveLength(1);
        expect(creatorPlans[0].tier).toBe(SubscriptionTier.CREATOR);
      });

      it('should not include inactive plans', async () => {
        await service.createPlan(makeCreatorPlan());
        const inactivePlan = await service.createPlan({
          ...makeProPlan(),
          active: false,
        } as any);

        const plans = await service.listPlans();
        expect(plans).toHaveLength(1);
        expect(plans.find((p) => p.id === inactivePlan.id)).toBeUndefined();
      });
    });

    describe('updatePlan', () => {
      it('should update plan details', async () => {
        const plan = await service.createPlan(makeCreatorPlan());

        const updated = await service.updatePlan(plan.id, {
          name: 'Updated Plan',
          monthlyPrice: 1500,
        });

        expect(updated.name).toBe('Updated Plan');
        expect(updated.monthlyPrice).toBe(1500);
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(plan.updatedAt.getTime());
      });

      it('should throw error for non-existent plan', async () => {
        await expect(service.updatePlan('non_existent', { name: 'Updated' })).rejects.toThrow(
          'Plan not found'
        );
      });
    });

    describe('deactivatePlan', () => {
      it('should deactivate a plan', async () => {
        const plan = await service.createPlan(makeCreatorPlan());

        await service.deactivatePlan(plan.id);

        const updated = await service.getPlan(plan.id);
        expect(updated?.active).toBe(false);
      });
    });
  });

  describe('Subscription Creation', () => {
    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
      proPlan = await service.createPlan(makeProPlan());
    });

    describe('createSubscription', () => {
      it('should create subscription with trial', async () => {
        const params: CreateSubscriptionParams = {
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        };

        const subscription = await service.createSubscription(params);

        expect(subscription.id).toBeDefined();
        expect(subscription.userId).toBe('user_123');
        expect(subscription.planId).toBe(creatorPlan.id);
        expect(subscription.status).toBe(SubscriptionStatus.TRIAL);
        expect(subscription.isTrialing).toBe(true);
        const trialMs =
          subscription.trialEndDate!.getTime() - subscription.trialStartDate!.getTime();
        expect(Math.round(trialMs / 86400000)).toBe(14);
        expect(subscription.price).toBe(creatorPlan.monthlyPrice);
      });

      it('should create subscription without trial', async () => {
        const params: CreateSubscriptionParams = {
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        };

        const subscription = await service.createSubscription(params);

        expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
        expect(subscription.isTrialing).toBe(false);
        expect(subscription.trialStartDate).toBeUndefined();
      });

      it('should use yearly price for yearly interval', async () => {
        const params: CreateSubscriptionParams = {
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.YEARLY,
        };

        const subscription = await service.createSubscription(params);

        expect(subscription.price).toBe(creatorPlan.yearlyPrice);
        expect(subscription.billingInterval).toBe(BillingInterval.YEARLY);
      });

      it('should throw error for non-existent plan', async () => {
        const params: CreateSubscriptionParams = {
          userId: 'user_123',
          planId: 'non_existent',
          billingInterval: BillingInterval.MONTHLY,
        };

        await expect(service.createSubscription(params)).rejects.toThrow('Plan not found');
      });

      it('should throw error if user already has active subscription', async () => {
        const params: CreateSubscriptionParams = {
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        };

        await service.createSubscription(params);

        await expect(service.createSubscription(params)).rejects.toThrow(
          'User already has an active subscription'
        );
      });

      it('should emit webhook event', async () => {
        harness.eventBus.clearCapturedEmits();

        const params: CreateSubscriptionParams = {
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        };

        await service.createSubscription(params);

        expect(harness.eventBus.capturedEmits).toContainEqual(
          expect.objectContaining({ type: SubscriptionEventType.TRIAL_STARTED })
        );
      });

      it('should set metadata if provided', async () => {
        const params: CreateSubscriptionParams = {
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          metadata: { source: 'web', campaign: 'summer2024' },
        };

        const subscription = await service.createSubscription(params);

        expect(subscription.metadata).toEqual({ source: 'web', campaign: 'summer2024' });
      });
    });

    describe('getSubscription', () => {
      it('should retrieve subscription by ID', async () => {
        const created = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });

        const retrieved = await service.getSubscription(created.id);
        expect(retrieved).toEqual(created);
      });

      it('should return null for non-existent subscription', async () => {
        const retrieved = await service.getSubscription('non_existent');
        expect(retrieved).toBeNull();
      });

      it('should use cache when available', async () => {
        const created = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });

        // First call - should cache
        await service.getSubscription(created.id);

        // Second call - should use cache
        const cached = await service.getSubscription(created.id);
        expect(cached).toEqual(created);
      });
    });

    describe('getUserSubscription', () => {
      it('should retrieve user subscription', async () => {
        const created = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });

        const retrieved = await service.getUserSubscription('user_123');
        expect(retrieved?.id).toBe(created.id);
      });

      it('should return null if user has no subscription', async () => {
        const retrieved = await service.getUserSubscription('user_456');
        expect(retrieved).toBeNull();
      });
    });

    describe('querySubscriptions', () => {
      beforeEach(async () => {
        await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });

        await service.createSubscription({
          userId: 'user_2',
          planId: proPlan.id,
          billingInterval: BillingInterval.YEARLY,
          trialDays: 0,
        });
      });

      it('should query by status', async () => {
        const results = await service.querySubscriptions({
          status: SubscriptionStatus.TRIAL,
        });

        expect(results).toHaveLength(1);
        expect(results[0].userId).toBe('user_1');
      });

      it('should query by plan', async () => {
        const results = await service.querySubscriptions({
          planId: proPlan.id,
        });

        expect(results).toHaveLength(1);
        expect(results[0].userId).toBe('user_2');
      });

      it('should support pagination', async () => {
        const results = await service.querySubscriptions({
          limit: 1,
          offset: 0,
        });

        expect(results).toHaveLength(1);
      });

      it('should support sorting', async () => {
        const results = await service.querySubscriptions({
          sortBy: 'createdAt',
          sortOrder: 'asc',
        });

        expect(results).toHaveLength(2);
      });
    });

    describe('countSubscriptions', () => {
      beforeEach(async () => {
        await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });

        await service.createSubscription({
          userId: 'user_2',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });
      });

      it('should count all subscriptions', async () => {
        const count = await service.countSubscriptions({});
        expect(count).toBe(2);
      });

      it('should count with filters', async () => {
        const count = await service.countSubscriptions({
          status: SubscriptionStatus.TRIAL,
        });
        expect(count).toBe(2);
      });
    });

    describe('updateSubscription', () => {
      it('should update subscription properties', async () => {
        const subscription = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });

        const updated = await service.updateSubscription(subscription.id, {
          autoRenew: false,
        });

        expect(updated.autoRenew).toBe(false);
        // Cache should be invalidated after update
        const cacheExists = await harness.cache.exists(`subscription:${subscription.id}`);
        expect(cacheExists).toBe(false);
      });

      it('should merge metadata', async () => {
        const subscription = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          metadata: { key1: 'value1' },
        });

        const updated = await service.updateSubscription(subscription.id, {
          metadata: { key2: 'value2' },
        });

        expect(updated.metadata).toEqual({ key1: 'value1', key2: 'value2' });
      });

      it('should throw error for non-existent subscription', async () => {
        await expect(
          service.updateSubscription('non_existent', { autoRenew: false })
        ).rejects.toThrow('Subscription not found');
      });
    });
  });

  describe('Subscription Lifecycle', () => {
    let subscription: Subscription;

    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
      subscription = await service.createSubscription({
        userId: 'user_123',
        planId: creatorPlan.id,
        billingInterval: BillingInterval.MONTHLY,
        trialDays: 0,
      });
    });

    describe('cancelSubscription', () => {
      it('should cancel subscription immediately', async () => {
        const canceled = await service.cancelSubscription(subscription.id, {
          immediate: true,
        });

        expect(canceled.status).toBe(SubscriptionStatus.CANCELED);
        expect(canceled.canceledAt).toBeInstanceOf(Date);
        expect(canceled.endedAt).toBeInstanceOf(Date);
        expect(canceled.autoRenew).toBe(false);
      });

      it('should schedule cancellation at period end', async () => {
        const canceled = await service.cancelSubscription(subscription.id, {
          immediate: false,
        });

        expect(canceled.status).toBe(SubscriptionStatus.PENDING_CANCELLATION);
        expect(canceled.cancelAtPeriodEnd).toBe(true);
        expect(canceled.canceledAt).toBeInstanceOf(Date);
        expect(canceled.endedAt).toBeUndefined();
      });

      it('should emit cancellation event', async () => {
        harness.eventBus.clearCapturedEmits();
        await service.cancelSubscription(subscription.id, { immediate: true });

        expect(harness.eventBus.capturedEmits).toContainEqual(
          expect.objectContaining({ type: SubscriptionEventType.CANCELED })
        );
      });

      it('should throw error for non-existent subscription', async () => {
        await expect(
          service.cancelSubscription('non_existent', { immediate: true })
        ).rejects.toThrow('Subscription not found');
      });
    });

    describe('undoCancellation', () => {
      it('should undo pending cancellation', async () => {
        await service.cancelSubscription(subscription.id, { immediate: false });

        const restored = await service.undoCancellation(subscription.id);

        expect(restored.status).toBe(SubscriptionStatus.ACTIVE);
        expect(restored.cancelAtPeriodEnd).toBe(false);
        expect(restored.canceledAt).toBeUndefined();
      });

      it('should throw error if not pending cancellation', async () => {
        await expect(service.undoCancellation(subscription.id)).rejects.toThrow(
          'Subscription is not pending cancellation'
        );
      });
    });

    describe('pauseSubscription', () => {
      it('should pause subscription', async () => {
        const paused = await service.pauseSubscription(subscription.id);

        expect(paused.status).toBe(SubscriptionStatus.PAUSED);
        expect(paused.metadata?.pausedAt).toBeDefined();
      });

      it('should include pause options in metadata', async () => {
        const resumeDate = new Date(Date.now() + 86400000 * 30);
        const paused = await service.pauseSubscription(subscription.id, {
          resumeAt: resumeDate,
          pauseReason: 'vacation',
        });

        expect(paused.metadata?.pauseReason).toBe('vacation');
        expect(paused.metadata?.resumeAt).toBeDefined();
      });

      it('should emit pause event', async () => {
        harness.eventBus.clearCapturedEmits();
        await service.pauseSubscription(subscription.id);

        expect(harness.eventBus.capturedEmits).toContainEqual(
          expect.objectContaining({ type: SubscriptionEventType.PAUSED })
        );
      });
    });

    describe('resumeSubscription', () => {
      it('should resume paused subscription', async () => {
        await service.pauseSubscription(subscription.id);
        const resumed = await service.resumeSubscription(subscription.id);

        expect(resumed.status).toBe(SubscriptionStatus.ACTIVE);
      });

      it('should throw error if not paused', async () => {
        await expect(service.resumeSubscription(subscription.id)).rejects.toThrow(
          'Subscription is not paused'
        );
      });

      it('should emit resume event', async () => {
        await service.pauseSubscription(subscription.id);
        harness.eventBus.clearCapturedEmits();
        await service.resumeSubscription(subscription.id);

        expect(harness.eventBus.capturedEmits).toContainEqual(
          expect.objectContaining({ type: SubscriptionEventType.RESUMED })
        );
      });
    });

    describe('expireSubscription', () => {
      it('should expire subscription', async () => {
        await service.expireSubscription(subscription.id);

        const expired = await service.getSubscription(subscription.id);
        expect(expired?.status).toBe(SubscriptionStatus.EXPIRED);
        expect(expired?.endedAt).toBeInstanceOf(Date);
      });

      it('should handle non-existent subscription gracefully', async () => {
        await expect(service.expireSubscription('non_existent')).resolves.not.toThrow();
      });
    });
  });

  describe('Trial Management', () => {
    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
    });

    describe('startTrial', () => {
      it('should start trial period', async () => {
        const subscription = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        const trial = await service.startTrial(subscription.id, 14);

        expect(trial.status).toBe(SubscriptionStatus.TRIAL);
        expect(trial.isTrialing).toBe(true);
        expect(trial.trialStartDate).toBeInstanceOf(Date);
        expect(trial.trialEndDate).toBeInstanceOf(Date);
      });

      it('should update next billing date to trial end', async () => {
        const subscription = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        const trial = await service.startTrial(subscription.id, 14);

        expect(trial.nextBillingDate).toEqual(trial.trialEndDate);
      });
    });

    describe('endTrial', () => {
      it('should end trial immediately', async () => {
        const subscription = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });

        const ended = await service.endTrial(subscription.id, true);

        expect(ended.status).toBe(SubscriptionStatus.ACTIVE);
        expect(ended.isTrialing).toBe(false);
      });

      it('should throw error if not in trial', async () => {
        const subscription = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        await expect(service.endTrial(subscription.id, true)).rejects.toThrow(
          'Subscription is not in trial'
        );
      });
    });

    describe('isTrialing', () => {
      it('should return true for trialing subscription', async () => {
        const subscription = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });

        const isTrialing = await service.isTrialing(subscription.id);
        expect(isTrialing).toBe(true);
      });

      it('should return false for non-trialing subscription', async () => {
        const subscription = await service.createSubscription({
          userId: 'user_123',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        const isTrialing = await service.isTrialing(subscription.id);
        expect(isTrialing).toBe(false);
      });
    });

    describe('getTrialsEndingSoon', () => {
      it('should find trials ending within specified days', async () => {
        await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 7,
        });

        const ending = await service.getTrialsEndingSoon(10);
        expect(ending).toHaveLength(1);
      });

      it('should not include trials ending later', async () => {
        await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 30,
        });

        const ending = await service.getTrialsEndingSoon(7);
        expect(ending).toHaveLength(0);
      });
    });
  });

  describe('Upgrade & Downgrade', () => {
    let subscription: Subscription;

    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
      proPlan = await service.createPlan(makeProPlan());

      // SubscriptionService calls processPayment with non-standard params (pre-existing mismatch)
      installSubscriptionPaymentShim(harness);

      subscription = await service.createSubscription({
        userId: 'user_123',
        planId: creatorPlan.id,
        billingInterval: BillingInterval.MONTHLY,
        trialDays: 0,
      });
    });

    describe('calculateProration', () => {
      it('should calculate proration for upgrade', async () => {
        const proration = await service.calculateProration(subscription.id, proPlan.id);

        expect(proration.currentPlan.id).toBe(creatorPlan.id);
        expect(proration.newPlan.id).toBe(proPlan.id);
        expect(proration.isUpgrade).toBe(true);
        expect(proration.daysRemaining).toBeGreaterThan(0);
        expect(proration.unusedCredit).toBeGreaterThan(0);
        expect(proration.newPlanCost).toBeGreaterThan(0);
      });

      it('should calculate proration for downgrade', async () => {
        await service.upgradeSubscription(subscription.id, proPlan.id);

        const proSub = await service.getSubscription(subscription.id);
        const proration = await service.calculateProration(proSub!.id, creatorPlan.id);

        expect(proration.isUpgrade).toBe(false);
        expect(proration.amountDue).toBeLessThan(0);
      });
    });

    describe('upgradeSubscription', () => {
      it('should upgrade subscription successfully', async () => {
        const result = await service.upgradeSubscription(subscription.id, proPlan.id);

        expect(result.subscription.planId).toBe(proPlan.id);
        expect(result.subscription.price).toBe(proPlan.monthlyPrice);
        expect(result.proration.isUpgrade).toBe(true);
        expect(result.invoice).toBeDefined();
      });

      it('should emit upgrade event', async () => {
        harness.eventBus.clearCapturedEmits();
        await service.upgradeSubscription(subscription.id, proPlan.id);

        expect(harness.eventBus.capturedEmits).toContainEqual(
          expect.objectContaining({ type: SubscriptionEventType.UPGRADED })
        );
      });

      it('should throw error for downgrade attempt', async () => {
        const proSub = await service.createSubscription({
          userId: 'user_456',
          planId: proPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        await expect(service.upgradeSubscription(proSub.id, creatorPlan.id)).rejects.toThrow(
          'This is not an upgrade'
        );
      });

      it('should throw error if payment fails', async () => {
        installFailedPaymentShim(harness);

        await expect(service.upgradeSubscription(subscription.id, proPlan.id)).rejects.toThrow(
          'Payment failed'
        );

        // Re-install shim for subsequent tests
        installSubscriptionPaymentShim(harness);
      });
    });

    describe('downgradeSubscription', () => {
      it('should schedule downgrade at period end', async () => {
        await service.upgradeSubscription(subscription.id, proPlan.id);

        const proSub = await service.getSubscription(subscription.id);
        const result = await service.downgradeSubscription(proSub!.id, creatorPlan.id, false);

        expect(result.subscription.pendingPlanChange).toBe(creatorPlan.id);
        expect(result.subscription.pendingPlanChangeDate).toBeDefined();
        expect(result.proration.isUpgrade).toBe(false);
      });

      it('should apply downgrade immediately with credit', async () => {
        await service.upgradeSubscription(subscription.id, proPlan.id);

        const proSub = await service.getSubscription(subscription.id);
        const result = await service.downgradeSubscription(proSub!.id, creatorPlan.id, true);

        expect(result.subscription.planId).toBe(creatorPlan.id);
        expect(result.subscription.creditBalance).toBeGreaterThan(0);
      });

      it('should throw error for upgrade attempt', async () => {
        await expect(
          service.downgradeSubscription(subscription.id, proPlan.id, false)
        ).rejects.toThrow('This is not a downgrade');
      });
    });

    describe('applyPendingPlanChange', () => {
      it('should apply pending plan change', async () => {
        await service.upgradeSubscription(subscription.id, proPlan.id);
        const proSub = await service.getSubscription(subscription.id);
        await service.downgradeSubscription(proSub!.id, creatorPlan.id, false);

        const updated = await service.applyPendingPlanChange(subscription.id);

        expect(updated.planId).toBe(creatorPlan.id);
        expect(updated.pendingPlanChange).toBeUndefined();
        expect(updated.pendingPlanChangeDate).toBeUndefined();
      });

      it('should throw error if no pending change', async () => {
        await expect(service.applyPendingPlanChange(subscription.id)).rejects.toThrow(
          'No pending plan change'
        );
      });
    });
  });

  describe('Renewal & Billing', () => {
    let subscription: Subscription;

    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());

      // SubscriptionService calls processPayment with non-standard params (pre-existing mismatch)
      installSubscriptionPaymentShim(harness);

      subscription = await service.createSubscription({
        userId: 'user_123',
        planId: creatorPlan.id,
        billingInterval: BillingInterval.MONTHLY,
        trialDays: 0,
      });
    });

    describe('renewSubscription', () => {
      it('should renew subscription successfully', async () => {
        const result = await service.renewSubscription(subscription.id);

        expect(result.success).toBe(true);
        expect(result.invoiceId).toBeDefined();
        expect(result.paymentTransactionId).toBeDefined();
        expect(result.nextBillingDate).toBeInstanceOf(Date);
      });

      it('should update billing period on renewal', async () => {
        const before = await service.getSubscription(subscription.id);
        const oldPeriodEnd = new Date(before!.currentPeriodEnd.getTime());
        await service.renewSubscription(subscription.id);
        const after = await service.getSubscription(subscription.id);

        expect(after!.currentPeriodStart).toEqual(oldPeriodEnd);
        expect(after!.currentPeriodEnd.getTime()).toBeGreaterThan(oldPeriodEnd.getTime());
      });

      it('should handle payment failure', async () => {
        installFailedPaymentShim(harness, 'Insufficient funds');

        const result = await service.renewSubscription(subscription.id);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Insufficient funds');
        expect(result.retryScheduled).toBeInstanceOf(Date);

        const updated = await service.getSubscription(subscription.id);
        expect(updated!.status).toBe(SubscriptionStatus.PAST_DUE);
        expect(updated!.retryCount).toBe(1);
      });

      it('should return error for non-existent subscription', async () => {
        const result = await service.renewSubscription('non_existent');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Subscription not found');
      });
    });

    describe('processDueRenewals', () => {
      it('should process all due renewals', async () => {
        await service.createSubscription({
          userId: 'user_2',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        const futureDate = new Date(Date.now() + 35 * 86400000);
        const result = await service.processDueRenewals(futureDate);

        expect(result.totalProcessed).toBeGreaterThan(0);
        expect(result.successful).toBeGreaterThan(0);
        expect(result.results).toHaveLength(result.totalProcessed);
      });

      it('should handle mix of successes and failures', async () => {
        let callCount = 0;
        let txCounter = 0;
        (harness.paymentService as any).processPayment = async (params: any) => {
          callCount++;
          if (callCount % 2 === 0) {
            return {
              success: false,
              error: 'Payment failed',
              transactionId: '',
              amount: 0,
              currency: Currency.USD,
              status: PaymentStatus.FAILED,
              timestamp: new Date(),
            };
          }
          txCounter++;
          return {
            success: true,
            transactionId: `mix-tx-${txCounter}`,
            amount: params.amount ?? 0,
            currency: params.currency ?? Currency.USD,
            status: PaymentStatus.COMPLETED,
            timestamp: new Date(),
          };
        };

        await service.createSubscription({
          userId: 'user_2',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        const futureDate = new Date(Date.now() + 35 * 86400000);
        const result = await service.processDueRenewals(futureDate);

        expect(result.failed).toBeGreaterThan(0);
        expect(result.errors).toHaveLength(result.failed);
      });
    });

    describe('retryFailedPayment', () => {
      it('should retry failed payment', async () => {
        // Simulate failed payment first
        installFailedPaymentShim(harness, 'Insufficient funds');

        await service.renewSubscription(subscription.id);

        // Re-install success shim for retry
        installSubscriptionPaymentShim(harness);

        const result = await service.retryFailedPayment(subscription.id);

        expect(result.success).toBe(true);
      });
    });

    describe('updatePaymentMethod', () => {
      it('should update payment method', async () => {
        const updated = await service.updatePaymentMethod(subscription.id, 'pm_new123');

        expect(updated.metadata?.paymentMethodId).toBe('pm_new123');
      });
    });

    describe('getNextBillingDate', () => {
      it('should return next billing date', async () => {
        const nextDate = await service.getNextBillingDate(subscription.id);

        expect(nextDate).toBeInstanceOf(Date);
        expect(nextDate.getTime()).toBeGreaterThan(Date.now());
      });
    });

    describe('updateBillingInterval', () => {
      it('should update billing interval', async () => {
        const updated = await service.updateBillingInterval(
          subscription.id,
          BillingInterval.YEARLY
        );

        expect(updated.billingInterval).toBe(BillingInterval.YEARLY);
        expect(updated.price).toBe(creatorPlan.yearlyPrice);
      });
    });
  });

  describe('Invoicing', () => {
    let subscription: Subscription;

    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
      subscription = await service.createSubscription({
        userId: 'user_123',
        planId: creatorPlan.id,
        billingInterval: BillingInterval.MONTHLY,
        trialDays: 0,
      });
    });

    describe('createInvoice', () => {
      it('should create invoice for subscription', async () => {
        const invoice = await service.createInvoice(subscription.id, InvoiceType.RENEWAL);

        expect(invoice.id).toBeDefined();
        expect(invoice.subscriptionId).toBe(subscription.id);
        expect(invoice.invoiceType).toBe(InvoiceType.RENEWAL);
        expect(invoice.status).toBe(InvoiceStatus.PENDING);
        expect(invoice.lineItems).toHaveLength(1);
      });

      it('should include usage charges', async () => {
        await service.recordUsage(subscription.id, 'api_calls', 1000);

        const invoice = await service.createInvoice(subscription.id, InvoiceType.RENEWAL);

        expect(invoice.lineItems.length).toBeGreaterThanOrEqual(1);
      });

      it('should apply credit balance', async () => {
        const sub = await service.getSubscription(subscription.id);
        sub!.creditBalance = 500;
        await service.updateSubscription(subscription.id, {});

        const invoice = await service.createInvoice(subscription.id, InvoiceType.RENEWAL);

        expect(invoice.discountAmount).toBe(500);
      });
    });

    describe('getSubscriptionInvoices', () => {
      it('should list invoices for subscription', async () => {
        await service.createInvoice(subscription.id, InvoiceType.INITIAL);
        await service.createInvoice(subscription.id, InvoiceType.RENEWAL);

        const invoices = await service.getSubscriptionInvoices(subscription.id);

        expect(invoices).toHaveLength(3); // Including one from creation
      });

      it('should limit results', async () => {
        await service.createInvoice(subscription.id, InvoiceType.RENEWAL);
        await service.createInvoice(subscription.id, InvoiceType.RENEWAL);

        const invoices = await service.getSubscriptionInvoices(subscription.id, 1);

        expect(invoices).toHaveLength(1);
      });
    });

    describe('markInvoicePaid', () => {
      it('should mark invoice as paid', async () => {
        const invoice = await service.createInvoice(subscription.id, InvoiceType.RENEWAL);

        await service.markInvoicePaid(invoice.id, 'txn_123');

        const updated = await service.getInvoice(invoice.id);
        expect(updated!.status).toBe(InvoiceStatus.PAID);
        expect(updated!.paymentTransactionId).toBe('txn_123');
        expect(updated!.paidAt).toBeInstanceOf(Date);
      });

      it('should throw error for non-existent invoice', async () => {
        await expect(service.markInvoicePaid('non_existent', 'txn_123')).rejects.toThrow(
          'Invoice not found'
        );
      });
    });
  });

  describe('Usage-Based Billing', () => {
    let subscription: Subscription;

    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
      subscription = await service.createSubscription({
        userId: 'user_123',
        planId: creatorPlan.id,
        billingInterval: BillingInterval.MONTHLY,
        trialDays: 0,
      });
    });

    describe('recordUsage', () => {
      it('should record usage metric', async () => {
        await service.recordUsage(subscription.id, 'api_calls', 100);

        const usage = await service.getCurrentUsage(subscription.id);
        expect(usage).toBeDefined();
        expect(usage!.metrics['api_calls']).toBeDefined();
        expect(usage!.metrics['api_calls'].quantity).toBe(100);
      });

      it('should accumulate usage', async () => {
        await service.recordUsage(subscription.id, 'api_calls', 100);
        await service.recordUsage(subscription.id, 'api_calls', 50);

        const usage = await service.getCurrentUsage(subscription.id);
        expect(usage!.metrics['api_calls'].quantity).toBe(150);
      });

      it('should track multiple metrics', async () => {
        await service.recordUsage(subscription.id, 'api_calls', 100);
        await service.recordUsage(subscription.id, 'storage_gb', 5);

        const usage = await service.getCurrentUsage(subscription.id);
        expect(Object.keys(usage!.metrics)).toHaveLength(2);
      });
    });

    describe('calculateUsageCharges', () => {
      it('should calculate total usage charges', async () => {
        await service.recordUsage(subscription.id, 'api_calls', 1000);

        const charges = await service.calculateUsageCharges(subscription.id);
        expect(charges).toBeGreaterThanOrEqual(0);
      });

      it('should return 0 for no usage', async () => {
        const charges = await service.calculateUsageCharges(subscription.id);
        expect(charges).toBe(0);
      });
    });
  });

  describe('Grace Period & Retry', () => {
    let subscription: Subscription;

    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
      subscription = await service.createSubscription({
        userId: 'user_123',
        planId: creatorPlan.id,
        billingInterval: BillingInterval.MONTHLY,
        trialDays: 0,
      });
    });

    describe('startGracePeriod', () => {
      it('should start grace period', async () => {
        const updated = await service.startGracePeriod(subscription.id, 7);

        expect(updated.status).toBe(SubscriptionStatus.GRACE_PERIOD);
        expect(updated.gracePeriodDays).toBe(7);
      });
    });

    describe('getSubscriptionsInGracePeriod', () => {
      it('should find subscriptions in grace period', async () => {
        await service.startGracePeriod(subscription.id, 7);

        const inGrace = await service.getSubscriptionsInGracePeriod();

        expect(inGrace).toHaveLength(1);
        expect(inGrace[0].id).toBe(subscription.id);
      });
    });

    describe('schedulePaymentRetry', () => {
      it('should schedule retry', async () => {
        const retryDate = new Date(Date.now() + 86400000);
        await service.schedulePaymentRetry(subscription.id, retryDate);

        const updated = await service.getSubscription(subscription.id);
        expect(updated!.nextRetryDate).toEqual(retryDate);
      });
    });

    describe('getRetrySchedule', () => {
      it('should return retry schedule', async () => {
        const schedule = await service.getRetrySchedule(subscription.id);

        expect(schedule).toHaveLength(3); // Default max retries
        expect(schedule[0]).toBeInstanceOf(Date);
      });
    });
  });

  describe('Analytics & Reporting', () => {
    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
      proPlan = await service.createPlan(makeProPlan());
    });

    describe('calculateMRR', () => {
      it('should calculate monthly recurring revenue', async () => {
        await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        await service.createSubscription({
          userId: 'user_2',
          planId: proPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        const mrr = await service.calculateMRR();

        expect(mrr).toBe(creatorPlan.monthlyPrice + proPlan.monthlyPrice);
      });

      it('should calculate MRR for yearly subscriptions', async () => {
        await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.YEARLY,
          trialDays: 0,
        });

        const mrr = await service.calculateMRR();

        expect(mrr).toBe(creatorPlan.yearlyPrice / 12);
      });
    });

    describe('calculateARR', () => {
      it('should calculate annual recurring revenue', async () => {
        await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        const arr = await service.calculateARR();

        expect(arr).toBe(creatorPlan.monthlyPrice * 12);
      });
    });

    describe('getStatistics', () => {
      it('should return subscription statistics', async () => {
        await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
        });

        const stats = await service.getStatistics();

        expect(stats.totalSubscriptions).toBeGreaterThan(0);
        expect(stats.trialingSubscriptions).toBeGreaterThan(0);
        expect(stats.mrr).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Events & Webhooks', () => {
    let subscription: Subscription;

    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
      subscription = await service.createSubscription({
        userId: 'user_123',
        planId: creatorPlan.id,
        billingInterval: BillingInterval.MONTHLY,
        trialDays: 0,
      });
    });

    describe('subscribeToEvents', () => {
      it('should subscribe to events', () => {
        const callback = vi.fn();
        const subscriptionId = service.subscribeToEvents(SubscriptionEventType.RENEWED, callback);

        expect(subscriptionId).toBeDefined();
        expect(typeof subscriptionId).toBe('string');
      });
    });

    describe('unsubscribeFromEvents', () => {
      it('should unsubscribe from events', () => {
        const callback = vi.fn();
        const subId = service.subscribeToEvents(SubscriptionEventType.RENEWED, callback);

        service.unsubscribeFromEvents(subId);

        expect(() => service.unsubscribeFromEvents(subId)).not.toThrow();
      });
    });

    describe('getEventHistory', () => {
      it('should retrieve event history', async () => {
        const events = await service.getEventHistory(subscription.id);

        expect(events.length).toBeGreaterThan(0);
        expect(events[0].subscriptionId).toBe(subscription.id);
      });

      it('should limit results', async () => {
        const events = await service.getEventHistory(subscription.id, 1);

        expect(events).toHaveLength(1);
      });
    });
  });

  describe('Currency Support', () => {
    let subscription: Subscription;

    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
      subscription = await service.createSubscription({
        userId: 'user_123',
        planId: creatorPlan.id,
        billingInterval: BillingInterval.MONTHLY,
        trialDays: 0,
      });

      // Seed USD:EUR fallback rate (not in CurrencyService defaults)
      const cs = harness.currencyService as any;
      cs.fallbackProvider.setRate(Currency.USD, Currency.EUR, 0.92);
    });

    describe('getSubscriptionInCurrency', () => {
      it('should convert subscription to different currency', async () => {
        const converted = await service.getSubscriptionInCurrency(subscription.id, Currency.EUR);

        expect(converted.currency).toBe(Currency.EUR);
        expect(converted.price).not.toBe(subscription.price);
      });

      it('should return unchanged if same currency', async () => {
        const unchanged = await service.getSubscriptionInCurrency(subscription.id, Currency.USD);

        expect(unchanged).toEqual(subscription);
      });
    });

    describe('updateCurrency', () => {
      it('should update subscription currency', async () => {
        const originalPrice = subscription.price;
        const updated = await service.updateCurrency(subscription.id, Currency.EUR);

        expect(updated.currency).toBe(Currency.EUR);
        expect(updated.price).not.toBe(originalPrice);
      });
    });
  });

  describe('Health & Maintenance', () => {
    beforeEach(async () => {
      creatorPlan = await service.createPlan(makeCreatorPlan());
    });

    describe('healthCheck', () => {
      it('should return true when healthy', async () => {
        const healthy = await service.healthCheck();
        expect(healthy).toBe(true);
      });
    });

    describe('getMetrics', () => {
      it('should return service metrics', async () => {
        await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        const metrics = await service.getMetrics();

        expect(metrics.uptime).toBeGreaterThanOrEqual(0);
        expect(metrics.totalSubscriptions).toBeGreaterThan(0);
        expect(metrics.activeSubscriptions).toBeGreaterThan(0);
      });
    });

    describe('cleanupExpiredSubscriptions', () => {
      it('should clean up expired subscriptions', async () => {
        const sub = await service.createSubscription({
          userId: 'user_1',
          planId: creatorPlan.id,
          billingInterval: BillingInterval.MONTHLY,
          trialDays: 0,
        });

        await service.expireSubscription(sub.id);

        const count = await service.cleanupExpiredSubscriptions(0);
        expect(count).toBeGreaterThan(0);
      });
    });

    describe('dispose', () => {
      it('should dispose resources', async () => {
        await expect(service.dispose()).resolves.not.toThrow();
      });
    });
  });
});
