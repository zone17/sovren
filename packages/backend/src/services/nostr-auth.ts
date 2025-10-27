import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { verifyEvent, type Event as NostrEvent } from 'nostr-tools';
import { z } from 'zod';

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
  role: z.enum(['creator', 'supporter', 'admin']).optional(),
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

  constructor(
    jwtSecret?: string,
    jwtExpiresIn: string = '24h',
    challengeTTL: number = 300000 // 5 minutes
  ) {
    this.JWT_SECRET = jwtSecret || this.generateSecureSecret();
    this.JWT_EXPIRES_IN = jwtExpiresIn;
    this.CHALLENGE_TTL = challengeTTL;
    this.challenges = new Map();

    // Clean up expired challenges every minute (only in production)
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanupExpiredChallenges(), 60000);
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
      throw new Error(`Failed to generate challenge: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const timeDiff = Math.abs(Date.now() - timestamp);
      if (timeDiff > 300000) { // 5 minutes
        return {
          valid: false,
          pubkey,
          error: 'Timestamp is outside acceptable range',
        };
      }

      // Create message to verify (challenge + timestamp)
      const message = this.createSignatureMessage(challenge, timestamp);
      const messageHash = createHash('sha256').update(message).digest('hex');

      // Create a NOSTR event for verification
      const event: NostrEvent = {
        kind: 1,
        pubkey,
        created_at: Math.floor(timestamp / 1000),
        tags: [],
        content: messageHash,
        id: '', // Will be computed by verifyEvent
        sig: signature,
      };

      // Verify NOSTR event signature
      const isValidSignature = verifyEvent(event);

      if (isValidSignature) {
        // Remove used challenge to prevent replay
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
  async generateJWT(
    pubkey: string,
    role: 'creator' | 'supporter' | 'admin' = 'supporter'
  ): Promise<string> {
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
      throw new Error(`Failed to generate JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Generate new token with forced different timestamp
      const payload: JWTPayload = {
        nostr_pubkey: verification.payload.nostr_pubkey,
        iat: newTimestamp,
        exp: newTimestamp + this.parseJWTExpiration(),
        signature_verified: true,
        role: verification.payload.role,
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
   * 📝 Create signature message for verification
   */
  private createSignatureMessage(challenge: string, timestamp: number): string {
    return `Sovren Authentication\nChallenge: ${challenge}\nTimestamp: ${timestamp}`;
  }

  /**
   * 🔐 Generate secure JWT secret if not provided
   */
  private generateSecureSecret(): string {
    console.warn('⚠️ No JWT_SECRET provided, generating random secret (not suitable for production)');
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
   * 📊 Get service statistics
   */
  getStats(): {
    activeChallenges: number;
    oldestChallenge?: number;
    jwtExpiresIn: string;
    challengeTTL: number;
  } {
    const timestamps = Array.from(this.challenges.values()).map(c => c.timestamp);

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
  }
}

// 🏭 Singleton instance for application use
export const nostrAuth = new NostrAuthService();

// 🎯 Export utility functions
export const createSignatureMessage = (challenge: string, timestamp: number): string => {
  return `Sovren Authentication\nChallenge: ${challenge}\nTimestamp: ${timestamp}`;
};

export const validateNostrPubkey = (pubkey: string): boolean => {
  return /^[0-9a-fA-F]{64}$/.test(pubkey);
};

export const isValidSignature = async (
  signature: string,
  message: string,
  pubkey: string
): Promise<boolean> => {
  try {
    const messageHash = createHash('sha256').update(message).digest('hex');

    // Create a NOSTR event for verification
    const event: NostrEvent = {
      kind: 1,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: messageHash,
      id: '', // Will be computed by verifyEvent
      sig: signature,
    };

    return verifyEvent(event);
  } catch {
    return false;
  }
};
