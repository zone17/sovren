/**
 * Content Shield API Routes Integration Tests (v2)
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

const mockGetProvenanceChain = vi.fn();
const mockGetCertificate = vi.fn();
const mockCreateFingerprint = vi.fn();
const mockGetRegistry = vi.fn();
const mockCompare = vi.fn();
const mockGetAlerts = vi.fn();
const mockGetAlertDetail = vi.fn();
const mockUpdateAlertStatus = vi.fn();
const mockGenerateReport = vi.fn();

vi.mock('../../../container', () => ({
  container: {
    resolve: vi.fn((type: symbol) => {
      const typeStr = type.toString();
      if (typeStr.includes('ProvenanceService')) {
        return {
          getProvenanceChain: mockGetProvenanceChain,
          getCertificate: mockGetCertificate,
        };
      }
      if (typeStr.includes('FingerprintService')) {
        return {
          createFingerprint: mockCreateFingerprint,
          getRegistry: mockGetRegistry,
          compare: mockCompare,
        };
      }
      if (typeStr.includes('AlertService')) {
        return {
          getAlerts: mockGetAlerts,
          getAlertDetail: mockGetAlertDetail,
          updateAlertStatus: mockUpdateAlertStatus,
        };
      }
      if (typeStr.includes('DmcaService')) {
        return {
          generateReport: mockGenerateReport,
        };
      }
      return {};
    }),
  },
}));

vi.mock('../../../container/types', () => ({
  TYPES: {
    ProvenanceService: Symbol.for('ProvenanceService'),
    FingerprintService: Symbol.for('FingerprintService'),
    AlertService: Symbol.for('AlertService'),
    DmcaService: Symbol.for('DmcaService'),
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

// --- Import the routes ---

beforeAll(async () => {
  await import('../../../routes/v2/shield.routes');
});

// --- Tests ---

describe('Shield Routes (v2)', () => {
  const nextFn: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Registration', () => {
    it('registers all expected shield routes', () => {
      const routePaths = capturedRoutes.map((r) => `${r.method} ${r.path}`);

      expect(routePaths).toContain('GET /provenance/:contentId');
      expect(routePaths).toContain('GET /provenance/:contentId/certificate');
      expect(routePaths).toContain('POST /fingerprint');
      expect(routePaths).toContain('GET /fingerprints/:creatorId');
      expect(routePaths).toContain('POST /compare');
      expect(routePaths).toContain('GET /alerts');
      expect(routePaths).toContain('GET /alerts/:id');
      expect(routePaths).toContain('PUT /alerts/:id');
      expect(routePaths).toContain('POST /alerts/:id/dmca-report');
    });
  });

  describe('GET /provenance/:contentId', () => {
    it('returns 200 with provenance data', async () => {
      const mockData = {
        content_id: 'content-1',
        author_pubkey: 'test-pubkey',
        verification_status: 'verified',
      };
      mockGetProvenanceChain.mockResolvedValue(mockData);

      const req = makeRequest({ params: { contentId: 'content-1' } });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/provenance/:contentId')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('forwards NotFoundError to next when provenance not found', async () => {
      mockGetProvenanceChain.mockResolvedValue(null);

      const req = makeRequest({ params: { contentId: 'nonexistent' } });
      const { res } = makeResponse();

      const route = getRoute('GET', '/provenance/:contentId')!;
      await route.handler(req, res, nextFn);
      await new Promise(process.nextTick);

      expect(nextFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'NotFoundError' }));
    });

    it('calls next on service error', async () => {
      mockGetProvenanceChain.mockRejectedValue(new Error('DB error'));

      const req = makeRequest({ params: { contentId: 'content-1' } });
      const { res } = makeResponse();

      const route = getRoute('GET', '/provenance/:contentId')!;
      await route.handler(req, res, nextFn);
      await new Promise(process.nextTick);

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('GET /provenance/:contentId/certificate', () => {
    it('returns 200 with certificate', async () => {
      const mockCert = { title: 'Content Provenance Certificate', content_id: 'content-1' };
      mockGetCertificate.mockResolvedValue(mockCert);

      const req = makeRequest({ params: { contentId: 'content-1' }, query: { format: 'json' } });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/provenance/:contentId/certificate')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: { certificate: mockCert } });
    });
  });

  describe('POST /fingerprint', () => {
    it('returns 201 with fingerprint data', async () => {
      const mockData = {
        content_id: 'content-1',
        fingerprints: [{ hash_type: 'simhash', hash_value: 'abc' }],
      };
      mockCreateFingerprint.mockResolvedValue(mockData);

      const req = makeRequest({
        body: { content_id: 'content-1', content_type: 'text', content_data: 'some text content' },
      });
      const { res, json, status } = makeResponse();

      const route = getRoute('POST', '/fingerprint')!;
      await route.handler(req, res, nextFn);

      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });
  });

  describe('GET /fingerprints/:creatorId', () => {
    it('returns 200 with registry for own creator', async () => {
      const mockResult = {
        data: { total_fingerprinted: 142, total_content: 200, coverage_percentage: 71 },
        pagination: {
          page: 1,
          limit: 20,
          total: 142,
          totalPages: 8,
          hasNext: true,
          hasPrev: false,
        },
      };
      mockGetRegistry.mockResolvedValue(mockResult);

      const req = makeRequest({
        params: { creatorId: 'test-pubkey-123' },
        query: { page: '1', limit: '20' },
      });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/fingerprints/:creatorId')!;
      await route.handler(req, res, nextFn);

      // Route passes { data, pagination } to createApiResponse, which wraps in { success, data }
      expect(json).toHaveBeenCalledWith({
        success: true,
        data: { data: mockResult.data, pagination: mockResult.pagination },
      });
    });

    it('forwards AuthorizationError when accessing another creator registry', async () => {
      const req = makeRequest({ params: { creatorId: 'other-creator-pubkey' } });
      const { res } = makeResponse();

      const route = getRoute('GET', '/fingerprints/:creatorId')!;
      await route.handler(req, res, nextFn);
      await new Promise(process.nextTick);

      expect(nextFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'AuthorizationError' }));
    });
  });

  describe('POST /compare', () => {
    it('returns 200 with comparison results', async () => {
      const mockData = {
        matches: [{ content_id: 'content-1', similarity: 0.92 }],
        total_compared: 142,
      };
      mockCompare.mockResolvedValue(mockData);

      const req = makeRequest({
        body: { hash_type: 'simhash', hash_value: 'abc123def4567890', threshold: 0.7 },
      });
      const { res, json } = makeResponse();

      const route = getRoute('POST', '/compare')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });
  });

  describe('GET /alerts', () => {
    it('returns 200 with alerts and pagination', async () => {
      const mockResult = {
        data: [{ id: 'alert-1', status: 'new' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockGetAlerts.mockResolvedValue(mockResult);

      const req = makeRequest({ query: { status: 'new', page: '1', limit: '20' } });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/alerts')!;
      await route.handler(req, res, nextFn);

      // Route passes { data, pagination } to createApiResponse, which wraps in { success, data }
      expect(json).toHaveBeenCalledWith({
        success: true,
        data: { data: mockResult.data, pagination: mockResult.pagination },
      });
      expect(mockGetAlerts).toHaveBeenCalledWith('test-pubkey-123', 'new', 1, 20);
    });
  });

  describe('GET /alerts/:id', () => {
    it('returns 200 with alert detail', async () => {
      const mockData = {
        id: 'alert-1',
        original: { title: 'My Article' },
        detected: { url: 'nostr:nevent1abc' },
        comparison: { similarity_score: 0.92 },
        status: 'new',
      };
      mockGetAlertDetail.mockResolvedValue(mockData);

      const req = makeRequest({ params: { id: 'alert-1' } });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/alerts/:id')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });
  });

  describe('PUT /alerts/:id', () => {
    it('returns 200 with updated alert status', async () => {
      const mockData = { id: 'alert-1', status: 'reviewed', updated_at: '2026-02-15T12:00:00Z' };
      mockUpdateAlertStatus.mockResolvedValue(mockData);

      const req = makeRequest({ params: { id: 'alert-1' }, body: { status: 'reviewed' } });
      const { res, json } = makeResponse();

      const route = getRoute('PUT', '/alerts/:id')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
      expect(mockUpdateAlertStatus).toHaveBeenCalledWith('test-pubkey-123', 'alert-1', 'reviewed');
    });
  });

  describe('POST /alerts/:id/dmca-report', () => {
    it('returns 201 with generated DMCA report', async () => {
      const mockReport = { title: 'DMCA Takedown Report', generated_at: '2026-02-15T12:00:00Z' };
      mockGenerateReport.mockResolvedValue(mockReport);

      const req = makeRequest({ params: { id: 'alert-1' }, query: { format: 'json' } });
      const { res, json, status } = makeResponse();

      const route = getRoute('POST', '/alerts/:id/dmca-report')!;
      await route.handler(req, res, nextFn);

      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith({ success: true, data: { report: mockReport } });
    });
  });
});

describe('Shield Validators', () => {
  let validators: typeof import('../../../validators/shield');

  beforeAll(async () => {
    validators = await import('../../../validators/shield');
  });

  describe('ContentIdParamSchema', () => {
    it('accepts valid content ID', () => {
      const result = validators.ContentIdParamSchema.safeParse({
        contentId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty content ID', () => {
      const result = validators.ContentIdParamSchema.safeParse({ contentId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateFingerprintSchema', () => {
    it('accepts valid text fingerprint', () => {
      const result = validators.CreateFingerprintSchema.safeParse({
        content_id: 'content-1',
        content_type: 'text',
        content_data: 'Some text content to fingerprint',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid image fingerprint', () => {
      const result = validators.CreateFingerprintSchema.safeParse({
        content_id: 'content-2',
        content_type: 'image',
        content_data: 'base64encodeddata...',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid content type', () => {
      const result = validators.CreateFingerprintSchema.safeParse({
        content_id: 'content-1',
        content_type: 'video',
        content_data: 'data',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty content data', () => {
      const result = validators.CreateFingerprintSchema.safeParse({
        content_id: 'content-1',
        content_type: 'text',
        content_data: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CompareSchema', () => {
    it('accepts valid compare request', () => {
      const result = validators.CompareSchema.safeParse({
        hash_type: 'simhash',
        hash_value: 'abc123def4567890',
        threshold: 0.7,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid hash format', () => {
      const result = validators.CompareSchema.safeParse({
        hash_type: 'simhash',
        hash_value: 'not-a-valid-hex',
        threshold: 0.7,
      });
      expect(result.success).toBe(false);
    });

    it('rejects threshold above 1', () => {
      const result = validators.CompareSchema.safeParse({
        hash_type: 'simhash',
        hash_value: 'abc123def4567890',
        threshold: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GetAlertsQuerySchema', () => {
    it('accepts valid status filter', () => {
      const result = validators.GetAlertsQuerySchema.safeParse({ status: 'new' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const result = validators.GetAlertsQuerySchema.safeParse({ status: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('defaults to new status', () => {
      const result = validators.GetAlertsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('new');
      }
    });
  });

  describe('UpdateAlertStatusSchema', () => {
    it('accepts valid status transitions', () => {
      ['reviewed', 'resolved', 'false_positive', 'reported'].forEach((status) => {
        const result = validators.UpdateAlertStatusSchema.safeParse({ status });
        expect(result.success).toBe(true);
      });
    });

    it('rejects new as target status', () => {
      const result = validators.UpdateAlertStatusSchema.safeParse({ status: 'new' });
      expect(result.success).toBe(false);
    });
  });
});
