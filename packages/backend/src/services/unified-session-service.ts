import { SupabaseClient } from '@supabase/supabase-js';
import {
  UnifiedSessionManager,
  Session,
  SessionActivity,
  SessionConfig,
} from '../../../shared/src/services/UnifiedSessionManager';
import { SupabaseDatabase } from '../config/database';

/**
 * 🔐 US-311: Database-backed Session Manager
 * WHY: Backend implementation using Supabase/PostgreSQL for session persistence
 * EXTENDS: UnifiedSessionManager with database-specific operations
 */

export class DatabaseSessionManager extends UnifiedSessionManager {
  private database: SupabaseDatabase;
  private client: SupabaseClient;

  constructor(database?: SupabaseDatabase, config?: Partial<SessionConfig>) {
    super(config);
    this.database = database || new SupabaseDatabase();
    this.client = this.database.client;
  }

  // =====================================================
  // STORAGE IMPLEMENTATIONS
  // =====================================================

  protected async storeSession(session: Session): Promise<void> {
    try {
      const { error } = await this.client.from('unified_sessions').insert({
        id: session.id,
        pubkey: session.pubkey,
        user_id: session.user_id,
        token_hash: session.token_hash,
        device_id: session.device_id,
        device_fingerprint: session.device_fingerprint,
        device_info: session.device_info,
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        lightning_enabled: session.lightning_enabled,
        lightning_permissions: session.lightning_permissions,
        created_at: new Date(session.created_at).toISOString(),
        expires_at: new Date(session.expires_at).toISOString(),
        last_activity_at: new Date(session.last_activity_at).toISOString(),
        idle_timeout_at: new Date(session.idle_timeout_at).toISOString(),
        active: session.active,
        location: session.location,
        nostr_event_id: session.nostr_event_id,
        session_signature: session.session_signature,
        permissions: session.permissions,
        risk_score: session.risk_score,
      });

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to store session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  protected async retrieveSession(sessionId: string): Promise<Session | null> {
    try {
      const { data, error } = await this.client
        .from('unified_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapDatabaseRowToSession(data);
    } catch (error) {
      console.warn('Failed to retrieve session:', error);
      return null;
    }
  }

  protected async retrieveSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    try {
      const { data, error } = await this.client
        .from('unified_sessions')
        .select('*')
        .eq('token_hash', tokenHash)
        .eq('active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapDatabaseRowToSession(data);
    } catch (error) {
      console.warn('Failed to retrieve session by token hash:', error);
      return null;
    }
  }

  protected async retrieveSessionsByPubkey(pubkey: string): Promise<Session[]> {
    try {
      // Special case: '*' means all sessions (for cleanup)
      const query =
        pubkey === '*'
          ? this.client.from('unified_sessions').select('*')
          : this.client.from('unified_sessions').select('*').eq('pubkey', pubkey);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((row) => this.mapDatabaseRowToSession(row));
    } catch (error) {
      console.warn('Failed to retrieve sessions by pubkey:', error);
      return [];
    }
  }

  protected async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    try {
      // Convert timestamps to ISO strings
      const dbUpdates: any = { ...updates };
      if (updates.expires_at) {
        dbUpdates.expires_at = new Date(updates.expires_at).toISOString();
      }
      if (updates.last_activity_at) {
        dbUpdates.last_activity_at = new Date(updates.last_activity_at).toISOString();
      }
      if (updates.idle_timeout_at) {
        dbUpdates.idle_timeout_at = new Date(updates.idle_timeout_at).toISOString();
      }

      const { error } = await this.client
        .from('unified_sessions')
        .update(dbUpdates)
        .eq('id', sessionId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to update session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  protected async deleteSession(sessionId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('unified_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        throw new Error(`Database delete failed: ${error.message}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  protected async storeActivity(activity: SessionActivity): Promise<void> {
    try {
      const { error } = await this.client.from('unified_session_activities').insert({
        id: activity.id,
        session_id: activity.session_id,
        pubkey: activity.pubkey,
        activity_type: activity.activity_type,
        timestamp: new Date(activity.timestamp).toISOString(),
        details: activity.details,
        nostr_event_id: activity.nostr_event_id,
        risk_score: activity.risk_score,
        ip_address: activity.ip_address,
        user_agent: activity.user_agent,
      });

      if (error) {
        console.warn('Failed to store activity:', error);
      }
    } catch (error) {
      console.warn('Failed to store activity:', error);
    }
  }

  protected async retrieveActivities(
    sessionId: string,
    limit: number
  ): Promise<SessionActivity[]> {
    try {
      const { data, error } = await this.client
        .from('unified_session_activities')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error || !data) {
        return [];
      }

      return data.map((row) => this.mapDatabaseRowToActivity(row));
    } catch (error) {
      console.warn('Failed to retrieve activities:', error);
      return [];
    }
  }

  // =====================================================
  // DATABASE-SPECIFIC METHODS
  // =====================================================

  /**
   * Get all sessions for a user (by user_id instead of pubkey)
   */
  async getSessionsByUserId(userId: string): Promise<Session[]> {
    try {
      const { data, error } = await this.client
        .from('unified_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('last_activity_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((row) => this.mapDatabaseRowToSession(row));
    } catch (error) {
      console.warn('Failed to get sessions by user ID:', error);
      return [];
    }
  }

  /**
   * Revoke sessions by device ID
   */
  async revokeSessionsByDevice(pubkey: string, deviceId: string): Promise<number> {
    try {
      const sessions = await this.retrieveSessionsByPubkey(pubkey);
      let revokedCount = 0;

      for (const session of sessions) {
        if (session.active && session.device_id === deviceId) {
          await this.revokeSession(session.id, 'device_revoked');
          revokedCount++;
        }
      }

      return revokedCount;
    } catch (error) {
      console.error('Failed to revoke sessions by device:', error);
      return 0;
    }
  }

  /**
   * Get session activity summary for a pubkey
   */
  async getActivitySummary(pubkey: string, days: number = 7): Promise<{
    totalActivities: number;
    activitiesByType: Record<string, number>;
    riskDistribution: { low: number; medium: number; high: number };
    recentSessions: number;
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.client
        .from('unified_session_activities')
        .select('*')
        .eq('pubkey', pubkey)
        .gte('timestamp', startDate);

      if (error || !data) {
        return {
          totalActivities: 0,
          activitiesByType: {},
          riskDistribution: { low: 0, medium: 0, high: 0 },
          recentSessions: 0,
        };
      }

      const activitiesByType = data.reduce(
        (acc, activity) => {
          acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const riskDistribution = data.reduce(
        (acc, activity) => {
          if (activity.risk_score < 30) acc.low++;
          else if (activity.risk_score < 70) acc.medium++;
          else acc.high++;
          return acc;
        },
        { low: 0, medium: 0, high: 0 }
      );

      const uniqueSessions = new Set(data.map((a) => a.session_id)).size;

      return {
        totalActivities: data.length,
        activitiesByType,
        riskDistribution,
        recentSessions: uniqueSessions,
      };
    } catch (error) {
      console.error('Failed to get activity summary:', error);
      return {
        totalActivities: 0,
        activitiesByType: {},
        riskDistribution: { low: 0, medium: 0, high: 0 },
        recentSessions: 0,
      };
    }
  }

  /**
   * Cleanup old activity logs
   */
  async cleanupOldActivities(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.client
        .from('unified_session_activities')
        .delete()
        .lt('timestamp', cutoffDate)
        .select('id');

      if (error) {
        throw new Error(`Cleanup failed: ${error.message}`);
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Failed to cleanup old activities:', error);
      return 0;
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private mapDatabaseRowToSession(row: any): Session {
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
      lightning_enabled: row.lightning_enabled,
      lightning_permissions: row.lightning_permissions,
      created_at: new Date(row.created_at).getTime(),
      expires_at: new Date(row.expires_at).getTime(),
      last_activity_at: new Date(row.last_activity_at).getTime(),
      idle_timeout_at: new Date(row.idle_timeout_at).getTime(),
      active: row.active,
      location: row.location,
      nostr_event_id: row.nostr_event_id,
      session_signature: row.session_signature,
      permissions: row.permissions || ['read', 'write'],
      risk_score: row.risk_score || 0,
    };
  }

  private mapDatabaseRowToActivity(row: any): SessionActivity {
    return {
      id: row.id,
      session_id: row.session_id,
      pubkey: row.pubkey,
      activity_type: row.activity_type,
      timestamp: new Date(row.timestamp).getTime(),
      details: row.details,
      nostr_event_id: row.nostr_event_id,
      risk_score: row.risk_score || 0,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
    };
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const { error } = await this.client.from('unified_sessions').select('id').limit(1);

      if (error) {
        return { healthy: false, message: error.message };
      }

      return { healthy: true, message: 'Database connection healthy' };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

export function createDatabaseSessionManager(
  database?: SupabaseDatabase,
  config?: Partial<SessionConfig>
): DatabaseSessionManager {
  return new DatabaseSessionManager(database, config);
}

// Export singleton instance (optional)
export const databaseSessionManager = new DatabaseSessionManager();
