/**
 * Health Route Tests
 *
 * Tests all health check endpoints: /health, /health/detailed, /ready, /live,
 * /health/ready, /health/live. Mocks external services (Supabase, Redis,
 * LNbits, WebSocket) to test all status scenarios.
 *
 * Strategy: Mock Express Router to capture route handlers without triggering
 * path-to-regexp (which is broken in the global jest.setup.js mock).
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
const { mockRedisPing, mockRedisAvailable, mockSupabaseSelect, mockSupabaseLimit, mockFetch, mockWsClose } = vi.hoisted(() => ({
  mockRedisPing: vi.fn().mockResolvedValue('PONG'),
  mockRedisAvailable: vi.fn().mockReturnValue(true),
  mockSupabaseSelect: vi.fn().mockReturnThis(),
  mockSupabaseLimit: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
  mockFetch: vi.fn(),
  mockWsClose: vi.fn(),
}));

// Mock lib/redis — the health route uses isRedisAvailable() and getRedisClient()
vi.mock('../../lib/redis', () => ({
  isRedisAvailable: mockRedisAvailable,
  getRedisClient: vi.fn(() => ({
    ping: mockRedisPing,
  })),
}));

// Mock ioredis (may be imported transitively)
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    ping: mockRedisPing,
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

// Mock WebSocket for NOSTR relay checks
vi.mock('ws', () => ({
  default: vi.fn().mockImplementation(() => {
    const ws: any = {
      close: mockWsClose,
      onopen: null as (() => void) | null,
      onerror: null as ((err: any) => void) | null,
      onclose: null as (() => void) | null,
      onmessage: null as ((msg: any) => void) | null,
    };
    // Trigger onopen after a microtask for successful connections
    setTimeout(() => {
      if (ws.onopen) ws.onopen();
    }, 0);
    return ws;
  }),
}));

// Import the module — this triggers Router mock and captures all route handlers
import '../../routes/health';

// --- Helpers ---

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/health',
    url: '/health',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

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
  };
  return res;
}

describe('Health Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default happy-path mocks
    mockRedisPing.mockResolvedValue('PONG');
    mockRedisAvailable.mockReturnValue(true);
    mockSupabaseSelect.mockReturnThis();
    mockSupabaseLimit.mockResolvedValue({ data: [{ id: 1 }], error: null });
    mockFetch.mockReset();
    mockWsClose.mockReset();
    // Clear env overrides
    delete process.env.LNBITS_API_URL;
    delete process.env.NOSTR_RELAYS;
  });

  describe('Route registration', () => {
    it('should register all expected routes', () => {
      expect(capturedRoutes['GET /health']).toBeDefined();
      expect(capturedRoutes['GET /live']).toBeDefined();
      expect(capturedRoutes['GET /ready']).toBeDefined();
      expect(capturedRoutes['GET /health/detailed']).toBeDefined();
      expect(capturedRoutes['GET /health/ready']).toBeDefined();
      expect(capturedRoutes['GET /health/live']).toBeDefined();
    });
  });

  describe('GET /health', () => {
    it('should return status healthy with correct structure', () => {
      const handler = capturedRoutes['GET /health'];
      const req = createMockReq();
      const res = createMockRes();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.status).toBe('healthy');
      expect(res._json.service).toBe('sovren-api');
      expect(res._json.timestamp).toBeDefined();
      expect(res._json.uptime).toBeDefined();
      expect(res._json.environment).toBeDefined();
      expect(res._json.memory).toBeDefined();
      expect(res._json.memory.heapUsedMB).toBeGreaterThanOrEqual(0);
      expect(res._json.memory.heapTotalMB).toBeGreaterThanOrEqual(0);
      expect(res._json.memory.percentage).toBeGreaterThanOrEqual(0);
    });

    it('should include version from env or default', () => {
      const handler = capturedRoutes['GET /health'];
      const req = createMockReq();
      const res = createMockRes();

      handler(req, res);

      expect(res._json.version).toBeDefined();
    });
  });

  describe('GET /live', () => {
    it('should return alive status with pid and uptime', () => {
      const handler = capturedRoutes['GET /live'];
      const req = createMockReq({ path: '/live' });
      const res = createMockRes();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.status).toBe('alive');
      expect(res._json.pid).toBe(process.pid);
      expect(res._json.uptime).toBeDefined();
      expect(res._json.timestamp).toBeDefined();
    });
  });

  describe('GET /ready', () => {
    it('should return ready when database and redis are healthy', async () => {
      const handler = capturedRoutes['GET /ready'];
      const req = createMockReq({ path: '/ready' });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.status).toBe('ready');
    });

    it('should return not-ready (503) when database is unhealthy', async () => {
      mockSupabaseLimit.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection refused' },
      });

      const handler = capturedRoutes['GET /ready'];
      const req = createMockReq({ path: '/ready' });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res._json.status).toBe('not-ready');
    });

    it('should return degraded (200) when redis is unavailable but DB is healthy', async () => {
      mockRedisAvailable.mockReturnValue(false);

      const handler = capturedRoutes['GET /ready'];
      const req = createMockReq({ path: '/ready' });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.status).toBe('degraded');
    });

    it('should return not-ready (503) when database check fails with exception', async () => {
      mockSupabaseLimit.mockRejectedValueOnce(new Error('Unexpected failure'));

      const handler = capturedRoutes['GET /ready'];
      const req = createMockReq({ path: '/ready' });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res._json.status).toBe('not-ready');
      // The inner checkDatabase catch handles the error and returns unhealthy status,
      // so the outer handler sees database as unhealthy and reports the issue
      expect(res._json.issues.database).toBeTruthy();
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health with all service checks when services are healthy', async () => {
      process.env.LNBITS_API_URL = 'http://localhost:5000';
      process.env.LNBITS_ADMIN_KEY = 'test-key';
      process.env.NOSTR_RELAYS = 'wss://relay.example.com';

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.status).toBeDefined();
      expect(res._json.services).toBeDefined();
      expect(res._json.services.database).toBeDefined();
      expect(res._json.services.redis).toBeDefined();
      expect(res._json.services.lightning).toBeDefined();
      expect(res._json.services.nostr).toBeDefined();
      expect(res._json.metrics).toBeDefined();
      expect(res._json.dependencies).toBeDefined();
      expect(res._json.dependencies.node).toBe(process.version);
    });

    it('should return unhealthy status when a critical service is unhealthy', async () => {
      mockRedisAvailable.mockReturnValue(false);

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.status).toBe('unhealthy');
      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('should return degraded status when optional services are unavailable', async () => {
      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.lightning.status).toBe('degraded');
      expect(res._json.services.nostr.status).toBe('degraded');
      expect(res._json.status).toBe('degraded');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 503 on unexpected error in the handler', async () => {
      mockSupabaseLimit.mockImplementationOnce(() => {
        throw new Error('Catastrophic failure');
      });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res._json.status).toBe('unhealthy');
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when critical services are healthy', async () => {
      const handler = capturedRoutes['GET /health/ready'];
      const req = createMockReq({ path: '/health/ready' });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.status).toBe('ready');
    });

    it('should return degraded when Redis is unavailable but DB is healthy', async () => {
      mockRedisAvailable.mockReturnValue(false);

      const handler = capturedRoutes['GET /health/ready'];
      const req = createMockReq({ path: '/health/ready' });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.status).toBe('degraded');
      expect(res._json.issues).toBeDefined();
      expect(res._json.issues.redis).toBeTruthy();
    });
  });

  describe('GET /health/live', () => {
    it('should return alive status', () => {
      const handler = capturedRoutes['GET /health/live'];
      const req = createMockReq({ path: '/health/live' });
      const res = createMockRes();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.status).toBe('alive');
      expect(res._json.pid).toBe(process.pid);
    });
  });

  describe('Database check', () => {
    it('should report unhealthy on database error', async () => {
      mockSupabaseLimit.mockResolvedValueOnce({
        data: null,
        error: { message: 'table not found' },
      });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.database.status).toBe('unhealthy');
      expect(res._json.services.database.error).toBe('table not found');
    });

    it('should include response time in database check', async () => {
      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.database.responseTime).toBeDefined();
      expect(typeof res._json.services.database.responseTime).toBe('number');
    });

    it('should report unhealthy when database connection throws', async () => {
      mockSupabaseLimit.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.database.status).toBe('unhealthy');
      expect(res._json.services.database.error).toBe('ECONNREFUSED');
    });
  });

  describe('Redis check', () => {
    it('should report unhealthy when Redis is not available', async () => {
      mockRedisAvailable.mockReturnValue(false);

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.redis.status).toBe('unhealthy');
      expect(res._json.services.redis.error).toContain('Redis not connected');
    });

    it('should report unhealthy when Redis ping throws', async () => {
      mockRedisAvailable.mockReturnValue(true);
      mockRedisPing.mockRejectedValueOnce(new Error('Connection refused'));

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.redis.status).toBe('unhealthy');
      expect(res._json.services.redis.error).toBe('Connection refused');
    });

    it('should report healthy with response time details on success', async () => {
      mockRedisAvailable.mockReturnValue(true);

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.redis.status).toBe('healthy');
      expect(res._json.services.redis.responseTime).toBeDefined();
      expect(res._json.services.redis.details).toBeDefined();
    });
  });

  describe('Lightning check', () => {
    it('should report degraded when LNbits URL is not configured', async () => {
      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.lightning.status).toBe('degraded');
      expect(res._json.services.lightning.error).toBe('LNbits URL not configured');
    });

    it('should report unhealthy when LNbits API returns non-ok status', async () => {
      process.env.LNBITS_API_URL = 'http://localhost:5000';
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.lightning.status).toBe('unhealthy');
      expect(res._json.services.lightning.error).toContain('500');
    });

    it('should report unhealthy when fetch throws a network error', async () => {
      process.env.LNBITS_API_URL = 'http://localhost:5000';
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.lightning.status).toBe('unhealthy');
      expect(res._json.services.lightning.error).toBe('Network error');
    });

    it('should report healthy when LNbits returns ok', async () => {
      process.env.LNBITS_API_URL = 'http://localhost:5000';
      process.env.LNBITS_ADMIN_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.lightning.status).toBe('healthy');
    });
  });

  describe('NOSTR check', () => {
    it('should report degraded when no relays are configured', async () => {
      process.env.NOSTR_RELAYS = '';

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.services.nostr.status).toBe('degraded');
      expect(res._json.services.nostr.error).toBe('No NOSTR relays configured');
    });
  });

  describe('Overall status aggregation', () => {
    it('should prioritize unhealthy over degraded', async () => {
      mockRedisAvailable.mockReturnValue(false);

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res._json.status).toBe('unhealthy');
    });

    it('should return healthy when all services are healthy', async () => {
      process.env.LNBITS_API_URL = 'http://localhost:5000';
      process.env.NOSTR_RELAYS = 'wss://relay.example.com';
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('System metrics', () => {
    it('should include memory, cpu, and process metrics', async () => {
      const handler = capturedRoutes['GET /health/detailed'];
      const req = createMockReq({ path: '/health/detailed' });
      const res = createMockRes();

      await handler(req, res);

      const metrics = res._json.metrics;
      expect(metrics.memory.used).toBeGreaterThan(0);
      expect(metrics.memory.total).toBeGreaterThan(0);
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.loadAverage).toHaveLength(3);
      expect(metrics.process.pid).toBe(process.pid);
      expect(metrics.process.uptime).toBeGreaterThan(0);
    });
  });
});
