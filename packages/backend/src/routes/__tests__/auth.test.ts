import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../app';

describe('Authentication API Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /api/auth/challenge', () => {
    it('should generate a new authentication challenge', async () => {
      // When requesting a new challenge
      const response = await request(app)
        .post('/api/auth/challenge')
        .expect(200);

      // Then it should return a challenge with proper structure
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.challenge).toHaveLength(64); // 32 bytes hex
      expect(response.body.data.timestamp).toBeCloseTo(Date.now(), -2);
      expect(response.body.data.expires_at).toBeGreaterThan(response.body.data.timestamp);
    });

    it('should include security headers in response', async () => {
      // When requesting a challenge
      const response = await request(app)
        .post('/api/auth/challenge');

      // Then security headers should be present
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should handle rate limiting gracefully', async () => {
      // Given multiple rapid requests
      const requests = Array(10).fill(null).map(() =>
        request(app).post('/api/auth/challenge')
      );

      // When all requests are made simultaneously
      const responses = await Promise.all(requests);

      // Then all should succeed (rate limiting should be reasonable for challenges)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('POST /api/auth/authenticate', () => {
    it('should authenticate a valid NOSTR signature', async () => {
      // Given a valid challenge
      const challengeResponse = await request(app)
        .post('/api/auth/challenge');

      const challenge = challengeResponse.body.data.challenge;
      const timestamp = challengeResponse.body.data.timestamp;

      // When authenticating with valid signature (mocked for testing)
      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          challenge: challenge,
          timestamp: timestamp,
          signature: 'mock_valid_signature_for_testing_purposes'
        })
        .expect(200);

      // Then it should return JWT token and user info
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.nostr_pubkey).toBe('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(response.body.data.user.role).toBe('supporter'); // Default role
    });

    it('should reject authentication with invalid NOSTR public key', async () => {
      // When authenticating with invalid public key
      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: 'invalid-key',
          challenge: 'some-challenge',
          timestamp: Date.now(),
          signature: 'some-signature'
        })
        .expect(400);

      // Then it should return validation error
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid NOSTR public key format');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject authentication with missing challenge', async () => {
      // When authenticating without challenge
      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          timestamp: Date.now(), // Include timestamp so validation fails on challenge
          signature: 'some-signature'
        })
        .expect(400);

      // Then it should return validation error
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('challenge');
    });

    it('should handle expired challenges', async () => {
      // When authenticating with expired challenge
      const response = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          challenge: 'expired-challenge',
          timestamp: Date.now() - (15 * 60 * 1000), // 15 minutes ago
          signature: 'some-signature'
        })
        .expect(401);

      // Then it should return authentication error
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Challenge expired or invalid');
      expect(response.body.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh a valid JWT token', async () => {
      // Given a valid authentication
      const authResponse = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          challenge: 'mock-challenge',
          timestamp: Date.now(),
          signature: 'mock_valid_signature'
        });

      const token = authResponse.body.data.token;

      // When refreshing the token
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Then it should return a new token
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).not.toBe(token); // Should be a new token
    });

    it('should reject refresh with invalid token', async () => {
      // When refreshing with invalid token
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Then it should return authentication error
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should reject refresh without authorization header', async () => {
      // When refreshing without authorization
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      // Then it should return authentication error
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authorization header required');
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should verify a valid JWT token', async () => {
      // Given a valid authentication
      const authResponse = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          challenge: 'mock-challenge',
          timestamp: Date.now(),
          signature: 'mock_valid_signature'
        });

      const token = authResponse.body.data.token;

      // When verifying the token
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Then it should return user information
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.nostr_pubkey).toBe('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(response.body.data.valid).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout and invalidate token', async () => {
      // Given a valid authentication
      const authResponse = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          challenge: 'mock-challenge',
          timestamp: Date.now(),
          signature: 'mock_valid_signature'
        });

      const token = authResponse.body.data.token;

      // When logging out
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Then it should confirm logout
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully logged out');
    });
  });

  describe('GET /api/auth/health', () => {
    it('should return service health status', async () => {
      // When checking auth service health
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      // Then it should return health information
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.service).toBe('nostr-auth');
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should respond within performance requirements', async () => {
      // When checking health
      const startTime = Date.now();

      await request(app)
        .get('/api/auth/health')
        .expect(200);

      const responseTime = Date.now() - startTime;

      // Then it should respond quickly (< 200ms requirement)
      expect(responseTime).toBeLessThan(200);
    });
  });

  describe('GET /api/auth/stats', () => {
    it('should return authentication statistics for admins', async () => {
      // Given an admin user authentication
      const authResponse = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: 'abcd567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          challenge: 'mock-challenge',
          timestamp: Date.now(),
          signature: 'mock_admin_signature',
          role: 'admin' // Specify admin role
        });

      const token = authResponse.body.data.token;

      // When requesting stats
      const response = await request(app)
        .get('/api/auth/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Then it should return statistics
      expect(response.body.success).toBe(true);
      expect(response.body.data.activeChallenges).toBeDefined();
      expect(response.body.data.jwtExpiresIn).toBeDefined();
      expect(response.body.data.challengeTTL).toBeDefined();
    });

    it('should reject stats request from non-admin users', async () => {
      // Given a regular user authentication
      const authResponse = await request(app)
        .post('/api/auth/authenticate')
        .send({
          nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          challenge: 'mock-challenge',
          timestamp: Date.now(),
          signature: 'mock_valid_signature'
        });

      const token = authResponse.body.data.token;

      // When requesting stats as non-admin
      const response = await request(app)
        .get('/api/auth/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      // Then it should reject with permission error
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });
});
