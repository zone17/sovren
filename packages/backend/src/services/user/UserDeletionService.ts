// @ts-nocheck
/**
 * UserDeletionService
 * GDPR COMP-001: Right to Erasure — soft deletion with 30-day grace period,
 * data anonymisation, and best-effort NIP-09 deletion broadcast.
 *
 * Deletion lifecycle:
 *   1. softDeleteAccount()  → marks user inactive, deleted_at = now(), strips PII
 *   2. Scheduled job (external)  → calls hardDeleteAccount() after 30-day grace period
 *
 * @epic COMP
 * @story COMP-001
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../container/types';
import { Logger } from '../../utils/logger';
import { ServiceError, NotFoundError } from '../../utils/errors';
import type { IQueueService } from '../../interfaces/queue/IQueueService';

// ─── Inline dependency interfaces ────────────────────────────────────────────

interface IDatabase {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

interface ISupabaseClient {
  from<T = Record<string, unknown>>(
    table: string
  ): {
    update(data: Partial<T>): { eq(col: string, val: unknown): Promise<{ error: unknown }> };
    delete(): { eq(col: string, val: unknown): Promise<{ error: unknown }> };
    select(cols?: string): {
      eq(col: string, val: unknown): Promise<{ data: T[] | null; error: unknown }>;
      single(): Promise<{ data: T | null; error: unknown }>;
    };
  };
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface SoftDeleteResult {
  userId: string;
  deletedAt: Date;
  gracePeriodEndsAt: Date;
  nostrDeletionBroadcast: boolean;
}

export interface HardDeleteResult {
  userId: string;
  tablesCleared: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** 30-day grace period before hard deletion */
const GRACE_PERIOD_DAYS = 30;

/** BullMQ queue used for scheduling hard deletion */
const DELETION_QUEUE = 'user-deletion';

/** Default NOSTR relays for NIP-09 deletion broadcast */
const DEFAULT_NOSTR_RELAYS: string[] = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nostr.zebedee.cloud',
];

// ─── Service ──────────────────────────────────────────────────────────────────

@injectable()
export class UserDeletionService {
  private readonly logger: Logger;
  private queueInitPromise: Promise<void> | null = null;

  constructor(
    @inject(TYPES.Database) private readonly db: IDatabase,
    @inject(TYPES.QueueService) private readonly queueService: IQueueService
  ) {
    this.logger = new Logger(UserDeletionService.name);
  }

  // ── Queue initialisation ────────────────────────────────────────────────────

  private async ensureQueue(): Promise<void> {
    if (this.queueInitPromise) return this.queueInitPromise;
    this.queueInitPromise = Promise.resolve(
      this.queueService.createQueue(DELETION_QUEUE, {
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 1000 },
        },
      })
    )
      .then(() => {})
      .catch((err) => {
        this.queueInitPromise = null;
        throw err;
      });
    return this.queueInitPromise;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Initiates GDPR erasure for the given user.
   *
   * Actions taken synchronously:
   *   - Sets users.deleted_at = now() and users.status = 'inactive'
   *   - Anonymises payment records (strips name/email/wallet, retains financial data)
   *   - Deletes sessions, preferences, activity_logs, user_relationships
   *   - Best-effort NIP-09 deletion broadcast to NOSTR relays
   *
   * Schedules a hard-delete BullMQ job for 30 days from now.
   */
  async softDeleteAccount(userId: string): Promise<SoftDeleteResult> {
    this.logger.info('Initiating soft deletion', { userId });

    // Verify the user exists before doing anything destructive
    const userRow = await this.fetchUser(userId);
    if (!userRow) {
      throw new NotFoundError('User', { context: { userId } });
    }

    const deletedAt = new Date();
    const gracePeriodEndsAt = new Date(deletedAt.getTime() + GRACE_PERIOD_DAYS * 86_400_000);

    try {
      // 1. Mark user as soft-deleted
      await this.markUserDeleted(userId, deletedAt);

      // 2. Anonymise payment records — financial rows are kept for audit
      await this.anonymisePaymentRecords(userId);

      // 3. Remove ephemeral data
      await this.deleteEphemeralData(userId);

      // 4. Best-effort NIP-09 broadcast
      const nostrDeletionBroadcast = await this.broadcastNip09Deletion(
        userId,
        userRow.nostr_pubkey as string
      );

      // 5. Schedule hard deletion after grace period
      await this.scheduleHardDeletion(userId, gracePeriodEndsAt);

      this.logger.info('Soft deletion complete', { userId, gracePeriodEndsAt });

      return { userId, deletedAt, gracePeriodEndsAt, nostrDeletionBroadcast };
    } catch (error) {
      this.logger.error('Soft deletion failed', error, { userId });
      throw new ServiceError('Failed to delete account', { cause: error, context: { userId } });
    }
  }

  /**
   * Permanently removes all remaining user data after the 30-day grace period.
   * Called by the BullMQ worker that processes jobs from the 'user-deletion' queue.
   */
  async hardDeleteAccount(userId: string): Promise<HardDeleteResult> {
    this.logger.info('Initiating hard deletion', { userId });

    const tablesCleared: string[] = [];

    try {
      // Delete in FK-safe order (children before parent)
      const tables = [
        'user_consents',
        'content_engagement',
        'content', // ON DELETE CASCADE will handle child records
        'subscriptions',
        'user_analytics',
        'user_activity_logs',
        'user_relationships',
        'user_preferences',
        'user_sessions',
        'payments',     // anonymised rows can now be removed
        'users',
      ];

      for (const table of tables) {
        await this.deleteRowsByUserId(table, userId);
        tablesCleared.push(table);
      }

      this.logger.info('Hard deletion complete', { userId, tablesCleared });
      return { userId, tablesCleared };
    } catch (error) {
      this.logger.error('Hard deletion failed', error, { userId });
      throw new ServiceError('Failed to hard-delete account', { cause: error, context: { userId } });
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async fetchUser(userId: string): Promise<Record<string, unknown> | null> {
    const { rows } = await this.db.query(
      'SELECT id, nostr_pubkey FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  private async markUserDeleted(userId: string, deletedAt: Date): Promise<void> {
    await this.db.query(
      `UPDATE users
         SET deleted_at = $2,
             status     = 'inactive',
             updated_at = now()
       WHERE id = $1`,
      [userId, deletedAt.toISOString()]
    );
  }

  /**
   * Strips PII from payment rows while retaining amounts and timestamps for
   * financial audit obligations (typically 7 years under most jurisdictions).
   */
  private async anonymisePaymentRecords(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE payments
          SET payer_name       = '[REDACTED]',
              payer_email      = NULL,
              payer_lightning  = NULL,
              metadata         = '{}'::jsonb,
              updated_at       = now()
        WHERE payer_id = $1`,
      [userId]
    );

    // Anonymise received payments (creator side)
    await this.db.query(
      `UPDATE payments
          SET recipient_name    = '[REDACTED]',
              recipient_email   = NULL,
              updated_at        = now()
        WHERE recipient_id = $1`,
      [userId]
    );
  }

  /** Removes all data that has no retention obligation. */
  private async deleteEphemeralData(userId: string): Promise<void> {
    const deletions: Array<[string, string]> = [
      ['user_sessions', 'user_id'],
      ['user_preferences', 'user_id'],
      ['user_activity_logs', 'user_id'],
      ['user_relationships', 'follower_id'],
      ['user_relationships', 'following_id'],
    ];

    for (const [table, col] of deletions) {
      await this.db.query(`DELETE FROM ${table} WHERE ${col} = $1`, [userId]);
    }
  }

  /**
   * Publishes a NIP-09 (kind:5) deletion event to the user's known NOSTR relays.
   * Failure is non-fatal — we log the error and continue.
   */
  private async broadcastNip09Deletion(
    userId: string,
    nostrPubkey: string
  ): Promise<boolean> {
    if (!nostrPubkey) return false;

    try {
      // Dynamically import nostr-tools to avoid hard runtime dependency
      const { SimplePool } = await import('nostr-tools');

      const event = {
        kind: 5, // NIP-09 deletion
        pubkey: nostrPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', nostrPubkey]],
        content: 'Account deleted per GDPR request',
      };

      const pool = new SimplePool();
      // Fire-and-forget — do not await; relay confirmation is best-effort
      pool.publish(DEFAULT_NOSTR_RELAYS, event as never);
      // Allow up to 3 seconds for relays to acknowledge before moving on
      await new Promise((resolve) => setTimeout(resolve, 3000));
      pool.close(DEFAULT_NOSTR_RELAYS);

      this.logger.info('NIP-09 deletion broadcast sent', { userId, nostrPubkey });
      return true;
    } catch (error) {
      this.logger.warn('NIP-09 deletion broadcast failed (best-effort)', { userId, error });
      return false;
    }
  }

  private async scheduleHardDeletion(userId: string, runAt: Date): Promise<void> {
    await this.ensureQueue();
    const delayMs = Math.max(0, runAt.getTime() - Date.now());
    await this.queueService.addJob(
      DELETION_QUEUE,
      'hard-delete-user',
      { userId },
      {
        jobId: `hard-delete-${userId}`,
        delay: delayMs,
        attempts: 3,
        removeOnComplete: { count: 100 },
      }
    );
    this.logger.info('Hard deletion scheduled', { userId, runAt });
  }

  private async deleteRowsByUserId(table: string, userId: string): Promise<void> {
    // Determine the user FK column heuristically
    const col = table === 'users' ? 'id' : 'user_id';
    await this.db.query(`DELETE FROM ${table} WHERE ${col} = $1`, [userId]);
  }
}
