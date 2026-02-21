/**
 * Invoice Expiration Service - Unit Tests
 *
 * Comprehensive test coverage for automatic invoice expiration:
 * - Expiration detection with mock timestamps
 * - State machine transition calls
 * - Email notification triggering
 * - Error handling for failed transitions
 * - Concurrent check prevention
 * - Batch processing
 * - Manual expiration
 *
 * @see Story #003: Add Invoice Expiration Handling to State Machine
 */


import {
  InvoiceExpirationService,
  EmailService,
  Logger,
  LightningNodeService,
} from '../InvoiceExpirationService';
import { PaymentStateMachine } from '../PaymentStateMachine';
import { PaymentState, Payment } from '@sovren/shared/types';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock dependencies
const mockSupabase = {
  from: vi.fn(),
} as unknown as SupabaseClient;

const mockStateMachine = {
  transition: vi.fn(),
} as unknown as PaymentStateMachine;

const mockEmailService: EmailService = {
  sendInvoiceExpiredEmail: vi.fn(),
};

const mockAnalyticsService = {
  track: vi.fn(),
};

const mockLightningNodeService: LightningNodeService = {
  cancelInvoice: vi.fn(),
};

const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Test helper to create mock payments
const createMockPayment = (overrides?: Partial<Payment>): Payment => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  user_id: 'user-123',
  amount: 1000,
  currency: 'USD',
  state: PaymentState.PENDING,
  description: 'Test payment',
  expires_at: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
  payment_hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('InvoiceExpirationService', () => {
  let services: InvoiceExpirationService[] = [];

  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    services = [];
  });

  // Clean up all services after each test
  afterEach(async () => {
    for (const service of services) {
      await service.shutdown();
    }
    services = [];
  });

  // Helper to track services for cleanup
  const createService = (config: any) => {
    const service = new InvoiceExpirationService(config);
    services.push(service);
    return service;
  };

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
      });

      expect(service).toBeInstanceOf(InvoiceExpirationService);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Invoice Expiration Service initialized',
        expect.objectContaining({
          checkIntervalMs: 5 * 60 * 1000,
          batchSize: 100,
          autoSchedule: true,
        })
      );
    });

    it('should initialize with custom configuration', () => {
      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        checkIntervalMs: 10 * 60 * 1000,
        batchSize: 50,
        autoSchedule: false,
      });

      expect(service).toBeInstanceOf(InvoiceExpirationService);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Invoice Expiration Service initialized',
        expect.objectContaining({
          checkIntervalMs: 10 * 60 * 1000,
          batchSize: 50,
          autoSchedule: false,
        })
      );
    });

    it('should auto-start scheduler when autoSchedule is true', () => {
      // Mock database query to return empty array
      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: true,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting invoice expiration scheduler',
        expect.any(Object)
      );
    });
  });

  describe('checkExpiredInvoices()', () => {
    it('should find and expire expired invoices', async () => {
      const expiredPayment = createMockPayment();

      // Mock database query
      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      // Mock state machine transition
      (mockStateMachine.transition as any).mockResolvedValue({
        id: 'event-123',
        success: true,
      });

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      expect(result.foundCount).toBe(1);
      expect(result.expiredCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        expiredPayment.id,
        PaymentState.EXPIRED,
        expect.objectContaining({
          reason: 'invoice_expired',
          previous_expires_at: expiredPayment.expires_at,
        })
      );
      expect(mockEmailService.sendInvoiceExpiredEmail).toHaveBeenCalledWith(
        expiredPayment.user_id,
        expiredPayment.id,
        expect.objectContaining({
          amount: expiredPayment.amount,
          currency: expiredPayment.currency,
        })
      );
    });

    it('should handle multiple expired invoices', async () => {
      const expiredPayments = [
        createMockPayment({ id: 'payment-1', user_id: 'user-1' }),
        createMockPayment({ id: 'payment-2', user_id: 'user-2' }),
        createMockPayment({ id: 'payment-3', user_id: 'user-3' }),
      ];

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: expiredPayments,
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      expect(result.foundCount).toBe(3);
      expect(result.expiredCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(mockStateMachine.transition).toHaveBeenCalledTimes(3);
      expect(mockEmailService.sendInvoiceExpiredEmail).toHaveBeenCalledTimes(3);
    });

    it('should handle no expired invoices gracefully', async () => {
      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      expect(result.foundCount).toBe(0);
      expect(result.expiredCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(mockStateMachine.transition).not.toHaveBeenCalled();
      expect(mockEmailService.sendInvoiceExpiredEmail).not.toHaveBeenCalled();
    });

    it('should handle database query errors', async () => {
      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' },
              }),
            }),
          }),
        }),
      });

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      expect(result.foundCount).toBe(0);
      expect(result.expiredCount).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invoice expiration check failed',
        expect.any(Object)
      );
    });

    it('should handle state transition errors gracefully', async () => {
      const expiredPayment = createMockPayment();

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockRejectedValue(
        new Error('Invalid transition')
      );

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      expect(result.foundCount).toBe(1);
      expect(result.expiredCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        paymentId: expiredPayment.id,
        error: 'Invalid transition',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to expire payment',
        expect.objectContaining({
          paymentId: expiredPayment.id,
        })
      );
    });

    it('should handle email notification errors gracefully', async () => {
      const expiredPayment = createMockPayment();

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockRejectedValue(
        new Error('Email service unavailable')
      );

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      expect(result.foundCount).toBe(1);
      expect(result.expiredCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors[0].error).toContain('Email service unavailable');
    });

    it('should prevent concurrent checks', async () => {
      // Use a flag to control the query completion
      let resolveFirstQuery: () => void;
      const firstQueryPromise = new Promise<void>((resolve) => {
        resolveFirstQuery = resolve;
      });
      let callCount = 0;

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(async () => {
                callCount++;
                if (callCount === 1) {
                  // First call - wait for the promise
                  await firstQueryPromise;
                }
                return { data: [], error: null };
              }),
            }),
          }),
        }),
      });

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      // Start first check (will wait on promise)
      const promise1 = service.checkExpiredInvoices();

      // Give it a moment to start
      await new Promise((resolve) => setImmediate(resolve));

      // Start second check while first is still running (should be skipped)
      const result2 = await service.checkExpiredInvoices();

      // Now resolve the first check
      resolveFirstQuery!();
      await promise1;

      // Second check should be skipped
      expect(result2.foundCount).toBe(0);
      expect(result2.durationMs).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Expiration check already in progress, skipping'
      );
    });

    it('should respect batch size limit', async () => {
      const batchSize = 5;
      const mockPayments = Array.from({ length: batchSize }, (_, i) =>
        createMockPayment({ id: `payment-${i}` })
      );

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation((limit: number) => {
                expect(limit).toBe(batchSize);
                return Promise.resolve({
                  data: mockPayments,
                  error: null,
                });
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockResolvedValue(undefined);

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
        batchSize,
      });

      const result = await service.checkExpiredInvoices();

      expect(result.foundCount).toBe(batchSize);
      expect(result.expiredCount).toBe(batchSize);
    });
  });

  describe('Scheduler', () => {
    it('should start automatic checks on schedule', () => {
      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const checkInterval = 5 * 60 * 1000;
      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
        checkIntervalMs: checkInterval,
      });

      service.start();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting invoice expiration scheduler',
        expect.objectContaining({ intervalMs: checkInterval })
      );

      // Verify interval is set
      const metrics = service.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });

    it('should not create duplicate schedulers', () => {
      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      service.start();
      service.start(); // Call again

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invoice expiration scheduler already running'
      );
    });

    it('should stop scheduler', () => {
      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      service.start();
      service.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Invoice expiration scheduler stopped');

      const metrics = service.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });
  });

  describe('manuallyExpirePayment()', () => {
    it('should manually expire a specific payment', async () => {
      const payment = createMockPayment({ state: PaymentState.PENDING });

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: payment,
              error: null,
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockResolvedValue(undefined);

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      await service.manuallyExpirePayment(payment.id);

      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        payment.id,
        PaymentState.EXPIRED,
        expect.any(Object)
      );
      expect(mockEmailService.sendInvoiceExpiredEmail).toHaveBeenCalled();
    });

    it('should throw error for non-existent payment', async () => {
      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      await expect(service.manuallyExpirePayment('invalid-id')).rejects.toThrow(
        'Payment not found: invalid-id'
      );
    });

    it('should throw error for non-PENDING payment', async () => {
      const payment = createMockPayment({ state: PaymentState.COMPLETED });

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: payment,
              error: null,
            }),
          }),
        }),
      });

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      await expect(service.manuallyExpirePayment(payment.id)).rejects.toThrow(
        'Payment is not in PENDING state'
      );
    });
  });

  describe('getMetrics()', () => {
    it('should return accurate metrics', async () => {
      const expiredPayment = createMockPayment();

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockResolvedValue(undefined);

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
        checkIntervalMs: 10000,
      });

      await service.checkExpiredInvoices();

      const metrics = service.getMetrics();

      expect(metrics.totalChecks).toBe(1);
      expect(metrics.totalExpired).toBe(1);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.lastCheckAt).toBeInstanceOf(Date);
      expect(metrics.lastCheckDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.isRunning).toBe(false);
      expect(metrics.checkIntervalMs).toBe(10000);
    });
  });

  describe('shutdown()', () => {
    it('should stop scheduler on shutdown', async () => {
      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      service.start();
      await service.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Shutting down Invoice Expiration Service'
      );

      const metrics = service.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });
  });

  describe('Analytics Integration', () => {
    it('should emit analytics event when invoice expires', async () => {
      const expiredPayment = createMockPayment();

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockResolvedValue(undefined);
      (mockAnalyticsService.track as any).mockResolvedValue(undefined);

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        analyticsService: mockAnalyticsService,
        logger: mockLogger,
        autoSchedule: false,
      });

      await service.checkExpiredInvoices();

      expect(mockAnalyticsService.track).toHaveBeenCalledWith('invoice_expired', {
        payment_id: expiredPayment.id,
        user_id: expiredPayment.user_id,
        amount: expiredPayment.amount,
        currency: expiredPayment.currency,
        expires_at: expiredPayment.expires_at,
        expired_at: expect.any(Number),
        expired_duration_seconds: expect.any(Number),
        description: expiredPayment.description,
      });
    });

    it('should work without analytics service (optional dependency)', async () => {
      const expiredPayment = createMockPayment();

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockResolvedValue(undefined);

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        // No analytics service provided
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      expect(result.expiredCount).toBe(1);
      expect(mockAnalyticsService.track).not.toHaveBeenCalled();
    });

    it('should continue processing if analytics fails', async () => {
      const expiredPayment = createMockPayment();

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockResolvedValue(undefined);
      (mockAnalyticsService.track as any).mockRejectedValue(new Error('Analytics unavailable'));

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        analyticsService: mockAnalyticsService,
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      // Should fail due to analytics error
      expect(result.failedCount).toBe(1);
      expect(result.errors[0].error).toContain('Analytics unavailable');
    });
  });

  describe('Configuration', () => {
    it('should use custom expiration window', () => {
      const customWindow = 12 * 60 * 60; // 12 hours

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
        expirationWindowSeconds: customWindow,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Invoice Expiration Service initialized',
        expect.objectContaining({
          expirationWindowSeconds: customWindow,
        })
      );
    });

    it('should default to 24 hour expiration window', () => {
      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        logger: mockLogger,
        autoSchedule: false,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Invoice Expiration Service initialized',
        expect.objectContaining({
          expirationWindowSeconds: 24 * 60 * 60, // 24 hours
        })
      );
    });
  });

  describe('Lightning Node Cleanup', () => {
    it('should cancel invoice on Lightning node when expiring', async () => {
      const expiredPayment = createMockPayment();

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockResolvedValue(undefined);
      (mockLightningNodeService.cancelInvoice as any).mockResolvedValue(undefined);

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        lightningNodeService: mockLightningNodeService,
        logger: mockLogger,
        autoSchedule: false,
      });

      await service.checkExpiredInvoices();

      expect(mockLightningNodeService.cancelInvoice).toHaveBeenCalledWith(
        expiredPayment.payment_hash
      );

      const metrics = service.getMetrics();
      expect(metrics.totalCleanedUp).toBe(1);
    });

    it('should continue processing if Lightning node cleanup fails', async () => {
      const expiredPayment = createMockPayment();

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockResolvedValue(undefined);
      (mockLightningNodeService.cancelInvoice as any).mockRejectedValue(
        new Error('Lightning node unavailable')
      );

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        lightningNodeService: mockLightningNodeService,
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      // Should still successfully expire despite cleanup failure
      expect(result.expiredCount).toBe(1);
      expect(result.failedCount).toBe(0);

      // Should log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to cancel Lightning invoice',
        expect.objectContaining({
          paymentId: expiredPayment.id,
          paymentHash: expiredPayment.payment_hash,
        })
      );
    });

    it('should work without Lightning node service (optional dependency)', async () => {
      const expiredPayment = createMockPayment();

      (mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [expiredPayment],
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockStateMachine.transition as any).mockResolvedValue({
        success: true,
      });

      (mockEmailService.sendInvoiceExpiredEmail as any).mockResolvedValue(undefined);

      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        // No Lightning node service provided
        logger: mockLogger,
        autoSchedule: false,
      });

      const result = await service.checkExpiredInvoices();

      expect(result.expiredCount).toBe(1);
      expect(mockLightningNodeService.cancelInvoice).not.toHaveBeenCalled();
    });

    it('should track Lightning cleanup metric correctly', () => {
      const service = createService({
        supabase: mockSupabase,
        stateMachine: mockStateMachine,
        emailService: mockEmailService,
        lightningNodeService: mockLightningNodeService,
        logger: mockLogger,
        autoSchedule: false,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Invoice Expiration Service initialized',
        expect.objectContaining({
          lightningNodeCleanup: true,
        })
      );
    });
  });
});
