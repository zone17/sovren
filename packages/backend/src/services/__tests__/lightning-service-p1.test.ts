import { existsSync, rmSync } from 'fs';
import path from 'path';
import { LightningConfig, LightningService } from '../lightning-service';

// Mock fetch for LNbits API calls
global.fetch = jest.fn();

const TEST_DATA_DIR = path.join('/tmp', 'sovren-lightning-p1-test');

const mockConfig: LightningConfig = {
  lnbitsUrl: 'https://test.lnbits.com',
  lnbitsApiKey: 'test-api-key',
  lnbitsWalletId: 'test-wallet-id',
  webhookSecret: 'test-webhook-secret-minimum-32-characters',
  defaultMemo: 'Test Payment',
  invoiceExpiryMinutes: 60,
  maxInvoiceAmount: 1000000,
  minInvoiceAmount: 1,
  enableWebhooks: true,
  enableLnurlPay: true,
  enableLightningAddress: true,
  retryAttempts: 3,
  requestTimeout: 30000,
};

function mockWalletResponse() {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ name: 'Test Wallet' }),
  });
}

function mockInvoiceCreation(paymentHash: string) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      payment_request: 'lnbc1000n1...',
      payment_hash: paymentHash,
      checking_id: 'check_' + paymentHash,
    }),
  });
}

describe('Lightning Service P1 Fixes', () => {
  let service: LightningService;

  beforeEach(async () => {
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
    // Also clean the default data directory used by JsonFilePaymentStore
    const defaultDir = path.join(process.cwd(), 'data', 'payments');
    if (existsSync(defaultDir)) {
      rmSync(defaultDir, { recursive: true });
    }

    service = LightningService.getInstance();

    // Reset internal state
    service['isInitialized'] = false;
    service['invoiceCache'].clear();
    service['paymentCache'].clear();
    service['paymentHashIndex'].clear();

    jest.clearAllMocks();
  });

  afterAll(() => {
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
    const defaultDir = path.join(process.cwd(), 'data', 'payments');
    if (existsSync(defaultDir)) {
      rmSync(defaultDir, { recursive: true });
    }
  });

  describe('Fix #113: Cache Fallback to Persistence', () => {
    it('should find invoice in persistence after cache eviction', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      // Create invoice (cached and persisted)
      mockInvoiceCreation('hash_113_a');
      const result = await service.createInvoice({
        amount: 1000,
        description: 'Test',
        creatorId: 'c1',
        supporterId: 's1',
      });
      expect(result.success).toBe(true);
      const invoiceId = result.invoice!.id;

      // Manually evict from cache (simulates TTL expiry)
      service['invoiceCache'].delete(invoiceId);
      service['paymentHashIndex'].delete('hash_113_a');

      // checkInvoiceStatus should fall through to persistence
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paid: false }),
      });

      const statusResult = await service.checkInvoiceStatus(invoiceId);
      expect(statusResult.success).toBe(true);
      expect(statusResult.invoice).toBeDefined();
      expect(statusResult.invoice!.id).toBe(invoiceId);
    });

    it('should re-cache invoice after persistence fallback', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      mockInvoiceCreation('hash_113_b');
      const result = await service.createInvoice({
        amount: 500,
        description: 'Test re-cache',
        creatorId: 'c1',
        supporterId: 's1',
      });
      const invoiceId = result.invoice!.id;

      // Evict from cache
      service['invoiceCache'].delete(invoiceId);

      // First lookup: persistence fallback
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paid: false }),
      });
      await service.checkInvoiceStatus(invoiceId);

      // Invoice should now be re-cached
      const cached = service['invoiceCache'].get(invoiceId);
      expect(cached).toBeDefined();
      expect(cached!.id).toBe(invoiceId);
    });

    it('should return not found when invoice is in neither cache nor persistence', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      const result = await service.checkInvoiceStatus('non_existent_id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });

    it('should fall through to persistence in processWebhook on cache miss', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      // Create invoice
      mockInvoiceCreation('hash_113_webhook');
      const createResult = await service.createInvoice({
        amount: 2000,
        description: 'Webhook test',
        creatorId: 'c1',
        supporterId: 's1',
      });
      const invoiceId = createResult.invoice!.id;

      // Evict from cache and index
      service['invoiceCache'].delete(invoiceId);
      service['paymentHashIndex'].delete('hash_113_webhook');

      // Webhook should still find it via persistence
      const webhookResult = await service.processWebhook({
        type: 'payment',
        payment_hash: 'hash_113_webhook',
        fee: 1,
        preimage: 'pre_113',
      });

      expect(webhookResult.success).toBe(true);
      expect(webhookResult.payment).toBeDefined();
      expect(webhookResult.payment!.status).toBe('completed');
    });
  });

  describe('Fix #115: Persist-Then-Mutate Order', () => {
    it('should persist before mutating in-memory status in checkInvoiceStatus', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      mockInvoiceCreation('hash_115_check');
      const result = await service.createInvoice({
        amount: 1000,
        description: 'Persist order test',
        creatorId: 'c1',
        supporterId: 's1',
      });
      const invoiceId = result.invoice!.id;

      // Make persistence savePayment throw to simulate failure
      const persistence = service['persistence'];
      jest.spyOn(persistence, 'savePayment').mockRejectedValueOnce(new Error('Disk full'));

      // Mock LNbits says paid
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paid: true, fee: 1, preimage: 'pre123' }),
      });

      const statusResult = await service.checkInvoiceStatus(invoiceId);

      // Should fail because persistence failed
      expect(statusResult.success).toBe(false);

      // In-memory invoice should still be 'pending' (not mutated)
      const cachedInvoice = service['invoiceCache'].get(invoiceId);
      expect(cachedInvoice!.status).toBe('pending');
    });

    it('should persist before mutating in-memory status in processWebhook', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      mockInvoiceCreation('hash_115_webhook');
      const result = await service.createInvoice({
        amount: 1000,
        description: 'Webhook persist test',
        creatorId: 'c1',
        supporterId: 's1',
      });

      // Make persistence fail
      jest
        .spyOn(service['persistence'], 'savePayment')
        .mockRejectedValueOnce(new Error('Write error'));

      const webhookResult = await service.processWebhook({
        type: 'payment',
        payment_hash: 'hash_115_webhook',
        fee: 0,
        preimage: 'pre_wh',
      });

      // Webhook should return error
      expect(webhookResult.success).toBe(false);

      // Invoice should still be pending in cache
      const cached = service['invoiceCache'].get(result.invoice!.id);
      expect(cached!.status).toBe('pending');
    });

    it('should persist expired status to disk before mutating in-memory', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      // Create an already-expired invoice by manipulating expires_at
      mockInvoiceCreation('hash_115_expired');
      const result = await service.createInvoice({
        amount: 1000,
        description: 'Expired test',
        creatorId: 'c1',
        supporterId: 's1',
        expiryMinutes: -1, // Already expired
      });

      const invoiceId = result.invoice!.id;
      // Force the invoice to be expired
      const invoice = service['invoiceCache'].get(invoiceId)!;
      invoice.expires_at = Date.now() - 1000;
      service['invoiceCache'].set(invoiceId, invoice);

      // Spy on updateInvoiceStatus to verify it's called
      const updateSpy = jest.spyOn(service['persistence'], 'updateInvoiceStatus');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paid: false }),
      });

      await service.checkInvoiceStatus(invoiceId);

      // updateInvoiceStatus should have been called with 'expired'
      expect(updateSpy).toHaveBeenCalledWith(invoiceId, 'expired');
    });
  });

  describe('Fix #118: O(1) Webhook Lookup via paymentHashIndex', () => {
    it('should build paymentHashIndex on invoice creation', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      mockInvoiceCreation('hash_118_create');
      await service.createInvoice({
        amount: 1000,
        description: 'Index test',
        creatorId: 'c1',
        supporterId: 's1',
      });

      const indexedId = service['paymentHashIndex'].get('hash_118_create');
      expect(indexedId).toBeDefined();
    });

    it('should use paymentHashIndex for O(1) lookup in processWebhook', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      // Create several invoices
      for (let i = 0; i < 5; i++) {
        mockInvoiceCreation(`hash_118_${i}`);
        await service.createInvoice({
          amount: 1000 + i,
          description: `Invoice ${i}`,
          creatorId: 'c1',
          supporterId: 's1',
        });
      }

      // Spy on invoiceCache.values to ensure it's NOT called (no linear scan)
      const valuesSpy = jest.spyOn(service['invoiceCache'], 'values');

      const webhookResult = await service.processWebhook({
        type: 'payment',
        payment_hash: 'hash_118_3',
        fee: 0,
        preimage: 'pre_idx',
      });

      expect(webhookResult.success).toBe(true);
      expect(webhookResult.payment).toBeDefined();
      // The values() method should NOT be called for lookup
      expect(valuesSpy).not.toHaveBeenCalled();
    });

    it('should clean up paymentHashIndex on cache eviction via onEvict', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      mockInvoiceCreation('hash_118_evict');
      const result = await service.createInvoice({
        amount: 1000,
        description: 'Evict test',
        creatorId: 'c1',
        supporterId: 's1',
      });
      const invoiceId = result.invoice!.id;

      // Verify index entry exists
      expect(service['paymentHashIndex'].has('hash_118_evict')).toBe(true);

      // Delete from cache (triggers onEvict)
      service['invoiceCache'].delete(invoiceId);

      // Index entry should be cleaned up
      expect(service['paymentHashIndex'].has('hash_118_evict')).toBe(false);
    });

    it('should rebuild paymentHashIndex from persistence on initialization', async () => {
      // First run: create invoices
      mockWalletResponse();
      await service.initialize(mockConfig);

      mockInvoiceCreation('hash_118_hydrate');
      await service.createInvoice({
        amount: 1000,
        description: 'Hydration test',
        creatorId: 'c1',
        supporterId: 's1',
      });

      // Simulate restart: clear in-memory state, re-initialize
      service['invoiceCache'].clear();
      service['paymentHashIndex'].clear();
      service['isInitialized'] = false;

      mockWalletResponse();
      await service.initialize(mockConfig);

      // paymentHashIndex should be rebuilt from persisted invoices
      const indexedId = service['paymentHashIndex'].get('hash_118_hydrate');
      expect(indexedId).toBeDefined();
    });

    it('should fall through to persistence when paymentHashIndex has no entry', async () => {
      mockWalletResponse();
      await service.initialize(mockConfig);

      mockInvoiceCreation('hash_118_fallback');
      await service.createInvoice({
        amount: 1000,
        description: 'Fallback test',
        creatorId: 'c1',
        supporterId: 's1',
      });

      // Remove from both index and cache
      service['paymentHashIndex'].delete('hash_118_fallback');
      // Keep it in invoiceCache for the re-cache path, but remove from cache too
      await service['persistence'].getAllInvoices();
      service['invoiceCache'].clear();

      // Should fall through to persistence
      const webhookResult = await service.processWebhook({
        type: 'payment',
        payment_hash: 'hash_118_fallback',
        fee: 0,
        preimage: 'pre_fb',
      });

      expect(webhookResult.success).toBe(true);
      expect(webhookResult.payment).toBeDefined();
    });
  });
});
