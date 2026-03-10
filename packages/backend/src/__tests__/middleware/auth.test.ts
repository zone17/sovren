/**
 * Auth Middleware Tests (P1-SEC-007)
 *
 * Comprehensive coverage for:
 * - authenticate(): JWT extraction, verification, user attachment
 * - authorize(): role-based access control
 * - optionalAuth(): public endpoints with optional user context
 * - requireNostrSignature(): NIP-42 signature verification
 * - requireOwnership(): resource ownership enforcement
 * - getAuthUser(): type-safe user extraction helper
 *
 * 250+ lines of critical security logic — 0 tests before this file.
 */

import { Request, Response, NextFunction } from 'express';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  authenticate,
  authorize,
  optionalAuth,
  requireNostrSignature,
  requireOwnership,
  requireAuth,
  requireAdmin,
  requireCreator,
  getAuthUser,
} from '../../middleware/auth';
import { UnauthorizedError, AuthorizationError } from '../../utils/errors';
import { AppError } from '../../lib/app-error';

// ---- Mock nostrAuth service ----
vi.mock('@/services/nostr-auth', () => ({
  nostrAuth: {
    verifyJWT: vi.fn(),
    verifySignature: vi.fn(),
  },
}));

import { nostrAuth } from '@/services/nostr-auth';

// ---- Helpers ----

const VALID_PUBKEY = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

function makeReq(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string | undefined> = {
    authorization: undefined,
    ...(overrides.headers as Record<string, string | undefined>),
  };
  return {
    ip: '127.0.0.1',
    path: '/test',
    headers,
    params: {},
    query: {},
    body: {},
    user: undefined,
    get(name: string) {
      return headers[name.toLowerCase()] ?? headers[name];
    },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

function makeNext(): NextFunction & { mock: { calls: unknown[][] } } {
  return vi.fn() as unknown as NextFunction & { mock: { calls: unknown[][] } };
}

// ---- authenticate() ----

describe('authenticate()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next(UnauthorizedError) when Authorization header is missing', async () => {
    const req = makeReq();
    const next = makeNext();
    await authenticate(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('calls next(UnauthorizedError) when Authorization header does not start with Bearer', async () => {
    const req = makeReq({ headers: { authorization: 'Basic abc123' } });
    const next = makeNext();
    await authenticate(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('calls next(UnauthorizedError) when JWT verification fails', async () => {
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({ valid: false, error: 'Token expired' });
    const req = makeReq({ headers: { authorization: 'Bearer bad.token.here' } });
    const next = makeNext();
    await authenticate(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('attaches user to req and calls next() when JWT is valid', async () => {
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({
      valid: true,
      payload: {
        nostr_pubkey: VALID_PUBKEY,
        signature_verified: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: 'creator',
      },
    });
    const req = makeReq({ headers: { authorization: 'Bearer valid.token.here' } });
    const next = makeNext();
    await authenticate(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(); // called with no args = success
    expect(req.user).toBeDefined();
    expect(req.user!.nostr_pubkey).toBe(VALID_PUBKEY);
    expect(req.user!.role).toBe('creator');
  });

  it('passes the token without the "Bearer " prefix to verifyJWT', async () => {
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({ valid: false, error: 'invalid' });
    const req = makeReq({ headers: { authorization: 'Bearer my.actual.token' } });
    await authenticate(req, makeRes(), makeNext());
    expect(nostrAuth.verifyJWT).toHaveBeenCalledWith('my.actual.token');
  });

  it('propagates AppError from verifyJWT via next()', async () => {
    vi.mocked(nostrAuth.verifyJWT).mockRejectedValue(
      new AppError({ statusCode: 500, code: 'INTERNAL', message: 'boom' })
    );
    const req = makeReq({ headers: { authorization: 'Bearer some.token' } });
    const next = makeNext();
    await authenticate(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
  });

  it('wraps unexpected errors in a 500 AppError', async () => {
    vi.mocked(nostrAuth.verifyJWT).mockRejectedValue(new Error('DB connection lost'));
    const req = makeReq({ headers: { authorization: 'Bearer some.token' } });
    const next = makeNext();
    await authenticate(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
  });

  it('attaches user without role when JWT payload has no role', async () => {
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({
      valid: true,
      payload: {
        nostr_pubkey: VALID_PUBKEY,
        signature_verified: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        // no role
      },
    });
    const req = makeReq({ headers: { authorization: 'Bearer valid.token' } });
    const next = makeNext();
    await authenticate(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user!.role).toBeUndefined();
  });
});

// ---- authorize() ----

describe('authorize()', () => {
  it('calls next(UnauthorizedError) when req.user is not set', () => {
    const middleware = authorize(['creator']);
    const req = makeReq();
    const next = makeNext();
    middleware(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('calls next(AuthorizationError) when user role is not in allowed list', () => {
    const middleware = authorize(['admin']);
    const req = makeReq();
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'supporter',
    };
    const next = makeNext();
    middleware(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthorizationError);
  });

  it('calls next() without error when user role is allowed', () => {
    const middleware = authorize(['creator', 'admin']);
    const req = makeReq();
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'creator',
    };
    const next = makeNext();
    middleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('defaults to "supporter" role when user has no role', () => {
    const middleware = authorize(['supporter']);
    const req = makeReq();
    req.user = { nostr_pubkey: VALID_PUBKEY, signature_verified: true, iat: 0, exp: 9999 };
    const next = makeNext();
    middleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('requires admin role for requireAdmin middleware', () => {
    const req = makeReq();
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'creator',
    };
    const next = makeNext();
    requireAdmin(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthorizationError);
  });

  it('allows creator for requireCreator middleware', () => {
    const req = makeReq();
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'creator',
    };
    const next = makeNext();
    requireCreator(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows all roles for requireAuth middleware', () => {
    for (const role of ['supporter', 'creator', 'admin'] as const) {
      const req = makeReq();
      req.user = { nostr_pubkey: VALID_PUBKEY, signature_verified: true, iat: 0, exp: 9999, role };
      const next = makeNext();
      requireAuth(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    }
  });
});

// ---- optionalAuth() ----

describe('optionalAuth()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next() without setting req.user when no Authorization header', async () => {
    const req = makeReq();
    const next = makeNext();
    await optionalAuth(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('calls next() without setting req.user when Authorization header is not Bearer', async () => {
    const req = makeReq({ headers: { authorization: 'Basic abc' } });
    const next = makeNext();
    await optionalAuth(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('sets req.user when valid JWT provided', async () => {
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({
      valid: true,
      payload: {
        nostr_pubkey: VALID_PUBKEY,
        signature_verified: true,
        iat: 0,
        exp: 9999,
        role: 'supporter',
      },
    });
    const req = makeReq({ headers: { authorization: 'Bearer valid.token' } });
    const next = makeNext();
    await optionalAuth(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user?.nostr_pubkey).toBe(VALID_PUBKEY);
  });

  it('calls next() without req.user when JWT is invalid (does not block request)', async () => {
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({ valid: false, error: 'bad token' });
    const req = makeReq({ headers: { authorization: 'Bearer bad.token' } });
    const next = makeNext();
    await optionalAuth(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('does not propagate exceptions — calls next() even if verifyJWT throws', async () => {
    vi.mocked(nostrAuth.verifyJWT).mockRejectedValue(new Error('Network error'));
    const req = makeReq({ headers: { authorization: 'Bearer some.token' } });
    const next = makeNext();
    await optionalAuth(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(); // next() called without error
  });
});

// ---- requireNostrSignature() ----

describe('requireNostrSignature()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next(UnauthorizedError) when req.user is not set', async () => {
    const req = makeReq({ body: { signature: 's', challenge: 'c', timestamp: 1 } });
    const next = makeNext();
    await requireNostrSignature(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('calls next(ValidationError) when signature fields are missing', async () => {
    const req = makeReq({ body: {} });
    req.user = { nostr_pubkey: VALID_PUBKEY, signature_verified: true, iat: 0, exp: 9999 };
    const next = makeNext();
    await requireNostrSignature(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).not.toBe(200);
  });

  it('calls next(AuthorizationError) when signature is invalid', async () => {
    vi.mocked(nostrAuth.verifySignature).mockResolvedValue({
      valid: false,
      pubkey: VALID_PUBKEY,
      error: 'Bad signature',
    });
    const req = makeReq({
      body: { signature: 'badsig', challenge: 'challenge123', timestamp: Date.now() },
    });
    req.user = { nostr_pubkey: VALID_PUBKEY, signature_verified: true, iat: 0, exp: 9999 };
    const next = makeNext();
    await requireNostrSignature(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthorizationError);
  });

  it('calls next() when signature is valid', async () => {
    vi.mocked(nostrAuth.verifySignature).mockResolvedValue({
      valid: true,
      pubkey: VALID_PUBKEY,
    });
    const req = makeReq({
      body: { signature: 'validsig', challenge: 'challenge123', timestamp: Date.now() },
    });
    req.user = { nostr_pubkey: VALID_PUBKEY, signature_verified: true, iat: 0, exp: 9999 };
    const next = makeNext();
    await requireNostrSignature(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

// ---- requireOwnership() ----

describe('requireOwnership()', () => {
  it('calls next(UnauthorizedError) when req.user is not set', () => {
    const middleware = requireOwnership();
    const req = makeReq({ params: { nostr_pubkey: VALID_PUBKEY } });
    const next = makeNext();
    middleware(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('calls next() without error when user is admin (admin bypass)', () => {
    const middleware = requireOwnership();
    const req = makeReq({ params: { nostr_pubkey: 'other_pubkey' } });
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'admin',
    };
    const next = makeNext();
    middleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ValidationError) when resource identifier is missing', () => {
    const middleware = requireOwnership();
    const req = makeReq({ params: {} });
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'creator',
    };
    const next = makeNext();
    middleware(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeDefined();
  });

  it('calls next(AuthorizationError) when user does not own the resource', () => {
    const middleware = requireOwnership();
    const req = makeReq({ params: { nostr_pubkey: 'attacker_pubkey' } });
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'creator',
    };
    const next = makeNext();
    middleware(req, makeRes(), next);
    const err = (next as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthorizationError);
  });

  it('calls next() when user pubkey matches resource pubkey', () => {
    const middleware = requireOwnership();
    const req = makeReq({ params: { nostr_pubkey: VALID_PUBKEY } });
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'creator',
    };
    const next = makeNext();
    middleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('supports custom resource field name', () => {
    const middleware = requireOwnership('creatorPubkey');
    const req = makeReq({ body: { creatorPubkey: VALID_PUBKEY } });
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'creator',
    };
    const next = makeNext();
    middleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('looks up field from query params as fallback', () => {
    const middleware = requireOwnership();
    const req = makeReq({ query: { nostr_pubkey: VALID_PUBKEY } });
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'creator',
    };
    const next = makeNext();
    middleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

// ---- getAuthUser() ----

describe('getAuthUser()', () => {
  it('throws UnauthorizedError when req.user is not set', () => {
    const req = makeReq();
    expect(() => getAuthUser(req)).toThrow(UnauthorizedError);
  });

  it('returns req.user when set', () => {
    const req = makeReq();
    req.user = {
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: 0,
      exp: 9999,
      role: 'creator',
    };
    const user = getAuthUser(req);
    expect(user.nostr_pubkey).toBe(VALID_PUBKEY);
  });
});
