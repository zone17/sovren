/**
 * Test Data Factory
 * Centralized test data generation for integration tests
 * Part of US-E5-034: Integration Test Suite
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Invoice,
  Payment,
  Subscription,
  User,
  Content,
  NostrEvent,
  Webhook,
  RefundRequest,
} from '../../types';

/**
 * Test User Factory
 */
export const createTestUser = (overrides: Partial<User> = {}): User => ({
  id: uuidv4(),
  email: `test-${Date.now()}@example.com`,
  username: `testuser-${Date.now()}`,
  nostrPublicKey: generateNostrPublicKey(),
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true,
  isVerified: false,
  role: 'user',
  ...overrides,
});

/**
 * Test Invoice Factory
 */
export const createTestInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: uuidv4(),
  userId: uuidv4(),
  amount: 1000,
  currency: 'BTC',
  status: 'pending',
  paymentRequest: generateBolt11Invoice(),
  paymentHash: generatePaymentHash(),
  description: 'Test invoice',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
  ...overrides,
});

/**
 * Test Payment Factory
 */
export const createTestPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: uuidv4(),
  invoiceId: uuidv4(),
  userId: uuidv4(),
  amount: 1000,
  currency: 'BTC',
  status: 'pending',
  preimage: null,
  settledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
  ...overrides,
});

/**
 * Test Subscription Factory
 */
export const createTestSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: uuidv4(),
  userId: uuidv4(),
  creatorId: uuidv4(),
  planId: uuidv4(),
  status: 'active',
  tier: 'basic',
  amount: 5000,
  currency: 'BTC',
  interval: 'monthly',
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600000), // 30 days
  cancelAt: null,
  canceledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
  ...overrides,
});

/**
 * Test Content Factory
 */
export const createTestContent = (overrides: Partial<Content> = {}): Content => ({
  id: uuidv4(),
  userId: uuidv4(),
  title: 'Test Content',
  body: 'This is test content',
  contentType: 'article',
  status: 'published',
  visibility: 'public',
  isPremium: false,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  publishedAt: new Date(),
  metadata: {},
  ...overrides,
});

/**
 * Test Nostr Event Factory
 */
export const createTestNostrEvent = (overrides: Partial<NostrEvent> = {}): NostrEvent => ({
  id: generateEventId(),
  pubkey: generateNostrPublicKey(),
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: 'Test nostr event',
  sig: generateSignature(),
  ...overrides,
});

/**
 * Test Webhook Factory
 */
export const createTestWebhook = (overrides: Partial<Webhook> = {}): Webhook => ({
  id: uuidv4(),
  url: 'https://example.com/webhook',
  secret: generateWebhookSecret(),
  events: ['payment.succeeded', 'payment.failed'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
  ...overrides,
});

/**
 * Test Refund Request Factory
 */
export const createTestRefund = (overrides: Partial<RefundRequest> = {}): RefundRequest => ({
  id: uuidv4(),
  paymentId: uuidv4(),
  amount: 1000,
  reason: 'customer_request',
  status: 'pending',
  requestedBy: uuidv4(),
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
  ...overrides,
});

/**
 * Helper: Generate BOLT11 invoice
 */
function generateBolt11Invoice(): string {
  return `lnbc${Math.floor(Math.random() * 10000)}u1p${generateRandomString(20)}`;
}

/**
 * Helper: Generate payment hash
 */
function generatePaymentHash(): string {
  return generateRandomString(64);
}

/**
 * Helper: Generate Nostr public key
 */
function generateNostrPublicKey(): string {
  return generateRandomString(64);
}

/**
 * Helper: Generate Nostr event ID
 */
function generateEventId(): string {
  return generateRandomString(64);
}

/**
 * Helper: Generate Nostr signature
 */
function generateSignature(): string {
  return generateRandomString(128);
}

/**
 * Helper: Generate webhook secret
 */
function generateWebhookSecret(): string {
  return `whsec_${generateRandomString(32)}`;
}

/**
 * Helper: Generate random hex string
 */
function generateRandomString(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Batch Test Data Generation
 */
export const createTestBatch = {
  users: (count: number): User[] => Array.from({ length: count }, () => createTestUser()),

  invoices: (count: number): Invoice[] => Array.from({ length: count }, () => createTestInvoice()),

  payments: (count: number): Payment[] => Array.from({ length: count }, () => createTestPayment()),

  subscriptions: (count: number): Subscription[] =>
    Array.from({ length: count }, () => createTestSubscription()),

  content: (count: number): Content[] => Array.from({ length: count }, () => createTestContent()),
};

/**
 * Test Scenario Builders
 */
export const scenarios = {
  /**
   * Complete payment flow scenario
   */
  paymentFlow: () => {
    const user = createTestUser();
    const invoice = createTestInvoice({ userId: user.id });
    const payment = createTestPayment({
      userId: user.id,
      invoiceId: invoice.id,
    });

    return { user, invoice, payment };
  },

  /**
   * Subscription lifecycle scenario
   */
  subscriptionLifecycle: () => {
    const subscriber = createTestUser();
    const creator = createTestUser({ role: 'creator' });
    const subscription = createTestSubscription({
      userId: subscriber.id,
      creatorId: creator.id,
    });

    return { subscriber, creator, subscription };
  },

  /**
   * Content publishing scenario
   */
  contentPublishing: () => {
    const creator = createTestUser({ role: 'creator' });
    const content = createTestContent({
      userId: creator.id,
      isPremium: true,
    });

    return { creator, content };
  },

  /**
   * Refund processing scenario
   */
  refundProcessing: () => {
    const user = createTestUser();
    const invoice = createTestInvoice({ userId: user.id });
    const payment = createTestPayment({
      userId: user.id,
      invoiceId: invoice.id,
      status: 'completed',
    });
    const refund = createTestRefund({ paymentId: payment.id });

    return { user, invoice, payment, refund };
  },
};

/**
 * Mock External Service Responses
 */
export const mockResponses = {
  lightning: {
    createInvoice: (amount: number) => ({
      payment_request: generateBolt11Invoice(),
      payment_hash: generatePaymentHash(),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }),

    checkPayment: (paymentHash: string) => ({
      settled: true,
      settle_date: Math.floor(Date.now() / 1000),
      amt_paid_sat: 1000,
    }),
  },

  nostr: {
    publishEvent: (event: NostrEvent) => ({
      success: true,
      eventId: event.id,
    }),
  },

  email: {
    send: (to: string, subject: string) => ({
      messageId: uuidv4(),
      accepted: [to],
      rejected: [],
    }),
  },
};
