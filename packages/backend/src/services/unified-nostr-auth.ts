/**
 * 🔐 Unified NOSTR Authentication Service
 * US-305: Consolidate NOSTR authentication services
 *
 * This service unifies:
 * - Frontend KeyManagementService for signature verification
 * - Backend NostrAuthService for challenge-response flow
 * - SessionService for multi-device session management
 * - RateLimiter for abuse prevention
 *
 * Features:
 * - Challenge-response authentication (NIP-42 compliant)
 * - JWT token generation with NOSTR pubkey claims
 * - Session management with device tracking
 * - Rate limiting per pubkey
 * - Security event logging and monitoring
 * - Replay attack prevention
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { verifyEvent, type Event as NostrEvent } from 'nostr-tools';
import { z } from 'zod';
import { SessionService, type CreateSessionRequest, type Session } from './session-service';
import { RequestRateLimiter } from '../lib/rate-limiter';
import { KeyManagementService } from '../../frontend/src/services/nostr/KeyManagementService';
import { EventEmitter } from 'events';

// =====================================================
// TYPE DEFINITIONS & SCHEMAS
// =====================================================

export const NostrAuthChallengeSchema = z.object({
  challenge: z.string().min(32).max(64),
  pubkey: z.string().regex(/^[0-9a-fA-F]{64}$/),
  created_at: z.number(),
  expires_at: z.number(),
  nonce: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const NostrAuthVerificationSchema = z.object({
  pubkey: z.string().regex(/^[0-9a-fA-F]{64}$/),
  signature: z.string().min(1),
  challenge: z.string().min(32),
  timestamp: z.number(),
  deviceInfo: z.object({
    userAgent: z.string(),
    platform: z.string(),
    deviceType: z.enum(['mobile', 'tablet', 'desktop']),
  }).optional(),
});

export const NostrJWTPayloadSchema = z.object({
  nostr_pubkey: z.string(),
  npub: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
  signature_verified: z.boolean(),
  session_id: z.string(),
  role: z.enum(['creator', 'supporter', 'admin']).optional(),
  device_fingerprint: z.string().optional(),
});

export type NostrAuthChallenge = z.infer<typeof NostrAuthChallengeSchema>;
export type NostrAuthVerification = z.infer<typeof NostrAuthVerificationSchema>;
export type NostrJWTPayload = z.infer<typeof NostrJWTPayloadSchema>;

export interface UnifiedAuthConfig {
  keyManagementService?: KeyManagementService;
  sessionService?: SessionService;
  rateLimiter?: RequestRateLimiter;
  jwtSecret?: string;
  jwtExpiresIn?: string;
  challengeTTL?: number;
  maxChallengesPerPubkey?: number;
  enableSecurityLogging?: boolean;
  enableMetrics?: boolean;
}

export interface AuthResult {
  valid: boolean;
  token?: string;
  sessionId?: string;
  pubkey?: string;
  error?: string;
  retryAfter?: number;
}

export interface SecurityEvent {
  timestamp: Date;
  type: 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'RATE_LIMIT' | 'SUSPICIOUS_ACTIVITY';
  pubkey: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RateLimitViolation {
  pubkey: string;
  count: number;
  lastViolation?: Date;
  backoffMultiplier: number;
}

// =====================================================
// UNIFIED AUTHENTICATION SERVICE
// =====================================================

export class UnifiedNostrAuthService extends EventEmitter {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly CHALLENGE_TTL: number;
  private readonly MAX_CHALLENGES_PER_PUBKEY: number;

  private challenges: Map<string, NostrAuthChallenge>;
  private challengesByPubkey: Map<string, Set<string>>;
  private securityEvents: SecurityEvent[];
  private rateLimitViolations: Map<string, RateLimitViolation>;

  private keyManagementService?: KeyManagementService;
  private sessionService: SessionService;
  private rateLimiter?: RequestRateLimiter;

  private cleanupInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  private config: UnifiedAuthConfig;

  constructor(config: UnifiedAuthConfig = {}) {
    super();

    this.config = config;
    this.JWT_SECRET = config.jwtSecret || this.generateSecureSecret();
    this.JWT_EXPIRES_IN = config.jwtExpiresIn || '24h';
    this.CHALLENGE_TTL = config.challengeTTL || 300000; // 5 minutes
    this.MAX_CHALLENGES_PER_PUBKEY = config.maxChallengesPerPubkey || 5;

    this.challenges = new Map();
    this.challengesByPubkey = new Map();
    this.securityEvents = [];
    this.rateLimitViolations = new Map();

    // Initialize services
    this.keyManagementService = config.keyManagementService;
    this.sessionService = config.sessionService || new SessionService();
    this.rateLimiter = config.rateLimiter;

    // Start cleanup and monitoring
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanupExpiredChallenges(), 60000);
      if (config.enableMetrics) {
        this.metricsInterval = setInterval(() => this.emitMetrics(), 30000);
      }
    }

    console.log('🔐 UnifiedNostrAuthService initialized', {
      challengeTTL: this.CHALLENGE_TTL,
      jwtExpiresIn: this.JWT_EXPIRES_IN,
      sessionManagement: !!this.sessionService,
      rateLimiting: !!this.rateLimiter,
      securityLogging: config.enableSecurityLogging,
    });
  }

  // =====================================================
  // CHALLENGE GENERATION
  // =====================================================

  async generateChallenge(pubkey: string, metadata?: Record<string, any>): Promise<NostrAuthChallenge> {
    try {
      // Validate pubkey format
      if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
        throw new Error('Invalid NOSTR public key format');
      }

      // Apply rate limiting
      if (this.rateLimiter) {
        const rateLimitResult = await this.rateLimiter.checkLimit({
          ip: pubkey, // Use pubkey as identifier
          get: () => undefined,
          headers: {},
        } as any);

        if (!rateLimitResult.allowed) {
          this.trackRateLimitViolation(pubkey);
          throw new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds`);
        }
      }

      // Check existing challenges limit per pubkey
      const existingChallenges = this.challengesByPubkey.get(pubkey) || new Set();
      if (existingChallenges.size >= this.MAX_CHALLENGES_PER_PUBKEY) {
        // Remove oldest challenge
        const oldestChallenge = Array.from(existingChallenges)[0];
        this.challenges.delete(oldestChallenge);
        existingChallenges.delete(oldestChallenge);
      }

      // Generate cryptographically secure challenge
      const challenge = randomBytes(32).toString('hex');
      const nonce = randomBytes(16).toString('hex');
      const timestamp = Date.now();

      const authChallenge: NostrAuthChallenge = {
        challenge,
        pubkey,
        created_at: timestamp,
        expires_at: timestamp + this.CHALLENGE_TTL,
        nonce,
        metadata,
      };

      // Validate schema
      const validated = NostrAuthChallengeSchema.parse(authChallenge);

      // Store challenge
      this.challenges.set(challenge, validated);

      // Track by pubkey
      if (!this.challengesByPubkey.has(pubkey)) {
        this.challengesByPubkey.set(pubkey, new Set());
      }
      this.challengesByPubkey.get(pubkey)!.add(challenge);

      // Log event
      if (this.config.enableSecurityLogging) {
        this.logSecurityEvent({
          timestamp: new Date(),
          type: 'AUTH_SUCCESS',
          pubkey,
          metadata: { action: 'challenge_generated' },
        });
      }

      return validated;
    } catch (error) {
      throw new Error(`Challenge generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =====================================================
  // SIGNATURE VERIFICATION
  // =====================================================

  async verifyChallenge(verification: NostrAuthVerification): Promise<AuthResult> {
    try {
      // Validate input
      const validated = NostrAuthVerificationSchema.parse(verification);
      const { pubkey, signature, challenge, timestamp } = validated;

      // Apply rate limiting
      if (this.rateLimiter) {
        const rateLimitResult = await this.rateLimiter.checkLimit({
          ip: pubkey,
          get: () => undefined,
          headers: {},
        } as any);

        if (!rateLimitResult.allowed) {
          this.trackRateLimitViolation(pubkey);
          throw new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds`);
        }
      }

      // Check if challenge exists
      const storedChallenge = this.challenges.get(challenge);
      if (!storedChallenge) {
        this.logSecurityEvent({
          timestamp: new Date(),
          type: 'AUTH_FAILURE',
          pubkey,
          reason: 'Invalid or expired challenge',
        });
        return {
          valid: false,
          error: 'Invalid or expired challenge',
        };
      }

      // Check if challenge is for this pubkey
      if (storedChallenge.pubkey !== pubkey) {
        this.logSecurityEvent({
          timestamp: new Date(),
          type: 'SUSPICIOUS_ACTIVITY',
          pubkey,
          reason: 'Challenge pubkey mismatch',
        });
        return {
          valid: false,
          error: 'Challenge verification failed',
        };
      }

      // Check if challenge has expired
      if (Date.now() > storedChallenge.expires_at) {
        this.challenges.delete(challenge);
        this.challengesByPubkey.get(pubkey)?.delete(challenge);

        return {
          valid: false,
          error: 'Challenge has expired',
        };
      }

      // Check timestamp is within acceptable range (prevent replay)
      const timeDiff = Math.abs(Date.now() - timestamp);
      if (timeDiff > 300000) { // 5 minutes
        return {
          valid: false,
          error: 'Timestamp is outside acceptable range',
        };
      }

      // Create message for verification
      const message = this.createSignatureMessage(challenge, timestamp, storedChallenge.nonce);

      // Verify signature
      let signatureValid = false;

      if (this.keyManagementService) {
        // Use KeyManagementService for verification
        const event: NostrEvent = {
          kind: 22242, // AUTH kind (NIP-42)
          pubkey,
          created_at: Math.floor(timestamp / 1000),
          tags: [['challenge', challenge]],
          content: message,
          id: '',
          sig: signature,
        };

        signatureValid = await this.keyManagementService.verifyEventSignature(event);
      } else {
        // Fallback to nostr-tools verification
        const messageHash = createHash('sha256').update(message).digest('hex');
        const event: NostrEvent = {
          kind: 22242,
          pubkey,
          created_at: Math.floor(timestamp / 1000),
          tags: [['challenge', challenge]],
          content: messageHash,
          id: '',
          sig: signature,
        };

        signatureValid = verifyEvent(event);
      }

      if (!signatureValid) {
        this.logSecurityEvent({
          timestamp: new Date(),
          type: 'AUTH_FAILURE',
          pubkey,
          reason: 'Invalid signature',
        });
        return {
          valid: false,
          error: 'Invalid signature',
        };
      }

      // Remove used challenge (prevent replay)
      this.challenges.delete(challenge);
      this.challengesByPubkey.get(pubkey)?.delete(challenge);

      // Generate JWT token
      const token = await this.generateJWT(pubkey, storedChallenge);

      // Create session
      let sessionId: string | undefined;

      if (this.sessionService) {
        const sessionResult = await this.createSession(
          pubkey,
          token,
          validated.deviceInfo
        );

        if (!sessionResult.success) {
          return {
            valid: false,
            error: `Authentication successful but session creation failed: ${sessionResult.error}`,
          };
        }

        sessionId = sessionResult.session?.id;
      }

      // Log success
      this.logSecurityEvent({
        timestamp: new Date(),
        type: 'AUTH_SUCCESS',
        pubkey,
        metadata: { sessionId },
      });

      return {
        valid: true,
        token,
        sessionId,
        pubkey,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // =====================================================
  // JWT TOKEN MANAGEMENT
  // =====================================================

  private async generateJWT(pubkey: string, challenge: NostrAuthChallenge): Promise<string> {
    const payload: NostrJWTPayload = {
      nostr_pubkey: pubkey,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseJWTExpiration(),
      signature_verified: true,
      session_id: createHash('sha256').update(`${pubkey}:${Date.now()}`).digest('hex'),
      role: 'supporter', // Default role
    };

    // Convert pubkey to npub if possible
    try {
      const { nip19 } = await import('nostr-tools');
      payload.npub = nip19.npubEncode(pubkey);
    } catch {
      // npub encoding failed, continue without it
    }

    return jwt.sign(payload, this.JWT_SECRET);
  }

  async validateToken(token: string): Promise<{
    valid: boolean;
    pubkey?: string;
    session?: Session;
    error?: string;
  }> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        algorithms: ['HS256'],
      });

      const payload = NostrJWTPayloadSchema.parse(decoded);

      // Verify session is still active
      if (this.sessionService) {
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const sessionResult = await this.sessionService.getSessionByTokenHash(tokenHash);

        if (!sessionResult.success || !sessionResult.session) {
          return {
            valid: false,
            error: 'Session not found or expired',
          };
        }

        // Update session activity
        await this.sessionService.updateLastActivity(sessionResult.session.id, 'api_call');

        return {
          valid: true,
          pubkey: payload.nostr_pubkey,
          session: sessionResult.session,
        };
      }

      return {
        valid: true,
        pubkey: payload.nostr_pubkey,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Token has expired',
        };
      } else if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'Invalid token',
        };
      } else {
        return {
          valid: false,
          error: `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }
  }

  async refreshToken(token: string): Promise<{
    success: boolean;
    newToken?: string;
    error?: string;
  }> {
    try {
      const validation = await this.validateToken(token);

      if (!validation.valid || !validation.pubkey) {
        return {
          success: false,
          error: validation.error || 'Invalid token',
        };
      }

      // Generate new token
      const newPayload: NostrJWTPayload = {
        nostr_pubkey: validation.pubkey,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseJWTExpiration(),
        signature_verified: true,
        session_id: validation.session?.id || createHash('sha256').update(`${validation.pubkey}:${Date.now()}`).digest('hex'),
      };

      const newToken = jwt.sign(newPayload, this.JWT_SECRET);

      // Update session activity
      if (this.sessionService && validation.session) {
        await this.sessionService.updateLastActivity(validation.session.id, 'token_refresh');
      }

      return {
        success: true,
        newToken,
      };
    } catch (error) {
      return {
        success: false,
        error: `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // =====================================================
  // SESSION MANAGEMENT
  // =====================================================

  private async createSession(
    pubkey: string,
    token: string,
    deviceInfo?: NostrAuthVerification['deviceInfo']
  ): Promise<{
    success: boolean;
    session?: Session;
    error?: string;
  }> {
    try {
      const tokenHash = createHash('sha256').update(token).digest('hex');

      const sessionRequest: CreateSessionRequest = {
        user_id: pubkey, // Using pubkey as user_id for NOSTR
        jwt_token: token,
        nostr_pubkey: pubkey,
        ip_address: '0.0.0.0', // Would come from request context
        user_agent: deviceInfo?.userAgent || 'unknown',
        device_info: {
          userAgent: deviceInfo?.userAgent || 'unknown',
          platform: deviceInfo?.platform || 'unknown',
          deviceType: deviceInfo?.deviceType || 'desktop',
          browser: 'unknown',
          browserVersion: 'unknown',
          os: 'unknown',
          osVersion: 'unknown',
          fingerprint: createHash('sha256').update(`${pubkey}:${deviceInfo?.userAgent}`).digest('hex'),
        },
        expires_at: new Date(Date.now() + this.parseJWTExpiration() * 1000).toISOString(),
      };

      return await this.sessionService.createSession(sessionRequest);
    } catch (error) {
      return {
        success: false,
        error: `Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async logout(token: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const validation = await this.validateToken(token);

      if (!validation.valid || !validation.session) {
        return {
          success: false,
          error: 'Invalid token or no active session',
        };
      }

      // Revoke session
      const result = await this.sessionService.revokeSession(
        validation.session.id,
        validation.pubkey!
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // =====================================================
  // SECURITY & MONITORING
  // =====================================================

  private logSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);

    // Keep only last 10000 events
    if (this.securityEvents.length > 10000) {
      this.securityEvents = this.securityEvents.slice(-10000);
    }

    // Emit event for external monitoring
    this.emit('security:event', event);
  }

  private trackRateLimitViolation(pubkey: string): void {
    const existing = this.rateLimitViolations.get(pubkey) || {
      pubkey,
      count: 0,
      backoffMultiplier: 1,
    };

    existing.count++;
    existing.lastViolation = new Date();
    existing.backoffMultiplier = Math.min(Math.pow(2, existing.count), 64); // Cap at 64x

    this.rateLimitViolations.set(pubkey, existing);

    this.logSecurityEvent({
      timestamp: new Date(),
      type: 'RATE_LIMIT',
      pubkey,
      metadata: { violations: existing.count },
    });
  }

  async getRateLimitViolations(pubkey: string): Promise<RateLimitViolation> {
    return this.rateLimitViolations.get(pubkey) || {
      pubkey,
      count: 0,
      backoffMultiplier: 1,
    };
  }

  async getSuspiciousPatterns(pubkey: string): Promise<string[]> {
    const patterns: string[] = [];

    // Check for multiple failed attempts
    const failedAttempts = this.securityEvents.filter(
      e => e.pubkey === pubkey && e.type === 'AUTH_FAILURE'
    );

    if (failedAttempts.length >= 5) {
      patterns.push('MULTIPLE_FAILED_ATTEMPTS');
    }

    // Check for rate limit violations
    const violations = this.rateLimitViolations.get(pubkey);
    if (violations && violations.count >= 3) {
      patterns.push('REPEATED_RATE_LIMIT_VIOLATIONS');
    }

    // Check for suspicious activity
    const suspiciousEvents = this.securityEvents.filter(
      e => e.pubkey === pubkey && e.type === 'SUSPICIOUS_ACTIVITY'
    );

    if (suspiciousEvents.length > 0) {
      patterns.push('SUSPICIOUS_ACTIVITY_DETECTED');
    }

    return patterns;
  }

  async exportSecurityAuditLog(options: {
    startDate?: Date;
    endDate?: Date;
    pubkey?: string;
    eventType?: SecurityEvent['type'];
  }): Promise<{
    events: SecurityEvent[];
    summary: {
      totalEvents: number;
      successRate: number;
      topViolators: Array<{ pubkey: string; violations: number }>;
    };
  }> {
    let events = [...this.securityEvents];

    // Apply filters
    if (options.startDate) {
      events = events.filter(e => e.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      events = events.filter(e => e.timestamp <= options.endDate!);
    }
    if (options.pubkey) {
      events = events.filter(e => e.pubkey === options.pubkey);
    }
    if (options.eventType) {
      events = events.filter(e => e.type === options.eventType);
    }

    // Calculate summary
    const totalEvents = events.length;
    const successEvents = events.filter(e => e.type === 'AUTH_SUCCESS').length;
    const successRate = totalEvents > 0 ? successEvents / totalEvents : 0;

    // Find top violators
    const violatorCounts = new Map<string, number>();
    events
      .filter(e => e.type === 'AUTH_FAILURE' || e.type === 'RATE_LIMIT')
      .forEach(e => {
        violatorCounts.set(e.pubkey, (violatorCounts.get(e.pubkey) || 0) + 1);
      });

    const topViolators = Array.from(violatorCounts.entries())
      .map(([pubkey, violations]) => ({ pubkey, violations }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10);

    return {
      events,
      summary: {
        totalEvents,
        successRate,
        topViolators,
      },
    };
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  verifyChallengeExists(challenge: string): boolean {
    return this.challenges.has(challenge);
  }

  cleanupExpiredChallenges(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [challenge, data] of this.challenges.entries()) {
      if (now > data.expires_at) {
        this.challenges.delete(challenge);
        this.challengesByPubkey.get(data.pubkey)?.delete(challenge);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired challenges`);
    }
  }

  private createSignatureMessage(challenge: string, timestamp: number, nonce?: string): string {
    return `Sovren Authentication\nChallenge: ${challenge}\nTimestamp: ${timestamp}${nonce ? `\nNonce: ${nonce}` : ''}`;
  }

  private generateSecureSecret(): string {
    console.warn('⚠️ No JWT_SECRET provided, generating random secret (not suitable for production)');
    return randomBytes(64).toString('hex');
  }

  private parseJWTExpiration(): number {
    const match = this.JWT_EXPIRES_IN.match(/^(\d+)([smhdw])$/);
    if (!match) return 86400; // Default: 24 hours

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
    };

    return value * (multipliers[unit] || 86400);
  }

  private emitMetrics(): void {
    const metrics = {
      activeChallenges: this.challenges.size,
      uniquePubkeys: this.challengesByPubkey.size,
      securityEvents: this.securityEvents.length,
      rateLimitViolations: this.rateLimitViolations.size,
    };

    this.emit('metrics', metrics);
  }

  getStats(): {
    activeChallenges: number;
    uniquePubkeys: number;
    oldestChallenge?: number;
    jwtExpiresIn: string;
    challengeTTL: number;
    securityEvents: number;
    rateLimitViolations: number;
  } {
    const timestamps = Array.from(this.challenges.values()).map(c => c.created_at);

    return {
      activeChallenges: this.challenges.size,
      uniquePubkeys: this.challengesByPubkey.size,
      oldestChallenge: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      jwtExpiresIn: this.JWT_EXPIRES_IN,
      challengeTTL: this.CHALLENGE_TTL,
      securityEvents: this.securityEvents.length,
      rateLimitViolations: this.rateLimitViolations.size,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.challenges.clear();
    this.challengesByPubkey.clear();
    this.securityEvents = [];
    this.rateLimitViolations.clear();
    this.removeAllListeners();
  }
}

// =====================================================
// FACTORY & EXPORTS
// =====================================================

export function createUnifiedAuthService(config?: UnifiedAuthConfig): UnifiedNostrAuthService {
  return new UnifiedNostrAuthService(config);
}

// Export singleton instance for application use
export const unifiedNostrAuth = new UnifiedNostrAuthService({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  challengeTTL: parseInt(process.env.CHALLENGE_TTL || '300000', 10),
  enableSecurityLogging: process.env.NODE_ENV === 'production',
  enableMetrics: process.env.ENABLE_METRICS === 'true',
});