/**
 * BoundaryService Unit Tests
 * Tests focus hours, DND, auto-responses, availability
 * EPIC-007: Creator Wellness System (US-E7-007)
 */

import { BoundaryService } from '../BoundaryService';
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

describe('BoundaryService', () => {
  let service: BoundaryService;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  describe('getBoundaries', () => {
    it('returns defaults when no row exists (PGRST116)', async () => {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new BoundaryService(mockDb, mockLogger);
      const result = await service.getBoundaries('creator-1');

      expect(result.focus_hours.enabled).toBe(false);
      expect(result.focus_hours.start).toBe('22:00');
      expect(result.focus_hours.end).toBe('08:00');
      expect(result.focus_hours.timezone).toBe('UTC');
      expect(result.focus_hours.days).toEqual([]);
      expect(result.weekly_engagement_budget_mins).toBe(0);
      expect(result.engagement_used_mins).toBe(0);
      expect(result.dnd_mode.active).toBe(false);
      expect(result.dnd_mode.auto_response_enabled).toBe(false);
      expect(result.dnd_mode.auto_response_template).toBe('');
      expect(result.availability_status).toBe('hidden');
      expect(result.availability_public).toBe(false);
      expect(result.notification_batching).toBe(false);
    });

    it('maps database row to CreatorBoundaries', async () => {
      const dbRow = {
        creator_id: 'creator-1',
        focus_hours_enabled: true,
        focus_hours_start: '09:00',
        focus_hours_end: '17:00',
        focus_hours_timezone: 'America/New_York',
        focus_hours_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        weekly_engagement_budget_mins: 120,
        dnd_active: true,
        auto_response_enabled: true,
        auto_response_template: 'I am currently in focus mode.',
        availability_status: 'available',
        availability_public: true,
        notification_batching: true,
      };

      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbRow, error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new BoundaryService(mockDb, mockLogger);
      const result = await service.getBoundaries('creator-1');

      expect(result.focus_hours.enabled).toBe(true);
      expect(result.focus_hours.start).toBe('09:00');
      expect(result.focus_hours.end).toBe('17:00');
      expect(result.focus_hours.timezone).toBe('America/New_York');
      expect(result.focus_hours.days).toEqual([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
      ]);
      expect(result.weekly_engagement_budget_mins).toBe(120);
      expect(result.engagement_used_mins).toBe(0); // Always calculated
      expect(result.dnd_mode.active).toBe(true);
      expect(result.dnd_mode.auto_response_enabled).toBe(true);
      expect(result.dnd_mode.auto_response_template).toBe('I am currently in focus mode.');
      expect(result.availability_status).toBe('available');
      expect(result.availability_public).toBe(true);
      expect(result.notification_batching).toBe(true);
    });

    it('throws on non-PGRST116 database error', async () => {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST500', message: 'Internal error' },
        }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new BoundaryService(mockDb, mockLogger);

      await expect(service.getBoundaries('creator-1')).rejects.toEqual({
        code: 'PGRST500',
        message: 'Internal error',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get boundaries',
        expect.objectContaining({ creatorId: 'creator-1' })
      );
    });

    it('handles null/missing fields with safe defaults', async () => {
      // Row with minimal data — all optional fields null
      const dbRow = {
        creator_id: 'creator-1',
      };

      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbRow, error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new BoundaryService(mockDb, mockLogger);
      const result = await service.getBoundaries('creator-1');

      // Should return safe defaults for all missing fields
      expect(result.focus_hours.enabled).toBe(false);
      expect(result.focus_hours.start).toBe('22:00');
      expect(result.focus_hours.end).toBe('08:00');
      expect(result.focus_hours.timezone).toBe('UTC');
      expect(result.focus_hours.days).toEqual([]);
      expect(result.weekly_engagement_budget_mins).toBe(0);
      expect(result.dnd_mode.active).toBe(false);
      expect(result.availability_status).toBe('hidden');
      expect(result.notification_batching).toBe(false);
    });
  });

  describe('updateBoundaries', () => {
    it('upserts full boundary settings and returns mapped result', async () => {
      const returnedRow = {
        creator_id: 'creator-1',
        focus_hours_enabled: true,
        focus_hours_start: '09:00',
        focus_hours_end: '12:00',
        focus_hours_timezone: 'UTC',
        focus_hours_days: ['Monday', 'Wednesday', 'Friday'],
        weekly_engagement_budget_mins: 60,
        dnd_active: false,
        auto_response_enabled: true,
        auto_response_template: 'Be back soon!',
        availability_status: 'busy',
        availability_public: false,
        notification_batching: true,
      };

      const chainable = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: returnedRow, error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new BoundaryService(mockDb, mockLogger);
      const result = await service.updateBoundaries('creator-1', {
        focus_hours: {
          enabled: true,
          start: '09:00',
          end: '12:00',
          timezone: 'UTC',
          days: ['Monday', 'Wednesday', 'Friday'],
        },
        weekly_engagement_budget_mins: 60,
        dnd_mode: {
          auto_response_enabled: true,
          auto_response_template: 'Be back soon!',
        },
        availability_status: 'busy',
        notification_batching: true,
      });

      expect(result.focus_hours.enabled).toBe(true);
      expect(result.focus_hours.start).toBe('09:00');
      expect(result.focus_hours.end).toBe('12:00');
      expect(result.availability_status).toBe('busy');
      expect(result.notification_batching).toBe(true);

      // Verify upsert was called with onConflict
      expect(chainable.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 'creator-1',
          focus_hours_enabled: true,
          focus_hours_start: '09:00',
          focus_hours_end: '12:00',
          focus_hours_timezone: 'UTC',
          focus_hours_days: ['Monday', 'Wednesday', 'Friday'],
          weekly_engagement_budget_mins: 60,
          auto_response_enabled: true,
          auto_response_template: 'Be back soon!',
          availability_status: 'busy',
          notification_batching: true,
        }),
        { onConflict: 'creator_id' }
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Boundaries updated', {
        creatorId: 'creator-1',
      });
    });

    it('handles partial updates (only focus_hours)', async () => {
      const returnedRow = {
        creator_id: 'creator-1',
        focus_hours_enabled: true,
        focus_hours_start: '10:00',
        focus_hours_end: '14:00',
        focus_hours_timezone: 'Europe/London',
        focus_hours_days: ['Saturday'],
      };

      const chainable = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: returnedRow, error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new BoundaryService(mockDb, mockLogger);
      await service.updateBoundaries('creator-1', {
        focus_hours: {
          enabled: true,
          start: '10:00',
          end: '14:00',
          timezone: 'Europe/London',
          days: ['Saturday'],
        },
      });

      // Payload should NOT include dnd_mode or availability fields
      const upsertCall = chainable.upsert.mock.calls[0][0];
      expect(upsertCall.focus_hours_enabled).toBe(true);
      expect(upsertCall.focus_hours_start).toBe('10:00');
      expect(upsertCall).not.toHaveProperty('auto_response_enabled');
      expect(upsertCall).not.toHaveProperty('availability_status');
      expect(upsertCall).not.toHaveProperty('notification_batching');
    });

    it('handles partial updates (only dnd_mode)', async () => {
      const returnedRow = {
        creator_id: 'creator-1',
        auto_response_enabled: false,
        auto_response_template: '',
      };

      const chainable = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: returnedRow, error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new BoundaryService(mockDb, mockLogger);
      await service.updateBoundaries('creator-1', {
        dnd_mode: {
          auto_response_enabled: false,
          auto_response_template: '',
        },
      });

      const upsertCall = chainable.upsert.mock.calls[0][0];
      expect(upsertCall.auto_response_enabled).toBe(false);
      expect(upsertCall.auto_response_template).toBe('');
      expect(upsertCall).not.toHaveProperty('focus_hours_enabled');
    });

    it('throws on database error during upsert', async () => {
      const chainable = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Constraint violation' },
        }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new BoundaryService(mockDb, mockLogger);

      await expect(
        service.updateBoundaries('creator-1', {
          availability_status: 'available',
        })
      ).rejects.toEqual({ message: 'Constraint violation' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update boundaries',
        expect.objectContaining({ creatorId: 'creator-1' })
      );
    });

    it('always includes creator_id and updated_at in payload', async () => {
      const returnedRow = { creator_id: 'creator-1' };

      const chainable = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: returnedRow, error: null }),
      };

      const mockDb = {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
      } as unknown as ISupabaseClient;

      service = new BoundaryService(mockDb, mockLogger);
      await service.updateBoundaries('creator-1', {
        notification_batching: true,
      });

      const upsertCall = chainable.upsert.mock.calls[0][0];
      expect(upsertCall.creator_id).toBe('creator-1');
      expect(upsertCall.updated_at).toBeTruthy();
      expect(upsertCall.notification_batching).toBe(true);
    });
  });
});
