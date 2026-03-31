/**
 * Payment Retry Service Enhanced Tests - PAY-009
 *
 * Tests for enhanced exponential backoff with jitter and circuit breaker pattern.
 *
 * Requirements:
 * - Exponential backoff: base 1s, max 60s, multiplier 2^attempt
 * - Full jitter: delay * random(0, 1) to prevent thundering herd
 * - Circuit breaker: stop after N consecutive failures, reset on success
 * - Configurable retry policy
 * - Retry metrics for monitoring
 *
 * @module PaymentRetryService.enhanced.test
 * @category Tests
 * @see Story PAY-009: Implement Enhanced Exponential Backoff
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PaymentState, Payment } from '@shared/types';
import { PaymentRetryService, RetryConfig } from '../PaymentRetryService';
import { PaymentStateMachine } from '../PaymentStateMachine';
import { EmailIntegrationService } from '../../email-integration-service';

// Mock Supabase client
vi.mock('@supabase/supabase-js');
vi.mock('../PaymentStateMachine');
vi.mock('../../email-integration-service');

describe('PaymentRetryService - Enhanced Exponential Backoff (PAY-009)', () => {
  let mockSupabase: vi.Mocked<SupabaseClient>;
  let mockStateMachine: vi.Mocked<PaymentStateMachine>;
  let mockEmailService: vi.Mocked<EmailIntegrationService>;
  let retryService: PaymentRetryService;

  const mockPayment: Payment = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: '550e8400-e29b-41d4-a716-446655440001',
    payment_hash: 'a'.repeat(64),
    amount: 10000,
    currency: 'SAT',
    state: PaymentState.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: '550e8400-e29b-41d4-a716-446655440001',
    postId: '550e8400-e29b-41d4-a716-446655440002',
    retry_count: 0,
  };

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Supabase client
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    mockSupabase = {
      from: vi.fn(() => mockChain),
      rpc: vi.fn(),
    } as any;

    (createClient as any).mockReturnValue(mockSupabase);

    mockStateMachine = new PaymentStateMachine({
      supabase: mockSupabase,
    }) as anyed<PaymentStateMachine>;
    mockStateMachine.transition = vi.fn().mockResolvedValue(undefined);

    mockEmailService = new EmailIntegrationService() as anyed<EmailIntegrationService>;
    mockEmailService.sendNotification = vi.fn().mockResolvedValue(undefined);
  });

  describe('Enhanced Exponential Backoff with Jitter', () => {
    describe('Base Delay Configuration', () => {
      it('should use configurable base delay (default 1000ms)', () => {
        // Arrange & Act
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          logger: mockLogger,
        });

        // Assert: Check default config
        const delay = (retryService as any).calculateBackoffDelayWithJitter(0);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(1000); // Base delay with full jitter
      });

      it('should allow custom base delay via configuration', () => {
        // Arrange: Custom config
        const customConfig: Partial<RetryConfig> = {
          baseDelay: 2000, // 2 seconds
        };

        // Act
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: customConfig,
          logger: mockLogger,
        });

        // Assert: Base delay should be configurable
        const delay = (retryService as any).calculateBackoffDelayWithJitter(0);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(2000);
      });
    });

    describe('Exponential Multiplier (2^attempt)', () => {
      beforeEach(() => {
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: {
            baseDelay: 1000,
            maxDelay: 60000,
            backoffMultiplier: 2, // 2^attempt
          },
          logger: mockLogger,
        });
      });

      it('should calculate delay with exponential multiplier 2^0 = 1 (attempt 1)', () => {
        // Act: First retry (attempt 0)
        const delay = (retryService as any).calculateBackoffDelayWithJitter(0);

        // Assert: 1000ms * 2^0 = 1000ms (with jitter 0-1000ms)
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(1000);
      });

      it('should calculate delay with exponential multiplier 2^1 = 2 (attempt 2)', () => {
        // Act: Second retry (attempt 1)
        const delay = (retryService as any).calculateBackoffDelayWithJitter(1);

        // Assert: 1000ms * 2^1 = 2000ms (with jitter 0-2000ms)
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(2000);
      });

      it('should calculate delay with exponential multiplier 2^2 = 4 (attempt 3)', () => {
        // Act: Third retry (attempt 2)
        const delay = (retryService as any).calculateBackoffDelayWithJitter(2);

        // Assert: 1000ms * 2^2 = 4000ms (with jitter 0-4000ms)
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(4000);
      });

      it('should calculate delay with exponential multiplier 2^3 = 8 (attempt 4)', () => {
        // Act: Fourth retry (attempt 3)
        const delay = (retryService as any).calculateBackoffDelayWithJitter(3);

        // Assert: 1000ms * 2^3 = 8000ms (with jitter 0-8000ms)
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(8000);
      });

      it('should calculate delay with exponential multiplier 2^4 = 16 (attempt 5)', () => {
        // Act: Fifth retry (attempt 4)
        const delay = (retryService as any).calculateBackoffDelayWithJitter(4);

        // Assert: 1000ms * 2^4 = 16000ms (with jitter 0-16000ms)
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(16000);
      });
    });

    describe('Max Delay Cap (60 seconds)', () => {
      beforeEach(() => {
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: {
            baseDelay: 1000,
            maxDelay: 60000, // 60 seconds max
            backoffMultiplier: 2,
          },
          logger: mockLogger,
        });
      });

      it('should cap delay at maxDelay (60000ms)', () => {
        // Act: Very high attempt number (2^10 = 1024 seconds without cap)
        const delay = (retryService as any).calculateBackoffDelayWithJitter(10);

        // Assert: Should be capped at 60000ms
        expect(delay).toBeLessThanOrEqual(60000);
      });

      it('should respect maxDelay with jitter applied', () => {
        // Act: Multiple high attempts
        const delays = Array.from({ length: 5 }, (_, i) =>
          (retryService as any).calculateBackoffDelayWithJitter(i + 10)
        );

        // Assert: All delays should be capped
        delays.forEach(delay => {
          expect(delay).toBeGreaterThanOrEqual(0);
          expect(delay).toBeLessThanOrEqual(60000);
        });
      });

      it('should allow custom maxDelay configuration', () => {
        // Arrange: Custom max delay
        const customRetryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: {
            baseDelay: 1000,
            maxDelay: 30000, // 30 seconds
            backoffMultiplier: 2,
          },
          logger: mockLogger,
        });

        // Act: High attempt number
        const delay = (customRetryService as any).calculateBackoffDelayWithJitter(10);

        // Assert: Should be capped at custom maxDelay
        expect(delay).toBeLessThanOrEqual(30000);
      });
    });

    describe('Full Jitter Implementation', () => {
      beforeEach(() => {
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: {
            baseDelay: 1000,
            maxDelay: 60000,
            backoffMultiplier: 2,
          },
          logger: mockLogger,
        });
      });

      it('should apply full jitter (randomization between 0 and calculated delay)', () => {
        // Act: Generate multiple delays for same attempt
        const delays = Array.from({ length: 100 }, () =>
          (retryService as any).calculateBackoffDelayWithJitter(2)
        );

        // Assert: Should have variation (not all the same)
        const uniqueDelays = new Set(delays);
        expect(uniqueDelays.size).toBeGreaterThan(1);

        // Assert: All delays within valid range
        delays.forEach(delay => {
          expect(delay).toBeGreaterThanOrEqual(0);
          expect(delay).toBeLessThanOrEqual(4000); // 1000 * 2^2
        });
      });

      it('should prevent thundering herd by randomizing delays', () => {
        // Act: Simulate 10 concurrent retry attempts
        const concurrentDelays = Array.from({ length: 10 }, () =>
          (retryService as any).calculateBackoffDelayWithJitter(1)
        );

        // Assert: Delays should be distributed (not all identical)
        const uniqueDelays = new Set(concurrentDelays);
        expect(uniqueDelays.size).toBeGreaterThan(1);

        // Assert: Standard deviation should indicate spread
        const mean = concurrentDelays.reduce((sum, d) => sum + d, 0) / concurrentDelays.length;
        const variance =
          concurrentDelays.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) /
          concurrentDelays.length;
        const stdDev = Math.sqrt(variance);

        // Expect some variation (std dev > 0)
        expect(stdDev).toBeGreaterThan(0);
      });

      it('should use Math.random for jitter calculation', () => {
        // Arrange: Spy on Math.random
        const randomSpy = vi.spyOn(Math, 'random');

        // Act
        (retryService as any).calculateBackoffDelayWithJitter(1);

        // Assert: Math.random should be called for jitter
        expect(randomSpy).toHaveBeenCalled();

        randomSpy.mockRestore();
      });

      it('should handle edge case of jitter = 0 (Math.random returns 0)', () => {
        // Arrange: Mock Math.random to return 0
        vi.spyOn(Math, 'random').mockReturnValue(0);

        // Act
        const delay = (retryService as any).calculateBackoffDelayWithJitter(1);

        // Assert: Should return 0 (no delay)
        expect(delay).toBe(0);

        vi.restoreAllMocks();
      });

      it('should handle edge case of jitter = 1 (Math.random returns 0.999999)', () => {
        // Arrange: Mock Math.random to return near 1
        vi.spyOn(Math, 'random').mockReturnValue(0.999999);

        // Act
        const delay = (retryService as any).calculateBackoffDelayWithJitter(1);

        // Assert: Should return nearly full calculated delay
        const expectedMax = 2000; // 1000 * 2^1
        expect(delay).toBeCloseTo(expectedMax, -1); // Within 10ms

        vi.restoreAllMocks();
      });
    });

    describe('Jitter Distribution Analysis', () => {
      beforeEach(() => {
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: {
            baseDelay: 1000,
            maxDelay: 60000,
            backoffMultiplier: 2,
          },
          logger: mockLogger,
        });
      });

      it('should produce uniformly distributed jitter', () => {
        // Act: Generate 1000 samples
        const samples = Array.from({ length: 1000 }, () =>
          (retryService as any).calculateBackoffDelayWithJitter(2)
        );

        // Assert: Check distribution across range [0, 4000]
        const maxDelay = 4000; // 1000 * 2^2
        const bucketSize = maxDelay / 10;
        const buckets = Array(10).fill(0);

        samples.forEach(delay => {
          const bucketIndex = Math.min(Math.floor(delay / bucketSize), 9);
          buckets[bucketIndex]++;
        });

        // Each bucket should have roughly 10% of samples (100 ± 50)
        buckets.forEach(count => {
          expect(count).toBeGreaterThan(50);
          expect(count).toBeLessThan(150);
        });
      });

      it('should maintain average delay around 50% of max (full jitter property)', () => {
        // Act: Generate many samples
        const samples = Array.from({ length: 1000 }, () =>
          (retryService as any).calculateBackoffDelayWithJitter(2)
        );

        // Calculate average
        const average = samples.reduce((sum, d) => sum + d, 0) / samples.length;

        // Assert: Average should be around 50% of max delay (2000ms)
        const expectedAverage = 2000; // 4000 / 2
        const tolerance = 200; // 10% tolerance for randomness
        expect(average).toBeGreaterThan(expectedAverage - tolerance);
        expect(average).toBeLessThan(expectedAverage + tolerance);
      });
    });
  });

  describe('Circuit Breaker Pattern', () => {
    describe('Circuit Breaker Configuration', () => {
      it('should initialize circuit breaker with default threshold (5 failures)', () => {
        // Act
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          logger: mockLogger,
        });

        // Assert: Should have circuit breaker enabled
        const circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState).toBeDefined();
        expect(circuitState.isOpen).toBe(false);
        expect(circuitState.failureCount).toBe(0);
      });

      it('should allow custom circuit breaker threshold', () => {
        // Arrange: Custom threshold
        const customConfig: Partial<RetryConfig> = {
          circuitBreakerThreshold: 3, // Open after 3 failures
        };

        // Act
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: customConfig,
          logger: mockLogger,
        });

        // Assert
        const config = (retryService as any).config;
        expect(config.circuitBreakerThreshold).toBe(3);
      });

      it('should allow disabling circuit breaker', () => {
        // Arrange: Disable circuit breaker
        const customConfig: Partial<RetryConfig> = {
          circuitBreakerThreshold: 0, // Disabled
        };

        // Act
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: customConfig,
          logger: mockLogger,
        });

        // Assert
        const config = (retryService as any).config;
        expect(config.circuitBreakerThreshold).toBe(0);
      });
    });

    describe('Failure Tracking', () => {
      beforeEach(() => {
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: {
            circuitBreakerThreshold: 5,
          },
          logger: mockLogger,
        });
      });

      it('should increment failure count on retry failure', () => {
        // Arrange: Initial state
        let circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.failureCount).toBe(0);

        // Act: Record failure
        (retryService as any).recordRetryFailure();

        // Assert: Failure count incremented
        circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.failureCount).toBe(1);
      });

      it('should track consecutive failures', () => {
        // Act: Record multiple failures
        for (let i = 0; i < 3; i++) {
          (retryService as any).recordRetryFailure();
        }

        // Assert: All failures tracked
        const circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.failureCount).toBe(3);
      });

      it('should not open circuit before threshold', () => {
        // Act: Record failures below threshold
        for (let i = 0; i < 4; i++) {
          (retryService as any).recordRetryFailure();
        }

        // Assert: Circuit still closed
        const circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.isOpen).toBe(false);
        expect(circuitState.failureCount).toBe(4);
      });

      it('should open circuit when threshold reached', () => {
        // Act: Record failures to reach threshold (5)
        for (let i = 0; i < 5; i++) {
          (retryService as any).recordRetryFailure();
        }

        // Assert: Circuit opened
        const circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.isOpen).toBe(true);
        expect(circuitState.failureCount).toBe(5);
      });

      it('should log when circuit breaker opens', () => {
        // Act: Open circuit
        for (let i = 0; i < 5; i++) {
          (retryService as any).recordRetryFailure();
        }

        // Assert: Warning logged
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Circuit breaker opened'),
          expect.any(Object)
        );
      });
    });

    describe('Circuit Breaker Reset on Success', () => {
      beforeEach(() => {
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: {
            circuitBreakerThreshold: 5,
          },
          logger: mockLogger,
        });
      });

      it('should reset failure count on successful retry', () => {
        // Arrange: Record some failures
        for (let i = 0; i < 3; i++) {
          (retryService as any).recordRetryFailure();
        }

        let circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.failureCount).toBe(3);

        // Act: Record success
        (retryService as any).recordRetrySuccess();

        // Assert: Failure count reset
        circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.failureCount).toBe(0);
        expect(circuitState.isOpen).toBe(false);
      });

      it('should close circuit on successful retry', () => {
        // Arrange: Open circuit
        for (let i = 0; i < 5; i++) {
          (retryService as any).recordRetryFailure();
        }

        let circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.isOpen).toBe(true);

        // Act: Successful retry
        (retryService as any).recordRetrySuccess();

        // Assert: Circuit closed
        circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.isOpen).toBe(false);
        expect(circuitState.failureCount).toBe(0);
      });

      it('should log when circuit breaker closes', () => {
        // Arrange: Open circuit
        for (let i = 0; i < 5; i++) {
          (retryService as any).recordRetryFailure();
        }

        vi.clearAllMocks();

        // Act: Close circuit
        (retryService as any).recordRetrySuccess();

        // Assert: Info logged
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Circuit breaker closed'),
          expect.any(Object)
        );
      });
    });

    describe('Circuit Breaker Retry Prevention', () => {
      beforeEach(() => {
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: {
            circuitBreakerThreshold: 5,
          },
          logger: mockLogger,
        });
      });

      it('should prevent retry scheduling when circuit is open', () => {
        // Arrange: Open circuit
        for (let i = 0; i < 5; i++) {
          (retryService as any).recordRetryFailure();
        }

        // Act & Assert: Should reject retry
        const isAllowed = (retryService as any).isRetryAllowed();
        expect(isAllowed).toBe(false);
      });

      it('should allow retry scheduling when circuit is closed', () => {
        // Arrange: Circuit closed (default state)

        // Act & Assert: Should allow retry
        const isAllowed = (retryService as any).isRetryAllowed();
        expect(isAllowed).toBe(true);
      });

      it('should throw error when attempting retry with open circuit', async () => {
        // Arrange: Open circuit
        for (let i = 0; i < 5; i++) {
          (retryService as any).recordRetryFailure();
        }

        // Mock payment retrieval
        const mockChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockPayment,
            error: null,
          }),
        };
        mockSupabase.from = vi.fn(() => mockChain) as any;

        // Act & Assert: Should throw circuit breaker error
        await expect(retryService.scheduleRetry(mockPayment.id, 'network_error')).rejects.toThrow(
          /circuit breaker.*open/i
        );
      });
    });

    describe('Circuit Breaker Half-Open State', () => {
      beforeEach(() => {
        retryService = new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: {
            circuitBreakerThreshold: 5,
            circuitBreakerTimeout: 60000, // 1 minute timeout
          },
          logger: mockLogger,
        });
      });

      it('should transition to half-open after timeout', () => {
        // Arrange: Open circuit
        for (let i = 0; i < 5; i++) {
          (retryService as any).recordRetryFailure();
        }

        let circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.isOpen).toBe(true);

        // Act: Manually set the openedAt time to 1 minute ago
        const oneMinuteAgo = new Date(Date.now() - 60000);
        (retryService as any)._setCircuitBreakerState({
          openedAt: oneMinuteAgo,
        });

        // Trigger timeout check by calling isRetryAllowed
        const isAllowed = (retryService as any).isRetryAllowed();

        // Check state after timeout
        circuitState = (retryService as any)._getCircuitBreakerState();

        // Assert: Should be half-open (allows test retry)
        expect(circuitState.isHalfOpen).toBe(true);
        expect(isAllowed).toBe(true);
      });

      it('should allow one retry attempt in half-open state', () => {
        // Arrange: Circuit in half-open state
        (retryService as any)._setCircuitBreakerState({ isHalfOpen: true });

        // Act & Assert: Should allow retry
        const isAllowed = (retryService as any).isRetryAllowed();
        expect(isAllowed).toBe(true);
      });

      it('should close circuit if half-open retry succeeds', () => {
        // Arrange: Half-open state
        (retryService as any)._setCircuitBreakerState({
          isHalfOpen: true,
          failureCount: 5,
        });

        // Act: Successful retry
        (retryService as any).recordRetrySuccess();

        // Assert: Circuit fully closed
        const circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.isOpen).toBe(false);
        expect(circuitState.isHalfOpen).toBe(false);
        expect(circuitState.failureCount).toBe(0);
      });

      it('should re-open circuit if half-open retry fails', () => {
        // Arrange: Half-open state
        (retryService as any)._setCircuitBreakerState({
          isHalfOpen: true,
          failureCount: 5,
        });

        // Act: Failed retry
        (retryService as any).recordRetryFailure();

        // Assert: Circuit re-opened
        const circuitState = (retryService as any)._getCircuitBreakerState();
        expect(circuitState.isOpen).toBe(true);
        expect(circuitState.isHalfOpen).toBe(false);
      });
    });
  });

  describe('Enhanced Retry Metrics', () => {
    beforeEach(() => {
      retryService = new PaymentRetryService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        logger: mockLogger,
      });
    });

    describe('Circuit Breaker Metrics', () => {
      it('should include circuit breaker state in metrics', async () => {
        // Arrange: Mock metrics RPC response
        mockSupabase.rpc = vi.fn().mockResolvedValue({
          data: [
            {
              total_retries: 100,
              successful_retries: 80,
              failed_retries: 20,
              pending_retries: 5,
              success_rate: 0.8,
              avg_attempts_to_success: 2.5,
              circuit_breaker_open: false,
              circuit_breaker_failure_count: 2,
            },
          ],
          error: null,
        });

        // Act
        const metrics = await retryService.getRetryMetrics();

        // Assert: Metrics include circuit breaker data
        expect(metrics).toHaveProperty('circuit_breaker_open');
        expect(metrics).toHaveProperty('circuit_breaker_failure_count');
      });

      it('should track circuit breaker open events', async () => {
        // Arrange: Open circuit
        for (let i = 0; i < 5; i++) {
          (retryService as any).recordRetryFailure();
        }

        // Mock metrics
        mockSupabase.rpc = vi.fn().mockResolvedValue({
          data: [
            {
              circuit_breaker_open: true,
              circuit_breaker_failure_count: 5,
              circuit_breaker_opened_at: new Date(),
            },
          ],
          error: null,
        });

        // Act
        const metrics = await retryService.getRetryMetrics();

        // Assert
        expect(metrics.circuit_breaker_open).toBe(true);
        expect(metrics.circuit_breaker_failure_count).toBe(5);
      });

      it('should track time since circuit breaker opened', async () => {
        // Arrange: Circuit opened 30 seconds ago
        const openedAt = new Date(Date.now() - 30000);

        mockSupabase.rpc = vi.fn().mockResolvedValue({
          data: [
            {
              circuit_breaker_open: true,
              circuit_breaker_opened_at: openedAt,
              circuit_breaker_open_duration_ms: 30000,
            },
          ],
          error: null,
        });

        // Act
        const metrics = await retryService.getRetryMetrics();

        // Assert
        expect(metrics.circuit_breaker_open_duration_ms).toBe(30000);
      });
    });

    describe('Jitter Effectiveness Metrics', () => {
      it('should track average delay with jitter applied', async () => {
        // Arrange: Mock metrics
        mockSupabase.rpc = vi.fn().mockResolvedValue({
          data: [
            {
              avg_retry_delay_ms: 2500, // Average with jitter
              avg_retry_delay_without_jitter_ms: 5000, // Theoretical without jitter
              jitter_reduction_percentage: 50,
            },
          ],
          error: null,
        });

        // Act
        const metrics = await retryService.getRetryMetrics();

        // Assert: Metrics show jitter effectiveness
        expect(metrics.avg_retry_delay_ms).toBe(2500);
        expect(metrics.jitter_reduction_percentage).toBe(50);
      });
    });

    describe('Retry Timing Distribution', () => {
      it('should provide histogram of retry delays', async () => {
        // Arrange: Mock histogram data
        mockSupabase.rpc = vi.fn().mockResolvedValue({
          data: [
            {
              delay_histogram: {
                '0-1000ms': 20,
                '1000-5000ms': 30,
                '5000-15000ms': 25,
                '15000-60000ms': 15,
                '60000ms+': 10,
              },
            },
          ],
          error: null,
        });

        // Act
        const metrics = await retryService.getRetryMetrics();

        // Assert: Histogram available
        expect(metrics.delay_histogram).toBeDefined();
        expect(metrics.delay_histogram['0-1000ms']).toBe(20);
      });
    });
  });

  describe('Configurable Retry Policy', () => {
    it('should accept custom maxAttempts configuration', () => {
      // Arrange: Custom config
      const customConfig: Partial<RetryConfig> = {
        maxAttempts: 3, // Only 3 retries
      };

      // Act
      retryService = new PaymentRetryService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        retryConfig: customConfig,
        logger: mockLogger,
      });

      // Assert
      const config = (retryService as any).config;
      expect(config.maxAttempts).toBe(3);
    });

    it('should accept custom baseDelay configuration', () => {
      // Arrange
      const customConfig: Partial<RetryConfig> = {
        baseDelay: 5000, // 5 seconds
      };

      // Act
      retryService = new PaymentRetryService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        retryConfig: customConfig,
        logger: mockLogger,
      });

      // Assert
      const config = (retryService as any).config;
      expect(config.baseDelay).toBe(5000);
    });

    it('should accept custom maxDelay configuration', () => {
      // Arrange
      const customConfig: Partial<RetryConfig> = {
        maxDelay: 120000, // 2 minutes
      };

      // Act
      retryService = new PaymentRetryService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        retryConfig: customConfig,
        logger: mockLogger,
      });

      // Assert
      const config = (retryService as any).config;
      expect(config.maxDelay).toBe(120000);
    });

    it('should validate retry policy configuration', () => {
      // Arrange: Invalid config (baseDelay > maxDelay)
      const invalidConfig: Partial<RetryConfig> = {
        baseDelay: 100000,
        maxDelay: 10000,
      };

      // Act & Assert: Should throw validation error
      expect(() => {
        new PaymentRetryService({
          supabase: mockSupabase,
          stateMachine: mockStateMachine,
          retryConfig: invalidConfig,
          logger: mockLogger,
        });
      }).toThrow(/baseDelay.*maxDelay/i);
    });

    it('should merge custom config with defaults', () => {
      // Arrange: Partial custom config
      const partialConfig: Partial<RetryConfig> = {
        baseDelay: 2000, // Custom
        // maxDelay will use default
      };

      // Act
      retryService = new PaymentRetryService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        retryConfig: partialConfig,
        logger: mockLogger,
      });

      // Assert: Custom value used, default preserved
      const config = (retryService as any).config;
      expect(config.baseDelay).toBe(2000); // Custom
      expect(config.maxDelay).toBe(60000); // Default
    });
  });
});
