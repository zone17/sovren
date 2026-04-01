/**
 * User Authentication Service Interface
 * Secure authentication with MFA support, rate limiting, and session management.
 *
 * @epic Epic-005
 */

export interface LoginCredentials {
  username: string;
  password: string;
  mfaToken?: string;
  rememberMe?: boolean;
  ipAddress: string;
  userAgent?: string;
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  mfaRequired?: boolean;
  [key: string]: any;
}

export type MFAType = 'totp' | 'webauthn' | 'sms' | 'email';

export interface MFASetup {
  type: MFAType;
  secret?: string;
  qrCode?: string;
  backupCodes?: string[];
  [key: string]: any;
}

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very-strong';
  [key: string]: any;
}

export interface IUserAuthenticationService {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(sessionId: string): Promise<void>;
  verifyMFA(userId: string, token: string): Promise<boolean>;
  setupMFA(userId: string, type: MFAType): Promise<MFASetup>;
  refreshSession(refreshToken: string): Promise<AuthSession>;
  validatePassword(password: string): Promise<PasswordValidation>;
  lockAccount(userId: string, reason: string): Promise<void>;
}
