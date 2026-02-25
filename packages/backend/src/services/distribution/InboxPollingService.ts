/**
 * Inbox Polling Service
 * EPIC-009B: BullMQ batch polling for unified inbox
 *
 * Architecture: 10 aggregated polling jobs (one per platform-interval combo)
 * instead of per-creator jobs — saves ~1-1.5GB Redis memory.
 *
 * Intervals:
 *   - active:  every 5 minutes (creator session active)
 *   - idle:    every 30 minutes (15min+ no requests)
 *
 * Security:
 *   - M-7: BullMQ job data contains only platform_connection_id (no keys/tokens).
 *     The BYOK key is resolved from the encrypted DB column at execution time.
 *   - C-5: BYOK keys are decrypted with BYOK_ENCRYPTION_KEY, separate from
 *     PLATFORM_TOKEN_ENCRYPTION_KEY used for OAuth tokens.
 *   - M-1: Any user-influenced URLs (e.g. Mastodon instance_url) must be
 *     validated with validateSsrfUrl() before use in server-side requests.
 */

import { Queue, Worker, type Job } from 'bullmq';
import type { IInboxPollingService } from '../../interfaces/distribution/IInboxPollingService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { IPlatformConnectionService } from '../../interfaces/distribution/IPlatformConnectionService';
import type { SupportedPlatform } from '@shared/types/distribution';
import { decryptToken, getEncryptionKey } from './crypto';
import { validateSsrfUrl } from '../../utils/ssrf';

const QUEUE_NAME = 'inbox-polling';
const ACTIVE_CRON = '*/5 * * * *'; // every 5 minutes
const IDLE_CRON = '*/30 * * * *'; // every 30 minutes

// Platforms that support inbox polling
const POLLED_PLATFORMS: SupportedPlatform[] = ['twitter', 'mastodon', 'bluesky', 'youtube'];

/**
 * M-7: Job data contains only identifiers — never plaintext keys or tokens.
 * The worker resolves credentials from the encrypted DB at execution time.
 */
interface PollJobData {
  platform: string;
  interval: 'active' | 'idle';
}

/**
 * Row fetched from platform_connections — contains encrypted blobs only.
 * Plaintext is never held in-memory beyond the scope of a single poll call.
 */
interface PlatformConnectionRow {
  id: string; // platform_connection_id — the only identifier in job data
  creator_id: string;
  platform: string;
  poll_interval: number;
  last_active_at: string | null;
  instance_url: string | null; // user-supplied Mastodon instance (must SSRF-validate)
  api_key_encrypted: string | null;
  api_key_iv: string | null;
  api_key_auth_tag: string | null;
  key_version: number;
}

interface ExternalMessage {
  platform_message_id: string;
  author: string;
  author_avatar_url?: string;
  content: string;
  type: 'comment' | 'reply' | 'dm' | 'mention';
  parent_post_id?: string;
  platform_created_at: string;
}

const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export class InboxPollingService implements IInboxPollingService {
  private readonly db: ISupabaseClient;
  private readonly platformService: IPlatformConnectionService;
  private readonly logger: ILogger;
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(db: ISupabaseClient, platformService: IPlatformConnectionService, logger: ILogger) {
    this.db = db;
    this.platformService = platformService;
    this.logger = logger;
  }

  async startPolling(): Promise<void> {
    // EPIC-009B: fetchPlatformMessages() is not yet implemented — the stub
    // returns [] for every poll.  Until platform adapter read support lands,
    // the BullMQ worker would only consume Redis connections and CPU cycles
    // with no useful work.  Guard behind ENABLE_INBOX_POLLING so the worker
    // is not created unless explicitly opted-in.
    if (process.env.ENABLE_INBOX_POLLING !== 'true') {
      this.logger.warn(
        '[InboxPollingService] Inbox polling disabled — fetchPlatformMessages not yet implemented. ' +
          'Set ENABLE_INBOX_POLLING=true to enable once platform adapters support message fetching.'
      );
      return;
    }

    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const connection = { host: redisHost, port: redisPort };

    this.queue = new Queue(QUEUE_NAME, { connection });

    // Upsert 8 batch schedulers: 4 platforms × 2 intervals
    // M-7: job data contains only {platform, interval} — no credentials
    for (const platform of POLLED_PLATFORMS) {
      await this.queue.upsertJobScheduler(
        `${platform}-active-poll`,
        { pattern: ACTIVE_CRON },
        { name: 'batch-poll', data: { platform, interval: 'active' } }
      );

      await this.queue.upsertJobScheduler(
        `${platform}-idle-poll`,
        { pattern: IDLE_CRON },
        { name: 'batch-poll', data: { platform, interval: 'idle' } }
      );
    }

    this.worker = new Worker<PollJobData>(
      QUEUE_NAME,
      async (job: Job<PollJobData>) => {
        await this.processPollJob(job.data);
      },
      {
        connection,
        concurrency: 50, // I/O-bound, high concurrency is safe
      }
    );

    this.worker.on('failed', (job, err) => {
      // M-7: log only jobId and platform — never log job data that might
      // contain sensitive fields if the schema ever changes
      this.logger.error('[InboxPollingService] Job failed', {
        jobId: job?.id,
        platform: (job?.data as PollJobData | undefined)?.platform,
        error: err.message,
      });
    });

    this.logger.info('[InboxPollingService] Batch polling started', {
      platforms: POLLED_PLATFORMS,
      schedulers: POLLED_PLATFORMS.length * 2,
    });
  }

  async stopPolling(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    if (this.queue) {
      for (const platform of POLLED_PLATFORMS) {
        await this.queue.removeJobScheduler(`${platform}-active-poll`).catch(() => {});
        await this.queue.removeJobScheduler(`${platform}-idle-poll`).catch(() => {});
      }
      await this.queue.close();
      this.queue = null;
    }

    this.logger.info('[InboxPollingService] Polling stopped');
  }

  async updatePollInterval(creatorId: string, platform: string, active: boolean): Promise<void> {
    if (!this.queue) {
      this.logger.warn('[InboxPollingService] updatePollInterval called before startPolling');
      return;
    }

    const updateData: Record<string, unknown> = {
      poll_interval: active ? 5 : 30,
      ...(active ? { last_active_at: new Date().toISOString() } : {}),
    };

    const { error } = await this.db
      .from('platform_connections')
      .update(updateData)
      .eq('creator_id', creatorId)
      .eq('platform', platform);

    if (error) {
      this.logger.error('[InboxPollingService] Failed to update poll interval', {
        creatorId,
        platform,
        active,
        error: error.message,
      });
    }

    this.logger.info('[InboxPollingService] Poll interval updated', {
      creatorId,
      platform,
      interval: active ? 'active (5min)' : 'idle (30min)',
    });
  }

  async pollNow(creatorId: string, platform: string): Promise<void> {
    if (!this.queue) {
      this.logger.warn('[InboxPollingService] pollNow called before startPolling');
      return;
    }

    // M-7: enqueue with identifiers only — the worker fetches credentials at runtime
    await this.queue.add('manual-poll', { platform, interval: 'active' } satisfies PollJobData, {
      priority: 1,
    });

    this.logger.info('[InboxPollingService] Manual poll triggered', { creatorId, platform });
  }

  // ============================================================================
  // Private: Batch job processor
  // ============================================================================

  private async processPollJob(data: PollJobData): Promise<void> {
    const { platform, interval } = data;
    const thresholdAt = new Date(Date.now() - IDLE_THRESHOLD_MS).toISOString();

    let query = this.db
      .from<PlatformConnectionRow>('platform_connections')
      .select(
        // M-7: fetch encrypted blobs here, at execution time — never stored in job data
        'id, creator_id, platform, poll_interval, last_active_at, instance_url, api_key_encrypted, api_key_iv, api_key_auth_tag, key_version'
      )
      .eq('platform', platform)
      .eq('status', 'connected');

    if (interval === 'active') {
      query = query.gte('last_active_at', thresholdAt);
    } else {
      query = query.or(`last_active_at.is.null,last_active_at.lt.${thresholdAt}`);
    }

    const { data: connections, error } = await query;

    if (error) {
      this.logger.error('[InboxPollingService] Failed to fetch connections for polling', {
        platform,
        interval,
        error: error.message,
      });
      return;
    }

    this.logger.info('[InboxPollingService] Processing batch poll', {
      platform,
      interval,
      creatorCount: (connections || []).length,
    });

    // #303: Stagger polls with random jitter to avoid burst traffic to external APIs
    const conns = connections || [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < conns.length; i += BATCH_SIZE) {
      const batch = conns.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map((conn) => this.pollCreatorPlatform(conn)));
      if (i + BATCH_SIZE < conns.length) {
        // Random jitter between batches: 100-500ms
        await new Promise((r) => setTimeout(r, 100 + Math.random() * 400));
      }
    }
  }

  private async pollCreatorPlatform(conn: PlatformConnectionRow): Promise<void> {
    const { creator_id, platform } = conn;

    try {
      // M-1: Validate any user-supplied instance URL before making outbound requests
      if (conn.instance_url) {
        await validateSsrfUrl(conn.instance_url);
      }

      // C-5 + X/Twitter BYOK: use BYOK key if present, skip if absent (write-only fallback)
      if (platform === 'twitter') {
        const hasApiKey = conn.api_key_encrypted && conn.api_key_iv && conn.api_key_auth_tag;
        if (!hasApiKey) {
          this.logger.info('[InboxPollingService] Twitter BYOK key absent — skipping read poll', {
            creatorId: creator_id,
          });
          return;
        }
      }

      const messages = await this.fetchPlatformMessages(conn);

      if (messages.length === 0) {
        return;
      }

      const rows = messages.map((msg) => ({
        creator_id,
        platform,
        platform_message_id: msg.platform_message_id,
        author: msg.author,
        author_avatar_url: msg.author_avatar_url || null,
        content: msg.content,
        type: msg.type,
        parent_post_id: msg.parent_post_id || null,
        is_read: false,
        is_archived: false,
        platform_created_at: msg.platform_created_at,
        fetched_at: new Date().toISOString(),
      }));

      const { error } = await this.db.from('inbox_messages').upsert(rows, {
        onConflict: 'creator_id,platform,platform_message_id',
        ignoreDuplicates: true,
      });

      if (error) {
        this.logger.error('[InboxPollingService] Failed to upsert inbox messages', {
          creatorId: creator_id,
          platform,
          error: error.message,
        });
        return;
      }

      this.logger.info('[InboxPollingService] Inbox updated', {
        creatorId: creator_id,
        platform,
        newMessages: messages.length,
      });
    } catch (err) {
      // Never include the raw error message if it might contain key material
      const safeMessage = err instanceof Error ? err.message : 'unknown error';
      this.logger.error('[InboxPollingService] Poll failed for creator', {
        creatorId: creator_id,
        platform,
        error: safeMessage,
      });
    }
  }

  private async fetchPlatformMessages(_conn: PlatformConnectionRow): Promise<ExternalMessage[]> {
    // TODO(EPIC-009B): Implement platform adapter read support.
    // Platform adapters will expose fetchMessages() — the BYOK key is decrypted
    // here via decryptByokKey(conn) and used for the duration of a single fetch
    // call, never stored or logged. Until then, polling jobs run but produce no
    // results. This is intentional: the polling infrastructure is pre-wired so
    // enabling reads requires only implementing this method per-platform.
    return [];
  }

  /**
   * C-5: Decrypt the BYOK API key using BYOK_ENCRYPTION_KEY — a separate key
   * from PLATFORM_TOKEN_ENCRYPTION_KEY used for OAuth tokens.
   * Never logs or surfaces the decrypted key.
   */
  decryptByokKey(conn: PlatformConnectionRow): string {
    if (!conn.api_key_encrypted || !conn.api_key_iv || !conn.api_key_auth_tag) {
      throw new Error('BYOK API key not configured for this connection');
    }

    // C-5: use dedicated BYOK_ENCRYPTION_KEY, not the OAuth token key
    const encryptionKey = getEncryptionKey(process.env.BYOK_ENCRYPTION_KEY);
    return decryptToken(
      Buffer.from(conn.api_key_encrypted, 'hex'),
      encryptionKey,
      Buffer.from(conn.api_key_iv, 'hex'),
      Buffer.from(conn.api_key_auth_tag, 'hex')
    );
  }
}
