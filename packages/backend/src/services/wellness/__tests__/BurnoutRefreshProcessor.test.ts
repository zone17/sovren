/**
 * BurnoutRefreshProcessor Unit Tests
 * EPIC-007: Creator Wellness System
 */

import { BurnoutRefreshProcessor } from '../BurnoutRefreshProcessor';
import type { IBurnoutScoringService } from '../../../interfaces/wellness/IBurnoutScoringService';
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

describe('BurnoutRefreshProcessor', () => {
  let processor: BurnoutRefreshProcessor;
  let mockDb: ISupabaseClient;
  let mockBurnoutService: IBurnoutScoringService;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDb = {} as ISupabaseClient;
    mockBurnoutService = {
      calculateScore: vi.fn().mockResolvedValue({
        score: 42,
        level: 'moderate',
        factors: {},
        baseline_ready: true,
        baseline_days_remaining: 0,
        history: [],
        recommendations: [],
        updated_at: new Date().toISOString(),
      }),
      setSensitivity: vi.fn(),
      getSensitivity: vi.fn(),
    } as unknown as IBurnoutScoringService;

    processor = new BurnoutRefreshProcessor(mockDb, mockBurnoutService, mockLogger);
  });

  it('has correct name and queue configuration', () => {
    expect(processor.name).toBe('burnout-refresh');
    expect(processor.queueName).toBe('burnout-refresh');
    expect(processor.concurrency).toBe(3);
  });

  describe('process', () => {
    it('calls burnoutService.calculateScore with the creator ID', async () => {
      await processor.process({
        id: 'job-1',
        data: { creatorId: 'creator-abc' },
        attemptsMade: 0,
      });

      expect(mockBurnoutService.calculateScore).toHaveBeenCalledWith('creator-abc');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[BurnoutRefreshProcessor] Refreshing burnout score',
        expect.objectContaining({ jobId: 'job-1', creatorId: 'creator-abc' })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[BurnoutRefreshProcessor] Score refreshed',
        expect.objectContaining({ jobId: 'job-1', creatorId: 'creator-abc' })
      );
    });

    it('propagates errors from calculateScore', async () => {
      (mockBurnoutService.calculateScore as any).mockRejectedValue(
        new Error('DB connection failed')
      );

      await expect(
        processor.process({
          id: 'job-2',
          data: { creatorId: 'creator-xyz' },
          attemptsMade: 1,
        })
      ).rejects.toThrow('DB connection failed');
    });
  });

  describe('onFailed', () => {
    it('logs error with creator ID and attempt count', async () => {
      const error = new Error('Score calculation timeout');

      await processor.onFailed(
        { id: 'job-3', data: { creatorId: 'creator-fail' }, attemptsMade: 3 },
        error
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[BurnoutRefreshProcessor] Refresh failed',
        expect.objectContaining({
          creatorId: 'creator-fail',
          error: 'Score calculation timeout',
          attempts: 3,
        })
      );
    });
  });
});
