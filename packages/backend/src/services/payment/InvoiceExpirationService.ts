/**
 * Invoice Expiration Service
 *
 * Handles automatic expiration of pending payment invoices:
 * - Periodic checks for expired invoices
 * - State machine transitions to EXPIRED state
 * - User notifications via email
 * - Cleanup of expired invoices from active queues
 *
 * @module InvoiceExpirationService
 * @category Services
 * @see Story #003: Add Invoice Expiration Handling to State Machine
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { PaymentStateMachine } from './PaymentStateMachine';
import { PaymentState, Payment } from '@shared/types';
/**
 * Email Service Interface for sending expiration notifications
 */
export interface EmailService {
  /**
   * Send invoice expiration notification to user
   *
   * @param userId User UUID
   * @param paymentId Payment UUID
   * @param invoiceDetails Optional invoice details for email personalization
   * @returns Promise that resolves when email is sent
   */
  sendInvoiceExpiredEmail(
    userId: string,
    paymentId: string,
    invoiceDetails?: {
      amount: number;
      currency: string;
      description?: string;
      expiresAt: Date;
    }
  ): Promise<void>;
}
/**
 * Analytics Service Interface for tracking invoice expiration events
 */
export interface AnalyticsService {
  /**
   * Track invoice expiration event
   *
   * @param event Event name
   * @param properties Event properties
   * @returns Promise that resolves when event is tracked
   */
  track(event: string, properties: Record<string, unknown>): Promise<void>;
}
/**
 * Lightning Node Service Interface for managing Lightning Network resources
 */
export interface LightningNodeService {
  /**
   * Cancel or delete an expired invoice from the Lightning node
   *
   * @param paymentHash Payment hash of the invoice to cancel
   * @returns Promise that resolves when invoice is cancelled
   */
  cancelInvoice(paymentHash: string): Promise<void>;
}
/**
 * Logger interface for structured logging
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
/**
 * Configuration for Invoice Expiration Service
 */
export interface InvoiceExpirationConfig {
  /** Supabase client for database queries */
  supabase: SupabaseClient;
  /** Payment state machine for state transitions */
  stateMachine: PaymentStateMachine;
  /** Email service for sending notifications */
  emailService: EmailService;
  /** Analytics service for tracking expiration events */
  analyticsService?: AnalyticsService;
  /** Lightning node service for cleaning up expired invoices */
  lightningNodeService?: LightningNodeService;
  /** Logger for debugging and monitoring */
  logger?: Logger;
  /** Check interval in milliseconds (default: 5 minutes) */
  checkIntervalMs?: number;
  /** Batch size for processing expired invoices (default: 100) */
  batchSize?: number;
  /** Enable automatic scheduling (default: true) */
  autoSchedule?: boolean;
  /** Expiration window in seconds (default: 24 hours) */
  expirationWindowSeconds?: number;
}
/**
 * Result of expiration check operation
 */
export interface ExpirationCheckResult {
  /** Timestamp when check was performed */
  timestamp: Date;
  /** Number of expired invoices found */
  foundCount: number;
  /** Number successfully expired */
  expiredCount: number;
  /** Number that failed to expire */
  failedCount: number;
  /** Duration of check in milliseconds */
  durationMs: number;
  /** Errors encountered during processing */
  errors: Array<{
    paymentId: string;
    error: string;
  }>;
}
/**
 * Invoice Expiration Service
 *
 * Automatically handles invoice expiration with:
 * - Periodic background checks
 * - Atomic state transitions
 * - User email notifications
 * - Comprehensive error handling
 * - Rate limiting and batching
 *
 * @example
 * ```typescript
 * const expirationService = new InvoiceExpirationService({
 *   supabase,
 *   stateMachine,
 *   emailService,
 *   logger
 * });
 *
 * // Start automatic expiration checks
 * expirationService.start();
 *
 * // Or run manual check
 * const result = await expirationService.checkExpiredInvoices();
 * console.log(`Expired ${result.expiredCount} invoices`);
 * ```
 */
export class InvoiceExpirationService {
  private supabase: SupabaseClient;
  private stateMachine: PaymentStateMachine;
  private emailService: EmailService;
  private analyticsService?: AnalyticsService;
  private lightningNodeService?: LightningNodeService;
  private logger?: Logger;
  private checkIntervalMs: number;
  private batchSize: number;
  private autoSchedule: boolean;
  private expirationWindowSeconds: number;
  /** Timer ID for scheduled checks */
  private intervalId?: NodeJS.Timeout;
  /** Flag to prevent concurrent checks */
  private isChecking = false;
  /** Metrics for monitoring */
  private metrics = {
    totalChecks: 0,
    totalExpired: 0,
    totalFailed: 0,
    totalCleanedUp: 0,
    lastCheckAt: null as Date | null,
    lastCheckDuration: 0,
  };
  /**
   * Create a new Invoice Expiration Service
   *
   * @param config Service configuration
   */
  constructor(config: InvoiceExpirationConfig) {
    this.supabase = config.supabase;
    this.stateMachine = config.stateMachine;
    this.emailService = config.emailService;
    this.analyticsService = config.analyticsService;
    this.lightningNodeService = config.lightningNodeService;
    this.logger = config.logger;
    this.checkIntervalMs = config.checkIntervalMs ?? 5 * 60 * 1000; // Default: 5 minutes
    this.batchSize = config.batchSize ?? 100;
    this.autoSchedule = config.autoSchedule ?? true;
    this.expirationWindowSeconds = config.expirationWindowSeconds ?? 24 * 60 * 60; // Default: 24 hours
    this.logger?.info('Invoice Expiration Service initialized', {
      checkIntervalMs: this.checkIntervalMs,
      batchSize: this.batchSize,
      autoSchedule: this.autoSchedule,
      expirationWindowSeconds: this.expirationWindowSeconds,
      lightningNodeCleanup: !!this.lightningNodeService,
    });
    // Auto-start if configured
    if (this.autoSchedule) {
      this.start();
    }
  }
  /**
   * Start automatic expiration checks
   *
   * Schedules periodic background checks at configured interval.
   * Safe to call multiple times (will not create duplicate timers).
   */
  start(): void {
    if (this.intervalId) {
      this.logger?.warn('Invoice expiration scheduler already running');
      return;
    }
    this.logger?.info('Starting invoice expiration scheduler', {
      intervalMs: this.checkIntervalMs,
    });
    // Run initial check immediately
    this.checkExpiredInvoices().catch((error) => {
      this.logger?.error('Initial expiration check failed', { error });
    });
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkExpiredInvoices().catch((error) => {
        this.logger?.error('Scheduled expiration check failed', { error });
      });
    }, this.checkIntervalMs);
  }
  /**
   * Stop automatic expiration checks
   *
   * Clears the scheduled interval timer.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger?.info('Invoice expiration scheduler stopped');
    }
  }
  /**
   * Check and expire all pending invoices past their expiration time
   *
   * Main operation that:
   * 1. Queries database for expired pending payments
   * 2. Transitions each to EXPIRED state
   * 3. Sends email notifications to users
   * 4. Handles errors gracefully
   * 5. Returns comprehensive results
   *
   * @returns Promise resolving to expiration check result
   */
  async checkExpiredInvoices(): Promise<ExpirationCheckResult> {
    // Prevent concurrent checks
    if (this.isChecking) {
      this.logger?.warn('Expiration check already in progress, skipping');
      return {
        timestamp: new Date(),
        foundCount: 0,
        expiredCount: 0,
        failedCount: 0,
        durationMs: 0,
        errors: [],
      };
    }
    this.isChecking = true;
    const startTime = Date.now();
    const timestamp = new Date();
    this.logger?.info('Starting invoice expiration check', { timestamp });
    try {
      // Find all expired pending payments
      const expiredPayments = await this.findExpiredPayments();
      this.logger?.info('Found expired payments', {
        count: expiredPayments.length,
      });
      // Process in batches to avoid overwhelming the system
      const results = await this.processExpiredPayments(expiredPayments);
      // Update metrics
      this.metrics.totalChecks++;
      this.metrics.totalExpired += results.expiredCount;
      this.metrics.totalFailed += results.failedCount;
      this.metrics.lastCheckAt = timestamp;
      this.metrics.lastCheckDuration = Date.now() - startTime;
      const result: ExpirationCheckResult = {
        timestamp,
        foundCount: expiredPayments.length,
        expiredCount: results.expiredCount,
        failedCount: results.failedCount,
        durationMs: this.metrics.lastCheckDuration,
        errors: results.errors,
      };
      this.logger?.info('Invoice expiration check complete', result);
      return result;
    } catch (error) {
      this.logger?.error('Invoice expiration check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        timestamp,
        foundCount: 0,
        expiredCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
        errors: [
          {
            paymentId: 'N/A',
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    } finally {
      this.isChecking = false;
    }
  }
  /**
   * Find all payments that have expired
   *
   * @private
   * @returns Promise resolving to array of expired payments
   */
  private async findExpiredPayments(): Promise<Payment[]> {
    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('state', PaymentState.PENDING)
      .lt('expires_at', now)
      .limit(this.batchSize);
    if (error) {
      this.logger?.error('Database query failed', {
        error: error.message,
      });
      throw new Error(`Failed to query expired payments: ${error.message}`);
    }
    return (data || []) as Payment[];
  }
  /**
   * Process expired payments: transition state and notify users
   *
   * @private
   * @param payments Array of expired payments to process
   * @returns Processing results
   */
  private async processExpiredPayments(payments: Payment[]): Promise<{
    expiredCount: number;
    failedCount: number;
    errors: Array<{ paymentId: string; error: string }>;
  }> {
    let expiredCount = 0;
    let failedCount = 0;
    const errors: Array<{ paymentId: string; error: string }> = [];
    // Process payments sequentially to maintain order and avoid race conditions
    for (const payment of payments) {
      try {
        await this.expirePayment(payment);
        expiredCount++;
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          paymentId: payment.id,
          error: errorMessage,
        });
        this.logger?.error('Failed to expire payment', {
          paymentId: payment.id,
          error: errorMessage,
        });
      }
    }
    return { expiredCount, failedCount, errors };
  }
  /**
   * Expire a single payment and notify the user
   *
   * @private
   * @param payment Payment to expire
   * @returns Promise that resolves when expiration is complete
   */
  private async expirePayment(payment: Payment): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const expiredDurationSeconds = now - payment.expires_at;
    // Step 1: Transition payment to EXPIRED state
    await this.stateMachine.transition(payment.id, PaymentState.EXPIRED, {
      reason: 'invoice_expired',
      expired_at: now,
      previous_expires_at: payment.expires_at,
    });
    this.logger?.debug('Payment transitioned to EXPIRED', {
      paymentId: payment.id,
      userId: payment.user_id,
    });
    // Step 2: Send email notification to user
    await this.emailService.sendInvoiceExpiredEmail(payment.user_id, payment.id, {
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      expiresAt: new Date(payment.expires_at * 1000), // Convert to Date
    });
    // Step 3: Clean up Lightning node resources
    if (this.lightningNodeService && payment.payment_hash) {
      try {
        await this.lightningNodeService.cancelInvoice(payment.payment_hash);
        this.metrics.totalCleanedUp++;
        this.logger?.debug('Lightning node invoice cancelled', {
          paymentId: payment.id,
          paymentHash: payment.payment_hash,
        });
      } catch (error) {
        // Log but don't fail - cleanup is best effort
        this.logger?.warn('Failed to cancel Lightning invoice', {
          paymentId: payment.id,
          paymentHash: payment.payment_hash,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    // Step 4: Emit analytics event for invoice expiration
    if (this.analyticsService) {
      await this.analyticsService.track('invoice_expired', {
        payment_id: payment.id,
        user_id: payment.user_id,
        amount: payment.amount,
        currency: payment.currency,
        expires_at: payment.expires_at,
        expired_at: now,
        expired_duration_seconds: expiredDurationSeconds,
        description: payment.description,
      });
      this.logger?.debug('Analytics event emitted for expired invoice', {
        paymentId: payment.id,
        expiredDurationSeconds,
      });
    }
    this.logger?.info('Invoice expired and user notified', {
      paymentId: payment.id,
      userId: payment.user_id,
      amount: payment.amount,
      currency: payment.currency,
      expiredDurationSeconds,
    });
  }
  /**
   * Get service metrics for monitoring
   *
   * @returns Current service metrics
   */
  getMetrics(): {
    totalChecks: number;
    totalExpired: number;
    totalFailed: number;
    totalCleanedUp: number;
    lastCheckAt: Date | null;
    lastCheckDuration: number;
    isRunning: boolean;
    checkIntervalMs: number;
  } {
    return {
      ...this.metrics,
      isRunning: this.intervalId !== undefined,
      checkIntervalMs: this.checkIntervalMs,
    };
  }
  /**
   * Manually expire a specific payment
   *
   * Useful for administrative operations or testing
   *
   * @param paymentId Payment UUID to expire
   * @returns Promise that resolves when payment is expired
   */
  async manuallyExpirePayment(paymentId: string): Promise<void> {
    this.logger?.info('Manually expiring payment', { paymentId });
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();
    if (error || !payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    if (payment.state !== PaymentState.PENDING) {
      throw new Error(`Payment is not in PENDING state: ${payment.state}`);
    }
    await this.expirePayment(payment as Payment);
    this.logger?.info('Payment manually expired', { paymentId });
  }
  /**
   * Cleanup method to be called on service shutdown
   *
   * Stops the scheduler and cleans up resources
   */
  async shutdown(): Promise<void> {
    this.logger?.info('Shutting down Invoice Expiration Service');
    this.stop();
  }
}
/**
 * Factory function to create an Invoice Expiration Service
 *
 * @param config Service configuration
 * @returns InvoiceExpirationService instance
 */
export function createInvoiceExpirationService(
  config: InvoiceExpirationConfig
): InvoiceExpirationService {
  return new InvoiceExpirationService(config);
}
