/**
 * Auth Middleware Tests
 *
 * Covers: authenticate, authorize, optionalAuth, requireAdmin,
 *         requireCreator, requireNostrSignature
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// --- Mock nostrAuth before importing middleware ---
vi.mock('@/services/nostr-auth', () => ({
  nostrAuth: {
    verifyJWT: vi.fn(),
    verifySignature: vi.fn(),
  },
}));

import { nostrAuth } from '@/services/nostr-auth';
import {
  authenticate,
  authorize,
  optionalAuth,
  requireAdmin,
  requireCreator,
  requireNostrSignature,
} from '../auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ip: '127.0.0.1',
    path: '/test',
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

const VALID_PUBKEY = 'a'.repeat(64);

const VALID_PAYLOAD = {
  nostr_pubkey: VALID_PUBKEY,
  signature_verified: true,
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 3600,
  role: 'creator' as const,
};

// ---------------------------------------------------------------------------
// authenticate
// ---------------------------------------------------------------------------

describe('authenticate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should call next() and attach user when JWT is valid', async () => {
    // Arrange
    const req = makeReq({ headers: { authorization: 'Bearer valid.token.here' } });
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({ valid: true, payload: VALID_PAYLOAD });

    // Act
    await authenticate(req, res, next);

    // Assert
    expect(req.user).toEqual({
      nostr_pubkey: VALID_PUBKEY,
      signature_verified: true,
      iat: VALID_PAYLOAD.iat,
      exp: VALID_PAYLOAD.exp,
      role: 'creator',
    });
    expect(next).toHaveBeenCalledWith(); // called with no args = success
  });

  it('should call next(UnauthorizedError) when Authorization header is missing', async () => {
    // Arrange
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = makeNext();

    // Act
    await authenticate(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(req.user).toBeUndefined();
  });

  it('should call next(UnauthorizedError) when Authorization header is not Bearer scheme', async () => {
    // Arrange
    const req = makeReq({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });
    const res = makeRes();
    const next = makeNext();

    // Act
    await authenticate(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('should call next(UnauthorizedError) when JWT verification returns invalid', async () => {
    // Arrange
    const req = makeReq({ headers: { authorization: 'Bearer expired.jwt.token' } });
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({ valid: false, error: 'jwt expired' });

    // Act
    await authenticate(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(req.user).toBeUndefined();
  });

  it('should call next(UnauthorizedError) when JWT payload is missing', async () => {
    // Arrange
    const req = makeReq({ headers: { authorization: 'Bearer malformed.token' } });
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({ valid: true, payload: undefined });

    // Act
    await authenticate(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('should call next(AppError 500) when verifyJWT throws unexpectedly', async () => {
    // Arrange
    const req = makeReq({ headers: { authorization: 'Bearer some.token' } });
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifyJWT).mockRejectedValue(new Error('service unavailable'));

    // Act
    await authenticate(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });

  it('should not include role on req.user when payload has no role', async () => {
    // Arrange
    const payloadNoRole = { ...VALID_PAYLOAD };
    delete (payloadNoRole as Partial<typeof VALID_PAYLOAD>).role;
    const req = makeReq({ headers: { authorization: 'Bearer valid.token.here' } });
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({ valid: true, payload: payloadNoRole });

    // Act
    await authenticate(req, res, next);

    // Assert
    expect(req.user).not.toHaveProperty('role');
    expect(next).toHaveBeenCalledWith();
  });
});

// ---------------------------------------------------------------------------
// authorize
// ---------------------------------------------------------------------------

describe('authorize', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("authorize(['admin'])", () => {
    it('should call next() when user has admin role', () => {
      // Arrange
      const req = makeReq();
      req.user = { nostr_pubkey: VALID_PUBKEY, role: 'admin' };
      const res = makeRes();
      const next = makeNext();

      // Act
      authorize(['admin'])(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next(AuthorizationError) when user has creator role', () => {
      // Arrange
      const req = makeReq();
      req.user = { nostr_pubkey: VALID_PUBKEY, role: 'creator' };
      const res = makeRes();
      const next = makeNext();

      // Act
      authorize(['admin'])(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('should call next(AuthorizationError) when user has supporter role', () => {
      // Arrange
      const req = makeReq();
      req.user = { nostr_pubkey: VALID_PUBKEY, role: 'supporter' };
      const res = makeRes();
      const next = makeNext();

      // Act
      authorize(['admin'])(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('should call next(UnauthorizedError) when user is not attached to request', () => {
      // Arrange
      const req = makeReq();
      const res = makeRes();
      const next = makeNext();

      // Act
      authorize(['admin'])(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });
  });

  describe("authorize(['creator'])", () => {
    it('should call next() when user has creator role', () => {
      // Arrange
      const req = makeReq();
      req.user = { nostr_pubkey: VALID_PUBKEY, role: 'creator' };
      const res = makeRes();
      const next = makeNext();

      // Act
      authorize(['creator'])(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next(AuthorizationError) when user has supporter role', () => {
      // Arrange
      const req = makeReq();
      req.user = { nostr_pubkey: VALID_PUBKEY, role: 'supporter' };
      const res = makeRes();
      const next = makeNext();

      // Act
      authorize(['creator'])(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('should default missing role to supporter and deny when creator required', () => {
      // Arrange — user with no role property defaults to 'supporter'
      const req = makeReq();
      req.user = { nostr_pubkey: VALID_PUBKEY }; // no role
      const res = makeRes();
      const next = makeNext();

      // Act
      authorize(['creator'])(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });
  });
});

// ---------------------------------------------------------------------------
// requireAdmin (alias for authorize(['admin']))
// ---------------------------------------------------------------------------

describe('requireAdmin', () => {
  it('should allow admin role', () => {
    const req = makeReq();
    req.user = { nostr_pubkey: VALID_PUBKEY, role: 'admin' };
    const next = makeNext();

    requireAdmin(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should deny non-admin roles', () => {
    const req = makeReq();
    req.user = { nostr_pubkey: VALID_PUBKEY, role: 'creator' };
    const next = makeNext();

    requireAdmin(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

// ---------------------------------------------------------------------------
// requireCreator (alias for authorize(['creator', 'admin']))
// ---------------------------------------------------------------------------

describe('requireCreator', () => {
  it('should allow creator role', () => {
    const req = makeReq();
    req.user = { nostr_pubkey: VALID_PUBKEY, role: 'creator' };
    const next = makeNext();

    requireCreator(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should allow admin role', () => {
    const req = makeReq();
    req.user = { nostr_pubkey: VALID_PUBKEY, role: 'admin' };
    const next = makeNext();

    requireCreator(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should deny supporter role', () => {
    const req = makeReq();
    req.user = { nostr_pubkey: VALID_PUBKEY, role: 'supporter' };
    const next = makeNext();

    requireCreator(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

// ---------------------------------------------------------------------------
// optionalAuth
// ---------------------------------------------------------------------------

describe('optionalAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should call next() without attaching user when no Authorization header', async () => {
    // Arrange
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = makeNext();

    // Act
    await optionalAuth(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
    expect(nostrAuth.verifyJWT).not.toHaveBeenCalled();
  });

  it('should call next() without attaching user when header is not Bearer scheme', async () => {
    // Arrange
    const req = makeReq({ headers: { authorization: 'Basic abc123' } });
    const res = makeRes();
    const next = makeNext();

    // Act
    await optionalAuth(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('should attach user and call next() when valid token is provided', async () => {
    // Arrange
    const req = makeReq({ headers: { authorization: 'Bearer valid.token' } });
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({ valid: true, payload: VALID_PAYLOAD });

    // Act
    await optionalAuth(req, res, next);

    // Assert
    expect(req.user).toEqual(expect.objectContaining({ nostr_pubkey: VALID_PUBKEY }));
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next() without user when token is invalid (still proceeds)', async () => {
    // Arrange
    const req = makeReq({ headers: { authorization: 'Bearer invalid.token' } });
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifyJWT).mockResolvedValue({ valid: false, error: 'bad token' });

    // Act
    await optionalAuth(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('should call next() without throwing when verifyJWT throws', async () => {
    // Arrange
    const req = makeReq({ headers: { authorization: 'Bearer some.token' } });
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifyJWT).mockRejectedValue(new Error('unexpected'));

    // Act
    await optionalAuth(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(); // no error propagated
  });
});

// ---------------------------------------------------------------------------
// requireNostrSignature
// ---------------------------------------------------------------------------

describe('requireNostrSignature', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should call next() when signature verification succeeds', async () => {
    // Arrange
    const req = makeReq({
      body: {
        signature: 'valid-sig',
        challenge: 'challenge-string-minimum-32-chars-long',
        timestamp: Date.now(),
      },
    });
    req.user = { nostr_pubkey: VALID_PUBKEY };
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifySignature).mockResolvedValue({ valid: true });

    // Act
    await requireNostrSignature(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next(UnauthorizedError) when user is not authenticated', async () => {
    // Arrange
    const req = makeReq({
      body: { signature: 'sig', challenge: 'chal', timestamp: Date.now() },
    });
    // req.user intentionally absent
    const res = makeRes();
    const next = makeNext();

    // Act
    await requireNostrSignature(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(nostrAuth.verifySignature).not.toHaveBeenCalled();
  });

  it('should call next(ValidationError) when signature field is missing', async () => {
    // Arrange
    const req = makeReq({
      body: { challenge: 'challenge-string', timestamp: Date.now() }, // no signature
    });
    req.user = { nostr_pubkey: VALID_PUBKEY };
    const res = makeRes();
    const next = makeNext();

    // Act
    await requireNostrSignature(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(nostrAuth.verifySignature).not.toHaveBeenCalled();
  });

  it('should call next(ValidationError) when challenge field is missing', async () => {
    // Arrange
    const req = makeReq({
      body: { signature: 'sig', timestamp: Date.now() }, // no challenge
    });
    req.user = { nostr_pubkey: VALID_PUBKEY };
    const res = makeRes();
    const next = makeNext();

    // Act
    await requireNostrSignature(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('should call next(ValidationError) when timestamp field is missing', async () => {
    // Arrange
    const req = makeReq({
      body: { signature: 'sig', challenge: 'challenge-string' }, // no timestamp
    });
    req.user = { nostr_pubkey: VALID_PUBKEY };
    const res = makeRes();
    const next = makeNext();

    // Act
    await requireNostrSignature(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('should call next(AuthorizationError) when signature verification fails', async () => {
    // Arrange
    const req = makeReq({
      body: {
        signature: 'bad-sig',
        challenge: 'challenge-string',
        timestamp: Date.now(),
      },
    });
    req.user = { nostr_pubkey: VALID_PUBKEY };
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifySignature).mockResolvedValue({
      valid: false,
      error: 'signature mismatch',
    });

    // Act
    await requireNostrSignature(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('should call next(ServiceError) when verifySignature throws', async () => {
    // Arrange
    const req = makeReq({
      body: { signature: 'sig', challenge: 'challenge', timestamp: Date.now() },
    });
    req.user = { nostr_pubkey: VALID_PUBKEY };
    const res = makeRes();
    const next = makeNext();
    vi.mocked(nostrAuth.verifySignature).mockRejectedValue(new Error('crypto failure'));

    // Act
    await requireNostrSignature(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });
});
