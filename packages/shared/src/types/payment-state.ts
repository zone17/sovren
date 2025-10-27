/**
 * Payment State Machine Types
 *
 * Comprehensive type definitions for payment state management, transitions,
 * and audit trail tracking. Implements a robust state machine pattern for
 * payment processing with validation and event sourcing.
 *
 * @module payment-state
 * @category Types
 * @see Story #001: Define Payment State Machine Types and Enums
 */

import { z } from 'zod';

/**
 * Payment State Enum
 *
 * Defines all possible states a payment can be in during its lifecycle.
 * State transitions are controlled by the PaymentStateMachine service.
 *
 * States:
 * - PENDING: Initial state, awaiting processing
 * - PROCESSING: Payment is being processed by payment provider
 * - COMPLETED: Payment successfully completed
 * - FAILED: Payment failed (can be retried)
 * - EXPIRED: Payment expired without completion
 * - REFUNDED: Payment was completed and then refunded
 */
export enum PaymentState {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
}

/**
 * Payment State Zod Schema
 * Runtime validation for payment states
 */
export const PaymentStateSchema = z.nativeEnum(PaymentState);

/**
 * Payment Transition Interface
 *
 * Represents a state transition in the payment state machine.
 * Includes validation and metadata for audit purposes.
 */
export interface PaymentTransition {
  /** Source state (where we're coming from) */
  from: PaymentState;

  /** Destination state (where we're going to) */
  to: PaymentState;

  /** Action that triggered this transition (e.g., 'user_initiated', 'webhook_received') */
  action: string;

  /** Optional validator function to check if transition is allowed */
  validator?: (payment: Payment) => Promise<boolean>;

  /** Timestamp when transition occurred */
  timestamp: number;

  /** Additional metadata about the transition */
  metadata?: Record<string, unknown>;
}

/**
 * Payment Transition Zod Schema
 */
export const PaymentTransitionSchema = z.object({
  from: PaymentStateSchema,
  to: PaymentStateSchema,
  action: z.string().min(1),
  timestamp: z.number().positive(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Payment Event Zod Schema
 *
 * Audit trail event for payment state changes.
 * Stored in payment_events table for compliance and debugging.
 */
export const PaymentEventSchema = z.object({
  /** Unique event identifier */
  id: z.string().uuid(),

  /** Reference to the payment */
  paymentId: z.string().uuid(),

  /** Current state after this event */
  state: PaymentStateSchema,

  /** Previous state before this event (null for initial event) */
  previousState: PaymentStateSchema.optional(),

  /** Timestamp when event occurred */
  timestamp: z.number().positive(),

  /** Event metadata (error details, webhook data, etc.) */
  metadata: z.record(z.unknown()),

  /** User who triggered the event (if applicable) */
  userId: z.string().uuid().optional(),

  /** Error message if state change was due to failure */
  errorMessage: z.string().optional(),

  /** When this event record was created */
  createdAt: z.date(),
});

/**
 * Payment Event Type
 * Inferred from PaymentEventSchema
 */
export type PaymentEvent = z.infer<typeof PaymentEventSchema>;

/**
 * Payment State Machine Configuration
 *
 * Defines the complete configuration for the payment state machine,
 * including allowed transitions, validators, and hooks.
 */
export interface PaymentStateMachineConfig {
  /**
   * Map of allowed state transitions.
   * Key: source state, Value: array of allowed destination states
   */
  allowedTransitions: Map<PaymentState, PaymentState[]>;

  /**
   * Map of validator functions for transitions.
   * Key: 'from_state:to_state', Value: validator function
   */
  transitionValidators: Map<string, (payment: Payment) => Promise<boolean>>;

  /**
   * Map of hook functions to execute after successful transitions.
   * Key: 'from_state:to_state', Value: hook function
   */
  transitionHooks: Map<string, (payment: Payment) => Promise<void>>;
}

/**
 * Payment Interface (Extended from base Payment type)
 *
 * This extends the base Payment type with state machine fields.
 * Note: We'll need to update the base PaymentSchema in index.ts
 */
export interface Payment {
  id: string;
  amount: number;
  currency: string;
  state: PaymentState; // Changed from 'status' to 'state'
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  postId: string;
  invoice?: string;
  preimage?: string;

  // State machine specific fields
  /** When payment will expire (for PENDING state) */
  expiresAt?: Date;

  /** Number of retry attempts (for FAILED state) */
  retryCount?: number;

  /** Last error message if payment failed */
  lastError?: string;

  /** Metadata for additional payment information */
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced Payment Zod Schema with state machine fields
 */
export const PaymentStateMachineSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3), // ISO 4217 currency code
  state: PaymentStateSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().uuid(),
  postId: z.string().uuid(),
  invoice: z.string().optional(),
  preimage: z.string().optional(),
  expiresAt: z.date().optional(),
  retryCount: z.number().nonnegative().default(0),
  lastError: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * State Transition Error Types
 * Custom error classes for state machine operations
 */
export class InvalidTransitionError extends Error {
  constructor(from: PaymentState, to: PaymentState) {
    super(`Invalid state transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class StateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

export class PaymentNotFoundError extends Error {
  constructor(paymentId: string) {
    super(`Payment not found: ${paymentId}`);
    this.name = 'PaymentNotFoundError';
  }
}

/**
 * Webhook Validation Error Types
 * Custom error classes for webhook signature verification
 */
export class WebhookTimestampExpiredError extends Error {
  constructor(
    public timestamp: number,
    public currentTime: number
  ) {
    const age = currentTime - timestamp;
    super(
      `Webhook timestamp expired. Age: ${age}s, Max allowed: 300s. ` +
        `This may be a replay attack.`
    );
    this.name = 'WebhookTimestampExpiredError';
    Object.setPrototypeOf(this, WebhookTimestampExpiredError.prototype);
  }
}

export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super('Webhook signature validation failed. Signature does not match expected value.');
    this.name = 'InvalidWebhookSignatureError';
    Object.setPrototypeOf(this, InvalidWebhookSignatureError.prototype);
  }
}

export class MissingWebhookHeadersError extends Error {
  constructor(missingHeaders?: string[]) {
    const headers = missingHeaders || ['x-webhook-signature', 'x-webhook-timestamp'];
    super(`Missing required webhook headers: ${headers.join(', ')}`);
    this.name = 'MissingWebhookHeadersError';
    Object.setPrototypeOf(this, MissingWebhookHeadersError.prototype);
  }
}

/**
 * State Transition Map
 *
 * Defines which states can transition to which other states.
 * This is the core of the state machine logic.
 *
 * Transition rules:
 * - PENDING → PROCESSING (payment initiated)
 * - PENDING → EXPIRED (payment timed out)
 * - PENDING → FAILED (payment rejected immediately)
 * - PROCESSING → COMPLETED (payment confirmed)
 * - PROCESSING → FAILED (payment provider error)
 * - COMPLETED → REFUNDED (refund issued)
 * - FAILED → PENDING (retry initiated)
 * - EXPIRED → terminal state (no transitions)
 * - REFUNDED → terminal state (no transitions)
 */
export const ALLOWED_TRANSITIONS: ReadonlyMap<PaymentState, readonly PaymentState[]> = new Map([
  [PaymentState.PENDING, [PaymentState.PROCESSING, PaymentState.EXPIRED, PaymentState.FAILED]],
  [PaymentState.PROCESSING, [PaymentState.COMPLETED, PaymentState.FAILED]],
  [PaymentState.COMPLETED, [PaymentState.REFUNDED]],
  [PaymentState.FAILED, [PaymentState.PENDING]], // Allow retry
  [PaymentState.EXPIRED, []], // Terminal state
  [PaymentState.REFUNDED, []], // Terminal state
]);

/**
 * Terminal States
 * States that cannot transition to any other state
 */
export const TERMINAL_STATES: readonly PaymentState[] = [
  PaymentState.EXPIRED,
  PaymentState.REFUNDED,
];

/**
 * Type guard to check if a state is terminal
 */
export function isTerminalState(state: PaymentState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * Type guard to check if a transition is allowed
 */
export function isTransitionAllowed(from: PaymentState, to: PaymentState): boolean {
  const allowedStates = ALLOWED_TRANSITIONS.get(from);
  return allowedStates ? allowedStates.includes(to) : false;
}

/**
 * Get all allowed transitions from a given state
 */
export function getAllowedTransitions(from: PaymentState): readonly PaymentState[] {
  return ALLOWED_TRANSITIONS.get(from) || [];
}
