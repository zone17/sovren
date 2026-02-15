import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../app';

const testPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const adminPubkey = 'abcd567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const testJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-jwt-token';
const refreshedJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refreshed-jwt-token';
const adminJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.admin-jwt-token';

jest.mock('../../services/nostr-auth', () => ({
  nostrAuth: {
    generateChallenge: jest.fn().mockResolvedValue({
      challenge: 'a'.repeat(64),
      timestamp: Date.now(),
      expires_at: Date.now() + 900000,
    }),
    verifySignature: jest.fn().mockResolvedValue({
      valid: true,
      pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    }),
    generateJWT: jest.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-jwt-token'),
    verifyJWT: jest.fn().mockResolvedValue({
      valid: true,
      payload: {
        nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        role: 'supporter',
        signature_verified: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      },
    }),
    refreshJWT: jest.fn().mockResolvedValue({
      success: true,
      newToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refreshed-jwt-token',
    }),
    getStats: jest.fn().mockReturnValue({
      activeChallenges: 1,
    }),
  },
}));

const { nostrAuth } = require('../../services/nostr-auth');

describe('Authentication API Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();

    // Reset default mocks
    nostrAuth.generateChallenge.mockResolvedValue({
      challenge: 'a'.repeat(64),
      timestamp: Date.now(),
      expires_at: Date.now() + 900000,
    });
    nostrAuth.verifySignature.mockResolvedValue({
      valid: true,
      pubkey: testPubkey,
    });
    nostrAuth.generateJWT.mockResolvedValue(testJWT);
    nostrAuth.verifyJWT.mockResolvedValue({
      valid: true,
      payload: {
        nostr_pubkey: testPubkey,
        role: 'supporter',
        signature_verified: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      },
    });
    nostrAuth.refreshJWT.mockResolvedValue({
      success: true,
      newToken: refreshedJWT,
    });
    nostrAuth.getStats.mockReturnValue({
      activeChallenges: 1,
    });
  });

  describe('POST /api/auth/challenge', () => {
    it('should generate a new authentication challenge', async () => {
      const response = await request(app).post('/api/auth/challenge').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.challenge).toHaveLength(64);
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.expires_at).toBeGreaterThan(response.body.data.timestamp);
    });

    it('should include security headers in response', async () => {
      const response = await request(app).post('/api/auth/challenge');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should handle rate limiting gracefully', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).post('/api/auth/challenge'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('POST /api/auth/authenticate', () => {
    it('should authenticate a valid NOSTR signature', async () => {
      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: testPubkey,
          challenge: 'a'.repeat(64),
          timestamp: Date.now(),
          signature: 'valid_signature_hex',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.nostr_pubkey).toBe(testPubkey);
      expect(response.body.data.user.role).toBe('supporter');
      expect(nostrAuth.verifySignature).toHaveBeenCalled();
    });

    it('should reject authentication with invalid NOSTR public key', async () => {
      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: 'invalid-key',
          challenge: 'some-challenge',
          timestamp: Date.now(),
          signature: 'some-signature',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid NOSTR public key format');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject authentication with missing challenge', async () => {
      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: testPubkey,
          timestamp: Date.now(),
          signature: 'some-signature',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('challenge');
    });

    it('should handle expired challenges', async () => {
      nostrAuth.verifySignature.mockResolvedValueOnce({ valid: false, error: 'Challenge expired' });

      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: testPubkey,
          challenge: 'expired-challenge',
          timestamp: Date.now() - 15 * 60 * 1000,
          signature: 'some-signature',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Challenge expired or invalid');
      expect(response.body.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should reject admin role in authentication request', async () => {
      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: testPubkey,
          challenge: 'a'.repeat(64),
          timestamp: Date.now(),
          signature: 'valid_signature',
          role: 'admin',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should not bypass authentication when signature contains mock', async () => {
      // Verify the mock bypass is removed: signature containing 'mock'
      // should go through normal verification flow
      nostrAuth.verifySignature.mockResolvedValueOnce({ valid: false });

      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: testPubkey,
          challenge: 'a'.repeat(64),
          timestamp: Date.now(),
          signature: 'mock_should_not_bypass',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(nostrAuth.verifySignature).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh a valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).toBe(refreshedJWT);
    });

    it('should reject refresh with invalid token', async () => {
      nostrAuth.verifyJWT.mockResolvedValueOnce({ valid: false, error: 'Invalid token' });

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject refresh without authorization header', async () => {
      const response = await request(app).post('/api/auth/refresh').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authorization header required');
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should verify a valid JWT token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.nostr_pubkey).toBe(testPubkey);
      expect(response.body.data.valid).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout and invalidate token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully logged out');
    });
  });

  describe('GET /api/auth/health', () => {
    it('should return service health status', async () => {
      const response = await request(app).get('/api/auth/health').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.service).toBe('nostr-auth');
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should respond within performance requirements', async () => {
      const startTime = Date.now();

      await request(app).get('/api/auth/health').expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(200);
    });
  });

  describe('GET /api/auth/stats', () => {
    it('should return authentication statistics for admins', async () => {
      // Override mocks for admin flow
      nostrAuth.verifySignature.mockResolvedValueOnce({ valid: true, pubkey: adminPubkey });
      nostrAuth.generateJWT.mockResolvedValueOnce(adminJWT);
      nostrAuth.verifyJWT.mockResolvedValueOnce({
        valid: true,
        payload: {
          nostr_pubkey: adminPubkey,
          role: 'admin',
          signature_verified: true,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
        },
      });

      // First authenticate to get the admin JWT
      // Note: role:'admin' is not sent in the request body (blocked by Zod validation).
      // The admin role is set server-side via the verifyJWT mock above.
      const authResponse = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: adminPubkey,
          challenge: 'a'.repeat(64),
          timestamp: Date.now(),
          signature: 'admin_signature',
        });

      const token = authResponse.body.data.token;

      const response = await request(app)
        .get('/api/auth/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.activeChallenges).toBeDefined();
      expect(response.body.data.jwtExpiresIn).toBeDefined();
      expect(response.body.data.challengeTTL).toBeDefined();
    });

    it('should reject stats request from non-admin users', async () => {
      const response = await request(app)
        .get('/api/auth/stats')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });
});
