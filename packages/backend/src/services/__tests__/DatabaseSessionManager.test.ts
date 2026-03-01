/**
 * US-311: DatabaseSessionManager Tests
 * WHY: Ensure database session management works correctly with 95%+ coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSessionManager } from '../DatabaseSessionManager';
import type { SessionMetadata, DeviceInfo } from '@shared/services/UnifiedSessionManager';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

vi.mock('@supabase/supabase-js');

/** Helper: compute the SHA-256 hex hash that the service uses internally */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a chainable Supabase mock where every builder method returns the chain
 * and the chain is thenable (resolves when awaited).
 */
function createChainMock() {
  let _result: any = { data: null, error: null };

  const chain: any = {};

  chain._resolve = (value: any) => {
    _result = value;
  };
  chain.from = vi.fn(() => {
    _result = { data: null, error: null };
    return chain;
  });
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.lt = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.gt = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.then = (resolve: any, reject?: any) => Promise.resolve(_result).then(resolve, reject);

  return chain;
}

describe('DatabaseSessionManager', () => {
  let sessionManager: DatabaseSessionManager;
  let mockChain: ReturnType<typeof createChainMock>;

  const mockDeviceInfo: DeviceInfo = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    platform: 'MacIntel',
    deviceType: 'desktop',
    browser: 'Chrome',
    browserVersion: '120',
    os: 'macOS',
    osVersion: '10.15.7',
    fingerprint: 'test_fingerprint_123',
    screenResolution: '1920x1080',
    timezone: 'America/New_York',
    language: 'en-US',
  };

  const mockMetadata: SessionMetadata = {
    device_fingerprint: 'test_fingerprint_123',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    device_info: mockDeviceInfo,
    lightning_enabled: false,
    lightning_permissions: {},
  };

  const mockPubkey = 'a'.repeat(64);

  beforeEach(() => {
    mockChain = createChainMock();
    (createClient as any).mockReturnValue(mockChain);

    sessionManager = new DatabaseSessionManager({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      maxSessionsPerUser: 5,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      let callCount = 0;
      mockChain.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          mockChain._resolve({ data: [], error: null });
        } else {
          mockChain._resolve({ data: null, error: null });
        }
        return mockChain;
      });

      const session = await sessionManager.createSession(mockPubkey, mockMetadata);

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session_/);
      expect(session.pubkey).toBe(mockPubkey);
      expect(session.device_fingerprint).toBe(mockMetadata.device_fingerprint);
      expect(session.is_active).toBe(true);
      expect(session.token).toBeDefined();
      expect(mockChain.from).toHaveBeenCalledWith('sessions');
    });

    it('should enforce session limit per user', async () => {
      const existingSessions = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `session_${i}`,
          pubkey: mockPubkey,
          user_id: 'uid',
          token_hash: 'hash',
          device_id: `dev_${i}`,
          device_fingerprint: `fp_${i}`,
          device_info: mockDeviceInfo,
          is_active: true,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          last_activity: new Date(Date.now() - i * 1000).toISOString(),
          refresh_count: 0,
        }));

      let callCount = 0;
      mockChain.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          mockChain._resolve({ data: existingSessions, error: null });
        } else {
          mockChain._resolve({ data: null, error: null });
        }
        return mockChain;
      });

      const session = await sessionManager.createSession(mockPubkey, mockMetadata);
      expect(session).toBeDefined();
      expect(mockChain.update).toHaveBeenCalled();
    });

    it('should generate unique session IDs', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [], error: null });
        return mockChain;
      });

      const session1 = await sessionManager.createSession(mockPubkey, mockMetadata);
      const session2 = await sessionManager.createSession(mockPubkey, mockMetadata);
      expect(session1.id).not.toBe(session2.id);
    });

    it('should hash the token before storing', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [], error: null });
        return mockChain;
      });

      const session = await sessionManager.createSession(mockPubkey, mockMetadata);
      expect(session.token_hash).toBeDefined();
      expect(session.token_hash).not.toBe(session.token);
      expect(session.token_hash).toHaveLength(64);
    });

    it('should log session creation activity', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [], error: null });
        return mockChain;
      });

      await sessionManager.createSession(mockPubkey, mockMetadata);
      expect(mockChain.from).toHaveBeenCalledWith('session_activities');
    });
  });

  describe('validateSession', () => {
    it('should validate a valid session', async () => {
      const token = 'test_token';
      const mockSession = {
        id: 'session_test',
        pubkey: mockPubkey,
        user_id: 'uid',
        token_hash: hashToken(token),
        device_id: 'dev1',
        device_fingerprint: 'fp1',
        device_info: mockDeviceInfo,
        is_active: true,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        last_activity: new Date().toISOString(),
        refresh_count: 0,
      };

      let callCount = 0;
      mockChain.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          mockChain._resolve({ data: mockSession, error: null });
        } else {
          mockChain._resolve({ data: null, error: null });
        }
        return mockChain;
      });

      const validation = await sessionManager.validateSession('session_test', token, mockMetadata);
      expect(validation.valid).toBe(true);
      expect(validation.session).toBeDefined();
    });

    it('should reject expired sessions', async () => {
      const token = 'test_token';
      const mockSession = {
        id: 'session_test',
        pubkey: mockPubkey,
        user_id: 'uid',
        token_hash: hashToken(token),
        device_id: 'dev1',
        device_fingerprint: 'fp1',
        device_info: mockDeviceInfo,
        is_active: true,
        expires_at: new Date(Date.now() - 1000).toISOString(),
        last_activity: new Date().toISOString(),
        refresh_count: 0,
      };

      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: mockSession, error: null });
        return mockChain;
      });

      const validation = await sessionManager.validateSession('session_test', token, mockMetadata);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Session expired');
      expect(validation.expired).toBe(true);
    });

    it('should reject inactive sessions', async () => {
      const token = 'test_token';
      const mockSession = {
        id: 'session_test',
        pubkey: mockPubkey,
        user_id: 'uid',
        token_hash: hashToken(token),
        device_id: 'dev1',
        device_fingerprint: 'fp1',
        device_info: mockDeviceInfo,
        is_active: false,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        last_activity: new Date().toISOString(),
        refresh_count: 0,
      };

      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: mockSession, error: null });
        return mockChain;
      });

      const validation = await sessionManager.validateSession('session_test', token, mockMetadata);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Session inactive');
    });

    it('should reject non-existent sessions', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: null, error: null });
        return mockChain;
      });

      const validation = await sessionManager.validateSession(
        'nonexistent',
        'test_token',
        mockMetadata
      );
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Session not found');
    });

    it('should update last activity on successful validation', async () => {
      const token = 'test_token';
      const mockSession = {
        id: 'session_test',
        pubkey: mockPubkey,
        user_id: 'uid',
        token_hash: hashToken(token),
        device_id: 'dev1',
        device_fingerprint: 'fp1',
        device_info: mockDeviceInfo,
        is_active: true,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        last_activity: new Date(Date.now() - 60000).toISOString(),
        refresh_count: 0,
      };

      let callCount = 0;
      mockChain.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          mockChain._resolve({ data: mockSession, error: null });
        } else {
          mockChain._resolve({ data: null, error: null });
        }
        return mockChain;
      });

      await sessionManager.validateSession('session_test', token, mockMetadata);
      expect(mockChain.update).toHaveBeenCalled();
    });
  });

  describe('refreshSession', () => {
    it('should refresh a valid session', async () => {
      const token = 'test_token';
      const mockSession = {
        id: 'session_test',
        pubkey: mockPubkey,
        user_id: 'uid',
        token_hash: hashToken(token),
        device_id: 'dev1',
        device_fingerprint: 'fp1',
        device_info: mockDeviceInfo,
        is_active: true,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        last_activity: new Date().toISOString(),
        refresh_count: 0,
      };

      let callCount = 0;
      mockChain.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          mockChain._resolve({ data: mockSession, error: null });
        } else {
          mockChain._resolve({ data: null, error: null });
        }
        return mockChain;
      });

      const refreshed = await sessionManager.refreshSession('session_test', token);
      expect(refreshed).not.toBeNull();
      expect(refreshed!.token).toBeDefined();
    });

    it('should generate a new token on refresh', async () => {
      const token = 'test_token';
      const mockSession = {
        id: 'session_test',
        pubkey: mockPubkey,
        user_id: 'uid',
        token_hash: hashToken(token),
        device_id: 'dev1',
        device_fingerprint: 'fp1',
        device_info: mockDeviceInfo,
        is_active: true,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        last_activity: new Date().toISOString(),
        refresh_count: 0,
      };

      let callCount = 0;
      mockChain.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          mockChain._resolve({ data: mockSession, error: null });
        } else {
          mockChain._resolve({ data: null, error: null });
        }
        return mockChain;
      });

      const refreshed = await sessionManager.refreshSession('session_test', token);
      expect(refreshed).not.toBeNull();
      expect(refreshed!.token).toBeDefined();
      expect(refreshed!.token).not.toBe(token);
    });

    it('should increment refresh count', async () => {
      const token = 'test_token';
      const mockSession = {
        id: 'session_test',
        pubkey: mockPubkey,
        user_id: 'uid',
        token_hash: hashToken(token),
        device_id: 'dev1',
        device_fingerprint: 'fp1',
        device_info: mockDeviceInfo,
        is_active: true,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        last_activity: new Date().toISOString(),
        refresh_count: 2,
      };

      let callCount = 0;
      mockChain.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          mockChain._resolve({ data: mockSession, error: null });
        } else {
          mockChain._resolve({ data: null, error: null });
        }
        return mockChain;
      });

      const refreshed = await sessionManager.refreshSession('session_test', token);
      expect(refreshed).not.toBeNull();
      expect(refreshed!.refresh_count).toBe(3);
    });
  });

  describe('revokeSession', () => {
    it('should revoke an active session', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: null, error: null });
        return mockChain;
      });

      await sessionManager.revokeSession('session_test');
      expect(mockChain.update).toHaveBeenCalled();
      expect(mockChain.from).toHaveBeenCalledWith('sessions');
    });

    it('should log revocation activity', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: null, error: null });
        return mockChain;
      });

      await sessionManager.revokeSession('session_test');
      expect(mockChain.from).toHaveBeenCalledWith('session_activities');
    });

    it('should handle revocation errors gracefully', async () => {
      let callCount = 0;
      mockChain.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          mockChain._resolve({ error: { message: 'Database error' } });
        } else {
          mockChain._resolve({ data: null, error: null });
        }
        return mockChain;
      });

      await expect(sessionManager.revokeSession('session_test')).rejects.toThrow(
        'Failed to revoke session'
      );
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all sessions except specified one', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: null, error: null });
        return mockChain;
      });

      await sessionManager.revokeAllUserSessions(mockPubkey, 'session_keep');
      expect(mockChain.neq).toHaveBeenCalledWith('id', 'session_keep');
      expect(mockChain.update).toHaveBeenCalled();
    });

    it('should revoke all sessions when no exception specified', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: null, error: null });
        return mockChain;
      });

      await sessionManager.revokeAllUserSessions(mockPubkey);
      expect(mockChain.update).toHaveBeenCalled();
      expect(mockChain.neq).not.toHaveBeenCalled();
    });
  });

  describe('Multi-device support', () => {
    it('should track different devices separately', async () => {
      const device2Metadata = {
        ...mockMetadata,
        device_fingerprint: 'different_fingerprint',
        device_info: { ...mockDeviceInfo, deviceType: 'mobile' as const },
      };

      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [], error: null });
        return mockChain;
      });

      const session1 = await sessionManager.createSession(mockPubkey, mockMetadata);
      const session2 = await sessionManager.createSession(mockPubkey, device2Metadata);

      expect(session1.device_fingerprint).toBe('test_fingerprint_123');
      expect(session2.device_fingerprint).toBe('different_fingerprint');
      expect(session1.device_id).not.toBe(session2.device_id);
    });

    it('should enforce max 5 devices per user', async () => {
      const existingSessions = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `session_${i}`,
          pubkey: mockPubkey,
          user_id: 'uid',
          token_hash: 'hash',
          device_id: `dev_${i}`,
          device_fingerprint: `device_${i}`,
          device_info: mockDeviceInfo,
          is_active: true,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          last_activity: new Date(Date.now() - i * 1000).toISOString(),
          refresh_count: 0,
        }));

      let callCount = 0;
      mockChain.from = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          mockChain._resolve({ data: existingSessions, error: null });
        } else {
          mockChain._resolve({ data: null, error: null });
        }
        return mockChain;
      });

      const session = await sessionManager.createSession(mockPubkey, mockMetadata);
      expect(mockChain.update).toHaveBeenCalled();
      expect(session).toBeDefined();
    });
  });

  describe('Activity tracking', () => {
    it('should retrieve session activities', async () => {
      const mockActivities = [
        {
          id: 'act_1',
          session_id: 'session_test',
          action: 'login',
          created_at: new Date().toISOString(),
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          metadata: {},
        },
        {
          id: 'act_2',
          session_id: 'session_test',
          action: 'api_call',
          created_at: new Date().toISOString(),
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          metadata: {},
        },
      ];

      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: mockActivities, error: null });
        return mockChain;
      });

      const activities = await sessionManager.getSessionActivities('session_test', 100);
      expect(activities).toHaveLength(2);
      expect(activities[0].action).toBe('login');
    });

    it('should limit activities to last 100 by default', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [], error: null });
        return mockChain;
      });

      await sessionManager.getSessionActivities('session_test');
      expect(mockChain.limit).toHaveBeenCalledWith(100);
    });
  });

  describe('getSessionStats', () => {
    it('should calculate session statistics', async () => {
      const mockSessions = [
        {
          id: 'session_1',
          pubkey: mockPubkey,
          is_active: true,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date(Date.now() - 3600000).toISOString(),
          last_activity: new Date().toISOString(),
          device_info: { deviceType: 'desktop' },
        },
        {
          id: 'session_2',
          pubkey: mockPubkey,
          is_active: true,
          expires_at: new Date(Date.now() - 1000).toISOString(),
          created_at: new Date(Date.now() - 7200000).toISOString(),
          last_activity: new Date(Date.now() - 3600000).toISOString(),
          device_info: { deviceType: 'mobile' },
        },
        {
          id: 'session_3',
          pubkey: mockPubkey,
          is_active: false,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date(Date.now() - 1800000).toISOString(),
          last_activity: new Date(Date.now() - 600000).toISOString(),
          device_info: { deviceType: 'tablet' },
        },
      ];

      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: mockSessions, error: null });
        return mockChain;
      });

      const stats = await sessionManager.getSessionStats(mockPubkey);
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.expired).toBe(1);
      expect(stats.revoked).toBe(1);
      expect(stats.byDevice).toEqual({ desktop: 1, mobile: 1, tablet: 1 });
    });
  });

  describe('cleanExpiredSessions', () => {
    it('should remove expired sessions', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({
          data: [{ id: 'session_1' }, { id: 'session_2' }, { id: 'session_3' }],
          error: null,
        });
        return mockChain;
      });

      const count = await sessionManager.cleanExpiredSessions();
      expect(count).toBe(3);
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.lt).toHaveBeenCalled();
    });

    it('should return 0 when no sessions are expired', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [], error: null });
        return mockChain;
      });

      const count = await sessionManager.cleanExpiredSessions();
      expect(count).toBe(0);
    });
  });

  describe('querySessions', () => {
    const fullRow = {
      id: 'session_1',
      pubkey: 'a'.repeat(64),
      user_id: 'uid',
      token_hash: 'h',
      device_id: 'd',
      device_fingerprint: 'fp',
      device_info: {
        userAgent: '',
        platform: '',
        deviceType: 'desktop' as const,
        browser: '',
        browserVersion: '',
        os: '',
        osVersion: '',
        fingerprint: '',
        screenResolution: '',
        timezone: '',
        language: '',
      },
      is_active: true,
      created_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      refresh_count: 0,
    };

    it('should query sessions by pubkey', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [fullRow], error: null });
        return mockChain;
      });

      const sessions = await sessionManager.querySessions({ pubkey: mockPubkey });
      expect(mockChain.eq).toHaveBeenCalledWith('pubkey', mockPubkey);
      expect(sessions).toHaveLength(1);
    });

    it('should query sessions by device_id', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [fullRow], error: null });
        return mockChain;
      });

      await sessionManager.querySessions({ deviceId: 'device_123' });
      expect(mockChain.eq).toHaveBeenCalledWith('device_id', 'device_123');
    });

    it('should query active sessions only', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [fullRow], error: null });
        return mockChain;
      });

      await sessionManager.querySessions({ active: true });
      expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should apply date range filters', async () => {
      mockChain.from = vi.fn(() => {
        mockChain._resolve({ data: [], error: null });
        return mockChain;
      });

      await sessionManager.querySessions({
        since: new Date(Date.now() - 86400000),
        until: new Date(),
      });
      expect(mockChain.gte).toHaveBeenCalled();
    });
  });
});
