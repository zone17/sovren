import { createHash } from 'crypto';
import { CreateSessionRequest, DeviceInfo, SessionService } from '../services/session-service';

/**
 * Table-aware mock chain for Supabase client.
 * Each chain method returns `this` to support chaining.
 * Terminal methods (single, select at end of update chain) resolve via `then`.
 */
function createMockChain(defaultResult: any = { data: null, error: null }) {
  let _result = defaultResult;

  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    delete: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    neq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    gt: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    lt: vi.fn().mockImplementation(() => chain),
    lte: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockImplementation(() => Promise.resolve(_result)),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(_result)),
    then: vi.fn().mockImplementation((resolve: any) => resolve(_result)),
    // Allow setting the result for the next operation
    _setResult(result: any) {
      _result = result;
      chain.single.mockImplementation(() => Promise.resolve(result));
      chain.then.mockImplementation((resolve: any) => resolve(result));
      return chain;
    },
  };

  return chain;
}

// Test Data Factory
const createMockDeviceInfo = (): DeviceInfo => ({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  platform: 'MacIntel',
  deviceType: 'desktop',
  browser: 'Chrome',
  browserVersion: '120.0.0.0',
  os: 'macOS',
  osVersion: '14.0',
  fingerprint: 'fp_test12345',
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

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockChain: ReturnType<typeof createMockChain>;
  let mockDatabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createMockChain();
    mockDatabase = {
      client: {
        from: vi.fn().mockReturnValue(mockChain),
      },
    };
    sessionService = new SessionService(mockDatabase as any);
  });

  describe('Session Creation', () => {
    it('should create a new session successfully', async () => {
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

      // enforceSessionLimits: select sessions returns empty (no limit reached)
      // Then createSession insert returns session data
      // Then logSessionActivity insert succeeds
      let callCount = 0;
      mockChain.then.mockImplementation((resolve: any) => {
        callCount++;
        if (callCount === 1) return resolve({ data: [], error: null }); // enforceSessionLimits
        return resolve({ data: null, error: null }); // logSessionActivity + others
      });
      mockChain.single.mockResolvedValue({ data: mockSessionData, error: null });

      const result = await sessionService.createSession(sessionRequest);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should validate device info requirements', async () => {
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

      const result = await sessionService.createSession(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      const sessionRequest = createMockSessionRequest();

      // enforceSessionLimits: succeeds
      mockChain.then.mockImplementation((resolve: any) => resolve({ data: [], error: null }));
      // insert().select().single() fails
      mockChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await sessionService.createSession(sessionRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session creation failed');
    });
  });

  describe('Session Listing', () => {
    it('should list user sessions successfully', async () => {
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

      // First then() call: user_sessions query returns sessions
      // Second then() call: session_activity query returns empty activity
      let callCount = 0;
      mockChain.then.mockImplementation((resolve: any) => {
        callCount++;
        if (callCount === 1) return resolve({ data: mockSessions, error: null });
        return resolve({ data: [], error: null }); // activity rows
      });

      const result = await sessionService.listUserSessions(userId);

      expect(result.success).toBe(true);
      expect(result.sessions).toBeDefined();
      expect(result.sessions!.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty session list', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      // Both calls (user_sessions + session_activity) return empty
      mockChain.then.mockImplementation((resolve: any) => resolve({ data: [], error: null }));

      const result = await sessionService.listUserSessions(userId);

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(0);
    });

    it('should handle database errors in listing', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockChain.then.mockImplementation((resolve: any) =>
        resolve({ data: null, error: { message: 'Database query failed' } })
      );

      const result = await sessionService.listUserSessions(userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session listing failed');
    });
  });

  describe('Activity Updates', () => {
    it('should update session activity successfully', async () => {
      const sessionId = 'session_123';

      // update().eq().eq() chain resolves successfully, then logSessionActivity also succeeds
      mockChain.then.mockImplementation((resolve: any) => resolve({ data: null, error: null }));

      const result = await sessionService.updateLastActivity(sessionId, 'api_call');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle activity update errors', async () => {
      const sessionId = 'session_123';

      mockChain.then.mockImplementation((resolve: any) =>
        resolve({ error: { message: 'Session not found' } })
      );

      const result = await sessionService.updateLastActivity(sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Activity update failed');
    });
  });

  describe('Session Revocation', () => {
    it('should revoke a single session successfully', async () => {
      const sessionId = 'session_123';
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockSession = {
        id: sessionId,
        user_id: userId,
        active: true,
      };

      // First call: select().eq().eq().single() => session found
      mockChain.single.mockResolvedValue({ data: mockSession, error: null });
      // Subsequent then calls: update + logSessionActivity succeed
      mockChain.then.mockImplementation((resolve: any) => resolve({ data: null, error: null }));

      const result = await sessionService.revokeSession(sessionId, userId);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should prevent revoking sessions of other users', async () => {
      const sessionId = 'session_123';
      const otherUserId = '987e6543-e21b-34c5-b678-987654321000';

      mockChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Session not found' },
      });

      const result = await sessionService.revokeSession(sessionId, otherUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found or access denied');
    });

    it('should revoke all sessions except current', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const currentSessionId = 'current_session';
      const mockRevokedSessions = [{ id: 'session_1' }, { id: 'session_2' }];

      // revokeAllSessions: update chain with select('id') at end
      mockChain.then.mockImplementation((resolve: any) =>
        resolve({ data: mockRevokedSessions, error: null })
      );

      const result = await sessionService.revokeAllSessions(userId, currentSessionId);

      expect(result.success).toBe(true);
      expect(result.revokedCount).toBe(2);
    });

    it('should revoke all sessions when no exception specified', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockRevokedSessions = [{ id: 'session_1' }, { id: 'session_2' }, { id: 'session_3' }];

      mockChain.then.mockImplementation((resolve: any) =>
        resolve({ data: mockRevokedSessions, error: null })
      );

      const result = await sessionService.revokeAllSessions(userId);

      expect(result.success).toBe(true);
      expect(result.revokedCount).toBe(3);
    });
  });

  describe('Session Lookup', () => {
    it('should find session by token hash', async () => {
      const token = 'test.jwt.token';
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const mockSession = {
        id: 'session_123',
        jwt_token_hash: tokenHash,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        active: true,
      };

      mockChain.single.mockResolvedValue({ data: mockSession, error: null });

      const result = await sessionService.getSessionByTokenHash(tokenHash);

      expect(result.success).toBe(true);
      expect(result.session?.id).toBe('session_123');
    });

    it('should handle expired sessions', async () => {
      const tokenHash = 'expired_token_hash';
      const mockSession = {
        id: 'session_123',
        user_id: 'user_123',
        jwt_token_hash: tokenHash,
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        active: true,
      };

      // getSessionByTokenHash: single() returns expired session
      mockChain.single.mockResolvedValue({ data: mockSession, error: null });
      // revokeSession calls: select -> single (session found), then update + log
      mockChain.then.mockImplementation((resolve: any) => resolve({ data: null, error: null }));

      const result = await sessionService.getSessionByTokenHash(tokenHash);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session expired');
    });

    it('should handle session not found', async () => {
      const tokenHash = 'nonexistent_hash';

      mockChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Session not found' },
      });

      const result = await sessionService.getSessionByTokenHash(tokenHash);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found');
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup expired sessions', async () => {
      const mockExpiredSessions = [{ id: 'expired_1' }, { id: 'expired_2' }];

      mockChain.then.mockImplementation((resolve: any) =>
        resolve({ data: mockExpiredSessions, error: null })
      );

      const result = await sessionService.cleanupExpiredSessions();

      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockChain.then.mockImplementation((resolve: any) =>
        resolve({ data: null, error: { message: 'Cleanup failed' } })
      );

      const result = await sessionService.cleanupExpiredSessions();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session cleanup failed');
    });

    it('should handle no expired sessions', async () => {
      mockChain.then.mockImplementation((resolve: any) => resolve({ data: [], error: null }));

      const result = await sessionService.cleanupExpiredSessions();

      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(0);
    });
  });

  describe('Security Validation', () => {
    it('should validate IP address format', async () => {
      const invalidRequest = {
        ...createMockSessionRequest(),
        ip_address: 'invalid.ip.address',
      };

      const result = await sessionService.createSession(invalidRequest);

      expect(result.success).toBe(false);
    });

    it('should validate NOSTR pubkey length', async () => {
      const invalidRequest = {
        ...createMockSessionRequest(),
        nostr_pubkey: 'short_key',
      };

      const result = await sessionService.createSession(invalidRequest);

      expect(result.success).toBe(false);
    });

    it('should validate UUID format for user_id', async () => {
      const invalidRequest = {
        ...createMockSessionRequest(),
        user_id: 'invalid-uuid-format',
      };

      const result = await sessionService.createSession(invalidRequest);

      expect(result.success).toBe(false);
    });

    it('should validate expires_at is in future', async () => {
      const invalidRequest = {
        ...createMockSessionRequest(),
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      };

      const result = await sessionService.createSession(invalidRequest);

      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed device info gracefully', async () => {
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
        },
      };

      // enforceSessionLimits: no existing sessions
      mockChain.then.mockImplementation((resolve: any) => resolve({ data: [], error: null }));
      // insert session succeeds
      mockChain.single.mockResolvedValue({
        data: { id: 'session_123', ...requestWithMalformedDevice },
        error: null,
      });

      const result = await sessionService.createSession(requestWithMalformedDevice);

      expect(result.success).toBe(true);
    });
  });
});
