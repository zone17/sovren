import { existsSync, rmSync } from 'fs';
import path from 'path';
import { JsonFilePaymentStore } from '../payment-persistence';
import type { LightningInvoice, LightningPayment } from '../lightning-service';

const TEST_DIR = path.join('/tmp', 'sovren-payment-persistence-test');

function createTestInvoice(overrides?: Partial<LightningInvoice>): LightningInvoice {
  return {
    id: `inv_${Math.random().toString(36).slice(2)}`,
    bolt11: 'lnbc1000n1test',
    amount: 1000,
    description: 'Test invoice',
    created_at: Date.now(),
    expires_at: Date.now() + 3600000,
    status: 'pending',
    payment_hash: `hash_${Math.random().toString(36).slice(2)}`,
    payment_request: 'lnbc1000n1test',
    metadata: { creatorId: 'creator1', supporterId: 'supporter1' },
    ...overrides,
  };
}

function createTestPayment(overrides?: Partial<LightningPayment>): LightningPayment {
  return {
    id: `pay_${Math.random().toString(36).slice(2)}`,
    invoice_id: 'inv_test',
    amount: 1000,
    fee: 1,
    status: 'completed',
    settled_at: Date.now(),
    memo: 'Test payment',
    creator_id: 'creator1',
    supporter_id: 'supporter1',
    ...overrides,
  };
}

describe('JsonFilePaymentStore', () => {
  let store: JsonFilePaymentStore;

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    store = new JsonFilePaymentStore(TEST_DIR);
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('should create data directory on initialization', () => {
    expect(existsSync(TEST_DIR)).toBe(true);
  });

  describe('Invoice persistence', () => {
    it('should save and retrieve an invoice by ID', async () => {
      const invoice = createTestInvoice();
      await store.saveInvoice(invoice);

      const retrieved = await store.getInvoiceById(invoice.id);
      expect(retrieved).toEqual(invoice);
    });

    it('should retrieve an invoice by payment hash', async () => {
      const invoice = createTestInvoice({ payment_hash: 'unique_hash_123' });
      await store.saveInvoice(invoice);

      const retrieved = await store.getInvoiceByPaymentHash('unique_hash_123');
      expect(retrieved).toEqual(invoice);
    });

    it('should return null for non-existent invoice', async () => {
      const result = await store.getInvoiceById('non_existent');
      expect(result).toBeNull();
    });

    it('should update invoice status', async () => {
      const invoice = createTestInvoice();
      await store.saveInvoice(invoice);

      await store.updateInvoiceStatus(invoice.id, 'paid');

      const updated = await store.getInvoiceById(invoice.id);
      expect(updated?.status).toBe('paid');
    });

    it('should return all invoices', async () => {
      await store.saveInvoice(createTestInvoice());
      await store.saveInvoice(createTestInvoice());

      const all = await store.getAllInvoices();
      expect(all).toHaveLength(2);
    });
  });

  describe('Payment persistence', () => {
    it('should save and retrieve payments by creator', async () => {
      const payment = createTestPayment({ creator_id: 'creator_abc' });
      await store.savePayment(payment);

      const payments = await store.getPaymentsByCreator('creator_abc');
      expect(payments).toHaveLength(1);
      expect(payments[0]).toEqual(payment);
    });

    it('should return empty array for unknown creator', async () => {
      const payments = await store.getPaymentsByCreator('unknown');
      expect(payments).toHaveLength(0);
    });

    it('should return all payments', async () => {
      await store.savePayment(createTestPayment());
      await store.savePayment(createTestPayment());

      const all = await store.getAllPayments();
      expect(all).toHaveLength(2);
    });
  });

  describe('Disk persistence', () => {
    it('should survive reload from disk', async () => {
      const invoice = createTestInvoice();
      const payment = createTestPayment();

      await store.saveInvoice(invoice);
      await store.savePayment(payment);

      // Create a new store instance from the same directory (simulates restart)
      const newStore = new JsonFilePaymentStore(TEST_DIR);

      const reloadedInvoice = await newStore.getInvoiceById(invoice.id);
      expect(reloadedInvoice).toEqual(invoice);

      const allPayments = await newStore.getAllPayments();
      expect(allPayments).toHaveLength(1);
      expect(allPayments[0]).toEqual(payment);
    });

    it('should handle corrupted files gracefully', async () => {
      // Write corrupted data
      const { writeFileSync } = require('fs');
      writeFileSync(path.join(TEST_DIR, 'invoices.json'), 'not-valid-json', 'utf-8');

      // Should not throw, just log error and start with empty maps
      expect(() => new JsonFilePaymentStore(TEST_DIR)).not.toThrow();
    });
  });
});
