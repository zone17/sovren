import { LightningConfig, LightningService } from '../lightning-service';

// Mock fetch for LNbits API calls
global.fetch = jest.fn();

describe('LightningService', () => {
  let lightningService: LightningService;
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

  beforeEach(() => {
    lightningService = LightningService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      // Mock successful wallet response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });

      await expect(lightningService.initialize(mockConfig)).resolves.not.toThrow();
    });

    it('should throw error with invalid configuration', async () => {
      const invalidConfig = {
        ...mockConfig,
        lnbitsUrl: 'invalid-url',
      };

      await expect(lightningService.initialize(invalidConfig as any)).rejects.toThrow();
    });

    it('should throw error when LNbits connection fails', async () => {
      // Mock failed connection
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      await expect(lightningService.initialize(mockConfig)).rejects.toThrow('Lightning service initialization failed');
    });
  });

  describe('Invoice Creation', () => {
    beforeEach(async () => {
      // Initialize service for tests
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });
      await lightningService.initialize(mockConfig);
    });

    it('should create invoice successfully', async () => {
      const mockLnbitsResponse = {
        payment_request: 'lnbc1000n1...',
        payment_hash: 'abc123',
        checking_id: 'check123',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLnbitsResponse,
      });

      const result = await lightningService.createInvoice({
        amount: 1000,
        description: 'Test payment',
        creatorId: 'creator-123',
        supporterId: 'supporter-456',
      });

      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
      expect(result.invoice!.amount).toBe(1000);
      expect(result.invoice!.bolt11).toBe(mockLnbitsResponse.payment_request);
    });

    it('should validate amount limits', async () => {
      const result = await lightningService.createInvoice({
        amount: 2000000, // Exceeds max
        description: 'Test payment',
        creatorId: 'creator-123',
        supporterId: 'supporter-456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Amount must be between');
    });

    it('should handle LNbits API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const result = await lightningService.createInvoice({
        amount: 1000,
        description: 'Test payment',
        creatorId: 'creator-123',
        supporterId: 'supporter-456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Invoice Status Checking', () => {
    beforeEach(async () => {
      // Initialize service
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });
      await lightningService.initialize(mockConfig);

      // Create test invoice
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payment_request: 'lnbc1000n1...',
          payment_hash: 'abc123',
          checking_id: 'check123',
        }),
      });
    });

    it('should check unpaid invoice status', async () => {
      // Create invoice first
      const invoiceResult = await lightningService.createInvoice({
        amount: 1000,
        description: 'Test payment',
        creatorId: 'creator-123',
        supporterId: 'supporter-456',
      });

      // Mock unpaid status check
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paid: false }),
      });

      const statusResult = await lightningService.checkInvoiceStatus(invoiceResult.invoice!.id);

      expect(statusResult.success).toBe(true);
      expect(statusResult.invoice!.status).toBe('pending');
      expect(statusResult.payment).toBeUndefined();
    });

    it('should detect paid invoice and create payment record', async () => {
      // Create invoice first
      const invoiceResult = await lightningService.createInvoice({
        amount: 1000,
        description: 'Test payment',
        creatorId: 'creator-123',
        supporterId: 'supporter-456',
      });

      // Mock paid status check
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          paid: true,
          fee: 1,
          preimage: 'preimage123',
        }),
      });

      const statusResult = await lightningService.checkInvoiceStatus(invoiceResult.invoice!.id);

      expect(statusResult.success).toBe(true);
      expect(statusResult.invoice!.status).toBe('paid');
      expect(statusResult.payment).toBeDefined();
      expect(statusResult.payment!.amount).toBe(1000);
      expect(statusResult.payment!.fee).toBe(1);
    });

    it('should return error for non-existent invoice', async () => {
      const result = await lightningService.checkInvoiceStatus('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });
  });

  describe('LNURL-pay Generation', () => {
    beforeEach(async () => {
      // Initialize service
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });
      await lightningService.initialize(mockConfig);
    });

    it('should generate LNURL-pay successfully', async () => {
      const result = await lightningService.generateLnurlPay({
        creatorId: 'creator-123',
      });

      expect(result.success).toBe(true);
      expect(result.lnurl).toBeDefined();
      expect(result.qrCode).toBeDefined();
    });

    it('should respect service configuration', async () => {
      // Disable LNURL-pay
      const disabledConfig = { ...mockConfig, enableLnurlPay: false };

      // Mock fetch for the new initialization
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });

      await lightningService.initialize(disabledConfig);

      const result = await lightningService.generateLnurlPay({
        creatorId: 'creator-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('LNURL-pay is disabled');
    });
  });

  describe('Lightning Address Creation', () => {
    beforeEach(async () => {
      // Initialize service
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });
      await lightningService.initialize(mockConfig);
    });

    it('should create Lightning address successfully', async () => {
      const result = await lightningService.createLightningAddress({
        creatorId: 'creator-123',
        identifier: 'testcreator',
        domain: 'sovren.com',
      });

      expect(result.success).toBe(true);
      expect(result.lightningAddress).toBeDefined();
      expect(result.lightningAddress!.identifier).toBe('testcreator@sovren.com');
      expect(result.lightningAddress!.active).toBe(true);
    });

    it('should validate Lightning address format', async () => {
      const result = await lightningService.createLightningAddress({
        creatorId: 'creator-123',
        identifier: 'invalid@address',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect service configuration', async () => {
      // Disable Lightning addresses
      const disabledConfig = { ...mockConfig, enableLightningAddress: false };

      // Mock fetch for the new initialization
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });

      await lightningService.initialize(disabledConfig);

      const result = await lightningService.createLightningAddress({
        creatorId: 'creator-123',
        identifier: 'testcreator',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Lightning addresses are disabled');
    });
  });

  describe('Webhook Processing', () => {
    beforeEach(async () => {
      // Initialize service
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });
      await lightningService.initialize(mockConfig);
    });

    it('should process payment webhook successfully', async () => {
      // Create invoice first
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payment_request: 'lnbc1000n1...',
          payment_hash: 'abc123',
          checking_id: 'check123',
        }),
      });

      const invoiceResult = await lightningService.createInvoice({
        amount: 1000,
        description: 'Test payment',
        creatorId: 'creator-123',
        supporterId: 'supporter-456',
      });

      // Process webhook for payment
      const webhookPayload = {
        type: 'payment',
        payment_hash: 'abc123',
        amount: 1000,
        fee: 1,
        preimage: 'preimage123',
      };

      const result = await lightningService.processWebhook(webhookPayload);

      expect(result.success).toBe(true);
      expect(result.payment).toBeDefined();
      expect(result.payment!.amount).toBe(1000);
      expect(result.payment!.status).toBe('completed');
    });

    it('should validate webhook signature', async () => {
      const webhookPayload = { type: 'test' };
      const invalidSignature = 'invalid-signature';

      const result = await lightningService.processWebhook(webhookPayload, invalidSignature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });

    it('should handle non-payment webhooks gracefully', async () => {
      const webhookPayload = { type: 'other' };

      const result = await lightningService.processWebhook(webhookPayload);

      expect(result.success).toBe(true);
      expect(result.payment).toBeUndefined();
    });
  });

  describe('Payment History', () => {
    beforeEach(async () => {
      // Initialize service
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });
      await lightningService.initialize(mockConfig);

      // Clear any existing payment cache to prevent test contamination
      lightningService['paymentCache'].clear();
      lightningService['invoiceCache'].clear();
    });

    it('should retrieve creator payment history', async () => {
      // Create and process a payment first
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payment_request: 'lnbc1000n1...',
          payment_hash: 'abc123',
          checking_id: 'check123',
        }),
      });

      const invoiceResult = await lightningService.createInvoice({
        amount: 1000,
        description: 'Test payment',
        creatorId: 'creator-123',
        supporterId: 'supporter-456',
      });

      // Process payment webhook
      await lightningService.processWebhook({
        type: 'payment',
        payment_hash: 'abc123',
        amount: 1000,
      });

      const historyResult = await lightningService.getCreatorPayments('creator-123');

      expect(historyResult.success).toBe(true);
      expect(historyResult.payments).toBeDefined();
      expect(historyResult.payments!.length).toBe(1);
      expect(historyResult.total).toBe(1);
    });

    it('should apply pagination correctly', async () => {
      const result = await lightningService.getCreatorPayments('creator-123', {
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.payments)).toBe(true);
    });

    it('should filter by payment status', async () => {
      const result = await lightningService.getCreatorPayments('creator-123', {
        status: 'completed',
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.payments)).toBe(true);
    });
  });

  describe('Service Statistics', () => {
    beforeEach(async () => {
      // Initialize service
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });
      await lightningService.initialize(mockConfig);
    });

    it('should return service statistics', async () => {
      const result = await lightningService.getStats();

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(typeof result.stats!.totalInvoices).toBe('number');
      expect(typeof result.stats!.totalPayments).toBe('number');
      expect(typeof result.stats!.totalAmount).toBe('number');
      expect(typeof result.stats!.averageAmount).toBe('number');
      expect(typeof result.stats!.successRate).toBe('number');
      expect(typeof result.stats!.activeInvoices).toBe('number');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock successful LNbits connection
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ name: 'Test Wallet' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ name: 'Test Wallet' }),
        });

      await lightningService.initialize(mockConfig);
      const result = await lightningService.healthCheck();

      expect(result.success).toBe(true);
      expect(result.status).toBe('healthy');
      expect(result.checks.lnbits).toBe(true);
      expect(result.checks.wallet).toBe(true);
      expect(result.checks.invoices).toBe(true);
    });

    it('should return unhealthy status when checks fail', async () => {
      // Mock LNbits connection failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const result = await lightningService.healthCheck();

      expect(result.success).toBe(true);
      expect(result.status).toBe('degraded'); // Some checks pass (invoices=true), some fail (lnbits=false)
      expect(result.checks.lnbits).toBe(false);
      expect(result.checks.wallet).toBe(false);
      expect(result.checks.invoices).toBe(true); // This passes because service is initialized
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Initialize service
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Wallet' }),
      });
      await lightningService.initialize(mockConfig);
    });

    it('should handle network timeouts gracefully', async () => {
      // Mock timeout
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await lightningService.createInvoice({
        amount: 1000,
        description: 'Test payment',
        creatorId: 'creator-123',
        supporterId: 'supporter-456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should require initialization for operations', async () => {
      // Create new service instance that's not initialized
      const uninitializedService = LightningService.getInstance();

      // Reset the service to uninitialized state
      uninitializedService['isInitialized'] = false;

      const result = await uninitializedService.createInvoice({
        amount: 1000,
        description: 'Test',
        creatorId: 'creator-123',
        supporterId: 'supporter-456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Lightning service not initialized');
    });
  });
});
