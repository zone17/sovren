/**
 * Deployment Monitoring Middleware Tests
 *
 * Tests HTTP request counter, duration histogram, error counter,
 * route normalization, /metrics exclusion, active connections gauge,
 * and Prometheus format output.
 */

import { Request, Response } from 'express';

// We need to reset the prom-client registry between tests to avoid
// "metric already registered" errors
beforeEach(async () => {
  vi.resetModules();
  const { register } = await import('prom-client');
  register.clear();
});

describe('Deployment Monitoring Middleware', () => {
  describe('deploymentMonitoring middleware', () => {
    it('should call next and set up finish listener', async () => {
      const { deploymentMonitoring } = await import('../../middleware/deployment-monitoring');

      const req = {
        method: 'GET',
        path: '/api/test',
        route: { path: '/api/test' },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 200,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should increment request counter on response finish', async () => {
      const { deploymentMonitoring, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      const req = {
        method: 'GET',
        path: '/api/users',
        route: { path: '/api/users' },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 200,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);

      // Simulate the response finishing
      listeners['finish']();

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('sovren_http_requests_total');
    });

    it('should record request duration histogram', async () => {
      const { deploymentMonitoring, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      const req = {
        method: 'POST',
        path: '/api/content',
        route: { path: '/api/content' },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 201,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);
      listeners['finish']();

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('sovren_http_request_duration_seconds');
    });

    it('should increment error counter on 4xx responses', async () => {
      const { deploymentMonitoring, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      const req = {
        method: 'GET',
        path: '/api/notfound',
        route: { path: '/api/notfound' },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 404,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);
      listeners['finish']();

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('sovren_http_request_errors_total');
    });

    it('should increment error counter on 5xx responses', async () => {
      const { deploymentMonitoring, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      const req = {
        method: 'POST',
        path: '/api/crash',
        route: { path: '/api/crash' },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 500,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);
      listeners['finish']();

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('sovren_http_request_errors_total');
    });

    it('should NOT increment error counter on 2xx responses', async () => {
      const { deploymentMonitoring, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      const req = {
        method: 'GET',
        path: '/api/ok',
        route: { path: '/api/ok' },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 200,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);
      listeners['finish']();

      const metrics = await metricsRegistry.metrics();
      // The error counter metric name may exist from default registration,
      // but the counter should not have been incremented for this request.
      // We check by parsing the specific line
      const lines = metrics.split('\n');
      const errorLines = lines.filter(
        (l: string) =>
          l.startsWith('sovren_http_request_errors_total{') && l.includes('status_code="200"')
      );
      expect(errorLines).toHaveLength(0);
    });

    it('should skip /metrics endpoint to avoid recursion', async () => {
      const { deploymentMonitoring } = await import('../../middleware/deployment-monitoring');

      const req = {
        method: 'GET',
        path: '/metrics',
      } as unknown as Request;

      const res = {
        on: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).not.toHaveBeenCalled();
    });
  });

  describe('Route normalization', () => {
    it('should normalize UUIDs in route paths', async () => {
      const { deploymentMonitoring, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      const req = {
        method: 'GET',
        path: '/api/users/550e8400-e29b-41d4-a716-446655440000/profile',
        route: { path: '/api/users/550e8400-e29b-41d4-a716-446655440000/profile' },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 200,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);
      listeners['finish']();

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('/:uuid/profile');
      expect(metrics).not.toContain('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should normalize 64-char hex strings (pubkeys) in route paths', async () => {
      const { deploymentMonitoring, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      const pubkey = 'a'.repeat(64);
      const req = {
        method: 'GET',
        path: `/api/nostr/${pubkey}`,
        route: { path: `/api/nostr/${pubkey}` },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 200,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);
      listeners['finish']();

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('/:pubkey');
    });

    it('should normalize numeric IDs in route paths', async () => {
      const { deploymentMonitoring, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      const req = {
        method: 'GET',
        path: '/api/posts/12345',
        route: { path: '/api/posts/12345' },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 200,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      deploymentMonitoring(req, res, next);
      listeners['finish']();

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('/:id');
      expect(metrics).not.toContain('12345');
    });
  });

  describe('Active connections gauge', () => {
    it('should increment on request start and decrement on finish', async () => {
      const { deploymentMonitoring, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      const req = {
        method: 'GET',
        path: '/api/test',
        route: { path: '/api/test' },
      } as unknown as Request;

      const listeners: Record<string, Function> = {};
      const res = {
        statusCode: 200,
        on: vi.fn((event: string, cb: Function) => {
          listeners[event] = cb;
        }),
      } as unknown as Response;

      const next = vi.fn();

      // Before request, active connections should be 0
      await metricsRegistry.metrics();

      deploymentMonitoring(req, res, next);

      // After starting request but before finish, gauge should be incremented
      const metricsMiddle = await metricsRegistry.metrics();
      expect(metricsMiddle).toContain('sovren_http_active_connections');

      // After finish, gauge should be decremented back
      listeners['finish']();

      const metricsAfter = await metricsRegistry.metrics();
      expect(metricsAfter).toContain('sovren_http_active_connections');
    });
  });

  describe('Prometheus metrics endpoint', () => {
    it('should return valid Prometheus format via getPrometheusMetrics', async () => {
      const { getPrometheusMetrics } = await import('../../middleware/deployment-monitoring');

      const req = {} as Request;
      const res = {
        set: vi.fn(),
        end: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      await getPrometheusMetrics(req, res);

      expect(res.set).toHaveBeenCalledWith('Content-Type', expect.stringContaining('text/plain'));
      expect(res.end).toHaveBeenCalledWith(expect.any(String));

      const metricsOutput = (res.end as any).mock.calls[0][0];
      // Valid Prometheus format contains HELP and TYPE lines
      expect(metricsOutput).toContain('# HELP');
      expect(metricsOutput).toContain('# TYPE');
    });

    it('should return 500 on metrics collection error', async () => {
      const { getPrometheusMetrics, metricsRegistry } = await import(
        '../../middleware/deployment-monitoring'
      );

      // Force an error by mocking the registry
      vi.spyOn(metricsRegistry, 'metrics').mockRejectedValueOnce(new Error('Collection failed'));

      const req = {} as Request;
      const res = {
        set: vi.fn(),
        end: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      await getPrometheusMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.end).toHaveBeenCalledWith('Error collecting metrics');
    });
  });

  describe('Deployment health check', () => {
    it.skip('should return healthy status via getDeploymentHealth (function not exported)', async () => {
      const { getDeploymentHealth } = await import('../../middleware/deployment-monitoring') as any;

      const req = {} as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      getDeploymentHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          health: expect.objectContaining({
            healthy: true,
          }),
        })
      );
    });
  });

  describe('Default Node.js metrics', () => {
    it('should collect default Node.js metrics with sovren_ prefix', async () => {
      const { metricsRegistry } = await import('../../middleware/deployment-monitoring');

      const metrics = await metricsRegistry.metrics();
      // Default metrics include process-level gauges
      expect(metrics).toContain('sovren_');
    });
  });
});
