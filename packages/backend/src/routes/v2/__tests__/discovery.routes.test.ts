/**
 * Discovery API Routes Tests (v2)
 * Tests route handler behavior, request validation, and response format.
 *
 * The route delegates to DiscoveryService via DI container (Todo #568).
 * Route-level tests mock the service; service-level tests mock the DB.
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
  optionalAuth: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../../middleware/validation-middleware', () => ({
  validate: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../../middleware/rate-limit-middleware', () => ({
  expensiveOperationRateLimiter: vi.fn((_req: Request, _res: Response, next: NextFunction) =>
    next()
  ),
}));

vi.mock('../../../lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../utils/api-response', () => ({
  createApiResponse: vi.fn((_req: Request, data: unknown) => ({
    success: true,
    data,
  })),
}));

vi.mock('../../../utils/asyncHandler', () => ({
  asyncHandler: (fn: HandlerFn) => fn,
}));

// --- Mock DI container (route delegates to DiscoveryService via container.resolve) ---

const mockSearchCreators = vi.fn();

vi.mock('../../../container', () => ({
  container: {
    resolve: vi.fn(() => ({
      searchCreators: mockSearchCreators,
    })),
  },
}));

vi.mock('../../../container/types', () => ({
  TYPES: {
    DiscoveryService: Symbol.for('DiscoveryService'),
  },
}));

// --- Import after mocks ---
import { escapePostgrestFilter } from '../discovery.routes';
import '../discovery.routes';

// --- Helpers ---

function makeRequest(query: Record<string, unknown> = {}): Request {
  return { query, user: null } as unknown as Request;
}

function makeResponse(): { res: Response; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const res = { json, status: vi.fn().mockReturnThis() } as unknown as Response;
  return { res, json };
}

function getCreatorsHandler(): HandlerFn {
  const route = capturedRoutes.find((r) => r.method === 'GET' && r.path === '/creators');
  if (!route) throw new Error('GET /creators route not captured');
  return route.handler;
}

// Standard DiscoveryResponse shape returned by the service
const defaultServiceResponse = {
  creators: [
    {
      id: 'cp-1',
      displayName: 'Sophia',
      username: 'sophia_art',
      avatarUrl: null,
      bio: 'Digital art creator',
      nip05Verified: true,
      categories: ['Art'],
      tags: ['bitcoin'],
      followerCount: 1500,
      contentCount: 45,
      verified: true,
      createdAt: '2024-01-01T00:00:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

// --- Tests ---

describe('Discovery Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchCreators.mockResolvedValue(defaultServiceResponse);
  });

  describe('GET /creators', () => {
    it('returns correct response shape with pagination', async () => {
      const handler = getCreatorsHandler();
      const req = makeRequest({ sortBy: 'relevance', page: 1, limit: 20 });
      const { res, json } = makeResponse();

      await handler(req, res, vi.fn());

      expect(json).toHaveBeenCalledTimes(1);
      const response = json.mock.calls[0][0];
      expect(response.data.creators).toHaveLength(1);
      expect(response.data.creators[0]).toMatchObject({
        id: 'cp-1',
        displayName: 'Sophia',
        username: 'sophia_art',
        bio: 'Digital art creator',
        followerCount: 1500,
      });
      expect(response.data.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('forwards query params to DiscoveryService.searchCreators', async () => {
      const handler = getCreatorsHandler();
      const req = makeRequest({ sortBy: 'relevance', page: 1, limit: 20 });
      const { res } = makeResponse();

      await handler(req, res, vi.fn());

      expect(mockSearchCreators).toHaveBeenCalledTimes(1);
    });

    it('forwards text search param to service', async () => {
      const handler = getCreatorsHandler();
      const req = makeRequest({ q: 'test,inject', sortBy: 'relevance', page: 1, limit: 20 });
      const { res } = makeResponse();

      await handler(req, res, vi.fn());

      expect(mockSearchCreators).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'test,inject' })
      );
    });

    it('forwards category param to service', async () => {
      const handler = getCreatorsHandler();
      const req = makeRequest({ category: 'Art', sortBy: 'relevance', page: 1, limit: 20 });
      const { res } = makeResponse();

      await handler(req, res, vi.fn());

      expect(mockSearchCreators).toHaveBeenCalledWith(expect.objectContaining({ category: 'Art' }));
    });

    it('forwards sortBy newest to service', async () => {
      const handler = getCreatorsHandler();
      const req = makeRequest({ sortBy: 'newest', page: 1, limit: 20 });
      const { res } = makeResponse();

      await handler(req, res, vi.fn());

      expect(mockSearchCreators).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'newest' })
      );
    });

    it('forwards sortBy followers to service', async () => {
      const handler = getCreatorsHandler();
      const req = makeRequest({ sortBy: 'followers', page: 1, limit: 20 });
      const { res } = makeResponse();

      await handler(req, res, vi.fn());

      expect(mockSearchCreators).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'followers' })
      );
    });

    it('returns hasNext true and hasPrev true for middle page', async () => {
      mockSearchCreators.mockResolvedValue({
        creators: defaultServiceResponse.creators,
        pagination: { page: 2, limit: 20, total: 60, totalPages: 3, hasNext: true, hasPrev: true },
      });

      const handler = getCreatorsHandler();
      const req = makeRequest({ sortBy: 'relevance', page: 2, limit: 20 });
      const { res, json } = makeResponse();

      await handler(req, res, vi.fn());

      const pagination = json.mock.calls[0][0].data.pagination;
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(true);
    });

    it('throws ServiceError on service error', async () => {
      mockSearchCreators.mockRejectedValue(new Error('Discovery search failed'));

      const handler = getCreatorsHandler();
      const req = makeRequest({ sortBy: 'relevance', page: 1, limit: 20 });
      const { res } = makeResponse();

      await expect(handler(req, res, vi.fn())).rejects.toThrow('Discovery search failed');
    });

    it('returns empty creators with correct pagination on no results', async () => {
      mockSearchCreators.mockResolvedValue({
        creators: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      });

      const handler = getCreatorsHandler();
      const req = makeRequest({ sortBy: 'relevance', page: 1, limit: 20 });
      const { res, json } = makeResponse();

      await handler(req, res, vi.fn());

      expect(json.mock.calls[0][0].data.creators).toHaveLength(0);
      expect(json.mock.calls[0][0].data.pagination).toMatchObject({
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });
  });

  describe('escapePostgrestFilter', () => {
    it('escapes comma', () => {
      expect(escapePostgrestFilter('a,b')).toBe('a\\,b');
    });

    it('escapes dot', () => {
      expect(escapePostgrestFilter('a.b')).toBe('a\\.b');
    });

    it('escapes parentheses', () => {
      expect(escapePostgrestFilter('a(b)')).toBe('a\\(b\\)');
    });

    it('escapes asterisk', () => {
      expect(escapePostgrestFilter('a*b')).toBe('a\\*b');
    });

    it('escapes percent (LIKE wildcard)', () => {
      expect(escapePostgrestFilter('100%')).toBe('100\\%');
    });

    it('escapes underscore (LIKE wildcard)', () => {
      expect(escapePostgrestFilter('a_b')).toBe('a\\_b');
    });

    it('escapes backslash first to avoid double-escaping', () => {
      expect(escapePostgrestFilter('a\\b')).toBe('a\\\\b');
    });

    it('escapes colon', () => {
      expect(escapePostgrestFilter('a:b')).toBe('a\\:b');
    });

    it('escapes double quote', () => {
      expect(escapePostgrestFilter('a"b')).toBe('a\\"b');
    });

    it('escapes multiple metacharacters including new ones', () => {
      expect(escapePostgrestFilter('bio.ilike.%test%,other')).toBe(
        'bio\\.ilike\\.\\%test\\%\\,other'
      );
    });

    it('returns clean string unchanged', () => {
      expect(escapePostgrestFilter('hello world')).toBe('hello world');
    });
  });
});
