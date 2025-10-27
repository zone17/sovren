import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  DatabaseSessionManager,
  createDatabaseSessionManager,
} from '../services/unified-session-service';
import { Session, SessionMetadata, DeviceInfo } from '../../../shared/src/services/UnifiedSessionManager';

/**
 * 🧪 US-311: Unified Session Management Tests
 * WHY: Ensure 95%+ test coverage for session lifecycle, multi-device support, expiration
 * COVERAGE AREAS: Creation, validation, refresh, revocation, multi-device, activity tracking
 */

// =====================================================
// MOCK DATABASE
// =====================================================

const createMockDatabase = () => {
  const sessionsStore = new Map<string, any>();
  const activitiesStore: any[] = [];

  return {
    client: {
      from: jest.fn((table: string) => {
        if (table === 'unified_sessions') {
          return {
            insert: jest.fn((data: any) => ({
              select: jest.fn(() => ({
                single: jest.fn(async () => {
                  const id = data.id || `sess_${Date.now()}`;
                  sessionsStore.set(id, { ...data, id });
                  return { data: { ...data, id }, error: null };
                }),
              })),
            })),
            select: jest.fn(() => ({
              eq: jest.fn((col: string, val: any) => ({
                single: jest.fn(async () => {
                  if (col === 'id') {
                    const session = sessionsStore.get(val);
                    return { data: session || null, error: session ? null : { message: 'Not found' } };
                  }
                  if (col === 'token_hash') {
                    for (const [, session] of sessionsStore) {
                      if (session.token_hash === val && session.active) {
                        return { data: session, error: null };
                      }
                    }
                    return { data: null, error: { message: 'Not found' } };
                  }
                  if (col === 'pubkey') {
                    const sessions = Array.from(sessionsStore.values()).filter(
                      (s: any) => s.pubkey === val
                    );
                    return { data: sessions, error: null };
                  }
                  return { data: null, error: { message: 'Not found' } };
                }),
                eq: jest.fn(() => ({
                  single: jest.fn(async () => ({ data: null, error: null })),
                  order: jest.fn(() => ({
                    limit: jest.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
              order: jest.fn(() => ({
                limit: jest.fn(async () => ({ data: Array.from(sessionsStore.values()), error: null })),
              })),
              limit: jest.fn(async () => ({ data: [], error: null })),
            })),
            update: jest.fn((updates: any) => ({
              eq: jest.fn((col: string, val: any) => {
                const session = sessionsStore.get(val);
                if (session) {
                  Object.assign(session, updates);
                }
                return Promise.resolve({ data: session, error: null });
              }),
            })),
            delete: jest.fn(() => ({
              eq: jest.fn((col: string, val: any) => {
                sessionsStore.delete(val);
                return Promise.resolve({ error: null });
              }),
            })),
          };
        }

        if (table === 'unified_session_activities') {
          return {
            insert: jest.fn(async (data: any) => {
              activitiesStore.push(data);
              return { data, error: null };
            }),
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(async () => ({ data: activitiesStore, error: null })),
                })),
              })),
            })),
          };
        }

        return {};
      }),
    },
  };
};

// =====================================================
// TEST DATA FACTORIES
// =====================================================

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

const createMockSessionMetadata = (): SessionMetadata => ({
  device_fingerprint: 'device_fp_' + Math.random().toString(36).substring(7),
  ip_address: '192.168.1.100',
  user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  device_info: createMockDeviceInfo(),
  lightning_enabled: true,
  lightning_permissions: { payments: true },
  location: {
    country: 'United States',
    region: 'California',
    city: 'San Francisco',
  },
});

// =====================================================
// TEST SUITE
// =====================================================

describe('🔐 US-311: Unified Session Management', () => {
  let sessionManager: DatabaseSessionManager;
  let mockDb: any;

  const TEST_PUBKEY = 'a'.repeat(64);
  const TEST_USER_ID = 'user_test_123';
  const TEST_TOKEN = 'test_jwt_token_abc123';

  beforeEach(() => {
    mockDb = createMockDatabase();
    sessionManager = new DatabaseSessionManager(mockDb as any, {
      maxSessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
      idleTimeout: 24 * 60 * 60 * 1000, // 24 hours
      maxSessionsPerPubkey: 5,
      enableDeviceFingerprinting: true,
      enableActivityTracking: true,
      enableAutoRefresh: true,
    });
  });

  // =====================================================
  // SESSION CREATION TESTS
  // =====================================================

  describe('✨ Session Creation', () => {
    it('should create a new session with valid data', async () => {
      const metadata = createMockSessionMetadata();

      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^sess_[a-f0-9]{8}_\d+_[a-f0-9]{16}$/);
      expect(session.pubkey).toBe(TEST_PUBKEY);
      expect(session.user_id).toBe(TEST_USER_ID);
      expect(session.active).toBe(true);
      expect(session.device_info).toEqual(metadata.device_info);
      expect(session.lightning_enabled).toBe(true);
      expect(session.risk_score).toBeGreaterThanOrEqual(0);
      expect(session.risk_score).toBeLessThanOrEqual(100);
    });

    it('should generate correct session ID format', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      expect(session.id).toMatch(/^sess_/);
      expect(session.id).toContain(TEST_PUBKEY.substring(0, 8));
    });

    it('should set correct expiration times', async () => {
      const metadata = createMockSessionMetadata();
      const beforeCreate = Date.now();

      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      const afterCreate = Date.now();

      expect(session.created_at).toBeGreaterThanOrEqual(beforeCreate);
      expect(session.created_at).toBeLessThanOrEqual(afterCreate);
      expect(session.expires_at).toBeGreaterThan(session.created_at);
      expect(session.idle_timeout_at).toBeGreaterThan(session.created_at);
    });

    it('should calculate risk score based on metadata', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      // With full metadata, risk should be relatively low
      expect(session.risk_score).toBeLessThan(50);
    });

    it('should reject invalid pubkey', async () => {
      const metadata = createMockSessionMetadata();

      await expect(
        sessionManager.createSession('invalid_pubkey', TEST_USER_ID, TEST_TOKEN, metadata)
      ).rejects.toThrow('Invalid NOSTR pubkey');
    });

    it('should enforce session limits per pubkey', async () => {
      const metadata = createMockSessionMetadata();

      // Create max sessions
      for (let i = 0; i < 5; i++) {
        await sessionManager.createSession(
          TEST_PUBKEY,
          TEST_USER_ID,
          `token_${i}`,
          metadata
        );
      }

      // Creating one more should succeed (oldest will be revoked)
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        'token_new',
        metadata
      );

      expect(session).toBeDefined();
    });
  });

  // =====================================================
  // SESSION VALIDATION TESTS
  // =====================================================

  describe('✅ Session Validation', () => {
    it('should validate active session successfully', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      const result = await sessionManager.validateSession(session.id);

      expect(result.valid).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.id).toBe(session.id);
    });

    it('should reject validation for non-existent session', async () => {
      const result = await sessionManager.validateSession('sess_nonexistent');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should update last activity on validation', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      const originalActivity = session.last_activity_at;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const validationResult = await sessionManager.validateSession(session.id);

      expect(validationResult.session?.last_activity_at).toBeGreaterThan(originalActivity);
    });

    it('should indicate when session should be refreshed', async () => {
      const metadata = createMockSessionMetadata();

      // Create session with short duration for testing
      const shortDurationManager = new DatabaseSessionManager(mockDb as any, {
        maxSessionDuration: 1000, // 1 second
        idleTimeout: 24 * 60 * 60 * 1000,
        maxSessionsPerPubkey: 5,
      });

      const session = await shortDurationManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      // Wait for half duration
      await new Promise((resolve) => setTimeout(resolve, 600));

      const result = await shortDurationManager.validateSession(session.id);
      expect(result.shouldRefresh).toBe(true);
    });
  });

  // =====================================================
  // SESSION REFRESH TESTS
  // =====================================================

  describe('🔄 Session Refresh', () => {
    it('should refresh session expiration', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      const originalExpiresAt = session.expires_at;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const refreshedSession = await sessionManager.refreshSession(session.id);

      expect(refreshedSession.expires_at).toBeGreaterThan(originalExpiresAt);
    });

    it('should reject refresh for non-existent session', async () => {
      await expect(sessionManager.refreshSession('sess_nonexistent')).rejects.toThrow(
        'Session not found'
      );
    });

    it('should update idle timeout on refresh', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      const originalIdleTimeout = session.idle_timeout_at;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const refreshedSession = await sessionManager.refreshSession(session.id);

      expect(refreshedSession.idle_timeout_at).toBeGreaterThan(originalIdleTimeout);
    });
  });

  // =====================================================
  // SESSION REVOCATION TESTS
  // =====================================================

  describe('🚫 Session Revocation', () => {
    it('should revoke a single session', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      await sessionManager.revokeSession(session.id, 'manual');

      const result = await sessionManager.validateSession(session.id);
      expect(result.valid).toBe(false);
    });

    it('should revoke all sessions for a pubkey', async () => {
      const metadata = createMockSessionMetadata();

      // Create multiple sessions
      const sessions = await Promise.all([
        sessionManager.createSession(TEST_PUBKEY, TEST_USER_ID, 'token_1', metadata),
        sessionManager.createSession(TEST_PUBKEY, TEST_USER_ID, 'token_2', metadata),
        sessionManager.createSession(TEST_PUBKEY, TEST_USER_ID, 'token_3', metadata),
      ]);

      const revokedCount = await sessionManager.revokeAllSessions(TEST_PUBKEY);

      expect(revokedCount).toBe(3);
    });

    it('should revoke all sessions except specified one', async () => {
      const metadata = createMockSessionMetadata();

      // Create multiple sessions
      const session1 = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        'token_1',
        metadata
      );
      const session2 = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        'token_2',
        metadata
      );
      const session3 = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        'token_3',
        metadata
      );

      const revokedCount = await sessionManager.revokeAllSessions(TEST_PUBKEY, session2.id);

      expect(revokedCount).toBe(2);

      // session2 should still be valid
      const result = await sessionManager.validateSession(session2.id);
      expect(result.valid).toBe(true);
    });
  });

  // =====================================================
  // MULTI-DEVICE TESTS
  // =====================================================

  describe('📱 Multi-Device Support', () => {
    it('should track sessions across multiple devices', async () => {
      const desktopMetadata = createMockSessionMetadata();
      desktopMetadata.device_info.deviceType = 'desktop';

      const mobileMetadata = createMockSessionMetadata();
      mobileMetadata.device_info.deviceType = 'mobile';

      await sessionManager.createSession(TEST_PUBKEY, TEST_USER_ID, 'token_desktop', desktopMetadata);
      await sessionManager.createSession(TEST_PUBKEY, TEST_USER_ID, 'token_mobile', mobileMetadata);

      const sessions = await sessionManager.listSessions(TEST_PUBKEY);

      expect(sessions.length).toBe(2);
      expect(sessions.some((s) => s.device_info.deviceType === 'desktop')).toBe(true);
      expect(sessions.some((s) => s.device_info.deviceType === 'mobile')).toBe(true);
    });

    it('should generate unique device IDs per device', async () => {
      const metadata1 = createMockSessionMetadata();
      const metadata2 = createMockSessionMetadata();

      const session1 = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        'token_1',
        metadata1
      );
      const session2 = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        'token_2',
        metadata2
      );

      expect(session1.device_id).not.toBe(session2.device_id);
    });

    it('should revoke sessions by device', async () => {
      const metadata1 = createMockSessionMetadata();
      const metadata2 = createMockSessionMetadata();

      const session1 = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        'token_1',
        metadata1
      );
      const session2 = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        'token_2',
        metadata2
      );

      const revokedCount = await sessionManager.revokeSessionsByDevice(
        TEST_PUBKEY,
        session1.device_id
      );

      expect(revokedCount).toBeGreaterThan(0);
    });
  });

  // =====================================================
  // ACTIVITY TRACKING TESTS
  // =====================================================

  describe('📊 Activity Tracking', () => {
    it('should log session creation activity', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      const activities = await sessionManager.getSessionActivity(session.id);

      expect(activities.length).toBeGreaterThan(0);
      expect(activities.some((a) => a.activity_type === 'login')).toBe(true);
    });

    it('should log validation activity', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      await sessionManager.validateSession(session.id);

      const activities = await sessionManager.getSessionActivity(session.id);

      expect(activities.some((a) => a.activity_type === 'api_call')).toBe(true);
    });

    it('should log refresh activity', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      await sessionManager.refreshSession(session.id);

      const activities = await sessionManager.getSessionActivity(session.id);

      expect(activities.some((a) => a.activity_type === 'token_refresh')).toBe(true);
    });

    it('should log revocation activity', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      await sessionManager.revokeSession(session.id, 'test');

      const activities = await sessionManager.getSessionActivity(session.id);

      expect(activities.some((a) => a.activity_type === 'logout')).toBe(true);
    });
  });

  // =====================================================
  // STATISTICS TESTS
  // =====================================================

  describe('📈 Session Statistics', () => {
    it('should calculate session statistics', async () => {
      const metadata = createMockSessionMetadata();

      await sessionManager.createSession(TEST_PUBKEY, TEST_USER_ID, 'token_1', metadata);
      await sessionManager.createSession(TEST_PUBKEY, TEST_USER_ID, 'token_2', metadata);

      const stats = await sessionManager.getStatistics(TEST_PUBKEY);

      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.sessionsByDevice).toBeDefined();
    });

    it('should track sessions by device type', async () => {
      const desktopMetadata = createMockSessionMetadata();
      desktopMetadata.device_info.deviceType = 'desktop';

      const mobileMetadata = createMockSessionMetadata();
      mobileMetadata.device_info.deviceType = 'mobile';

      await sessionManager.createSession(TEST_PUBKEY, TEST_USER_ID, 'token_desktop', desktopMetadata);
      await sessionManager.createSession(TEST_PUBKEY, TEST_USER_ID, 'token_mobile', mobileMetadata);

      const stats = await sessionManager.getStatistics(TEST_PUBKEY);

      expect(stats.sessionsByDevice.desktop).toBe(1);
      expect(stats.sessionsByDevice.mobile).toBe(1);
    });
  });

  // =====================================================
  // TOKEN LOOKUP TESTS
  // =====================================================

  describe('🔍 Token Lookup', () => {
    it('should retrieve session by token', async () => {
      const metadata = createMockSessionMetadata();
      const session = await sessionManager.createSession(
        TEST_PUBKEY,
        TEST_USER_ID,
        TEST_TOKEN,
        metadata
      );

      const retrievedSession = await sessionManager.getSessionByToken(TEST_TOKEN);

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.id).toBe(session.id);
    });

    it('should return null for invalid token', async () => {
      const session = await sessionManager.getSessionByToken('invalid_token');

      expect(session).toBeNull();
    });
  });

  // =====================================================
  // CONFIGURATION TESTS
  // =====================================================

  describe('⚙️ Configuration', () => {
    it('should use custom configuration', async () => {
      const customConfig = {
        maxSessionDuration: 1000,
        idleTimeout: 500,
        maxSessionsPerPubkey: 3,
      };

      const customManager = new DatabaseSessionManager(mockDb as any, customConfig);
      const config = customManager.getConfig();

      expect(config.maxSessionDuration).toBe(1000);
      expect(config.idleTimeout).toBe(500);
      expect(config.maxSessionsPerPubkey).toBe(3);
    });

    it('should update configuration dynamically', () => {
      sessionManager.updateConfig({ maxSessionsPerPubkey: 10 });
      const config = sessionManager.getConfig();

      expect(config.maxSessionsPerPubkey).toBe(10);
    });
  });

  // =====================================================
  // FACTORY FUNCTION TESTS
  // =====================================================

  describe('🏭 Factory Functions', () => {
    it('should create session manager via factory', () => {
      const manager = createDatabaseSessionManager(mockDb as any);

      expect(manager).toBeInstanceOf(DatabaseSessionManager);
    });
  });

  // =====================================================
  // HEALTH CHECK TESTS
  // =====================================================

  describe('🏥 Health Check', () => {
    it('should perform health check successfully', async () => {
      const health = await sessionManager.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain('healthy');
    });
  });
});
