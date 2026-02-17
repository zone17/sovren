/**
 * WellnessService Unit Tests
 * Tests work pattern CRUD, pulse check-ins, data deletion
 */

import { WellnessService } from '../WellnessService';

function createMockDb() {
  const mockChain: any = {};

  const methods = [
    'select',
    'eq',
    'gte',
    'gt',
    'lt',
    'order',
    'range',
    'single',
    'insert',
    'upsert',
    'delete',
  ];
  for (const method of methods) {
    mockChain[method] = jest.fn().mockReturnValue(mockChain);
  }

  // Default terminal responses
  mockChain.single = jest.fn().mockResolvedValue({ data: null, error: null });

  return {
    from: jest.fn().mockReturnValue(mockChain),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    _chain: mockChain,
  };
}

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('WellnessService', () => {
  let service: WellnessService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new WellnessService(mockDb as any, mockLogger);
    jest.clearAllMocks();
  });

  describe('recordWorkPattern', () => {
    it('should call upsert_work_pattern RPC with correct params for content_creation', async () => {
      const mockRow = {
        id: 'pattern-id-1',
        creator_id: 'creator-123',
        date: '2026-02-15',
        content_time_mins: 45,
        engagement_time_mins: 0,
        management_time_mins: 0,
        post_count: 1,
        total_hours: 0.75,
        first_activity_at: '2026-02-15T10:00:00Z',
        last_activity_at: '2026-02-15T10:00:00Z',
        created_at: '2026-02-15T10:00:00Z',
        updated_at: '2026-02-15T10:00:00Z',
      };

      mockDb.rpc = jest.fn().mockResolvedValue({ data: [mockRow], error: null });

      const result = await service.recordWorkPattern('creator-123', {
        type: 'content_creation',
        duration_mins: 45,
        timestamp: '2026-02-15T10:00:00Z',
      });

      expect(mockDb.rpc).toHaveBeenCalledWith('upsert_work_pattern', {
        p_creator_id: 'creator-123',
        p_date: '2026-02-15',
        p_content_time_mins: 45,
        p_engagement_time_mins: 0,
        p_management_time_mins: 0,
        p_post_count: 1,
        p_activity_at: '2026-02-15T10:00:00Z',
      });

      expect(result.id).toBe('pattern-id-1');
      expect(result.creator_id).toBe('creator-123');
      expect(result.type).toBe('content_creation');
      expect(result.duration_mins).toBe(45);
      expect(result.created_at).toBe('2026-02-15T10:00:00Z');
    });

    it('should call upsert_work_pattern RPC with correct params for engagement', async () => {
      const mockRow = {
        id: 'pattern-id-2',
        creator_id: 'creator-123',
        date: '2026-02-15',
        content_time_mins: 0,
        engagement_time_mins: 30,
        management_time_mins: 0,
        post_count: 0,
        total_hours: 0.5,
        first_activity_at: '2026-02-15T14:00:00Z',
        last_activity_at: '2026-02-15T14:00:00Z',
        created_at: '2026-02-15T14:00:00Z',
        updated_at: '2026-02-15T14:00:00Z',
      };

      mockDb.rpc = jest.fn().mockResolvedValue({ data: [mockRow], error: null });

      const result = await service.recordWorkPattern('creator-123', {
        type: 'engagement',
        duration_mins: 30,
        timestamp: '2026-02-15T14:00:00Z',
      });

      expect(mockDb.rpc).toHaveBeenCalledWith('upsert_work_pattern', {
        p_creator_id: 'creator-123',
        p_date: '2026-02-15',
        p_content_time_mins: 0,
        p_engagement_time_mins: 30,
        p_management_time_mins: 0,
        p_post_count: 0,
        p_activity_at: '2026-02-15T14:00:00Z',
      });

      expect(result.type).toBe('engagement');
      expect(result.duration_mins).toBe(30);
    });

    it('should call upsert_work_pattern RPC with correct params for management', async () => {
      const mockRow = {
        id: 'pattern-id-3',
        creator_id: 'creator-123',
        date: '2026-02-15',
        content_time_mins: 0,
        engagement_time_mins: 0,
        management_time_mins: 20,
        post_count: 0,
        total_hours: 0.33,
        first_activity_at: '2026-02-15T16:00:00Z',
        last_activity_at: '2026-02-15T16:00:00Z',
        created_at: '2026-02-15T16:00:00Z',
        updated_at: '2026-02-15T16:00:00Z',
      };

      mockDb.rpc = jest.fn().mockResolvedValue({ data: [mockRow], error: null });

      const result = await service.recordWorkPattern('creator-123', {
        type: 'management',
        duration_mins: 20,
        timestamp: '2026-02-15T16:00:00Z',
      });

      expect(mockDb.rpc).toHaveBeenCalledWith('upsert_work_pattern', {
        p_creator_id: 'creator-123',
        p_date: '2026-02-15',
        p_content_time_mins: 0,
        p_engagement_time_mins: 0,
        p_management_time_mins: 20,
        p_post_count: 0,
        p_activity_at: '2026-02-15T16:00:00Z',
      });

      expect(result.type).toBe('management');
      expect(result.duration_mins).toBe(20);
    });

    it('should throw on RPC error', async () => {
      const dbError = { message: 'function not found' };
      mockDb.rpc = jest.fn().mockResolvedValue({ data: null, error: dbError });

      await expect(
        service.recordWorkPattern('creator-123', {
          type: 'content_creation',
          duration_mins: 45,
          timestamp: '2026-02-15T10:00:00Z',
        })
      ).rejects.toEqual(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record work pattern',
        expect.objectContaining({ creatorId: 'creator-123' })
      );
    });

    it('should preserve metadata in returned object', async () => {
      const mockRow = {
        id: 'pattern-id-4',
        creator_id: 'creator-123',
        created_at: '2026-02-15T10:00:00Z',
      };

      mockDb.rpc = jest.fn().mockResolvedValue({ data: [mockRow], error: null });

      const result = await service.recordWorkPattern('creator-123', {
        type: 'content_creation',
        duration_mins: 45,
        timestamp: '2026-02-15T10:00:00Z',
        metadata: { source: 'auto-tracker', platform: 'web' },
      });

      expect(result.metadata).toEqual({ source: 'auto-tracker', platform: 'web' });
    });

    it('should handle non-array RPC response (single object)', async () => {
      // Some Supabase versions may return a single object instead of an array
      const mockRow = {
        id: 'pattern-id-5',
        creator_id: 'creator-123',
        created_at: '2026-02-15T10:00:00Z',
      };

      mockDb.rpc = jest.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await service.recordWorkPattern('creator-123', {
        type: 'content_creation',
        duration_mins: 60,
        timestamp: '2026-02-15T10:00:00Z',
      });

      expect(result.id).toBe('pattern-id-5');
    });
  });

  describe('recordPulse', () => {
    it('should calculate composite score correctly', async () => {
      // composite = (energy + motivation + (6 - stress)) / 3
      // energy=4, motivation=3, stress=2 => (4 + 3 + 4) / 3 = 3.67
      mockDb._chain.single = jest.fn().mockReturnValue({
        data: {
          id: 'test-id',
          energy: 4,
          motivation: 3,
          stress: 2,
          composite_score: '3.67',
          created_at: '2026-02-15T10:00:00Z',
        },
        error: null,
      });

      const result = await service.recordPulse('creator-123', {
        energy: 4,
        motivation: 3,
        stress: 2,
      });

      expect(result.composite_score).toBe(3.67);
      expect(result.energy).toBe(4);
      expect(result.motivation).toBe(3);
      expect(result.stress).toBe(2);
    });

    it('should handle max stress (5) correctly', async () => {
      // energy=3, motivation=3, stress=5 => (3 + 3 + 1) / 3 = 2.33
      mockDb._chain.single = jest.fn().mockReturnValue({
        data: {
          id: 'test-id',
          energy: 3,
          motivation: 3,
          stress: 5,
          composite_score: '2.33',
          created_at: '2026-02-15T10:00:00Z',
        },
        error: null,
      });

      const result = await service.recordPulse('creator-123', {
        energy: 3,
        motivation: 3,
        stress: 5,
      });

      expect(result.composite_score).toBe(2.33);
    });

    it('should handle min stress (1) correctly', async () => {
      // energy=5, motivation=5, stress=1 => (5 + 5 + 5) / 3 = 5.0
      mockDb._chain.single = jest.fn().mockReturnValue({
        data: {
          id: 'test-id',
          energy: 5,
          motivation: 5,
          stress: 1,
          composite_score: '5.00',
          created_at: '2026-02-15T10:00:00Z',
        },
        error: null,
      });

      const result = await service.recordPulse('creator-123', {
        energy: 5,
        motivation: 5,
        stress: 1,
      });

      expect(result.composite_score).toBe(5);
    });
  });

  describe('deletePulseHistory', () => {
    it('should return count of deleted records', async () => {
      mockDb._chain.delete = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          count: 15,
          error: null,
        }),
      });

      const result = await service.deletePulseHistory('creator-123');
      expect(result).toBe(15);
    });
  });

  describe('deleteAllWellnessData', () => {
    it('should call RPC function for atomic deletion', async () => {
      mockDb.rpc = jest.fn().mockResolvedValue({
        data: {
          wellness_snapshots: 5,
          creator_work_patterns: 3,
          burnout_risk_history: 2,
          creator_boundaries: 1,
        },
        error: null,
      });

      const result = await service.deleteAllWellnessData('creator-123');

      expect(mockDb.rpc).toHaveBeenCalledWith('delete_all_wellness_data', {
        p_creator_id: 'creator-123',
      });
      expect(result).toEqual({
        wellness_snapshots: 5,
        creator_work_patterns: 3,
        burnout_risk_history: 2,
        creator_boundaries: 1,
      });
    });

    it('should throw clear error on RPC failure (no partial deletion)', async () => {
      mockDb.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'connection timeout' },
      });

      await expect(service.deleteAllWellnessData('creator-123')).rejects.toThrow(
        'GDPR deletion failed for creator creator-123: connection timeout. No data was deleted.'
      );
    });

    it('should return zero counts when no data exists', async () => {
      mockDb.rpc = jest.fn().mockResolvedValue({
        data: {
          wellness_snapshots: 0,
          creator_work_patterns: 0,
          burnout_risk_history: 0,
          creator_boundaries: 0,
        },
        error: null,
      });

      const result = await service.deleteAllWellnessData('creator-no-data');

      expect(result).toEqual({
        wellness_snapshots: 0,
        creator_work_patterns: 0,
        burnout_risk_history: 0,
        creator_boundaries: 0,
      });
    });

    it('should handle null data fields gracefully', async () => {
      mockDb.rpc = jest.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await service.deleteAllWellnessData('creator-123');

      expect(result).toEqual({
        wellness_snapshots: 0,
        creator_work_patterns: 0,
        burnout_risk_history: 0,
        creator_boundaries: 0,
      });
    });
  });
});
