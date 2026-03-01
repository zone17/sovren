/**
 * WellnessService Unit Tests
 * Tests work pattern CRUD, pulse check-ins, benchmarks, and data deletion.
 * EPIC-007: Creator Wellness System (US-E7-001, US-E7-002, US-E7-007)
 */

import { WellnessService } from '../WellnessService';
import type { ISupabaseClient } from '../../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../../interfaces/shared/ILogger';

// --- Mock helpers ---

function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as ILogger;
}

function createMockDb(overrides: Record<string, any> = {}): ISupabaseClient {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };

  return {
    from: vi.fn(() => chainable),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  } as unknown as ISupabaseClient;
}

describe('WellnessService', () => {
  let service: WellnessService;
  let mockDb: ISupabaseClient;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  describe('recordWorkPattern', () => {
    it('calls upsert_work_pattern RPC and returns work pattern', async () => {
      const rpcResult = {
        id: 'uuid-1',
        created_at: '2026-02-15T10:00:00Z',
      };
      mockDb = {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({ data: [rpcResult], error: null }),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.recordWorkPattern('creator-1', {
        type: 'content_creation',
        duration_mins: 45,
        timestamp: '2026-02-15T10:00:00Z',
      });

      expect(mockDb.rpc).toHaveBeenCalledWith('upsert_work_pattern', {
        p_creator_id: 'creator-1',
        p_date: '2026-02-15',
        p_content_time_mins: 45,
        p_engagement_time_mins: 0,
        p_management_time_mins: 0,
        p_post_count: 1,
        p_activity_at: '2026-02-15T10:00:00Z',
      });

      expect(result).toEqual({
        id: 'uuid-1',
        creator_id: 'creator-1',
        type: 'content_creation',
        duration_mins: 45,
        timestamp: '2026-02-15T10:00:00Z',
        metadata: undefined,
        created_at: '2026-02-15T10:00:00Z',
      });
    });

    it('sets engagement_time_mins for engagement type', async () => {
      mockDb = {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({
          data: [{ id: 'uuid-2', created_at: '2026-02-15T10:00:00Z' }],
          error: null,
        }),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      await service.recordWorkPattern('creator-1', {
        type: 'engagement',
        duration_mins: 30,
        timestamp: '2026-02-15T12:00:00Z',
      });

      expect(mockDb.rpc).toHaveBeenCalledWith(
        'upsert_work_pattern',
        expect.objectContaining({
          p_content_time_mins: 0,
          p_engagement_time_mins: 30,
          p_management_time_mins: 0,
          p_post_count: 0,
        })
      );
    });

    it('sets management_time_mins for management type', async () => {
      mockDb = {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({
          data: [{ id: 'uuid-3', created_at: '2026-02-15T10:00:00Z' }],
          error: null,
        }),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      await service.recordWorkPattern('creator-1', {
        type: 'management',
        duration_mins: 20,
        timestamp: '2026-02-15T14:00:00Z',
      });

      expect(mockDb.rpc).toHaveBeenCalledWith(
        'upsert_work_pattern',
        expect.objectContaining({
          p_content_time_mins: 0,
          p_engagement_time_mins: 0,
          p_management_time_mins: 20,
          p_post_count: 0,
        })
      );
    });

    it('throws and logs on RPC error', async () => {
      const dbError = { message: 'Database error', code: '42P01' };
      mockDb = {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      await expect(
        service.recordWorkPattern('creator-1', {
          type: 'content_creation',
          duration_mins: 45,
          timestamp: '2026-02-15T10:00:00Z',
        })
      ).rejects.toEqual(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record work pattern',
        expect.objectContaining({ creatorId: 'creator-1' })
      );
    });
  });

  describe('getWorkPatterns', () => {
    it('returns aggregated work patterns for 7d period', async () => {
      const patterns = [
        {
          date: '2026-02-08',
          content_time_mins: 120,
          engagement_time_mins: 60,
          management_time_mins: 30,
          total_hours: '3.5',
        },
        {
          date: '2026-02-09',
          content_time_mins: 90,
          engagement_time_mins: 45,
          management_time_mins: 15,
          total_hours: '2.5',
        },
        {
          date: '2026-02-10',
          content_time_mins: 150,
          engagement_time_mins: 30,
          management_time_mins: 60,
          total_hours: '4.0',
        },
      ];

      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: patterns, error: null }),
      };

      // Second query (count) — returned via Promise.allSettled
      const countChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 20 }),
      };

      let callCount = 0;
      mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? chainable : countChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getWorkPatterns('creator-1', '7d');

      expect(result.period).toBe('7d');
      expect(result.total_hours).toBeGreaterThan(0);
      expect(result.daily).toHaveLength(3);
      expect(result.rest_days).toBe(4); // 7 - 3 active days
      expect(result.baseline_established).toBe(true); // 20 >= 14
      expect(result.breakdown.content_creation.hours).toBeGreaterThan(0);
      expect(result.breakdown.engagement.hours).toBeGreaterThan(0);
      expect(result.breakdown.management.hours).toBeGreaterThan(0);
    });

    it('returns baseline_established=false when fewer than 14 days of data', async () => {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const countChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 5 }),
      };

      let callCount = 0;
      mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? chainable : countChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getWorkPatterns('creator-1', '30d');

      expect(result.baseline_established).toBe(false);
      expect(result.total_hours).toBe(0);
    });

    it('throws on database error', async () => {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } }),
      };

      const countChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 0 }),
      };

      let callCount = 0;
      mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? chainable : countChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      await expect(service.getWorkPatterns('creator-1', '7d')).rejects.toEqual({
        message: 'Query failed',
      });
    });
  });

  describe('getHeatmap', () => {
    it('returns heatmap data with intensity normalization', async () => {
      const patterns = [
        {
          date: '2026-02-10', // Monday
          content_time_mins: 120,
          engagement_time_mins: 60,
          management_time_mins: 0,
          first_activity_at: '2026-02-10T09:00:00Z',
          last_activity_at: '2026-02-10T14:00:00Z',
        },
      ];

      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: patterns, error: null }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getHeatmap('creator-1', '7d');

      expect(result.period).toBe('7d');
      expect(result.heatmap.length).toBeGreaterThan(0);
      // Intensities should be between 0 and 1
      result.heatmap.forEach((entry) => {
        expect(entry.intensity).toBeGreaterThanOrEqual(0);
        expect(entry.intensity).toBeLessThanOrEqual(1);
        expect(entry.day).toBeGreaterThanOrEqual(0);
        expect(entry.day).toBeLessThanOrEqual(6);
        expect(entry.hour).toBeGreaterThanOrEqual(0);
        expect(entry.hour).toBeLessThanOrEqual(23);
      });
      // Max intensity should be 1.0
      const maxIntensity = Math.max(...result.heatmap.map((e) => e.intensity));
      expect(maxIntensity).toBe(1);
    });

    it('returns empty heatmap when no data', async () => {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getHeatmap('creator-1', '30d');

      expect(result.heatmap).toEqual([]);
      expect(result.peak_hours).toEqual([]);
    });
  });

  describe('recordPulse', () => {
    it('inserts pulse and returns check-in with composite score', async () => {
      const insertedData = {
        id: 'pulse-uuid-1',
        energy: 4,
        motivation: 3,
        stress: 2,
        composite_score: '3.67',
        created_at: '2026-02-15T10:00:00Z',
      };

      const chainable = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: insertedData, error: null }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.recordPulse('creator-1', {
        energy: 4,
        motivation: 3,
        stress: 2,
      });

      expect(result.id).toBe('pulse-uuid-1');
      expect(result.energy).toBe(4);
      expect(result.motivation).toBe(3);
      expect(result.stress).toBe(2);
      expect(result.composite_score).toBeCloseTo(3.67, 1);
    });

    it('calculates correct composite score: (energy + motivation + (6 - stress)) / 3', async () => {
      // Test case: energy=5, motivation=5, stress=1 → (5+5+5)/3 = 5.0
      const insertedData = {
        id: 'p-2',
        energy: 5,
        motivation: 5,
        stress: 1,
        composite_score: '5.00',
        created_at: '2026-02-15T10:00:00Z',
      };

      const chainable = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: insertedData, error: null }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.recordPulse('creator-1', {
        energy: 5,
        motivation: 5,
        stress: 1,
      });

      expect(result.composite_score).toBeCloseTo(5.0, 1);
    });

    it('throws on insert error', async () => {
      const chainable = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      await expect(
        service.recordPulse('creator-1', { energy: 3, motivation: 3, stress: 3 })
      ).rejects.toEqual({ message: 'Insert failed' });
    });
  });

  describe('getPulseHistory', () => {
    it('returns pulse history with trend calculation', async () => {
      const entries = [
        {
          id: 'p1',
          energy: 4,
          motivation: 4,
          stress: 2,
          composite_score: '4.00',
          created_at: '2026-02-14T10:00:00Z',
        },
        {
          id: 'p2',
          energy: 3,
          motivation: 3,
          stress: 3,
          composite_score: '3.00',
          created_at: '2026-02-13T10:00:00Z',
        },
        {
          id: 'p3',
          energy: 2,
          motivation: 2,
          stress: 4,
          composite_score: '2.00',
          created_at: '2026-02-12T10:00:00Z',
        },
        {
          id: 'p4',
          energy: 3,
          motivation: 3,
          stress: 3,
          composite_score: '3.00',
          created_at: '2026-02-11T10:00:00Z',
        },
      ];

      const dataChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: entries, error: null }),
      };

      const countChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ count: 4 }),
      };

      let callCount = 0;
      mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? countChainable : dataChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getPulseHistory('creator-1', '30d', 50, 0);

      expect(result.entries).toHaveLength(4);
      expect(result.total).toBe(4);
      expect(result.trend.average_composite).toBeCloseTo(3.0, 1);
      expect(['improving', 'declining', 'stable']).toContain(result.trend.direction);
    });

    it('returns stable trend with fewer than 4 entries', async () => {
      const entries = [
        {
          id: 'p1',
          energy: 3,
          motivation: 3,
          stress: 3,
          composite_score: '3.00',
          created_at: '2026-02-14T10:00:00Z',
        },
      ];

      const dataChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: entries, error: null }),
      };

      const countChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ count: 1 }),
      };

      let callCount = 0;
      mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? countChainable : dataChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getPulseHistory('creator-1', '30d');

      expect(result.trend.direction).toBe('stable');
      expect(result.trend.change_from_previous_period).toBe(0);
    });

    it('enforces limit bounds (max 200)', async () => {
      const dataChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const countChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ count: 0 }),
      };

      let callCount = 0;
      mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? countChainable : dataChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getPulseHistory('creator-1', 'all', 999, 0);

      // Should cap at 200
      expect(result.limit).toBe(200);
    });
  });

  describe('deletePulseHistory', () => {
    it('returns deleted count', async () => {
      const chainable = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 15, error: null }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const count = await service.deletePulseHistory('creator-1');
      expect(count).toBe(15);
    });

    it('throws on delete error', async () => {
      const chainable = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'Delete failed' } }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      await expect(service.deletePulseHistory('creator-1')).rejects.toEqual({
        message: 'Delete failed',
      });
    });
  });

  describe('deleteAllWellnessData', () => {
    it('calls atomic RPC and returns per-table counts', async () => {
      const rpcResult = {
        wellness_snapshots: 52,
        creator_work_patterns: 365,
        burnout_risk_history: 12,
        creator_boundaries: 1,
      };

      mockDb = {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.deleteAllWellnessData('creator-1');

      expect(mockDb.rpc).toHaveBeenCalledWith('delete_all_wellness_data', {
        p_creator_id: 'creator-1',
      });
      expect(result).toEqual(rpcResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Atomically deleted all wellness data',
        expect.objectContaining({ creatorId: 'creator-1' })
      );
    });

    it('throws descriptive GDPR error on failure', async () => {
      mockDb = {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'Transaction failed' } }),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      await expect(service.deleteAllWellnessData('creator-1')).rejects.toThrow(
        /GDPR deletion failed.*No data was deleted/
      );
    });
  });

  describe('getBenchmark', () => {
    it('returns null when sample size below 10', async () => {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            sample_size: 5,
            avg_weekly_hours: '30.0',
            p25_hours: '20.0',
            p50_hours: '30.0',
            p75_hours: '40.0',
          },
          error: null,
        }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getBenchmark();
      expect(result).toBeNull();
    });

    it('returns benchmark data when sufficient participants', async () => {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            sample_size: 150,
            avg_weekly_hours: '32.5',
            p25_hours: '20.0',
            p50_hours: '30.0',
            p75_hours: '40.0',
          },
          error: null,
        }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              sample_count: 150,
              avg_score: '3.5',
              p25_score: '2.8',
              p50_score: '3.5',
              p75_score: '4.2',
            },
          ],
          error: null,
        }),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getBenchmark();

      expect(result).not.toBeNull();
      expect(result!.sample_size).toBe(150);
      expect(result!.average_weekly_hours).toBeCloseTo(32.5, 1);
      expect(result!.percentile_breakdowns.work_hours.p25).toBeCloseTo(20.0, 1);
      expect(result!.percentile_breakdowns.work_hours.p50).toBeCloseTo(30.0, 1);
      expect(result!.percentile_breakdowns.composite_score.p50).toBeCloseTo(3.5, 1);
    });

    it('returns null when materialized view has no data', async () => {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new WellnessService(mockDb, mockLogger);

      const result = await service.getBenchmark();
      expect(result).toBeNull();
    });
  });
});
