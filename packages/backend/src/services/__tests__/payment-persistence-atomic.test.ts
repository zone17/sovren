import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { JsonFilePaymentStore } from '../payment-persistence';
import type { LightningInvoice, LightningPayment } from '../lightning-service';

const TEST_DIR = path.join('/tmp', 'sovren-persistence-atomic-test');

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

describe('Fix #112: Atomic Writes for Payment Persistence', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('Temp+Rename Atomic Write Pattern', () => {
    it('should write via temp file then rename to target', async () => {
      const store = new JsonFilePaymentStore(TEST_DIR);
      const invoice = createTestInvoice();
      await store.saveInvoice(invoice);

      // Target file should exist with valid JSON
      const filePath = path.join(TEST_DIR, 'invoices.json');
      expect(existsSync(filePath)).toBe(true);

      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].id).toBe(invoice.id);

      // Temp file should NOT exist after successful write (renamed away)
      const tmpPath = `${filePath}.tmp`;
      expect(existsSync(tmpPath)).toBe(false);
    });

    it('should produce valid JSON that survives reload', async () => {
      const store = new JsonFilePaymentStore(TEST_DIR);
      const invoices = [createTestInvoice(), createTestInvoice(), createTestInvoice()];
      for (const inv of invoices) {
        await store.saveInvoice(inv);
      }

      // Reload from disk
      const store2 = new JsonFilePaymentStore(TEST_DIR);
      const all = await store2.getAllInvoices();
      expect(all.length).toBe(3);
      for (const inv of invoices) {
        const found = all.find((i) => i.id === inv.id);
        expect(found).toBeDefined();
        expect(found!.amount).toBe(inv.amount);
      }
    });
  });

  describe('Write Mutex Serialization', () => {
    it('should serialize concurrent writes without data loss', async () => {
      const store = new JsonFilePaymentStore(TEST_DIR);
      const count = 20;
      const invoices = Array.from({ length: count }, () => createTestInvoice());

      // Fire all saves concurrently
      await Promise.all(invoices.map((inv) => store.saveInvoice(inv)));

      // All invoices should be persisted
      const store2 = new JsonFilePaymentStore(TEST_DIR);
      const all = await store2.getAllInvoices();
      expect(all.length).toBe(count);

      const ids = new Set(all.map((i) => i.id));
      for (const inv of invoices) {
        expect(ids.has(inv.id)).toBe(true);
      }
    });

    it('should serialize concurrent payment writes without data loss', async () => {
      const store = new JsonFilePaymentStore(TEST_DIR);
      const count = 10;
      const payments = Array.from({ length: count }, () => createTestPayment());

      await Promise.all(payments.map((p) => store.savePayment(p)));

      const store2 = new JsonFilePaymentStore(TEST_DIR);
      const all = await store2.getAllPayments();
      expect(all.length).toBe(count);
    });
  });

  describe('Corruption Recovery', () => {
    it('should backup corrupted file and recover from .tmp', async () => {
      const store = new JsonFilePaymentStore(TEST_DIR);
      const invoice = createTestInvoice({ id: 'recoverable_invoice' });
      await store.saveInvoice(invoice);

      const filePath = path.join(TEST_DIR, 'invoices.json');
      const tmpPath = `${filePath}.tmp`;

      // Simulate: write valid data to .tmp, corrupt the main file
      writeFileSync(tmpPath, JSON.stringify([invoice], null, 2), 'utf-8');
      writeFileSync(filePath, '{ corrupted json here', 'utf-8');

      // Reload should recover from .tmp
      const store2 = new JsonFilePaymentStore(TEST_DIR);
      const recovered = await store2.getInvoiceById('recoverable_invoice');
      expect(recovered).not.toBeNull();
      expect(recovered!.id).toBe('recoverable_invoice');

      // Corrupted file should be backed up
      const files = require('fs').readdirSync(TEST_DIR) as string[];
      const corruptBackups = files.filter((f: string) => f.startsWith('invoices.json.corrupt.'));
      expect(corruptBackups.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty file as corruption', async () => {
      const filePath = path.join(TEST_DIR, 'invoices.json');
      if (!existsSync(TEST_DIR)) {
        mkdirSync(TEST_DIR, { recursive: true });
      }
      writeFileSync(filePath, '', 'utf-8');

      // Should not throw, should start with empty state
      const store = new JsonFilePaymentStore(TEST_DIR);
      const all = await store.getAllInvoices();
      expect(all.length).toBe(0);
    });

    it('should start fresh when both main and .tmp are unreadable', async () => {
      if (!existsSync(TEST_DIR)) {
        mkdirSync(TEST_DIR, { recursive: true });
      }
      const filePath = path.join(TEST_DIR, 'invoices.json');
      const tmpPath = `${filePath}.tmp`;

      writeFileSync(filePath, '{{{{bad', 'utf-8');
      writeFileSync(tmpPath, '{{{{also bad', 'utf-8');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      const store = new JsonFilePaymentStore(TEST_DIR);
      const all = await store.getAllInvoices();
      expect(all.length).toBe(0);

      // Should have logged a warning about data loss
      const warningCalls = consoleSpy.mock.calls.filter((c) => String(c[0]).includes('WARNING'));
      expect(warningCalls.length).toBeGreaterThanOrEqual(1);
      consoleSpy.mockRestore();
    });
  });

  describe('Error Propagation', () => {
    it('should propagate write errors to the caller', async () => {
      const store = new JsonFilePaymentStore(TEST_DIR);
      const invoice = createTestInvoice();

      // Make the data directory read-only to trigger a write error
      await store.saveInvoice(invoice); // First write succeeds

      // Remove the directory and replace with a file to make writes fail
      rmSync(TEST_DIR, { recursive: true });
      writeFileSync(TEST_DIR, 'not-a-directory');

      const store2 = new JsonFilePaymentStore('/tmp/sovren-persist-err-test');
      // Overwrite the dataDir to point to the invalid path
      (store2 as any).dataDir = TEST_DIR;

      await expect(store2.saveInvoice(createTestInvoice())).rejects.toThrow();

      // Cleanup
      rmSync(TEST_DIR);
      mkdirSync(TEST_DIR, { recursive: true });
    });
  });
});
