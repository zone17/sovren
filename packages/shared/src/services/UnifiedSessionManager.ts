import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';

/**
 * 🔐 US-311: Unified NOSTR Session Management
 * WHY: Provide consistent session management across frontend and backend
 * ARCHITECTURE: Isomorphic session manager that works in browser (IndexedDB) and Node.js (Database)
 */

// =====================================================
// TYPE DEFINITIONS & SCHEMAS
// =====================================================

export interface SessionMetadata {
  device_fingerprint: string;
  ip_address?: string;
  user_agent?: string;
  device_info: DeviceInfo;
  lightning_enabled?: boolean;
  lightning_permissions?: Record<string, any>;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  fingerprint: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

export interface Session {
  id: string;
  pubkey: string;
  user_id: string;
  token_hash: string;
  device_id: string;
  device_fingerprint: string;
  device_info: DeviceInfo;
  ip_address?: string;
  user_agent?: string;
  lightning_enabled: boolean;
  lightning_permissions: Record<string, any>;
  created_at: number;
  expires_at: number;
  last_activity_at: number;
  idle_timeout_at: number;
  active: boolean;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  nostr_event_id?: string;
  session_signature?: string;
  permissions: string[];
  risk_score: number;
}

export interface SessionActivity {
  id: string;
  session_id: string;
  pubkey: string;
  activity_type: 'login' | 'api_call' | 'page_view' | 'logout' | 'token_refresh' | 'timeout' | 'invalidation';
  timestamp: number;
  details?: Record<string, any>;
  nostr_event_id?: string;
  risk_score: number;
  ip_address?: string;
  user_agent?: string;
}

export interface SessionConfig {
  maxSessionDuration: number; // milliseconds, default: 7 days
  idleTimeout: number; // milliseconds, default: 24 hours
  maxSessionsPerPubkey: number; // default: 5
  enableDeviceFingerprinting: boolean; // default: true
  enableActivityTracking: boolean; // default: true
  enableAutoRefresh: boolean; // default: true
  enableStrictValidation: boolean; // default: false
  activityLogLimit: number; // default: 100
}

export interface SessionValidationResult {
  valid: boolean;
  session?: Session;
  reason?: string;
  shouldRefresh?: boolean;
}

export interface SessionStatistics {
  totalSessions: number;
  activeSessions: number;
  sessionsByDevice: Record<string, number>;
  sessionsByRisk: { low: number; medium: number; high: number };
  recentActivity: number;
  oldestSession?: string;
  mostRecentActivity?: string;
}

// Zod Schemas for validation
const DeviceInfoSchema = z.object({
  userAgent: z.string().min(1),
  platform: z.string().min(1),
  deviceType: z.enum(['mobile', 'tablet', 'desktop']),
  browser: z.string().min(1),
  browserVersion: z.string().min(1),
  os: z.string().min(1),
  osVersion: z.string().min(1),
  fingerprint: z.string().min(1),
  screenResolution: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
});

const SessionMetadataSchema = z.object({
  device_fingerprint: z.string().min(1),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  device_info: DeviceInfoSchema,
  lightning_enabled: z.boolean().optional(),
  lightning_permissions: z.record(z.any()).optional(),
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
});

const SessionSchema = z.object({
  id: z.string(),
  pubkey: z.string().length(64),
  user_id: z.string(),
  token_hash: z.string(),
  device_id: z.string(),
  device_fingerprint: z.string(),
  device_info: DeviceInfoSchema,
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  lightning_enabled: z.boolean(),
  lightning_permissions: z.record(z.any()),
  created_at: z.number(),
  expires_at: z.number(),
  last_activity_at: z.number(),
  idle_timeout_at: z.number(),
  active: z.boolean(),
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
  nostr_event_id: z.string().optional(),
  session_signature: z.string().optional(),
  permissions: z.array(z.string()),
  risk_score: z.number().min(0).max(100),
});

// =====================================================
// UNIFIED SESSION MANAGER
// =====================================================

export abstract class UnifiedSessionManager {
  protected config: SessionConfig;
  protected activityCache: Map<string, SessionActivity[]> = new Map();

  constructor(config?: Partial<SessionConfig>) {
    this.config = {
      maxSessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
      idleTimeout: 24 * 60 * 60 * 1000, // 24 hours
      maxSessionsPerPubkey: 5,
      enableDeviceFingerprinting: true,
      enableActivityTracking: true,
      enableAutoRefresh: true,
      enableStrictValidation: false,
      activityLogLimit: 100,
      ...config,
    };
  }

  // =====================================================
  // ABSTRACT METHODS (Platform-specific implementations)
  // =====================================================

  /**
   * Store session in platform-specific storage (Database or IndexedDB)
   */
  protected abstract storeSession(session: Session): Promise<void>;

  /**
   * Retrieve session from storage
   */
  protected abstract retrieveSession(sessionId: string): Promise<Session | null>;

  /**
   * Retrieve session by token hash
   */
  protected abstract retrieveSessionByTokenHash(tokenHash: string): Promise<Session | null>;

  /**
   * Retrieve all sessions for a pubkey
   */
  protected abstract retrieveSessionsByPubkey(pubkey: string): Promise<Session[]>;

  /**
   * Update session in storage
   */
  protected abstract updateSession(sessionId: string, updates: Partial<Session>): Promise<void>;

  /**
   * Delete session from storage
   */
  protected abstract deleteSession(sessionId: string): Promise<void>;

  /**
   * Store activity log
   */
  protected abstract storeActivity(activity: SessionActivity): Promise<void>;

  /**
   * Retrieve activity logs
   */
  protected abstract retrieveActivities(sessionId: string, limit: number): Promise<SessionActivity[]>;

  // =====================================================
  // CORE SESSION METHODS
  // =====================================================

  /**
   * Create a new session
   * Session ID format: sess_{pubkey_prefix}_{timestamp}_{random}
   */
  async createSession(
    pubkey: string,
    userId: string,
    token: string,
    metadata: SessionMetadata
  ): Promise<Session> {
    try {
      // Validate inputs
      if (!pubkey || pubkey.length !== 64) {
        throw new Error('Invalid NOSTR pubkey');
      }
      SessionMetadataSchema.parse(metadata);

      // Check session limits
      await this.enforceSessionLimits(pubkey);

      // Generate session ID
      const timestamp = Date.now();
      const random = randomBytes(8).toString('hex');
      const sessionId = `sess_${pubkey.substring(0, 8)}_${timestamp}_${random}`;

      // Generate token hash
      const tokenHash = this.generateTokenHash(token);

      // Generate device ID
      const deviceId = this.generateDeviceId(metadata.device_fingerprint, pubkey);

      // Calculate expiration times
      const createdAt = timestamp;
      const expiresAt = createdAt + this.config.maxSessionDuration;
      const idleTimeoutAt = createdAt + this.config.idleTimeout;

      // Calculate risk score
      const riskScore = this.calculateRiskScore(metadata);

      // Create session object
      const session: Session = {
        id: sessionId,
        pubkey,
        user_id: userId,
        token_hash: tokenHash,
        device_id: deviceId,
        device_fingerprint: metadata.device_fingerprint,
        device_info: metadata.device_info,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        lightning_enabled: metadata.lightning_enabled || false,
        lightning_permissions: metadata.lightning_permissions || {},
        created_at: createdAt,
        expires_at: expiresAt,
        last_activity_at: createdAt,
        idle_timeout_at: idleTimeoutAt,
        active: true,
        location: metadata.location,
        permissions: ['read', 'write'], // Default permissions
        risk_score: riskScore,
      };

      // Validate session schema
      SessionSchema.parse(session);

      // Store session
      await this.storeSession(session);

      // Log session creation
      if (this.config.enableActivityTracking) {
        await this.logActivity({
          id: this.generateActivityId(),
          session_id: sessionId,
          pubkey,
          activity_type: 'login',
          timestamp: createdAt,
          details: {
            device_type: metadata.device_info.deviceType,
            browser: metadata.device_info.browser,
            location: metadata.location,
          },
          risk_score: riskScore,
          ip_address: metadata.ip_address,
          user_agent: metadata.user_agent,
        });
      }

      return session;
    } catch (error) {
      throw new Error(
        `Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate session and optionally refresh
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    try {
      const session = await this.retrieveSession(sessionId);

      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      if (!session.active) {
        return { valid: false, reason: 'Session inactive' };
      }

      const now = Date.now();

      // Check absolute expiration
      if (now > session.expires_at) {
        await this.revokeSession(sessionId, 'expired');
        return { valid: false, reason: 'Session expired' };
      }

      // Check idle timeout
      if (now > session.idle_timeout_at) {
        await this.revokeSession(sessionId, 'idle_timeout');
        return { valid: false, reason: 'Session idle timeout' };
      }

      // Check if session should be refreshed
      const shouldRefresh = this.shouldRefreshSession(session);

      // Update last activity
      const updatedIdleTimeout = now + this.config.idleTimeout;
      await this.updateSession(sessionId, {
        last_activity_at: now,
        idle_timeout_at: updatedIdleTimeout,
      });

      // Log activity
      if (this.config.enableActivityTracking) {
        await this.logActivity({
          id: this.generateActivityId(),
          session_id: sessionId,
          pubkey: session.pubkey,
          activity_type: 'api_call',
          timestamp: now,
          risk_score: session.risk_score,
        });
      }

      return { valid: true, session, shouldRefresh };
    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Refresh session expiration
   */
  async refreshSession(sessionId: string): Promise<Session> {
    try {
      const session = await this.retrieveSession(sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      if (!session.active) {
        throw new Error('Cannot refresh inactive session');
      }

      const now = Date.now();
      const newExpiresAt = now + this.config.maxSessionDuration;
      const newIdleTimeoutAt = now + this.config.idleTimeout;

      await this.updateSession(sessionId, {
        expires_at: newExpiresAt,
        idle_timeout_at: newIdleTimeoutAt,
        last_activity_at: now,
      });

      // Log refresh activity
      if (this.config.enableActivityTracking) {
        await this.logActivity({
          id: this.generateActivityId(),
          session_id: sessionId,
          pubkey: session.pubkey,
          activity_type: 'token_refresh',
          timestamp: now,
          details: { new_expires_at: newExpiresAt },
          risk_score: session.risk_score,
        });
      }

      // Return updated session
      const updatedSession = await this.retrieveSession(sessionId);
      if (!updatedSession) {
        throw new Error('Failed to retrieve refreshed session');
      }

      return updatedSession;
    } catch (error) {
      throw new Error(
        `Session refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Revoke a single session
   */
  async revokeSession(sessionId: string, reason: string = 'manual'): Promise<void> {
    try {
      const session = await this.retrieveSession(sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      // Mark session as inactive
      await this.updateSession(sessionId, {
        active: false,
        last_activity_at: Date.now(),
      });

      // Log revocation
      if (this.config.enableActivityTracking) {
        await this.logActivity({
          id: this.generateActivityId(),
          session_id: sessionId,
          pubkey: session.pubkey,
          activity_type: 'logout',
          timestamp: Date.now(),
          details: { reason },
          risk_score: 0,
        });
      }
    } catch (error) {
      throw new Error(
        `Session revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List all active sessions for a pubkey
   */
  async listSessions(pubkey: string): Promise<Session[]> {
    try {
      const sessions = await this.retrieveSessionsByPubkey(pubkey);
      return sessions.filter((s) => s.active);
    } catch (error) {
      throw new Error(
        `List sessions failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Revoke all sessions for a pubkey
   */
  async revokeAllSessions(pubkey: string, exceptSessionId?: string): Promise<number> {
    try {
      const sessions = await this.retrieveSessionsByPubkey(pubkey);
      let revokedCount = 0;

      for (const session of sessions) {
        if (session.active && session.id !== exceptSessionId) {
          await this.revokeSession(session.id, 'bulk_revocation');
          revokedCount++;
        }
      }

      return revokedCount;
    } catch (error) {
      throw new Error(
        `Bulk revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get session by token
   */
  async getSessionByToken(token: string): Promise<Session | null> {
    try {
      const tokenHash = this.generateTokenHash(token);
      return await this.retrieveSessionByTokenHash(tokenHash);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get session activity logs
   */
  async getSessionActivity(
    sessionId: string,
    limit: number = 100
  ): Promise<SessionActivity[]> {
    try {
      return await this.retrieveActivities(sessionId, limit);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get session statistics
   */
  async getStatistics(pubkey: string): Promise<SessionStatistics> {
    try {
      const sessions = await this.listSessions(pubkey);
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const sessionsByDevice = sessions.reduce(
        (acc, session) => {
          const deviceType = session.device_info.deviceType;
          acc[deviceType] = (acc[deviceType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const sessionsByRisk = sessions.reduce(
        (acc, session) => {
          if (session.risk_score < 30) acc.low++;
          else if (session.risk_score < 70) acc.medium++;
          else acc.high++;
          return acc;
        },
        { low: 0, medium: 0, high: 0 }
      );

      const recentActivity = sessions.filter(
        (s) => s.last_activity_at > oneDayAgo
      ).length;

      const oldestSession = sessions.reduce(
        (oldest, session) =>
          session.created_at < oldest.created_at ? session : oldest,
        sessions[0]
      );

      const mostRecentActivitySession = sessions.reduce(
        (recent, session) =>
          session.last_activity_at > recent.last_activity_at ? session : recent,
        sessions[0]
      );

      return {
        totalSessions: sessions.length,
        activeSessions: sessions.filter((s) => s.active).length,
        sessionsByDevice,
        sessionsByRisk,
        recentActivity,
        oldestSession: oldestSession?.created_at
          ? new Date(oldestSession.created_at).toISOString()
          : undefined,
        mostRecentActivity: mostRecentActivitySession?.last_activity_at
          ? new Date(mostRecentActivitySession.last_activity_at).toISOString()
          : undefined,
      };
    } catch (error) {
      throw new Error(
        `Statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  protected async enforceSessionLimits(pubkey: string): Promise<void> {
    const sessions = await this.retrieveSessionsByPubkey(pubkey);
    const activeSessions = sessions.filter((s) => s.active);

    if (activeSessions.length >= this.config.maxSessionsPerPubkey) {
      // Revoke oldest session
      const oldestSession = activeSessions.reduce((oldest, session) =>
        session.created_at < oldest.created_at ? session : oldest
      );
      await this.revokeSession(oldestSession.id, 'session_limit_exceeded');
    }
  }

  protected generateTokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  protected generateDeviceId(fingerprint: string, pubkey: string): string {
    const combined = `${fingerprint}_${pubkey}_${Date.now()}`;
    return createHash('sha256').update(combined).digest('hex').substring(0, 32);
  }

  protected generateActivityId(): string {
    return `act_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  protected calculateRiskScore(metadata: SessionMetadata): number {
    let score = 0;

    // No IP address = higher risk
    if (!metadata.ip_address) score += 15;

    // No user agent = higher risk
    if (!metadata.user_agent) score += 15;

    // Mobile devices = slightly higher risk
    if (metadata.device_info.deviceType === 'mobile') score += 5;

    // No location data = moderate risk
    if (!metadata.location) score += 10;

    return Math.min(100, score);
  }

  protected shouldRefreshSession(session: Session): boolean {
    if (!this.config.enableAutoRefresh) return false;

    const now = Date.now();
    const sessionAge = now - session.created_at;
    const halfDuration = this.config.maxSessionDuration / 2;

    return sessionAge > halfDuration;
  }

  protected async logActivity(activity: SessionActivity): Promise<void> {
    try {
      await this.storeActivity(activity);

      // Cache recent activity
      const cached = this.activityCache.get(activity.session_id) || [];
      cached.push(activity);

      // Keep only recent entries
      if (cached.length > this.config.activityLogLimit) {
        cached.shift();
      }

      this.activityCache.set(activity.session_id, cached);
    } catch (error) {
      // Log but don't throw - activity logging shouldn't break main flow
      console.warn('Failed to log activity:', error);
    }
  }

  /**
   * Cleanup expired sessions (should be called periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const allSessions = await this.retrieveSessionsByPubkey('*'); // Implementation-specific
      const now = Date.now();
      let cleanedCount = 0;

      for (const session of allSessions) {
        if (session.active && (now > session.expires_at || now > session.idle_timeout_at)) {
          await this.revokeSession(
            session.id,
            now > session.expires_at ? 'expired' : 'idle_timeout'
          );
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      throw new Error(
        `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update session configuration
   */
  updateConfig(config: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SessionConfig {
    return { ...this.config };
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Generate session ID in standard format
 */
export function generateSessionId(pubkey: string): string {
  const timestamp = Date.now();
  const random = randomBytes(8).toString('hex');
  return `sess_${pubkey.substring(0, 8)}_${timestamp}_${random}`;
}

/**
 * Parse session ID to extract components
 */
export function parseSessionId(sessionId: string): {
  pubkeyPrefix: string;
  timestamp: number;
  random: string;
} | null {
  const parts = sessionId.split('_');
  if (parts.length !== 4 || parts[0] !== 'sess') {
    return null;
  }

  return {
    pubkeyPrefix: parts[1],
    timestamp: parseInt(parts[2], 10),
    random: parts[3],
  };
}

/**
 * Validate session ID format
 */
export function isValidSessionId(sessionId: string): boolean {
  return parseSessionId(sessionId) !== null;
}

// Export types
export type {
  Session as UnifiedSession,
  SessionActivity as UnifiedSessionActivity,
  SessionConfig as UnifiedSessionConfig,
};
