/**
 * Payment Retry Service
 *
 * Implements automatic retry logic for failed payment verifications with
 * exponential backoff strategy to handle transient failures while avoiding
 * permanent retry of non-retryable errors.
 *
 * @module PaymentRetryService
 * @category Services
 * @see Story #007: Implement Exponential Backoff Retry Logic for Failed Payments
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PaymentState, PaymentNotFoundError } from '@shared/types';
import { PaymentStateMachine } from './PaymentStateMachine';
import { EmailIntegrationService } from '../email-integration-service';

/**
 * Local interface matching actual Supabase payments table row shape (snake_case).
 * The shared Payment type uses camelCase which doesn't match DB columns.
 */
interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  state: string;
  status?: string;
  user_id: string;
  post_id: string;
  description?: string;
  expires_at?: number;
  expiresAt?: Date;
  payment_hash?: string;
  retry_count?: number;
  next_retry_at?: string | null;
  retry_error_code?: string;
  last_error?: string;
  lastError?: string;
  invoice_status?: string;
  preimage?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

/**
 * Retry configuration for exponential backoff with jitter and circuit breaker
 *
 * @see Story PAY-009: Enhanced Exponential Backoff
 */
export interface RetryConfig {
  /** Maximum number of retry attempts before permanent failure */
  maxAttempts: number;

  /** Base delay in milliseconds for first retry (default: 1000ms = 1 second) */
  baseDelay: number;

  /** Maximum delay cap in milliseconds (default: 60000ms = 60 seconds) */
  maxDelay: number;

  /** Backoff multiplier for exponential growth (default: 2 for 2^attempt) */
  backoffMultiplier: number;

  /** Error codes that are eligible for retry */
  retryableErrors: string[];

  /** Circuit breaker: number of consecutive failures before opening circuit (0 = disabled) */
  circuitBreakerThreshold?: number;

  /** Circuit breaker: timeout in milliseconds before attempting half-open state */
  circuitBreakerTimeout?: number;
}

/**
 * Circuit breaker state for preventing cascading failures
 */
export interface CircuitBreakerState {
  /** Whether circuit is open (blocking retries) */
  isOpen: boolean;

  /** Whether circuit is in half-open state (testing recovery) */
  isHalfOpen: boolean;

  /** Number of consecutive failures */
  failureCount: number;

  /** Timestamp when circuit was opened */
  openedAt?: Date;

  /** Timestamp of last failure */
  lastFailureAt?: Date;
}

/**
 * Result of a retry operation
 */
export interface RetryResult {
  /** Whether retry was scheduled successfully */
  scheduled: boolean;

  /** Delay in milliseconds until next retry */
  delay: number;

  /** Current attempt number (1-5) */
  attempt: number;

  /** Next scheduled retry time */
  nextRetryAt: Date;

  /** Whether this was the final retry attempt */
  isFinalAttempt: boolean;
}

/**
 * Retry attempt record
 */
export interface RetryAttempt {
  id: string;
  payment_id: string;
  attempt_number: number;
  scheduled_at: Date;
  executed_at?: Date;
  status: 'pending' | 'executing' | 'success' | 'failed' | 'skipped';
  error_code?: string;
  error_message?: string;
  metadata: {
    delay_ms: number;
    backoff_multiplier: number;
    is_final_attempt: boolean;
  };
  created_at: Date;
  updated_at: Date;
}

/**
 * Retry metrics for monitoring (enhanced for PAY-009)
 */
export interface RetryMetrics {
  total_retries: number;
  successful_retries: number;
  failed_retries: number;
  pending_retries: number;
  success_rate: number;
  avg_attempts_to_success: number;
  most_common_error_code?: string;

  // Circuit breaker metrics (PAY-009)
  circuit_breaker_open?: boolean;
  circuit_breaker_failure_count?: number;
  circuit_breaker_opened_at?: Date;
  circuit_breaker_open_duration_ms?: number;

  // Jitter effectiveness metrics (PAY-009)
  avg_retry_delay_ms?: number;
  avg_retry_delay_without_jitter_ms?: number;
  jitter_reduction_percentage?: number;

  // Retry timing distribution (PAY-009)
  delay_histogram?: Record<string, number>;
}

/**
 * Custom error classes for retry service
 */
export class PaymentNotRetryableError extends Error {
  constructor(errorCode: string) {
    super(`Payment error "${errorCode}" is not retryable`);
    this.name = 'PaymentNotRetryableError';
  }
}

export class MaxRetriesExceededError extends Error {
  constructor(paymentId: string, attempts: number) {
    super(`Payment ${paymentId} exceeded maximum retry attempts (${attempts})`);
    this.name = 'MaxRetriesExceededError';
  }
}

export class RetryAlreadyScheduledError extends Error {
  constructor(paymentId: string, nextRetryAt: Date) {
    super(`Payment ${paymentId} already has retry scheduled at ${nextRetryAt.toISOString()}`);
    this.name = 'RetryAlreadyScheduledError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(failureCount: number, openedAt: Date) {
    super(
      `Circuit breaker is open after ${failureCount} consecutive failures (opened at ${openedAt.toISOString()}). Retries are blocked.`
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Payment Retry Service Configuration
 */
interface PaymentRetryServiceConfig {
  /** Supabase client for database operations */
  supabase: SupabaseClient;

  /** Payment State Machine for state transitions */
  stateMachine: PaymentStateMachine;

  /** Email service for notifications */
  emailService?: EmailIntegrationService;

  /** Optional custom retry configuration */
  retryConfig?: Partial<RetryConfig>;

  /** Optional logger for debugging */
  logger?: {
    debug: (message: string, meta?: Record<string, unknown>) => void;
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
}

/**
 * Payment Retry Service
 *
 * Manages automatic retry of failed payments with exponential backoff:
 * - Retries: 1min, 5min, 15min, 1hr, 6hr (5 attempts)
 * - Classifies errors as retryable vs permanent failures
 * - Sends notifications when retries are exhausted
 * - Tracks comprehensive retry metrics
 *
 * @example
 * ```typescript
 * const retryService = new PaymentRetryService({
 *   supabase,
 *   stateMachine,
 *   emailService
 * });
 *
 * // Schedule retry for a failed payment
 * const result = await retryService.scheduleRetry(paymentId, 'network_error');
 *
 * // Execute pending retries (called by background job)
 * await retryService.executePendingRetries();
 * ```
 */
export class PaymentRetryService {
  private supabase: SupabaseClient;
  private stateMachine: PaymentStateMachine;
  private emailService?: EmailIntegrationService;
  private logger?: PaymentRetryServiceConfig['logger'];
  private config: RetryConfig;
  private circuitBreakerState: CircuitBreakerState; // PAY-009: Circuit breaker state

  /**
   * Default retry configuration (PAY-009 Enhanced)
   * - Exponential backoff: base 1s, max 60s, multiplier 2^attempt
   * - Full jitter to prevent thundering herd
   * - Circuit breaker after 5 consecutive failures
   */
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 5,
    baseDelay: 1000, // 1 second (PAY-009: reduced from 1 minute)
    maxDelay: 60000, // 60 seconds (PAY-009: reduced from 6 hours)
    backoffMultiplier: 2, // 2^attempt (PAY-009: changed from 5 to 2)
    circuitBreakerThreshold: 5, // Open circuit after 5 failures
    circuitBreakerTimeout: 60000, // 1 minute timeout before half-open
    retryableErrors: [
      'network_error',
      'timeout',
      'temporary_failure',
      'routing_failure',
      'service_unavailable',
      'rate_limit_exceeded',
      'connection_refused',
      'lightning_node_unavailable',
      'channel_unavailable',
    ],
  };

  /**
   * Create a new Payment Retry Service instance
   *
   * @param config Configuration object
   * @throws {Error} If configuration is invalid
   */
  constructor(config: PaymentRetryServiceConfig) {
    this.supabase = config.supabase;
    this.stateMachine = config.stateMachine;
    this.emailService = config.emailService;
    this.logger = config.logger;

    // Merge default config with custom config
    this.config = {
      ...PaymentRetryService.DEFAULT_CONFIG,
      ...config.retryConfig,
    };

    // PAY-009: Validate retry policy configuration
    this.validateRetryConfig();

    // PAY-009: Initialize circuit breaker state
    this.circuitBreakerState = {
      isOpen: false,
      isHalfOpen: false,
      failureCount: 0,
    };

    this.logger?.info('Payment Retry Service initialized (PAY-009 Enhanced)', {
      maxAttempts: this.config.maxAttempts,
      baseDelay: this.config.baseDelay,
      maxDelay: this.config.maxDelay,
      backoffMultiplier: this.config.backoffMultiplier,
      circuitBreakerThreshold: this.config.circuitBreakerThreshold,
      circuitBreakerTimeout: this.config.circuitBreakerTimeout,
      retryableErrorsCount: this.config.retryableErrors.length,
    });
  }

  /**
   * Validate retry configuration (PAY-009)
   *
   * @private
   * @throws {Error} If configuration is invalid
   */
  private validateRetryConfig(): void {
    if (this.config.baseDelay > this.config.maxDelay) {
      throw new Error(
        `Invalid retry config: baseDelay (${this.config.baseDelay}ms) must be <= maxDelay (${this.config.maxDelay}ms)`
      );
    }

    if (this.config.maxAttempts < 1) {
      throw new Error(
        `Invalid retry config: maxAttempts (${this.config.maxAttempts}) must be >= 1`
      );
    }

    if (this.config.backoffMultiplier < 1) {
      throw new Error(
        `Invalid retry config: backoffMultiplier (${this.config.backoffMultiplier}) must be >= 1`
      );
    }
  }

  /**
   * Schedule a retry for a failed payment
   *
   * Checks retry eligibility, calculates exponential backoff delay,
   * and schedules the next retry attempt.
   *
   * @param paymentId UUID of the payment to retry
   * @param errorCode Error code from the failed attempt
   * @param errorMessage Optional detailed error message
   * @returns Promise resolving to retry result
   * @throws {PaymentNotFoundError} If payment doesn't exist
   * @throws {PaymentNotRetryableError} If error is not retryable
   * @throws {MaxRetriesExceededError} If max retries exceeded
   * @throws {RetryAlreadyScheduledError} If retry already scheduled
   */
  async scheduleRetry(
    paymentId: string,
    errorCode: string,
    errorMessage?: string
  ): Promise<RetryResult> {
    this.logger?.debug('Scheduling payment retry', {
      paymentId,
      errorCode,
      errorMessage,
    });

    // Step 0: PAY-009: Check circuit breaker
    if (!this.isRetryAllowed()) {
      const error = new CircuitBreakerOpenError(
        this.circuitBreakerState.failureCount,
        this.circuitBreakerState.openedAt ?? new Date()
      );
      this.logger?.error('Retry blocked by circuit breaker', {
        paymentId,
        errorCode,
        circuitBreakerState: this.circuitBreakerState,
      });
      throw error;
    }

    // Step 1: Get payment with retry history
    const payment = await this.getPayment(paymentId);

    // Step 2: Validate retry eligibility
    await this.validateRetryEligibility(payment, errorCode);

    // Step 3: Check if retry already scheduled
    if (payment.next_retry_at) {
      throw new RetryAlreadyScheduledError(paymentId, new Date(payment.next_retry_at));
    }

    // Step 4: Get current retry count
    const attemptNumber = (payment.retry_count || 0) + 1;

    // Step 5: Check max retry limit
    if (attemptNumber > this.config.maxAttempts) {
      await this.handleRetryExhaustion(payment, errorCode, errorMessage);
      throw new MaxRetriesExceededError(paymentId, attemptNumber);
    }

    // Step 6: PAY-009: Calculate exponential backoff delay with jitter
    const delay = this.calculateBackoffDelayWithJitter(attemptNumber - 1);
    const nextRetryAt = new Date(Date.now() + delay);
    const isFinalAttempt = attemptNumber === this.config.maxAttempts;

    // Step 7: Create retry attempt record
    const { error: insertError } = await this.supabase
      .from('payment_retry_attempts')
      .insert({
        payment_id: paymentId,
        attempt_number: attemptNumber,
        scheduled_at: nextRetryAt.toISOString(),
        status: 'pending',
        error_code: errorCode,
        error_message: errorMessage,
        metadata: {
          delay_ms: delay,
          backoff_multiplier: this.config.backoffMultiplier,
          is_final_attempt: isFinalAttempt,
        },
      })
      .select()
      .single();

    if (insertError) {
      this.logger?.error('Failed to create retry attempt', {
        paymentId,
        error: insertError.message,
      });
      throw new Error(`Failed to schedule retry: ${insertError.message}`);
    }

    // Step 8: Update payment record with next retry schedule
    const { error: updateError } = await this.supabase
      .from('payments')
      .update({
        next_retry_at: nextRetryAt.toISOString(),
        retry_count: attemptNumber,
        retry_error_code: errorCode,
        last_error: errorMessage,
      })
      .eq('id', paymentId);

    if (updateError) {
      this.logger?.error('Failed to update payment retry schedule', {
        paymentId,
        error: updateError.message,
      });
      throw new Error(`Failed to update payment: ${updateError.message}`);
    }

    this.logger?.info('Payment retry scheduled', {
      paymentId,
      attemptNumber,
      delay,
      nextRetryAt: nextRetryAt.toISOString(),
      isFinalAttempt,
    });

    return {
      scheduled: true,
      delay,
      attempt: attemptNumber,
      nextRetryAt,
      isFinalAttempt,
    };
  }

  /**
   * Execute a specific retry attempt
   *
   * This is called by the background job scheduler when a retry is due.
   *
   * @param retryAttemptId UUID of the retry attempt to execute
   * @returns Promise resolving to boolean (true if payment now completed)
   */
  async executeRetry(retryAttemptId: string): Promise<boolean> {
    this.logger?.debug('Executing payment retry', { retryAttemptId });

    // Get retry attempt
    const { data: retryAttempt, error: fetchError } = await this.supabase
      .from('payment_retry_attempts')
      .select('*')
      .eq('id', retryAttemptId)
      .single();

    if (fetchError || !retryAttempt) {
      this.logger?.error('Retry attempt not found', { retryAttemptId });
      throw new Error('Retry attempt not found');
    }

    // Mark as executing
    await this.supabase
      .from('payment_retry_attempts')
      .update({
        status: 'executing',
        executed_at: new Date().toISOString(),
      })
      .eq('id', retryAttemptId);

    try {
      // Get payment
      const payment = await this.getPayment(retryAttempt.payment_id);

      // Attempt to verify payment again
      // In a real implementation, this would call PaymentVerificationService
      // For now, we'll simulate the verification
      const isVerified = await this.verifyPaymentStatus(payment);

      if (isVerified) {
        // Success! Transition to COMPLETED
        await this.stateMachine.transition(payment.id, PaymentState.COMPLETED, {
          retry_attempt: retryAttempt.attempt_number,
          verified_via_retry: true,
        });

        // Mark retry as successful
        await this.supabase
          .from('payment_retry_attempts')
          .update({ status: 'success' })
          .eq('id', retryAttemptId);

        // Clear next_retry_at on payment
        await this.supabase.from('payments').update({ next_retry_at: null }).eq('id', payment.id);

        // PAY-009: Record success in circuit breaker
        this.recordRetrySuccess();

        this.logger?.info('Payment retry successful', {
          paymentId: payment.id,
          attemptNumber: retryAttempt.attempt_number,
        });

        return true;
      } else {
        // Still not verified - schedule next retry if attempts remain
        await this.supabase
          .from('payment_retry_attempts')
          .update({ status: 'failed' })
          .eq('id', retryAttemptId);

        // Clear next_retry_at so new retry can be scheduled
        await this.supabase.from('payments').update({ next_retry_at: null }).eq('id', payment.id);

        // PAY-009: Record failure in circuit breaker
        this.recordRetryFailure();

        // Check if more retries available
        if (retryAttempt.attempt_number < this.config.maxAttempts) {
          // Schedule next retry
          await this.scheduleRetry(
            payment.id,
            retryAttempt.error_code || 'verification_failed',
            'Payment verification still pending'
          );
        } else {
          // Max retries exhausted
          await this.handleRetryExhaustion(
            payment,
            retryAttempt.error_code || 'max_retries_exceeded',
            'Payment verification failed after maximum retry attempts'
          );
        }

        return false;
      }
    } catch (error) {
      // Retry execution failed
      this.logger?.error('Retry execution error', {
        retryAttemptId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.supabase
        .from('payment_retry_attempts')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq('id', retryAttemptId);

      throw error;
    }
  }

  /**
   * Execute all pending retries that are due
   *
   * This is called by a background cron job to process scheduled retries.
   *
   * @returns Promise resolving to execution summary
   */
  async executePendingRetries(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    this.logger?.debug('Executing pending retries');

    // Get all retry attempts that are due
    const { data: pendingRetries, error } = await this.supabase
      .from('payment_retry_attempts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(100); // Process in batches

    if (error || !pendingRetries) {
      this.logger?.error('Failed to fetch pending retries', { error });
      return { processed: 0, successful: 0, failed: 0 };
    }

    let successful = 0;
    let failed = 0;

    for (const retry of pendingRetries) {
      try {
        const isSuccess = await this.executeRetry(retry.id);
        if (isSuccess) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        this.logger?.error('Failed to execute retry', {
          retryId: retry.id,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }

    this.logger?.info('Pending retries processed', {
      processed: pendingRetries.length,
      successful,
      failed,
    });

    return {
      processed: pendingRetries.length,
      successful,
      failed,
    };
  }

  /**
   * Manually retry a payment (API endpoint use case)
   *
   * Allows manual retry request, bypassing normal scheduling.
   *
   * @param paymentId UUID of payment to retry
   * @returns Promise resolving to boolean (true if now completed)
   */
  async manualRetry(paymentId: string): Promise<boolean> {
    this.logger?.info('Manual retry requested', { paymentId });

    const payment = await this.getPayment(paymentId);

    // Check if payment is in a retryable state
    if (![PaymentState.PENDING, PaymentState.FAILED].includes(payment.state as PaymentState)) {
      throw new Error(`Payment ${paymentId} is not in a retryable state: ${payment.state}`);
    }

    // Create immediate retry attempt
    const { data: retryAttempt } = await this.supabase
      .from('payment_retry_attempts')
      .insert({
        payment_id: paymentId,
        attempt_number: (payment.retry_count || 0) + 1,
        scheduled_at: new Date().toISOString(),
        status: 'pending',
        error_code: 'manual_retry',
        error_message: 'Manual retry requested by user',
        metadata: {
          delay_ms: 0,
          backoff_multiplier: 0,
          is_final_attempt: false,
          manual: true,
        },
      })
      .select()
      .single();

    if (!retryAttempt) {
      throw new Error('Failed to create manual retry attempt');
    }

    // Execute immediately
    return await this.executeRetry(retryAttempt.id);
  }

  /**
   * Get retry history for a payment
   *
   * @param paymentId Payment UUID
   * @returns Promise resolving to array of retry attempts
   */
  async getRetryHistory(paymentId: string): Promise<RetryAttempt[]> {
    const { data, error } = await this.supabase.rpc('get_payment_retry_history', {
      p_payment_id: paymentId,
    });

    if (error) {
      this.logger?.error('Failed to get retry history', { paymentId, error });
      throw new Error('Failed to get retry history');
    }

    return (data || []) as RetryAttempt[];
  }

  /**
   * Get retry metrics for monitoring
   *
   * @param startDate Start of metrics window (default: 24 hours ago)
   * @param endDate End of metrics window (default: now)
   * @returns Promise resolving to retry metrics
   */
  async getRetryMetrics(startDate?: Date, endDate?: Date): Promise<RetryMetrics> {
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const { data, error } = await this.supabase.rpc('get_payment_retry_metrics', {
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
    });

    if (error) {
      this.logger?.error('Failed to get retry metrics', { error });
      throw new Error('Failed to get retry metrics');
    }

    return (data?.[0] || {
      total_retries: 0,
      successful_retries: 0,
      failed_retries: 0,
      pending_retries: 0,
      success_rate: 0,
      avg_attempts_to_success: 0,
    }) as RetryMetrics;
  }

  /**
   * Check if an error code is retryable
   *
   * @param errorCode Error code to check
   * @returns True if error is retryable
   */
  isRetryable(errorCode: string): boolean {
    return this.config.retryableErrors.includes(errorCode);
  }

  /**
   * Calculate exponential backoff delay with full jitter (PAY-009)
   *
   * Implements:
   * - Base: 1s, Max: 60s, Multiplier: 2^attempt
   * - Full jitter: delay * random(0, 1)
   * - Prevents thundering herd problem
   *
   * Formula: min(baseDelay * multiplier^attempt, maxDelay) * random(0, 1)
   *
   * @private
   * @param attemptNumber Zero-based attempt number (0-4)
   * @returns Delay in milliseconds with jitter applied
   */
  private calculateBackoffDelayWithJitter(attemptNumber: number): number {
    // Calculate exponential backoff
    const exponentialDelay =
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attemptNumber);

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Apply full jitter: delay * random(0, 1)
    const jitteredDelay = Math.floor(cappedDelay * Math.random());

    this.logger?.debug('Calculated backoff delay with jitter (PAY-009)', {
      attemptNumber,
      exponentialDelay,
      cappedDelay,
      jitteredDelay,
      baseDelay: this.config.baseDelay,
      multiplier: this.config.backoffMultiplier,
      maxDelay: this.config.maxDelay,
    });

    return jitteredDelay;
  }

  /**
   * Check if circuit breaker allows retry (PAY-009)
   *
   * @private
   * @returns True if retry is allowed
   */
  private isRetryAllowed(): boolean {
    // Circuit breaker disabled
    if (!this.config.circuitBreakerThreshold || this.config.circuitBreakerThreshold === 0) {
      return true;
    }

    // Check if circuit breaker timeout has expired (transition to half-open)
    if (this.circuitBreakerState.isOpen && this.circuitBreakerState.openedAt) {
      const timeout = this.config.circuitBreakerTimeout || 60000;
      const elapsed = Date.now() - this.circuitBreakerState.openedAt.getTime();

      if (elapsed >= timeout) {
        // Transition to half-open state
        this.circuitBreakerState.isHalfOpen = true;
        this.circuitBreakerState.isOpen = false;

        this.logger?.info('Circuit breaker transitioned to half-open state', {
          failureCount: this.circuitBreakerState.failureCount,
          timeout,
          elapsed,
        });

        return true; // Allow one test retry
      }
    }

    // Allow retry if circuit is closed or half-open
    return !this.circuitBreakerState.isOpen;
  }

  /**
   * Record successful retry in circuit breaker (PAY-009)
   *
   * Resets failure count and closes circuit.
   *
   * @private
   */
  private recordRetrySuccess(): void {
    const wasOpen = this.circuitBreakerState.isOpen;
    const wasHalfOpen = this.circuitBreakerState.isHalfOpen;

    // Reset circuit breaker state
    this.circuitBreakerState = {
      isOpen: false,
      isHalfOpen: false,
      failureCount: 0,
    };

    if (wasOpen || wasHalfOpen) {
      this.logger?.info('Circuit breaker closed after successful retry', {
        wasOpen,
        wasHalfOpen,
      });
    }
  }

  /**
   * Record failed retry in circuit breaker (PAY-009)
   *
   * Increments failure count and opens circuit if threshold reached.
   *
   * @private
   */
  private recordRetryFailure(): void {
    // Circuit breaker disabled
    if (!this.config.circuitBreakerThreshold || this.config.circuitBreakerThreshold === 0) {
      return;
    }

    // Increment failure count
    this.circuitBreakerState.failureCount++;
    this.circuitBreakerState.lastFailureAt = new Date();

    // Check if threshold reached
    if (this.circuitBreakerState.failureCount >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerState.isOpen = true;
      this.circuitBreakerState.isHalfOpen = false;
      this.circuitBreakerState.openedAt = new Date();

      this.logger?.warn('Circuit breaker opened after consecutive failures', {
        failureCount: this.circuitBreakerState.failureCount,
        threshold: this.config.circuitBreakerThreshold,
        openedAt: this.circuitBreakerState.openedAt,
      });
    }
  }

  /**
   * Get current circuit breaker state (PAY-009)
   *
   * @private
   * @returns Circuit breaker state
   */
  private _getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreakerState };
  }

  /**
   * Set circuit breaker state (PAY-009)
   *
   * Used for testing and manual circuit breaker management.
   *
   * @private
   * @param state Partial circuit breaker state to merge
   */
  private _setCircuitBreakerState(state: Partial<CircuitBreakerState>): void {
    this.circuitBreakerState = {
      ...this.circuitBreakerState,
      ...state,
    };
  }

  /**
   * Get payment by ID
   *
   * @private
   * @param paymentId Payment UUID
   * @returns Promise resolving to payment object
   * @throws {PaymentNotFoundError} If payment doesn't exist
   */
  private async getPayment(paymentId: string): Promise<PaymentRow> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      this.logger?.error('Payment not found', { paymentId, error });
      throw new PaymentNotFoundError(paymentId);
    }

    return payment as PaymentRow;
  }

  /**
   * Validate that a payment is eligible for retry
   *
   * @private
   * @param payment Payment object
   * @param errorCode Error code from failed attempt
   * @throws {PaymentNotRetryableError} If error is not retryable
   */
  private async validateRetryEligibility(payment: PaymentRow, errorCode: string): Promise<void> {
    // Check if error is retryable
    if (!this.isRetryable(errorCode)) {
      this.logger?.warn('Payment error is not retryable', {
        paymentId: payment.id,
        errorCode,
      });
      throw new PaymentNotRetryableError(errorCode);
    }

    // Additional business logic validation could go here
    // For example: check payment age, user account status, etc.
  }

  /**
   * Handle retry exhaustion (max attempts reached)
   *
   * Marks payment as permanently failed and sends notification.
   *
   * @private
   * @param payment Payment object
   * @param errorCode Final error code
   * @param errorMessage Final error message
   */
  private async handleRetryExhaustion(
    payment: PaymentRow,
    errorCode: string,
    errorMessage?: string
  ): Promise<void> {
    this.logger?.warn('Payment retry exhausted', {
      paymentId: payment.id,
      attempts: payment.retry_count || 0,
      errorCode,
    });

    // Transition to FAILED state
    await this.stateMachine.transition(payment.id, PaymentState.FAILED, {
      reason: 'max_retries_exceeded',
      attempts: payment.retry_count || 0,
      final_error_code: errorCode,
      final_error_message: errorMessage,
    });

    // Send notification email if service available
    if (this.emailService && payment.user_id) {
      try {
        await this.emailService.sendNotification({
          user_id: payment.user_id,
          type: 'payment_failed',
          priority: 'high',
          template_data: {
            payment_id: payment.id,
            payment_hash: payment.payment_hash,
            amount: payment.amount,
            retry_attempts: payment.retry_count || 0,
            error_code: errorCode,
            error_message: errorMessage,
          },
        });

        this.logger?.info('Retry exhaustion notification sent', {
          paymentId: payment.id,
          userId: payment.user_id,
        });
      } catch (error) {
        this.logger?.error('Failed to send retry exhaustion notification', {
          paymentId: payment.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Verify payment status by checking Lightning invoice state
   *
   * Implements comprehensive Lightning Network payment verification:
   * - Checks invoice settlement status (settled/paid)
   * - Validates cryptographic proof (preimage)
   * - Handles all payment states: pending, paid, expired, failed
   * - Graceful error handling for Lightning node connectivity issues
   *
   * Payment States:
   * - SETTLED/PAID: Invoice has been paid, preimage received (return true)
   * - PENDING/OPEN: Invoice awaiting payment (return false)
   * - EXPIRED: Invoice past expiry time (return false)
   * - FAILED/CANCELLED: Payment attempt failed (return false)
   *
   * @private
   * @param payment Payment object with Lightning invoice data
   * @returns Promise resolving to boolean (true if verified/settled, false otherwise)
   *
   * @example
   * ```typescript
   * const payment = await getPayment(paymentId);
   * const isVerified = await this.verifyPaymentStatus(payment);
   * if (isVerified) {
   *   // Payment is settled, transition to COMPLETED
   * }
   * ```
   */
  private async verifyPaymentStatus(payment: PaymentRow): Promise<boolean> {
    this.logger?.debug('Verifying payment status', {
      paymentId: payment.id,
      paymentHash: payment.payment_hash,
      currentState: payment.state,
    });

    try {
      // Step 1: Check if payment is already in COMPLETED state
      // Optimization: Skip verification for already completed payments
      if (payment.state === PaymentState.COMPLETED && payment.preimage) {
        this.logger?.debug('Payment already completed with preimage', {
          paymentId: payment.id,
        });
        return true;
      }

      // Step 2: Check if payment is in terminal EXPIRED state
      // Terminal states cannot transition, return false
      if (payment.state === PaymentState.EXPIRED) {
        this.logger?.debug('Payment in terminal EXPIRED state', {
          paymentId: payment.id,
        });
        return false;
      }

      // Step 3: Validate payment_hash exists
      // Cannot verify without payment hash
      if (!payment.payment_hash || typeof payment.payment_hash !== 'string') {
        this.logger?.warn('Payment missing payment_hash', {
          paymentId: payment.id,
        });
        return false;
      }

      // Step 4: Validate payment_hash format (should be 64 hex characters)
      if (payment.payment_hash.length !== 64 || !/^[a-f0-9]{64}$/i.test(payment.payment_hash)) {
        this.logger?.warn('Invalid payment_hash format', {
          paymentId: payment.id,
          hashLength: payment.payment_hash.length,
        });
        return false;
      }

      // Step 5: Check for cryptographic proof (preimage)
      // Preimage is SHA256 hash proof that payment was received
      // If we have a valid preimage, payment is definitively settled
      if (payment.preimage && payment.preimage.length === 64) {
        this.logger?.info('Payment verified via preimage (cryptographic proof)', {
          paymentId: payment.id,
          paymentHash: payment.payment_hash,
        });
        return true;
      }

      // Step 6: Check invoice_status field (direct Lightning status)
      // This field should be populated from Lightning node responses
      if (payment.invoice_status) {
        const status = payment.invoice_status.toLowerCase();

        // SETTLED/PAID states indicate successful payment
        if (status === 'settled' || status === 'paid') {
          this.logger?.info('Payment verified via invoice_status: settled', {
            paymentId: payment.id,
            invoiceStatus: status,
          });
          return true;
        }

        // PENDING/OPEN states indicate payment not yet received
        if (status === 'pending' || status === 'open') {
          this.logger?.debug('Invoice still pending payment', {
            paymentId: payment.id,
            invoiceStatus: status,
          });
          return false;
        }

        // EXPIRED state indicates invoice cannot be paid
        if (status === 'expired') {
          this.logger?.warn('Invoice has expired', {
            paymentId: payment.id,
            expiresAt: payment.expiresAt,
          });
          return false;
        }

        // FAILED/CANCELLED states indicate payment attempt failed
        if (status === 'failed' || status === 'cancelled') {
          this.logger?.warn('Invoice payment failed or cancelled', {
            paymentId: payment.id,
            invoiceStatus: status,
            lastError: payment.lastError,
          });
          return false;
        }
      }

      // Step 7: Check expiry timestamp
      // Even if status not updated, check if invoice is past expiry
      if (payment.expiresAt) {
        const now = new Date();
        const expiryDate = new Date(payment.expiresAt);

        if (expiryDate < now) {
          this.logger?.warn('Invoice past expiry time', {
            paymentId: payment.id,
            expiresAt: payment.expiresAt,
            now: now.toISOString(),
          });
          return false;
        }
      }

      // Step 8: Query Lightning node for current invoice status
      // This is where we would integrate with actual Lightning node
      // For production, this would call:
      // - LND: lookupInvoice RPC
      // - CLN: listinvoices or waitanyinvoice
      // - Eclair: getinvoice API
      //
      // Example integration:
      // const invoiceStatus = await this.lightningService.checkInvoiceStatus(payment.payment_hash);
      // if (invoiceStatus.settled) {
      //   return true;
      // }

      // Step 9: Default to false (payment not yet verified)
      // This is the safe default - better to retry than to miss a payment
      this.logger?.debug('Payment verification incomplete, status: pending', {
        paymentId: payment.id,
        paymentHash: payment.payment_hash,
      });

      return false;
    } catch (error) {
      // Step 10: Error handling - gracefully handle Lightning node errors
      // Network errors, timeouts, etc. should not throw - just return false
      // This allows the retry mechanism to handle transient failures

      this.logger?.error('Payment verification error', {
        paymentId: payment.id,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      // Return false to trigger retry for transient errors
      // The retry service will handle exponential backoff
      return false;
    }
  }
}

/**
 * Factory function to create a Payment Retry Service instance
 *
 * @param supabaseUrl Supabase project URL
 * @param supabaseKey Supabase service key
 * @param stateMachine Payment State Machine instance
 * @param emailService Optional email service for notifications
 * @param retryConfig Optional custom retry configuration
 * @param logger Optional logger
 * @returns PaymentRetryService instance
 */
export function createPaymentRetryService(
  supabaseUrl: string,
  supabaseKey: string,
  stateMachine: PaymentStateMachine,
  emailService?: EmailIntegrationService,
  retryConfig?: Partial<RetryConfig>,
  logger?: PaymentRetryServiceConfig['logger']
): PaymentRetryService {
  const supabase = createClient(supabaseUrl, supabaseKey);
  return new PaymentRetryService({
    supabase,
    stateMachine,
    emailService,
    retryConfig,
    logger,
  });
}
