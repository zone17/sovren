import { UserAuthenticationService } from '../UserAuthenticationService';
import { IDatabase } from '../../../interfaces/IDatabase';
import { ICacheService } from '../../../interfaces/ICacheService';
import { IEventBusService } from '../../../interfaces/IEventBusService';
import { IAuditLogService } from '../../../interfaces/IAuditLogService';
import { INotificationService } from '../../../interfaces/INotificationService';
import { ServiceError } from '../../../utils/errors';
import * as argon2 from 'argon2';
import * as OTPAuth from 'otpauth';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';

// Mock dependencies
vi.mock('argon2', () => ({
  default: { hash: vi.fn(), verify: vi.fn(), argon2id: 2 },
  hash: vi.fn(),
  verify: vi.fn(),
  argon2id: 2,
}));
vi.mock('otpauth', () => {
  const mockSecret = {
    base32: 'JBSWY3DPEHPK3PXP',
    hex: 'deadbeef',
  };
  const SecretMock = vi.fn().mockImplementation(() => mockSecret);
  SecretMock.fromBase32 = vi.fn().mockReturnValue(mockSecret);
  SecretMock.generate = vi.fn().mockReturnValue(mockSecret);
  return {
    TOTP: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockReturnValue('123456'),
      validate: vi.fn().mockReturnValue(0),
      toString: vi.fn().mockReturnValue('otpauth://totp/test'),
      secret: mockSecret,
    })),
    Secret: SecretMock,
  };
});
vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn(), verify: vi.fn(), decode: vi.fn() },
  sign: vi.fn(),
  verify: vi.fn(),
  decode: vi.fn(),
}));
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid'),
}));
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

describe('UserAuthenticationService', () => {
  let service: UserAuthenticationService;
  let mockDb: vi.Mocked<IDatabase>;
  let mockCache: vi.Mocked<ICacheService>;
  let mockEventBus: vi.Mocked<IEventBusService>;
  let mockAuditLog: vi.Mocked<IAuditLogService>;
  let mockNotification: vi.Mocked<INotificationService>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    mfaEnabled: false,
    mfaTypes: [],
  };

  const mockCredentials = {
    username: 'testuser',
    password: 'TestPassword123!',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    rememberMe: false,
  };

  beforeEach(() => {
    // Create mock implementations
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(),
    } as any;

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
      keys: vi.fn(),
      flush: vi.fn(),
    } as any;

    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    } as any;

    mockAuditLog = {
      log: vi.fn(),
      query: vi.fn(),
    } as any;

    mockNotification = {
      send: vi.fn(),
      sendBatch: vi.fn(),
    } as any;

    // Create service instance
    service = new UserAuthenticationService(
      mockDb,
      mockCache,
      mockEventBus,
      mockAuditLog,
      mockNotification
    );

    // Reset all mocks
    vi.resetAllMocks();
    (uuidv4 as any).mockReturnValue('session-123');
    (jwt.sign as any).mockImplementation((payload, secret, options) => `token-${payload.type}`);
    (jwt.verify as any).mockImplementation(() => ({
      userId: 'user-123',
      sessionId: 'session-123',
      type: 'refresh',
    }));
    (jwt.decode as any).mockImplementation(() => ({
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));
  });

  describe('login', () => {
    it('should authenticate valid credentials without MFA', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null); // No rate limiting
      mockDb.query.mockResolvedValue([mockUser]);
      (argon2.verify as any).mockResolvedValue(true);

      // Act
      const result = await service.login(mockCredentials);

      // Assert
      expect(result).toMatchObject({
        sessionId: 'session-123',
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        accessToken: 'token-access',
        refreshToken: 'token-refresh',
        requiresMFA: false,
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith('user.login', expect.any(Object));
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.login',
          userId: 'user-123',
        })
      );
    });

    it('should require MFA when enabled', async () => {
      // Arrange
      const mfaUser = { ...mockUser, mfaEnabled: true, mfaTypes: ['totp'] };
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue([mfaUser]);
      (argon2.verify as any).mockResolvedValue(true);

      // Act
      const result = await service.login(mockCredentials);

      // Assert
      expect(result).toMatchObject({
        requiresMFA: true,
        mfaTypes: ['totp'],
      });
      expect(result.sessionId).toBeDefined();
      expect(result.accessToken).toBeUndefined();
    });

    it('should verify MFA token when provided', async () => {
      // Arrange
      const mfaUser = { ...mockUser, mfaEnabled: true };
      const credentialsWithMFA = { ...mockCredentials, mfaToken: '123456' };
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue([mfaUser]);
      (argon2.verify as any).mockResolvedValue(true);

      // Mock MFA verification
      const verifyMFASpy = vi.spyOn(service, 'verifyMFA').mockResolvedValue(true);

      // Act
      const result = await service.login(credentialsWithMFA);

      // Assert
      expect(result.requiresMFA).toBe(false);
      expect(result.accessToken).toBeDefined();
      expect(verifyMFASpy).toHaveBeenCalledWith('user-123', '123456');
    });

    it('should enforce rate limiting per IP', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(10); // Max attempts reached

      // Act & Assert
      await expect(service.login(mockCredentials)).rejects.toThrow(ServiceError);
      await expect(service.login(mockCredentials)).rejects.toThrow('Rate limit exceeded');
    });

    it('should lock account after max failed attempts', async () => {
      // Arrange
      const lockSpy = vi.spyOn(service, 'lockAccount').mockResolvedValue(undefined);
      mockCache.get
        .mockResolvedValueOnce(null) // checkRateLimit: IP rate limit
        .mockResolvedValueOnce(0) // checkRateLimit: user attempts
        .mockResolvedValueOnce(null) // isAccountLocked
        .mockResolvedValueOnce(0) // recordFailedAttempt: IP attempts
        .mockResolvedValueOnce(4); // recordFailedAttempt: user attempts (4+1 >= 5 triggers lock)
      mockDb.query.mockResolvedValue([mockUser]);
      (argon2.verify as any).mockResolvedValue(false); // Wrong password

      // Act
      try {
        await service.login(mockCredentials);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(lockSpy).toHaveBeenCalledWith('user-123', 'Too many failed login attempts');
    });

    it('should reject locked accounts', async () => {
      // Arrange
      mockCache.get
        .mockResolvedValueOnce(null) // IP rate limit
        .mockResolvedValueOnce(null) // User attempts
        .mockResolvedValueOnce({ reason: 'Too many attempts' }); // Account locked
      mockDb.query.mockResolvedValue([mockUser]);

      // Act & Assert
      await expect(service.login(mockCredentials)).rejects.toThrow('Account is temporarily locked');
    });

    it('should send notification for new device login', async () => {
      // Arrange
      mockCache.get
        .mockResolvedValueOnce(null) // Rate limit
        .mockResolvedValueOnce(null) // Failed attempts
        .mockResolvedValueOnce(null) // Account lock
        .mockResolvedValueOnce([]); // Known devices (empty = new device)
      mockDb.query.mockResolvedValue([mockUser]);
      (argon2.verify as any).mockResolvedValue(true);

      // Act
      await service.login(mockCredentials);

      // Assert
      expect(mockNotification.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-123',
          type: 'security_alert',
          title: 'New device login',
        })
      );
    });
  });

  describe('logout', () => {
    it('should invalidate session and blacklist tokens', async () => {
      // Arrange
      const session = {
        sessionId: 'session-123',
        userId: 'user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };
      mockCache.get.mockResolvedValue(session);

      // Act
      await service.logout('session-123');

      // Assert
      expect(mockCache.delete).toHaveBeenCalledWith('session:session-123');
      expect(mockCache.delete).toHaveBeenCalledWith('refresh:refresh-token');
      expect(mockCache.set).toHaveBeenCalledWith(
        'blacklist:access-token',
        true,
        expect.any(Number)
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('user.logout', expect.any(Object));
    });

    it('should throw error for invalid session', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);

      // Act & Assert
      await expect(service.logout('invalid-session')).rejects.toThrow('Logout failed');
    });
  });

  describe('verifyMFA', () => {
    const mfaSettings = {
      enabled: true,
      totpSecret: 'JBSWY3DPEHPK3PXP',
      backupCodes: ['hashed-code-1', 'hashed-code-2'],
    };

    it('should verify valid TOTP token', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([mfaSettings]);
      const mockValidate = vi.fn().mockReturnValue(0);
      (OTPAuth.TOTP as any).mockImplementation(() => ({
        validate: mockValidate,
      }));
      (OTPAuth.Secret as any).fromBase32 = vi.fn().mockReturnValue('mock-secret');

      // Act
      const result = await service.verifyMFA('user-123', '123456');

      // Assert
      expect(result).toBe(true);
      expect(mockValidate).toHaveBeenCalledWith({ token: '123456', window: 2 });
    });

    it('should verify valid backup code and remove it', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([mfaSettings]);
      (OTPAuth.TOTP as any).mockImplementation(() => ({
        validate: vi.fn().mockReturnValue(null),
      }));
      (OTPAuth.Secret as any).fromBase32 = vi.fn().mockReturnValue('mock-secret');
      (argon2.hash as any).mockResolvedValue('hashed-code-1');

      // Act
      const result = await service.verifyMFA('user-123', 'BACKUP1');

      // Assert
      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE user_mfa SET backup_codes = $1 WHERE user_id = $2',
        [JSON.stringify(['hashed-code-2']), 'user-123']
      );
    });

    it('should notify user when backup codes are low', async () => {
      // Arrange
      const lowBackupSettings = {
        ...mfaSettings,
        backupCodes: ['hashed-code-1', 'hashed-code-2'], // Only 2 codes
      };
      mockDb.query.mockResolvedValue([lowBackupSettings]);
      (OTPAuth.TOTP as any).mockImplementation(() => ({
        validate: vi.fn().mockReturnValue(null),
      }));
      (OTPAuth.Secret as any).fromBase32 = vi.fn().mockReturnValue('mock-secret');
      (argon2.hash as any).mockResolvedValue('hashed-code-1');

      // Act
      await service.verifyMFA('user-123', 'BACKUP1');

      // Assert
      expect(mockNotification.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'security_warning',
          title: 'Low on backup codes',
          message: 'You have 1 backup codes remaining.',
        })
      );
    });

    it('should return false for invalid token', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([mfaSettings]);
      (OTPAuth.TOTP as any).mockImplementation(() => ({
        validate: vi.fn().mockReturnValue(null),
      }));
      (OTPAuth.Secret as any).fromBase32 = vi.fn().mockReturnValue('mock-secret');
      (argon2.hash as any).mockResolvedValue('invalid-hash');

      // Act
      const result = await service.verifyMFA('user-123', 'invalid');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('setupMFA', () => {
    it('should setup TOTP with QR code and backup codes', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([mockUser]);
      const mockSecret = { base32: 'SECRET123' };
      (OTPAuth.Secret as any).mockImplementation(() => mockSecret);
      (OTPAuth.TOTP as any).mockImplementation(() => ({
        toString: vi.fn().mockReturnValue('otpauth://totp/...'),
      }));
      (QRCode.toDataURL as any).mockResolvedValue('data:image/png;base64,...');

      // Act
      const result = await service.setupMFA('user-123', 'totp');

      // Assert
      expect(result).toMatchObject({
        type: 'totp',
        secret: 'SECRET123',
        qrCode: 'data:image/png;base64,...',
      });
      expect(result.backupCodes).toHaveLength(8);
      expect(mockCache.set).toHaveBeenCalledWith('mfa_setup:user-123', expect.any(Object), 600);
    });

    it('should throw error for unsupported MFA type', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([mockUser]);

      // Act & Assert
      await expect(service.setupMFA('user-123', 'webauthn')).rejects.toThrow('MFA setup failed');
    });
  });

  describe('refreshSession', () => {
    it('should refresh valid session with token rotation', async () => {
      // Arrange
      const session = {
        sessionId: 'session-123',
        userId: 'user-123',
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
      };
      mockCache.get
        .mockResolvedValueOnce(null) // Not blacklisted
        .mockResolvedValueOnce(session); // Session exists

      // Act
      const result = await service.refreshSession('old-refresh');

      // Assert
      expect(result.accessToken).toBe('token-access');
      expect(result.refreshToken).toBe('token-refresh');
      expect(mockCache.set).toHaveBeenCalledWith('blacklist:old-refresh', true, expect.any(Number));
    });

    it('should reject blacklisted refresh token', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(true); // Token is blacklisted

      // Act & Assert
      await expect(service.refreshSession('blacklisted-token')).rejects.toThrow(
        'Session refresh failed'
      );
    });
  });

  describe('validatePassword', () => {
    it('should validate strong password', async () => {
      // Act
      const result = await service.validatePassword('MyStr0ng!P@ssw0rd123');

      // Assert
      expect(result.valid).toBe(true);
      expect(result.strength).toBe('strong');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak password', async () => {
      // Act
      const result = await service.validatePassword('password');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
      expect(result.errors).toContain('Password is too common');
    });

    it('should calculate password strength score', async () => {
      // Test various passwords
      const weak = await service.validatePassword('abc123');
      const medium = await service.validatePassword('Abc123!@#');
      const strong = await service.validatePassword('MyVeryStr0ng!P@ssw0rd2024');

      expect(weak.strength).toBe('weak');
      expect(medium.strength).toBe('medium');
      expect(strong.strength).toBe('strong');
    });
  });

  describe('lockAccount', () => {
    it('should lock account and invalidate sessions', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([mockUser]);

      // Act
      await service.lockAccount('user-123', 'Suspicious activity');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET locked_at = $1, lock_reason = $2 WHERE id = $3',
        [expect.any(Date), 'Suspicious activity', 'user-123']
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        'account_locked:user-123',
        expect.any(Object),
        900 // 15 minutes
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'user.sessions_invalidated',
        expect.any(Object)
      );
      expect(mockNotification.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'security_alert',
          title: 'Account locked',
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should track and enforce rate limits per IP', async () => {
      // Test incremental rate limiting
      for (let i = 0; i < 9; i++) {
        mockCache.get.mockResolvedValueOnce(i); // Simulate increasing attempts
        mockDb.query.mockResolvedValue([mockUser]);
        (argon2.verify as any).mockResolvedValue(false);

        await expect(service.login(mockCredentials)).rejects.toThrow('Invalid credentials');
      }

      // 10th attempt should hit rate limit
      mockCache.get.mockResolvedValueOnce(10);
      await expect(service.login(mockCredentials)).rejects.toThrow('Rate limit exceeded');
    });

    it('should track rate limits per username', async () => {
      // Arrange - 4 failed attempts (one below lockout threshold)
      mockCache.get
        .mockResolvedValueOnce(2) // checkRateLimit: IP attempts
        .mockResolvedValueOnce(0) // checkRateLimit: user attempts
        .mockResolvedValueOnce(null) // isAccountLocked
        .mockResolvedValueOnce(2) // recordFailedAttempt: IP attempts
        .mockResolvedValueOnce(4); // recordFailedAttempt: user attempts
      mockDb.query.mockResolvedValue([mockUser]);
      (argon2.verify as any).mockResolvedValue(false);

      // Act
      try {
        await service.login(mockCredentials);
      } catch {
        // Expected to throw
      }

      // Assert - Should increment and trigger lockout on 5th attempt
      expect(mockCache.set).toHaveBeenCalledWith('failed_attempts:testuser', 5, 900);
    });

    it('should clear failed attempts on successful login', async () => {
      // Arrange
      mockCache.get
        .mockResolvedValueOnce(0) // checkRateLimit: IP attempts
        .mockResolvedValueOnce(3) // checkRateLimit: user attempts
        .mockResolvedValueOnce(null); // isAccountLocked
      mockDb.query.mockResolvedValue([mockUser]);
      (argon2.verify as any).mockResolvedValue(true);

      // Act
      await service.login(mockCredentials);

      // Assert
      expect(mockCache.delete).toHaveBeenCalledWith('failed_attempts:testuser');
      expect(mockCache.delete).toHaveBeenCalledWith('rate_limit:192.168.1.1');
      expect(mockCache.delete).toHaveBeenCalledWith('account_locked:user-123');
    });
  });

  describe('Security Features', () => {
    it('should use constant-time password comparison', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue([mockUser]);

      // Act
      await expect(service.login(mockCredentials)).rejects.toThrow('Invalid credentials');

      // Assert - argon2.verify provides constant-time comparison
      expect(argon2.verify).toHaveBeenCalled();
    });

    it('should hash passwords with secure parameters', async () => {
      // Call the private hashPassword method directly
      const hashSpy = vi.spyOn(argon2, 'hash').mockResolvedValue('hashed');

      await (service as any).hashPassword('TestPassword123!');

      expect(hashSpy).toHaveBeenCalledWith(
        'TestPassword123!',
        expect.objectContaining({
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        })
      );
    });

    it('should properly blacklist and check expired tokens', async () => {
      // Arrange
      const expiredToken = 'expired-token';
      (jwt.decode as any).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      });

      // Act
      await service['blacklistToken'](expiredToken);

      // Assert - Should not blacklist expired token
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should wrap database errors properly', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockRejectedValue(new Error('Database connection lost'));

      // Act & Assert
      await expect(service.login(mockCredentials)).rejects.toThrow(ServiceError);
      await expect(service.login(mockCredentials)).rejects.toThrow('Authentication failed');
    });

    it('should handle MFA setup errors gracefully', async () => {
      // Arrange
      mockDb.query.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.setupMFA('user-123', 'totp')).rejects.toThrow('MFA setup failed');
    });
  });
});
