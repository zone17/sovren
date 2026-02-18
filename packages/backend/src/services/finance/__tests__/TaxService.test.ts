/**
 * TaxService Tests
 * EPIC-011: Business Manager — Tax preparation, expense tracking, quarterly summaries
 *
 * Coverage targets:
 *   - getQuarterlySummary: revenue + expense aggregation, USD conversion,
 *                          all 4 quarters date ranges, revenue DB error
 *   - getExpenses: with/without filters, empty result, DB error
 *   - addExpense: zero/negative rejection, success, optional fields,
 *                 default expenseDate, USD conversion, DB errors
 *   - getExpenseCategories: success, empty, DB error
 *   - createExpenseCategory: success, null insert, DB error
 *   - exportTaxReport (JSON): structure, all 4 quarters, correct fields
 *   - exportTaxReport (CSV): headers, quarter rows, expense rows, Uncategorized,
 *                            CSV injection prevention (=, +, -, @ prefix)
 *   - getBtcUsdRate: cache hit, API success + caching, invalid rate fallback,
 *                    network failure + stale cache, full fallback $50k
 *
 * Implementation notes:
 *   - getQuarterlySummary terminates both revenue_entries and expenses queries with .lte()
 *   - getExpenses, getExpenseCategories terminate with .order()
 *   - addExpense, createExpenseCategory terminate with .single()
 *   - getBtcUsdRate returns { rate: number; fetchedAt: string } — not a bare number
 *   - CSV injection uses single-quote prefix on formula-trigger chars (=, +, -, @)
 */

import { TaxService } from '../TaxService';

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

function makeCache() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(true),
    invalidate: jest.fn().mockResolvedValue(0),
    exists: jest.fn().mockResolvedValue(false),
    invalidateByTags: jest.fn().mockResolvedValue(0),
    flush: jest.fn().mockResolvedValue(undefined),
    getTtl: jest.fn().mockResolvedValue(0),
    setTtl: jest.fn().mockResolvedValue(true),
    getMany: jest.fn().mockResolvedValue(new Map()),
    setMany: jest.fn().mockResolvedValue(undefined),
    remember: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    dispose: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build a Supabase mock that handles three distinct query termination patterns:
 *
 *   1. getQuarterlySummary  → terminates with .lte()  (revenue_entries & expenses tables)
 *   2. getExpenses / getExpenseCategories → terminates with .order()
 *   3. addExpense / createExpenseCategory → terminates with .single()
 *
 * We track the current table via .from() so different result sets can be returned
 * for revenue_entries vs expenses within the same test.
 */
function makeDb() {
  const db: any = {
    // Results that tests can override
    _revenueResult: { data: [], error: null },  // for revenue_entries .lte() termination
    _expenseResult: { data: [], error: null },  // for expenses .lte() termination
    _orderResult: { data: [], error: null },    // for .order() termination
    _singleResult: { data: null, error: null }, // for .single() termination
    _currentTable: '',

    from: jest.fn().mockImplementation(function (table: string) {
      db._currentTable = table;
      return db;
    }),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    // lte is terminal for getQuarterlySummary queries; returns `this` for getExpenses
    lte: jest.fn().mockImplementation(function (column: string) {
      // In getQuarterlySummary both the revenue and expense sub-queries terminate here.
      // In getExpenses, endDate filter also calls lte — but then order() is called after,
      // so we must return `this` in that case. We distinguish by the column name:
      //   - 'recorded_at'    → revenue_entries termination
      //   - 'expense_date' AND after lte is followed by order() → order() terminates
      // The simplest approach: always return `this` from lte when the table is 'expenses'
      // and the column is 'expense_date' AND we are inside getExpenses (not getQuarterlySummary).
      // For getQuarterlySummary the expense query uses column 'expense_date' and there is NO
      // subsequent .order() call — so we resolve.
      //
      // We use `_inGetExpenses` flag set by the test when calling getExpenses directly.
      if (db._inGetExpenses && column === 'expense_date') {
        // getExpenses path — lte returns `this` so order() can terminate
        return db;
      }
      // getQuarterlySummary path — lte is terminal
      if (db._currentTable === 'revenue_entries') return Promise.resolve(db._revenueResult);
      if (db._currentTable === 'expenses') return Promise.resolve(db._expenseResult);
      return Promise.resolve(db._orderResult);
    }),
    // order() is terminal for getExpenses and getExpenseCategories
    order: jest.fn().mockImplementation(() => Promise.resolve(db._orderResult)),
    // single() is terminal for addExpense, createExpenseCategory, getExpenses.single (never called)
    single: jest.fn().mockImplementation(() => Promise.resolve(db._singleResult)),
  };
  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaxService', () => {
  let mockDb: ReturnType<typeof makeDb>;
  let mockCache: ReturnType<typeof makeCache>;
  let mockLogger: ReturnType<typeof makeLogger>;
  let service: TaxService;

  const MOCK_BTC_RATE = 60000;
  const MOCK_BTC_ENTRY = { rate: MOCK_BTC_RATE, fetchedAt: '2026-02-18T00:00:00.000Z' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = makeLogger();
    mockCache = makeCache();
    mockDb = makeDb();

    // Default: global.fetch returns a valid BTC/USD rate
    (global.fetch as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue({ bitcoin: { usd: MOCK_BTC_RATE } }),
    });

    service = new TaxService(mockDb as any, mockCache as any, mockLogger as any);
  });

  // =========================================================================
  // getQuarterlySummary
  // =========================================================================

  describe('getQuarterlySummary', () => {
    it('returns correct sats totals when revenue and expenses are present', async () => {
      mockDb._revenueResult = {
        data: [
          { amount_sats: 500000, usd_at_time: null },
          { amount_sats: 300000, usd_at_time: null },
        ],
        error: null,
      };
      mockDb._expenseResult = {
        data: [
          { amount_sats: 100000, usd_at_time: null },
          { amount_sats: 50000, usd_at_time: null },
        ],
        error: null,
      };

      const summary = await service.getQuarterlySummary('creator-1', 2026, 1);

      expect(summary.revenue).toBe(800000);
      expect(summary.expenses).toBe(150000);
      expect(summary.net).toBe(650000);
    });

    it('converts sats to USD using the BTC rate when usd_at_time is null', async () => {
      // 100_000_000 sats = 1 BTC = $60,000 at MOCK_BTC_RATE
      mockDb._revenueResult = {
        data: [{ amount_sats: 100_000_000, usd_at_time: null }],
        error: null,
      };
      mockDb._expenseResult = { data: [], error: null };

      const summary = await service.getQuarterlySummary('creator-1', 2026, 1);

      expect(summary.usdRevenue).toBeCloseTo(MOCK_BTC_RATE, 0);
      expect(summary.usdExpenses).toBe(0);
      expect(summary.usdNet).toBeCloseTo(MOCK_BTC_RATE, 0);
    });

    it('uses recorded usd_at_time values instead of converting from sats', async () => {
      mockDb._revenueResult = {
        data: [{ amount_sats: 100000, usd_at_time: 300.0 }],
        error: null,
      };
      mockDb._expenseResult = {
        data: [{ amount_sats: 50000, usd_at_time: 120.0 }],
        error: null,
      };

      const summary = await service.getQuarterlySummary('creator-1', 2026, 1);

      expect(summary.usdRevenue).toBe(300.0);
      expect(summary.usdExpenses).toBe(120.0);
      expect(summary.usdNet).toBeCloseTo(180.0, 2);
    });

    it('returns zeros when there are no revenue or expense entries', async () => {
      mockDb._revenueResult = { data: [], error: null };
      mockDb._expenseResult = { data: [], error: null };

      const summary = await service.getQuarterlySummary('creator-1', 2026, 1);

      expect(summary.revenue).toBe(0);
      expect(summary.expenses).toBe(0);
      expect(summary.net).toBe(0);
      expect(summary.usdRevenue).toBe(0);
      expect(summary.usdExpenses).toBe(0);
      expect(summary.usdNet).toBe(0);
    });

    it('rounds USD values to 2 decimal places', async () => {
      mockDb._revenueResult = {
        data: [{ amount_sats: 1, usd_at_time: null }],
        error: null,
      };
      mockDb._expenseResult = { data: [], error: null };

      const summary = await service.getQuarterlySummary('creator-1', 2026, 1);

      const asStr = summary.usdRevenue.toString();
      const decimals = asStr.includes('.') ? asStr.split('.')[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });

    it('queries revenue_entries with correct Q1 date range', async () => {
      mockDb._revenueResult = { data: [], error: null };
      mockDb._expenseResult = { data: [], error: null };

      await service.getQuarterlySummary('creator-1', 2026, 1);

      expect(mockDb.gte).toHaveBeenCalledWith('recorded_at', '2026-01-01T00:00:00Z');
      expect(mockDb.lte).toHaveBeenCalledWith('recorded_at', '2026-03-31T23:59:59Z');
    });

    it('queries with correct Q2 date range', async () => {
      mockDb._revenueResult = { data: [], error: null };
      mockDb._expenseResult = { data: [], error: null };

      await service.getQuarterlySummary('creator-1', 2026, 2);

      expect(mockDb.gte).toHaveBeenCalledWith('recorded_at', '2026-04-01T00:00:00Z');
      expect(mockDb.lte).toHaveBeenCalledWith('recorded_at', '2026-06-30T23:59:59Z');
    });

    it('queries with correct Q3 date range', async () => {
      mockDb._revenueResult = { data: [], error: null };
      mockDb._expenseResult = { data: [], error: null };

      await service.getQuarterlySummary('creator-1', 2026, 3);

      expect(mockDb.gte).toHaveBeenCalledWith('recorded_at', '2026-07-01T00:00:00Z');
      expect(mockDb.lte).toHaveBeenCalledWith('recorded_at', '2026-09-30T23:59:59Z');
    });

    it('queries with correct Q4 date range', async () => {
      mockDb._revenueResult = { data: [], error: null };
      mockDb._expenseResult = { data: [], error: null };

      await service.getQuarterlySummary('creator-1', 2026, 4);

      expect(mockDb.gte).toHaveBeenCalledWith('recorded_at', '2026-10-01T00:00:00Z');
      expect(mockDb.lte).toHaveBeenCalledWith('recorded_at', '2026-12-31T23:59:59Z');
    });

    it('throws when the revenue query returns a database error', async () => {
      const dbError = { message: 'Revenue query failed' };
      mockDb._revenueResult = { data: null, error: dbError };
      mockDb._expenseResult = { data: [], error: null };

      await expect(service.getQuarterlySummary('creator-1', 2026, 1)).rejects.toEqual(dbError);
    });

    it('uses cached BTC rate when available (no fetch call)', async () => {
      mockCache.get.mockResolvedValue(MOCK_BTC_ENTRY);
      mockDb._revenueResult = {
        data: [{ amount_sats: 1000, usd_at_time: null }],
        error: null,
      };
      mockDb._expenseResult = { data: [], error: null };

      await service.getQuarterlySummary('creator-1', 2026, 1);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('falls back to $50,000 when fetch fails and no stale cache exists', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      mockCache.get.mockResolvedValue(null);

      mockDb._revenueResult = {
        data: [{ amount_sats: 100_000_000, usd_at_time: null }],
        error: null,
      };
      mockDb._expenseResult = { data: [], error: null };

      const summary = await service.getQuarterlySummary('creator-1', 2026, 1);

      expect(summary.usdRevenue).toBeCloseTo(50000, 0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('BTC/USD rate fetch failed'),
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // getExpenses
  // =========================================================================

  describe('getExpenses', () => {
    beforeEach(() => {
      // Signal to the mock that we're calling getExpenses (lte returns `this`)
      mockDb._inGetExpenses = true;
    });

    afterEach(() => {
      mockDb._inGetExpenses = false;
    });

    it('returns all expenses ordered by expense_date desc', async () => {
      const expenses = [
        { id: 'exp-1', description: 'Software', expense_date: '2026-02-15' },
        { id: 'exp-2', description: 'Hardware', expense_date: '2026-02-01' },
      ];
      mockDb._orderResult = { data: expenses, error: null };

      const result = await service.getExpenses('creator-1');

      expect(mockDb.from).toHaveBeenCalledWith('expenses');
      expect(mockDb.select).toHaveBeenCalledWith('*, expense_categories(name, type)');
      expect(mockDb.eq).toHaveBeenCalledWith('creator_id', 'creator-1');
      expect(mockDb.order).toHaveBeenCalledWith('expense_date', { ascending: false });
      expect(result).toEqual(expenses);
    });

    it('applies categoryId filter when provided', async () => {
      mockDb._orderResult = { data: [], error: null };

      await service.getExpenses('creator-1', { categoryId: 'cat-1' });

      expect(mockDb.eq).toHaveBeenCalledWith('category_id', 'cat-1');
    });

    it('applies startDate filter when provided', async () => {
      mockDb._orderResult = { data: [], error: null };

      await service.getExpenses('creator-1', { startDate: '2026-01-01' });

      expect(mockDb.gte).toHaveBeenCalledWith('expense_date', '2026-01-01');
    });

    it('applies endDate filter when provided', async () => {
      mockDb._orderResult = { data: [], error: null };

      await service.getExpenses('creator-1', { endDate: '2026-03-31' });

      expect(mockDb.lte).toHaveBeenCalledWith('expense_date', '2026-03-31');
    });

    it('returns empty array when data is null', async () => {
      mockDb._orderResult = { data: null, error: null };

      const result = await service.getExpenses('creator-1');

      expect(result).toEqual([]);
    });

    it('returns empty array when data is an empty array', async () => {
      mockDb._orderResult = { data: [], error: null };

      expect(await service.getExpenses('creator-1')).toEqual([]);
    });

    it('throws when the database returns an error', async () => {
      const dbError = { message: 'Access denied' };
      mockDb._orderResult = { data: null, error: dbError };

      await expect(service.getExpenses('creator-1')).rejects.toEqual(dbError);
    });
  });

  // =========================================================================
  // addExpense
  // =========================================================================

  describe('addExpense', () => {
    it('throws when amountSats is 0', async () => {
      await expect(
        service.addExpense('creator-1', { description: 'Test', amountSats: 0 })
      ).rejects.toThrow('Expense amount must be greater than 0 sats');
    });

    it('throws when amountSats is negative', async () => {
      await expect(
        service.addExpense('creator-1', { description: 'Test', amountSats: -500 })
      ).rejects.toThrow('Expense amount must be greater than 0 sats');
    });

    it('inserts the expense and returns the generated id', async () => {
      mockDb._singleResult = { data: { id: 'exp-1' }, error: null };

      const result = await service.addExpense('creator-1', {
        description: 'Domain renewal',
        amountSats: 10000,
      });

      expect(result).toEqual({ id: 'exp-1' });
      expect(mockDb.from).toHaveBeenCalledWith('expenses');
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 'creator-1',
          description: 'Domain renewal',
          amount_sats: 10000,
        })
      );
    });

    it('includes category_id when categoryId is provided', async () => {
      mockDb._singleResult = { data: { id: 'exp-2' }, error: null };

      await service.addExpense('creator-1', {
        description: 'Software sub',
        amountSats: 5000,
        categoryId: 'cat-software',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ category_id: 'cat-software' })
      );
    });

    it('omits category_id when categoryId is not provided', async () => {
      mockDb._singleResult = { data: { id: 'exp-3' }, error: null };

      await service.addExpense('creator-1', { description: 'Misc', amountSats: 2000 });

      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg).not.toHaveProperty('category_id');
    });

    it('uses provided expenseDate when given', async () => {
      mockDb._singleResult = { data: { id: 'exp-4' }, error: null };

      await service.addExpense('creator-1', {
        description: 'Travel',
        amountSats: 100000,
        expenseDate: '2026-02-10',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ expense_date: '2026-02-10' })
      );
    });

    it('defaults expenseDate to today when not provided', async () => {
      mockDb._singleResult = { data: { id: 'exp-5' }, error: null };

      const today = new Date().toISOString().split('T')[0];
      await service.addExpense('creator-1', { description: 'Misc', amountSats: 1000 });

      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg.expense_date).toBe(today);
    });

    it('records the USD value at time of entry (usd_at_time)', async () => {
      mockDb._singleResult = { data: { id: 'exp-6' }, error: null };

      // 100_000_000 sats = 1 BTC = $60,000 at MOCK_BTC_RATE
      await service.addExpense('creator-1', {
        description: 'Big purchase',
        amountSats: 100_000_000,
      });

      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg.usd_at_time).toBeCloseTo(MOCK_BTC_RATE, 0);
    });

    it('rounds usd_at_time to 2 decimal places', async () => {
      mockDb._singleResult = { data: { id: 'exp-7' }, error: null };

      await service.addExpense('creator-1', { description: 'Item', amountSats: 1 });

      const insertArg = mockDb.insert.mock.calls[0][0];
      const decimals = insertArg.usd_at_time.toString().includes('.')
        ? insertArg.usd_at_time.toString().split('.')[1].length
        : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });

    it('includes rate_timestamp provenance field from getBtcUsdRate', async () => {
      mockDb._singleResult = { data: { id: 'exp-prov' }, error: null };

      await service.addExpense('creator-1', { description: 'Item', amountSats: 1000 });

      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg).toHaveProperty('rate_timestamp');
      expect(typeof insertArg.rate_timestamp).toBe('string');
    });

    it('throws "Failed to add expense" when insert returns null data', async () => {
      mockDb._singleResult = { data: null, error: null };

      await expect(
        service.addExpense('creator-1', { description: 'Test', amountSats: 1000 })
      ).rejects.toThrow('Failed to add expense');
    });

    it('throws the database error when insert fails', async () => {
      const dbError = { message: 'FK violation', code: '23503' };
      mockDb._singleResult = { data: null, error: dbError };

      await expect(
        service.addExpense('creator-1', { description: 'Test', amountSats: 1000 })
      ).rejects.toEqual(dbError);
    });
  });

  // =========================================================================
  // getExpenseCategories
  // =========================================================================

  describe('getExpenseCategories', () => {
    it('returns expense categories ordered by name ascending', async () => {
      const categories = [
        { id: 'cat-1', name: 'Equipment', type: 'equipment' },
        { id: 'cat-2', name: 'Software', type: 'software' },
      ];
      mockDb._orderResult = { data: categories, error: null };

      const result = await service.getExpenseCategories('creator-1');

      expect(mockDb.from).toHaveBeenCalledWith('expense_categories');
      expect(mockDb.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toEqual(categories);
    });

    it('returns empty array when no categories exist (null data)', async () => {
      mockDb._orderResult = { data: null, error: null };

      const result = await service.getExpenseCategories('creator-1');

      expect(result).toEqual([]);
    });

    it('throws when database returns an error', async () => {
      const dbError = { message: 'Permission denied' };
      mockDb._orderResult = { data: null, error: dbError };

      await expect(service.getExpenseCategories('creator-1')).rejects.toEqual(dbError);
    });
  });

  // =========================================================================
  // createExpenseCategory
  // =========================================================================

  describe('createExpenseCategory', () => {
    it('inserts the category and returns the generated id', async () => {
      mockDb._singleResult = { data: { id: 'cat-1' }, error: null };

      const result = await service.createExpenseCategory('creator-1', {
        name: 'Software',
        type: 'software',
      });

      expect(result).toEqual({ id: 'cat-1' });
      expect(mockDb.from).toHaveBeenCalledWith('expense_categories');
      expect(mockDb.insert).toHaveBeenCalledWith({
        creator_id: 'creator-1',
        name: 'Software',
        type: 'software',
      });
    });

    it('throws "Failed to create expense category" when insert returns null data', async () => {
      mockDb._singleResult = { data: null, error: null };

      await expect(
        service.createExpenseCategory('creator-1', { name: 'Test', type: 'misc' })
      ).rejects.toThrow('Failed to create expense category');
    });

    it('throws the database error when insert fails', async () => {
      const dbError = { message: 'Duplicate name', code: '23505' };
      mockDb._singleResult = { data: null, error: dbError };

      await expect(
        service.createExpenseCategory('creator-1', { name: 'Software', type: 'software' })
      ).rejects.toEqual(dbError);
    });
  });

  // =========================================================================
  // exportTaxReport — JSON format
  // =========================================================================

  describe('exportTaxReport (JSON)', () => {
    /**
     * exportTaxReport calls:
     *   1. getQuarterlySummary ×4  → lte terminates (revenue_entries + expenses)
     *   2. getExpenses             → order terminates
     *
     * Set _inGetExpenses BEFORE calling exportTaxReport so that when getExpenses
     * is called internally the lte mock returns `this` instead of resolving.
     */
    beforeEach(() => {
      mockDb._revenueResult = { data: [], error: null };
      mockDb._expenseResult = { data: [], error: null };
      mockDb._orderResult = { data: [], error: null };

      // The internal getExpenses call needs lte to chain to order()
      // We handle this by using a smarter mock flag
      mockDb._inGetExpenses = true;
    });

    afterEach(() => {
      mockDb._inGetExpenses = false;
    });

    it('returns valid JSON with year, quarters, and expenses keys', async () => {
      const output = await service.exportTaxReport('creator-1', 2026, 'json');
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty('year', 2026);
      expect(parsed).toHaveProperty('quarters');
      expect(Array.isArray(parsed.quarters)).toBe(true);
      expect(parsed).toHaveProperty('expenses');
    });

    it('includes all 4 quarters in the JSON output', async () => {
      const output = await service.exportTaxReport('creator-1', 2026, 'json');
      const parsed = JSON.parse(output);

      expect(parsed.quarters).toHaveLength(4);
      const quarterNumbers = parsed.quarters.map((q: any) => q.quarter);
      expect(quarterNumbers).toEqual([1, 2, 3, 4]);
    });

    it('each quarter summary has the expected numeric fields', async () => {
      const output = await service.exportTaxReport('creator-1', 2026, 'json');
      const parsed = JSON.parse(output);

      for (const { summary } of parsed.quarters) {
        expect(typeof summary.revenue).toBe('number');
        expect(typeof summary.expenses).toBe('number');
        expect(typeof summary.net).toBe('number');
        expect(typeof summary.usdRevenue).toBe('number');
        expect(typeof summary.usdExpenses).toBe('number');
        expect(typeof summary.usdNet).toBe('number');
      }
    });

    it('is formatted with 2-space indentation', async () => {
      const output = await service.exportTaxReport('creator-1', 2026, 'json');
      expect(output).toContain('  "year"');
    });
  });

  // =========================================================================
  // exportTaxReport — CSV format
  // =========================================================================

  describe('exportTaxReport (CSV)', () => {
    beforeEach(() => {
      mockDb._revenueResult = { data: [], error: null };
      mockDb._expenseResult = { data: [], error: null };
      mockDb._orderResult = { data: [], error: null };
      mockDb._inGetExpenses = true;
    });

    afterEach(() => {
      mockDb._inGetExpenses = false;
    });

    it('returns a string containing the quarterly summary header', async () => {
      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');
      expect(csv).toContain(
        'Quarter,Revenue (sats),Expenses (sats),Net (sats),Revenue (USD),Expenses (USD),Net (USD)'
      );
    });

    it('includes a row for each of the 4 quarters (Q1-Q4)', async () => {
      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');
      expect(csv).toContain('Q1,');
      expect(csv).toContain('Q2,');
      expect(csv).toContain('Q3,');
      expect(csv).toContain('Q4,');
    });

    it('includes the expense detail section header', async () => {
      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');
      expect(csv).toContain('Date,Description,Category,Amount (sats),Amount (USD)');
    });

    it('includes expense rows with correct field values', async () => {
      mockDb._orderResult = {
        data: [
          {
            expense_date: '2026-02-15',
            description: 'Domain renewal',
            expense_categories: { name: 'Software' },
            amount_sats: 5000,
            usd_at_time: 3.00,
          },
        ],
        error: null,
      };

      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');

      expect(csv).toContain('2026-02-15');
      expect(csv).toContain('"Domain renewal"');
      expect(csv).toContain('"Software"');
      expect(csv).toContain('5000');
    });

    it('uses "Uncategorized" for expenses without a category', async () => {
      mockDb._orderResult = {
        data: [
          {
            expense_date: '2026-02-15',
            description: 'Misc purchase',
            expense_categories: null,
            amount_sats: 1000,
            usd_at_time: 0.60,
          },
        ],
        error: null,
      };

      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');

      expect(csv).toContain('"Uncategorized"');
    });

    /**
     * CSV injection prevention (L-5 security requirement):
     * The service prefixes formula-trigger characters (=, +, -, @) with a single quote
     * so spreadsheet applications do not execute them as formulas.
     */
    it('prefixes "=" formula injection with a single quote (CSV injection prevention)', async () => {
      mockDb._orderResult = {
        data: [
          {
            expense_date: '2026-02-15',
            description: '=SUM(A1:A10)',
            expense_categories: null,
            amount_sats: 1000,
            usd_at_time: null,
          },
        ],
        error: null,
      };

      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');

      // The description cell must contain the single-quote-prefixed value
      expect(csv).toContain("\"'=SUM(A1:A10)\"");
      // The raw formula must NOT appear as an unescaped cell value
      expect(csv).not.toMatch(/,"=SUM/);
    });

    it('prefixes "+" injection with a single quote', async () => {
      mockDb._orderResult = {
        data: [
          {
            expense_date: '2026-02-15',
            description: '+1234567890',
            expense_categories: null,
            amount_sats: 500,
            usd_at_time: null,
          },
        ],
        error: null,
      };

      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');
      expect(csv).toContain("\"'+1234567890\"");
    });

    it('prefixes "-" injection with a single quote', async () => {
      mockDb._orderResult = {
        data: [
          {
            expense_date: '2026-02-15',
            description: '-1+2',
            expense_categories: null,
            amount_sats: 500,
            usd_at_time: null,
          },
        ],
        error: null,
      };

      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');
      expect(csv).toContain("\"'-1+2\"");
    });

    it('prefixes "@" injection with a single quote', async () => {
      mockDb._orderResult = {
        data: [
          {
            expense_date: '2026-02-15',
            description: '@SUM(A1:A10)',
            expense_categories: null,
            amount_sats: 500,
            usd_at_time: null,
          },
        ],
        error: null,
      };

      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');
      expect(csv).toContain("\"'@SUM(A1:A10)\"");
    });

    it('does not prefix clean description values with a single quote', async () => {
      mockDb._orderResult = {
        data: [
          {
            expense_date: '2026-02-15',
            description: 'Domain renewal',
            expense_categories: null,
            amount_sats: 1000,
            usd_at_time: null,
          },
        ],
        error: null,
      };

      const csv = await service.exportTaxReport('creator-1', 2026, 'csv');
      // Clean description must appear without single-quote prefix
      expect(csv).toContain('"Domain renewal"');
      expect(csv).not.toContain("\"'Domain renewal\"");
    });

    it('fetches expenses for the full year (Jan 1 to Dec 31)', async () => {
      await service.exportTaxReport('creator-1', 2026, 'csv');

      expect(mockDb.gte).toHaveBeenCalledWith('expense_date', '2026-01-01');
      expect(mockDb.lte).toHaveBeenCalledWith('expense_date', '2026-12-31');
    });
  });

  // =========================================================================
  // BTC/USD rate resolution (tested via addExpense)
  // =========================================================================

  describe('BTC/USD rate resolution (via addExpense)', () => {
    it('uses fetched rate from API when cache misses', async () => {
      mockDb._singleResult = { data: { id: 'exp-btc' }, error: null };
      mockCache.get.mockResolvedValue(null);

      await service.addExpense('creator-1', {
        description: 'Test',
        amountSats: 100_000_000,
      });

      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg.usd_at_time).toBeCloseTo(MOCK_BTC_RATE, 0);
    });

    it('caches the fetched BTC rate as an object with rate and fetchedAt', async () => {
      mockDb._singleResult = { data: { id: 'exp-btc2' }, error: null };
      mockCache.get.mockResolvedValue(null);

      await service.addExpense('creator-1', { description: 'Test', amountSats: 1000 });

      expect(mockCache.set).toHaveBeenCalledWith(
        'btc:usd:rate',
        expect.objectContaining({ rate: MOCK_BTC_RATE, fetchedAt: expect.any(String) }),
        expect.any(Number)
      );
    });

    it('also persists a stale fallback entry to btc:usd:rate:stale', async () => {
      mockDb._singleResult = { data: { id: 'exp-stale-key' }, error: null };
      mockCache.get.mockResolvedValue(null);

      await service.addExpense('creator-1', { description: 'Test', amountSats: 1000 });

      expect(mockCache.set).toHaveBeenCalledWith(
        'btc:usd:rate:stale',
        expect.objectContaining({ rate: MOCK_BTC_RATE })
      );
    });

    it('uses cached BTC entry when primary cache hits (no fetch call)', async () => {
      mockCache.get.mockResolvedValue(MOCK_BTC_ENTRY);
      mockDb._singleResult = { data: { id: 'exp-cache' }, error: null };

      await service.addExpense('creator-1', {
        description: 'Test',
        amountSats: 100_000_000,
      });

      expect(global.fetch).not.toHaveBeenCalled();
      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg.usd_at_time).toBeCloseTo(MOCK_BTC_RATE, 0);
    });

    it('uses stale cache when API returns an invalid rate (rate <= 0)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({ bitcoin: { usd: -1 } }),
      });

      const staleRate = 55000;
      const staleEntry = { rate: staleRate, fetchedAt: '2026-02-17T00:00:00.000Z' };
      mockCache.get
        .mockResolvedValueOnce(null)         // primary cache miss
        .mockResolvedValueOnce(staleEntry);  // stale cache hit

      mockDb._singleResult = { data: { id: 'exp-stale' }, error: null };

      await service.addExpense('creator-1', {
        description: 'Test',
        amountSats: 100_000_000,
      });

      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg.usd_at_time).toBeCloseTo(staleRate, 0);
    });

    it('falls back to $50,000 when both API and stale cache fail', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network unavailable'));
      mockCache.get.mockResolvedValue(null);

      mockDb._singleResult = { data: { id: 'exp-fallback' }, error: null };

      await service.addExpense('creator-1', {
        description: 'Test',
        amountSats: 100_000_000,
      });

      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg.usd_at_time).toBeCloseTo(50000, 0);
    });
  });
});
