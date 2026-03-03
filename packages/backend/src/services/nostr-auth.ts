// @ts-nocheck
import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import {
  getEventHash,
  verifyEvent,
  type Event as NostrEvent,
  type UnsignedEvent,
} from 'nostr-tools/pure';
import { z } from 'zod';
import { createSignatureMessage as sharedCreateSignatureMessage } from '@shared/types/nostr/auth';
import logger from '../lib/logger';

// 🌐 NOSTR Authentication Schemas (from shared package)
export const NostrChallengeSchema = z.object({
  challenge: z.string().min(32, 'Challenge must be at least 32 characters'),
  timestamp: z.number(),
  expires_at: z.number(),
});

export const NostrVerificationSchema = z.object({
  pubkey: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Invalid NOSTR public key format'),
  signature: z.string().min(1, 'Signature is required'),
  challenge: z.string().min(32, 'Challenge is required'),
  timestamp: z.number(),
});

export const JWTPayloadSchema = z.object({
  nostr_pubkey: z.string(),
  iat: z.number(),
  exp: z.number(),
  signature_verified: z.boolean(),
  role: z.enum(['creator', 'supporter']).optional(),
});

export type NostrChallenge = z.infer<typeof NostrChallengeSchema>;
export type NostrVerification = z.infer<typeof NostrVerificationSchema>;
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// 🔐 NOSTR Authentication Service
export class NostrAuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly CHALLENGE_TTL: number;
  private readonly challenges: Map<string, NostrChallenge>;
  private cleanupInterval?: NodeJS.Timeout;
  private usedSignatures: Map<string, number>;
  private userRoleFetcher?: (pubkey: string) => Promise<string | undefined>;

  constructor(
    jwtSecret?: string,
    jwtExpiresIn: string = '24h',
    challengeTTL: number = 300000, // 5 minutes
    userRoleFetcher?: (pubkey: string) => Promise<string | undefined>
  ) {
    if (jwtSecret) {
      if (jwtSecret.length < 32) {
        throw new Error(
          'JWT_SECRET must be at least 32 characters. ' +
            'Generate one with: openssl rand -base64 32'
        );
      }
      this.JWT_SECRET = jwtSecret;
    } else if (process.env.NODE_ENV === 'test') {
      this.JWT_SECRET = this.generateSecureSecret();
    } else {
      throw new Error(
        'JWT_SECRET environment variable is required. ' +
          'Generate one with: openssl rand -base64 32'
      );
    }
    this.JWT_EXPIRES_IN = jwtExpiresIn;
    this.CHALLENGE_TTL = challengeTTL;
    this.challenges = new Map();
    this.usedSignatures = new Map();
    this.userRoleFetcher = userRoleFetcher;

    // Clean up expired challenges and signatures every minute (only in production)
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredChallenges();
        this.cleanupExpiredSignatures();
      }, 60000);
    }
  }

  /**
   * 🎯 Generate secure NOSTR authentication challenge
   */
  async generateChallenge(): Promise<NostrChallenge> {
    try {
      // Generate cryptographically secure random challenge
      const challenge = randomBytes(32).toString('hex');
      const timestamp = Date.now();
      const expires_at = timestamp + this.CHALLENGE_TTL;

      const challengeData: NostrChallenge = {
        challenge,
        timestamp,
        expires_at,
      };

      // Validate the challenge data
      const validatedChallenge = NostrChallengeSchema.parse(challengeData);

      // Store challenge for verification
      this.challenges.set(challenge, validatedChallenge);

      return validatedChallenge;
    } catch (error) {
      throw new Error(
        `Failed to generate challenge: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 🔍 Verify NOSTR signature against challenge
   */
  async verifySignature(verification: NostrVerification): Promise<{
    valid: boolean;
    pubkey: string;
    error?: string;
  }> {
    try {
      // Validate input
      const validatedVerification = NostrVerificationSchema.parse(verification);
      const { pubkey, signature, challenge, timestamp } = validatedVerification;

      // Check if challenge exists and is valid
      const storedChallenge = this.challenges.get(challenge);
      if (!storedChallenge) {
        return {
          valid: false,
          pubkey,
          error: 'Invalid or expired challenge',
        };
      }

      // Check if challenge has expired
      if (Date.now() > storedChallenge.expires_at) {
        this.challenges.delete(challenge);
        return {
          valid: false,
          pubkey,
          error: 'Challenge has expired',
        };
      }

      // Verify timestamp is within acceptable range (prevent replay attacks)
      // Auto-detect ms vs seconds: Unix seconds won't exceed 1e12 until year 33658
      const timestampSec = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
      const nowSec = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(nowSec - timestampSec);
      if (timeDiff > 300) {
        // 5 minutes in seconds
        return {
          valid: false,
          pubkey,
          error: 'Timestamp is outside acceptable range',
        };
      }

      // Replay protection: reject already-used signatures
      const sigHash = createHash('sha256').update(signature).digest('hex');
      if (this.usedSignatures.has(sigHash)) {
        return {
          valid: false,
          pubkey,
          error: 'Signature already used',
        };
      }

      // Create message to verify (challenge + timestamp)
      // Use timestampSec to match frontend which always sends seconds to createSignatureMessage
      const message = this.createSignatureMessage(challenge, timestampSec);
      const messageHash = createHash('sha256').update(message).digest('hex');

      // Create a NOSTR event for verification — compute the proper event ID
      // Uses NIP-42 auth event kind (22242) with challenge in tags for auditability
      const eventData: UnsignedEvent = {
        kind: 22242,
        pubkey,
        created_at: timestampSec,
        tags: [['challenge', challenge]],
        content: messageHash,
      };
      const event: NostrEvent = {
        ...eventData,
        id: getEventHash(eventData),
        sig: signature,
      };

      // Verify NOSTR event signature
      const isValidSignature = verifyEvent(event);

      if (isValidSignature) {
        // Track used signature and remove used challenge to prevent replay
        this.usedSignatures.set(sigHash, Date.now());
        this.challenges.delete(challenge);

        return {
          valid: true,
          pubkey,
        };
      } else {
        return {
          valid: false,
          pubkey,
          error: 'Invalid signature',
        };
      }
    } catch (error) {
      return {
        valid: false,
        pubkey: verification.pubkey,
        error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🎟️ Generate JWT token for API compatibility
   */
  async generateJWT(pubkey: string, role: 'creator' | 'supporter' = 'supporter'): Promise<string> {
    try {
      const payload: JWTPayload = {
        nostr_pubkey: pubkey,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseJWTExpiration(),
        signature_verified: true,
        role,
      };

      // Validate payload
      JWTPayloadSchema.parse(payload);

      return jwt.sign(payload, this.JWT_SECRET);
    } catch (error) {
      throw new Error(
        `Failed to generate JWT: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 🔓 Verify JWT token and extract NOSTR identity
   */
  async verifyJWT(token: string): Promise<{
    valid: boolean;
    payload?: JWTPayload;
    error?: string;
  }> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        algorithms: ['HS256'],
      });

      // Validate the JWT payload structure
      const payload = JWTPayloadSchema.parse(decoded);

      return {
        valid: true,
        payload,
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
          error: `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }
  }

  /**
   * 🔄 Refresh JWT token
   */
  async refreshJWT(token: string): Promise<{
    success: boolean;
    newToken?: string;
    error?: string;
  }> {
    try {
      const verification = await this.verifyJWT(token);

      if (!verification.valid || !verification.payload) {
        return {
          success: false,
          error: verification.error || 'Invalid token',
        };
      }

      // Force different timestamp by adding 1 second to current time
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const newTimestamp = currentTimestamp + 1;

      // Re-query current role from database instead of using stale token role
      let currentRole = verification.payload.role;
      if (this.userRoleFetcher) {
        const freshRole = await this.userRoleFetcher(verification.payload.nostr_pubkey);
        if (freshRole === undefined) {
          // User not found in DB — refuse refresh
          return {
            success: false,
            error: 'User not found',
          };
        }
        currentRole = freshRole as 'creator' | 'supporter';
      }

      // Generate new token with fresh role
      const payload: JWTPayload = {
        nostr_pubkey: verification.payload.nostr_pubkey,
        iat: newTimestamp,
        exp: newTimestamp + this.parseJWTExpiration(),
        signature_verified: true,
        role: currentRole,
      };

      // Validate payload
      JWTPayloadSchema.parse(payload);

      const newToken = jwt.sign(payload, this.JWT_SECRET);

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

  /**
   * 🧹 Clean up expired challenges
   */
  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    for (const [challenge, data] of this.challenges.entries()) {
      if (now > data.expires_at) {
        this.challenges.delete(challenge);
      }
    }
  }

  /**
   * 🧹 Clean up expired used signatures (older than 5 minutes)
   */
  private cleanupExpiredSignatures(): void {
    const now = Date.now();
    const signatureWindow = 300000; // 5 minutes — matches timestamp window
    for (const [sigHash, usedAt] of this.usedSignatures.entries()) {
      if (now - usedAt > signatureWindow) {
        this.usedSignatures.delete(sigHash);
      }
    }
  }

  /**
   * 📝 Create signature message for verification
   * Delegates to shared package — single source of truth.
   */
  private createSignatureMessage(challenge: string, timestamp: number): string {
    return sharedCreateSignatureMessage(challenge, timestamp);
  }

  /**
   * 🔐 Generate secure JWT secret if not provided
   */
  private generateSecureSecret(): string {
    logger.warn('No JWT_SECRET provided, generating random secret (not suitable for production)');
    return randomBytes(64).toString('hex');
  }

  /**
   * ⏰ Parse JWT expiration time to seconds
   */
  private parseJWTExpiration(): number {
    const match = this.JWT_EXPIRES_IN.match(/^(\d+)([smhdw])$/);
    if (!match || !match[1] || !match[2]) {
      return 86400; // Default: 24 hours
    }

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

  /**
   * 👤 Get user role from DB (public wrapper around userRoleFetcher)
   * Falls back to 'supporter' for new users or on DB error.
   */
  async getUserRole(pubkey: string): Promise<'creator' | 'supporter'> {
    if (!this.userRoleFetcher) {
      return 'supporter';
    }
    const role = await this.userRoleFetcher(pubkey);
    // userRoleFetcher returns undefined only if the user is not found — treat as new user
    return (role as 'creator' | 'supporter') || 'supporter';
  }

  /**
   * 📊 Get service statistics
   */
  getStats(): {
    activeChallenges: number;
    oldestChallenge?: number;
    jwtExpiresIn: string;
    challengeTTL: number;
  } {
    const timestamps = Array.from(this.challenges.values()).map((c) => c.timestamp);

    const stats = {
      activeChallenges: this.challenges.size,
      jwtExpiresIn: this.JWT_EXPIRES_IN,
      challengeTTL: this.CHALLENGE_TTL,
    } as {
      activeChallenges: number;
      oldestChallenge?: number;
      jwtExpiresIn: string;
      challengeTTL: number;
    };

    if (timestamps.length > 0) {
      stats.oldestChallenge = Math.min(...timestamps);
    }

    return stats;
  }

  /**
   * 🧹 Cleanup resources (for testing)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.challenges.clear();
    this.usedSignatures.clear();
  }
}

// 🏭 Singleton instance for application use
export const nostrAuth = new NostrAuthService(
  process.env.JWT_SECRET,
  '24h',
  300000,
  async (pubkey: string): Promise<string | undefined> => {
    try {
      // Lazy import to avoid circular dependency at module init
      const { supabase } = await import('../config/supabase');
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('nostr_pubkey', pubkey)
        .single();
      const VALID_JWT_ROLES = new Set(['creator', 'supporter']);
      return VALID_JWT_ROLES.has(data?.role) ? data.role : 'supporter';
    } catch (err) {
      logger.error('Failed to fetch user role from DB, defaulting to supporter', { pubkey, err });
      return 'supporter';
    }
  }
);

// 🎯 Export utility functions
// Re-export from shared package — single source of truth for signature message format
export { createSignatureMessage } from '@shared/types/nostr/auth';

export const validateNostrPubkey = (pubkey: string): boolean => {
  return /^[0-9a-fA-F]{64}$/.test(pubkey);
};
