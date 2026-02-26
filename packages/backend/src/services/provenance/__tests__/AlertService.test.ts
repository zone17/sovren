/**
 * AlertService Unit Tests
 * Tests alert CRUD and status transition validation
 */

import { AlertService } from '../AlertService';
import { ALERT_STATUS_TRANSITIONS } from '@shared/types/provenance';

/**
 * Creates a mock DB that supports the atomic update pattern used by updateAlertStatus:
 *   from().update().eq().eq().in().select().single()
 * and the fallback lookup:
 *   from().select('status').eq().eq().single()
 */
function createAtomicUpdateMockDb(opts: {
  atomicResult: { data: any; error: any };
  fallbackResult?: { data: any; error?: any };
}) {
  let fromCallCount = 0;

  // Chain for the atomic update: from().update().eq().eq().in().select().single()
  const updateChain: any = {};
  for (const method of ['update', 'eq', 'in', 'select', 'single']) {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  }
  updateChain.single.mockReturnValue(opts.atomicResult);

  // Chain for the fallback select: from().select().eq().eq().single()
  const selectChain: any = {};
  for (const method of ['select', 'eq', 'single']) {
    selectChain[method] = vi.fn().mockReturnValue(selectChain);
  }
  if (opts.fallbackResult) {
    selectChain.single.mockReturnValue(opts.fallbackResult);
  }

  return {
    from: vi.fn(() => {
      fromCallCount++;
      return fromCallCount === 1 ? updateChain : selectChain;
    }),
    _updateChain: updateChain,
    _selectChain: selectChain,
  };
}

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('AlertService', () => {
  let service: AlertService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateAlertStatus', () => {
    it('should allow valid transition: new -> reviewed', async () => {
      // Atomic update succeeds (returns the updated row)
      const mockDb = createAtomicUpdateMockDb({
        atomicResult: { data: { id: 'alert-id', status: 'reviewed' }, error: null },
      });

      service = new AlertService(mockDb as any, mockLogger);
      const result = await service.updateAlertStatus('creator-123', 'alert-id', 'reviewed');

      expect(result.status).toBe('reviewed');
      expect(result.id).toBe('alert-id');
    });

    it('should reject invalid transition: new -> resolved', async () => {
      // Atomic update fails (0 rows matched)
      const mockDb = createAtomicUpdateMockDb({
        atomicResult: { data: null, error: null },
        fallbackResult: { data: { status: 'new' } },
      });

      service = new AlertService(mockDb as any, mockLogger);
      await expect(
        service.updateAlertStatus('creator-123', 'alert-id', 'resolved')
      ).rejects.toThrow(/Cannot transition/);
    });

    it('should reject invalid transition: resolved -> reviewed', async () => {
      // Atomic update fails (0 rows matched — resolved is terminal)
      const mockDb = createAtomicUpdateMockDb({
        atomicResult: { data: null, error: null },
        fallbackResult: { data: { status: 'resolved' } },
      });

      service = new AlertService(mockDb as any, mockLogger);
      await expect(
        service.updateAlertStatus('creator-123', 'alert-id', 'reviewed')
      ).rejects.toThrow(/Cannot transition/);
    });

    it('should allow valid transition: reviewed -> reported', async () => {
      const mockDb = createAtomicUpdateMockDb({
        atomicResult: { data: { id: 'alert-id', status: 'reported' }, error: null },
      });

      service = new AlertService(mockDb as any, mockLogger);
      const result = await service.updateAlertStatus('creator-123', 'alert-id', 'reported');

      expect(result.status).toBe('reported');
    });

    it('should throw NotFoundError for non-existent alert', async () => {
      // Atomic update fails AND fallback finds nothing
      const mockDb = createAtomicUpdateMockDb({
        atomicResult: { data: null, error: null },
        fallbackResult: { data: null },
      });

      service = new AlertService(mockDb as any, mockLogger);
      await expect(
        service.updateAlertStatus('creator-123', 'missing-id', 'reviewed')
      ).rejects.toThrow();
    });
  });

  describe('status transitions map', () => {
    it('should define valid transitions for all statuses', () => {
      expect(ALERT_STATUS_TRANSITIONS.new).toContain('reviewed');
      expect(ALERT_STATUS_TRANSITIONS.new).toContain('false_positive');
      expect(ALERT_STATUS_TRANSITIONS.reviewed).toContain('resolved');
      expect(ALERT_STATUS_TRANSITIONS.reviewed).toContain('reported');
      expect(ALERT_STATUS_TRANSITIONS.reported).toContain('resolved');
      expect(ALERT_STATUS_TRANSITIONS.resolved).toEqual([]);
      expect(ALERT_STATUS_TRANSITIONS.false_positive).toEqual([]);
    });
  });
});
