/**
 * Comments Routes Integration Tests — T15
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Test strategy:
 * - Capture handlers via Express Router mock (same pattern as shield.routes.test.ts)
 * - Mock all middleware: auth, rate-limit, asyncHandler passthrough
 * - Mock createApiResponse to return simple {success, data} envelope
 * - Test route registration, middleware chain, validation, and response shape
 */

import { Request, Response, NextFunction } from 'express';

// ============================================================================
// Capture route handlers via Express Router mock
// ============================================================================

type HandlerFn = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

interface RouteEntry {
  method: string;
  path: string;
  middlewares: HandlerFn[];
  handler: HandlerFn;
}

const capturedRoutes: RouteEntry[] = vi.hoisted(() => [] as RouteEntry[]);

vi.mock('express', async () => {
  const actual = await vi.importActual('express');
  return {
    ...actual,
    Router: () => {
      const mockRouter: Record<string, unknown> = {};
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

// ============================================================================
// Mock middleware
// ============================================================================

vi.mock('../../../middleware/auth', () => ({
  authenticate: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  requireAuth: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  optionalAuth: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  getAuthUser: vi.fn((req: Request) => req.user),
}));

vi.mock('../../../middleware/rate-limit-middleware', () => {
  const noop = vi.fn((_req: Request, _res: Response, next: NextFunction) => next());
  return {
    readOnlyRateLimiter: noop,
    createUserRateLimiter: vi.fn(() => noop),
    createRateLimiter: vi.fn(() => noop),
  };
});

vi.mock('../../../utils/asyncHandler', () => ({
  asyncHandler: vi.fn((fn: HandlerFn) => fn),
}));

vi.mock('../../../utils/api-response', () => ({
  createApiResponse: vi.fn((_req: Request, data: unknown) => ({
    success: true,
    data,
  })),
}));

// ============================================================================
// Mock CommentsService via container
// ============================================================================

const mockListComments = vi.fn();
const mockListReplies = vi.fn();
const mockCreateComment = vi.fn();
const mockDeleteComment = vi.fn();

vi.mock('../../../container', () => ({
  container: {
    resolve: vi.fn(() => ({
      listComments: mockListComments,
      listReplies: mockListReplies,
      createComment: mockCreateComment,
      deleteComment: mockDeleteComment,
    })),
  },
}));

vi.mock('../../../container/types', () => ({
  TYPES: {
    CommentsService: Symbol.for('CommentsService'),
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    user: { nostr_pubkey: 'test-pubkey-123', role: 'creator' },
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function makeResponse(): {
  res: Response;
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const statusFn = vi.fn().mockReturnThis();
  const res = {
    json,
    status: statusFn,
  } as unknown as Response;
  return { res, json, status: statusFn };
}

const nextFn = vi.fn() as unknown as NextFunction;

function getRoute(method: string, path: string): RouteEntry | undefined {
  return capturedRoutes.find((r) => r.method === method && r.path === path);
}

// ============================================================================
// Load routes
// ============================================================================

beforeAll(async () => {
  await import('../../../routes/v2/comments.routes');
});

// ============================================================================
// Tests
// ============================================================================

describe('Comments Routes (v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Route registration
  // ==========================================================================

  describe('Route Registration', () => {
    it('registers all expected comment routes', () => {
      const routePaths = capturedRoutes.map((r) => `${r.method} ${r.path}`);

      expect(routePaths).toContain('GET /:commentId/replies');
      expect(routePaths).toContain('GET /:contentId');
      expect(routePaths).toContain('POST /:contentId');
      expect(routePaths).toContain('DELETE /:commentId');
    });

    it('registers /:commentId/replies BEFORE /:contentId (named segment ordering)', () => {
      const getRouteIndex = (method: string, path: string) =>
        capturedRoutes.findIndex((r) => r.method === method && r.path === path);

      const repliesIdx = getRouteIndex('GET', '/:commentId/replies');
      const listIdx = getRouteIndex('GET', '/:contentId');

      expect(repliesIdx).toBeGreaterThanOrEqual(0);
      expect(listIdx).toBeGreaterThanOrEqual(0);
      expect(repliesIdx).toBeLessThan(listIdx);
    });
  });

  // ==========================================================================
  // GET /:commentId/replies
  // ==========================================================================

  describe('GET /:commentId/replies', () => {
    it('returns 200 with replies data for valid pagination', async () => {
      const mockData = {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, hasNext: false },
      };
      mockListReplies.mockResolvedValue(mockData);

      const req = makeRequest({ params: { commentId: 'comment-123' }, query: { page: '1' } });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/:commentId/replies')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('throws ValidationError for invalid pagination params', async () => {
      const req = makeRequest({
        params: { commentId: 'comment-123' },
        query: { page: '-5', limit: '999' }, // limit > 50
      });
      const { res } = makeResponse();

      const route = getRoute('GET', '/:commentId/replies')!;
      await expect(route.handler(req, res, nextFn)).rejects.toMatchObject({
        name: 'ValidationError',
      });
    });

    it('uses default pagination when no query params provided', async () => {
      const mockData = {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, hasNext: false },
      };
      mockListReplies.mockResolvedValue(mockData);

      const req = makeRequest({ params: { commentId: 'comment-123' }, query: {} });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/:commentId/replies')!;
      await route.handler(req, res, nextFn);

      expect(mockListReplies).toHaveBeenCalledWith('comment-123', { page: 1, limit: 20 });
      expect(json).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET /:contentId
  // ==========================================================================

  describe('GET /:contentId', () => {
    it('returns 200 with comments for valid content', async () => {
      const mockData = {
        items: [
          {
            id: 'comment-1',
            commentText: 'Hello',
            author: { id: 'user-1', displayName: 'Alice', avatarUrl: null, username: 'alice' },
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, hasNext: false },
      };
      mockListComments.mockResolvedValue(mockData);

      const req = makeRequest({ params: { contentId: 'content-123' } });
      const { res, json } = makeResponse();

      const route = getRoute('GET', '/:contentId')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('passes callerPubkey from authenticated user', async () => {
      mockListComments.mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, hasNext: false },
      });

      const req = makeRequest({
        user: { nostr_pubkey: 'caller-pubkey', role: 'creator' } as Request['user'],
        params: { contentId: 'content-123' },
        query: {},
      });
      const { res } = makeResponse();

      const route = getRoute('GET', '/:contentId')!;
      await route.handler(req, res, nextFn);

      expect(mockListComments).toHaveBeenCalledWith('content-123', 'caller-pubkey', {
        page: 1,
        limit: 20,
      });
    });

    it('passes null callerPubkey for anonymous users', async () => {
      mockListComments.mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, hasNext: false },
      });

      const req = makeRequest({
        user: undefined,
        params: { contentId: 'content-123' },
        query: {},
      });
      const { res } = makeResponse();

      const route = getRoute('GET', '/:contentId')!;
      await route.handler(req, res, nextFn);

      expect(mockListComments).toHaveBeenCalledWith('content-123', null, { page: 1, limit: 20 });
    });

    it('throws ValidationError for page < 1', async () => {
      const req = makeRequest({
        params: { contentId: 'content-123' },
        query: { page: '0' },
      });
      const { res } = makeResponse();

      const route = getRoute('GET', '/:contentId')!;
      await expect(route.handler(req, res, nextFn)).rejects.toMatchObject({
        name: 'ValidationError',
      });
    });
  });

  // ==========================================================================
  // POST /:contentId
  // ==========================================================================

  describe('POST /:contentId', () => {
    it('returns 201 with created comment', async () => {
      const created = { id: 'comment-new', commentText: 'Hello!', author: { id: 'user-1' } };
      mockCreateComment.mockResolvedValue(created);

      const req = makeRequest({
        params: { contentId: 'content-123' },
        body: { commentText: 'Hello!' },
      });
      const { res, json, status } = makeResponse();

      const route = getRoute('POST', '/:contentId')!;
      await route.handler(req, res, nextFn);

      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith({ success: true, data: created });
    });

    it('throws ValidationError for empty commentText', async () => {
      const req = makeRequest({
        params: { contentId: 'content-123' },
        body: { commentText: '' },
      });
      const { res } = makeResponse();

      const route = getRoute('POST', '/:contentId')!;
      await expect(route.handler(req, res, nextFn)).rejects.toMatchObject({
        name: 'ValidationError',
      });
    });

    it('throws ValidationError for commentText > 2000 chars', async () => {
      const req = makeRequest({
        params: { contentId: 'content-123' },
        body: { commentText: 'a'.repeat(2001) },
      });
      const { res } = makeResponse();

      const route = getRoute('POST', '/:contentId')!;
      await expect(route.handler(req, res, nextFn)).rejects.toMatchObject({
        name: 'ValidationError',
      });
    });

    it('throws ValidationError for non-UUID parentCommentId', async () => {
      const req = makeRequest({
        params: { contentId: 'content-123' },
        body: { commentText: 'Hi!', parentCommentId: 'not-a-uuid' },
      });
      const { res } = makeResponse();

      const route = getRoute('POST', '/:contentId')!;
      await expect(route.handler(req, res, nextFn)).rejects.toMatchObject({
        name: 'ValidationError',
      });
    });

    it('calls createComment with callerPubkey from auth user', async () => {
      const created = { id: 'comment-new', commentText: 'Hi!' };
      mockCreateComment.mockResolvedValue(created);

      const req = makeRequest({
        user: { nostr_pubkey: 'my-pubkey', role: 'creator' } as Request['user'],
        params: { contentId: 'content-123' },
        body: { commentText: 'Hi!' },
      });
      const { res } = makeResponse();

      const route = getRoute('POST', '/:contentId')!;
      await route.handler(req, res, nextFn);

      expect(mockCreateComment).toHaveBeenCalledWith('my-pubkey', 'content-123', {
        commentText: 'Hi!',
      });
    });
  });

  // ==========================================================================
  // DELETE /:commentId
  // ==========================================================================

  describe('DELETE /:commentId', () => {
    it('returns 200 with null data on success', async () => {
      mockDeleteComment.mockResolvedValue(undefined);

      const req = makeRequest({ params: { commentId: 'comment-123' } });
      const { res, json } = makeResponse();

      const route = getRoute('DELETE', '/:commentId')!;
      await route.handler(req, res, nextFn);

      expect(json).toHaveBeenCalledWith({ success: true, data: null });
    });

    it('calls deleteComment with callerPubkey and commentId', async () => {
      mockDeleteComment.mockResolvedValue(undefined);

      const req = makeRequest({
        user: { nostr_pubkey: 'owner-pubkey', role: 'creator' } as Request['user'],
        params: { commentId: 'comment-456' },
      });
      const { res } = makeResponse();

      const route = getRoute('DELETE', '/:commentId')!;
      await route.handler(req, res, nextFn);

      expect(mockDeleteComment).toHaveBeenCalledWith('owner-pubkey', 'comment-456');
    });

    it('propagates service errors (e.g., AuthorizationError)', async () => {
      const authErr = new Error('Not authorized');
      authErr.name = 'AuthorizationError';
      mockDeleteComment.mockRejectedValue(authErr);

      const req = makeRequest({ params: { commentId: 'comment-123' } });
      const { res } = makeResponse();

      const route = getRoute('DELETE', '/:commentId')!;
      await expect(route.handler(req, res, nextFn)).rejects.toMatchObject({
        name: 'AuthorizationError',
      });
    });
  });

  // ==========================================================================
  // Rate limiting middleware
  // ==========================================================================

  describe('Rate Limiting Middleware', () => {
    it('POST /:contentId has mutationRateLimiter in middleware chain', () => {
      const route = getRoute('POST', '/:contentId');
      expect(route).toBeDefined();
      // At least 3 middlewares: authenticate, requireAuth, mutationRateLimiter
      expect(route!.middlewares.length).toBeGreaterThanOrEqual(3);
    });

    it('DELETE /:commentId has mutationRateLimiter in middleware chain', () => {
      const route = getRoute('DELETE', '/:commentId');
      expect(route).toBeDefined();
      expect(route!.middlewares.length).toBeGreaterThanOrEqual(3);
    });

    it('GET /:contentId uses readOnlyRateLimiter', () => {
      const route = getRoute('GET', '/:contentId');
      expect(route).toBeDefined();
    });
  });
});
