/**
 * Shared IQueueService mock factory for backend tests.
 * Per common-solutions.md #7 — chainable mock builder pattern.
 */
import { vi } from 'vitest';
import type { IQueueService } from '../interfaces/queue/IQueueService';

/** Creates a complete mock of IQueueService with sensible defaults. */
export function createQueueServiceMock(): IQueueService {
  return {
    createQueue: vi.fn(),
    addJob: vi.fn().mockResolvedValue('mock-job-id'),
    registerProcessor: vi.fn(),
    removeJob: vi.fn().mockResolvedValue(undefined),
    getQueueNames: vi.fn().mockReturnValue([]),
    isHealthy: vi.fn().mockResolvedValue(true),
    closeAll: vi.fn().mockResolvedValue(undefined),
  };
}
