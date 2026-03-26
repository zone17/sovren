import { createHash } from 'crypto';
import { z } from 'zod';
import { SupabaseDatabase } from '../config/database';

// 🔐 Session Management Types and Schemas
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
  user_id: string;
  jwt_token_hash: string;
  nostr_pubkey: string;
  ip_address: string;
  user_agent: string;
  device_info: DeviceInfo;
  lightning_enabled: boolean;
  lightning_permissions: Record<string, any>;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  active: boolean;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

export interface CreateSessionRequest {
  user_id: string;
  jwt_token: string;
  nostr_pubkey: string;
  ip_address: string;
  user_agent: string;
  device_info: DeviceInfo;
  lightning_enabled?: boolean;
  lightning_permissions?: Record<string, any>;
  expires_at: string;
}

export interface SessionActivity {
  session_id: string;
  activity_type: 'login' | 'api_call' | 'page_view' | 'logout' | 'token_refresh';
  metadata?: Record<string, any>;
  timestamp: string;
}

// 📝 Validation Schemas
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

const CreateSessionRequestSchema = z.object({
  user_id: z.string().uuid(),
  jwt_token: z.string().min(1),
  nostr_pubkey: z.string().length(64),
  ip_address: z.string().ip(),
  user_agent: z.string().min(1),
  device_info: DeviceInfoSchema,
  lightning_enabled: z.boolean().default(false),
  lightning_permissions: z.record(z.any()).default({}),
  expires_at: z.string().datetime(),
});

/**
 * 🔐 Elite Session Management Service
 * WHY: Comprehensive multi-device session tracking with security controls
 */
export class SessionService {
  private database: SupabaseDatabase;
  private readonly MAX_SESSIONS_PER_USER = 10;
  private readonly SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  constructor(database?: SupabaseDatabase) {
    this.database = database || new SupabaseDatabase();
    this.startCleanupScheduler();
  }

  /**
   * 🆕 Create New Session
   * WHY: Track device-specific authentication sessions
   */
  async createSession(request: CreateSessionRequest): Promise<{
    success: boolean;
    session?: Session;
    error?: string;
  }> {
    try {
      // Validate request
      const validatedRequest = CreateSessionRequestSchema.parse(request);

      // Generate token hash for secure storage
      const tokenHash = this.generateTokenHash(validatedRequest.jwt_token);

      // Check session limits
      const sessionLimitCheck = await this.enforceSessionLimits(validatedRequest.user_id);
      if (!sessionLimitCheck.success) {
        return { success: false, error: sessionLimitCheck.error };
      }

      // Get location from IP (mock implementation)
      const location = await this.getLocationFromIP(validatedRequest.ip_address);

      // Create session record
      const sessionData = {
        user_id: validatedRequest.user_id,
        jwt_token_hash: tokenHash,
        nostr_pubkey: validatedRequest.nostr_pubkey,
        ip_address: validatedRequest.ip_address,
        user_agent: validatedRequest.user_agent,
        device_info: validatedRequest.device_info,
        lightning_enabled: validatedRequest.lightning_enabled,
        lightning_permissions: validatedRequest.lightning_permissions,
        expires_at: validatedRequest.expires_at,
        last_activity_at: new Date().toISOString(),
        active: true,
        location,
      };

      const { data, error } = await this.database.client
        .from('user_sessions')
        .insert(sessionData)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Session creation failed: ${error.message}`);
      }

      // Log session creation activity
      await this.logSessionActivity({
        session_id: data.id,
        activity_type: 'login',
        metadata: {
          device_type: validatedRequest.device_info.deviceType,
          browser: validatedRequest.device_info.browser,
          ip_address: validatedRequest.ip_address,
        },
        timestamp: new Date().toISOString(),
      });

      return { success: true, session: data };
    } catch (error) {
      return {
        success: false,
        error: `Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 📋 List User Sessions
   * WHY: Enable users to monitor their active sessions
   */
  async listUserSessions(userId: string): Promise<{
    success: boolean;
    sessions?: Session[];
    error?: string;
  }> {
    try {
      const { data, error } = await this.database.client
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('last_activity_at', { ascending: false });

      if (error) {
        throw new Error(`Session listing failed: ${error.message}`);
      }

      // Enrich sessions with additional metadata
      // is_current: determined in-memory — most recent session (already sorted desc) is current
      const currentSessionId = data.length > 0 ? data[0].id : null;

      // Batch-load activity summaries in a single query instead of N individual calls
      const sessionIds = data.map((s) => s.id);
      const { data: activityRows } = await this.database.client
        .from('session_activity')
        .select('session_id, activity_type, timestamp')
        .in('session_id', sessionIds)
        .order('timestamp', { ascending: false });

      // Group activity rows by session_id for in-memory join
      const activityBySession = new Map<string, typeof activityRows>();
      for (const row of activityRows ?? []) {
        const existing = activityBySession.get(row.session_id) ?? [];
        existing.push(row);
        activityBySession.set(row.session_id, existing);
      }

      const enrichedSessions = data.map((session) => {
        const rows = activityBySession.get(session.id) ?? [];
        const lastRow = rows[0]; // already ordered desc by timestamp
        const activityCounts: Record<string, number> = {};
        for (const r of rows) {
          activityCounts[r.activity_type] = (activityCounts[r.activity_type] ?? 0) + 1;
        }
        const mostCommon = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'api_call';

        return {
          ...session,
          is_current: session.id === currentSessionId,
          activity_summary: {
            total_activities: rows.length,
            last_api_call: lastRow?.timestamp ?? new Date().toISOString(),
            most_common_activity: mostCommon,
          },
        };
      });

      return { success: true, sessions: enrichedSessions };
    } catch (error) {
      return {
        success: false,
        error: `Session listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔄 Update Session Activity
   * WHY: Track user activity for security monitoring
   */
  async updateLastActivity(
    sessionId: string,
    activityType: SessionActivity['activity_type'] = 'api_call'
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const now = new Date().toISOString();

      // Update session last activity
      const { error: updateError } = await this.database.client
        .from('user_sessions')
        .update({ last_activity_at: now })
        .eq('id', sessionId)
        .eq('active', true);

      if (updateError) {
        throw new Error(`Activity update failed: ${updateError.message}`);
      }

      // Log activity
      await this.logSessionActivity({
        session_id: sessionId,
        activity_type: activityType,
        timestamp: now,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Activity update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🚫 Revoke Single Session
   * WHY: Enable users to terminate specific sessions
   */
  async revokeSession(
    sessionId: string,
    requestingUserId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Verify session ownership
      const { data: session, error: fetchError } = await this.database.client
        .from('user_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', requestingUserId)
        .single();

      if (fetchError || !session) {
        return { success: false, error: 'Session not found or access denied' };
      }

      // Revoke session
      const { error: revokeError } = await this.database.client
        .from('user_sessions')
        .update({
          active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (revokeError) {
        throw new Error(`Session revocation failed: ${revokeError.message}`);
      }

      // Log revocation activity
      await this.logSessionActivity({
        session_id: sessionId,
        activity_type: 'logout',
        metadata: { revoked_by: 'user', reason: 'manual_revocation' },
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Session revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🚫 Revoke All Sessions
   * WHY: Emergency security measure for account compromise
   */
  async revokeAllSessions(
    userId: string,
    exceptCurrentSession?: string
  ): Promise<{
    success: boolean;
    revokedCount?: number;
    error?: string;
  }> {
    try {
      let query = this.database.client
        .from('user_sessions')
        .update({
          active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('active', true);

      // Exclude current session if specified
      if (exceptCurrentSession) {
        query = query.neq('id', exceptCurrentSession);
      }

      const { data, error } = await query.select('id');

      if (error) {
        throw new Error(`Bulk session revocation failed: ${error.message}`);
      }

      const revokedCount = data?.length || 0;

      // Log bulk revocation activity
      if (revokedCount > 0) {
        await Promise.all(
          data.map((session) =>
            this.logSessionActivity({
              session_id: session.id,
              activity_type: 'logout',
              metadata: {
                revoked_by: 'user',
                reason: 'bulk_revocation',
                except_current: !!exceptCurrentSession,
              },
              timestamp: new Date().toISOString(),
            })
          )
        );
      }

      return { success: true, revokedCount };
    } catch (error) {
      return {
        success: false,
        error: `Bulk session revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔍 Get Session by Token Hash
   * WHY: Validate session during authentication
   */
  async getSessionByTokenHash(tokenHash: string): Promise<{
    success: boolean;
    session?: Session;
    error?: string;
  }> {
    try {
      const { data, error } = await this.database.client
        .from('user_sessions')
        .select('*')
        .eq('jwt_token_hash', tokenHash)
        .eq('active', true)
        .single();

      if (error) {
        return { success: false, error: 'Session not found' };
      }

      // Check if session is expired
      if (new Date(data.expires_at) < new Date()) {
        await this.revokeSession(data.id, data.user_id);
        return { success: false, error: 'Session expired' };
      }

      return { success: true, session: data };
    } catch (error) {
      return {
        success: false,
        error: `Session lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🧹 Cleanup Expired Sessions
   * WHY: Maintain database hygiene and security
   */
  async cleanupExpiredSessions(): Promise<{
    success: boolean;
    cleanedCount?: number;
    error?: string;
  }> {
    try {
      const { data, error } = await this.database.client
        .from('user_sessions')
        .update({ active: false })
        .lt('expires_at', new Date().toISOString())
        .eq('active', true)
        .select('id');

      if (error) {
        throw new Error(`Session cleanup failed: ${error.message}`);
      }

      const cleanedCount = data?.length || 0;

      return { success: true, cleanedCount };
    } catch (error) {
      return {
        success: false,
        error: `Session cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // 🔧 Private Helper Methods

  private generateTokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async enforceSessionLimits(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { data, error } = await this.database.client
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true);

      if (error) {
        throw new Error(`Session limit check failed: ${error.message}`);
      }

      if (data.length >= this.MAX_SESSIONS_PER_USER) {
        // Revoke oldest session
        const { error: revokeError } = await this.database.client
          .from('user_sessions')
          .update({ active: false })
          .eq('user_id', userId)
          .eq('active', true)
          .order('last_activity_at', { ascending: true })
          .limit(1);

        if (revokeError) {
          throw new Error(`Session limit enforcement failed: ${revokeError.message}`);
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getLocationFromIP(ipAddress: string): Promise<Session['location']> {
    // Mock implementation - in production, use a geolocation service
    const mockLocations = [
      { country: 'United States', region: 'California', city: 'San Francisco' },
      { country: 'United Kingdom', region: 'England', city: 'London' },
      { country: 'Germany', region: 'Bavaria', city: 'Munich' },
      { country: 'Japan', region: 'Tokyo', city: 'Tokyo' },
    ];

    return mockLocations[Math.floor(Math.random() * mockLocations.length)];
  }

  private async isCurrentSession(sessionId: string, userId: string): Promise<boolean> {
    // Mock implementation - in production, check against current request context
    return Math.random() > 0.5;
  }

  private async getSessionActivitySummary(sessionId: string): Promise<{
    total_activities: number;
    last_api_call: string;
    most_common_activity: string;
  }> {
    // Mock implementation - in production, aggregate from session_activity table
    return {
      total_activities: Math.floor(Math.random() * 100) + 10,
      last_api_call: new Date().toISOString(),
      most_common_activity: 'api_call',
    };
  }

  private async logSessionActivity(activity: SessionActivity): Promise<void> {
    try {
      await this.database.client.from('session_activity').insert(activity);
    } catch (error) {
      console.warn('Failed to log session activity:', error);
      // Don't throw - activity logging shouldn't break main functionality
    }
  }

  private startCleanupScheduler(): void {
    setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, this.SESSION_CLEANUP_INTERVAL);
  }
}

// 🏭 Service Factory
export const createSessionService = (database?: SupabaseDatabase): SessionService => {
  return new SessionService(database);
};
