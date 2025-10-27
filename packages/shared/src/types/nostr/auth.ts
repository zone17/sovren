/**
 * 🔐 NOSTR Authentication Types
 * US-305: Unified NOSTR Authentication Services
 *
 * Provides comprehensive type definitions for NOSTR authentication,
 * including challenge-response flow, JWT tokens, and session management.
 */

import { z } from 'zod';

// ============= Core Authentication Types =============

/**
 * Authentication challenge for NOSTR signature verification
 */
export interface NostrAuthChallenge {
  /** Unique challenge identifier */
  challengeId: string;
  /** Random challenge string to be signed */
  challenge: string;
  /** Public key requesting authentication */
  pubkey: string;
  /** Challenge creation timestamp */
  created_at: number;
  /** Challenge expiration timestamp */
  expires_at: number;
  /** Authentication realm/domain */
  realm?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * JWT token for authenticated NOSTR sessions
 */
export interface NostrAuthToken {
  /** JWT token string */
  jwt: string;
  /** Associated public key */
  pubkey: string;
  /** Token issuance timestamp */
  issued_at: number;
  /** Token expiration timestamp */
  expires_at: number;
  /** Refresh token for renewal */
  refresh_token?: string;
  /** Token scope/permissions */
  scope?: string[];
  /** Session identifier */
  session_id?: string;
}

/**
 * Authenticated NOSTR user
 */
export interface NostrAuthUser {
  /** Public key (hex) */
  pubkey: string;
  /** Bech32 encoded public key */
  npub: string;
  /** User profile data */
  profile?: NostrProfile;
  /** Authentication status */
  authenticated: boolean;
  /** Authentication method used */
  auth_method?: 'signature' | 'extension' | 'delegated';
  /** Session details */
  session?: NostrSession;
  /** User permissions */
  permissions?: string[];
  /** Last authentication timestamp */
  last_auth?: number;
}

/**
 * NOSTR user profile (NIP-01 metadata)
 */
export interface NostrProfile {
  /** Display name */
  name?: string;
  /** Username/handle */
  username?: string;
  /** Profile picture URL */
  picture?: string;
  /** Banner image URL */
  banner?: string;
  /** About/bio text */
  about?: string;
  /** Website URL */
  website?: string;
  /** NIP-05 identifier */
  nip05?: string;
  /** Lightning address */
  lud16?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * User session information
 */
export interface NostrSession {
  /** Unique session identifier */
  session_id: string;
  /** Session creation timestamp */
  created_at: number;
  /** Last activity timestamp */
  last_activity: number;
  /** Session expiration timestamp */
  expires_at: number;
  /** IP address */
  ip_address?: string;
  /** User agent string */
  user_agent?: string;
  /** Device fingerprint */
  device_id?: string;
  /** Active/inactive status */
  active: boolean;
}

// ============= Authentication Request/Response Types =============

/**
 * Authentication request payload
 */
export interface NostrAuthRequest {
  /** Public key requesting authentication */
  pubkey: string;
  /** Optional authentication method preference */
  method?: 'signature' | 'extension' | 'delegated';
  /** Optional session duration in seconds */
  duration?: number;
  /** Optional scope/permissions requested */
  scope?: string[];
  /** Client metadata */
  client?: {
    name?: string;
    version?: string;
    platform?: string;
  };
}

/**
 * Challenge response payload
 */
export interface NostrAuthResponse {
  /** Challenge identifier */
  challengeId: string;
  /** Signed challenge signature */
  signature: string;
  /** Public key that signed */
  pubkey: string;
  /** Optional event ID if using NIP-42 */
  event_id?: string;
  /** Timestamp of signature */
  signed_at: number;
}

/**
 * Token refresh request
 */
export interface NostrTokenRefreshRequest {
  /** Current JWT token */
  token: string;
  /** Refresh token */
  refresh_token: string;
  /** Optional new duration */
  duration?: number;
}

// ============= Security & Monitoring Types =============

/**
 * Security event for audit logging
 */
export interface NostrSecurityEvent {
  /** Event identifier */
  event_id: string;
  /** Event type */
  type: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'token_refresh' | 'session_expire' | 'suspicious_activity';
  /** Associated public key */
  pubkey?: string;
  /** Event timestamp */
  timestamp: number;
  /** Event details */
  details: {
    reason?: string;
    ip_address?: string;
    user_agent?: string;
    attempt_count?: number;
    [key: string]: unknown;
  };
  /** Severity level */
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Rate limit information
 */
export interface NostrRateLimitInfo {
  /** Public key or IP being limited */
  identifier: string;
  /** Number of attempts made */
  attempts: number;
  /** Window start timestamp */
  window_start: number;
  /** Window duration in ms */
  window_duration: number;
  /** Max attempts allowed */
  max_attempts: number;
  /** Lockout end timestamp if locked */
  locked_until?: number;
  /** Backoff multiplier */
  backoff_factor?: number;
}

// ============= Service Configuration Types =============

/**
 * Authentication service configuration
 */
export interface NostrAuthConfig {
  /** Challenge expiration in seconds (default: 300) */
  challengeTTL: number;
  /** Token expiration in seconds (default: 3600) */
  tokenTTL: number;
  /** Refresh token expiration in seconds (default: 604800) */
  refreshTokenTTL: number;
  /** Maximum concurrent sessions per user */
  maxSessions: number;
  /** Enable rate limiting */
  rateLimitEnabled: boolean;
  /** Rate limit window in seconds */
  rateLimitWindow: number;
  /** Maximum attempts per window */
  rateLimitMaxAttempts: number;
  /** Enable security event logging */
  securityLoggingEnabled: boolean;
  /** JWT signing secret */
  jwtSecret?: string;
  /** Allowed authentication methods */
  allowedMethods: Array<'signature' | 'extension' | 'delegated'>;
  /** Required scopes for different operations */
  requiredScopes?: Record<string, string[]>;
  /** Enable multi-device sessions */
  multiDeviceEnabled: boolean;
  /** Session timeout in seconds of inactivity */
  sessionTimeout: number;
  /** Enable anonymous authentication */
  anonymousEnabled: boolean;
}

// ============= Zod Validation Schemas =============

/**
 * Schema for validating auth challenges
 */
export const NostrAuthChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  challenge: z.string().min(32),
  pubkey: z.string().regex(/^[0-9a-f]{64}$/),
  created_at: z.number().positive(),
  expires_at: z.number().positive(),
  realm: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for validating auth tokens
 */
export const NostrAuthTokenSchema = z.object({
  jwt: z.string().min(1),
  pubkey: z.string().regex(/^[0-9a-f]{64}$/),
  issued_at: z.number().positive(),
  expires_at: z.number().positive(),
  refresh_token: z.string().optional(),
  scope: z.array(z.string()).optional(),
  session_id: z.string().uuid().optional(),
});

/**
 * Schema for validating auth requests
 */
export const NostrAuthRequestSchema = z.object({
  pubkey: z.string().regex(/^[0-9a-f]{64}$/),
  method: z.enum(['signature', 'extension', 'delegated']).optional(),
  duration: z.number().positive().optional(),
  scope: z.array(z.string()).optional(),
  client: z
    .object({
      name: z.string().optional(),
      version: z.string().optional(),
      platform: z.string().optional(),
    })
    .optional(),
});

/**
 * Schema for validating auth responses
 */
export const NostrAuthResponseSchema = z.object({
  challengeId: z.string().uuid(),
  signature: z.string().min(1),
  pubkey: z.string().regex(/^[0-9a-f]{64}$/),
  event_id: z.string().optional(),
  signed_at: z.number().positive(),
});

// ============= Type Guards =============

/**
 * Check if object is a valid auth challenge
 */
export function isNostrAuthChallenge(obj: unknown): obj is NostrAuthChallenge {
  try {
    NostrAuthChallengeSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if object is a valid auth token
 */
export function isNostrAuthToken(obj: unknown): obj is NostrAuthToken {
  try {
    NostrAuthTokenSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(user: NostrAuthUser): boolean {
  return user.authenticated && !!user.session && user.session.expires_at > Date.now();
}

// ============= Constants =============

/**
 * Default authentication configuration
 */
export const DEFAULT_AUTH_CONFIG: NostrAuthConfig = {
  challengeTTL: 300, // 5 minutes
  tokenTTL: 3600, // 1 hour
  refreshTokenTTL: 604800, // 7 days
  maxSessions: 5,
  rateLimitEnabled: true,
  rateLimitWindow: 60, // 1 minute
  rateLimitMaxAttempts: 10,
  securityLoggingEnabled: true,
  allowedMethods: ['signature', 'extension'],
  multiDeviceEnabled: true,
  sessionTimeout: 1800, // 30 minutes
  anonymousEnabled: false,
};

/**
 * Authentication error codes
 */
export enum NostrAuthError {
  INVALID_PUBKEY = 'INVALID_PUBKEY',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  CHALLENGE_EXPIRED = 'CHALLENGE_EXPIRED',
  CHALLENGE_NOT_FOUND = 'CHALLENGE_NOT_FOUND',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  RATE_LIMITED = 'RATE_LIMITED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  EXTENSION_NOT_FOUND = 'EXTENSION_NOT_FOUND',
  EXTENSION_REJECTED = 'EXTENSION_REJECTED',
}

// ============= Utility Types =============

/**
 * Authentication result
 */
export type NostrAuthResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: NostrAuthError; message: string };

/**
 * Authentication method
 */
export type NostrAuthMethod = 'signature' | 'extension' | 'delegated';

/**
 * Session state
 */
export type NostrSessionState = 'active' | 'idle' | 'expired' | 'revoked';