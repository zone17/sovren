/**
 * AlertService Unit Tests
 * Tests alert CRUD and status transition validation
 */

import { AlertService } from '../AlertService';

function createMockDb() {
  const mockChain: any = {};
  const methods = ['select', 'eq', 'order', 'range', 'single', 'update', 'from'];
  for (const method of methods) {
    mockChain[method] = vi.fn().mockReturnValue(mockChain);
  }
  return {
    from: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('AlertService', () => {
  let service: AlertService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new AlertService(mockDb as any, mockLogger);
    vi.clearAllMocks();
  });

  describe('updateAlertStatus', () => {
    it('should allow valid transition: new -> reviewed', async () => {
      // Mock fetching current alert
      mockDb._chain.single = jest
        .fn()
        .mockReturnValueOnce({ data: { status: 'new' }, error: null }) // First call: get current
        .mockReturnValueOnce({ data: null, error: null }); // Update doesn't use single

      mockDb._chain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ error: null }),
        }),
      });

      const result = await service.updateAlertStatus('creator-123', 'alert-id', 'reviewed');
      expect(result.status).toBe('reviewed');
      expect(result.id).toBe('alert-id');
    });

    it('should reject invalid transition: new -> resolved', async () => {
      mockDb._chain.single = vi.fn().mockReturnValue({
        data: { status: 'new' },
        error: null,
      });

      await expect(
        service.updateAlertStatus('creator-123', 'alert-id', 'resolved')
      ).rejects.toThrow(/Cannot transition/);
    });

    it('should reject invalid transition: resolved -> reviewed', async () => {
      mockDb._chain.single = vi.fn().mockReturnValue({
        data: { status: 'resolved' },
        error: null,
      });

      await expect(
        service.updateAlertStatus('creator-123', 'alert-id', 'reviewed')
      ).rejects.toThrow(/Cannot transition/);
    });

    it('should allow valid transition: reviewed -> reported', async () => {
      mockDb._chain.single = vi.fn().mockReturnValueOnce({
        data: { status: 'reviewed' },
        error: null,
      });

      mockDb._chain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ error: null }),
        }),
      });

      const result = await service.updateAlertStatus('creator-123', 'alert-id', 'reported');
      expect(result.status).toBe('reported');
    });

    it('should throw NotFoundError for non-existent alert', async () => {
      mockDb._chain.single = vi.fn().mockReturnValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(
        service.updateAlertStatus('creator-123', 'missing-id', 'reviewed')
      ).rejects.toThrow();
    });
  });

  describe('status transitions map', () => {
    it('should define valid transitions for all statuses', () => {
      // From shared types
      const { ALERT_STATUS_TRANSITIONS } = require('@shared/types/provenance');

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
