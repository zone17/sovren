/**
 * BoundaryService Unit Tests
 * Tests boundary CRUD and defaults
 */

import { BoundaryService } from '../BoundaryService';

function createMockDb() {
  const mockChain: any = {};
  const methods = ['select', 'eq', 'single', 'upsert'];
  for (const method of methods) {
    mockChain[method] = jest.fn().mockReturnValue(mockChain);
  }
  return {
    from: jest.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('BoundaryService', () => {
  let service: BoundaryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new BoundaryService(mockDb as any, mockLogger);
    jest.clearAllMocks();
  });

  describe('getBoundaries', () => {
    it('should return defaults when no boundaries exist', async () => {
      mockDb._chain.single = jest.fn().mockReturnValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found
      });

      const result = await service.getBoundaries('creator-123');

      expect(result.focus_hours.enabled).toBe(false);
      expect(result.availability_status).toBe('hidden');
      expect(result.availability_public).toBe(false);
      expect(result.notification_batching).toBe(false);
      expect(result.weekly_engagement_budget_mins).toBe(0);
    });

    it('should return stored boundaries when they exist', async () => {
      mockDb._chain.single = jest.fn().mockReturnValue({
        data: {
          focus_hours_enabled: true,
          focus_hours_start: '22:00',
          focus_hours_end: '08:00',
          focus_hours_timezone: 'America/New_York',
          focus_hours_days: ['monday', 'tuesday'],
          weekly_engagement_budget_mins: 120,
          dnd_active: false,
          auto_response_enabled: true,
          auto_response_template: 'I am busy',
          availability_status: 'creating',
          availability_public: true,
          notification_batching: true,
        },
        error: null,
      });

      const result = await service.getBoundaries('creator-123');

      expect(result.focus_hours.enabled).toBe(true);
      expect(result.focus_hours.timezone).toBe('America/New_York');
      expect(result.focus_hours.days).toEqual(['monday', 'tuesday']);
      expect(result.weekly_engagement_budget_mins).toBe(120);
      expect(result.availability_status).toBe('creating');
      expect(result.availability_public).toBe(true);
      expect(result.dnd_mode.auto_response_enabled).toBe(true);
      expect(result.dnd_mode.auto_response_template).toBe('I am busy');
    });
  });

  describe('updateBoundaries', () => {
    it('should upsert boundary configuration', async () => {
      mockDb._chain.single = jest.fn().mockReturnValue({
        data: {
          focus_hours_enabled: true,
          focus_hours_start: '22:00',
          focus_hours_end: '08:00',
          focus_hours_timezone: 'UTC',
          focus_hours_days: ['monday'],
          weekly_engagement_budget_mins: 60,
          dnd_active: false,
          auto_response_enabled: false,
          auto_response_template: '',
          availability_status: 'hidden',
          availability_public: false,
          notification_batching: false,
        },
        error: null,
      });

      const result = await service.updateBoundaries('creator-123', {
        focus_hours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC',
          days: ['monday'],
        },
        weekly_engagement_budget_mins: 60,
      });

      expect(result.focus_hours.enabled).toBe(true);
      expect(result.weekly_engagement_budget_mins).toBe(60);
      expect(mockDb.from).toHaveBeenCalledWith('creator_boundaries');
    });
  });
});
