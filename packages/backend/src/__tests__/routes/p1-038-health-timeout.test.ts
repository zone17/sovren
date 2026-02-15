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

const capturedRoutes: Record<string, Function> = {};

jest.mock('express', () => {
  const actual = jest.requireActual('express');
  return {
    ...actual,
    Router: () => {
      const mockRouter: any = {};
      mockRouter.get = jest.fn((path: string, handler: Function) => {
        capturedRoutes[`GET ${path}`] = handler;
        return mockRouter;
      });
      mockRouter.post = jest.fn((path: string, handler: Function) => {
        capturedRoutes[`POST ${path}`] = handler;
        return mockRouter;
      });
      return mockRouter;
    },
  };
});

// Mock ioredis (used by lib/redis)
const mockRedisPing = jest.fn().mockResolvedValue('PONG');
const mockRedisQuit = jest.fn().mockResolvedValue(undefined);
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: mockRedisPing,
    quit: mockRedisQuit,
    on: jest.fn(),
  }));
});

// Mock @supabase/supabase-js
const mockSupabaseSelect = jest.fn().mockReturnThis();
const mockSupabaseLimit = jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: mockSupabaseSelect,
      limit: mockSupabaseLimit,
    }),
  }),
}));

// Mock global fetch for LNbits
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Track WebSocket close calls
const mockWsClose = jest.fn();
let wsInstance: any = null;

// Mock WebSocket for NOSTR relay checks
jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => {
    wsInstance = {
      close: mockWsClose,
      onopen: null as (() => void) | null,
      onerror: null as ((err: any) => void) | null,
    };
    return wsInstance;
  });
});

// Import after mocks
import '../../routes/health';

function createMockRes(): Response & { _status: number; _json: any } {
  const res: any = {
    _status: 200,
    _json: null,
    status: jest.fn(function (code: number) {
      res._status = code;
      return res;
    }),
    json: jest.fn(function (body: any) {
      res._json = body;
      return res;
    }),
    redirect: jest.fn(),
  };
  return res;
}

describe('P1-038: Health Check Timeout & WebSocket Leak', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      jest.useFakeTimers();

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
      jest.advanceTimersByTime(5500);

      await handlerPromise;

      jest.useRealTimers();

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
      const WS = require('ws');
      WS.mockImplementation(() => {
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

      const WS = require('ws');
      WS.mockImplementation(() => {
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
      jest.useFakeTimers();
      process.env.NOSTR_RELAYS = 'wss://relay.example.com';

      const WS = require('ws');
      WS.mockImplementation(() => {
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

      // Advance past the 5s WebSocket timeout
      jest.advanceTimersByTime(6000);

      await handlerPromise;

      jest.useRealTimers();

      // WebSocket should be closed via finally block even on timeout
      expect(mockWsClose).toHaveBeenCalled();
      expect(res._json.services.nostr.status).toBe('unhealthy');
    });
  });
});
