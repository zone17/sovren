/**
 * Payment State Machine Service
 *
 * Centralized service for managing payment state transitions with validation,
 * atomic database updates, and comprehensive audit trail.
 *
 * @module PaymentStateMachine
 * @category Services
 * @see Story #002: Implement Payment State Machine Service
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  PaymentState,
  PaymentEvent,
  PaymentTransition,
  Payment,
  ALLOWED_TRANSITIONS,
  isTransitionAllowed,
  InvalidTransitionError,
  StateTransitionError,
  PaymentNotFoundError,
} from '@shared/types';

/**
 * Payment State Machine Configuration
 */
interface PaymentStateMachineConfig {
  /** Supabase client for database operations */
  supabase: SupabaseClient;

  /** Optional logger for debugging */
  logger?: {
    debug: (message: string, meta?: Record<string, unknown>) => void;
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
}

/**
 * Transition Result
 * Extended payment event with additional metadata
 */
export interface TransitionResult extends PaymentEvent {
  /** Whether transition was successful */
  success: boolean;

  /** Updated payment object after transition */
  payment: Payment;
}

/**
 * Payment State Machine Service
 *
 * Manages all payment state transitions with:
 * - Validation of allowed transitions
 * - Atomic database updates
 * - Comprehensive audit trail
 * - Error handling and recovery
 *
 * @example
 * ```typescript
 * const stateMachine = new PaymentStateMachine({ supabase });
 *
 * // Transition payment from PENDING to PROCESSING
 * const result = await stateMachine.transition(
 *   paymentId,
 *   PaymentState.PROCESSING,
 *   { initiator: 'webhook' }
 * );
 * ```
 */
export class PaymentStateMachine {
  private supabase: SupabaseClient;
  private logger?: PaymentStateMachineConfig['logger'];
  private allowedTransitions: Map<PaymentState, PaymentState[]>;

  /**
   * Create a new Payment State Machine instance
   *
   * @param config Configuration object with Supabase client and optional logger
   */
  constructor(config: PaymentStateMachineConfig) {
    this.supabase = config.supabase;
    this.logger = config.logger;
    this.allowedTransitions = this.initializeTransitions();

    this.logger?.info('Payment State Machine initialized', {
      transitionsCount: this.allowedTransitions.size,
    });
  }

  /**
   * Initialize the allowed state transitions map
   *
   * Creates a mutable copy of ALLOWED_TRANSITIONS for runtime use
   *
   * @private
   * @returns Map of allowed state transitions
   */
  private initializeTransitions(): Map<PaymentState, PaymentState[]> {
    return new Map(ALLOWED_TRANSITIONS);
  }

  /**
   * Transition a payment to a new state
   *
   * Validates the transition, updates the database atomically,
   * and creates an audit trail event.
   *
   * @param paymentId UUID of the payment to transition
   * @param toState Target state to transition to
   * @param metadata Optional metadata about the transition
   * @param userId Optional user who initiated the transition
   * @returns Promise resolving to transition result
   * @throws {PaymentNotFoundError} If payment doesn't exist
   * @throws {InvalidTransitionError} If transition is not allowed
   * @throws {StateTransitionError} If database operation fails
   *
   * @example
   * ```typescript
   * const result = await stateMachine.transition(
   *   '123e4567-e89b-12d3-a456-426614174000',
   *   PaymentState.COMPLETED,
   *   { provider: 'stripe', transactionId: 'tx_123' },
   *   'user-uuid'
   * );
   * ```
   */
  async transition(
    paymentId: string,
    toState: PaymentState,
    metadata?: Record<string, unknown>,
    userId?: string
  ): Promise<TransitionResult> {
    this.logger?.debug('Attempting payment state transition', {
      paymentId,
      toState,
      metadata,
      userId,
    });

    // Step 1: Fetch current payment state
    const payment = await this.getPayment(paymentId);

    // Step 2: Validate transition is allowed
    await this.validateTransition(payment, toState);

    // Step 3: Execute atomic transition in database
    const result = await this.executeTransition(payment, toState, metadata, userId);

    this.logger?.info('Payment state transition successful', {
      paymentId,
      fromState: payment.state,
      toState,
      eventId: result.id,
    });

    return result;
  }

  /**
   * Get payment by ID
   *
   * @private
   * @param paymentId Payment UUID
   * @returns Promise resolving to payment object
   * @throws {PaymentNotFoundError} If payment doesn't exist
   */
  private async getPayment(paymentId: string): Promise<Payment> {
    const { data: payment, error: fetchError } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      this.logger?.error('Payment not found', {
        paymentId,
        error: fetchError?.message,
      });
      throw new PaymentNotFoundError(paymentId);
    }

    return payment as Payment;
  }

  /**
   * Validate that a state transition is allowed
   *
   * @private
   * @param payment Current payment object
   * @param toState Target state
   * @throws {InvalidTransitionError} If transition is not allowed
   */
  private async validateTransition(payment: Payment, toState: PaymentState): Promise<void> {
    const fromState = payment.state;

    // Check if transition is allowed by state machine rules
    if (!isTransitionAllowed(fromState, toState)) {
      this.logger?.warn('Invalid state transition attempted', {
        paymentId: payment.id,
        fromState,
        toState,
      });
      throw new InvalidTransitionError(fromState, toState);
    }

    // Additional business logic validation could go here
    // For example: checking if payment has expired, validating amounts, etc.
  }

  /**
   * Execute state transition atomically in database
   *
   * Uses PostgreSQL stored procedure for atomicity.
   * This ensures that payment state update and event creation
   * happen together or not at all.
   *
   * @private
   * @param payment Current payment object
   * @param toState Target state
   * @param metadata Optional transition metadata
   * @param userId Optional user who initiated transition
   * @returns Promise resolving to transition result
   * @throws {StateTransitionError} If database operation fails
   */
  private async executeTransition(
    payment: Payment,
    toState: PaymentState,
    metadata?: Record<string, unknown>,
    userId?: string
  ): Promise<TransitionResult> {
    const { data, error } = await this.supabase.rpc('transition_payment_state', {
      p_payment_id: payment.id,
      p_from_state: payment.state,
      p_to_state: toState,
      p_metadata: metadata || {},
      p_user_id: userId || null,
    });

    if (error) {
      this.logger?.error('State transition database error', {
        paymentId: payment.id,
        fromState: payment.state,
        toState,
        error: error.message,
      });
      throw new StateTransitionError(error.message);
    }

    // Fetch updated payment and event
    const updatedPayment = await this.getPayment(payment.id);
    const event = await this.getLatestEvent(payment.id);

    return {
      ...event,
      success: true,
      payment: updatedPayment,
    };
  }

  /**
   * Get the latest payment event
   *
   * @private
   * @param paymentId Payment UUID
   * @returns Promise resolving to latest payment event
   */
  private async getLatestEvent(paymentId: string): Promise<PaymentEvent> {
    const { data: event, error } = await this.supabase
      .from('payment_events')
      .select('*')
      .eq('payment_id', paymentId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !event) {
      throw new StateTransitionError('Failed to retrieve payment event after transition');
    }

    return {
      ...event,
      createdAt: new Date(event.created_at),
    } as PaymentEvent;
  }

  /**
   * Get complete event history for a payment
   *
   * Retrieves all state transition events for audit purposes
   *
   * @param paymentId Payment UUID
   * @returns Promise resolving to array of payment events
   *
   * @example
   * ```typescript
   * const history = await stateMachine.getEventHistory(paymentId);
   * console.log('Payment went through', history.length, 'state changes');
   * ```
   */
  async getEventHistory(paymentId: string): Promise<PaymentEvent[]> {
    const { data, error } = await this.supabase.rpc('get_payment_event_history', {
      p_payment_id: paymentId,
    });

    if (error) {
      this.logger?.error('Failed to retrieve payment event history', {
        paymentId,
        error: error.message,
      });
      throw new StateTransitionError('Failed to retrieve payment event history');
    }

    return (data || []).map((event: Record<string, unknown>) => ({
      ...event,
      createdAt: new Date(event.created_at as string),
    })) as PaymentEvent[];
  }

  /**
   * Get current payment state
   *
   * Convenience method to check current payment state without
   * fetching the entire payment object
   *
   * @param paymentId Payment UUID
   * @returns Promise resolving to current payment state
   */
  async getCurrentState(paymentId: string): Promise<PaymentState> {
    const payment = await this.getPayment(paymentId);
    return payment.state;
  }

  /**
   * Check if a transition is allowed for a payment
   *
   * Validates if a payment can transition to a target state
   * without actually performing the transition
   *
   * @param paymentId Payment UUID
   * @param toState Target state
   * @returns Promise resolving to boolean (true if allowed)
   *
   * @example
   * ```typescript
   * const canComplete = await stateMachine.canTransition(
   *   paymentId,
   *   PaymentState.COMPLETED
   * );
   *
   * if (canComplete) {
   *   await stateMachine.transition(paymentId, PaymentState.COMPLETED);
   * }
   * ```
   */
  async canTransition(paymentId: string, toState: PaymentState): Promise<boolean> {
    try {
      const payment = await this.getPayment(paymentId);
      return isTransitionAllowed(payment.state, toState);
    } catch (error) {
      this.logger?.error('Error checking transition eligibility', {
        paymentId,
        toState,
        error,
      });
      return false;
    }
  }

  /**
   * Get all allowed transitions for a payment's current state
   *
   * @param paymentId Payment UUID
   * @returns Promise resolving to array of allowed target states
   */
  async getAllowedTransitions(paymentId: string): Promise<PaymentState[]> {
    const payment = await this.getPayment(paymentId);
    return Array.from(this.allowedTransitions.get(payment.state) || []);
  }

  /**
   * Batch transition multiple payments
   *
   * Useful for bulk operations like expiring all pending payments
   *
   * @param transitions Array of payment IDs and target states
   * @returns Promise resolving to array of successful and failed transitions
   */
  async batchTransition(
    transitions: Array<{
      paymentId: string;
      toState: PaymentState;
      metadata?: Record<string, unknown>;
      userId?: string;
    }>
  ): Promise<{
    successful: TransitionResult[];
    failed: Array<{ paymentId: string; error: Error }>;
  }> {
    const results = await Promise.allSettled(
      transitions.map((t) => this.transition(t.paymentId, t.toState, t.metadata, t.userId))
    );

    const successful: TransitionResult[] = [];
    const failed: Array<{ paymentId: string; error: Error }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          paymentId: transitions[index].paymentId,
          error: result.reason as Error,
        });
      }
    });

    this.logger?.info('Batch transition complete', {
      total: transitions.length,
      successful: successful.length,
      failed: failed.length,
    });

    return { successful, failed };
  }
}

/**
 * Factory function to create a Payment State Machine instance
 *
 * @param supabaseUrl Supabase project URL
 * @param supabaseKey Supabase service key
 * @param logger Optional logger
 * @returns PaymentStateMachine instance
 */
export function createPaymentStateMachine(
  supabaseUrl: string,
  supabaseKey: string,
  logger?: PaymentStateMachineConfig['logger']
): PaymentStateMachine {
  const supabase = createClient(supabaseUrl, supabaseKey);
  return new PaymentStateMachine({ supabase, logger });
}
