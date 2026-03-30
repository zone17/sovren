/**
 * 🔐 Database Session Manager (Backend)
 * US-311: Unified Session Management - Subtask 3
 *
 * Backend implementation of UnifiedSessionManager using database storage
 *
 * Features:
 * - PostgreSQL/Supabase session storage
 * - Multi-device session tracking
 * - Session expiration management
 * - Activity tracking and audit logs
 * - Secure token generation
 * - IP-based security checks
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import type {
  Session,
  SessionMetadata,
  DeviceInfo,
  SessionActivity,
  SessionValidation,
  SessionQueryOptions,
  SessionStats,
} from '@shared/services/UnifiedSessionManager';

/**
 * Database schema for sessions table
 */
interface SessionRow {
  id: string;
  pubkey: string;
  user_id: string;
  token_hash: string;
  device_id: string;
  device_fingerprint: string;
  device_info: DeviceInfo;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  expires_at: string;
  last_activity: string;
  is_active: boolean;
  refresh_count: number;
  metadata?: SessionMetadata;
}

/**
 * Database schema for session_activities table
 */
interface SessionActivityRow {
  id: string;
  session_id: string;
  action: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * Database Session Manager Configuration
 */
export interface DatabaseSessionConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tableName?: string;
  activityTableName?: string;
  defaultTTL?: number;
  maxSessionsPerUser?: number;
  enableActivityLogging?: boolean;
  enableIPValidation?: boolean;
}

/**
 * Database Session Manager Implementation
 */
export class DatabaseSessionManager {
  private supabase: SupabaseClient;
  private tableName: string;
  private activityTableName: string;
  private config: DatabaseSessionConfig;

  constructor(config: DatabaseSessionConfig) {
    this.config = {
      tableName: 'sessions',
      activityTableName: 'session_activities',
      defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxSessionsPerUser: 10,
      enableActivityLogging: true,
      enableIPValidation: true,
      ...config,
    };

    this.tableName = this.config.tableName!;
    this.activityTableName = this.config.activityTableName!;

    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Create new session
   */
  public async createSession(pubkey: string, metadata: SessionMetadata): Promise<Session> {
    // Generate secure session token
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    // Generate session ID
    const sessionId = this.generateSessionId();

    // Calculate expiration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.defaultTTL!);

    // Create session object
    const session: Session = {
      id: sessionId,
      pubkey,
      user_id: metadata.device_info.fingerprint, // Using fingerprint as user_id
      token_hash: tokenHash,
      device_id: metadata.device_fingerprint,
      device_fingerprint: metadata.device_fingerprint,
      device_info: metadata.device_info,
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_activity: now.toISOString(),
      is_active: true,
      refresh_count: 0,
      metadata,
    };

    // Check session limit
    await this.enforceSessionLimit(pubkey);

    // Insert into database
    const { error } = await this.supabase.from(this.tableName).insert({
      id: session.id,
      pubkey: session.pubkey,
      user_id: session.user_id,
      token_hash: session.token_hash,
      device_id: session.device_id,
      device_fingerprint: session.device_fingerprint,
      device_info: session.device_info,
      ip_address: session.ip_address,
      user_agent: session.user_agent,
      created_at: session.created_at,
      expires_at: session.expires_at,
      last_activity: session.last_activity,
      is_active: session.is_active,
      refresh_count: session.refresh_count,
      metadata: session.metadata,
    });

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    // Log activity
    if (this.config.enableActivityLogging) {
      await this.logActivity(session.id, 'session_created', {
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
      });
    }

    // Return session with token (only time token is returned in plain text)
    return {
      ...session,
      token: token, // Include plain token for initial response
    };
  }

  /**
   * Get session by ID
   */
  public async getSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapRowToSession(data);
  }

  /**
   * Get all sessions for user
   */
  public async getUserSessions(pubkey: string): Promise<Session[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('pubkey', pubkey)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.mapRowToSession(row));
  }

  /**
   * Validate session token
   */
  public async validateSession(
    sessionId: string,
    token: string,
    metadata?: SessionMetadata
  ): Promise<SessionValidation> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return {
        valid: false,
        reason: 'Session not found',
      };
    }

    // Check token hash
    const tokenHash = this.hashToken(token);
    if (tokenHash !== session.token_hash) {
      return {
        valid: false,
        reason: 'Invalid token',
      };
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      await this.revokeSession(sessionId);
      return {
        valid: false,
        reason: 'Session expired',
        expired: true,
      };
    }

    // Check if active
    if (!session.is_active) {
      return {
        valid: false,
        reason: 'Session inactive',
      };
    }

    // Validate IP if enabled
    if (this.config.enableIPValidation && metadata?.ip_address) {
      if (session.ip_address && session.ip_address !== metadata.ip_address) {
        await this.logActivity(sessionId, 'ip_mismatch', {
          original_ip: session.ip_address,
          current_ip: metadata.ip_address,
        });

        // Optional: Revoke session on IP mismatch
        // await this.revokeSession(sessionId);
        // return { valid: false, reason: 'IP address mismatch' };
      }
    }

    // Update last activity
    await this.updateActivity(sessionId);

    return {
      valid: true,
      session,
    };
  }

  /**
   * Refresh session
   */
  public async refreshSession(sessionId: string, token: string): Promise<Session | null> {
    const validation = await this.validateSession(sessionId, token);

    if (!validation.valid || !validation.session) {
      return null;
    }

    const session = validation.session;

    // Generate new token
    const newToken = this.generateToken();
    const newTokenHash = this.hashToken(newToken);

    // Update expiration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.defaultTTL!);

    // Update session
    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        token_hash: newTokenHash,
        expires_at: expiresAt.toISOString(),
        last_activity: now.toISOString(),
        refresh_count: session.refresh_count + 1,
      })
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to refresh session: ${error.message}`);
    }

    // Log activity
    if (this.config.enableActivityLogging) {
      await this.logActivity(sessionId, 'session_refreshed', {
        refresh_count: session.refresh_count + 1,
      });
    }

    // Return updated session with new token
    return {
      ...session,
      token: newToken,
      token_hash: newTokenHash,
      expires_at: expiresAt.toISOString(),
      last_activity: now.toISOString(),
      refresh_count: session.refresh_count + 1,
    };
  }

  /**
   * Revoke session
   */
  public async revokeSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        is_active: false,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to revoke session: ${error.message}`);
    }

    // Log activity
    if (this.config.enableActivityLogging) {
      await this.logActivity(sessionId, 'session_revoked');
    }
  }

  /**
   * Revoke all sessions for user
   */
  public async revokeAllUserSessions(pubkey: string, exceptSessionId?: string): Promise<void> {
    let query = this.supabase
      .from(this.tableName)
      .update({
        is_active: false,
        last_activity: new Date().toISOString(),
      })
      .eq('pubkey', pubkey);

    if (exceptSessionId) {
      query = query.neq('id', exceptSessionId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Failed to revoke user sessions: ${error.message}`);
    }
  }

  /**
   * Query sessions
   */
  public async querySessions(options: SessionQueryOptions): Promise<Session[]> {
    let query = this.supabase.from(this.tableName).select('*');

    if (options.pubkey) {
      query = query.eq('pubkey', options.pubkey);
    }

    if (options.deviceId) {
      query = query.eq('device_id', options.deviceId);
    }

    if (options.active !== undefined) {
      query = query.eq('is_active', options.active);
    }

    if (options.since) {
      query = query.gte('created_at', options.since.toISOString());
    }

    if (options.until) {
      query = query.lte('created_at', options.until.toISOString());
    }

    const { data, error } = await query
      .order('last_activity', { ascending: false })
      .limit(options.limit || 100);

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.mapRowToSession(row));
  }

  /**
   * Get session statistics
   */
  public async getSessionStats(pubkey?: string): Promise<SessionStats> {
    let query = this.supabase.from(this.tableName).select('*');

    if (pubkey) {
      query = query.eq('pubkey', pubkey);
    }

    // Limit to prevent unbounded SELECT (#768)
    const { data, error } = await query.limit(1000);

    if (error || !data) {
      return {
        total: 0,
        active: 0,
        expired: 0,
        revoked: 0,
        byDevice: {},
        averageSessionLength: 0,
      };
    }

    const now = new Date();
    const stats: SessionStats = {
      total: data.length,
      active: 0,
      expired: 0,
      revoked: 0,
      byDevice: {},
      averageSessionLength: 0,
    };

    let totalSessionLength = 0;

    for (const row of data) {
      if (row.is_active) {
        if (new Date(row.expires_at) > now) {
          stats.active++;
        } else {
          stats.expired++;
        }
      } else {
        stats.revoked++;
      }

      // Count by device type
      const deviceType = row.device_info?.deviceType || 'unknown';
      stats.byDevice[deviceType] = (stats.byDevice[deviceType] || 0) + 1;

      // Calculate session length
      const created = new Date(row.created_at).getTime();
      const lastActivity = new Date(row.last_activity).getTime();
      totalSessionLength += lastActivity - created;
    }

    stats.averageSessionLength = data.length > 0 ? totalSessionLength / data.length : 0;

    return stats;
  }

  /**
   * Get session activities
   */
  public async getSessionActivities(
    sessionId: string,
    limit: number = 100
  ): Promise<SessionActivity[]> {
    const { data, error } = await this.supabase
      .from(this.activityTableName)
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      action: row.action,
      timestamp: row.created_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata,
    }));
  }

  /**
   * Clean expired sessions
   */
  public async cleanExpiredSessions(): Promise<number> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from(this.tableName)
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (error) {
      throw new Error(`Failed to clean expired sessions: ${error.message}`);
    }

    return data?.length || 0;
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Generate secure session token
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Map database row to Session object
   */
  private mapRowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      pubkey: row.pubkey,
      user_id: row.user_id,
      token_hash: row.token_hash,
      device_id: row.device_id,
      device_fingerprint: row.device_fingerprint,
      device_info: row.device_info,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
      expires_at: row.expires_at,
      last_activity: row.last_activity,
      is_active: row.is_active,
      refresh_count: row.refresh_count,
      metadata: row.metadata,
    };
  }

  /**
   * Enforce session limit per user
   */
  private async enforceSessionLimit(pubkey: string): Promise<void> {
    const sessions = await this.getUserSessions(pubkey);

    if (sessions.length >= this.config.maxSessionsPerUser!) {
      // Revoke oldest sessions
      const toRevoke = sessions
        .sort((a, b) => new Date(a.last_activity).getTime() - new Date(b.last_activity).getTime())
        .slice(0, sessions.length - this.config.maxSessionsPerUser! + 1);

      for (const session of toRevoke) {
        await this.revokeSession(session.id);
      }
    }
  }

  /**
   * Update session activity
   */
  private async updateActivity(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error(`Failed to update session activity: ${error.message}`);
    }
  }

  /**
   * Log session activity
   */
  private async logActivity(
    sessionId: string,
    action: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.enableActivityLogging) {
      return;
    }

    const { error } = await this.supabase.from(this.activityTableName).insert({
      id: `activity_${randomBytes(16).toString('hex')}`,
      session_id: sessionId,
      action,
      metadata,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`Failed to log session activity: ${error.message}`);
    }
  }
}

/**
 * Export default instance factory
 */
export function createDatabaseSessionManager(
  config: DatabaseSessionConfig
): DatabaseSessionManager {
  return new DatabaseSessionManager(config);
}
