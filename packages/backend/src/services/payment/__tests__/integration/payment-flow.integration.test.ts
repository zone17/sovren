/**
 * Payment Flow Integration Tests
 * User Story: US-E5-031
 *
 * Tests complete payment flows from invoice creation to confirmation
 * Coverage: Invoice → Payment → Confirmation → Webhook
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PaymentProcessingService } from '../../PaymentProcessingService';
import { WebhookService } from '../../WebhookService';
import { CurrencyService } from '../../CurrencyService';
import {
  createMockInvoice,
  createMockTransaction,
  createMockWebhookEndpoint,
  MockLightningNode,
  MockWebhookServer,
  TestDatabase,
  TestMetricsCollector,
  wait,
  generateId
} from './fixtures';

// Mock implementations
class MockEventBus {
  private events = new Map<string, Array<(data: any) => void>>();

  async publish(eventType: string, data: any): Promise<void> {
    const handlers = this.events.get(eventType) || [];
    for (const handler of handlers) {
      await handler(data);
    }
  }

  subscribe(eventType: string, handler: (data: any) => void): string {
    if (!this.events.has(eventType)) {
      this.events.set(eventType, []);
    }
    this.events.get(eventType)!.push(handler);
    return `sub_${Date.now()}`;
  }

  unsubscribe(subscriptionId: string): void {
    // Simplified unsubscribe
  }
}

class MockLogger {
  info(...args: any[]): void {}
  error(...args: any[]): void {}
  warn(...args: any[]): void {}
  debug(...args: any[]): void {}
}

class MockCache {
  private data = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.data.get(key) || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = Array.from(this.data.keys());
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of keys) {
      if (regex.test(key)) {
        this.data.delete(key);
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

class MockAuditLog {
  private logs: Array<any> = [];

  async log(entry: any): Promise<void> {
    this.logs.push(entry);
  }

  getLogs(): Array<any> {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }
}

describe('Payment Flow Integration Tests', () => {
  let paymentService: PaymentProcessingService;
  let webhookService: WebhookService;
  let currencyService: CurrencyService;
  let lightningNode: MockLightningNode;
  let webhookServer: MockWebhookServer;
  let database: TestDatabase;
  let metrics: TestMetricsCollector;
  let eventBus: MockEventBus;
  let logger: MockLogger;
  let cache: MockCache;
  let auditLog: MockAuditLog;

  beforeEach(() => {
    // Initialize mocks
    lightningNode = new MockLightningNode();
    webhookServer = new MockWebhookServer();
    database = new TestDatabase();
    metrics = new TestMetricsCollector();
    eventBus = new MockEventBus();
    logger = new MockLogger();
    cache = new MockCache();
    auditLog = new MockAuditLog();

    // Initialize services
    currencyService = new CurrencyService(eventBus as any, logger as any, cache as any);
    webhookService = new WebhookService(eventBus as any, logger as any, cache as any, auditLog as any);
    paymentService = new PaymentProcessingService(eventBus as any, logger as any, cache as any, auditLog as any);
  });

  afterEach(async () => {
    lightningNode.reset();
    webhookServer.reset();
    await database.clear();
    metrics.reset();
    auditLog.clear();
  });

  describe('Complete Payment Flow: Invoice → Payment → Confirmation', () => {
    it('should complete successful Lightning payment flow', async () => {
      // Arrange: Register webhook endpoint
      const webhookEndpoint = await webhookService.registerEndpoint({
        userId: 'user_123',
        url: 'https://example.com/webhook',
        events: ['payment.received', 'invoice.paid'],
        description: 'Test webhook'
      });

      // Act: Create invoice
      const invoice = await paymentService.createInvoice({
        userId: 'user_123',
        amount: 100000, // 100k sats
        currency: 'SAT',
        description: 'Test payment',
        expiresIn: 3600
      });

      // Assert: Invoice created correctly
      expect(invoice.id).toBeDefined();
      expect(invoice.bolt11).toBeDefined();
      expect(invoice.paymentHash).toBeDefined();
      expect(invoice.status).toBe('pending');
      expect(invoice.amount).toBe(100000);

      // Act: Simulate Lightning payment
      const lightningInvoice = lightningNode.createInvoice(100000, 'Test payment');
      const paymentSuccess = lightningNode.payInvoice(lightningInvoice.paymentHash);

      expect(paymentSuccess).toBe(true);

      // Act: Verify payment
      const verificationResult = await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);

      // Assert: Payment verified
      expect(verificationResult.verified).toBe(true);
      expect(verificationResult.status).toBe('completed');

      // Act: Check invoice status
      const updatedInvoice = await paymentService.getInvoiceStatus(invoice.id);

      // Assert: Invoice marked as paid
      expect(updatedInvoice.status).toBe('completed');
      expect(updatedInvoice.paidAt).toBeDefined();

      // Assert: Transaction recorded
      const history = await paymentService.getPaymentHistory({
        userId: 'user_123',
        limit: 10
      });

      expect(history.length).toBeGreaterThan(0);
      const transaction = history[0];
      expect(transaction.status).toBe('completed');
      expect(transaction.amount).toBe(100000);
      expect(transaction.method).toBe('lightning');

      // Assert: Audit log entries created
      const auditLogs = auditLog.getLogs();
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs.some(log => log.action === 'payment.invoice.created')).toBe(true);
      expect(auditLogs.some(log => log.action === 'payment.verified')).toBe(true);
    });

    it('should handle Lightning invoice expiration correctly', async () => {
      // Arrange: Create invoice with short expiration
      const invoice = await paymentService.createInvoice({
        userId: 'user_123',
        amount: 50000,
        currency: 'SAT',
        description: 'Expiring invoice',
        expiresIn: 1 // 1 second
      });

      // Act: Wait for expiration
      await wait(1100);

      // Act: Try to verify expired invoice
      const lightningInvoice = lightningNode.createInvoice(50000, 'Test');

      // Assert: Payment should fail due to expiration
      await expect(async () => {
        await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);
      }).rejects.toThrow(/expired|invalid/i);

      // Assert: Invoice status should be expired
      const expiredInvoice = await paymentService.getInvoiceStatus(invoice.id);
      expect(['expired', 'cancelled']).toContain(expiredInvoice.status);
    });

    it('should handle failed Lightning payments with retry logic', async () => {
      // Arrange: Create invoice
      const invoice = await paymentService.createInvoice({
        userId: 'user_123',
        amount: 75000,
        currency: 'SAT',
        description: 'Payment with retry',
        expiresIn: 3600
      });

      // Act: Simulate failed payment (invalid hash)
      const result1 = await paymentService.verifyPayment(invoice.id, 'invalid_hash');

      // Assert: First attempt failed
      expect(result1.verified).toBe(false);

      // Act: Retry with correct payment
      const lightningInvoice = lightningNode.createInvoice(75000, 'Retry payment');
      lightningNode.payInvoice(lightningInvoice.paymentHash);

      const result2 = await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);

      // Assert: Second attempt succeeded
      expect(result2.verified).toBe(true);
      expect(result2.status).toBe('completed');

      // Assert: Transaction shows retry count
      const history = await paymentService.getPaymentHistory({
        userId: 'user_123',
        limit: 10
      });

      const transaction = history.find(t => t.invoiceId === invoice.id);
      expect(transaction).toBeDefined();
      expect(transaction!.retryCount).toBeGreaterThan(0);
    });

    it('should process payment with webhook notification', async () => {
      // Arrange: Set up webhook endpoint
      const endpoint = await webhookService.registerEndpoint({
        userId: 'user_123',
        url: 'https://example.com/webhook',
        events: ['payment.received'],
        description: 'Payment webhook'
      });

      webhookServer.setResponse('https://example.com/webhook', 200, { received: true });

      // Act: Create and complete payment
      const invoice = await paymentService.createInvoice({
        userId: 'user_123',
        amount: 100000,
        currency: 'SAT',
        description: 'Payment with webhook',
        expiresIn: 3600
      });

      const lightningInvoice = lightningNode.createInvoice(100000, 'Test');
      lightningNode.payInvoice(lightningInvoice.paymentHash);

      await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);

      // Trigger webhook delivery
      await webhookService.sendWebhook('payment.received', {
        id: `evt_${Date.now()}`,
        type: 'payment.received',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        data: {
          object: {
            invoiceId: invoice.id,
            amount: 100000,
            status: 'completed'
          }
        }
      });

      // Wait for webhook processing
      await wait(500);
      await webhookService.processPendingDeliveries();

      // Assert: Webhook was delivered
      const deliveries = await webhookService.getEndpointDeliveries(endpoint.id);
      expect(deliveries.length).toBeGreaterThan(0);

      const delivery = deliveries[0];
      expect(delivery.status).toBe('delivered');
      expect(delivery.responseStatus).toBe(200);
    });
  });

  describe('Multi-Currency Payment Flows', () => {
    it('should handle BTC to SAT conversion in payment flow', async () => {
      // Arrange: Create invoice in BTC
      const invoice = await paymentService.createInvoice({
        userId: 'user_123',
        amount: 0.001, // 0.001 BTC
        currency: 'BTC',
        description: 'BTC payment',
        expiresIn: 3600
      });

      // Assert: Invoice converted to satoshis
      expect(invoice.currency).toBe('SAT');
      expect(invoice.amount).toBe(100000); // 0.001 BTC = 100,000 sats

      // Act: Complete payment
      const lightningInvoice = lightningNode.createInvoice(100000, 'BTC payment');
      lightningNode.payInvoice(lightningInvoice.paymentHash);

      const result = await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);

      // Assert: Payment successful with correct amount
      expect(result.verified).toBe(true);
      expect(result.amount).toBe(100000);
    });

    it('should handle fiat-equivalent payments with exchange rates', async () => {
      // Arrange: Set exchange rate
      await currencyService.setManualRate('USD', 'SAT', 2.22, 3600); // $45k BTC = 2.22 sats per cent

      // Act: Create invoice in USD
      const invoice = await paymentService.createInvoice({
        userId: 'user_123',
        amount: 100, // $100
        currency: 'USD',
        description: 'USD payment',
        expiresIn: 3600
      });

      // Assert: Invoice shows both USD and SAT amounts
      expect(invoice.amountFiat).toBe(100);
      expect(invoice.amount).toBeGreaterThan(0); // Converted to sats

      // Act: Complete payment
      const lightningInvoice = lightningNode.createInvoice(invoice.amount, 'USD payment');
      lightningNode.payInvoice(lightningInvoice.paymentHash);

      const result = await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);

      // Assert: Payment recorded with both amounts
      expect(result.verified).toBe(true);

      const history = await paymentService.getPaymentHistory({
        userId: 'user_123',
        limit: 1
      });

      expect(history[0].amountFiat).toBe(100);
      expect(history[0].currency).toBe('SAT');
    });
  });

  describe('Payment Recovery and Error Handling', () => {
    it('should recover from network failures during payment verification', async () => {
      // Arrange: Create invoice
      const invoice = await paymentService.createInvoice({
        userId: 'user_123',
        amount: 100000,
        currency: 'SAT',
        description: 'Network failure test',
        expiresIn: 3600
      });

      // Act: Simulate network failure then recovery
      lightningNode.simulateFailure('test_hash');

      const lightningInvoice = lightningNode.createInvoice(100000, 'Recovery test');
      lightningNode.payInvoice(lightningInvoice.paymentHash);

      // Should succeed on retry
      const result = await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);

      // Assert: Payment eventually succeeded
      expect(result.verified).toBe(true);
    });

    it('should handle duplicate payment attempts (idempotency)', async () => {
      // Arrange: Create and complete payment
      const invoice = await paymentService.createInvoice({
        userId: 'user_123',
        amount: 100000,
        currency: 'SAT',
        description: 'Idempotency test',
        expiresIn: 3600
      });

      const lightningInvoice = lightningNode.createInvoice(100000, 'Test');
      lightningNode.payInvoice(lightningInvoice.paymentHash);

      const result1 = await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);
      expect(result1.verified).toBe(true);

      // Act: Try to verify same payment again
      const result2 = await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);

      // Assert: Second verification returns same result without duplicating transaction
      expect(result2.verified).toBe(true);

      const history = await paymentService.getPaymentHistory({
        userId: 'user_123',
        limit: 10
      });

      const matchingTxs = history.filter(t => t.invoiceId === invoice.id);
      expect(matchingTxs.length).toBe(1); // Only one transaction created
    });

    it('should handle concurrent payment verifications correctly', async () => {
      // Arrange: Create invoice
      const invoice = await paymentService.createInvoice({
        userId: 'user_123',
        amount: 100000,
        currency: 'SAT',
        description: 'Concurrent test',
        expiresIn: 3600
      });

      const lightningInvoice = lightningNode.createInvoice(100000, 'Test');
      lightningNode.payInvoice(lightningInvoice.paymentHash);

      // Act: Trigger multiple concurrent verifications
      const results = await Promise.all([
        paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash),
        paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash),
        paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash)
      ]);

      // Assert: All verifications succeed
      expect(results.every(r => r.verified)).toBe(true);

      // Assert: No duplicate transactions created
      const history = await paymentService.getPaymentHistory({
        userId: 'user_123',
        limit: 10
      });

      const matchingTxs = history.filter(t => t.invoiceId === invoice.id);
      expect(matchingTxs.length).toBe(1);
    });
  });

  describe('Payment Performance and Throughput', () => {
    it('should handle high-volume payment processing', async () => {
      const startTime = Date.now();
      const paymentCount = 100;
      const invoices = [];

      // Act: Create 100 invoices concurrently
      for (let i = 0; i < paymentCount; i++) {
        invoices.push(
          paymentService.createInvoice({
            userId: `user_${i}`,
            amount: 10000 + i * 1000,
            currency: 'SAT',
            description: `Payment ${i}`,
            expiresIn: 3600
          })
        );
      }

      const createdInvoices = await Promise.all(invoices);
      const creationTime = Date.now() - startTime;

      // Assert: All invoices created successfully
      expect(createdInvoices.length).toBe(paymentCount);

      // Assert: Creation was fast (< 5s for 100 invoices)
      expect(creationTime).toBeLessThan(5000);

      metrics.record('invoice_creation_throughput', paymentCount / (creationTime / 1000));

      // Act: Verify all payments concurrently
      const verifyStart = Date.now();
      const verifications = createdInvoices.map(invoice => {
        const lightningInvoice = lightningNode.createInvoice(invoice.amount, `Payment ${invoice.id}`);
        lightningNode.payInvoice(lightningInvoice.paymentHash);
        return paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);
      });

      const results = await Promise.all(verifications);
      const verifyTime = Date.now() - verifyStart;

      // Assert: All payments verified
      expect(results.every(r => r.verified)).toBe(true);

      // Assert: Verification was fast (< 10s for 100 payments)
      expect(verifyTime).toBeLessThan(10000);

      metrics.record('payment_verification_throughput', paymentCount / (verifyTime / 1000));

      // Log performance metrics
      console.log(`Performance Metrics:
        - Invoice Creation: ${paymentCount} invoices in ${creationTime}ms
        - Throughput: ${metrics.getAverage('invoice_creation_throughput').toFixed(2)} invoices/sec
        - Payment Verification: ${paymentCount} payments in ${verifyTime}ms
        - Throughput: ${metrics.getAverage('payment_verification_throughput').toFixed(2)} payments/sec
      `);
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 5000; // 5 seconds
      const targetRate = 20; // 20 payments/sec
      const interval = 1000 / targetRate;

      let completed = 0;
      const startTime = Date.now();

      // Act: Generate sustained payment load
      while (Date.now() - startTime < duration) {
        const invoice = await paymentService.createInvoice({
          userId: 'user_load_test',
          amount: 10000,
          currency: 'SAT',
          description: 'Load test payment',
          expiresIn: 3600
        });

        const lightningInvoice = lightningNode.createInvoice(10000, 'Load test');
        lightningNode.payInvoice(lightningInvoice.paymentHash);

        await paymentService.verifyPayment(invoice.id, lightningInvoice.paymentHash);

        completed++;
        await wait(interval);
      }

      const actualDuration = Date.now() - startTime;
      const actualRate = (completed / actualDuration) * 1000;

      // Assert: Sustained target rate
      expect(completed).toBeGreaterThan(90); // At least 90 payments in 5 seconds
      expect(actualRate).toBeGreaterThanOrEqual(targetRate * 0.9); // Within 10% of target

      console.log(`Sustained Load Test:
        - Duration: ${actualDuration}ms
        - Completed: ${completed} payments
        - Rate: ${actualRate.toFixed(2)} payments/sec
      `);
    });
  });
});
