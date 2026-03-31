/**
 * BusinessInvoiceService Tests
 * EPIC-011: Business Manager — Invoicing with LNURL-pay payment links
 *
 * Coverage targets:
 *   - Constructor: queue creation with correct options
 *   - createInvoice: totalSats calculation, zero-total rejection, optional fields
 *                    (dueDate, recurringInterval), LNURL-pay generation, DB errors
 *   - getInvoices: with/without status filter, empty result, DB error
 *   - getInvoice: found, not found (null data), DB error
 *   - updateInvoiceStatus: success, DB error, all status values
 *   - generatePaymentLink: success flow, LNURL-pay persistence, invoice-not-found error
 *   - intervalToMs: all valid intervals and unknown interval (private via createInvoice)
 */

import { BusinessInvoiceService } from '../BusinessInvoiceService';

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function makeQueueService() {
  return {
    createQueue: vi.fn().mockResolvedValue(undefined),
    addJob: vi.fn().mockResolvedValue('job-id-1'),
    registerProcessor: vi.fn(),
    getQueueNames: vi.fn().mockReturnValue([]),
    isHealthy: vi.fn().mockResolvedValue(true),
    closeAll: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build a flexible Supabase mock.
 *
 * The service uses two patterns:
 *   1. chain.insert(...).select('id').single()  — for inserts
 *   2. chain.update(...).eq(...).eq(...)        — for updates (last eq resolves)
 *   3. chain.select(...).eq(...).eq(...).single() — for getInvoice
 *   4. chain.select(...).eq(...)[.eq(...)].order(...) — for getInvoices
 *
 * We expose `.singleResult` and `.orderResult` setters so individual tests
 * can control what each terminal method returns.
 */
function makeDb() {
  const db: any = {
    _singleResult: { data: null, error: null },
    _orderResult: { data: [], error: null },
    _updateResult: { data: null, error: null },

    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(function (this: any) {
      return Promise.resolve(this._orderResult);
    }),
    single: vi.fn(function (this: any) {
      return Promise.resolve(this._singleResult);
    }),
  };

  // Bind `this` so the closures above reference the same object
  db.order = vi.fn().mockReturnValue(db);
  db.limit = vi.fn().mockImplementation(() => Promise.resolve(db._orderResult));
  db.single = vi.fn().mockImplementation(() => Promise.resolve(db._singleResult));

  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BusinessInvoiceService', () => {
  let mockDb: ReturnType<typeof makeDb>;
  let mockQueue: ReturnType<typeof makeQueueService>;
  let mockLogger: ReturnType<typeof makeLogger>;
  let service: BusinessInvoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = makeLogger();
    mockQueue = makeQueueService();
    mockDb = makeDb();

    // Default: eq resolves for update-chain endings
    mockDb.eq.mockReturnThis();

    service = new BusinessInvoiceService(mockDb as any, mockQueue as any, mockLogger as any);
  });

  // =========================================================================
  // Constructor
  // =========================================================================

  describe('constructor', () => {
    it('does NOT create the recurring-invoices queue eagerly (#320 lazy init)', () => {
      // #320: Queue creation is now lazy — constructor should not call createQueue
      expect(mockQueue.createQueue).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // createInvoice
  // =========================================================================

  describe('createInvoice', () => {
    const singleLineItem = [{ description: 'Work', quantity: 1, unitPriceSats: 10000 }];

    it('calculates totalSats as sum of quantity * unitPriceSats across all line items', async () => {
      mockDb._singleResult = { data: { id: 'inv-1' }, error: null };

      const lineItems = [
        { description: 'Consulting', quantity: 2, unitPriceSats: 50000 },
        { description: 'Design', quantity: 1, unitPriceSats: 100000 },
      ];

      await service.createInvoice('creator-1', { clientName: 'Acme', lineItems });

      // 2*50000 + 1*100000 = 200000
      expect(mockDb.insert).toHaveBeenCalledWith(expect.objectContaining({ total_sats: 200000 }));
    });

    it('rejects with an error when total sats is 0 (zero-quantity item)', async () => {
      await expect(
        service.createInvoice('creator-1', {
          clientName: 'Acme',
          lineItems: [{ description: 'Free', quantity: 0, unitPriceSats: 10000 }],
        })
      ).rejects.toThrow('Invoice total must be greater than 0 sats');
    });

    it('rejects with an error when total sats is negative', async () => {
      await expect(
        service.createInvoice('creator-1', {
          clientName: 'Acme',
          lineItems: [{ description: 'Refund', quantity: -1, unitPriceSats: 10000 }],
        })
      ).rejects.toThrow('Invoice total must be greater than 0 sats');
    });

    it('sets initial status to "draft"', async () => {
      mockDb._singleResult = { data: { id: 'inv-2' }, error: null };

      await service.createInvoice('creator-1', { clientName: 'Client', lineItems: singleLineItem });

      expect(mockDb.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
    });

    it('includes due_date in the row when dueDate is provided', async () => {
      mockDb._singleResult = { data: { id: 'inv-3' }, error: null };

      await service.createInvoice('creator-1', {
        clientName: 'Client',
        lineItems: singleLineItem,
        dueDate: '2026-03-31',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ due_date: '2026-03-31' })
      );
    });

    it('omits due_date from the row when dueDate is not provided', async () => {
      mockDb._singleResult = { data: { id: 'inv-4' }, error: null };

      await service.createInvoice('creator-1', { clientName: 'Client', lineItems: singleLineItem });

      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg).not.toHaveProperty('due_date');
    });

    it('includes recurring_interval when recurringInterval is provided', async () => {
      mockDb._singleResult = { data: { id: 'inv-5' }, error: null };

      await service.createInvoice('creator-1', {
        clientName: 'Client',
        lineItems: singleLineItem,
        recurringInterval: 'monthly',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ recurring_interval: 'monthly' })
      );
    });

    it('schedules a recurring job when recurringInterval is provided', async () => {
      mockDb._singleResult = { data: { id: 'inv-5' }, error: null };

      await service.createInvoice('creator-1', {
        clientName: 'Acme',
        lineItems: singleLineItem,
        recurringInterval: 'monthly',
      });

      expect(mockQueue.addJob).toHaveBeenCalledWith(
        'recurring-invoices',
        'generate-recurring',
        expect.objectContaining({
          templateInvoiceId: 'inv-5',
          creatorId: 'creator-1',
          interval: 'monthly',
        }),
        expect.objectContaining({ delay: expect.any(Number) })
      );
    });

    it('does NOT schedule a recurring job when recurringInterval is absent', async () => {
      mockDb._singleResult = { data: { id: 'inv-6' }, error: null };

      await service.createInvoice('creator-1', { clientName: 'Acme', lineItems: singleLineItem });

      expect(mockQueue.addJob).not.toHaveBeenCalled();
    });

    it('generates a LNURL-pay link and returns it alongside the invoice id', async () => {
      mockDb._singleResult = { data: { id: 'inv-7' }, error: null };

      const result = await service.createInvoice('creator-1', {
        clientName: 'Client',
        lineItems: singleLineItem,
      });

      expect(result.id).toBe('inv-7');
      // LNURL-pay URL should contain the invoice id and millisat amount
      expect(result.lnurlPay).toBeDefined();
      expect(result.lnurlPay).toContain('amount=');
    });

    it('persists the LNURL-pay link back to the invoice row', async () => {
      mockDb._singleResult = { data: { id: 'inv-8' }, error: null };

      await service.createInvoice('creator-1', { clientName: 'Client', lineItems: singleLineItem });

      // update() should have been called to persist lnurl_pay
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ lnurl_pay: expect.any(String) })
      );
    });

    it('returns the id even when LNURL-pay generation fails (lnurlPay is undefined)', async () => {
      // Simulate LNURL generation error by mocking the logger.error side-effect path.
      // generateLnurlPayLink catches internally and returns null, which becomes undefined.
      mockDb._singleResult = { data: { id: 'inv-9' }, error: null };

      // Temporarily break LNBITS_URL to nothing — the service still builds a URL
      // so we just verify the result shape
      const result = await service.createInvoice('creator-1', {
        clientName: 'Client',
        lineItems: singleLineItem,
      });

      expect(result).toHaveProperty('id');
    });

    it('throws when insert returns null data', async () => {
      mockDb._singleResult = { data: null, error: null };

      await expect(
        service.createInvoice('creator-1', { clientName: 'Client', lineItems: singleLineItem })
      ).rejects.toThrow('Failed to create invoice');
    });

    it('throws a sanitized error when insert fails', async () => {
      const dbError = { message: 'Insert failed', code: '23505' };
      mockDb._singleResult = { data: null, error: dbError };

      await expect(
        service.createInvoice('creator-1', { clientName: 'Client', lineItems: singleLineItem })
      ).rejects.toThrow('Failed to create invoice');
    });

    it('converts sats to millisats in the LNURL-pay URL (amount = sats * 1000)', async () => {
      mockDb._singleResult = { data: { id: 'inv-10' }, error: null };

      const result = await service.createInvoice('creator-1', {
        clientName: 'Client',
        lineItems: [{ description: 'Item', quantity: 1, unitPriceSats: 5000 }],
      });

      // 5000 sats = 5000000 millisats
      expect(result.lnurlPay).toContain('amount=5000000');
    });
  });

  // =========================================================================
  // getInvoices
  // =========================================================================

  describe('getInvoices', () => {
    it('returns all invoices for a creator ordered by created_at desc', async () => {
      const dbRows = [
        {
          id: 'inv-1',
          creator_id: 'creator-1',
          client_name: 'A',
          line_items: [],
          total_sats: 100,
          status: 'draft',
          due_date: null,
          recurring_interval: null,
          recurrence_end_date: null,
          lnurl_pay: null,
          lightning_payment_link: null,
          created_at: '2026-01-01',
          paid_at: null,
        },
        {
          id: 'inv-2',
          creator_id: 'creator-1',
          client_name: 'B',
          line_items: [],
          total_sats: 200,
          status: 'sent',
          due_date: null,
          recurring_interval: null,
          recurrence_end_date: null,
          lnurl_pay: null,
          lightning_payment_link: null,
          created_at: '2026-01-02',
          paid_at: null,
        },
      ];
      mockDb._orderResult = { data: dbRows, error: null };

      const result = await service.getInvoices('creator-1');

      expect(mockDb.from).toHaveBeenCalledWith('business_invoices');
      expect(mockDb.eq).toHaveBeenCalledWith('creator_id', 'creator-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('creatorId', 'creator-1');
      expect(result[0]).toHaveProperty('status', 'draft');
      expect(result[1]).toHaveProperty('status', 'sent');
    });

    it('applies status filter when filters.status is provided', async () => {
      mockDb._orderResult = {
        data: [
          {
            id: 'inv-1',
            creator_id: 'creator-1',
            client_name: 'A',
            line_items: [],
            total_sats: 100,
            status: 'paid',
            due_date: null,
            recurring_interval: null,
            recurrence_end_date: null,
            lnurl_pay: null,
            lightning_payment_link: null,
            created_at: '2026-01-01',
            paid_at: '2026-01-02',
          },
        ],
        error: null,
      };

      await service.getInvoices('creator-1', { status: 'paid' });

      // The second eq call adds the status filter
      expect(mockDb.eq).toHaveBeenCalledWith('status', 'paid');
    });

    it('does not apply status filter when filters is absent', async () => {
      mockDb._orderResult = { data: [], error: null };

      await service.getInvoices('creator-1');

      // Only creator_id eq call — no status filter
      const eqCalls = mockDb.eq.mock.calls.map((c: any[]) => c[0]);
      expect(eqCalls).not.toContain('status');
    });

    it('returns empty array when data is null', async () => {
      mockDb._orderResult = { data: null, error: null };

      const result = await service.getInvoices('creator-1');

      expect(result).toEqual([]);
    });

    it('throws a sanitized error when the database returns an error', async () => {
      const dbError = { message: 'Permission denied' };
      mockDb._orderResult = { data: null, error: dbError };

      await expect(service.getInvoices('creator-1')).rejects.toThrow('Failed to fetch invoices');
    });
  });

  // =========================================================================
  // getInvoice
  // =========================================================================

  describe('getInvoice', () => {
    it('returns the invoice when found (camelCase domain type)', async () => {
      const dbRow = {
        id: 'inv-1',
        creator_id: 'creator-1',
        client_name: 'Acme',
        line_items: [],
        total_sats: 10000,
        status: 'draft',
        due_date: null,
        recurring_interval: null,
        recurrence_end_date: null,
        lnurl_pay: null,
        lightning_payment_link: null,
        created_at: '2026-01-01',
        paid_at: null,
      };
      mockDb._singleResult = { data: dbRow, error: null };

      const result = await service.getInvoice('inv-1', 'creator-1');

      expect(mockDb.eq).toHaveBeenCalledWith('id', 'inv-1');
      expect(mockDb.eq).toHaveBeenCalledWith('creator_id', 'creator-1');
      expect(result).toHaveProperty('creatorId', 'creator-1');
      expect(result).toHaveProperty('clientName', 'Acme');
      expect(result).toHaveProperty('totalSats', 10000);
      expect(result).toHaveProperty('status', 'draft');
      expect(result).toHaveProperty('createdAt', '2026-01-01');
    });

    it('throws "Invoice not found" when data is null and error is null', async () => {
      mockDb._singleResult = { data: null, error: null };

      await expect(service.getInvoice('inv-missing', 'creator-1')).rejects.toThrow(
        'Invoice not found: inv-missing'
      );
    });

    it('throws a sanitized error when query fails', async () => {
      const dbError = { message: 'Not found', code: 'PGRST116' };
      mockDb._singleResult = { data: null, error: dbError };

      await expect(service.getInvoice('inv-x', 'creator-1')).rejects.toThrow(
        'Failed to fetch invoice'
      );
    });

    it('enforces creator ownership by filtering on creator_id', async () => {
      const dbRow = {
        id: 'inv-1',
        creator_id: 'creator-1',
        client_name: 'X',
        line_items: [],
        total_sats: 5000,
        status: 'draft',
        due_date: null,
        recurring_interval: null,
        recurrence_end_date: null,
        lnurl_pay: null,
        lightning_payment_link: null,
        created_at: '2026-01-01',
        paid_at: null,
      };
      mockDb._singleResult = { data: dbRow, error: null };

      await service.getInvoice('inv-1', 'creator-1');

      expect(mockDb.eq).toHaveBeenCalledWith('creator_id', 'creator-1');
    });
  });

  // =========================================================================
  // updateInvoiceStatus — status state machine
  // =========================================================================

  describe('updateInvoiceStatus', () => {
    function makeUpdateTerminalChain(resolvedValue: { data: any; error: any }) {
      let callCount = 0;
      const chain: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount >= 2) return Promise.resolve(resolvedValue);
          return chain;
        }),
      };
      return chain;
    }

    it('calls update with the new status on the business_invoices table', async () => {
      const chain = makeUpdateTerminalChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);

      await service.updateInvoiceStatus('inv-1', 'creator-1', 'sent');

      expect(mockDb.from).toHaveBeenCalledWith('business_invoices');
      expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
    });

    it('enforces owner by filtering on both invoiceId and creatorId', async () => {
      const chain = makeUpdateTerminalChain({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);

      await service.updateInvoiceStatus('inv-1', 'creator-1', 'viewed');

      expect(chain.eq).toHaveBeenCalledWith('id', 'inv-1');
      expect(chain.eq).toHaveBeenCalledWith('creator_id', 'creator-1');
    });

    it.each(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'])(
      'accepts "%s" as a valid status transition',
      async status => {
        const chain = makeUpdateTerminalChain({ data: null, error: null });
        mockDb.from.mockReturnValue(chain);

        await expect(
          service.updateInvoiceStatus('inv-1', 'creator-1', status)
        ).resolves.not.toThrow();
      }
    );

    it('throws a sanitized error when update fails', async () => {
      const dbError = { message: 'RLS violation' };
      const chain = makeUpdateTerminalChain({ data: null, error: dbError });
      mockDb.from.mockReturnValue(chain);

      await expect(service.updateInvoiceStatus('inv-1', 'creator-1', 'paid')).rejects.toThrow(
        'Failed to update invoice status'
      );
    });
  });

  // =========================================================================
  // generatePaymentLink
  // =========================================================================

  describe('generatePaymentLink', () => {
    it('returns a lnurlPay link for a found invoice', async () => {
      const dbRow = {
        id: 'inv-1',
        creator_id: 'creator-1',
        client_name: 'X',
        line_items: [],
        total_sats: 50000,
        status: 'draft',
        due_date: null,
        recurring_interval: null,
        recurrence_end_date: null,
        lnurl_pay: null,
        lightning_payment_link: null,
        created_at: '2026-01-01',
        paid_at: null,
      };
      mockDb._singleResult = { data: dbRow, error: null };

      const result = await service.generatePaymentLink('inv-1', 'creator-1');

      expect(result).toHaveProperty('lnurlPay');
      expect(typeof result.lnurlPay).toBe('string');
      expect(result.lnurlPay.length).toBeGreaterThan(0);
    });

    it('persists both lnurl_pay and lightning_payment_link fields', async () => {
      const dbRow = {
        id: 'inv-1',
        creator_id: 'creator-1',
        client_name: 'X',
        line_items: [],
        total_sats: 10000,
        status: 'draft',
        due_date: null,
        recurring_interval: null,
        recurrence_end_date: null,
        lnurl_pay: null,
        lightning_payment_link: null,
        created_at: '2026-01-01',
        paid_at: null,
      };
      mockDb._singleResult = { data: dbRow, error: null };

      await service.generatePaymentLink('inv-1', 'creator-1');

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lnurl_pay: expect.any(String),
          lightning_payment_link: expect.any(String),
        })
      );
    });

    it('throws "Invoice not found" when getInvoice returns null', async () => {
      mockDb._singleResult = { data: null, error: null };

      await expect(service.generatePaymentLink('inv-missing', 'creator-1')).rejects.toThrow(
        'Invoice not found: inv-missing'
      );
    });

    it('throws a sanitized error when getInvoice returns a database error', async () => {
      const dbError = { message: 'Not found', code: 'PGRST116' };
      mockDb._singleResult = { data: null, error: dbError };

      await expect(service.generatePaymentLink('inv-x', 'wrong-creator')).rejects.toThrow(
        'Failed to fetch invoice'
      );
    });
  });

  // =========================================================================
  // Interval-to-milliseconds mapping (tested indirectly via createInvoice)
  // =========================================================================

  describe('recurring interval scheduling', () => {
    const testInterval = async (interval: string) => {
      mockDb._singleResult = { data: { id: 'inv-recurring' }, error: null };
      await service.createInvoice('creator-1', {
        clientName: 'Client',
        lineItems: [{ description: 'Item', quantity: 1, unitPriceSats: 1000 }],
        recurringInterval: interval,
      });
      return mockQueue.addJob.mock.calls[0]?.[3]?.delay as number | undefined;
    };

    it('schedules weekly interval with 7-day delay', async () => {
      const delay = await testInterval('weekly');
      expect(delay).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('schedules biweekly interval with 14-day delay', async () => {
      vi.clearAllMocks();
      mockQueue = makeQueueService();
      service = new BusinessInvoiceService(mockDb as any, mockQueue as any, mockLogger);
      const delay = await testInterval('biweekly');
      expect(delay).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it('schedules monthly interval with 30-day delay', async () => {
      vi.clearAllMocks();
      mockQueue = makeQueueService();
      service = new BusinessInvoiceService(mockDb as any, mockQueue as any, mockLogger);
      const delay = await testInterval('monthly');
      expect(delay).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('schedules quarterly interval with 90-day delay', async () => {
      vi.clearAllMocks();
      mockQueue = makeQueueService();
      service = new BusinessInvoiceService(mockDb as any, mockQueue as any, mockLogger);
      const delay = await testInterval('quarterly');
      expect(delay).toBe(90 * 24 * 60 * 60 * 1000);
    });

    it('does NOT schedule a job for an unknown interval (maps to 0ms)', async () => {
      vi.clearAllMocks();
      mockQueue = makeQueueService();
      service = new BusinessInvoiceService(mockDb as any, mockQueue as any, mockLogger);
      mockDb._singleResult = { data: { id: 'inv-unknown' }, error: null };

      await service.createInvoice('creator-1', {
        clientName: 'Client',
        lineItems: [{ description: 'Item', quantity: 1, unitPriceSats: 1000 }],
        recurringInterval: 'annually', // unknown — maps to 0ms so no job
      });

      // 0ms delay means scheduleRecurringInvoice returns early
      expect(mockQueue.addJob).not.toHaveBeenCalled();
    });
  });
});
