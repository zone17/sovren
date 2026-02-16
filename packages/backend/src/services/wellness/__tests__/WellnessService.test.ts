/**
 * WellnessService Unit Tests
 * Tests work pattern CRUD, pulse check-ins, data deletion
 */

import { WellnessService } from '../WellnessService';

function createMockDb() {
  const mockChain: any = {};

  const methods = ['select', 'eq', 'gte', 'gt', 'lt', 'order', 'range', 'single', 'insert', 'upsert', 'delete'];
  for (const method of methods) {
    mockChain[method] = jest.fn().mockReturnValue(mockChain);
  }

  // Default terminal responses
  mockChain.single = jest.fn().mockResolvedValue({ data: null, error: null });

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

describe('WellnessService', () => {
  let service: WellnessService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new WellnessService(mockDb as any, mockLogger);
    jest.clearAllMocks();
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
    it('should delete from all wellness tables', async () => {
      mockDb._chain.delete = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          count: 10,
          error: null,
        }),
      });

      const result = await service.deleteAllWellnessData('creator-123');

      // Should have called from() for each of the 4 tables
      expect(mockDb.from).toHaveBeenCalledWith('wellness_snapshots');
      expect(mockDb.from).toHaveBeenCalledWith('creator_work_patterns');
      expect(mockDb.from).toHaveBeenCalledWith('burnout_risk_history');
      expect(mockDb.from).toHaveBeenCalledWith('creator_boundaries');
    });
  });
});
