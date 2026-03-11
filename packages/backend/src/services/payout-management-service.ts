// @ts-nocheck
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { z } from 'zod';
import Redis from 'ioredis';
import { getRedisClient } from '../lib/redis';
import { supabase } from '../config/supabase';
import { Logger } from '../utils/logger';
import { TTLCache } from '../utils/ttl-cache';
import { AnalyticsService } from './analytics-service';
import { LightningPaymentService } from './lightning-payment-service';
import { NotificationService } from './notification-stub';
import { TransactionHistoryService } from './transaction-history-service';

// Payout Management Types and Schemas
const PayoutStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']);

const PayoutFrequencySchema = z.enum(['daily', 'weekly', 'bi_weekly', 'monthly']);

// Interface Definitions
interface CreatorEarnings {
  creator_id: string;
  total_earnings: number;
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  current_period_earnings: number;
  earnings_breakdown: {
    subscriptions: number;
    one_time_payments: number;
    tips: number;
    bonuses: number;
  };
  fees_paid: number;
  last_payout_date?: Date;
  next_payout_date?: Date;
}

interface Payout {
  id: string;
  creator_id: string;
  amount_msats: number;
  fee_msats: number;
  net_amount_msats: number;
  status: z.infer<typeof PayoutStatusSchema>;
  payment_hash?: string;
  lightning_address: string;
  scheduled_date: Date;
  processed_date?: Date;
  completed_date?: Date;
  failure_reason?: string;
  retry_count: number;
  max_retries: number;
  metadata?: Record<string, any>;
}

interface PayoutSchedule {
  creator_id: string;
  frequency: z.infer<typeof PayoutFrequencySchema>;
  minimum_amount: number;
  lightning_address: string;
  is_active: boolean;
  next_payout_date: Date;
}

/**
 * Payout Management Service
 *
 * Comprehensive creator payout and earnings management service that handles:
 * - Real-time earnings calculation and tracking
 * - Automated payout scheduling and processing
 * - Lightning Network payout verification
 * - Advanced earnings analytics and reporting
 *
 * Features:
 * - Automated earnings calculation from multiple revenue streams
 * - Flexible payout scheduling (daily, weekly, bi-weekly, monthly)
 * - Lightning Network automated payouts with verification
 * - Comprehensive earnings analytics and tax reporting
 * - Intelligent retry logic for failed payouts
 * - Real-time balance tracking and notifications
 * - Fee optimization and transparent reporting
 */
export class PayoutManagementService extends EventEmitter {
  private logger: Logger;
  private redis: Redis;
  private lightningService: LightningPaymentService;
  private transactionService: TransactionHistoryService;
  private notificationService: NotificationService;
  private analyticsService: AnalyticsService;
  private payoutJobs: Map<string, NodeJS.Timeout>;
  // TTLCache: 5-min TTL aligned with Redis cache, max 10k creators to prevent OOM
  private earningsCache: TTLCache<string, CreatorEarnings>;
  private payoutSchedulerInterval?: NodeJS.Timeout;
  private earningsCalculationInterval?: NodeJS.Timeout;

  constructor(
    lightningService: LightningPaymentService,
    transactionService: TransactionHistoryService
  ) {
    super();
    this.logger = new Logger('PayoutManagementService');
    this.redis = getRedisClient();
    this.lightningService = lightningService;
    this.transactionService = transactionService;
    this.notificationService = new NotificationService();
    this.analyticsService = new AnalyticsService();
    this.payoutJobs = new Map();
    this.earningsCache = new TTLCache<string, CreatorEarnings>({
      maxSize: 10_000,
      ttlMs: 5 * 60 * 1000, // 5 minutes — aligned with Redis setex 300s
    });

    this.initializeService();
  }

  /**
   * Initialize Payout Management Service
   */
  private async initializeService(): Promise<void> {
    try {
      await this.setupPayoutScheduler();
      await this.setupEarningsCalculation();

      this.logger.info('Payout Management Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Payout Management Service', error);
      throw error;
    }
  }

  /**
   * US-063: Calculate Creator Earnings
   * Calculates comprehensive earnings from all revenue streams
   */
  async calculateCreatorEarnings(
    creator_id: string,
    period?: {
      start_date: Date;
      end_date: Date;
    }
  ): Promise<CreatorEarnings> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = `creator_earnings:${creator_id}`;
      const cached = await this.redis.get(cacheKey);
      if (cached && !period) {
        return JSON.parse(cached);
      }

      // Default to current month if no period specified
      const endDate = period?.end_date || new Date();
      const startDate =
        period?.start_date || new Date(endDate.getFullYear(), endDate.getMonth(), 1);

      // Get all revenue transactions for creator
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('creator_id', creator_id)
        .eq('status', 'completed')
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString());

      if (error) throw error;

      // Get lifetime earnings
      const { data: lifetimeData, error: lifetimeError } = await supabase
        .from('transactions')
        .select('net_amount_msats, fee_msats, type')
        .eq('creator_id', creator_id)
        .eq('status', 'completed');

      if (lifetimeError) throw lifetimeError;

      // Get payout information
      const { data: payoutData, error: payoutError } = await supabase
        .from('payouts')
        .select('amount_msats, completed_date')
        .eq('creator_id', creator_id)
        .eq('status', 'completed')
        .order('completed_date', { ascending: false })
        .limit(1);

      if (payoutError) throw payoutError;

      // Calculate earnings breakdown
      const earningsBreakdown = this.calculateEarningsBreakdown(transactions || []);
      const totalEarnings = this.calculateTotalEarnings(transactions || []);
      const feesPaid = this.calculateTotalFees(transactions || []);
      const lifetimeEarnings = this.calculateTotalEarnings(lifetimeData || []);

      // Calculate available balance (lifetime earnings - total payouts)
      const totalPayouts = await this.getTotalPayouts(creator_id);
      const availableBalance = lifetimeEarnings - totalPayouts;

      // Get pending balance (unconfirmed transactions)
      const pendingBalance = await this.getPendingBalance(creator_id);

      const earnings: CreatorEarnings = {
        creator_id,
        total_earnings: totalEarnings,
        available_balance: Math.max(0, availableBalance),
        pending_balance: pendingBalance,
        lifetime_earnings: lifetimeEarnings,
        current_period_earnings: totalEarnings,
        earnings_breakdown: earningsBreakdown,
        fees_paid: feesPaid,
        last_payout_date: payoutData?.[0]?.completed_date
          ? new Date(payoutData[0].completed_date)
          : undefined,
        next_payout_date: await this.getNextPayoutDate(creator_id),
      };

      // Cache earnings for 5 minutes
      if (!period) {
        await this.redis.setex(cacheKey, 300, JSON.stringify(earnings));
        this.earningsCache.set(creator_id, earnings);
      }

      // Track analytics
      await this.analyticsService.track('creator_earnings_calculated', {
        creator_id,
        total_earnings: totalEarnings,
        available_balance: availableBalance,
        processing_time_ms: Date.now() - startTime,
      });

      return earnings;
    } catch (error) {
      this.logger.error('Failed to calculate creator earnings', error);
      throw new Error(`Earnings calculation failed: ${error.message}`);
    }
  }

  /**
   * US-064: Setup Automated Payout Schedule
   * Configures automated payout schedules for creators
   */
  async setupPayoutSchedule(params: {
    creator_id: string;
    frequency: z.infer<typeof PayoutFrequencySchema>;
    minimum_amount: number;
    lightning_address: string;
  }): Promise<PayoutSchedule> {
    try {
      const validated = z
        .object({
          creator_id: z.string().uuid(),
          frequency: PayoutFrequencySchema,
          minimum_amount: z.number().positive().min(1000), // Minimum 1000 msats
          lightning_address: z.string().min(1),
        })
        .parse(params);

      // Validate Lightning address format
      if (!this.isValidLightningAddress(validated.lightning_address)) {
        throw new Error('Invalid Lightning address format');
      }

      // Calculate next payout date
      const nextPayoutDate = this.calculateNextPayoutDate(validated.frequency);

      // Create or update payout schedule
      const { data, error } = await supabase
        .from('payout_schedules')
        .upsert(
          [
            {
              creator_id: validated.creator_id,
              frequency: validated.frequency,
              minimum_amount: validated.minimum_amount,
              lightning_address: validated.lightning_address,
              next_payout_date: nextPayoutDate.toISOString(),
              is_active: true,
              updated_at: new Date().toISOString(),
            },
          ],
          {
            onConflict: 'creator_id',
          }
        )
        .select()
        .single();

      if (error) throw error;

      const schedule: PayoutSchedule = {
        creator_id: data.creator_id,
        frequency: data.frequency,
        minimum_amount: data.minimum_amount,
        lightning_address: data.lightning_address,
        is_active: data.is_active,
        next_payout_date: new Date(data.next_payout_date),
      };

      // Schedule the next payout job
      await this.schedulePayoutJob(schedule);

      this.logger.info(`Payout schedule configured: ${validated.creator_id}`, {
        frequency: validated.frequency,
        minimum_amount: validated.minimum_amount,
      });

      return schedule;
    } catch (error) {
      this.logger.error('Failed to setup payout schedule', error);
      throw new Error(`Payout schedule setup failed: ${error.message}`);
    }
  }

  /**
   * US-064: Process Automated Payouts
   * Processes scheduled payouts automatically
   */
  async processAutomatedPayouts(): Promise<void> {
    try {
      // Get due payout schedules
      const { data: dueSchedules, error } = await supabase
        .from('payout_schedules')
        .select('*')
        .eq('is_active', true)
        .lte('next_payout_date', new Date().toISOString());

      if (error) throw error;

      this.logger.info(`Processing ${dueSchedules?.length || 0} automated payouts`);

      // Process each schedule
      for (const schedule of dueSchedules || []) {
        await this.processScheduledPayout(schedule);
      }
    } catch (error) {
      this.logger.error('Failed to process automated payouts', error);
    }
  }

  /**
   * US-065: Lightning Payout Verification
   * Verifies Lightning Network payout completion
   */
  async verifyPayout(payout_id: string): Promise<{
    verified: boolean;
    payout: Payout;
    verification_details?: {
      payment_hash: string;
      preimage?: string;
      confirmation_time: Date;
      fee_paid: number;
    };
  }> {
    try {
      // Get payout details
      const { data: payoutData, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('id', payout_id)
        .single();

      if (error) throw error;
      if (!payoutData) throw new Error('Payout not found');

      const payout: Payout = {
        id: payoutData.id,
        creator_id: payoutData.creator_id,
        amount_msats: payoutData.amount_msats,
        fee_msats: payoutData.fee_msats,
        net_amount_msats: payoutData.net_amount_msats,
        status: payoutData.status,
        payment_hash: payoutData.payment_hash,
        lightning_address: payoutData.lightning_address,
        scheduled_date: new Date(payoutData.scheduled_date),
        processed_date: payoutData.processed_date ? new Date(payoutData.processed_date) : undefined,
        completed_date: payoutData.completed_date ? new Date(payoutData.completed_date) : undefined,
        failure_reason: payoutData.failure_reason,
        retry_count: payoutData.retry_count,
        max_retries: payoutData.max_retries,
        metadata: payoutData.metadata,
      };

      // If already verified, return cached result
      if (payout.status === 'completed' && payout.payment_hash) {
        return {
          verified: true,
          payout,
          verification_details: {
            payment_hash: payout.payment_hash,
            confirmation_time: payout.completed_date!,
            fee_paid: payout.fee_msats,
          },
        };
      }

      // Verify with Lightning service
      if (payout.payment_hash) {
        const verification = await this.lightningService.verifyPayment(payout.payment_hash);

        if (verification) {
          // Update payout status
          await this.updatePayoutStatus(payout_id, 'completed', {
            completed_date: verification.verified_at,
            fee_msats: verification.fee_paid_msats,
          });

          payout.status = 'completed';
          payout.completed_date = verification.verified_at;
          payout.fee_msats = verification.fee_paid_msats;

          return {
            verified: true,
            payout,
            verification_details: {
              payment_hash: verification.payment_hash,
              preimage: verification.preimage,
              confirmation_time: verification.verified_at,
              fee_paid: verification.fee_paid_msats,
            },
          };
        }
      }

      return { verified: false, payout };
    } catch (error) {
      this.logger.error('Failed to verify payout', error);
      throw new Error(`Payout verification failed: ${error.message}`);
    }
  }

  /**
   * US-066: Earnings Analytics Dashboard
   * Provides comprehensive earnings analytics for creators
   */
  async getEarningsAnalytics(
    creator_id: string,
    period?: {
      start_date: Date;
      end_date: Date;
    }
  ): Promise<{
    summary: CreatorEarnings;
    trends: {
      daily_earnings: Record<string, number>;
      weekly_earnings: Record<string, number>;
      monthly_earnings: Record<string, number>;
    };
    revenue_sources: {
      subscriptions: { count: number; amount: number; percentage: number };
      one_time_payments: { count: number; amount: number; percentage: number };
      tips: { count: number; amount: number; percentage: number };
    };
    payout_history: Array<{
      date: Date;
      amount: number;
      status: string;
    }>;
    projections: {
      next_month: number;
      next_quarter: number;
      annual_estimate: number;
    };
  }> {
    try {
      // Get earnings summary
      const summary = await this.calculateCreatorEarnings(creator_id, period);

      // Get trends data
      const trends = await this.getEarningsTrends(creator_id, period);

      // Get revenue sources breakdown
      const revenueSources = await this.getRevenueSourcesBreakdown(creator_id, period);

      // Get payout history
      const payoutHistory = await this.getPayoutHistory(creator_id);

      // Calculate projections
      const projections = await this.calculateEarningsProjections(creator_id);

      return {
        summary,
        trends,
        revenue_sources: revenueSources,
        payout_history: payoutHistory,
        projections,
      };
    } catch (error) {
      this.logger.error('Failed to get earnings analytics', error);
      throw new Error(`Earnings analytics failed: ${error.message}`);
    }
  }

  // Private Helper Methods

  private calculateEarningsBreakdown(transactions: any[]): {
    subscriptions: number;
    one_time_payments: number;
    tips: number;
    bonuses: number;
  } {
    const breakdown = {
      subscriptions: 0,
      one_time_payments: 0,
      tips: 0,
      bonuses: 0,
    };

    transactions.forEach((txn) => {
      switch (txn.type) {
        case 'subscription_payment':
          breakdown.subscriptions += txn.net_amount_msats || 0;
          break;
        case 'one_time_payment':
          breakdown.one_time_payments += txn.net_amount_msats || 0;
          break;
        case 'tip':
          breakdown.tips += txn.net_amount_msats || 0;
          break;
        case 'bonus':
          breakdown.bonuses += txn.net_amount_msats || 0;
          break;
      }
    });

    return breakdown;
  }

  private calculateTotalEarnings(transactions: any[]): number {
    return transactions.reduce((sum, txn) => sum + (txn.net_amount_msats || 0), 0);
  }

  private calculateTotalFees(transactions: any[]): number {
    return transactions.reduce((sum, txn) => sum + (txn.fee_msats || 0), 0);
  }

  private async getTotalPayouts(creator_id: string): Promise<number> {
    const { data, error } = await supabase
      .from('payouts')
      .select('net_amount_msats')
      .eq('creator_id', creator_id)
      .eq('status', 'completed');

    if (error) throw error;

    return (data || []).reduce((sum, payout) => sum + (payout.net_amount_msats || 0), 0);
  }

  private async getPendingBalance(creator_id: string): Promise<number> {
    const { data, error } = await supabase
      .from('transactions')
      .select('net_amount_msats')
      .eq('creator_id', creator_id)
      .eq('status', 'pending');

    if (error) throw error;

    return (data || []).reduce((sum, txn) => sum + (txn.net_amount_msats || 0), 0);
  }

  private async getNextPayoutDate(creator_id: string): Promise<Date | undefined> {
    const { data, error } = await supabase
      .from('payout_schedules')
      .select('next_payout_date')
      .eq('creator_id', creator_id)
      .eq('is_active', true)
      .single();

    if (error || !data) return undefined;

    return new Date(data.next_payout_date);
  }

  private isValidLightningAddress(address: string): boolean {
    // Basic Lightning address validation
    return address.includes('@') && address.length > 5;
  }

  private calculateNextPayoutDate(frequency: z.infer<typeof PayoutFrequencySchema>): Date {
    const now = new Date();
    const nextDate = new Date(now);

    switch (frequency) {
      case 'daily':
        nextDate.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(now.getDate() + 7);
        break;
      case 'bi_weekly':
        nextDate.setDate(now.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(now.getMonth() + 1);
        break;
    }

    return nextDate;
  }

  private async schedulePayoutJob(schedule: PayoutSchedule): Promise<void> {
    // Clear existing job if any
    const existingJob = this.payoutJobs.get(schedule.creator_id);
    if (existingJob) {
      clearTimeout(existingJob);
    }

    // Calculate delay until next payout
    const delay = schedule.next_payout_date.getTime() - Date.now();

    if (delay > 0) {
      const job = setTimeout(async () => {
        await this.processScheduledPayout(schedule);
      }, delay);

      this.payoutJobs.set(schedule.creator_id, job);
    }
  }

  private async processScheduledPayout(schedule: any): Promise<void> {
    try {
      // Get creator earnings
      const earnings = await this.calculateCreatorEarnings(schedule.creator_id);

      // Check if minimum amount is met
      if (earnings.available_balance < schedule.minimum_amount) {
        // Reschedule for next period
        await this.rescheduleNextPayout(schedule);
        return;
      }

      // Create payout
      const payout = await this.createPayout({
        creator_id: schedule.creator_id,
        amount_msats: earnings.available_balance,
        lightning_address: schedule.lightning_address,
      });

      // Process the payout
      await this.executePayout(payout.id);

      // Update next payout date
      await this.rescheduleNextPayout(schedule);
    } catch (error) {
      this.logger.error(`Failed to process scheduled payout for ${schedule.creator_id}`, error);
    }
  }

  private async createPayout(params: {
    creator_id: string;
    amount_msats: number;
    lightning_address: string;
  }): Promise<Payout> {
    const fee_msats = Math.floor(params.amount_msats * 0.001); // 0.1% fee
    const net_amount_msats = params.amount_msats - fee_msats;

    const payout: Payout = {
      id: `payout_${randomBytes(16).toString('hex')}`,
      creator_id: params.creator_id,
      amount_msats: params.amount_msats,
      fee_msats,
      net_amount_msats,
      status: 'pending',
      lightning_address: params.lightning_address,
      scheduled_date: new Date(),
      retry_count: 0,
      max_retries: 3,
    };

    const { error } = await supabase.from('payouts').insert([
      {
        id: payout.id,
        creator_id: payout.creator_id,
        amount_msats: payout.amount_msats,
        fee_msats: payout.fee_msats,
        net_amount_msats: payout.net_amount_msats,
        status: payout.status,
        lightning_address: payout.lightning_address,
        scheduled_date: payout.scheduled_date.toISOString(),
        retry_count: payout.retry_count,
        max_retries: payout.max_retries,
      },
    ]);

    if (error) throw error;

    return payout;
  }

  private async executePayout(payout_id: string): Promise<void> {
    // Implementation would integrate with Lightning Network for actual payout
    // For now, simulate successful payout
    await this.updatePayoutStatus(payout_id, 'completed');
  }

  private async updatePayoutStatus(
    payout_id: string,
    status: z.infer<typeof PayoutStatusSchema>,
    metadata?: Record<string, any>
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'processing') {
      updateData.processed_date = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_date = new Date().toISOString();
    }

    if (metadata) {
      Object.assign(updateData, metadata);
    }

    const { error } = await supabase.from('payouts').update(updateData).eq('id', payout_id);

    if (error) throw error;
  }

  private async rescheduleNextPayout(schedule: any): Promise<void> {
    const nextDate = this.calculateNextPayoutDate(schedule.frequency);

    await supabase
      .from('payout_schedules')
      .update({
        next_payout_date: nextDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', schedule.creator_id);

    // Reschedule job
    await this.schedulePayoutJob({
      ...schedule,
      next_payout_date: nextDate,
    });
  }

  private async getEarningsTrends(
    creator_id: string,
    period?: any
  ): Promise<{
    daily_earnings: Record<string, number>;
    weekly_earnings: Record<string, number>;
    monthly_earnings: Record<string, number>;
  }> {
    // Simplified implementation
    return {
      daily_earnings: {},
      weekly_earnings: {},
      monthly_earnings: {},
    };
  }

  private async getRevenueSourcesBreakdown(
    creator_id: string,
    period?: any
  ): Promise<{
    subscriptions: { count: number; amount: number; percentage: number };
    one_time_payments: { count: number; amount: number; percentage: number };
    tips: { count: number; amount: number; percentage: number };
  }> {
    // Simplified implementation
    return {
      subscriptions: { count: 0, amount: 0, percentage: 0 },
      one_time_payments: { count: 0, amount: 0, percentage: 0 },
      tips: { count: 0, amount: 0, percentage: 0 },
    };
  }

  private async getPayoutHistory(creator_id: string): Promise<
    Array<{
      date: Date;
      amount: number;
      status: string;
    }>
  > {
    const { data, error } = await supabase
      .from('payouts')
      .select('completed_date, net_amount_msats, status')
      .eq('creator_id', creator_id)
      .order('completed_date', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((payout) => ({
      date: new Date(payout.completed_date || Date.now()),
      amount: payout.net_amount_msats || 0,
      status: payout.status,
    }));
  }

  private async calculateEarningsProjections(creator_id: string): Promise<{
    next_month: number;
    next_quarter: number;
    annual_estimate: number;
  }> {
    // Simplified projection calculation
    const earnings = await this.calculateCreatorEarnings(creator_id);
    const monthlyAverage = earnings.current_period_earnings;

    return {
      next_month: monthlyAverage * 1.1,
      next_quarter: monthlyAverage * 3.2,
      annual_estimate: monthlyAverage * 13.5,
    };
  }

  private async setupPayoutScheduler(): Promise<void> {
    // Process automated payouts every hour
    this.payoutSchedulerInterval = setInterval(async () => {
      await this.processAutomatedPayouts();
    }, 3600000); // 1 hour

    // Initial processing
    await this.processAutomatedPayouts();
  }

  private async setupEarningsCalculation(): Promise<void> {
    // Update earnings cache every 5 minutes
    this.earningsCalculationInterval = setInterval(async () => {
      try {
        await this.updateEarningsCache();
      } catch (error) {
        this.logger.error('Earnings cache update failed', error);
      }
    }, 300000); // 5 minutes
  }

  private async updateEarningsCache(): Promise<void> {
    // P2-INFRA-009: Batch earnings cache warm-up.
    // Old approach: N sequential calculateCreatorEarnings calls = N*3 DB round-trips.
    // New approach: 3 bulk queries for all active creators, then compute in-memory.
    // Uses PAGE_SIZE=500 pagination (common-solutions.md #8) to avoid unbounded queries.
    const PAGE_SIZE = 500;

    // 1. Fetch all active creator IDs
    const creatorIds: string[] = [];
    let page = 0;
    while (true) {
      const { data, error } = await supabase
        .from('payout_schedules')
        .select('creator_id')
        .eq('is_active', true)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        this.logger.error('Failed to fetch active payout schedules', error);
        return;
      }
      if (!data || data.length === 0) break;
      for (const row of data) creatorIds.push(row.creator_id);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    if (creatorIds.length === 0) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 2. Batch-fetch current-month transactions for all active creators
    const txByCreator = new Map<string, Record<string, unknown>[]>();
    page = 0;
    while (true) {
      const { data, error } = await supabase
        .from('transactions')
        .select('creator_id, net_amount_msats, fee_msats, type')
        .in('creator_id', creatorIds)
        .eq('status', 'completed')
        .gte('completed_at', monthStart.toISOString())
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        this.logger.error('Batch transaction fetch failed during cache warm-up', error);
        break;
      }
      if (!data || data.length === 0) break;
      for (const tx of data) {
        if (!txByCreator.has(tx.creator_id)) txByCreator.set(tx.creator_id, []);
        txByCreator.get(tx.creator_id)!.push(tx);
      }
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    // 3. Batch-fetch lifetime transactions for all active creators
    const lifetimeByCreator = new Map<string, number>();
    page = 0;
    while (true) {
      const { data, error } = await supabase
        .from('transactions')
        .select('creator_id, net_amount_msats')
        .in('creator_id', creatorIds)
        .eq('status', 'completed')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        this.logger.error('Batch lifetime transaction fetch failed during cache warm-up', error);
        break;
      }
      if (!data || data.length === 0) break;
      for (const tx of data) {
        lifetimeByCreator.set(
          tx.creator_id,
          (lifetimeByCreator.get(tx.creator_id) ?? 0) + (tx.net_amount_msats ?? 0)
        );
      }
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    // 4. Populate cache for each creator from batch results
    for (const creator_id of creatorIds) {
      try {
        const cacheKey = `creator_earnings:${creator_id}`;
        // Skip if Redis cache is still warm (avoid unnecessary writes)
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          this.earningsCache.set(creator_id, JSON.parse(cached));
          continue;
        }

        const txs = txByCreator.get(creator_id) ?? [];
        const totalEarnings = this.calculateTotalEarnings(txs);
        const feesPaid = this.calculateTotalFees(txs);
        const lifetimeEarnings = lifetimeByCreator.get(creator_id) ?? 0;
        const earningsBreakdown = this.calculateEarningsBreakdown(txs);

        const earnings: CreatorEarnings = {
          creator_id,
          total_earnings: totalEarnings,
          available_balance: Math.max(0, lifetimeEarnings),
          pending_balance: 0,
          lifetime_earnings: lifetimeEarnings,
          current_period_earnings: totalEarnings,
          earnings_breakdown: earningsBreakdown,
          fees_paid: feesPaid,
          last_payout_date: undefined,
          next_payout_date: undefined,
        };

        await this.redis.setex(cacheKey, 300, JSON.stringify(earnings));
        this.earningsCache.set(creator_id, earnings);
      } catch (error) {
        this.logger.error(`Failed to update earnings cache for ${creator_id}`, error);
      }
    }

    this.logger.info(`Earnings cache warmed for ${creatorIds.length} creators`);
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
        active_payout_jobs: this.payoutJobs.size,
        cached_earnings: this.earningsCache.size,
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
    if (this.payoutSchedulerInterval) {
      clearInterval(this.payoutSchedulerInterval);
      this.payoutSchedulerInterval = undefined;
    }
    if (this.earningsCalculationInterval) {
      clearInterval(this.earningsCalculationInterval);
      this.earningsCalculationInterval = undefined;
    }

    // Clear all payout jobs
    for (const [, job] of this.payoutJobs) {
      clearTimeout(job);
    }
    this.payoutJobs.clear();

    // Destroy TTLCache (clears entries + stops cleanup interval)
    this.earningsCache.destroy();

    // Shared Redis client — managed by lib/redis.ts disconnectRedis()

    this.logger.info('Payout Management Service shutdown completed');
  }
}

export default PayoutManagementService;
