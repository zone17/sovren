import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';
import { CreateSessionRequest, DeviceInfo, SessionService } from '../services/session-service';

// 🧪 Mock Database
const mockDatabase = {
  client: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              single: jest.fn(),
            })),
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(),
          })),
        })),
      })),
    })),
  },
};

// 🎭 Test Data Factory
const createMockDeviceInfo = (): DeviceInfo => ({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  platform: 'MacIntel',
  deviceType: 'desktop',
  browser: 'Chrome',
  browserVersion: '120.0.0.0',
  os: 'macOS',
  osVersion: '14.0',
  fingerprint: 'fp_' + Math.random().toString(36).substring(7),
  screenResolution: '1920x1080',
  timezone: 'America/New_York',
  language: 'en-US',
});

const createMockSessionRequest = (): CreateSessionRequest => ({
  user_id: '123e4567-e89b-12d3-a456-426614174000',
  jwt_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
  nostr_pubkey: 'a'.repeat(64),
  ip_address: '192.168.1.100',
  user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  device_info: createMockDeviceInfo(),
  lightning_enabled: true,
  lightning_permissions: { payments: true },
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});

describe('🔐 SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionService = new SessionService(mockDatabase as any);
  });

  describe('✨ Session Creation', () => {
    it('should create a new session successfully', async () => {
      // Arrange
      const sessionRequest = createMockSessionRequest();
      const mockSessionData = {
        id: 'session_123',
        ...sessionRequest,
        jwt_token_hash: createHash('sha256').update(sessionRequest.jwt_token).digest('hex'),
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        active: true,
        location: { country: 'United States', region: 'California', city: 'San Francisco' },
      };

      mockDatabase.client.from().insert().select().single.mockResolvedValue({
        data: mockSessionData,
        error: null,
      });

      // Mock session limit check
      mockDatabase.client.from().select().eq().eq.mockResolvedValue({
        data: [],
        error: null,
      });

      // Act
      const result = await sessionService.createSession(sessionRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockSessionData);
      expect(result.error).toBeUndefined();
    });

    it('should validate device info requirements', async () => {
      // Arrange
      const invalidRequest = {
        ...createMockSessionRequest(),
        device_info: {
          userAgent: '',
          platform: '',
          deviceType: 'invalid' as any,
          browser: '',
          browserVersion: '',
          os: '',
          osVersion: '',
          fingerprint: '',
        },
      };

      // Act
      const result = await sessionService.createSession(invalidRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });

    it('should enforce session limits per user', async () => {
      // Arrange
      const sessionRequest = createMockSessionRequest();

      // Mock existing sessions at limit
      mockDatabase.client
        .from()
        .select()
        .eq()
        .eq.mockResolvedValue({
          data: new Array(10).fill({ id: 'session_' + Math.random() }),
          error: null,
        });

      // Mock session limit enforcement
      mockDatabase.client.from().update().eq().eq().eq().order().limit.mockResolvedValue({
        error: null,
      });

      mockDatabase.client
        .from()
        .insert()
        .select()
        .single.mockResolvedValue({
          data: { id: 'new_session', ...sessionRequest },
          error: null,
        });

      // Act
      const result = await sessionService.createSession(sessionRequest);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const sessionRequest = createMockSessionRequest();

      mockDatabase.client.from().select().eq().eq.mockResolvedValue({
        data: [],
        error: null,
      });

      mockDatabase.client
        .from()
        .insert()
        .select()
        .single.mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        });

      // Act
      const result = await sessionService.createSession(sessionRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session creation failed');
    });
  });

  describe('📋 Session Listing', () => {
    it('should list user sessions successfully', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockSessions = [
        {
          id: 'session_1',
          user_id: userId,
          device_info: createMockDeviceInfo(),
          created_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          active: true,
        },
        {
          id: 'session_2',
          user_id: userId,
          device_info: { ...createMockDeviceInfo(), deviceType: 'mobile' },
          created_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          active: true,
        },
      ];

      mockDatabase.client.from().select().eq().eq().order.mockResolvedValue({
        data: mockSessions,
        error: null,
      });

      // Act
      const result = await sessionService.listUserSessions(userId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions?.[0].id).toBe('session_1');
    });

    it('should handle empty session list', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockDatabase.client.from().select().eq().eq().order.mockResolvedValue({
        data: [],
        error: null,
      });

      // Act
      const result = await sessionService.listUserSessions(userId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(0);
    });

    it('should handle database errors in listing', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockDatabase.client
        .from()
        .select()
        .eq()
        .eq()
        .order.mockResolvedValue({
          data: null,
          error: { message: 'Database query failed' },
        });

      // Act
      const result = await sessionService.listUserSessions(userId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session listing failed');
    });
  });

  describe('🔄 Activity Updates', () => {
    it('should update session activity successfully', async () => {
      // Arrange
      const sessionId = 'session_123';

      mockDatabase.client.from().update().eq().eq.mockResolvedValue({
        error: null,
      });

      // Act
      const result = await sessionService.updateLastActivity(sessionId, 'api_call');

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle activity update errors', async () => {
      // Arrange
      const sessionId = 'session_123';

      mockDatabase.client
        .from()
        .update()
        .eq()
        .eq.mockResolvedValue({
          error: { message: 'Session not found' },
        });

      // Act
      const result = await sessionService.updateLastActivity(sessionId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Activity update failed');
    });
  });

  describe('🚫 Session Revocation', () => {
    it('should revoke a single session successfully', async () => {
      // Arrange
      const sessionId = 'session_123';
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockSession = {
        id: sessionId,
        user_id: userId,
        active: true,
      };

      mockDatabase.client.from().select().eq().eq().single.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      mockDatabase.client.from().update().eq.mockResolvedValue({
        error: null,
      });

      // Act
      const result = await sessionService.revokeSession(sessionId, userId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should prevent revoking sessions of other users', async () => {
      // Arrange
      const sessionId = 'session_123';
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const otherUserId = '987e6543-e21b-34c5-b678-987654321000';

      mockDatabase.client
        .from()
        .select()
        .eq()
        .eq()
        .single.mockResolvedValue({
          data: null,
          error: { message: 'Session not found' },
        });

      // Act
      const result = await sessionService.revokeSession(sessionId, otherUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found or access denied');
    });

    it('should revoke all sessions except current', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const currentSessionId = 'current_session';
      const mockRevokedSessions = [{ id: 'session_1' }, { id: 'session_2' }];

      mockDatabase.client.from().update().eq().eq().neq().select.mockResolvedValue({
        data: mockRevokedSessions,
        error: null,
      });

      // Act
      const result = await sessionService.revokeAllSessions(userId, currentSessionId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.revokedCount).toBe(2);
    });

    it('should revoke all sessions when no exception specified', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockRevokedSessions = [{ id: 'session_1' }, { id: 'session_2' }, { id: 'session_3' }];

      mockDatabase.client.from().update().eq().eq().select.mockResolvedValue({
        data: mockRevokedSessions,
        error: null,
      });

      // Act
      const result = await sessionService.revokeAllSessions(userId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.revokedCount).toBe(3);
    });
  });

  describe('🔍 Session Lookup', () => {
    it('should find session by token hash', async () => {
      // Arrange
      const token = 'test.jwt.token';
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const mockSession = {
        id: 'session_123',
        jwt_token_hash: tokenHash,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        active: true,
      };

      mockDatabase.client.from().select().eq().eq().single.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      // Act
      const result = await sessionService.getSessionByTokenHash(tokenHash);

      // Assert
      expect(result.success).toBe(true);
      expect(result.session?.id).toBe('session_123');
    });

    it('should handle expired sessions', async () => {
      // Arrange
      const tokenHash = 'expired_token_hash';
      const mockSession = {
        id: 'session_123',
        user_id: 'user_123',
        jwt_token_hash: tokenHash,
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        active: true,
      };

      mockDatabase.client.from().select().eq().eq().single.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      // Mock revocation call
      mockDatabase.client.from().select().eq().eq().single.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockDatabase.client.from().update().eq.mockResolvedValue({
        error: null,
      });

      // Act
      const result = await sessionService.getSessionByTokenHash(tokenHash);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session expired');
    });

    it('should handle session not found', async () => {
      // Arrange
      const tokenHash = 'nonexistent_hash';

      mockDatabase.client
        .from()
        .select()
        .eq()
        .eq()
        .single.mockResolvedValue({
          data: null,
          error: { message: 'Session not found' },
        });

      // Act
      const result = await sessionService.getSessionByTokenHash(tokenHash);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found');
    });
  });

  describe('🧹 Session Cleanup', () => {
    it('should cleanup expired sessions', async () => {
      // Arrange
      const mockExpiredSessions = [{ id: 'expired_1' }, { id: 'expired_2' }];

      mockDatabase.client.from().update().lt().eq().select.mockResolvedValue({
        data: mockExpiredSessions,
        error: null,
      });

      // Act
      const result = await sessionService.cleanupExpiredSessions();

      // Assert
      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      mockDatabase.client
        .from()
        .update()
        .lt()
        .eq()
        .select.mockResolvedValue({
          data: null,
          error: { message: 'Cleanup failed' },
        });

      // Act
      const result = await sessionService.cleanupExpiredSessions();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session cleanup failed');
    });

    it('should handle no expired sessions', async () => {
      // Arrange
      mockDatabase.client.from().update().lt().eq().select.mockResolvedValue({
        data: [],
        error: null,
      });

      // Act
      const result = await sessionService.cleanupExpiredSessions();

      // Assert
      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(0);
    });
  });

  describe('🔒 Security Validation', () => {
    it('should validate IP address format', async () => {
      // Arrange
      const invalidRequest = {
        ...createMockSessionRequest(),
        ip_address: 'invalid.ip.address',
      };

      // Act
      const result = await sessionService.createSession(invalidRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });

    it('should validate NOSTR pubkey length', async () => {
      // Arrange
      const invalidRequest = {
        ...createMockSessionRequest(),
        nostr_pubkey: 'short_key',
      };

      // Act
      const result = await sessionService.createSession(invalidRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });

    it('should validate UUID format for user_id', async () => {
      // Arrange
      const invalidRequest = {
        ...createMockSessionRequest(),
        user_id: 'invalid-uuid-format',
      };

      // Act
      const result = await sessionService.createSession(invalidRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });

    it('should validate expires_at is in future', async () => {
      // Arrange
      const invalidRequest = {
        ...createMockSessionRequest(),
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      };

      // Act
      const result = await sessionService.createSession(invalidRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });
  });

  describe('⚡ Performance Tests', () => {
    it('should handle concurrent session creation', async () => {
      // Arrange
      const sessionRequests = Array(10)
        .fill(null)
        .map(() => ({
          ...createMockSessionRequest(),
          user_id: `user_${Math.random()}`,
        }));

      mockDatabase.client.from().select().eq().eq.mockResolvedValue({
        data: [],
        error: null,
      });

      mockDatabase.client
        .from()
        .insert()
        .select()
        .single.mockResolvedValue({
          data: { id: 'session_' + Math.random() },
          error: null,
        });

      // Act
      const startTime = Date.now();
      const results = await Promise.all(
        sessionRequests.map((req) => sessionService.createSession(req))
      );
      const endTime = Date.now();

      // Assert
      expect(results.every((r) => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large session lists efficiently', async () => {
      // Arrange
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const largeMockSessions = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `session_${i}`,
          user_id: userId,
          device_info: createMockDeviceInfo(),
          created_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          active: true,
        }));

      mockDatabase.client.from().select().eq().eq().order.mockResolvedValue({
        data: largeMockSessions,
        error: null,
      });

      // Act
      const startTime = Date.now();
      const result = await sessionService.listUserSessions(userId);
      const endTime = Date.now();

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('🔄 Edge Cases', () => {
    it('should handle malformed device info gracefully', async () => {
      // Arrange
      const requestWithMalformedDevice = {
        ...createMockSessionRequest(),
        device_info: {
          userAgent: 'Valid User Agent',
          platform: 'Valid Platform',
          deviceType: 'desktop' as const,
          browser: 'Valid Browser',
          browserVersion: 'Valid Version',
          os: 'Valid OS',
          osVersion: 'Valid OS Version',
          fingerprint: 'Valid Fingerprint',
          // Missing optional fields - should still work
        },
      };

      mockDatabase.client.from().select().eq().eq.mockResolvedValue({
        data: [],
        error: null,
      });

      mockDatabase.client
        .from()
        .insert()
        .select()
        .single.mockResolvedValue({
          data: { id: 'session_123', ...requestWithMalformedDevice },
          error: null,
        });

      // Act
      const result = await sessionService.createSession(requestWithMalformedDevice);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle network timeouts gracefully', async () => {
      // Arrange
      const sessionRequest = createMockSessionRequest();

      mockDatabase.client
        .from()
        .select()
        .eq()
        .eq.mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), 100);
          });
        });

      // Act
      const result = await sessionService.createSession(sessionRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });
});

// 🏭 Test Utilities
export const SessionTestUtils = {
  createMockDeviceInfo,
  createMockSessionRequest,
  createMockDatabase: () => mockDatabase,
};
