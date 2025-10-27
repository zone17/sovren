/**
 * 🧪 Unified NOSTR Authentication Service Tests
 * US-305: Unify NOSTR Authentication Services
 *
 * Test Coverage Requirements:
 * - Core authentication flow: 95%+
 * - Edge cases and error handling
 * - Security scenarios (replay attacks, expired tokens)
 * - Integration with session management
 * - Rate limiting integration
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { UnifiedNostrAuthService } from '../unified-nostr-auth';
import { KeyManagementService } from '../../../frontend/src/services/nostr/KeyManagementService';
import { SessionService } from '../session-service';
import { RequestRateLimiter } from '../../middleware/advanced-rate-limiting';
import { verifyEvent, type Event as NostrEvent } from 'nostr-tools';

// Mock dependencies
jest.mock('nostr-tools');
jest.mock('../../../frontend/src/services/nostr/KeyManagementService');
jest.mock('../session-service');
jest.mock('../../middleware/advanced-rate-limiting');

describe('UnifiedNostrAuthService', () => {
  let authService: UnifiedNostrAuthService;
  let mockKeyManagement: jest.Mocked<KeyManagementService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockRateLimiter: jest.Mocked<RequestRateLimiter>;

  const validPubkey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const validSignature = 'validsignaturevalidsignaturevalidsignaturevalidsignaturevalidsignature';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockKeyManagement = {
      verifyEventSignature: jest.fn().mockResolvedValue(true),
      signEvent: jest.fn().mockResolvedValue({ sig: validSignature }),
    } as any;

    mockSessionService = {
      createSession: jest.fn().mockResolvedValue({
        success: true,
        session: { id: 'session123', user_id: 'user123' }
      }),
      getSessionByTokenHash: jest.fn().mockResolvedValue({
        success: true,
        session: { id: 'session123', active: true }
      }),
      updateLastActivity: jest.fn().mockResolvedValue({ success: true }),
      revokeSession: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    mockRateLimiter = {
      checkLimit: jest.fn().mockResolvedValue({
        allowed: true,
        remainingRequests: 10
      }),
    } as any;

    // Initialize service with mocked dependencies
    authService = new UnifiedNostrAuthService({
      keyManagementService: mockKeyManagement,
      sessionService: mockSessionService,
      rateLimiter: mockRateLimiter,
      jwtSecret: 'test-secret',
      jwtExpiresIn: '24h',
      challengeTTL: 300000, // 5 minutes
    });
  });

  afterEach(() => {
    authService.destroy();
  });

  describe('Challenge Generation', () => {
    it('should generate a valid authentication challenge', async () => {
      const challenge = await authService.generateChallenge(validPubkey);

      expect(challenge).toHaveProperty('challenge');
      expect(challenge).toHaveProperty('pubkey');
      expect(challenge).toHaveProperty('created_at');
      expect(challenge).toHaveProperty('expires_at');
      expect(challenge.challenge).toHaveLength(64); // 32 bytes hex
      expect(challenge.pubkey).toBe(validPubkey);
      expect(challenge.expires_at).toBeGreaterThan(challenge.created_at);
    });

    it('should reject invalid public key format', async () => {
      await expect(authService.generateChallenge('invalid-pubkey')).rejects.toThrow(
        'Invalid NOSTR public key format'
      );
    });

    it('should enforce rate limiting on challenge generation', async () => {
      mockRateLimiter.checkLimit.mockResolvedValueOnce({
        allowed: false,
        remainingRequests: 0,
        retryAfter: 60
      } as any);

      await expect(authService.generateChallenge(validPubkey)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should clean up expired challenges automatically', async () => {
      const challenge1 = await authService.generateChallenge(validPubkey);

      // Fast-forward time to expire the challenge
      jest.advanceTimersByTime(310000); // 5+ minutes

      const isValid = await authService.verifyChallengeExists(challenge1.challenge);
      expect(isValid).toBe(false);
    });
  });

  describe('Signature Verification', () => {
    let validChallenge: any;

    beforeEach(async () => {
      validChallenge = await authService.generateChallenge(validPubkey);
    });

    it('should verify valid signature and return JWT', async () => {
      const result = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: validChallenge.challenge,
        timestamp: Date.now(),
      });

      expect(result.valid).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(mockKeyManagement.verifyEventSignature).toHaveBeenCalled();
      expect(mockSessionService.createSession).toHaveBeenCalled();
    });

    it('should reject signature for non-existent challenge', async () => {
      const result = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: 'nonexistentchallenge',
        timestamp: Date.now(),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or expired challenge');
      expect(result.token).toBeUndefined();
    });

    it('should reject expired challenge', async () => {
      // Fast-forward time to expire the challenge
      jest.advanceTimersByTime(310000); // 5+ minutes

      const result = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: validChallenge.challenge,
        timestamp: Date.now(),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Challenge has expired');
    });

    it('should prevent replay attacks', async () => {
      const verificationData = {
        pubkey: validPubkey,
        signature: validSignature,
        challenge: validChallenge.challenge,
        timestamp: Date.now(),
      };

      // First verification should succeed
      const result1 = await authService.verifyChallenge(verificationData);
      expect(result1.valid).toBe(true);

      // Second verification with same challenge should fail
      const result2 = await authService.verifyChallenge(verificationData);
      expect(result2.valid).toBe(false);
      expect(result2.error).toBe('Invalid or expired challenge');
    });

    it('should reject invalid signature', async () => {
      mockKeyManagement.verifyEventSignature.mockResolvedValueOnce(false);

      const result = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: 'invalidsignature',
        challenge: validChallenge.challenge,
        timestamp: Date.now(),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should reject timestamp outside acceptable range', async () => {
      const result = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: validChallenge.challenge,
        timestamp: Date.now() - 400000, // 6+ minutes ago
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp is outside acceptable range');
    });

    it('should log security events for failed verifications', async () => {
      const logSpy = jest.spyOn(authService as any, 'logSecurityEvent');

      await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: 'invalidsignature',
        challenge: 'fakechallenge',
        timestamp: Date.now(),
      });

      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'AUTH_FAILURE',
        pubkey: validPubkey,
        reason: expect.any(String),
      }));
    });
  });

  describe('JWT Token Management', () => {
    it('should validate JWT token and return session', async () => {
      // Generate a valid token
      const challenge = await authService.generateChallenge(validPubkey);
      const verifyResult = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: challenge.challenge,
        timestamp: Date.now(),
      });

      const validationResult = await authService.validateToken(verifyResult.token!);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.pubkey).toBe(validPubkey);
      expect(validationResult.session).toBeDefined();
      expect(mockSessionService.getSessionByTokenHash).toHaveBeenCalled();
    });

    it('should reject expired JWT token', async () => {
      const expiredToken = 'expired.jwt.token';

      const result = await authService.validateToken(expiredToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should refresh JWT token', async () => {
      // Generate initial token
      const challenge = await authService.generateChallenge(validPubkey);
      const verifyResult = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: challenge.challenge,
        timestamp: Date.now(),
      });

      const refreshResult = await authService.refreshToken(verifyResult.token!);

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.newToken).toBeDefined();
      expect(refreshResult.newToken).not.toBe(verifyResult.token);
    });

    it('should track token refresh in session activity', async () => {
      const challenge = await authService.generateChallenge(validPubkey);
      const verifyResult = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: challenge.challenge,
        timestamp: Date.now(),
      });

      await authService.refreshToken(verifyResult.token!);

      expect(mockSessionService.updateLastActivity).toHaveBeenCalledWith(
        expect.any(String),
        'token_refresh'
      );
    });
  });

  describe('Session Integration', () => {
    it('should create session on successful authentication', async () => {
      const challenge = await authService.generateChallenge(validPubkey);

      await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: challenge.challenge,
        timestamp: Date.now(),
      });

      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          nostr_pubkey: validPubkey,
          jwt_token: expect.any(String),
        })
      );
    });

    it('should logout and revoke session', async () => {
      const challenge = await authService.generateChallenge(validPubkey);
      const verifyResult = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: challenge.challenge,
        timestamp: Date.now(),
      });

      const logoutResult = await authService.logout(verifyResult.token!);

      expect(logoutResult.success).toBe(true);
      expect(mockSessionService.revokeSession).toHaveBeenCalled();
    });

    it('should handle multi-device sessions', async () => {
      // Create multiple sessions for same user
      const sessions = [];

      for (let i = 0; i < 3; i++) {
        const challenge = await authService.generateChallenge(validPubkey);
        const result = await authService.verifyChallenge({
          pubkey: validPubkey,
          signature: validSignature,
          challenge: challenge.challenge,
          timestamp: Date.now(),
        });
        sessions.push(result);
      }

      expect(sessions).toHaveLength(3);
      expect(mockSessionService.createSession).toHaveBeenCalledTimes(3);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should apply rate limiting per pubkey', async () => {
      mockRateLimiter.checkLimit.mockResolvedValueOnce({
        allowed: false,
        remainingRequests: 0,
        retryAfter: 60
      } as any);

      const challenge = await authService.generateChallenge(validPubkey);

      await expect(authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: challenge.challenge,
        timestamp: Date.now(),
      })).rejects.toThrow('Rate limit exceeded');
    });

    it('should track rate limit violations', async () => {
      const violations = await authService.getRateLimitViolations(validPubkey);
      expect(violations).toBeDefined();
      expect(violations).toHaveProperty('count');
      expect(violations).toHaveProperty('lastViolation');
    });

    it('should implement exponential backoff for repeated violations', async () => {
      // Simulate multiple rate limit violations
      for (let i = 0; i < 3; i++) {
        mockRateLimiter.checkLimit.mockResolvedValueOnce({
          allowed: false,
          remainingRequests: 0,
          retryAfter: 60 * Math.pow(2, i) // Exponential backoff
        } as any);

        try {
          await authService.generateChallenge(validPubkey);
        } catch (e) {
          // Expected to throw
        }
      }

      const violations = await authService.getRateLimitViolations(validPubkey);
      expect(violations.count).toBe(3);
      expect(violations.backoffMultiplier).toBe(8); // 2^3
    });
  });

  describe('Security Event Logging', () => {
    it('should log successful authentication', async () => {
      const logSpy = jest.spyOn(authService as any, 'logSecurityEvent');

      const challenge = await authService.generateChallenge(validPubkey);
      await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: challenge.challenge,
        timestamp: Date.now(),
      });

      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'AUTH_SUCCESS',
        pubkey: validPubkey,
      }));
    });

    it('should log failed authentication attempts', async () => {
      const logSpy = jest.spyOn(authService as any, 'logSecurityEvent');

      await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: 'invalidsig',
        challenge: 'fakechallenge',
        timestamp: Date.now(),
      });

      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'AUTH_FAILURE',
        pubkey: validPubkey,
      }));
    });

    it('should track suspicious patterns', async () => {
      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await authService.verifyChallenge({
          pubkey: validPubkey,
          signature: 'invalidsig',
          challenge: 'fakechallenge',
          timestamp: Date.now(),
        });
      }

      const patterns = await authService.getSuspiciousPatterns(validPubkey);
      expect(patterns).toContain('MULTIPLE_FAILED_ATTEMPTS');
    });

    it('should export security audit log', async () => {
      const auditLog = await authService.exportSecurityAuditLog({
        startDate: new Date(Date.now() - 86400000), // 24 hours ago
        endDate: new Date(),
        pubkey: validPubkey,
      });

      expect(auditLog).toHaveProperty('events');
      expect(auditLog).toHaveProperty('summary');
      expect(Array.isArray(auditLog.events)).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent authentication requests', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        const challenge = await authService.generateChallenge(validPubkey);
        promises.push(authService.verifyChallenge({
          pubkey: validPubkey,
          signature: validSignature,
          challenge: challenge.challenge,
          timestamp: Date.now(),
        }));
      }

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.valid).length;

      expect(successCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThanOrEqual(10);
    });

    it('should meet performance benchmark (<100ms)', async () => {
      const startTime = Date.now();

      const challenge = await authService.generateChallenge(validPubkey);
      await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: challenge.challenge,
        timestamp: Date.now(),
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should clean up memory efficiently', async () => {
      // Generate many challenges
      for (let i = 0; i < 100; i++) {
        await authService.generateChallenge(validPubkey + i.toString(16).padStart(2, '0'));
      }

      const stats = authService.getStats();
      expect(stats.activeChallenges).toBeLessThanOrEqual(100);

      // Trigger cleanup
      jest.advanceTimersByTime(310000);
      authService.cleanupExpiredChallenges();

      const statsAfter = authService.getStats();
      expect(statsAfter.activeChallenges).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed input gracefully', async () => {
      const result = await authService.verifyChallenge({
        pubkey: null as any,
        signature: undefined as any,
        challenge: '',
        timestamp: 'not-a-number' as any,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should handle database connection failures', async () => {
      mockSessionService.createSession.mockRejectedValueOnce(new Error('Database connection failed'));

      const challenge = await authService.generateChallenge(validPubkey);
      const result = await authService.verifyChallenge({
        pubkey: validPubkey,
        signature: validSignature,
        challenge: challenge.challenge,
        timestamp: Date.now(),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('session creation failed');
    });

    it('should handle service initialization errors', async () => {
      const brokenService = new UnifiedNostrAuthService({
        keyManagementService: null as any,
        sessionService: null as any,
        rateLimiter: null as any,
      });

      await expect(brokenService.generateChallenge(validPubkey)).rejects.toThrow();
    });

    it('should provide fallback for missing dependencies', async () => {
      const minimalService = new UnifiedNostrAuthService({
        jwtSecret: 'test-secret',
      });

      const challenge = await minimalService.generateChallenge(validPubkey);
      expect(challenge).toBeDefined();
      expect(challenge.challenge).toBeDefined();
    });
  });
});