// TODO: requires infrastructure fixes — ServiceToken not assignable to inversify ServiceIdentifier,
// missing auth interfaces (IUserAuthenticationService, LoginCredentials, AuthSession, MFAType, MFASetup),
// ServiceError missing 'code' option, IEventBus missing 'emit', INotificationService missing 'send'

import { TYPES } from '../../container/types';
import {
  IUserAuthenticationService,
  LoginCredentials,
  AuthSession,
  MFAType,
  MFASetup,
  PasswordValidation,
} from '../../interfaces/user';
import { ICacheService } from '../../interfaces/ICacheService';
import { IEventBusService } from '../../interfaces/IEventBusService';
import { IAuditLogService } from '../../interfaces/IAuditLogService';
import { INotificationService } from '../../interfaces/INotificationService';
import { IDatabase } from '../../interfaces/IDatabase';
import { Logger } from '../../utils/logger';
import { ServiceError } from '../../utils/errors';
import * as argon2 from 'argon2';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

/**
 * UserAuthenticationService provides secure authentication with MFA support,
 * rate limiting, session management, and comprehensive security features.
 *
 * Security features:
 * - Argon2id password hashing
 * - TOTP-based MFA with backup codes
 * - Rate limiting per IP and user
 * - Account lockout after failed attempts
 * - Secure session management with Redis
 * - JWT with refresh token rotation
 *
 * @implements IUserAuthenticationService
 */

export class UserAuthenticationService {
  private readonly logger: Logger;

  // Security configuration
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_MAX_ATTEMPTS = 10;
  private readonly SESSION_DURATION = 24 * 60 * 60; // 24 hours
  private readonly REFRESH_TOKEN_DURATION = 30 * 24 * 60 * 60; // 30 days

  // Password requirements
  private readonly PASSWORD_MIN_LENGTH = 12;
  private readonly PASSWORD_REQUIRE_UPPERCASE = true;
  private readonly PASSWORD_REQUIRE_LOWERCASE = true;
  private readonly PASSWORD_REQUIRE_NUMBER = true;
  private readonly PASSWORD_REQUIRE_SPECIAL = true;

  // JWT configuration
  private readonly JWT_SECRET = (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret && (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')) {
      throw new Error('JWT_SECRET environment variable is required in production/staging');
    }
    return secret || 'development-only-secret-key-not-for-production';
  })();
  private readonly JWT_REFRESH_SECRET = (() => {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret && (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required in production/staging');
    }
    return secret || 'development-only-refresh-secret-key-not-for-production';
  })();

  constructor(
    private readonly db: IDatabase,
    private readonly cache: ICacheService,
    private readonly eventBus: IEventBusService,
    private readonly auditLog: IAuditLogService,
    private readonly notification: INotificationService
  ) {
    this.logger = new Logger(UserAuthenticationService.name);
  }

  /**
   * Authenticates a user with credentials and optional MFA
   * @param credentials - Login credentials including username/email and password
   * @returns Authentication session with tokens
   */
  public async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      const { username, password, mfaToken, rememberMe, ipAddress, userAgent } = credentials;

      this.logger.info('Login attempt', { username, ipAddress });

      // Check rate limiting
      await this.checkRateLimit(ipAddress, username);

      // Get user from database
      const user = await this.getUserByUsername(username);
      if (!user) {
        await this.recordFailedAttempt(username, ipAddress);
        throw new ServiceError('Invalid credentials', { context: { code: 'INVALID_CREDENTIALS' } });
      }

      // Check if account is locked
      if (await this.isAccountLocked(user.id)) {
        throw new ServiceError('Account is temporarily locked', { context: { code: 'ACCOUNT_LOCKED' } });
      }

      // Verify password (constant-time comparison via argon2)
      const validPassword = await this.verifyPassword(password, user.passwordHash);
      if (!validPassword) {
        await this.recordFailedAttempt(username, ipAddress, user.id);
        throw new ServiceError('Invalid credentials', { context: { code: 'INVALID_CREDENTIALS' } });
      }

      // Check MFA if enabled
      if (user.mfaEnabled) {
        if (!mfaToken) {
          // Return partial session requiring MFA
          return {
            requiresMFA: true,
            mfaTypes: user.mfaTypes,
            sessionId: await this.createPendingSession(user.id),
          } as unknown as AuthSession;
        }

        const validMFA = await this.verifyMFA(user.id, mfaToken);
        if (!validMFA) {
          await this.recordFailedAttempt(username, ipAddress, user.id);
          throw new ServiceError('Invalid MFA token', { context: { code: 'INVALID_MFA' } });
        }
      }

      // Create session
      const sessionId = uuidv4();
      const accessToken = this.generateAccessToken(user.id, sessionId);
      const refreshToken = this.generateRefreshToken(user.id, sessionId);

      const session: AuthSession = {
        sessionId,
        userId: user.id,
        username: user.username,
        email: user.email,
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + this.SESSION_DURATION * 1000),
        createdAt: new Date(),
        ipAddress,
        userAgent,
        requiresMFA: false,
      };

      // Store session in Redis
      await this.storeSession(session);

      // Clear failed attempts
      await this.clearFailedAttempts(username, ipAddress, user.id);

      // Log successful login
      await this.auditLog.log({
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        userId: user.id,
        metadata: {
          ipAddress,
          userAgent,
          mfaUsed: user.mfaEnabled,
        },
        timestamp: new Date(),
      });

      // Emit login event
      await this.eventBus.emit('user.login', {
        userId: user.id,
        sessionId,
        ipAddress,
        timestamp: Date.now(),
      });

      // Send login notification if from new device
      if (await this.isNewDevice(user.id, userAgent)) {
        await this.notification.sendNotification({
          userId: user.id,
          type: 'security_alert',
          title: 'New device login',
          message: `Your account was accessed from a new device: ${userAgent}`,
          channel: 'email',
        });
      }

      this.logger.info('Login successful', { userId: user.id, sessionId });
      return session;
    } catch (error) {
      this.logger.error('Login failed', error);
      throw error instanceof ServiceError
        ? error
        : new ServiceError('Authentication failed', {
            cause: error,
          });
    }
  }

  /**
   * Logs out a user and invalidates their session
   * @param sessionId - The session to invalidate
   */
  public async logout(sessionId: string): Promise<void> {
    try {
      this.logger.info('Logout attempt', { sessionId });

      // Get session from cache
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new ServiceError('Invalid session', { context: { code: 'INVALID_SESSION' } });
      }

      // Invalidate session
      await this.cache.delete(`session:${sessionId}`);
      await this.cache.delete(`refresh:${session.refreshToken}`);

      // Add tokens to blacklist
      await this.blacklistToken(session.accessToken);
      await this.blacklistToken(session.refreshToken);

      // Log logout
      await this.auditLog.log({
        action: 'auth.logout',
        entityType: 'user',
        entityId: session.userId,
        userId: session.userId,
        metadata: { sessionId },
        timestamp: new Date(),
      });

      // Emit logout event
      await this.eventBus.emit('user.logout', {
        userId: session.userId,
        sessionId,
        timestamp: Date.now(),
      });

      this.logger.info('Logout successful', { sessionId });
    } catch (error) {
      this.logger.error('Logout failed', error);
      throw new ServiceError('Logout failed', {
        cause: error,
        context: { sessionId },
      });
    }
  }

  /**
   * Verifies a multi-factor authentication token
   * @param userId - The user to verify MFA for
   * @param token - The MFA token to verify
   * @returns Whether the token is valid
   */
  public async verifyMFA(userId: string, token: string): Promise<boolean> {
    try {
      // Get user's MFA settings
      const mfaSettings = await this.getUserMFASettings(userId);

      if (!mfaSettings || !mfaSettings.enabled) {
        return false;
      }

      // Try TOTP verification first
      if (mfaSettings.totpSecret) {
        const totp = new OTPAuth.TOTP({
          secret: OTPAuth.Secret.fromBase32(mfaSettings.totpSecret),
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        });
        const verified = totp.validate({ token, window: 2 }) !== null;

        if (verified) {
          await this.recordMFAUsage(userId, 'totp');
          return true;
        }
      }

      // Try backup codes
      if (mfaSettings.backupCodes && mfaSettings.backupCodes.length > 0) {
        const hashedToken = await this.hashBackupCode(token);
        const codeIndex = mfaSettings.backupCodes.indexOf(hashedToken);

        if (codeIndex !== -1) {
          // Remove used backup code
          mfaSettings.backupCodes.splice(codeIndex, 1);
          await this.updateBackupCodes(userId, mfaSettings.backupCodes);
          await this.recordMFAUsage(userId, 'backup');

          // Notify user if running low on backup codes
          if (mfaSettings.backupCodes.length < 3) {
            await this.notification.sendNotification({
              userId,
              type: 'security_warning',
              title: 'Low on backup codes',
              message: `You have ${mfaSettings.backupCodes.length} backup codes remaining.`,
              channel: 'email',
            });
          }

          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('MFA verification failed', error);
      return false;
    }
  }

  /**
   * Sets up MFA for a user
   * @param userId - The user to setup MFA for
   * @param type - The type of MFA to setup
   * @returns MFA setup information including QR code for TOTP
   */
  public async setupMFA(userId: string, type: MFAType): Promise<MFASetup> {
    try {
      this.logger.info('Setting up MFA', { userId, type });

      const user = await this.getUserById(userId);
      if (!user) {
        throw new ServiceError('User not found', { context: { code: 'USER_NOT_FOUND' } });
      }

      let setup: MFASetup;

      switch (type) {
        case 'totp': {
          // Generate TOTP secret
          const secret = new OTPAuth.Secret({ size: 32 });
          const totp = new OTPAuth.TOTP({
            issuer: 'Sovren',
            label: user.email,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret,
          });

          // Generate QR code
          const qrCodeUrl = await QRCode.toDataURL(totp.toString());

          // Store secret temporarily (user must verify to activate)
          await this.cache.set(
            `mfa_setup:${userId}`,
            { secret: secret.base32, type: 'totp' },
            600 // 10 minutes to complete setup
          );

          setup = {
            type: 'totp',
            secret: secret.base32,
            qrCode: qrCodeUrl,
            backupCodes: await this.generateBackupCodes(8),
          };
          break;
        }

        case 'webauthn': {
          // WebAuthn setup would go here
          throw new ServiceError('WebAuthn not yet implemented', { context: { code: 'NOT_IMPLEMENTED' } });
        }

        default:
          throw new ServiceError('Invalid MFA type', { context: { code: 'INVALID_MFA_TYPE' } });
      }

      // Log MFA setup initiated
      await this.auditLog.log({
        action: 'auth.mfa_setup',
        entityType: 'user',
        entityId: userId,
        userId,
        metadata: { type },
        timestamp: new Date(),
      });

      return setup;
    } catch (error) {
      this.logger.error('MFA setup failed', error);
      throw new ServiceError('MFA setup failed', {
        cause: error,
        context: { userId, type },
      });
    }
  }

  /**
   * Refreshes an authentication session using a refresh token
   * @param refreshToken - The refresh token
   * @returns New authentication session
   */
  public async refreshSession(refreshToken: string): Promise<AuthSession> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as any;

      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(refreshToken)) {
        throw new ServiceError('Invalid refresh token', { context: { code: 'INVALID_TOKEN' } });
      }

      // Get session from cache
      const session = await this.getSession(payload.sessionId);
      if (!session) {
        throw new ServiceError('Session not found', { context: { code: 'SESSION_NOT_FOUND' } });
      }

      // Rotate refresh token (security best practice)
      const newAccessToken = this.generateAccessToken(payload.userId, payload.sessionId);
      const newRefreshToken = this.generateRefreshToken(payload.userId, payload.sessionId);

      // Update session
      session.accessToken = newAccessToken;
      session.refreshToken = newRefreshToken;
      session.expiresAt = new Date(Date.now() + this.SESSION_DURATION * 1000);

      await this.storeSession(session);

      // Blacklist old tokens
      await this.blacklistToken(refreshToken);

      // Log token refresh
      await this.auditLog.log({
        action: 'auth.token_refresh',
        entityType: 'user',
        entityId: payload.userId,
        userId: payload.userId,
        metadata: { sessionId: payload.sessionId },
        timestamp: new Date(),
      });

      return session;
    } catch (error) {
      this.logger.error('Session refresh failed', error);
      throw new ServiceError('Session refresh failed', {
        cause: error,
      });
    }
  }

  /**
   * Validates a password against security requirements
   * @param password - The password to validate
   * @returns Validation result with any issues
   */
  public async validatePassword(password: string): Promise<PasswordValidation> {
    const errors: string[] = [];

    // Check length
    if (password.length < this.PASSWORD_MIN_LENGTH) {
      errors.push(`Password must be at least ${this.PASSWORD_MIN_LENGTH} characters`);
    }

    // Check uppercase
    if (this.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check lowercase
    if (this.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check number
    if (this.PASSWORD_REQUIRE_NUMBER && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check special character
    if (this.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check common passwords (simplified - use a proper library in production)
    const commonPasswords = ['password', '12345678', 'qwerty', 'abc123'];
    if (commonPasswords.some((common) => password.toLowerCase().includes(common))) {
      errors.push('Password is too common');
    }

    // Calculate password strength score
    let score = 0;
    if (password.length >= 12) score += 25;
    if (password.length >= 16) score += 25;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 15;
    if (/\d/.test(password)) score += 15;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 20;

    return {
      valid: errors.length === 0,
      score,
      errors,
      strength: score >= 80 ? 'strong' : score >= 50 ? 'fair' : 'weak',
    };
  }

  /**
   * Locks a user account for security reasons
   * @param userId - The user to lock
   * @param reason - The reason for locking
   */
  public async lockAccount(userId: string, reason: string): Promise<void> {
    try {
      this.logger.info('Locking account', { userId, reason });

      // Set lock in database
      await this.db.query('UPDATE users SET locked_at = $1, lock_reason = $2 WHERE id = $3', [
        new Date(),
        reason,
        userId,
      ]);

      // Set lock in cache for fast lookup
      await this.cache.set(
        `account_locked:${userId}`,
        { reason, lockedAt: Date.now() },
        this.LOCKOUT_DURATION / 1000
      );

      // Invalidate all sessions
      await this.invalidateUserSessions(userId);

      // Log account lock
      await this.auditLog.log({
        action: 'auth.account_locked',
        entityType: 'user',
        entityId: userId,
        userId,
        metadata: { reason },
        timestamp: new Date(),
        severity: 'warning',
      });

      // Notify user
      const user = await this.getUserById(userId);
      if (user) {
        await this.notification.sendNotification({
          userId,
          type: 'security_alert',
          title: 'Account locked',
          message: `Your account has been temporarily locked: ${reason}`,
          channel: 'email',
          priority: 'high',
        });
      }
    } catch (error) {
      this.logger.error('Failed to lock account', error);
      throw new ServiceError('Failed to lock account', {
        cause: error,
        context: { userId },
      });
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async getUserByUsername(username: string): Promise<any> {
    const result = await this.db.query<any>('SELECT * FROM users WHERE username = $1 OR email = $1', [
      username,
    ]);
    return result[0];
  }

  private async getUserById(userId: string): Promise<any> {
    const result = await this.db.query<any>('SELECT * FROM users WHERE id = $1', [userId]);
    return result[0];
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  private generateAccessToken(userId: string, sessionId: string): string {
    return jwt.sign({ userId, sessionId, type: 'access' }, this.JWT_SECRET, { expiresIn: '24h' });
  }

  private generateRefreshToken(userId: string, sessionId: string): string {
    return jwt.sign({ userId, sessionId, type: 'refresh' }, this.JWT_REFRESH_SECRET, {
      expiresIn: '30d',
    });
  }

  private async storeSession(session: AuthSession): Promise<void> {
    await this.cache.set(`session:${session.sessionId}`, session, this.SESSION_DURATION);
    await this.cache.set(
      `refresh:${session.refreshToken}`,
      session.sessionId,
      this.REFRESH_TOKEN_DURATION
    );
  }

  private async getSession(sessionId: string): Promise<AuthSession | null> {
    return this.cache.get<AuthSession>(`session:${sessionId}`);
  }

  private async checkRateLimit(ipAddress: string, username?: string): Promise<void> {
    const ipKey = `rate_limit:${ipAddress}`;
    const userKey = username ? `rate_limit:${username}` : null;

    const ipAttempts = (await this.cache.get<number>(ipKey)) || 0;
    if (ipAttempts >= this.RATE_LIMIT_MAX_ATTEMPTS) {
      throw new ServiceError('Rate limit exceeded', { context: { code: 'RATE_LIMIT' } });
    }

    if (userKey) {
      const userAttempts = (await this.cache.get<number>(userKey)) || 0;
      if (userAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        throw new ServiceError('Too many failed attempts', { context: { code: 'TOO_MANY_ATTEMPTS' } });
      }
    }
  }

  private async recordFailedAttempt(
    username: string,
    ipAddress: string,
    userId?: string
  ): Promise<void> {
    // Increment IP rate limit
    const ipKey = `rate_limit:${ipAddress}`;
    const ipAttempts = (await this.cache.get<number>(ipKey)) || 0;
    await this.cache.set(ipKey, ipAttempts + 1, this.RATE_LIMIT_WINDOW / 1000);

    // Increment user attempts
    const userKey = `failed_attempts:${username}`;
    const attempts = (await this.cache.get<number>(userKey)) || 0;
    await this.cache.set(userKey, attempts + 1, this.RATE_LIMIT_WINDOW / 1000);

    // Lock account if too many attempts
    if (userId && attempts + 1 >= this.MAX_LOGIN_ATTEMPTS) {
      await this.lockAccount(userId, 'Too many failed login attempts');
    }

    // Log failed attempt
    await this.auditLog.log({
      action: 'auth.failed_login',
      entityType: 'user',
      entityId: userId || 'unknown',
      userId: userId || 'unknown',
      metadata: { username, ipAddress, attempts: attempts + 1 },
      timestamp: new Date(),
      severity: 'warning',
    });
  }

  private async clearFailedAttempts(
    username: string,
    ipAddress: string,
    userId: string
  ): Promise<void> {
    await this.cache.delete(`failed_attempts:${username}`);
    await this.cache.delete(`rate_limit:${ipAddress}`);
    await this.cache.delete(`account_locked:${userId}`);
  }

  private async isAccountLocked(userId: string): Promise<boolean> {
    const locked = await this.cache.get(`account_locked:${userId}`);
    return !!locked;
  }

  private async isNewDevice(userId: string, userAgent?: string): Promise<boolean> {
    if (!userAgent) return false;

    const knownDevices = (await this.cache.get<string[]>(`known_devices:${userId}`)) || [];
    if (knownDevices.includes(userAgent)) {
      return false;
    }

    // Add to known devices
    knownDevices.push(userAgent);
    await this.cache.set(`known_devices:${userId}`, knownDevices, 30 * 24 * 60 * 60);

    return true;
  }

  private async createPendingSession(userId: string): Promise<string> {
    const sessionId = uuidv4();
    await this.cache.set(
      `pending_session:${sessionId}`,
      { userId, createdAt: Date.now() },
      300 // 5 minutes to complete MFA
    );
    return sessionId;
  }

  private async getUserMFASettings(userId: string): Promise<any> {
    const result = await this.db.query<any>(
      'SELECT * FROM user_mfa WHERE user_id = $1 AND enabled = true',
      [userId]
    );
    return result[0];
  }

  private async generateBackupCodes(count: number): Promise<string[]> {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private async hashBackupCode(code: string): Promise<string> {
    return argon2.hash(code, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
  }

  private async updateBackupCodes(userId: string, codes: string[]): Promise<void> {
    await this.db.query('UPDATE user_mfa SET backup_codes = $1 WHERE user_id = $2', [
      JSON.stringify(codes),
      userId,
    ]);
  }

  private async recordMFAUsage(userId: string, type: string): Promise<void> {
    await this.auditLog.log({
      action: 'auth.mfa_used',
      entityType: 'user',
      entityId: userId,
      userId,
      metadata: { type },
      timestamp: new Date(),
    });
  }

  private async blacklistToken(token: string): Promise<void> {
    const decoded = jwt.decode(token) as any;
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.cache.set(`blacklist:${token}`, true, ttl);
      }
    }
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    return !!(await this.cache.get(`blacklist:${token}`));
  }

  private async invalidateUserSessions(userId: string): Promise<void> {
    // This would iterate through all sessions and invalidate them
    // Implementation depends on how sessions are stored
    await this.eventBus.emit('user.sessions_invalidated', {
      userId,
      timestamp: Date.now(),
    });
  }
}
