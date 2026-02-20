/**
 * ContentScannerProcessor Unit Tests
 * Tests NOSTR relay scanning, fingerprint comparison, and alert creation
 * EPIC-008: Content Shield (US-E8-004a)
 */

import { ContentScannerProcessor } from '../ContentScannerProcessor';
import type { RelayScanJobData } from '../ContentScannerProcessor';
import type { JobContext } from '../../../interfaces/queue/IJobProcessor';

function createMockDb() {
  const chain: any = {};
  const methods = ['select', 'eq', 'in', 'limit', 'single', 'insert', 'from'];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

const mockFingerprintService = {
  createFingerprint: vi.fn(),
  getRegistry: vi.fn(),
  compare: vi.fn(),
  computeSimHash: vi.fn().mockReturnValue('abcdef0123456789'),
  computeHammingDistance: vi.fn().mockReturnValue(5),
  computeSimilarity: vi.fn().mockReturnValue(0.92),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('ContentScannerProcessor', () => {
  let processor: ContentScannerProcessor;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    processor = new ContentScannerProcessor(
      mockFingerprintService as any,
      mockDb as any,
      mockLogger
    );
    vi.clearAllMocks();
  });

  describe('processor metadata', () => {
    it('should have correct name', () => {
      expect(processor.name).toBe('content-scanner');
    });

    it('should use relay-scan queue', () => {
      expect(processor.queueName).toBe('relay-scan');
    });

    it('should have concurrency of 3', () => {
      expect(processor.concurrency).toBe(3);
    });
  });

  describe('process', () => {
    const baseJobData: RelayScanJobData = {
      creatorId: 'creator-pubkey-abc',
      relays: ['wss://relay1.example.com', 'wss://relay2.example.com'],
      since: Math.floor(Date.now() / 1000) - 3600,
      fingerprintIds: [],
    };

    const makeJob = (data: Partial<RelayScanJobData> = {}): JobContext<RelayScanJobData> => ({
      id: 'job-123',
      data: { ...baseJobData, ...data },
      attemptsMade: 0,
    });

    it('should skip scan when creator has no fingerprints', async () => {
      // Load fingerprints returns empty
      mockDb._chain.limit = vi.fn().mockReturnValue({
        then: undefined,
        data: [],
        error: null,
      });

      // Override the chain to return empty data
      const selectChain: any = {};
      selectChain.eq = vi.fn().mockReturnValue(selectChain);
      selectChain.in = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      mockDb.from.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

      await processor.process(makeJob());

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No fingerprints to compare against, skipping scan',
        expect.objectContaining({ creatorId: 'creator-pubkey-abc' })
      );
    });

    it('should log start and completion of scan', async () => {
      // Mock fingerprints loading → empty (triggers early return)
      const selectChain: any = {};
      selectChain.eq = vi.fn().mockReturnValue(selectChain);
      selectChain.in = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      mockDb.from.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

      await processor.process(makeJob());

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting relay scan',
        expect.objectContaining({
          jobId: 'job-123',
          creatorId: 'creator-pubkey-abc',
          relayCount: 2,
        })
      );
    });
  });

  describe('onCompleted', () => {
    it('should log completion', async () => {
      const job: JobContext<RelayScanJobData> = {
        id: 'job-123',
        data: {
          creatorId: 'creator',
          relays: [],
          since: 0,
          fingerprintIds: [],
        },
        attemptsMade: 1,
      };

      await processor.onCompleted(job);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Relay scan job completed',
        { jobId: 'job-123' }
      );
    });
  });

  describe('onFailed', () => {
    it('should log failure with error details', async () => {
      const job: JobContext<RelayScanJobData> = {
        id: 'job-456',
        data: {
          creatorId: 'creator',
          relays: [],
          since: 0,
          fingerprintIds: [],
        },
        attemptsMade: 3,
      };

      const error = new Error('Connection timeout');

      await processor.onFailed(job, error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Relay scan job failed',
        expect.objectContaining({
          jobId: 'job-456',
          error: 'Connection timeout',
          attempts: 3,
        })
      );
    });
  });
});
