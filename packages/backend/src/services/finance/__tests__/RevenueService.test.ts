/**
 * RevenueService Tests
 * EPIC-011: Business Manager — Revenue tracking and diversification planning
 *
 * Coverage targets:
 *   - getRevenueBreakdown: cache hit, aggregation by source, percentage calculation,
 *                          period filters (gte/lte), empty result, DB error, cache write
 *   - getConcentrationRisk: high (>50%), medium (35-50%), low (<35%), unknown (no data),
 *                           50% boundary, 51% boundary, dominant source identity
 *   - getDiversificationGoals: found, not found (PGRST116), null data, other DB error
 *   - setDiversificationGoals: sum validation (<100, >100), valid upsert, cache invalidation, DB error
 *   - recordRevenue: zero rejection, negative rejection, success with cache invalidation,
 *                    optional description, omit description, null insert, DB error, all sources
 *
 * Mock strategy:
 *   getRevenueBreakdown ends with the last filter call (eq | lte) — we expose a
 *   `_breakdownResult` that the mock resolves when any of those is called.
 *   getDiversificationGoals ends with .single() — eq must return `this`.
 *   setDiversificationGoals ends with .upsert().
 *   recordRevenue ends with .single() (after insert).
 */

import { RevenueService } from '../RevenueService';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function makeCache() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
    invalidate: vi.fn().mockResolvedValue(0),
    exists: vi.fn().mockResolvedValue(false),
    invalidateByTags: vi.fn().mockResolvedValue(0),
    flush: vi.fn().mockResolvedValue(undefined),
    getTtl: vi.fn().mockResolvedValue(0),
    setTtl: vi.fn().mockResolvedValue(true),
    getMany: vi.fn().mockResolvedValue(new Map()),
    setMany: vi.fn().mockResolvedValue(undefined),
    remember: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build a Supabase mock that handles all RevenueService query shapes.
 *
 * Query termination patterns (by method that resolves the Promise):
 *   getRevenueBreakdown → ... .order().range() resolves via pagination loop
 *     - First call returns _breakdownResult data, second call returns empty
 *       array to terminate the pagination loop.
 *   getDiversificationGoals → ... single() after eq
 *   setDiversificationGoals → upsert()
 *   recordRevenue           → ... single() after insert.select
 *
 * Strategy:
 *   All filter methods (eq, gte, lte) always return `this` so chains compose.
 *   .order() returns `this` so .range() can be called.
 *   .range() is the terminal for paginated breakdown queries — it returns a
 *   Promise that resolves with _breakdownResult on the first call, then
 *   { data: [], error: null } on subsequent calls to stop the pagination loop.
 *
 * Mode flag (`_mode`): 'breakdown' | 'single' | 'upsert'
 */
function makeDb() {
  let _rangeCallCount = 0;

  const db: any = {
    _breakdownResult: { data: [], error: null },
    _singleResult: { data: null, error: null },
    _upsertResult: { error: null },
    _mode: 'breakdown',
    _resolveWith: null as any,

    // PromiseLike: allows `await db.xxx()` to resolve the chain
    then: vi.fn().mockImplementation(function (resolve: any, reject: any) {
      return Promise.resolve(db._resolveWith).then(resolve, reject);
    }),

    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),

    upsert: vi.fn().mockImplementation(() => {
      return Promise.resolve(db._upsertResult);
    }),

    eq: vi.fn().mockImplementation(function () {
      return db;
    }),

    gte: vi.fn().mockImplementation(function () {
      return db;
    }),

    lte: vi.fn().mockImplementation(function () {
      return db;
    }),

    // #366: order() returns `this` so .range() can chain after it
    order: vi.fn().mockImplementation(function () {
      return db;
    }),

    // #366: range() is terminal for paginated queries.
    // First call returns _breakdownResult, subsequent calls return empty to stop pagination.
    range: vi.fn().mockImplementation(function () {
      _rangeCallCount++;
      if (_rangeCallCount === 1) {
        return Promise.resolve(db._breakdownResult);
      }
      return Promise.resolve({ data: [], error: null });
    }),

    // #318: limit() is now called on breakdown queries
    limit: vi.fn().mockImplementation(function () {
      return Promise.resolve(db._breakdownResult);
    }),

    single: vi.fn().mockImplementation(function () {
      // single() is always terminal — override _resolveWith
      return Promise.resolve(db._singleResult);
    }),

    // Reset the range call counter (called in beforeEach)
    _resetRangeCount() {
      _rangeCallCount = 0;
    },
  };
  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RevenueService', () => {
  let mockDb: ReturnType<typeof makeDb>;
  let mockCache: ReturnType<typeof makeCache>;
  let mockLogger: ReturnType<typeof makeLogger>;
  let service: RevenueService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = makeLogger();
    mockCache = makeCache();
    mockDb = makeDb();
    mockDb._resetRangeCount();
    service = new RevenueService(mockDb as any, mockCache as any, mockLogger as any);
  });

  // =========================================================================
  // getRevenueBreakdown
  // =========================================================================

  describe('getRevenueBreakdown', () => {
    beforeEach(() => {
      mockDb._mode = 'breakdown';
    });

    it('returns cached result without hitting the database on cache hit', async () => {
      const cached = [{ source: 'tips', totalSats: 1000, percentage: 100 }];
      mockCache.get.mockResolvedValue(cached);

      const result = await service.getRevenueBreakdown('creator-1');

      expect(result).toEqual(cached);
      expect(mockDb.from).not.toHaveBeenCalled();
    });

    it('aggregates revenue by source and calculates percentages correctly', async () => {
      mockDb._breakdownResult = {
        data: [
          { source: 'subscriptions', amount_sats: 700000 },
          { source: 'subscriptions', amount_sats: 300000 },
          { source: 'tips', amount_sats: 200000 },
          { source: 'sponsorships', amount_sats: 500000 },
        ],
        error: null,
      };

      const result = await service.getRevenueBreakdown('creator-1');

      const subs = result.find((r) => r.source === 'subscriptions');
      const tips = result.find((r) => r.source === 'tips');
      const sponsors = result.find((r) => r.source === 'sponsorships');

      // Grand total = 1700000
      expect(subs?.totalSats).toBe(1000000);
      expect(subs?.percentage).toBeCloseTo(58.82, 1);
      expect(tips?.totalSats).toBe(200000);
      expect(tips?.percentage).toBeCloseTo(11.76, 1);
      expect(sponsors?.totalSats).toBe(500000);
      expect(sponsors?.percentage).toBeCloseTo(29.41, 1);
    });

    it('returns empty array when there are no revenue entries', async () => {
      mockDb._breakdownResult = { data: [], error: null };

      const result = await service.getRevenueBreakdown('creator-1');

      expect(result).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      mockDb._breakdownResult = { data: null, error: null };

      const result = await service.getRevenueBreakdown('creator-1');

      expect(result).toEqual([]);
    });

    it('populates the cache after a successful database fetch', async () => {
      mockDb._breakdownResult = {
        data: [{ source: 'tips', amount_sats: 5000 }],
        error: null,
      };

      await service.getRevenueBreakdown('creator-1');

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('revenue:breakdown:creator-1'),
        expect.any(Array),
        expect.any(Number)
      );
    });

    it('sets percentage to 0 when grandTotal is 0 (all zero-amount entries)', async () => {
      mockDb._breakdownResult = {
        data: [{ source: 'tips', amount_sats: 0 }],
        error: null,
      };

      const result = await service.getRevenueBreakdown('creator-1');

      const tips = result.find((r) => r.source === 'tips');
      expect(tips?.percentage).toBe(0);
    });

    it('applies gte start-date filter when period.start is provided', async () => {
      mockDb._breakdownResult = { data: [], error: null };

      await service.getRevenueBreakdown('creator-1', { start: '2026-01-01', end: '2026-03-31' });

      expect(mockDb.gte).toHaveBeenCalledWith('recorded_at', '2026-01-01');
    });

    it('applies lte end-date filter when period.end is provided', async () => {
      mockDb._breakdownResult = { data: [], error: null };

      await service.getRevenueBreakdown('creator-1', { start: '2026-01-01', end: '2026-03-31' });

      expect(mockDb.lte).toHaveBeenCalledWith('recorded_at', '2026-03-31');
    });

    it('includes start/end in the cache key when period is provided', async () => {
      mockDb._breakdownResult = { data: [], error: null };

      await service.getRevenueBreakdown('creator-1', { start: '2026-01-01', end: '2026-03-31' });

      expect(mockCache.get).toHaveBeenCalledWith(expect.stringContaining('2026-01-01'));
    });

    it('throws when the database returns an error', async () => {
      const dbError = { message: 'Row-level security violation' };
      mockDb._breakdownResult = { data: null, error: dbError };

      await expect(service.getRevenueBreakdown('creator-1')).rejects.toThrow(
        'Failed to fetch revenue breakdown'
      );
    });

    it('queries the revenue_entries table with source and amount_sats columns', async () => {
      mockDb._breakdownResult = { data: [], error: null };

      await service.getRevenueBreakdown('creator-1');

      expect(mockDb.from).toHaveBeenCalledWith('revenue_entries');
      expect(mockDb.select).toHaveBeenCalledWith('source, amount_sats');
    });
  });

  // =========================================================================
  // getConcentrationRisk
  // =========================================================================

  describe('getConcentrationRisk', () => {
    beforeEach(() => {
      mockDb._mode = 'breakdown';
    });

    it('returns riskLevel=high when dominant source is >50% of total', async () => {
      mockDb._breakdownResult = {
        data: [
          { source: 'subscriptions', amount_sats: 800000 },
          { source: 'tips', amount_sats: 200000 },
        ],
        error: null,
      };

      const risk = await service.getConcentrationRisk('creator-1');

      expect(risk.riskLevel).toBe('high');
      expect(risk.dominantSource).toBe('subscriptions');
      expect(risk.percentage).toBeCloseTo(80, 0);
      expect(risk.suggestions.some((s) => s.includes('subscriptions'))).toBe(true);
    });

    it('returns riskLevel=medium when dominant source is between 35% and 50%', async () => {
      mockDb._breakdownResult = {
        data: [
          { source: 'subscriptions', amount_sats: 400000 },
          { source: 'tips', amount_sats: 300000 },
          { source: 'sponsorships', amount_sats: 300000 },
        ],
        error: null,
      };

      const risk = await service.getConcentrationRisk('creator-1');

      expect(risk.riskLevel).toBe('medium');
      expect(risk.dominantSource).toBe('subscriptions');
    });

    it('returns riskLevel=low when no source exceeds 35%', async () => {
      mockDb._breakdownResult = {
        data: [
          { source: 'subscriptions', amount_sats: 300000 },
          { source: 'tips', amount_sats: 350000 },
          { source: 'sponsorships', amount_sats: 350000 },
        ],
        error: null,
      };

      const risk = await service.getConcentrationRisk('creator-1');

      expect(risk.riskLevel).toBe('low');
      expect(risk.suggestions[0]).toMatch(/well-diversified/i);
    });

    it('returns riskLevel=unknown when there are no revenue entries', async () => {
      mockDb._breakdownResult = { data: [], error: null };

      const risk = await service.getConcentrationRisk('creator-1');

      expect(risk.riskLevel).toBe('unknown');
      expect(risk.dominantSource).toBe('none');
      expect(risk.percentage).toBe(0);
      expect(risk.suggestions.length).toBeGreaterThan(0);
    });

    it('correctly identifies the dominant source as highest-sats source', async () => {
      mockDb._breakdownResult = {
        data: [
          { source: 'affiliate', amount_sats: 100000 },
          { source: 'marketplace', amount_sats: 900000 },
        ],
        error: null,
      };

      const risk = await service.getConcentrationRisk('creator-1');

      expect(risk.dominantSource).toBe('marketplace');
    });

    it('boundary: exactly 50% concentration is classified as medium (threshold is >50%)', async () => {
      mockDb._breakdownResult = {
        data: [
          { source: 'subscriptions', amount_sats: 500000 },
          { source: 'tips', amount_sats: 500000 },
        ],
        error: null,
      };

      const risk = await service.getConcentrationRisk('creator-1');

      // 50% is NOT > 0.50, so medium
      expect(risk.riskLevel).toBe('medium');
    });

    it('boundary: 51% concentration is high risk (> 0.50 threshold)', async () => {
      mockDb._breakdownResult = {
        data: [
          { source: 'subscriptions', amount_sats: 510000 },
          { source: 'tips', amount_sats: 490000 },
        ],
        error: null,
      };

      const risk = await service.getConcentrationRisk('creator-1');

      expect(risk.riskLevel).toBe('high');
    });

    it('boundary: exactly 35% concentration is low (threshold > 0.35 for medium)', async () => {
      mockDb._breakdownResult = {
        data: [
          { source: 'subscriptions', amount_sats: 350000 },
          { source: 'tips', amount_sats: 350000 },
          { source: 'sponsorships', amount_sats: 300000 },
        ],
        error: null,
      };

      const risk = await service.getConcentrationRisk('creator-1');

      expect(risk.riskLevel).toBe('low');
    });

    it('includes diversification suggestions for high-risk portfolio', async () => {
      mockDb._breakdownResult = {
        data: [
          { source: 'subscriptions', amount_sats: 900000 },
          { source: 'tips', amount_sats: 100000 },
        ],
        error: null,
      };

      const risk = await service.getConcentrationRisk('creator-1');

      expect(risk.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(risk.suggestions.some((s) => s.match(/sponsor|service|affiliate/i))).toBe(true);
    });

    it('uses cached breakdown data when available (no extra DB call)', async () => {
      const cached = [
        { source: 'subscriptions', totalSats: 800000, percentage: 80 },
        { source: 'tips', totalSats: 200000, percentage: 20 },
      ];
      mockCache.get.mockResolvedValue(cached);

      const risk = await service.getConcentrationRisk('creator-1');

      expect(risk.riskLevel).toBe('high');
      expect(mockDb.from).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // getDiversificationGoals
  // =========================================================================

  describe('getDiversificationGoals', () => {
    beforeEach(() => {
      mockDb._mode = 'single';
    });

    it('returns the goals when found', async () => {
      const goals = {
        creator_id: 'creator-1',
        target_distribution: { subscriptions: 40, tips: 30, sponsorships: 30 },
      };
      mockDb._singleResult = { data: goals, error: null };

      const result = await service.getDiversificationGoals('creator-1');

      expect(result).toEqual(goals);
      expect(mockDb.from).toHaveBeenCalledWith('diversification_goals');
    });

    it('returns null when no goals exist (PGRST116 "no rows" error)', async () => {
      mockDb._singleResult = { data: null, error: { code: 'PGRST116', message: 'No rows' } };

      const result = await service.getDiversificationGoals('creator-1');

      expect(result).toBeNull();
    });

    it('returns null when data is null and error is null', async () => {
      mockDb._singleResult = { data: null, error: null };

      const result = await service.getDiversificationGoals('creator-1');

      expect(result).toBeNull();
    });

    it('throws for any database error other than PGRST116', async () => {
      const dbError = { code: '42501', message: 'Permission denied' };
      mockDb._singleResult = { data: null, error: dbError };

      await expect(service.getDiversificationGoals('creator-1')).rejects.toThrow(
        'Failed to fetch diversification goals'
      );
    });
  });

  // =========================================================================
  // setDiversificationGoals
  // =========================================================================

  describe('setDiversificationGoals', () => {
    beforeEach(() => {
      mockDb._mode = 'upsert';
    });

    it('throws when targets sum to less than 100', async () => {
      await expect(
        service.setDiversificationGoals('creator-1', { subscriptions: 50, tips: 30 })
      ).rejects.toThrow('sum to 100');
    });

    it('throws when targets sum to more than 100', async () => {
      await expect(
        service.setDiversificationGoals('creator-1', {
          subscriptions: 50,
          tips: 30,
          sponsorships: 30,
        })
      ).rejects.toThrow('sum to 100');
    });

    it('accepts targets that sum to exactly 100', async () => {
      mockDb._upsertResult = { error: null };

      await expect(
        service.setDiversificationGoals('creator-1', {
          subscriptions: 40,
          tips: 30,
          sponsorships: 30,
        })
      ).resolves.not.toThrow();
    });

    it('accepts targets within floating-point tolerance (33.333 + 33.333 + 33.334 = 100.000)', async () => {
      mockDb._upsertResult = { error: null };

      await expect(
        service.setDiversificationGoals('creator-1', { a: 33.333, b: 33.333, c: 33.334 })
      ).resolves.not.toThrow();
    });

    it('upserts with creator_id, target_distribution, and updated_at', async () => {
      mockDb._upsertResult = { error: null };

      await service.setDiversificationGoals('creator-1', { subscriptions: 60, tips: 40 });

      expect(mockDb.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 'creator-1',
          target_distribution: { subscriptions: 60, tips: 40 },
          updated_at: expect.any(String),
        }),
        expect.objectContaining({ onConflict: 'creator_id' })
      );
    });

    it('invalidates the revenue breakdown cache for the creator', async () => {
      mockDb._upsertResult = { error: null };

      await service.setDiversificationGoals('creator-1', { subscriptions: 60, tips: 40 });

      expect(mockCache.invalidate).toHaveBeenCalledWith(expect.stringContaining('creator-1'));
    });

    it('throws a sanitized error when upsert fails', async () => {
      const dbError = { message: 'Constraint violation' };
      mockDb._upsertResult = { error: dbError };

      await expect(
        service.setDiversificationGoals('creator-1', { subscriptions: 60, tips: 40 })
      ).rejects.toThrow('Failed to set diversification goals');
    });
  });

  // =========================================================================
  // recordRevenue
  // =========================================================================

  describe('recordRevenue', () => {
    beforeEach(() => {
      mockDb._mode = 'single';
    });

    it('throws when amountSats is 0', async () => {
      await expect(
        service.recordRevenue('creator-1', { source: 'tips', amountSats: 0 })
      ).rejects.toThrow('Revenue amount must be greater than 0 sats');
    });

    it('throws when amountSats is negative', async () => {
      await expect(
        service.recordRevenue('creator-1', { source: 'tips', amountSats: -100 })
      ).rejects.toThrow('Revenue amount must be greater than 0 sats');
    });

    it('inserts the revenue entry and returns the generated id', async () => {
      mockDb._singleResult = { data: { id: 'rev-1' }, error: null };

      const result = await service.recordRevenue('creator-1', {
        source: 'tips',
        amountSats: 10000,
      });

      expect(result).toEqual({ id: 'rev-1' });
      expect(mockDb.from).toHaveBeenCalledWith('revenue_entries');
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 'creator-1',
          source: 'tips',
          amount_sats: 10000,
        })
      );
    });

    it('includes description in the row when provided', async () => {
      mockDb._singleResult = { data: { id: 'rev-2' }, error: null };

      await service.recordRevenue('creator-1', {
        source: 'tips',
        amountSats: 5000,
        description: 'Super chat from fan',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Super chat from fan' })
      );
    });

    it('omits description from the row when not provided', async () => {
      mockDb._singleResult = { data: { id: 'rev-3' }, error: null };

      await service.recordRevenue('creator-1', { source: 'tips', amountSats: 5000 });

      const insertArg = mockDb.insert.mock.calls[0][0];
      expect(insertArg).not.toHaveProperty('description');
    });

    it('invalidates the revenue breakdown cache after recording', async () => {
      mockDb._singleResult = { data: { id: 'rev-4' }, error: null };

      await service.recordRevenue('creator-1', { source: 'tips', amountSats: 1000 });

      expect(mockCache.invalidate).toHaveBeenCalledWith(expect.stringContaining('creator-1'));
    });

    it('throws "Failed to record revenue entry" when insert returns null data', async () => {
      mockDb._singleResult = { data: null, error: null };

      await expect(
        service.recordRevenue('creator-1', { source: 'tips', amountSats: 1000 })
      ).rejects.toThrow('Failed to record revenue entry');
    });

    it('throws a sanitized error when insert fails', async () => {
      const dbError = { message: 'Foreign key violation', code: '23503' };
      mockDb._singleResult = { data: null, error: dbError };

      await expect(
        service.recordRevenue('creator-1', { source: 'tips', amountSats: 1000 })
      ).rejects.toThrow('Failed to record revenue entry');
    });

    it('accepts all defined revenue source types without error', async () => {
      const sources = [
        'subscriptions',
        'tips',
        'sponsorships',
        'services',
        'affiliate',
        'marketplace',
        'other',
      ];

      for (const source of sources) {
        vi.clearAllMocks();
        mockDb._singleResult = { data: { id: `rev-${source}` }, error: null };

        await expect(
          service.recordRevenue('creator-1', { source, amountSats: 1000 })
        ).resolves.not.toThrow();
      }
    });
  });
});
