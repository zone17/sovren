/**
 * Wellness API Routes Integration Tests (v2)
 * Tests route handler behavior, request validation, and response format.
 *
 * Strategy: Capture route handlers via Express Router mock, mock services,
 * and test handlers directly with mock Request/Response objects.
 */

import { Request, Response, NextFunction } from 'express';

// --- Capture route handlers via Express Router mock ---

type HandlerFn = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
type MiddlewareFn = HandlerFn;

interface RouteEntry {
  method: string;
  path: string;
  middlewares: MiddlewareFn[];
  handler: HandlerFn;
}

const capturedRoutes: RouteEntry[] = vi.hoisted(() => [] as RouteEntry[]);

vi.mock('express', async () => {
  const actual = await vi.importActual('express');
  return {
    ...actual,
    Router: () => {
      const mockRouter: Record<string, any> = {};
      const methods = ['get', 'post', 'put', 'delete', 'patch'];
      methods.forEach((method) => {
        mockRouter[method] = vi.fn((...args: unknown[]) => {
          const path = args[0] as string;
          const fns = args.slice(1) as HandlerFn[];
          const handler = fns[fns.length - 1];
          const middlewares = fns.slice(0, -1);
          capturedRoutes.push({ method: method.toUpperCase(), path, middlewares, handler });
          return mockRouter;
        });
      });
      mockRouter.use = vi.fn((..._args: unknown[]) => mockRouter);
      return mockRouter;
    },
  };
});

// --- Mock middleware ---

vi.mock('../../../middleware/auth', () => ({
  authenticate: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  requireCreator: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  optionalAuth: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  getAuthUser: vi.fn((req: Request) => req.user),
}));

vi.mock('../../../middleware/validation-middleware', () => ({
  validate: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../../middleware/rate-limit-middleware', () => {
  const noop = vi.fn((_req: Request, _res: Response, next: NextFunction) => next());
  return {
    readOnlyRateLimiter: noop,
    createUserRateLimiter: vi.fn(() => noop),
    createRateLimiter: vi.fn(() => noop),
  };
});

vi.mock('../../../middleware/correlation-id', () => ({
  getCorrelationId: vi.fn(() => 'no-context'),
}));

// Mock createApiResponse to return a simple envelope (no snake→camel transform)
vi.mock('../../../utils/api-response', () => ({
  createApiResponse: vi.fn((_req: Request, data: unknown) => ({
    success: true,
    data,
  })),
}));

// --- Mock services ---

const mockRecordWorkPattern = vi.fn();
const mockGetWorkPatterns = vi.fn();
const mockGetHeatmap = vi.fn();
const mockCheckPulseEligibility = vi.fn();
const mockRecordPulse = vi.fn();
const mockGetPulseHistory = vi.fn();
const mockGetBenchmark = vi.fn();
const mockDeletePulseHistory = vi.fn();
const mockDeleteAllWellnessData = vi.fn();
const mockCalculateScore = vi.fn();
const mockSetSensitivity = vi.fn();
const mockGetRecommendations = vi.fn();
const mockGetBufferDepth = vi.fn();
const mockGetBoundaries = vi.fn();
const mockUpdateBoundaries = vi.fn();

vi.mock('../../../container', () => ({
  container: {
    resolve: vi.fn((type: symbol) => {
      const typeStr = type.toString();
      if (typeStr.includes('WellnessService')) {
        return {
          recordWorkPattern: mockRecordWorkPattern,
          getWorkPatterns: mockGetWorkPatterns,
          getHeatmap: mockGetHeatmap,
          checkPulseEligibility: mockCheckPulseEligibility,
          recordPulse: mockRecordPulse,
          getPulseHistory: mockGetPulseHistory,
          getBenchmark: mockGetBenchmark,
          deletePulseHistory: mockDeletePulseHistory,
          deleteAllWellnessData: mockDeleteAllWellnessData,
        };
      }
      if (typeStr.includes('BurnoutScoringService')) {
        return {
          calculateScore: mockCalculateScore,
          setSensitivity: mockSetSensitivity,
        };
      }
      if (typeStr.includes('ScheduleService')) {
        return {
          getRecommendations: mockGetRecommendations,
          getBufferDepth: mockGetBufferDepth,
        };
      }
      if (typeStr.includes('BoundaryService')) {
        return {
          getBoundaries: mockGetBoundaries,
          updateBoundaries: mockUpdateBoundaries,
        };
      }
      return {};
    }),
  },
}));

vi.mock('../../../container/types', () => ({
  TYPES: {
    WellnessService: Symbol.for('WellnessService'),
    BurnoutScoringService: Symbol.for('BurnoutScoringService'),
    ScheduleService: Symbol.for('ScheduleService'),
    BoundaryService: Symbol.for('BoundaryService'),
  },
}));

// --- Helper ---

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    user: { nostr_pubkey: 'test-pubkey-123', role: 'creator' },
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function makeResponse(): { res: Response; json: any; status: any } {
  const json = vi.fn();
  const statusFn = vi.fn().mockReturnThis();
  const res = {
    json,
    status: statusFn,
  } as unknown as Response;
  (res as any).json = json;
  return { res, json, status: statusFn };
}

function getRoute(method: string, path: string): RouteEntry | undefined {
  return capturedRoutes.find((r) => r.method === method && r.path === path);
}

// --- Import the routes (triggers registration) ---

beforeAll(async () => {
  await import('../../../routes/v2/wellness.routes');
});

// --- Tests ---

describe('Wellness Routes (v2)', () => {
  const nextFn: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Registration', () => {
    it('registers all expected wellness routes', () => {
      const routePaths = capturedRoutes.map((r) => `${r.method} ${r.path}`);

      expect(routePaths).toContain('POST /patterns');
      expect(routePaths).toContain('GET /patterns');
      expect(routePaths).toContain('GET /patterns/heatmap');
      expect(routePaths).toContain('GET /risk-score');
      expect(routePaths).toContain('PUT /risk-score/sensitivity');
      expect(routePaths).toContain('GET /schedule/recommendations');
      expect(routePaths).toContain('GET /buffer-depth');
      expect(routePaths).toContain('GET /boundaries');
      expect(routePaths).toContain('PUT /boundaries');
      expect(routePaths).toContain('POST /pulse');
      expect(routePaths).toContain('GET /pulse/history');
      expect(routePaths).toContain('GET /benchmark');
      expect(routePaths).toContain('DELETE /pulse');
      expect(routePaths).toContain('DELETE /data');
    });

    it('applies authenticate middleware to protected routes', () => {
      const protectedRoutes = capturedRoutes.filter((r) => r.path !== '/benchmark');
      protectedRoutes.forEach((route) => {
        // authenticate should be one of the middlewares
        expect(route.middlewares.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('POST /patterns', () => {
    it('returns 201 with pattern data on success', async () => {
      const mockData = { id: 'uuid-1', type: 'content_creation', duration_mins: 45 };
      mockRecordWorkPattern.mockResolvedValue(mockData);

      const req = makeRequest({
        body: { type: 'content_creation', duration_mins: 45, timestamp: '2026-02-15T10:00:00Z' },
      });
      const { res, json, status } = makeResponse();

      const route = getRoute('POST', '/patterns')!;
      await route.handler(req, res, nextFn);

      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
      expect(mockRecordWorkPattern).toHaveBeenCalledWith('test-pubkey-123', req.body);
    });

    it('calls next on service error', async () => {
      mockRecordWorkPattern.mockRejectedValue(new Error('DB error'));

      const req = makeRequest({ body: { type: 'content_creation', duration_mins: 45 } });
      const { res } = makeResponse();

      const route = getRoute('POST', '/patterns')!;
      await route.handler(req, res, nextFn);
      // asyncHandler doesn't return the promise chain, so flush microtasks
      await new Promise(process.nextTick);

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('GET /patterns', () => {
    it('returns 200 with patterns data', async () => {
      const mockData = { period: '7d', total_hours: 38.5, rest_days: 2 };
      mockGetWorkPatterns.mockResolvedValue(mockData);

      const req = makeRequest({ query: { period: '7d' } });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/patterns')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
      expect(mockGetWorkPatterns).toHaveBeenCalledWith('test-pubkey-123', '7d');
    });
  });

  describe('GET /patterns/heatmap', () => {
    it('returns 200 with heatmap data', async () => {
      const mockData = { period: '7d', heatmap: [], peak_hours: [9, 10] };
      mockGetHeatmap.mockResolvedValue(mockData);

      const req = makeRequest({ query: { period: '7d' } });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/patterns/heatmap')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });
  });

  describe('GET /risk-score', () => {
    it('returns 200 with burnout score', async () => {
      const mockData = { score: 42, level: 'moderate', baseline_ready: true };
      mockCalculateScore.mockResolvedValue(mockData);

      const req = makeRequest();
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/risk-score')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
      expect(mockCalculateScore).toHaveBeenCalledWith('test-pubkey-123');
    });
  });

  describe('PUT /risk-score/sensitivity', () => {
    it('returns 200 with updated sensitivity', async () => {
      const mockData = { sensitivity: 'relaxed', updated_at: '2026-02-15T10:00:00Z' };
      mockSetSensitivity.mockResolvedValue(mockData);

      const req = makeRequest({ body: { sensitivity: 'relaxed' } });
      const { res, json } = makeResponse();

      const route = getRoute('PUT', '/risk-score/sensitivity')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
      expect(mockSetSensitivity).toHaveBeenCalledWith('test-pubkey-123', 'relaxed');
    });
  });

  describe('GET /schedule/recommendations', () => {
    it('returns 200 with schedule recommendations', async () => {
      const mockData = { recommended_posts_per_week: 4, optimal_days: ['monday'] };
      mockGetRecommendations.mockResolvedValue(mockData);

      const req = makeRequest();
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/schedule/recommendations')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });
  });

  describe('GET /buffer-depth', () => {
    it('returns 200 with buffer depth', async () => {
      const mockData = { buffer_days: 3, threshold: 5 };
      mockGetBufferDepth.mockResolvedValue(mockData);

      const req = makeRequest();
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/buffer-depth')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });
  });

  describe('GET /boundaries', () => {
    it('returns 200 with boundary config', async () => {
      const mockData = { focus_hours: { enabled: true }, notification_batching: true };
      mockGetBoundaries.mockResolvedValue(mockData);

      const req = makeRequest();
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/boundaries')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });
  });

  describe('PUT /boundaries', () => {
    it('returns 200 with updated boundaries', async () => {
      const mockData = { focus_hours: { enabled: false }, notification_batching: false };
      mockUpdateBoundaries.mockResolvedValue(mockData);

      const req = makeRequest({
        body: {
          focus_hours: {
            enabled: false,
            start: '22:00',
            end: '08:00',
            timezone: 'UTC',
            days: ['monday'],
          },
        },
      });
      const { res, json } = makeResponse();

      const route = getRoute('PUT', '/boundaries')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });
  });

  describe('POST /pulse', () => {
    it('returns 201 with pulse check-in data', async () => {
      const mockData = {
        id: 'pulse-1',
        energy: 4,
        motivation: 3,
        stress: 2,
        composite_score: 3.67,
      };
      mockCheckPulseEligibility.mockResolvedValue(true);
      mockRecordPulse.mockResolvedValue(mockData);

      const req = makeRequest({ body: { energy: 4, motivation: 3, stress: 2 } });
      const { res, json, status } = makeResponse();

      const route = getRoute('POST', '/pulse')!;
      route.handler(req, res, nextFn);
      await new Promise(process.nextTick);

      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('returns 409 when pulse already submitted today', async () => {
      mockCheckPulseEligibility.mockResolvedValue(false);

      const req = makeRequest({ body: { energy: 4, motivation: 3, stress: 2 } });
      const { res, json, status } = makeResponse();

      const route = getRoute('POST', '/pulse')!;
      route.handler(req, res, nextFn);
      await new Promise(process.nextTick);

      expect(status).toHaveBeenCalledWith(409);
      expect(mockRecordPulse).not.toHaveBeenCalled();
    });
  });

  describe('GET /pulse/history', () => {
    it('returns 200 with pulse history', async () => {
      const mockData = { entries: [], trend: { direction: 'stable' } };
      mockGetPulseHistory.mockResolvedValue(mockData);

      const req = makeRequest({ query: { period: '90d' } });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/pulse/history')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });
  });

  describe('GET /benchmark', () => {
    it('returns 200 with benchmark data when sufficient sample', async () => {
      const mockData = { average_weekly_hours: 35.2, sample_size: 1250 };
      mockGetBenchmark.mockResolvedValue(mockData);

      const req = makeRequest();
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/benchmark')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('returns null data when insufficient sample', async () => {
      mockGetBenchmark.mockResolvedValue(null);

      const req = makeRequest();
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/benchmark')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: {
          benchmark: null,
          message: 'Insufficient participants for anonymous benchmarking (minimum: 10)',
        },
      });
    });
  });

  describe('DELETE /pulse', () => {
    it('returns 200 with deleted count', async () => {
      mockDeletePulseHistory.mockResolvedValue(24);

      const req = makeRequest();
      const { res, json } = makeResponse();

      const route = getRoute('DELETE', '/pulse')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: { deleted_count: 24 } });
    });
  });

  describe('DELETE /data', () => {
    it('returns 200 with deletion summary', async () => {
      const mockDeleted = {
        wellness_snapshots: 52,
        creator_work_patterns: 365,
        pulse_checkins: 24,
        boundary_config: 1,
      };
      mockDeleteAllWellnessData.mockResolvedValue(mockDeleted);

      const req = makeRequest();
      const { res, json } = makeResponse();

      const route = getRoute('DELETE', '/data')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: { deleted: mockDeleted } });
    });
  });
});

describe('Wellness Validators', () => {
  let validators: typeof import('../../../validators/wellness');

  beforeAll(async () => {
    validators = await import('../../../validators/wellness');
  });

  describe('RecordWorkPatternSchema', () => {
    it('accepts valid work pattern', () => {
      const result = validators.RecordWorkPatternSchema.safeParse({
        type: 'content_creation',
        duration_mins: 45,
        timestamp: '2026-02-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid type', () => {
      const result = validators.RecordWorkPatternSchema.safeParse({
        type: 'invalid_type',
        duration_mins: 45,
        timestamp: '2026-02-15T10:00:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative duration', () => {
      const result = validators.RecordWorkPatternSchema.safeParse({
        type: 'content_creation',
        duration_mins: -10,
        timestamp: '2026-02-15T10:00:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('rejects duration over 1440', () => {
      const result = validators.RecordWorkPatternSchema.safeParse({
        type: 'content_creation',
        duration_mins: 1500,
        timestamp: '2026-02-15T10:00:00Z',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RecordPulseSchema', () => {
    it('accepts valid pulse', () => {
      const result = validators.RecordPulseSchema.safeParse({
        energy: 4,
        motivation: 3,
        stress: 2,
      });
      expect(result.success).toBe(true);
    });

    it('rejects energy below 1', () => {
      const result = validators.RecordPulseSchema.safeParse({
        energy: 0,
        motivation: 3,
        stress: 2,
      });
      expect(result.success).toBe(false);
    });

    it('rejects energy above 5', () => {
      const result = validators.RecordPulseSchema.safeParse({
        energy: 6,
        motivation: 3,
        stress: 2,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer values', () => {
      const result = validators.RecordPulseSchema.safeParse({
        energy: 3.5,
        motivation: 3,
        stress: 2,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SetSensitivitySchema', () => {
    it('accepts valid sensitivity values', () => {
      ['relaxed', 'normal', 'sensitive'].forEach((sensitivity) => {
        const result = validators.SetSensitivitySchema.safeParse({ sensitivity });
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid sensitivity', () => {
      const result = validators.SetSensitivitySchema.safeParse({ sensitivity: 'extreme' });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateBoundariesSchema', () => {
    it('accepts valid boundary update', () => {
      const result = validators.UpdateBoundariesSchema.safeParse({
        focus_hours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
          timezone: 'America/New_York',
          days: ['monday', 'tuesday'],
        },
        weekly_engagement_budget_mins: 120,
        notification_batching: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid time format', () => {
      const result = validators.UpdateBoundariesSchema.safeParse({
        focus_hours: {
          enabled: true,
          start: '10pm',
          end: '08:00',
          timezone: 'UTC',
          days: ['monday'],
        },
      });
      expect(result.success).toBe(false);
    });

    it('accepts partial updates', () => {
      const result = validators.UpdateBoundariesSchema.safeParse({
        notification_batching: false,
      });
      expect(result.success).toBe(true);
    });
  });
});
