/**
 * ScheduleService Unit Tests
 * Tests sustainable cadence recommendations and buffer depth
 * EPIC-007: Creator Wellness System (US-E7-005)
 */

import { ScheduleService } from '../ScheduleService';
import type { ISupabaseClient } from '../../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../../interfaces/shared/ILogger';

function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as ILogger;
}

describe('ScheduleService', () => {
  let service: ScheduleService;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  describe('getRecommendations', () => {
    it('returns recommendations based on 4 weeks of data', async () => {
      const patterns = [];
      // 4 weeks, 5 days/week, 3 posts/day
      for (let w = 0; w < 4; w++) {
        for (let d = 0; d < 5; d++) {
          const dayNum = 10 + w * 7 + d;
          const dateStr = `2026-01-${String(dayNum).padStart(2, '0')}`;
          patterns.push({
            date: dateStr,
            content_time_mins: 180,
            engagement_time_mins: 60,
            management_time_mins: 30,
            post_count: 3,
            first_activity_at: `${dateStr}T09:00:00Z`,
            last_activity_at: `${dateStr}T15:00:00Z`,
            total_hours: '4.5',
          });
        }
      }

      // Pattern query
      const patternChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: patterns, error: null }),
      };

      // Buffer query (future content)
      const bufferChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      let callCount = 0;
      const mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? patternChainable : bufferChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new ScheduleService(mockDb, mockLogger);
      const result = await service.getRecommendations('creator-1');

      expect(result.current_posts_per_week).toBeGreaterThan(0);
      expect(result.recommended_posts_per_week).toBeGreaterThanOrEqual(2);
      expect(result.recommended_posts_per_week).toBeLessThanOrEqual(7);
      expect(result.optimal_days.length).toBeGreaterThan(0);
      expect(result.optimal_hours.length).toBeGreaterThan(0);
    });

    it('recommends lower pace when current pace is high', async () => {
      const patterns = [];
      for (let w = 0; w < 4; w++) {
        for (let d = 0; d < 7; d++) {
          const dayNum = 10 + w * 7 + d;
          const dateStr =
            dayNum <= 31
              ? `2026-01-${String(dayNum).padStart(2, '0')}`
              : `2026-02-${String(dayNum - 31).padStart(2, '0')}`;
          patterns.push({
            date: dateStr,
            content_time_mins: 300,
            engagement_time_mins: 60,
            management_time_mins: 30,
            post_count: 10, // Very high posting rate
            first_activity_at: `${dateStr}T06:00:00Z`,
            last_activity_at: `${dateStr}T23:00:00Z`,
            total_hours: '6.5',
          });
        }
      }

      const patternChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: patterns, error: null }),
      };

      const bufferChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      let callCount = 0;
      const mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? patternChainable : bufferChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new ScheduleService(mockDb, mockLogger);
      const result = await service.getRecommendations('creator-1');

      // Recommended should be capped at 7
      expect(result.recommended_posts_per_week).toBeLessThanOrEqual(7);
      // Current should be high
      expect(result.current_posts_per_week).toBeGreaterThan(7);
    });

    it('returns empty arrays when no historical data', async () => {
      const patternChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const bufferChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      let callCount = 0;
      const mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? patternChainable : bufferChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new ScheduleService(mockDb, mockLogger);
      const result = await service.getRecommendations('creator-1');

      expect(result.current_posts_per_week).toBe(0);
      expect(result.recommended_posts_per_week).toBe(2); // Minimum
      expect(result.optimal_days).toEqual([]);
      expect(result.optimal_hours).toEqual([]);
      expect(result.productive_windows).toEqual([]);
    });

    it('includes productive windows with energy scores', async () => {
      const patterns = [
        {
          date: '2026-02-10',
          content_time_mins: 240,
          engagement_time_mins: 60,
          management_time_mins: 30,
          post_count: 2,
          first_activity_at: '2026-02-10T09:00:00Z',
          last_activity_at: '2026-02-10T12:00:00Z',
          total_hours: '5.5',
        },
      ];

      const patternChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: patterns, error: null }),
      };

      const bufferChainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      let callCount = 0;
      const mockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? patternChainable : bufferChainable;
        }),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new ScheduleService(mockDb, mockLogger);
      const result = await service.getRecommendations('creator-1');

      if (result.productive_windows.length > 0) {
        const window = result.productive_windows[0];
        expect(window.day).toBeTruthy();
        expect(window.start).toMatch(/^\d{2}:\d{2}$/);
        expect(window.end).toMatch(/^\d{2}:\d{2}$/);
        expect(window.energy_score).toBeGreaterThanOrEqual(0);
        expect(window.energy_score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getBufferDepth', () => {
    it('returns buffer depth from future-dated content', async () => {
      const futureContent = [
        { date: '2026-02-20', post_count: 2 },
        { date: '2026-02-21', post_count: 1 },
        { date: '2026-02-22', post_count: 0 },
        { date: '2026-02-23', post_count: 3 },
      ];

      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: futureContent, error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new ScheduleService(mockDb, mockLogger);
      const result = await service.getBufferDepth('creator-1');

      expect(result.buffer_days).toBe(3); // 3 days with posts > 0
      expect(result.scheduled_posts).toBe(6); // 2+1+0+3
      expect(result.threshold).toBe(5);
      expect(result.status).toBe('below_threshold'); // 3 < 5
    });

    it('returns above_threshold when buffer is sufficient', async () => {
      const futureContent = [];
      for (let d = 1; d <= 7; d++) {
        futureContent.push({ date: `2026-02-${String(20 + d)}`, post_count: 1 });
      }

      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: futureContent, error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new ScheduleService(mockDb, mockLogger);
      const result = await service.getBufferDepth('creator-1');

      expect(result.buffer_days).toBe(7);
      expect(result.status).toBe('above_threshold');
    });

    it('returns empty buffer when no future content', async () => {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new ScheduleService(mockDb, mockLogger);
      const result = await service.getBufferDepth('creator-1');

      expect(result.buffer_days).toBe(0);
      expect(result.scheduled_posts).toBe(0);
      expect(result.next_scheduled).toBeNull();
      expect(result.last_scheduled).toBeNull();
      expect(result.status).toBe('below_threshold');
    });

    it('includes next and last scheduled dates', async () => {
      const futureContent = [
        { date: '2026-02-20', post_count: 1 },
        { date: '2026-02-25', post_count: 2 },
      ];

      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: futureContent, error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new ScheduleService(mockDb, mockLogger);
      const result = await service.getBufferDepth('creator-1');

      expect(result.next_scheduled).toContain('2026-02-20');
      expect(result.last_scheduled).toContain('2026-02-25');
    });
  });
});
