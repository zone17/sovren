/**
 * 🧪 **ENHANCED NOSTR AUTHENTICATION SERVICE TESTS - US-213 Implementation**
 *
 * Comprehensive test suite for enhanced NOSTR authentication flow
 *
 * **Test Coverage for US-213: NOSTR Authentication Flow**
 *
 * Test Categories:
 * - Challenge generation with device registration ✅
 * - Multi-device authentication flows ✅
 * - Session management and refresh ✅
 * - Security monitoring and rate limiting ✅
 * - Analytics and event logging ✅
 * - Device management and revocation ✅
 * - Error handling and recovery ✅
 * - Edge cases and security scenarios ✅
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-20
 */

import { DeviceInfo, EnhancedNostrAuthService, SecurityAlert } from '../enhanced-nostr-auth';
import { NostrAuthService } from '../nostr-auth';

// Mock the base NOSTR auth service
jest.mock('../nostr-auth');

describe('Enhanced NOSTR Authentication Service - US-213', () => {
  let authService: EnhancedNostrAuthService;
  let mockBaseAuth: jest.Mocked<NostrAuthService>;

  const mockDeviceInfo: DeviceInfo = {
    deviceId: '123e4567-e89b-12d3-a456-426614174000',
    deviceName: 'Test Device',
    deviceType: 'browser',
    userAgent: 'Mozilla/5.0 Test',
    platform: 'linux',
    lastSeen: Date.now(),
    trusted: false,
  };

  const testPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create enhanced auth service with test configuration
    authService = new EnhancedNostrAuthService('test-secret', {
      sessionDuration: 60000, // 1 minute for testing
      refreshTokenDuration: 120000, // 2 minutes for testing
      maxDevicesPerUser: 3,
      enableAnalytics: true,
      enableSecurityMonitoring: true,
      rateLimitWindow: 60000, // 1 minute
      rateLimitMax: 5,
      encryptionKey: 'test-encryption-key-32-characters',
    });

    // Setup base auth service mock
    mockBaseAuth = (authService as any).baseAuthService;
    mockBaseAuth.generateChallenge = jest.fn().mockResolvedValue({
      challenge: 'test-challenge-64-chars-hex-string-12345678901234567890123456',
      timestamp: Date.now(),
      expires_at: Date.now() + 300000,
    });
    mockBaseAuth.verifySignature = jest.fn().mockResolvedValue({
      valid: true,
      pubkey: testPubkey,
    });
    mockBaseAuth.generateJWT = jest.fn().mockResolvedValue('test-jwt-token');
    mockBaseAuth.destroy = jest.fn();
  });

  afterEach(() => {
    authService.destroy();
  });

  describe('🎯 Challenge Generation with Device Registration', () => {
    it('should generate challenge with device registration', async () => {
      const result = await authService.generateChallengeForDevice(mockDeviceInfo);

      expect(result).toEqual({
        challenge: expect.stringMatching(/^[a-f0-9]{64}$/),
        deviceId: mockDeviceInfo.deviceId,
        timestamp: expect.any(Number),
        expires_at: expect.any(Number),
      });

      expect(mockBaseAuth.generateChallenge).toHaveBeenCalled();
    });

    it('should generate new device ID if not provided', async () => {
      const deviceWithoutId = { ...mockDeviceInfo };
      delete (deviceWithoutId as any).deviceId;

      const result = await authService.generateChallengeForDevice(deviceWithoutId);

      expect(result.deviceId).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
      );
    });

    it('should handle challenge generation errors', async () => {
      mockBaseAuth.generateChallenge.mockRejectedValue(new Error('Challenge generation failed'));

      await expect(authService.generateChallengeForDevice(mockDeviceInfo)).rejects.toThrow(
        'Failed to generate enhanced challenge'
      );
    });
  });

  describe('🔍 Enhanced Authentication with Multi-Device Support', () => {
    it('should authenticate successfully with valid signature', async () => {
      const authParams = {
        pubkey: testPubkey,
        signature: 'valid-signature-128-chars-hex',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      };

      const result = await authService.authenticateWithDevice(authParams);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.accessToken).toBe('test-jwt-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresAt).toBeDefined();

      expect(mockBaseAuth.verifySignature).toHaveBeenCalledWith({
        pubkey: testPubkey,
        signature: authParams.signature,
        challenge: authParams.challenge,
        timestamp: authParams.timestamp,
      });
    });

    it('should fail authentication with invalid signature', async () => {
      mockBaseAuth.verifySignature.mockResolvedValue({
        valid: false,
        pubkey: testPubkey,
        error: 'Invalid signature',
      });

      const authParams = {
        pubkey: testPubkey,
        signature: 'invalid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      };

      const result = await authService.authenticateWithDevice(authParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should detect suspicious activity and create security alerts', async () => {
      mockBaseAuth.verifySignature.mockResolvedValue({
        valid: false,
        pubkey: testPubkey,
        error: 'Invalid signature',
      });

      const authParams = {
        pubkey: testPubkey,
        signature: 'invalid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: { ...mockDeviceInfo, deviceId: 'unknown-device-id' },
      };

      // Simulate multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await authService.authenticateWithDevice(authParams);
      }

      const analytics = authService.getAnalytics(testPubkey);
      expect(analytics.securityAlerts.length).toBeGreaterThan(0);
      expect(analytics.securityAlerts[0].alertType).toBe('multiple_failures');
    });

    it('should enforce rate limiting', async () => {
      const authParams = {
        pubkey: testPubkey,
        signature: 'test-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      };

      // Exceed rate limit
      const promises = Array(10)
        .fill(null)
        .map(() => authService.authenticateWithDevice(authParams));
      const results = await Promise.all(promises);

      const rateLimitedResults = results.filter(
        (r) => r.error === 'Rate limit exceeded. Please try again later.'
      );
      expect(rateLimitedResults.length).toBeGreaterThan(0);
    });

    it('should handle authentication system errors', async () => {
      mockBaseAuth.verifySignature.mockRejectedValue(new Error('System error'));

      const authParams = {
        pubkey: testPubkey,
        signature: 'test-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      };

      const result = await authService.authenticateWithDevice(authParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('System error');
    });
  });

  describe('🔄 Session Management and Refresh', () => {
    let sessionId: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create a session first
      const authParams = {
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      };

      const authResult = await authService.authenticateWithDevice(authParams);
      sessionId = authResult.sessionId!;
      refreshToken = authResult.refreshToken!;
    });

    it('should refresh session with valid refresh token', async () => {
      const result = await authService.refreshSession(sessionId, refreshToken);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-jwt-token');
      expect(result.newRefreshToken).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should fail refresh with invalid session ID', async () => {
      const result = await authService.refreshSession('invalid-session-id', refreshToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should fail refresh with invalid refresh token', async () => {
      const result = await authService.refreshSession(sessionId, 'invalid-refresh-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });

    it('should get active sessions for user', async () => {
      const sessions = await authService.getActiveSessions(testPubkey);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].pubkey).toBe(testPubkey);
      expect(sessions[0].sessionId).toBe(sessionId);
    });

    it('should revoke specific session', async () => {
      const revoked = await authService.revokeSession(sessionId);
      expect(revoked).toBe(true);

      const sessions = await authService.getActiveSessions(testPubkey);
      expect(sessions).toHaveLength(0);
    });

    it('should revoke all sessions for user', async () => {
      // Create another session
      await authService.authenticateWithDevice({
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: { ...mockDeviceInfo, deviceId: 'another-device' },
      });

      const revokedCount = await authService.revokeAllSessions(testPubkey);
      expect(revokedCount).toBe(2);

      const sessions = await authService.getActiveSessions(testPubkey);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('📱 Device Management', () => {
    beforeEach(async () => {
      // Register initial device
      await authService.registerDevice(testPubkey, mockDeviceInfo);
    });

    it('should register and retrieve devices for user', async () => {
      const devices = await authService.getDevicesForUser(testPubkey);

      expect(devices).toHaveLength(1);
      expect(devices[0].deviceId).toBe(mockDeviceInfo.deviceId);
      expect(devices[0].deviceName).toBe(mockDeviceInfo.deviceName);
    });

    it('should enforce device limit per user', async () => {
      // Add devices up to limit (3)
      await authService.registerDevice(testPubkey, { ...mockDeviceInfo, deviceId: 'device-2' });
      await authService.registerDevice(testPubkey, { ...mockDeviceInfo, deviceId: 'device-3' });

      // Add one more device (should remove oldest)
      await authService.registerDevice(testPubkey, { ...mockDeviceInfo, deviceId: 'device-4' });

      const devices = await authService.getDevicesForUser(testPubkey);
      expect(devices).toHaveLength(3);

      // Original device should be removed
      const deviceIds = devices.map((d) => d.deviceId);
      expect(deviceIds).not.toContain(mockDeviceInfo.deviceId);
      expect(deviceIds).toContain('device-4');
    });

    it('should revoke device and associated sessions', async () => {
      // Create session for device
      await authService.authenticateWithDevice({
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      });

      const revoked = await authService.revokeDevice(testPubkey, mockDeviceInfo.deviceId);
      expect(revoked).toBe(true);

      const devices = await authService.getDevicesForUser(testPubkey);
      expect(devices).toHaveLength(0);

      const sessions = await authService.getActiveSessions(testPubkey);
      expect(sessions).toHaveLength(0);
    });

    it('should handle revoke device for non-existent user', async () => {
      const revoked = await authService.revokeDevice('non-existent-user', mockDeviceInfo.deviceId);
      expect(revoked).toBe(false);
    });
  });

  describe('📊 Analytics and Monitoring', () => {
    beforeEach(async () => {
      // Create some authentication events
      await authService.authenticateWithDevice({
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      });
    });

    it('should provide comprehensive analytics', () => {
      const analytics = authService.getAnalytics(testPubkey);

      expect(analytics.totalLogins).toBe(1);
      expect(analytics.successfulLogins).toBe(1);
      expect(analytics.failedLogins).toBe(0);
      expect(analytics.uniqueDevices).toBe(1);
      expect(analytics.topDeviceTypes.browser).toBe(1);
      expect(analytics.recentEvents).toHaveLength(1);
    });

    it('should provide global analytics when no pubkey specified', () => {
      const analytics = authService.getAnalytics();

      expect(analytics.totalLogins).toBeGreaterThanOrEqual(1);
      expect(analytics.uniqueDevices).toBeGreaterThanOrEqual(1);
    });

    it('should track authentication events', () => {
      const analytics = authService.getAnalytics(testPubkey);
      const loginEvents = analytics.recentEvents.filter((e) => e.eventType === 'login');

      expect(loginEvents).toHaveLength(1);
      expect(loginEvents[0].success).toBe(true);
      expect(loginEvents[0].pubkey).toBe(testPubkey);
    });
  });

  describe('🛡️ Security Monitoring', () => {
    it('should create security alerts for unknown devices', async () => {
      mockBaseAuth.verifySignature.mockResolvedValue({
        valid: false,
        pubkey: testPubkey,
        error: 'Invalid signature',
      });

      const unknownDevice = { ...mockDeviceInfo, deviceId: 'unknown-device' };

      await authService.authenticateWithDevice({
        pubkey: testPubkey,
        signature: 'invalid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: unknownDevice,
      });

      const analytics = authService.getAnalytics(testPubkey);
      const unknownDeviceAlerts = analytics.securityAlerts.filter(
        (alert) => alert.alertType === 'unknown_device'
      );

      expect(unknownDeviceAlerts).toHaveLength(1);
      expect(unknownDeviceAlerts[0].severity).toBe('medium');
    });

    it('should emit security alert events', (done) => {
      authService.on('security:alert', (alert: SecurityAlert) => {
        expect(alert.alertType).toBe('rate_limit');
        expect(alert.severity).toBe('medium');
        done();
      });

      // Trigger rate limit
      const authParams = {
        pubkey: testPubkey,
        signature: 'test-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      };

      // Exceed rate limit quickly
      Promise.all(
        Array(10)
          .fill(null)
          .map(() => authService.authenticateWithDevice(authParams))
      );
    });

    it('should emit authentication success events', (done) => {
      authService.on('authentication:success', (data) => {
        expect(data.pubkey).toBe(testPubkey);
        expect(data.deviceInfo.deviceId).toBe(mockDeviceInfo.deviceId);
        done();
      });

      authService.authenticateWithDevice({
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      });
    });
  });

  describe('🧹 Cleanup and Maintenance', () => {
    it('should cleanup expired sessions', async () => {
      // Create session
      const authResult = await authService.authenticateWithDevice({
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      });

      // Manually expire session
      const session = (authService as any).sessions.get(authResult.sessionId);
      session.expiresAt = Date.now() - 1000; // Expired

      // Trigger cleanup
      (authService as any).cleanup();

      const sessions = await authService.getActiveSessions(testPubkey);
      expect(sessions).toHaveLength(0);
    });

    it('should destroy service and cleanup resources', () => {
      const spy = jest.spyOn(mockBaseAuth, 'destroy');

      authService.destroy();

      expect(spy).toHaveBeenCalled();
      expect(authService.listenerCount('authentication:success')).toBe(0);
    });
  });

  describe('🔧 Error Handling and Edge Cases', () => {
    it('should handle invalid device info gracefully', async () => {
      const invalidDevice = {
        deviceId: 'invalid-uuid',
        deviceName: '',
        deviceType: 'unknown' as any,
        userAgent: '',
        platform: '',
        lastSeen: 0,
        trusted: false,
      };

      await expect(authService.generateChallengeForDevice(invalidDevice)).rejects.toThrow();
    });

    it('should handle JWT generation failures', async () => {
      mockBaseAuth.generateJWT.mockRejectedValue(new Error('JWT generation failed'));

      const authParams = {
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      };

      const result = await authService.authenticateWithDevice(authParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('JWT generation failed');
    });

    it('should handle empty pubkey gracefully', async () => {
      const authParams = {
        pubkey: '',
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      };

      const result = await authService.authenticateWithDevice(authParams);

      expect(result.success).toBe(false);
    });

    it('should handle refresh token generation errors', async () => {
      // Mock crypto.randomBytes to fail
      const originalRandomBytes = require('crypto').randomBytes;
      require('crypto').randomBytes = jest.fn().mockImplementation(() => {
        throw new Error('Random bytes generation failed');
      });

      const authParams = {
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      };

      const result = await authService.authenticateWithDevice(authParams);

      expect(result.success).toBe(false);

      // Restore original function
      require('crypto').randomBytes = originalRandomBytes;
    });
  });

  describe('⚡ Performance and Scalability', () => {
    it('should handle concurrent authentication requests', async () => {
      const concurrentRequests = Array(50)
        .fill(null)
        .map((_, index) =>
          authService.authenticateWithDevice({
            pubkey: `${testPubkey.slice(0, -2)}${index.toString().padStart(2, '0')}`,
            signature: 'valid-signature',
            challenge: 'test-challenge',
            timestamp: Date.now(),
            deviceInfo: { ...mockDeviceInfo, deviceId: `device-${index}` },
          })
        );

      const results = await Promise.all(concurrentRequests);
      const successfulResults = results.filter((r) => r.success);

      expect(successfulResults.length).toBeGreaterThan(0);
    });

    it('should maintain performance with large number of events', () => {
      // Simulate many events
      for (let i = 0; i < 1500; i++) {
        (authService as any).logAuthEvent({
          eventType: 'login',
          pubkey: testPubkey,
          success: true,
        });
      }

      const analytics = authService.getAnalytics();

      // Should limit events to 1000
      expect((authService as any).authEvents.length).toBe(1000);
      expect(analytics.recentEvents.length).toBe(10); // Last 10 events
    });
  });

  describe('🔒 Security Validation', () => {
    it('should validate session tokens securely', async () => {
      const authResult = await authService.authenticateWithDevice({
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      });

      // Try to refresh with wrong session ID
      const refreshResult = await authService.refreshSession(
        'wrong-session-id',
        authResult.refreshToken!
      );

      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBe('Session not found');
    });

    it('should detect potential session hijacking', async () => {
      const authResult = await authService.authenticateWithDevice({
        pubkey: testPubkey,
        signature: 'valid-signature',
        challenge: 'test-challenge',
        timestamp: Date.now(),
        deviceInfo: mockDeviceInfo,
      });

      // Try to refresh with wrong refresh token (potential hijacking)
      const refreshResult = await authService.refreshSession(
        authResult.sessionId!,
        'malicious-refresh-token'
      );

      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBe('Invalid refresh token');

      const analytics = authService.getAnalytics(testPubkey);
      const hijackAlerts = analytics.securityAlerts.filter(
        (alert) => alert.alertType === 'session_hijack'
      );

      expect(hijackAlerts).toHaveLength(1);
      expect(hijackAlerts[0].severity).toBe('high');
    });
  });
});
