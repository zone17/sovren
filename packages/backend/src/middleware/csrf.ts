/**
 * CSRF Protection Middleware (Double-Submit Cookie Pattern)
 *
 * US-E0-011: Security Pipeline Hardening
 *
 * Implements the synchronizer token / double-submit cookie pattern:
 * 1. On GET/HEAD/OPTIONS requests, generates a CSRF token, sets it in a
 *    cookie (`_csrf`), and attaches it to `res.locals.csrfToken` for
 *    server-rendered pages (or returns it in a response header).
 * 2. On POST/PUT/DELETE/PATCH requests, validates that the token
 *    submitted via the `x-csrf-token` header (or `_csrf` body field)
 *    matches the token in the `_csrf` cookie.
 *
 * This approach is stateless (no server-side token store) and works
 * correctly across multiple backend instances.
 */

import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_BODY_FIELD = '_csrf';
const TOKEN_LENGTH = 32; // 32 bytes = 64 hex chars

export interface CsrfOptions {
  /** Cookie options */
  cookie?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
  };
  /** Paths to exclude from CSRF validation (e.g., webhooks that use HMAC) */
  excludePaths?: string[];
  /** HTTP methods that are considered safe (no CSRF check) */
  safeMethods?: string[];
}

const DEFAULT_OPTIONS: Required<CsrfOptions> = {
  cookie: {
    httpOnly: false, // Must be readable by JS to send back in header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  },
  excludePaths: [
    '/api/security/csp-report',
    '/api/v1/payments/webhooks',
    '/api/auth/challenge',
    '/api/auth/authenticate',
    '/health',
    '/ready',
    '/live',
    '/metrics',
  ],
  safeMethods: ['GET', 'HEAD', 'OPTIONS'],
};

/**
 * Generate a cryptographically random CSRF token.
 */
function generateToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Timing-safe comparison of two token strings.
 */
function tokensMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Creates CSRF protection middleware.
 *
 * Usage:
 *   app.use(csrfProtection());
 *
 * For safe methods (GET), the middleware:
 *   - Generates a token if one is not already in the cookie
 *   - Sets the `_csrf` cookie
 *   - Sets `res.locals.csrfToken` and `X-CSRF-Token` response header
 *
 * For state-changing methods (POST, PUT, DELETE, PATCH), the middleware:
 *   - Reads the token from the `_csrf` cookie
 *   - Reads the submitted token from the `x-csrf-token` header or `_csrf` body field
 *   - Rejects the request with 403 if they don't match
 */
export function csrfProtection(
  options: CsrfOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    cookie: { ...DEFAULT_OPTIONS.cookie, ...(options.cookie || {}) },
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip excluded paths
    const requestPath = req.path || req.url;
    if (opts.excludePaths.some((p) => requestPath === p || requestPath.startsWith(p + '/'))) {
      next();
      return;
    }

    // Machine clients with token-based auth skip CSRF (CSRF only protects cookie-based auth)
    if (req.headers.authorization?.startsWith('Bearer ')) {
      next();
      return;
    }

    // For safe methods: issue/refresh the CSRF token
    if (opts.safeMethods.includes(req.method)) {
      let token = req.cookies?.[CSRF_COOKIE_NAME];

      // Generate a fresh token if none exists or the existing one is malformed
      if (!token || typeof token !== 'string' || token.length !== TOKEN_LENGTH * 2) {
        token = generateToken();
      }

      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: opts.cookie.httpOnly,
        secure: opts.cookie.secure,
        sameSite: opts.cookie.sameSite,
        path: opts.cookie.path,
      });

      // Make token available for server-rendered views and API responses
      res.locals.csrfToken = token;
      res.setHeader('X-CSRF-Token', token);

      next();
      return;
    }

    // For state-changing methods: validate the double-submit
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const submittedToken =
      req.get(CSRF_HEADER_NAME) ||
      (req.body && typeof req.body === 'object' ? req.body[CSRF_BODY_FIELD] : undefined);

    if (!cookieToken || !submittedToken) {
      res.status(403).json({
        success: false,
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
        message:
          'A valid CSRF token is required for state-changing requests. ' +
          'Obtain a token via a GET request first.',
      });
      return;
    }

    if (!tokensMatch(cookieToken, submittedToken)) {
      res.status(403).json({
        success: false,
        error: 'CSRF token invalid',
        code: 'CSRF_TOKEN_INVALID',
        message: 'The submitted CSRF token does not match. Please refresh and try again.',
      });
      return;
    }

    // Token valid -- rotate the token for next request (one-time use)
    const newToken = generateToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, {
      httpOnly: opts.cookie.httpOnly,
      secure: opts.cookie.secure,
      sameSite: opts.cookie.sameSite,
      path: opts.cookie.path,
    });
    res.locals.csrfToken = newToken;
    res.setHeader('X-CSRF-Token', newToken);

    next();
  };
}
