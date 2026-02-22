/**
 * Shared IQueueService mock factory for backend tests.
 *
 * Per common-solutions.md #7 — chainable mock builder pattern.
 * Satisfies the full IQueueService interface so tests don't hand-roll partial mocks.
 */
import { vi } from 'vitest';
import type { IQueueService } from '../interfaces/queue/IQueueService';

/**
 * Creates a complete mock of IQueueService with sensible defaults.
 *
 * Usage:
 * ```ts
 * const mockQueue = createQueueServiceMock();
 * const service = new MyService(mockQueue);
 * ```
 *
 * Override specific methods:
 * ```ts
 * const mockQueue = createQueueServiceMock();
 * mockQueue.addJob.mockResolvedValue('custom-job-id');
 * ```
 */
export function createQueueServiceMock(): {
  [K in keyof IQueueService]: ReturnType<typeof vi.fn>;
} {
  return {
    createQueue: vi.fn(),
    addJob: vi.fn<[], Promise<string>>().mockResolvedValue('mock-job-id'),
    registerProcessor: vi.fn(),
    removeJob: vi.fn<[], Promise<void>>().mockResolvedValue(undefined),
    getQueueNames: vi.fn<[], string[]>().mockReturnValue([]),
    isHealthy: vi.fn<[], Promise<boolean>>().mockResolvedValue(true),
    closeAll: vi.fn<[], Promise<void>>().mockResolvedValue(undefined),
  };
}
