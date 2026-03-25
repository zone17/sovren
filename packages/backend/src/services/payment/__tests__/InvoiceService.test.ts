/**
 * InvoiceService Integration Tests
 *
 * Tests the invoice lifecycle (create, retrieve, expiration) through the real
 * PaymentProcessingService which owns Lightning invoice management.
 *
 * NOTE: The DI-wired InvoiceService (InvoiceService.ts) depends on IDatabase,
 * INotificationService, and other infrastructure that is unavailable in the
 * in-memory test harness. Invoice lifecycle tests therefore use the
 * PaymentProcessingService's invoice API, which is the testable surface exposed
 * by PaymentTestHarness and exercises the same business rules.
 *
 * All vi.fn() mocks eliminated. Uses real service instances via PaymentTestHarness.
 * Services wired with in-memory backends — no external dependencies.
 */

import { createPaymentTestHarness, type PaymentTestHarness } from '../../../test-utils';
import { PaymentMethod, PaymentStatus } from '../../../types/payment';

describe('InvoiceService', () => {
  let harness: PaymentTestHarness;

  beforeEach(() => {
    harness = createPaymentTestHarness();
  });

  afterEach(async () => {
    await harness.dispose();
  });

  // Helper: build a standard invoice draft with sensible defaults
  const buildDraft = (overrides?: {
    userId?: string;
    amount?: number;
    method?: PaymentMethod;
    description?: string;
  }) => ({
    userId: overrides?.userId ?? 'test-user',
    amount: overrides?.amount ?? 50,
    currency: 'BTC',
    description: overrides?.description ?? 'Test invoice',
    method: overrides?.method ?? PaymentMethod.LIGHTNING,
  });

  describe('createInvoice', () => {
    it('should create an invoice successfully (happy path)', async () => {
      const draft = buildDraft();

      const invoice = await harness.paymentService.createInvoice(draft);

      expect(invoice).toBeDefined();
      expect(invoice.id).toBeTruthy();
      expect(invoice.userId).toBe(draft.userId);
      expect(invoice.amount).toBe(draft.amount);
      expect(invoice.currency).toBe(draft.currency);
      expect(invoice.description).toBe(draft.description);
      expect(invoice.status).toBe(PaymentStatus.PENDING);
    });

    it('should populate a payment hash and payment request on creation', async () => {
      const invoice = await harness.paymentService.createInvoice(buildDraft());

      expect(invoice.paymentHash).toBeTruthy();
      expect(invoice.paymentRequest).toBeTruthy();
    });

    it('should set an expiry date in the future', async () => {
      const before = new Date();
      const invoice = await harness.paymentService.createInvoice(buildDraft());

      expect(invoice.expiresAt).toBeInstanceOf(Date);
      expect(invoice.expiresAt.getTime()).toBeGreaterThan(before.getTime());
    });

    it('should create independent invoices for different users', async () => {
      const inv1 = await harness.paymentService.createInvoice(buildDraft({ userId: 'user-a', amount: 10 }));
      const inv2 = await harness.paymentService.createInvoice(buildDraft({ userId: 'user-b', amount: 20 }));

      expect(inv1.id).not.toBe(inv2.id);
      expect(inv1.userId).toBe('user-a');
      expect(inv2.userId).toBe('user-b');
      expect(inv1.amount).toBe(10);
      expect(inv2.amount).toBe(20);
    });

    it('should return an existing invoice when the same idempotency key is used', async () => {
      const idempotencyKey = 'inv-idem-key-1';

      const first = await harness.paymentService.createInvoice({
        ...buildDraft(),
        idempotencyKey,
      });

      const second = await harness.paymentService.createInvoice({
        ...buildDraft({ amount: 999 }), // different params — must be ignored
        idempotencyKey,
      });

      expect(second.id).toBe(first.id);
      expect(second.amount).toBe(first.amount);
    });

    it('should respect a custom expiry duration', async () => {
      const customExpirySeconds = 7200; // 2 hours
      const before = Date.now();

      const invoice = await harness.paymentService.createInvoice({
        ...buildDraft(),
        expiresIn: customExpirySeconds,
      });

      const expectedExpiry = before + customExpirySeconds * 1000;
      // Allow 2 seconds of clock drift
      expect(invoice.expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 2000);
      expect(invoice.expiresAt.getTime()).toBeLessThan(expectedExpiry + 2000);
    });
  });

  describe('getInvoice', () => {
    it('should retrieve an existing invoice by its ID', async () => {
      const created = await harness.paymentService.createInvoice(buildDraft());

      const fetched = await harness.paymentService.getInvoice(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.userId).toBe(created.userId);
      expect(fetched!.amount).toBe(created.amount);
    });

    it('should return null for a non-existent invoice ID', async () => {
      const result = await harness.paymentService.getInvoice('nonexistent-invoice-id');

      expect(result).toBeNull();
    });

    it('should return a cached copy that matches the original', async () => {
      const created = await harness.paymentService.createInvoice(buildDraft());

      // First retrieval populates the cache
      const first = await harness.paymentService.getInvoice(created.id);
      // Second retrieval should serve from cache
      const second = await harness.paymentService.getInvoice(created.id);

      expect(first!.id).toBe(second!.id);
      expect(first!.amount).toBe(second!.amount);
      expect(first!.status).toBe(second!.status);
    });

    it('should return an updated status after the invoice is paid', async () => {
      const invoice = await harness.paymentService.createInvoice(buildDraft());

      await harness.paymentService.processPayment({
        invoiceId: invoice.id,
        paymentRequest: invoice.paymentRequest,
        method: PaymentMethod.LIGHTNING,
      });

      const paid = await harness.paymentService.getInvoice(invoice.id);
      expect(paid!.status).toBe(PaymentStatus.COMPLETED);
    });
  });

  describe('invoice expiration handling', () => {
    it('should report PENDING status before the invoice expires', async () => {
      const invoice = await harness.paymentService.createInvoice(buildDraft());

      const status = await harness.paymentService.checkPaymentStatus(invoice.id);
      expect(status).toBe(PaymentStatus.PENDING);
    });

    it('should prevent payment processing on an expired invoice', async () => {
      // Create an invoice with the minimum possible expiry
      const invoice = await harness.paymentService.createInvoice({
        ...buildDraft(),
        expiresIn: 1, // 1 second
      });

      // Seed a raw transaction with an already-expired invoice so that the
      // processing guard (new Date() > invoice.expiresAt) triggers immediately.
      // We manipulate the invoice via the underlying repository to set expiresAt
      // to a date in the past.
      const repo = (harness.paymentService as any).repository;
      const stored = await repo.getInvoice(invoice.id);
      stored.expiresAt = new Date(Date.now() - 10_000); // 10 seconds in the past
      await repo.updateInvoice(stored);

      await expect(
        harness.paymentService.processPayment({
          invoiceId: invoice.id,
          paymentRequest: invoice.paymentRequest,
          method: PaymentMethod.LIGHTNING,
        })
      ).rejects.toThrow();
    });

    it('should transition invoice status to EXPIRED when expiration is processed', async () => {
      const invoice = await harness.paymentService.createInvoice(buildDraft());

      // Fast-forward the invoice to the past
      const repo = (harness.paymentService as any).repository;
      const stored = await repo.getInvoice(invoice.id);
      stored.expiresAt = new Date(Date.now() - 10_000);
      await repo.updateInvoice(stored);

      // Attempting to pay triggers the expiry path which updates status to EXPIRED
      await harness.paymentService.processPayment({
        invoiceId: invoice.id,
        paymentRequest: invoice.paymentRequest,
        method: PaymentMethod.LIGHTNING,
      }).catch(() => {
        // Expected — expiry throws; side effect is the status update
      });

      const expired = await harness.paymentService.getInvoice(invoice.id);
      expect(expired!.status).toBe(PaymentStatus.EXPIRED);
    });

    it('should list user invoices filtering by status', async () => {
      const userId = 'expiry-filter-user';

      const inv1 = await harness.paymentService.createInvoice(buildDraft({ userId, amount: 10 }));
      const inv2 = await harness.paymentService.createInvoice(buildDraft({ userId, amount: 20 }));

      // Pay the first invoice
      await harness.paymentService.processPayment({
        invoiceId: inv1.id,
        paymentRequest: inv1.paymentRequest,
        method: PaymentMethod.LIGHTNING,
      });

      const allInvoices = await harness.paymentService.listUserInvoices(userId);
      expect(allInvoices.length).toBe(2);

      const pendingInvoices = await harness.paymentService.listUserInvoices(
        userId,
        PaymentStatus.PENDING
      );
      expect(pendingInvoices.length).toBe(1);
      expect(pendingInvoices[0].id).toBe(inv2.id);

      const completedInvoices = await harness.paymentService.listUserInvoices(
        userId,
        PaymentStatus.COMPLETED
      );
      expect(completedInvoices.length).toBe(1);
      expect(completedInvoices[0].id).toBe(inv1.id);
    });
  });
});
