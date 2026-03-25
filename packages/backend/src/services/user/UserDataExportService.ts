// @ts-nocheck
/**
 * UserDataExportService
 * GDPR COMP-003: Right of Access / Data Portability
 *
 * Aggregates all personal data held for a user and returns it as a structured
 * JSON payload. For large data sets the route handler is expected to enqueue
 * a BullMQ job (queue: 'user-data-export') rather than blocking the request.
 *
 * Returned shape:
 *   { exportedAt, userId, profile, content, payments, subscriptions,
 *     activity, preferences, socialConnections }
 *
 * @epic COMP
 * @story COMP-003
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../container/types';
import { Logger } from '../../utils/logger';
import { ServiceError, NotFoundError } from '../../utils/errors';

// ─── Inline dependency interfaces ────────────────────────────────────────────

interface IDatabase {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

// ─── Export payload shape ─────────────────────────────────────────────────────

export interface UserDataExport {
  exportedAt: string;
  userId: string;
  profile: Record<string, unknown> | null;
  content: unknown[];
  payments: unknown[];
  subscriptions: unknown[];
  activity: unknown[];
  preferences: Record<string, unknown> | null;
  socialConnections: {
    following: unknown[];
    followers: unknown[];
    blocked: unknown[];
  };
  consents: unknown[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@injectable()
export class UserDataExportService {
  private readonly logger: Logger;

  constructor(
    @inject(TYPES.Database) private readonly db: IDatabase
  ) {
    this.logger = new Logger(UserDataExportService.name);
  }

  /**
   * Collects all personal data for `userId` and returns it as a single object.
   *
   * This method runs all queries in parallel where there are no dependencies.
   * It is intentionally synchronous in scope — callers that anticipate large
   * volumes should wrap this call in a BullMQ job:
   *
   *   await queueService.addJob('user-data-export', 'export', { userId })
   *
   * and stream/email the result when the worker completes.
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    this.logger.info('Starting data export', { userId });

    // Verify user exists
    const { rows: userRows } = await this.db.query(
      `SELECT id FROM users WHERE id = $1`,
      [userId]
    );
    if (!userRows.length) {
      throw new NotFoundError('User', { context: { userId } });
    }

    try {
      // Run independent queries in parallel for performance
      const [
        profileRows,
        contentRows,
        paymentRows,
        subscriptionRows,
        activityRows,
        preferencesRows,
        followingRows,
        followerRows,
        blockedRows,
        consentRows,
      ] = await Promise.all([
        this.queryProfile(userId),
        this.queryContent(userId),
        this.queryPayments(userId),
        this.querySubscriptions(userId),
        this.queryActivity(userId),
        this.queryPreferences(userId),
        this.querySocialConnections(userId, 'following_id', 'follower_id'),
        this.querySocialConnections(userId, 'follower_id', 'following_id'),
        this.queryBlockedUsers(userId),
        this.queryConsents(userId),
      ]);

      const exportPayload: UserDataExport = {
        exportedAt: new Date().toISOString(),
        userId,
        profile: (profileRows[0] as Record<string, unknown>) ?? null,
        content: contentRows,
        payments: paymentRows,
        subscriptions: subscriptionRows,
        activity: activityRows,
        preferences: (preferencesRows[0] as Record<string, unknown>) ?? null,
        socialConnections: {
          following: followingRows,
          followers: followerRows,
          blocked: blockedRows,
        },
        consents: consentRows,
      };

      this.logger.info('Data export complete', {
        userId,
        contentCount: contentRows.length,
        paymentCount: paymentRows.length,
      });

      return exportPayload;
    } catch (error) {
      this.logger.error('Data export failed', error, { userId });
      throw new ServiceError('Failed to export user data', { cause: error, context: { userId } });
    }
  }

  // ── Private query helpers ───────────────────────────────────────────────────

  private async queryProfile(userId: string): Promise<unknown[]> {
    const { rows } = await this.db.query(
      `SELECT id, username, display_name, bio, avatar_url, banner_url,
              website_url, nip05_verified, lightning_address, role,
              status, created_at, last_login_at
         FROM users
        WHERE id = $1`,
      [userId]
    );
    return rows;
  }

  private async queryContent(userId: string): Promise<unknown[]> {
    const { rows } = await this.db.query(
      `SELECT id, title, content_type, description, status, published_at, created_at
         FROM content
        WHERE creator_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  private async queryPayments(userId: string): Promise<unknown[]> {
    const { rows } = await this.db.query(
      `SELECT id, amount_sats, currency, status, created_at
         FROM payments
        WHERE payer_id = $1 OR recipient_id = $1
        ORDER BY created_at DESC
        LIMIT 1000`,
      [userId]
    );
    return rows;
  }

  private async querySubscriptions(userId: string): Promise<unknown[]> {
    const { rows } = await this.db.query(
      `SELECT id, creator_id, tier_id, status, started_at, cancelled_at, created_at
         FROM subscriptions
        WHERE subscriber_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  private async queryActivity(userId: string): Promise<unknown[]> {
    const { rows } = await this.db.query(
      `SELECT activity_type, resource_id, resource_type, created_at
         FROM user_activity_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 500`,
      [userId]
    );
    return rows;
  }

  private async queryPreferences(userId: string): Promise<unknown[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId]
    );
    return rows;
  }

  /**
   * Generic helper to fetch one side of a many-to-many follow relationship.
   *
   * @param userId        The current user's ID
   * @param filterCol     The column to filter on (the "self" side)
   * @param returnCol     The column to return (the "other" side)
   */
  private async querySocialConnections(
    userId: string,
    filterCol: string,
    returnCol: string
  ): Promise<unknown[]> {
    const { rows } = await this.db.query(
      `SELECT ${returnCol} AS related_user_id, created_at
         FROM user_relationships
        WHERE ${filterCol} = $1
          AND relationship_type = 'follow'
        ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  private async queryBlockedUsers(userId: string): Promise<unknown[]> {
    const { rows } = await this.db.query(
      `SELECT following_id AS blocked_user_id, created_at
         FROM user_relationships
        WHERE follower_id = $1
          AND relationship_type = 'block'
        ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  private async queryConsents(userId: string): Promise<unknown[]> {
    const { rows } = await this.db.query(
      `SELECT consent_type, version, granted_at, withdrawn_at, created_at
         FROM user_consents
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }
}
