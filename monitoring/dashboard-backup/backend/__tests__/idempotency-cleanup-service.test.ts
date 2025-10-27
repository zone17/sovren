/**
 * Idempotency Cleanup Service Tests
 *
 * @story PAY-010
 */

import { IdempotencyCleanupService } from '../services/IdempotencyCleanupService';
import { IdempotencyRepository } from '../repositories/IdempotencyRepository';

jest.mock('../repositories/IdempotencyRepository');

describe('IdempotencyCleanupService', () => {
  let service: IdempotencyCleanupService;
  let mockRepository: jest.Mocked<IdempotencyRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockRepository = new IdempotencyRepository(null as any) as jest.Mocked<IdempotencyRepository>;
    mockRepository.cleanupExpired = jest.fn().mockResolvedValue({
      deleted_count: 10,
      cleanup_at: new Date(),
      duration_ms: 50,
    });
    mockRepository.getStats = jest.fn().mockResolvedValue({
      total_entries: 100,
      expired_entries: 10,
      oldest_entry: new Date(),
      newest_entry: new Date(),
    });

    service = new IdempotencyCleanupService(mockRepository, {
      auto_start: false,
    });
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
  });

  describe('Manual Cleanup', () => {
    it('should run cleanup successfully', async () => {
      const result = await service.runCleanup();

      expect(result.success).toBe(true);
      expect(result.stats.deleted_count).toBe(10);
      expect(mockRepository.cleanupExpired).toHaveBeenCalled();
    });

    it('should track cleanup statistics', async () => {
      await service.runCleanup();

      const stats = service.getStats();
      expect(stats.total_cleanups).toBe(1);
      expect(stats.successful_cleanups).toBe(1);
      expect(stats.total_deleted).toBe(10);
    });
  });

  describe('Automatic Cleanup', () => {
    it('should start and stop cleanup timer', () => {
      service.start();
      expect(service.getStats().is_running).toBe(true);

      service.stop();
      expect(service.getStats().is_running).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return repository stats', async () => {
      const stats = await service.getRepositoryStats();

      expect(stats.total_entries).toBe(100);
      expect(stats.expired_entries).toBe(10);
    });
  });
});
