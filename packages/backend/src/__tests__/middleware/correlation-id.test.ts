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
      return (overrides.headers as Record<string, string>)?.[lower] ?? headers[lower] ?? (overrides.headers as Record<string, string>)?.[name] ?? headers[name];
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

describe('Correlation ID Middleware', () => {
  describe('UUID generation', () => {
    it('should generate a UUID when no correlation header is present', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      const next: NextFunction = () => {
        const context = getRequestContext();
        expect(context).toBeDefined();
        expect(context!.correlationId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
        done();
      };

      correlationIdMiddleware(req, res, next);
    });

    it('should generate unique IDs for each request', (done) => {
      const ids: string[] = [];
      let completed = 0;

      for (let i = 0; i < 3; i++) {
        const req = createMockReq();
        const res = createMockRes();

        const next: NextFunction = () => {
          const context = getRequestContext();
          ids.push(context!.correlationId);
          completed++;

          if (completed === 3) {
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(3);
            done();
          }
        };

        correlationIdMiddleware(req, res, next);
      }
    });
  });

  describe('Header reuse', () => {
    it('should reuse X-Correlation-ID header if present', (done) => {
      const existingId = 'existing-correlation-id-123';
      const req = createMockReq({
        headers: { 'x-correlation-id': existingId },
      });
      const res = createMockRes();

      const next: NextFunction = () => {
        const context = getRequestContext();
        expect(context!.correlationId).toBe(existingId);
        done();
      };

      correlationIdMiddleware(req, res, next);
    });

    it('should reuse X-Request-ID header if present', (done) => {
      const existingId = 'existing-request-id-456';
      const req = createMockReq({
        headers: { 'x-request-id': existingId },
      });
      const res = createMockRes();

      const next: NextFunction = () => {
        const context = getRequestContext();
        expect(context!.correlationId).toBe(existingId);
        done();
      };

      correlationIdMiddleware(req, res, next);
    });

    it('should prefer X-Correlation-ID over X-Request-ID', (done) => {
      const correlationId = 'correlation-takes-priority';
      const requestId = 'request-id-lower-priority';
      const req = createMockReq({
        headers: {
          'x-correlation-id': correlationId,
          'x-request-id': requestId,
        },
      });
      const res = createMockRes();

      const next: NextFunction = () => {
        const context = getRequestContext();
        expect(context!.correlationId).toBe(correlationId);
        done();
      };

      correlationIdMiddleware(req, res, next);
    });
  });

  describe('Response header', () => {
    it('should set X-Correlation-ID response header', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      const next: NextFunction = () => {
        expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', expect.any(String));
        expect(res._headers['X-Correlation-ID']).toBeTruthy();
        done();
      };

      correlationIdMiddleware(req, res, next);
    });

    it('should set response header to the same ID available in context', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      const next: NextFunction = () => {
        const context = getRequestContext();
        expect(res._headers['X-Correlation-ID']).toBe(context!.correlationId);
        done();
      };

      correlationIdMiddleware(req, res, next);
    });
  });

  describe('AsyncLocalStorage context', () => {
    it('should provide full RequestContext in AsyncLocalStorage', (done) => {
      const req = createMockReq({ method: 'POST', path: '/api/users' });
      const res = createMockRes();

      const next: NextFunction = () => {
        const context = getRequestContext();
        expect(context).toBeDefined();
        expect(context!.correlationId).toBeTruthy();
        expect(context!.requestStartTime).toBeGreaterThan(0);
        expect(context!.method).toBe('POST');
        expect(context!.path).toBe('/api/users');
        done();
      };

      correlationIdMiddleware(req, res, next);
    });

    it('should return undefined context outside request lifecycle', () => {
      const context = getRequestContext();
      expect(context).toBeUndefined();
    });

    it('should return "no-context" for getCorrelationId outside request lifecycle', () => {
      const id = getCorrelationId();
      expect(id).toBe('no-context');
    });

    it('should return the correlation ID via getCorrelationId helper', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      const next: NextFunction = () => {
        const id = getCorrelationId();
        expect(id).not.toBe('no-context');
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        done();
      };

      correlationIdMiddleware(req, res, next);
    });
  });

  describe('Request start time tracking', () => {
    it('should capture requestStartTime close to current time', (done) => {
      const before = Date.now();
      const req = createMockReq();
      const res = createMockRes();

      const next: NextFunction = () => {
        const after = Date.now();
        const context = getRequestContext();
        expect(context!.requestStartTime).toBeGreaterThanOrEqual(before);
        expect(context!.requestStartTime).toBeLessThanOrEqual(after);
        done();
      };

      correlationIdMiddleware(req, res, next);
    });
  });
});
