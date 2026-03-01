/**
 * Correlation ID Middleware Tests
 *
 * Tests UUID generation, header reuse (X-Correlation-ID and X-Request-ID),
 * response header setting, and AsyncLocalStorage context propagation.
 */

import { Request, Response, NextFunction } from 'express';
import {
  correlationIdMiddleware,
  getCorrelationId,
  getRequestContext,
} from '../../middleware/correlation-id';

function createMockReq(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string> = {};
  const req = {
    method: 'GET',
    path: '/api/test',
    headers,
    ...overrides,
    get(name: string) {
      const lower = name.toLowerCase();
      return (
        (overrides.headers as Record<string, string>)?.[lower] ??
        headers[lower] ??
        (overrides.headers as Record<string, string>)?.[name] ??
        headers[name]
      );
    },
    header(name: string) {
      return (req as any).get(name);
    },
  };
  return req as unknown as Request;
}

function createMockRes(): Response & { _headers: Record<string, string> } {
  const res: any = {
    _headers: {},
    setHeader: vi.fn(function (name: string, value: string) {
      res._headers[name] = value;
      return res;
    }),
  };
  return res;
}

/** Run middleware and return the RequestContext captured inside next() */
function runMiddleware(req: Request, res: Response): Promise<ReturnType<typeof getRequestContext>> {
  return new Promise((resolve) => {
    const next: NextFunction = () => {
      resolve(getRequestContext());
    };
    correlationIdMiddleware(req, res, next);
  });
}

describe('Correlation ID Middleware', () => {
  describe('UUID generation', () => {
    it('should generate a UUID when no correlation header is present', async () => {
      const req = createMockReq();
      const res = createMockRes();

      const context = await runMiddleware(req, res);

      expect(context).toBeDefined();
      expect(context!.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should generate unique IDs for each request', async () => {
      const ids: string[] = [];

      for (let i = 0; i < 3; i++) {
        const req = createMockReq();
        const res = createMockRes();
        const context = await runMiddleware(req, res);
        ids.push(context!.correlationId);
      }

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Header reuse', () => {
    it('should reuse X-Correlation-ID header if present', async () => {
      const existingId = 'existing-correlation-id-123';
      const req = createMockReq({
        headers: { 'x-correlation-id': existingId },
      });
      const res = createMockRes();

      const context = await runMiddleware(req, res);

      expect(context!.correlationId).toBe(existingId);
    });

    it('should reuse X-Request-ID header if present', async () => {
      const existingId = 'existing-request-id-456';
      const req = createMockReq({
        headers: { 'x-request-id': existingId },
      });
      const res = createMockRes();

      const context = await runMiddleware(req, res);

      expect(context!.correlationId).toBe(existingId);
    });

    it('should prefer X-Correlation-ID over X-Request-ID', async () => {
      const correlationId = 'correlation-takes-priority';
      const requestId = 'request-id-lower-priority';
      const req = createMockReq({
        headers: {
          'x-correlation-id': correlationId,
          'x-request-id': requestId,
        },
      });
      const res = createMockRes();

      const context = await runMiddleware(req, res);

      expect(context!.correlationId).toBe(correlationId);
    });
  });

  describe('Response header', () => {
    it('should set X-Correlation-ID response header', async () => {
      const req = createMockReq();
      const res = createMockRes();

      await runMiddleware(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', expect.any(String));
      expect(res._headers['X-Correlation-ID']).toBeTruthy();
    });

    it('should set response header to the same ID available in context', async () => {
      const req = createMockReq();
      const res = createMockRes();

      const context = await runMiddleware(req, res);

      expect(res._headers['X-Correlation-ID']).toBe(context!.correlationId);
    });
  });

  describe('AsyncLocalStorage context', () => {
    it('should provide full RequestContext in AsyncLocalStorage', async () => {
      const req = createMockReq({ method: 'POST', path: '/api/users' });
      const res = createMockRes();

      const context = await runMiddleware(req, res);

      expect(context).toBeDefined();
      expect(context!.correlationId).toBeTruthy();
      expect(context!.requestStartTime).toBeGreaterThan(0);
      expect(context!.method).toBe('POST');
      expect(context!.path).toBe('/api/users');
    });

    it('should return undefined context outside request lifecycle', () => {
      const context = getRequestContext();
      expect(context).toBeUndefined();
    });

    it('should return "no-context" for getCorrelationId outside request lifecycle', () => {
      const id = getCorrelationId();
      expect(id).toBe('no-context');
    });

    it('should return the correlation ID via getCorrelationId helper', async () => {
      const req = createMockReq();
      const res = createMockRes();

      let capturedId: string = '';
      await new Promise<void>((resolve) => {
        const next: NextFunction = () => {
          capturedId = getCorrelationId();
          resolve();
        };
        correlationIdMiddleware(req, res, next);
      });

      expect(capturedId).not.toBe('no-context');
      expect(typeof capturedId).toBe('string');
      expect(capturedId.length).toBeGreaterThan(0);
    });
  });

  describe('Request start time tracking', () => {
    it('should capture requestStartTime close to current time', async () => {
      const before = Date.now();
      const req = createMockReq();
      const res = createMockRes();

      const context = await runMiddleware(req, res);

      const after = Date.now();
      expect(context!.requestStartTime).toBeGreaterThanOrEqual(before);
      expect(context!.requestStartTime).toBeLessThanOrEqual(after);
    });
  });
});
