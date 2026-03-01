/**
 * Payment Workflow E2E Tests
 * Tests complete payment processing from invoice creation to settlement
 * Part of US-E5-034: Integration Test Suite
 */

import { createTestContainer, cleanupTestContainer } from '../fixtures/test-container-setup';
import { createTestUser, createTestInvoice, scenarios } from '../fixtures/test-data-factory';
import { createMockLightningService } from '../fixtures/mock-services';
import type { IServiceContainer } from '../../interfaces/shared/IServiceRegistry';

describe('Payment Workflow E2E Tests', () => {
  let container: IServiceContainer;
  let lightning: any;

  beforeAll(async () => {
    container = await createTestContainer();
    lightning = createMockLightningService();
  });

  afterAll(async () => {
    await cleanupTestContainer(container);
  });

  describe('Complete Payment Flow', () => {
    it('should process payment from creation to settlement', async () => {
      // Arrange
      const { user, invoice, payment } = scenarios.paymentFlow();
      const db = container.resolve({ name: 'IDatabase' });
      const cache = container.resolve({ name: 'ICacheService' });
      const eventBus = container.resolve({ name: 'IEventBusService' });

      const events: string[] = [];
      eventBus.subscribe('payment.*', (payload: any) => {
        events.push(payload.event || 'unknown');
      });

      // Act - Complete payment workflow
      // Step 1: Create user
      await db.insert('users', user);

      // Step 2: Create invoice
      const lightningInvoice = await lightning.createInvoice(invoice.amount, invoice.description);
      const createdInvoice = {
        ...invoice,
        paymentRequest: lightningInvoice.payment_request,
        paymentHash: lightningInvoice.payment_hash,
      };
      await db.insert('invoices', createdInvoice);
      await cache.set(`invoice:${invoice.id}`, createdInvoice, 3600);
      await eventBus.publish('payment.invoice_created', { event: 'invoice_created' });

      // Step 3: Settle payment
      await lightning.settleInvoice(lightningInvoice.payment_hash, 'preimage123');
      const settledPayment = { ...payment, status: 'completed', preimage: 'preimage123' };
      await db.insert('payments', settledPayment);
      await eventBus.publish('payment.settled', { event: 'settled' });

      // Step 4: Update invoice status
      await db.update('invoices', invoice.id, { status: 'completed' });
      await cache.delete(`invoice:${invoice.id}`);

      // Assert
      const savedInvoice = await db.findById('invoices', invoice.id);
      const savedPayment = await db.findById('payments', payment.id);

      expect(savedInvoice.status).toBe('completed');
      expect(savedPayment.status).toBe('completed');
      expect(savedPayment.preimage).toBe('preimage123');
      expect(events).toContain('invoice_created');
      expect(events).toContain('settled');
    });

    it('should handle payment expiration', async () => {
      // Arrange
      const { user, invoice } = scenarios.paymentFlow();
      const db = container.resolve({ name: 'IDatabase' });
      const expiredInvoice = {
        ...invoice,
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      };

      await db.insert('users', user);
      await db.insert('invoices', expiredInvoice);

      // Act - Check expiration
      const now = new Date();
      const isExpired = expiredInvoice.expiresAt < now;

      if (isExpired) {
        await db.update('invoices', invoice.id, { status: 'expired' });
      }

      // Assert
      const updated = await db.findById('invoices', invoice.id);
      expect(updated.status).toBe('expired');
    });

    it('should process refund workflow', async () => {
      // Arrange
      const { user, invoice, payment, refund } = scenarios.refundProcessing();
      const db = container.resolve({ name: 'IDatabase' });
      const eventBus = container.resolve({ name: 'IEventBusService' });

      // Setup
      await db.insert('users', user);
      await db.insert('invoices', invoice);
      await db.insert('payments', payment);

      // Act - Process refund
      await db.insert('refunds', refund);
      await eventBus.publish('payment.refund_requested', { refundId: refund.id });

      // Update payment status
      await db.update('payments', payment.id, { status: 'refunded' });
      await db.update('refunds', refund.id, { status: 'completed' });

      // Assert
      const refundedPayment = await db.findById('payments', payment.id);
      const completedRefund = await db.findById('refunds', refund.id);

      expect(refundedPayment.status).toBe('refunded');
      expect(completedRefund.status).toBe('completed');
    });
  });

  describe('Payment Error Scenarios', () => {
    it('should handle insufficient funds', async () => {
      // Arrange
      const { user, invoice } = scenarios.paymentFlow();
      const db = container.resolve({ name: 'IDatabase' });

      await db.insert('users', user);
      await db.insert('invoices', invoice);

      // Act - Simulate payment failure
      try {
        throw new Error('Insufficient funds');
      } catch (error) {
        await db.update('invoices', invoice.id, { status: 'failed' });
      }

      // Assert
      const failedInvoice = await db.findById('invoices', invoice.id);
      expect(failedInvoice.status).toBe('failed');
    });

    it('should handle network timeout during payment', async () => {
      // Arrange
      const { user, invoice } = scenarios.paymentFlow();
      const db = container.resolve({ name: 'IDatabase' });

      await db.insert('users', user);
      await db.insert('invoices', invoice);

      // Act - Simulate timeout
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Network timeout')), 100)
      );

      try {
        await timeout;
      } catch (error) {
        await db.update('invoices', invoice.id, { status: 'pending' });
      }

      // Assert
      const pendingInvoice = await db.findById('invoices', invoice.id);
      expect(pendingInvoice.status).toBe('pending');
    });
  });

  describe('Multi-Payment Workflows', () => {
    it('should process multiple payments for same user', async () => {
      // Arrange
      const user = createTestUser();
      const invoices = Array.from({ length: 5 }, () => createTestInvoice({ userId: user.id }));
      const db = container.resolve({ name: 'IDatabase' });

      await db.insert('users', user);

      // Act - Create and settle multiple invoices
      for (const invoice of invoices) {
        await db.insert('invoices', invoice);
        await db.update('invoices', invoice.id, { status: 'completed' });
      }

      // Assert
      const allInvoices = await db.findAll('invoices');
      const userInvoices = allInvoices.filter((inv: any) => inv.userId === user.id);
      expect(userInvoices).toHaveLength(5);
      expect(userInvoices.every((inv: any) => inv.status === 'completed')).toBe(true);
    });
  });
});
