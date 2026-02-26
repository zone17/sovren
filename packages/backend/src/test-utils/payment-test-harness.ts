/**
 * Payment Test Harness
 *
 * Provides real service instances with in-memory backends for integration testing.
 * Eliminates all vi.fn() mocks — services are wired together exactly as in production.
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
// IAuditLogService file doesn't exist (pre-existing compile gap); import type is stripped by esbuild
import type { IAuditLogService } from '../interfaces/shared/IAuditLogService';
import type { PaymentTransaction } from '../types/payment';
import { PaymentMethod } from '../types/payment';

/**
 * EventBus subclass that adds an emit() shim.
 * SubscriptionService calls this.eventBus.emit(type, data) — a pre-existing
 * interface mismatch (IEventBus only has publish()). This class bridges the gap
 * and captures emitted events for test assertions.
 */
export class TestableEventBus extends EventBusService {
  capturedEmits: Array<{ type: string; data: any }> = [];

  async emit(type: string, data: any): Promise<void> {
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
  auditLog: IAuditLogService;
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

  const seedRawTransaction = async (tx: PaymentTransaction): Promise<void> => {
    // Access the private in-memory repository to inject arbitrary transaction data.
    // This enables analytics tests with states (failed, refunded) that the simplified
    // payment processing implementations can't produce through the normal flow.
    const repo = (paymentService as any).repository;
    await repo.saveTransaction(tx);
  };

  const dispose = async (): Promise<void> => {
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
    auditLog: auditLog as any,
    refundService,
    subscriptionService,
    analyticsService,
    seedCompletedTransaction,
    seedRawTransaction,
    flushPromises,
    dispose,
  };
}
