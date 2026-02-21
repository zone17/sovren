/**
 * Payment Integration Test Fixtures
 * User Story: US-E5-031
 * Comprehensive test data factories for payment integration testing
 */

import type {
  PaymentInvoice,
  PaymentTransaction,
  PaymentProvider
} from '../../../types/payment';
import {
  PaymentMethod,
  PaymentStatus,
} from '../../../types/payment';
import type {
  Subscription,
  SubscriptionPlan
} from '../../../types/subscription';
import {
  SubscriptionStatus,
  SubscriptionTier,
} from '../../../types/subscription';
import {
  Currency,
} from '../../../types/currency';
import type {
  WebhookEndpoint
} from '../../../types/webhook';
import {
  WebhookEventType,
} from '../../../types/webhook';

/**
 * Generate unique ID
 */
export function generateId(prefix: string): string {
  return `${prefix}_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Create mock payment invoice
 */
export function createMockInvoice(overrides?: Partial<PaymentInvoice>): PaymentInvoice {
  return {
    id: generateId('inv'),
    userId: generateId('user'),
    amount: 100000, // 100,000 sats
    currency: 'SAT' as Currency,
    description: 'Test payment',
    bolt11: 'lnbc1000n1...',
    paymentHash: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
    status: 'pending' as PaymentStatus,
    createdAt: new Date(),
    metadata: {},
    ...overrides
  };
}

/**
 * Create mock payment transaction
 */
export function createMockTransaction(overrides?: Partial<PaymentTransaction>): PaymentTransaction {
  return {
    id: generateId('tx'),
    userId: generateId('user'),
    invoiceId: generateId('inv'),
    amount: 100000,
    currency: 'SAT' as Currency,
    method: 'lightning' as PaymentMethod,
    provider: 'lnd' as PaymentProvider,
    status: 'completed' as PaymentStatus,
    fee: 100,
    createdAt: new Date(),
    completedAt: new Date(),
    retryCount: 0,
    metadata: {},
    ...overrides
  };
}

/**
 * Create mock subscription plan
 */
export function createMockPlan(overrides?: Partial<SubscriptionPlan>): SubscriptionPlan {
  return {
    id: generateId('plan'),
    name: 'Test Plan',
    tier: 'creator' as SubscriptionTier,
    interval: 'monthly',
    price: 100000, // 100,000 sats/month
    currency: 'SAT' as Currency,
    features: ['feature1', 'feature2'],
    trialDays: 7,
    active: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create mock subscription
 */
export function createMockSubscription(overrides?: Partial<Subscription>): Subscription {
  const now = new Date();
  return {
    id: generateId('sub'),
    userId: generateId('user'),
    planId: generateId('plan'),
    status: 'active' as SubscriptionStatus,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
    cancelAtPeriodEnd: false,
    trialEnd: undefined,
    createdAt: now,
    updatedAt: now,
    metadata: {},
    ...overrides
  };
}

/**
 * Create mock webhook endpoint
 */
export function createMockWebhookEndpoint(overrides?: Partial<WebhookEndpoint>): WebhookEndpoint {
  return {
    id: generateId('wh_endpoint'),
    userId: generateId('user'),
    url: 'https://example.com/webhook',
    description: 'Test webhook',
    secret: 'whsec_test_' + 'a'.repeat(64),
    events: [
      'payment.received' as WebhookEventType,
      'payment.failed' as WebhookEventType
    ],
    enabled: true,
    timeout: 30000,
    createdAt: new Date(),
    updatedAt: new Date(),
    failureCount: 0,
    circuitState: 'closed',
    metadata: {},
    ...overrides
  };
}

/**
 * Batch create mock transactions
 */
export function createMockTransactions(count: number, overrides?: Partial<PaymentTransaction>): PaymentTransaction[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTransaction({
      ...overrides,
      id: generateId(`tx_${i}`),
      createdAt: new Date(Date.now() - (count - i) * 60000) // Spread over time
    })
  );
}

/**
 * Batch create mock subscriptions
 */
export function createMockSubscriptions(count: number, overrides?: Partial<Subscription>): Subscription[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSubscription({
      ...overrides,
      id: generateId(`sub_${i}`)
    })
  );
}

/**
 * Wait helper for async tests
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create test date range
 */
export function createDateRange(daysBack: number): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { startDate, endDate };
}

/**
 * Mock HTTP server for webhook testing
 */
export class MockWebhookServer {
  private receivedWebhooks: Array<{
    url: string;
    payload: any;
    headers: Record<string, string>;
    timestamp: Date;
  }> = [];
  private responses: Map<string, { status: number; body: any }> = new Map();

  recordWebhook(url: string, payload: any, headers: Record<string, string>): void {
    this.receivedWebhooks.push({ url, payload, headers, timestamp: new Date() });
  }

  setResponse(url: string, status: number, body: any): void {
    this.responses.set(url, { status, body });
  }

  getResponse(url: string): { status: number; body: any } {
    return this.responses.get(url) || { status: 200, body: { received: true } };
  }

  getReceivedWebhooks(): typeof this.receivedWebhooks {
    return this.receivedWebhooks;
  }

  reset(): void {
    this.receivedWebhooks = [];
    this.responses.clear();
  }
}

/**
 * Mock Lightning Node for testing
 */
export class MockLightningNode {
  private invoices = new Map<string, {
    paid: boolean;
    amount: number;
    expiresAt: Date;
  }>();
  private payments = new Map<string, {
    status: 'pending' | 'succeeded' | 'failed';
    amount: number;
  }>();

  createInvoice(amount: number, description: string): {
    bolt11: string;
    paymentHash: string;
    expiresAt: Date;
  } {
    const paymentHash = 'hash_' + Math.random().toString(36).substring(7);
    const bolt11 = 'lnbc' + amount + 'n1' + Math.random().toString(36).substring(7);
    const expiresAt = new Date(Date.now() + 3600000);

    this.invoices.set(paymentHash, { paid: false, amount, expiresAt });

    return { bolt11, paymentHash, expiresAt };
  }

  payInvoice(paymentHash: string): boolean {
    const invoice = this.invoices.get(paymentHash);
    if (!invoice) return false;
    if (invoice.paid) return false;
    if (invoice.expiresAt < new Date()) return false;

    invoice.paid = true;
    this.invoices.set(paymentHash, invoice);
    return true;
  }

  checkInvoice(paymentHash: string): {
    paid: boolean;
    amount: number;
    expiresAt: Date;
  } | null {
    return this.invoices.get(paymentHash) || null;
  }

  sendPayment(bolt11: string, amount: number): string {
    const paymentId = 'payment_' + Math.random().toString(36).substring(7);
    this.payments.set(paymentId, { status: 'pending', amount });

    // Simulate async payment
    setTimeout(() => {
      const payment = this.payments.get(paymentId);
      if (payment) {
        payment.status = 'succeeded';
        this.payments.set(paymentId, payment);
      }
    }, 100);

    return paymentId;
  }

  checkPayment(paymentId: string): {
    status: 'pending' | 'succeeded' | 'failed';
    amount: number;
  } | null {
    return this.payments.get(paymentId) || null;
  }

  simulateFailure(paymentHash: string): void {
    this.invoices.delete(paymentHash);
  }

  reset(): void {
    this.invoices.clear();
    this.payments.clear();
  }
}

/**
 * Mock Exchange Rate Provider
 */
export class MockExchangeRateProvider {
  private rates = new Map<string, number>();

  constructor() {
    // Set default rates
    this.rates.set('BTC:USD', 45000);
    this.rates.set('BTC:EUR', 42000);
    this.rates.set('BTC:GBP', 36000);
    this.rates.set('SAT:BTC', 0.00000001);
    this.rates.set('SAT:USD', 0.00045);
  }

  setRate(from: Currency, to: Currency, rate: number): void {
    this.rates.set(`${from}:${to}`, rate);
  }

  getRate(from: Currency, to: Currency): number {
    return this.rates.get(`${from}:${to}`) || 1;
  }

  reset(): void {
    this.rates.clear();
  }
}

/**
 * Test database helper
 */
export class TestDatabase {
  private data = new Map<string, Map<string, any>>();

  async save(collection: string, id: string, data: any): Promise<void> {
    if (!this.data.has(collection)) {
      this.data.set(collection, new Map());
    }
    this.data.get(collection)!.set(id, { ...data });
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const coll = this.data.get(collection);
    return (coll?.get(id) as T) || null;
  }

  async findAll<T>(collection: string): Promise<T[]> {
    const coll = this.data.get(collection);
    return coll ? Array.from(coll.values()) as T[] : [];
  }

  async delete(collection: string, id: string): Promise<void> {
    this.data.get(collection)?.delete(id);
  }

  async clear(collection?: string): Promise<void> {
    if (collection) {
      this.data.delete(collection);
    } else {
      this.data.clear();
    }
  }

  async count(collection: string): Promise<number> {
    return this.data.get(collection)?.size || 0;
  }
}

/**
 * Test metrics collector
 */
export class TestMetricsCollector {
  private metrics: Array<{
    name: string;
    value: number;
    timestamp: Date;
    labels?: Record<string, string>;
  }> = [];

  record(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.push({ name, value, timestamp: new Date(), labels });
  }

  getMetrics(name?: string): typeof this.metrics {
    return name
      ? this.metrics.filter(m => m.name === name)
      : this.metrics;
  }

  getAverage(name: string): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, m) => sum + m.value, 0) / filtered.length;
  }

  getMax(name: string): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    return Math.max(...filtered.map(m => m.value));
  }

  getMin(name: string): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    return Math.min(...filtered.map(m => m.value));
  }

  reset(): void {
    this.metrics = [];
  }
}
