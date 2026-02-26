/**
 * Payment Test Harness
 *
 * Provides real service instances with in-memory backends for integration testing.
 * Eliminates all vi.fn() mocks — services are wired together exactly as in production.
 *
 * ## Per-Service Setup Guide
 *
 * **RefundService tests**: Use harness directly — seedCompletedTransaction() creates
 * transactions that can be refunded via refundService.processRefund().
 *
 * **SubscriptionService tests**: Call installSubscriptionPaymentShim(harness) before any
 * subscription operations. SubscriptionService calls processPayment() with non-standard
 * params ({userId, amount, currency}) that the real PaymentProcessingService doesn't accept.
 * TODO(payment-api-alignment): Remove shim when SubscriptionService uses ProcessPaymentParams.
 *
 * **PaymentAnalyticsService tests**: Use seedRawTransaction() to inject arbitrary transaction
 * states (failed, refunded) that the simplified payment flow can't produce. Use
 * makeDomainEvent() for event-driven analytics tests.
 */

import { EventBusService } from '../services/EventBusService';
import { CurrencyService } from '../services/payment/CurrencyService';
import { PaymentProcessingService } from '../services/payment/PaymentProcessingService';
import { AuditLogService } from '../services/AuditLogService';
import { RefundService } from '../services/payment/RefundService';
import { SubscriptionService } from '../services/payment/SubscriptionService';
import { PaymentAnalyticsService } from '../services/payment/PaymentAnalyticsService';
import type { ILogger } from '../interfaces/shared/ILogger';
import type { ICacheService, CacheOptions } from '../interfaces/shared/ICacheService';
import type { IPaymentProcessingService } from '../interfaces/payment/IPaymentProcessingService';
import type { ICurrencyService } from '../interfaces/payment/ICurrencyService';
import type { DomainEvent } from '../interfaces/shared/IEventBus';
import { DomainEventType, DomainEventBuilder } from '../interfaces/shared/IEventBus';
import type { PaymentTransaction, PaymentResult } from '../types/payment';
import { PaymentMethod, PaymentStatus } from '../types/payment';
import { Currency } from '../types/currency';

/**
 * EventBus subclass that adds an emit() shim.
 * SubscriptionService calls this.eventBus.emit(type, data) — a pre-existing
 * interface mismatch (IEventBus only has publish()). This class bridges the gap
 * and captures emitted events for test assertions.
 *
 * **WARNING**: Events are captured but NOT processed — subscribers registered via
 * subscribe() will NOT fire. If your test depends on event-driven side effects,
 * use publish() directly with a DomainEvent instead.
 *
 * TODO(eventbus-emit-publish): SubscriptionService should use publish() instead of
 * emit(). When fixed, this shim and the capturedEmits array become unnecessary.
 */
export class TestableEventBus extends EventBusService {
  capturedEmits: Array<{ type: string; data: unknown }> = [];

  async emit(type: string, data: unknown): Promise<void> {
    this.capturedEmits.push({ type, data });
  }

  clearCapturedEmits(): void {
    this.capturedEmits = [];
  }
}

/**
 * Map-based ICacheService for tests. No external dependencies.
 */
export class InMemoryCacheService implements ICacheService {
  private cache = new Map<string, { value: any; expiry: number; tags?: string[] }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiry > 0 && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number, options?: CacheOptions): Promise<void> {
    const expiry = ttl ? Date.now() + ttl * 1000 : 0;
    this.cache.set(key, { value, expiry, tags: options?.tags });
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiry > 0 && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  async invalidate(pattern: string): Promise<number> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let count = 0;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.some((t) => tags.includes(t))) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  async getTtl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry || entry.expiry === 0) return -1;
    return Math.max(0, Math.ceil((entry.expiry - Date.now()) / 1000));
  }

  async setTtl(key: string, ttl: number): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    entry.expiry = Date.now() + ttl * 1000;
    return true;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, await this.get<T>(key));
    }
    return result;
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async remember<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async dispose(): Promise<void> {
    this.cache.clear();
  }
}

/**
 * No-op logger for tests. Prevents console noise.
 */
export class SilentLogger implements ILogger {
  debug(_message: string, _meta?: any): void {}
  info(_message: string, _meta?: any): void {}
  warn(_message: string, _meta?: any): void {}
  error(_message: string, _error?: Error | any): void {}
}

export interface PaymentTestHarness {
  eventBus: TestableEventBus;
  logger: ILogger;
  cache: ICacheService;
  currencyService: ICurrencyService;
  paymentService: IPaymentProcessingService;
  auditLog: AuditLogService;
  refundService: RefundService;
  subscriptionService: SubscriptionService;
  analyticsService: PaymentAnalyticsService;

  /** Create a completed transaction via real PaymentProcessingService flow. */
  seedCompletedTransaction: (overrides?: {
    userId?: string;
    amount?: number;
    method?: PaymentMethod;
  }) => Promise<PaymentTransaction>;

  /** Save a raw transaction to the in-memory repository (for analytics tests needing arbitrary states). */
  seedRawTransaction: (tx: PaymentTransaction) => Promise<void>;

  /** Flush fire-and-forget promises (e.g. auto-processing). */
  flushPromises: () => Promise<void>;

  /** Clean up timers and subscriptions. */
  dispose: () => Promise<void>;
}

/**
 * Create a fully wired payment test harness with real services.
 * All services use in-memory backends — no external dependencies.
 */
export function createPaymentTestHarness(): PaymentTestHarness {
  const logger = new SilentLogger();
  const eventBus = new TestableEventBus(logger);
  const cache = new InMemoryCacheService();
  const currencyService = new CurrencyService(eventBus, logger, cache);
  const paymentService = new PaymentProcessingService(eventBus, logger, cache);
  const auditLog = new AuditLogService(eventBus, logger, undefined, cache);
  const refundService = new RefundService(paymentService, currencyService, eventBus, logger, cache);
  const subscriptionService = new SubscriptionService(
    paymentService,
    currencyService,
    auditLog as any,
    eventBus,
    logger,
    undefined,
    cache
  );
  const analyticsService = new PaymentAnalyticsService(
    paymentService,
    currencyService,
    cache,
    eventBus,
    logger
  );

  const seedCompletedTransaction = async (overrides?: {
    userId?: string;
    amount?: number;
    method?: PaymentMethod;
  }): Promise<PaymentTransaction> => {
    const userId = overrides?.userId ?? 'test-user';
    const amount = overrides?.amount ?? 50;
    const method = overrides?.method ?? PaymentMethod.LIGHTNING;

    const invoice = await paymentService.createInvoice({
      userId,
      amount,
      currency: 'BTC',
      description: 'Test payment',
      method,
    });

    const result = await paymentService.processPayment({
      invoiceId: invoice.id,
      paymentRequest: invoice.paymentRequest,
      method,
    });

    const tx = await paymentService.getTransaction(result.transactionId!);
    if (!tx) throw new Error('Failed to seed transaction');
    return tx;
  };

  const flushPromises = async (): Promise<void> => {
    // Flush microtask queue to let fire-and-forget promises complete
    await new Promise<void>((resolve) => process.nextTick(resolve));
    // Double flush for nested async chains
    await new Promise<void>((resolve) => process.nextTick(resolve));
  };

  /**
   * Save a raw transaction to the in-memory repository for analytics tests
   * needing arbitrary states (failed, refunded) that the simplified payment
   * processing flow can't produce.
   *
   * **CAUTION**: Accesses private `repository` field via `as any`. If the
   * internal API changes, this will throw a descriptive error immediately.
   */
  const seedRawTransaction = async (tx: PaymentTransaction): Promise<void> => {
    const repo = (paymentService as any).repository;
    if (!repo || typeof repo.saveTransaction !== 'function') {
      throw new Error(
        'seedRawTransaction: PaymentProcessingService internal API changed. ' +
        'Expected (paymentService as any).repository.saveTransaction to exist.'
      );
    }
    await repo.saveTransaction(tx);
  };

  const dispose = async (): Promise<void> => {
    await paymentService.dispose();
    await currencyService.dispose();
    await auditLog.dispose();
    await analyticsService.dispose();
    await refundService.dispose();
    await subscriptionService.dispose();
    await eventBus.dispose();
    await cache.dispose();
  };

  return {
    eventBus,
    logger,
    cache,
    currencyService,
    paymentService,
    auditLog,
    refundService,
    subscriptionService,
    analyticsService,
    seedCompletedTransaction,
    seedRawTransaction,
    flushPromises,
    dispose,
  };
}

/**
 * Override processPayment on the harness to accept SubscriptionService's non-standard
 * call pattern ({userId, amount, currency, description}) and return a successful result.
 *
 * SubscriptionService internally calls processPayment with params that don't match
 * ProcessPaymentParams (needs invoiceId, method). This shim bridges the gap.
 *
 * TODO(payment-api-alignment): Remove when SubscriptionService uses ProcessPaymentParams.
 */
export function installSubscriptionPaymentShim(harness: PaymentTestHarness): void {
  let txCounter = 0;
  (harness.paymentService as any).processPayment = async (params: {
    userId?: string;
    amount?: number;
    currency?: Currency;
    description?: string;
  }): Promise<PaymentResult> => {
    txCounter++;
    return {
      success: true,
      transactionId: `shim-tx-${txCounter}`,
      paymentHash: `shim-hash-${txCounter}`,
      preimage: `shim-preimage-${txCounter}`,
      amount: params.amount ?? 0,
      fee: 0,
      timestamp: new Date(),
    };
  };
}

/**
 * Create a well-formed DomainEvent for publishing through the real EventBusService.
 * Wraps DomainEventBuilder with sensible test defaults.
 */
let eventCounter = 0;
export function makeDomainEvent(type: DomainEventType, payload: any = {}): DomainEvent {
  eventCounter++;
  return new DomainEventBuilder()
    .withType(type)
    .withAggregateId('test')
    .withAggregateType('test')
    .withPayload(payload)
    .withUserId('test-user')
    .withCorrelationId('test-corr')
    .withSource('test')
    .build();
}

/**
 * Override getPaymentHistory on the harness to return custom transaction arrays.
 * Reduces 9+ duplicate monkey-patch blocks to a single function call.
 */
export function overridePaymentHistory(harness: PaymentTestHarness, txs: PaymentTransaction[]): void {
  (harness.paymentService as any).getPaymentHistory = async () => txs;
}

/**
 * Override processPayment on the harness to simulate a payment failure.
 * Reduces 4+ duplicate failure blocks to a single function call.
 */
export function installFailedPaymentShim(harness: PaymentTestHarness, error = 'Payment failed'): void {
  (harness.paymentService as any).processPayment = async () => ({
    success: false,
    error,
    transactionId: '',
    amount: 0,
    fee: 0,
    currency: Currency.USD,
    status: PaymentStatus.FAILED,
    timestamp: new Date(),
  });
}
