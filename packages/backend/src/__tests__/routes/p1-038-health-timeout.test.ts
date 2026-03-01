/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * P1-038: Health Check Timeout & WebSocket Leak Tests
 *
 * Verifies:
 * - checkDatabase() returns unhealthy when Supabase query hangs past 5s
 * - checkNostr() closes WebSocket in all paths (success, error, timeout)
 */

import { Request, Response } from 'express';

// --- Capture route handlers via Express Router mock ---

const capturedRoutes: Record<string, Function> = vi.hoisted(() => ({}));

vi.mock('express', async () => {
  const actual = await vi.importActual('express');
  return {
    ...actual,
    Router: () => {
      const mockRouter: any = {};
      mockRouter.get = vi.fn((path: string, handler: Function) => {
        capturedRoutes[`GET ${path}`] = handler;
        return mockRouter;
      });
      mockRouter.post = vi.fn((path: string, handler: Function) => {
        capturedRoutes[`POST ${path}`] = handler;
        return mockRouter;
      });
      return mockRouter;
    },
  };
});

// Use vi.hoisted() to declare mock functions before vi.mock factories run (hoisting)
const {
  mockRedisPing,
  mockRedisQuit,
  mockSupabaseSelect,
  mockSupabaseLimit,
  mockFetch,
  mockWsClose,
} = vi.hoisted(() => ({
  mockRedisPing: vi.fn().mockResolvedValue('PONG'),
  mockRedisQuit: vi.fn().mockResolvedValue(undefined),
  mockSupabaseSelect: vi.fn().mockReturnThis(),
  mockSupabaseLimit: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
  mockFetch: vi.fn(),
  mockWsClose: vi.fn(),
}));

let wsInstance: any = null;

// Mock lib/redis — health route uses isRedisAvailable() and getRedisClient()
vi.mock('../../lib/redis', () => ({
  isRedisAvailable: vi.fn().mockReturnValue(true),
  getRedisClient: vi.fn(() => ({
    ping: mockRedisPing,
  })),
}));

// Mock ioredis (may be imported transitively)
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    ping: mockRedisPing,
    quit: mockRedisQuit,
    on: vi.fn(),
  })),
}));

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: mockSupabaseSelect,
      limit: mockSupabaseLimit,
    }),
  }),
}));

// Mock container for queue health checks
vi.mock('../../container', () => ({
  container: {
    resolveOptional: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../../container/types', () => ({
  TYPES: { QueueService: Symbol('QueueService') },
}));

// Mock logger to suppress output
vi.mock('../../lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock global fetch for LNbits
global.fetch = mockFetch as any;

// Mock WebSocket for NOSTR relay checks — hoist the mock constructor
const { mockWsConstructor } = vi.hoisted(() => ({
  mockWsConstructor: vi.fn(),
}));

vi.mock('ws', () => ({
  default: mockWsConstructor,
  __esModule: true,
}));

// Import after mocks
import '../../routes/health';

function createMockRes(): Response & { _status: number; _json: any } {
  const res: any = {
    _status: 200,
    _json: null,
    status: vi.fn(function (code: number) {
      res._status = code;
      return res;
    }),
    json: vi.fn(function (body: any) {
      res._json = body;
      return res;
    }),
    redirect: vi.fn(),
  };
  return res;
}

describe('P1-038: Health Check Timeout & WebSocket Leak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisPing.mockResolvedValue('PONG');
    mockSupabaseSelect.mockReturnThis();
    mockSupabaseLimit.mockResolvedValue({ data: [{ id: 1 }], error: null });
    mockFetch.mockReset();
    delete process.env.LNBITS_API_URL;
    delete process.env.NOSTR_RELAYS;
    wsInstance = null;
  });

  describe('Database health check timeout (5s)', () => {
    it('should return unhealthy when Supabase query hangs past 5s', async () => {
      vi.useFakeTimers();

      // Mock Supabase to return a never-resolving promise
      mockSupabaseLimit.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves - simulates hanging database
          })
      );

      const handler = capturedRoutes['GET /health/detailed'];
      const req = { method: 'GET', path: '/health/detailed' } as unknown as Request;
      const res = createMockRes();

      const handlerPromise = handler(req, res);

      // Advance time past the 5s timeout
      vi.advanceTimersByTime(5500);

      await handlerPromise;

      vi.useRealTimers();

      // The database service should be unhealthy due to timeout
      expect(res._json.services.database.status).toBe('unhealthy');
      expect(res._json.services.database.error).toContain('timed out');
    });

    it('should return healthy when database responds within timeout', async () => {
      // Normal fast response
      mockSupabaseLimit.mockResolvedValue({ data: [{ id: 1 }], error: null });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = { method: 'GET', path: '/health/detailed' } as unknown as Request;
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.database.status).toBe('healthy');
    });

    it('should return unhealthy with error message when database query fails', async () => {
      mockSupabaseLimit.mockResolvedValue({
        data: null,
        error: { message: 'connection refused' },
      });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = { method: 'GET', path: '/health/detailed' } as unknown as Request;
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.database.status).toBe('unhealthy');
      expect(res._json.services.database.error).toBe('connection refused');
    });
  });

  describe('NOSTR WebSocket cleanup', () => {
    it('should close WebSocket on successful connection', async () => {
      process.env.NOSTR_RELAYS = 'wss://relay.example.com';

      // Simulate successful connection
      mockWsConstructor.mockImplementation(() => {
        const ws: any = {
          close: mockWsClose,
          onopen: null,
          onerror: null,
        };
        // Trigger onopen after a microtask
        setTimeout(() => {
          if (ws.onopen) ws.onopen();
        }, 0);
        wsInstance = ws;
        return ws;
      });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = { method: 'GET', path: '/health/detailed' } as unknown as Request;
      const res = createMockRes();

      await handler(req, res);

      // WebSocket should be closed via finally block
      expect(mockWsClose).toHaveBeenCalled();
    });

    it('should close WebSocket on connection error', async () => {
      process.env.NOSTR_RELAYS = 'wss://relay.example.com';

      mockWsConstructor.mockImplementation(() => {
        const ws: any = {
          close: mockWsClose,
          onopen: null,
          onerror: null,
        };
        // Trigger onerror after a microtask
        setTimeout(() => {
          if (ws.onerror) ws.onerror(new Error('Connection failed'));
        }, 0);
        wsInstance = ws;
        return ws;
      });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = { method: 'GET', path: '/health/detailed' } as unknown as Request;
      const res = createMockRes();

      await handler(req, res);

      // WebSocket should still be closed even on error (via finally block)
      expect(mockWsClose).toHaveBeenCalled();
      expect(res._json.services.nostr.status).toBe('unhealthy');
    });

    it('should close WebSocket on timeout', async () => {
      vi.useFakeTimers();
      process.env.NOSTR_RELAYS = 'wss://relay.example.com';

      mockWsConstructor.mockImplementation(() => {
        const ws: any = {
          close: mockWsClose,
          onopen: null,
          onerror: null,
        };
        // Never triggers onopen or onerror - simulates hanging
        wsInstance = ws;
        return ws;
      });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = { method: 'GET', path: '/health/detailed' } as unknown as Request;
      const res = createMockRes();

      const handlerPromise = handler(req, res);

      // Advance past the 5s WebSocket timeout (use async variant to flush microtasks)
      await vi.advanceTimersByTimeAsync(6000);

      await handlerPromise;

      vi.useRealTimers();

      // WebSocket should be closed via finally block even on timeout
      expect(mockWsClose).toHaveBeenCalled();
      expect(res._json.services.nostr.status).toBe('unhealthy');
    });
  });
});
