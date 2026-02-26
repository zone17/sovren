/**
 * CSRF Middleware Tests
 *
 * Tests the double-submit cookie pattern CSRF protection middleware.
 * Covers token generation, validation, rejection, rotation, safe methods,
 * excluded paths, cookie attributes, timing-safe comparison, body field
 * fallback, and malformed cookie handling.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { csrfProtection } from '../../middleware/csrf';

// Helper to create mock Express req/res/next
function createMockReq(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string> = {};
  const req = {
    method: 'GET',
    path: '/api/test',
    url: '/api/test',
    cookies: {},
    headers,
    body: {},
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

function createMockRes(): Response & {
  _cookies: Record<string, { value: string; options: any }>;
  _headers: Record<string, string>;
  _status: number;
  _json: any;
} {
  const res: any = {
    _cookies: {},
    _headers: {},
    _status: 200,
    _json: null,
    locals: {},
    cookie: vi.fn(function (name: string, value: string, options: any) {
      res._cookies[name] = { value, options };
      return res;
    }),
    setHeader: vi.fn(function (name: string, value: string) {
      res._headers[name] = value;
      return res;
    }),
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

describe('CSRF Middleware', () => {
  let middleware: (req: Request, res: Response, next: NextFunction) => void;
  let next: any;

  beforeEach(() => {
    middleware = csrfProtection();
    next = vi.fn();
  });

  describe('Token generation on safe methods (GET/HEAD/OPTIONS)', () => {
    it('should generate a CSRF token and set cookie + header on GET', () => {
      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('_csrf', expect.any(String), expect.any(Object));
      const token = res._cookies['_csrf'].value;
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(res.locals.csrfToken).toBe(token);
      expect(res._headers['X-CSRF-Token']).toBe(token);
    });

    it('should generate a token on HEAD requests', () => {
      const req = createMockReq({ method: 'HEAD' });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._cookies['_csrf']).toBeDefined();
    });

    it('should generate a token on OPTIONS requests', () => {
      const req = createMockReq({ method: 'OPTIONS' });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._cookies['_csrf']).toBeDefined();
    });

    it('should reuse existing valid token from cookie', () => {
      const existingToken = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'GET',
        cookies: { _csrf: existingToken },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._cookies['_csrf'].value).toBe(existingToken);
    });
  });

  describe('Token validation on state-changing methods (POST/PUT/DELETE/PATCH)', () => {
    it('should pass when cookie token matches header token on POST', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'POST',
        cookies: { _csrf: token },
        headers: { 'x-csrf-token': token },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._status).toBe(200); // Not set to 403
    });

    it('should pass when cookie token matches header token on PUT', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'PUT',
        cookies: { _csrf: token },
        headers: { 'x-csrf-token': token },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should pass when cookie token matches header token on DELETE', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'DELETE',
        cookies: { _csrf: token },
        headers: { 'x-csrf-token': token },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should pass when cookie token matches header token on PATCH', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'PATCH',
        cookies: { _csrf: token },
        headers: { 'x-csrf-token': token },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Missing token rejection', () => {
    it('should reject POST with 403 when cookie token is missing', () => {
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-csrf-token': 'some-token' },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('should reject POST with 403 when submitted token is missing', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'POST',
        cookies: { _csrf: token },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('should reject POST with 403 when both tokens are missing', () => {
      const req = createMockReq({ method: 'POST' });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('CSRF_TOKEN_MISSING');
    });
  });

  describe('Invalid/tampered token rejection', () => {
    it('should reject POST with 403 when tokens do not match', () => {
      const cookieToken = crypto.randomBytes(32).toString('hex');
      const tamperedToken = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'POST',
        cookies: { _csrf: cookieToken },
        headers: { 'x-csrf-token': tamperedToken },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('should reject when tokens have different lengths', () => {
      const cookieToken = crypto.randomBytes(32).toString('hex');
      const shortToken = 'abc123';
      const req = createMockReq({
        method: 'POST',
        cookies: { _csrf: cookieToken },
        headers: { 'x-csrf-token': shortToken },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.code).toBe('CSRF_TOKEN_INVALID');
    });
  });

  describe('Token rotation after successful validation', () => {
    it('should set a new token after successful POST validation', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'POST',
        cookies: { _csrf: token },
        headers: { 'x-csrf-token': token },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const newToken = res._cookies['_csrf'].value;
      expect(newToken).toHaveLength(64);
      expect(newToken).not.toBe(token);
      expect(res.locals.csrfToken).toBe(newToken);
      expect(res._headers['X-CSRF-Token']).toBe(newToken);
    });
  });

  describe('Excluded paths bypass', () => {
    const excludedPaths = [
      '/health',
      '/metrics',
      '/api/security/csp-report',
      '/api/v1/payments/webhooks',
      '/ready',
      '/live',
    ];

    excludedPaths.forEach((path) => {
      it(`should bypass CSRF validation for ${path}`, () => {
        const req = createMockReq({ method: 'POST', path, url: path });
        const res = createMockRes();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalledWith(403);
      });
    });

    it('should bypass for paths that start with an excluded prefix', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/v1/payments/webhooks/stripe',
        url: '/api/v1/payments/webhooks/stripe',
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Cookie attributes', () => {
    it('should set SameSite to strict by default', () => {
      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();

      middleware(req, res, next);

      expect(res._cookies['_csrf'].options.sameSite).toBe('strict');
    });

    it('should set httpOnly to false (must be readable by JS)', () => {
      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();

      middleware(req, res, next);

      expect(res._cookies['_csrf'].options.httpOnly).toBe(false);
    });

    it('should set path to /', () => {
      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();

      middleware(req, res, next);

      expect(res._cookies['_csrf'].options.path).toBe('/');
    });

    it('should respect custom cookie options', () => {
      const customMiddleware = csrfProtection({
        cookie: {
          sameSite: 'strict',
          secure: true,
        },
      });
      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();

      customMiddleware(req, res, next);

      expect(res._cookies['_csrf'].options.sameSite).toBe('strict');
      expect(res._cookies['_csrf'].options.secure).toBe(true);
    });
  });

  describe('Timing-safe comparison', () => {
    it('should use timing-safe comparison for token matching', () => {
      const spy = vi.spyOn(crypto, 'timingSafeEqual');
      const token = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'POST',
        cookies: { _csrf: token },
        headers: { 'x-csrf-token': token },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Body field fallback (_csrf in body)', () => {
    it('should accept token from _csrf body field when header is absent', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'POST',
        cookies: { _csrf: token },
        body: { _csrf: token },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should prefer header over body field', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const wrongToken = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'POST',
        cookies: { _csrf: token },
        headers: { 'x-csrf-token': token },
        body: { _csrf: wrongToken },
      });
      const res = createMockRes();

      middleware(req, res, next);

      // Should pass because header matches cookie
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Malformed cookie handling', () => {
    it('should generate a new token when cookie is too short', () => {
      const req = createMockReq({
        method: 'GET',
        cookies: { _csrf: 'tooshort' },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const newToken = res._cookies['_csrf'].value;
      expect(newToken).toHaveLength(64);
      expect(newToken).not.toBe('tooshort');
    });

    it('should generate a new token when cookie is not a string', () => {
      const req = createMockReq({
        method: 'GET',
        cookies: { _csrf: 12345 as any },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const newToken = res._cookies['_csrf'].value;
      expect(newToken).toHaveLength(64);
    });

    it('should generate a new token when cookie is empty string', () => {
      const req = createMockReq({
        method: 'GET',
        cookies: { _csrf: '' },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const newToken = res._cookies['_csrf'].value;
      expect(newToken).toHaveLength(64);
    });

    it('should generate a new token when cookie is wrong length', () => {
      const req = createMockReq({
        method: 'GET',
        cookies: { _csrf: 'a'.repeat(63) }, // 63 instead of 64
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const newToken = res._cookies['_csrf'].value;
      expect(newToken).toHaveLength(64);
    });
  });

  describe('Custom excluded paths', () => {
    it('should allow custom excluded paths', () => {
      const customMiddleware = csrfProtection({
        excludePaths: ['/custom/webhook'],
      });
      const req = createMockReq({
        method: 'POST',
        path: '/custom/webhook',
        url: '/custom/webhook',
      });
      const res = createMockRes();

      customMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Bearer token bypass (machine clients)', () => {
    it('should bypass CSRF validation for POST with Bearer token', () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer some-valid-jwt-token' },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it('should bypass CSRF validation for PUT with Bearer token', () => {
      const req = createMockReq({
        method: 'PUT',
        headers: { authorization: 'Bearer another-token' },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it('should bypass CSRF validation for DELETE with Bearer token', () => {
      const req = createMockReq({
        method: 'DELETE',
        headers: { authorization: 'Bearer delete-token' },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it('should NOT bypass for non-Bearer authorization schemes', () => {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });
      const res = createMockRes();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Custom safe methods', () => {
    it('should allow custom safe methods', () => {
      const customMiddleware = csrfProtection({
        safeMethods: ['GET', 'HEAD', 'OPTIONS', 'TRACE'],
      });
      const req = createMockReq({ method: 'TRACE' });
      const res = createMockRes();

      customMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._cookies['_csrf']).toBeDefined();
    });
  });
});
