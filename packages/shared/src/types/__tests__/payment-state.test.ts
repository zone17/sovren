/**
 * Unit Tests for Payment State Machine Types
 *
 * Tests type definitions, schemas, enums, and helper functions
 * for the payment state machine implementation.
 *
 * @module payment-state.test
 * @category Tests
 * @see Story #001: Define Payment State Machine Types and Enums
 */

import {
  PaymentState,
  PaymentStateSchema,
  PaymentTransitionSchema,
  PaymentEventSchema,
  PaymentStateMachineSchema,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATES,
  isTerminalState,
  isTransitionAllowed,
  getAllowedTransitions,
  InvalidTransitionError,
  StateTransitionError,
  PaymentNotFoundError,
} from '../payment-state';

describe('PaymentState Enum', () => {
  it('should have exactly 6 states', () => {
    const states = Object.values(PaymentState);
    expect(states).toHaveLength(6);
  });

  it('should include all required states', () => {
    expect(PaymentState.PENDING).toBe('pending');
    expect(PaymentState.PROCESSING).toBe('processing');
    expect(PaymentState.COMPLETED).toBe('completed');
    expect(PaymentState.FAILED).toBe('failed');
    expect(PaymentState.EXPIRED).toBe('expired');
    expect(PaymentState.REFUNDED).toBe('refunded');
  });

  it('should have unique state values', () => {
    const states = Object.values(PaymentState);
    const uniqueStates = new Set(states);
    expect(uniqueStates.size).toBe(states.length);
  });
});

describe('PaymentStateSchema Validation', () => {
  it('should validate valid payment states', () => {
    expect(() => PaymentStateSchema.parse(PaymentState.PENDING)).not.toThrow();
    expect(() => PaymentStateSchema.parse(PaymentState.PROCESSING)).not.toThrow();
    expect(() => PaymentStateSchema.parse(PaymentState.COMPLETED)).not.toThrow();
    expect(() => PaymentStateSchema.parse(PaymentState.FAILED)).not.toThrow();
    expect(() => PaymentStateSchema.parse(PaymentState.EXPIRED)).not.toThrow();
    expect(() => PaymentStateSchema.parse(PaymentState.REFUNDED)).not.toThrow();
  });

  it('should reject invalid payment states', () => {
    expect(() => PaymentStateSchema.parse('invalid')).toThrow();
    expect(() => PaymentStateSchema.parse('')).toThrow();
    expect(() => PaymentStateSchema.parse(null)).toThrow();
    expect(() => PaymentStateSchema.parse(undefined)).toThrow();
  });

  it('should be case-sensitive', () => {
    expect(() => PaymentStateSchema.parse('PENDING')).toThrow();
    expect(() => PaymentStateSchema.parse('Pending')).toThrow();
  });
});

describe('PaymentTransitionSchema Validation', () => {
  it('should validate valid payment transitions', () => {
    const validTransition = {
      from: PaymentState.PENDING,
      to: PaymentState.PROCESSING,
      action: 'user_initiated',
      timestamp: Date.now(),
      metadata: { reason: 'test' },
    };

    expect(() => PaymentTransitionSchema.parse(validTransition)).not.toThrow();
  });

  it('should validate transition without optional metadata', () => {
    const transition = {
      from: PaymentState.PENDING,
      to: PaymentState.PROCESSING,
      action: 'user_initiated',
      timestamp: Date.now(),
    };

    expect(() => PaymentTransitionSchema.parse(transition)).not.toThrow();
  });

  it('should reject transition with missing required fields', () => {
    const invalidTransition = {
      from: PaymentState.PENDING,
      // missing 'to'
      action: 'user_initiated',
      timestamp: Date.now(),
    };

    expect(() => PaymentTransitionSchema.parse(invalidTransition)).toThrow();
  });

  it('should reject transition with invalid state', () => {
    const invalidTransition = {
      from: 'invalid_state',
      to: PaymentState.PROCESSING,
      action: 'user_initiated',
      timestamp: Date.now(),
    };

    expect(() => PaymentTransitionSchema.parse(invalidTransition)).toThrow();
  });

  it('should reject transition with empty action', () => {
    const invalidTransition = {
      from: PaymentState.PENDING,
      to: PaymentState.PROCESSING,
      action: '',
      timestamp: Date.now(),
    };

    expect(() => PaymentTransitionSchema.parse(invalidTransition)).toThrow();
  });

  it('should reject transition with invalid timestamp', () => {
    const invalidTransition = {
      from: PaymentState.PENDING,
      to: PaymentState.PROCESSING,
      action: 'user_initiated',
      timestamp: -1, // negative timestamp
    };

    expect(() => PaymentTransitionSchema.parse(invalidTransition)).toThrow();
  });
});

describe('PaymentEventSchema Validation', () => {
  it('should validate valid payment event', () => {
    const validEvent = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      paymentId: '123e4567-e89b-12d3-a456-426614174001',
      state: PaymentState.COMPLETED,
      previousState: PaymentState.PROCESSING,
      timestamp: Date.now(),
      metadata: { provider: 'stripe' },
      userId: '123e4567-e89b-12d3-a456-426614174002',
      errorMessage: undefined,
      createdAt: new Date(),
    };

    expect(() => PaymentEventSchema.parse(validEvent)).not.toThrow();
  });

  it('should validate event without optional fields', () => {
    const minimalEvent = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      paymentId: '123e4567-e89b-12d3-a456-426614174001',
      state: PaymentState.PENDING,
      timestamp: Date.now(),
      metadata: {},
      createdAt: new Date(),
    };

    expect(() => PaymentEventSchema.parse(minimalEvent)).not.toThrow();
  });

  it('should reject event with invalid UUID format', () => {
    const invalidEvent = {
      id: 'not-a-uuid',
      paymentId: '123e4567-e89b-12d3-a456-426614174001',
      state: PaymentState.PENDING,
      timestamp: Date.now(),
      metadata: {},
      createdAt: new Date(),
    };

    expect(() => PaymentEventSchema.parse(invalidEvent)).toThrow();
  });
});

describe('PaymentStateMachineSchema Validation', () => {
  it('should validate valid payment with state machine fields', () => {
    const validPayment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      amount: 1000,
      currency: 'USD',
      state: PaymentState.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: '123e4567-e89b-12d3-a456-426614174001',
      postId: '123e4567-e89b-12d3-a456-426614174002',
      invoice: 'lnbc1000...',
      preimage: 'abc123',
      expiresAt: new Date(Date.now() + 3600000),
      retryCount: 0,
      metadata: { source: 'web' },
    };

    expect(() => PaymentStateMachineSchema.parse(validPayment)).not.toThrow();
  });

  it('should reject payment with invalid currency code length', () => {
    const invalidPayment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      amount: 1000,
      currency: 'US', // should be 3 characters
      state: PaymentState.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: '123e4567-e89b-12d3-a456-426614174001',
      postId: '123e4567-e89b-12d3-a456-426614174002',
    };

    expect(() => PaymentStateMachineSchema.parse(invalidPayment)).toThrow();
  });

  it('should reject payment with negative amount', () => {
    const invalidPayment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      amount: -100,
      currency: 'USD',
      state: PaymentState.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: '123e4567-e89b-12d3-a456-426614174001',
      postId: '123e4567-e89b-12d3-a456-426614174002',
    };

    expect(() => PaymentStateMachineSchema.parse(invalidPayment)).toThrow();
  });

  it('should default retryCount to 0 if not provided', () => {
    const payment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      amount: 1000,
      currency: 'USD',
      state: PaymentState.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: '123e4567-e89b-12d3-a456-426614174001',
      postId: '123e4567-e89b-12d3-a456-426614174002',
    };

    const result = PaymentStateMachineSchema.parse(payment);
    expect(result.retryCount).toBe(0);
  });
});

describe('ALLOWED_TRANSITIONS Map', () => {
  it('should define transitions for all states', () => {
    const allStates = Object.values(PaymentState);
    allStates.forEach((state) => {
      expect(ALLOWED_TRANSITIONS.has(state)).toBe(true);
    });
  });

  it('should allow PENDING → PROCESSING', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.PENDING);
    expect(allowed).toContain(PaymentState.PROCESSING);
  });

  it('should allow PENDING → EXPIRED', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.PENDING);
    expect(allowed).toContain(PaymentState.EXPIRED);
  });

  it('should allow PENDING → FAILED', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.PENDING);
    expect(allowed).toContain(PaymentState.FAILED);
  });

  it('should allow PROCESSING → COMPLETED', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.PROCESSING);
    expect(allowed).toContain(PaymentState.COMPLETED);
  });

  it('should allow PROCESSING → FAILED', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.PROCESSING);
    expect(allowed).toContain(PaymentState.FAILED);
  });

  it('should allow COMPLETED → REFUNDED', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.COMPLETED);
    expect(allowed).toContain(PaymentState.REFUNDED);
  });

  it('should allow FAILED → PENDING (retry)', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.FAILED);
    expect(allowed).toContain(PaymentState.PENDING);
  });

  it('should not allow any transitions from EXPIRED (terminal)', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.EXPIRED);
    expect(allowed).toHaveLength(0);
  });

  it('should not allow any transitions from REFUNDED (terminal)', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.REFUNDED);
    expect(allowed).toHaveLength(0);
  });

  it('should not allow PROCESSING → PENDING (no backwards)', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.PROCESSING);
    expect(allowed).not.toContain(PaymentState.PENDING);
  });

  it('should not allow COMPLETED → FAILED', () => {
    const allowed = ALLOWED_TRANSITIONS.get(PaymentState.COMPLETED);
    expect(allowed).not.toContain(PaymentState.FAILED);
  });
});

describe('TERMINAL_STATES', () => {
  it('should include EXPIRED and REFUNDED', () => {
    expect(TERMINAL_STATES).toContain(PaymentState.EXPIRED);
    expect(TERMINAL_STATES).toContain(PaymentState.REFUNDED);
  });

  it('should have exactly 2 terminal states', () => {
    expect(TERMINAL_STATES).toHaveLength(2);
  });

  it('should not include non-terminal states', () => {
    expect(TERMINAL_STATES).not.toContain(PaymentState.PENDING);
    expect(TERMINAL_STATES).not.toContain(PaymentState.PROCESSING);
    expect(TERMINAL_STATES).not.toContain(PaymentState.COMPLETED);
    expect(TERMINAL_STATES).not.toContain(PaymentState.FAILED);
  });
});

describe('isTerminalState helper', () => {
  it('should return true for EXPIRED', () => {
    expect(isTerminalState(PaymentState.EXPIRED)).toBe(true);
  });

  it('should return true for REFUNDED', () => {
    expect(isTerminalState(PaymentState.REFUNDED)).toBe(true);
  });

  it('should return false for PENDING', () => {
    expect(isTerminalState(PaymentState.PENDING)).toBe(false);
  });

  it('should return false for PROCESSING', () => {
    expect(isTerminalState(PaymentState.PROCESSING)).toBe(false);
  });

  it('should return false for COMPLETED', () => {
    expect(isTerminalState(PaymentState.COMPLETED)).toBe(false);
  });

  it('should return false for FAILED', () => {
    expect(isTerminalState(PaymentState.FAILED)).toBe(false);
  });
});

describe('isTransitionAllowed helper', () => {
  it('should return true for valid transitions', () => {
    expect(isTransitionAllowed(PaymentState.PENDING, PaymentState.PROCESSING)).toBe(true);
    expect(isTransitionAllowed(PaymentState.PROCESSING, PaymentState.COMPLETED)).toBe(true);
    expect(isTransitionAllowed(PaymentState.COMPLETED, PaymentState.REFUNDED)).toBe(true);
    expect(isTransitionAllowed(PaymentState.FAILED, PaymentState.PENDING)).toBe(true);
  });

  it('should return false for invalid transitions', () => {
    expect(isTransitionAllowed(PaymentState.PROCESSING, PaymentState.PENDING)).toBe(false);
    expect(isTransitionAllowed(PaymentState.COMPLETED, PaymentState.FAILED)).toBe(false);
    expect(isTransitionAllowed(PaymentState.EXPIRED, PaymentState.PENDING)).toBe(false);
    expect(isTransitionAllowed(PaymentState.REFUNDED, PaymentState.COMPLETED)).toBe(false);
  });

  it('should return false for same-state transitions', () => {
    expect(isTransitionAllowed(PaymentState.PENDING, PaymentState.PENDING)).toBe(false);
    expect(isTransitionAllowed(PaymentState.PROCESSING, PaymentState.PROCESSING)).toBe(false);
  });
});

describe('getAllowedTransitions helper', () => {
  it('should return all allowed transitions for PENDING', () => {
    const allowed = getAllowedTransitions(PaymentState.PENDING);
    expect(allowed).toHaveLength(3);
    expect(allowed).toContain(PaymentState.PROCESSING);
    expect(allowed).toContain(PaymentState.EXPIRED);
    expect(allowed).toContain(PaymentState.FAILED);
  });

  it('should return all allowed transitions for PROCESSING', () => {
    const allowed = getAllowedTransitions(PaymentState.PROCESSING);
    expect(allowed).toHaveLength(2);
    expect(allowed).toContain(PaymentState.COMPLETED);
    expect(allowed).toContain(PaymentState.FAILED);
  });

  it('should return empty array for terminal states', () => {
    expect(getAllowedTransitions(PaymentState.EXPIRED)).toHaveLength(0);
    expect(getAllowedTransitions(PaymentState.REFUNDED)).toHaveLength(0);
  });
});

describe('Error Classes', () => {
  describe('InvalidTransitionError', () => {
    it('should create error with correct message', () => {
      const error = new InvalidTransitionError(PaymentState.PROCESSING, PaymentState.PENDING);
      expect(error.message).toBe('Invalid state transition from processing to pending');
      expect(error.name).toBe('InvalidTransitionError');
    });

    it('should be instanceof Error', () => {
      const error = new InvalidTransitionError(PaymentState.PROCESSING, PaymentState.PENDING);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('StateTransitionError', () => {
    it('should create error with custom message', () => {
      const error = new StateTransitionError('Database transaction failed');
      expect(error.message).toBe('Database transaction failed');
      expect(error.name).toBe('StateTransitionError');
    });

    it('should be instanceof Error', () => {
      const error = new StateTransitionError('Test error');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('PaymentNotFoundError', () => {
    it('should create error with payment ID', () => {
      const paymentId = '123e4567-e89b-12d3-a456-426614174000';
      const error = new PaymentNotFoundError(paymentId);
      expect(error.message).toBe(`Payment not found: ${paymentId}`);
      expect(error.name).toBe('PaymentNotFoundError');
    });

    it('should be instanceof Error', () => {
      const error = new PaymentNotFoundError('test-id');
      expect(error).toBeInstanceOf(Error);
    });
  });
});

describe('Type Consistency', () => {
  it('should have consistent state definitions across schemas and enums', () => {
    // Verify all enum values are valid for PaymentStateSchema
    Object.values(PaymentState).forEach((state) => {
      expect(() => PaymentStateSchema.parse(state)).not.toThrow();
    });
  });

  it('should have all allowed transition states exist in PaymentState enum', () => {
    ALLOWED_TRANSITIONS.forEach((targets, source) => {
      expect(Object.values(PaymentState)).toContain(source);
      targets.forEach((target) => {
        expect(Object.values(PaymentState)).toContain(target);
      });
    });
  });

  it('should have all terminal states exist in PaymentState enum', () => {
    TERMINAL_STATES.forEach((state) => {
      expect(Object.values(PaymentState)).toContain(state);
    });
  });
});
