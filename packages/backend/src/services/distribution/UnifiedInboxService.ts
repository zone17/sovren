/**
 * Unified Inbox Service
 * EPIC-009: Multi-platform message aggregation and routing
 */

import type { IUnifiedInboxService, InboxQuery } from '../../interfaces/distribution/IUnifiedInboxService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type {
  InboxMessage,
  DistributionPagination,
  SupportedPlatform,
} from '@sovren/shared/types/distribution';
import type { IPlatformConnectionService } from '../../interfaces/distribution/IPlatformConnectionService';

export class UnifiedInboxService implements IUnifiedInboxService {
  private readonly db: ISupabaseClient;
  private readonly platformService: IPlatformConnectionService;
  private readonly logger: ILogger;

  constructor(db: ISupabaseClient, platformService: IPlatformConnectionService, logger: ILogger) {
    this.db = db;
    this.platformService = platformService;
    this.logger = logger;
  }

  async getMessages(
    creatorId: string,
    query: InboxQuery
  ): Promise<{ messages: InboxMessage[]; pagination: DistributionPagination }> {
    let dbQuery = this.db
      .from('inbox_messages')
      .select('id, platform, author, author_avatar_url, content, type, parent_post_id, is_read, platform_created_at', { count: 'exact' })
      .eq('creator_id', creatorId)
      .eq('is_archived', query.status === 'archived');

    if (query.platform !== 'all') {
      dbQuery = dbQuery.eq('platform', query.platform);
    }

    if (query.status === 'unread') {
      dbQuery = dbQuery.eq('is_read', false);
    }

    // Pagination
    const offset = (query.page - 1) * query.limit;
    dbQuery = dbQuery
      .order('platform_created_at', { ascending: false })
      .range(offset, offset + query.limit - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      throw error;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / query.limit);

    const messages: InboxMessage[] = (data || []).map((row: any) => ({
      id: row.id,
      platform: row.platform,
      author: row.author,
      author_avatar_url: row.author_avatar_url,
      content: row.content,
      type: row.type,
      parent_post_id: row.parent_post_id,
      is_read: row.is_read,
      created_at: row.platform_created_at,
    }));

    return {
      messages,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    };
  }

  async reply(creatorId: string, messageId: string, content: string): Promise<void> {
    // Find the message to determine which platform to route to
    const { data: message, error: msgError } = await this.db
      .from('inbox_messages')
      .select('platform, platform_message_id')
      .eq('id', messageId)
      .eq('creator_id', creatorId)
      .single();

    if (msgError || !message) {
      throw new Error('Message not found or access denied');
    }

    // Route reply to the correct platform adapter
    const platform = message.platform as SupportedPlatform;
    if (platform === 'nostr') {
      // NOSTR replies handled separately through existing NOSTR service
      this.logger.info('[UnifiedInboxService] NOSTR reply delegated to NostrService', { messageId });
      return;
    }

    const adapter = this.platformService.getAdapter(platform);
    const accessToken = await this.platformService.getDecryptedToken(creatorId, platform);

    await adapter.sendReply(
      { access_token: accessToken, refresh_token: null, expires_at: null, scopes: [] },
      message.platform_message_id,
      content
    );

    this.logger.info('[UnifiedInboxService] Reply sent', {
      creatorId,
      messageId,
      platform,
    });
  }

  async batchAction(
    creatorId: string,
    messageIds: string[],
    action: 'mark_read' | 'mark_unread' | 'archive'
  ): Promise<number> {
    let updateData: Record<string, any>;

    switch (action) {
      case 'mark_read':
        updateData = { is_read: true };
        break;
      case 'mark_unread':
        updateData = { is_read: false };
        break;
      case 'archive':
        updateData = { is_archived: true };
        break;
    }

    const { error, count } = await this.db
      .from('inbox_messages')
      .update(updateData)
      .eq('creator_id', creatorId)
      .in('id', messageIds);

    if (error) {
      throw error;
    }

    this.logger.info('[UnifiedInboxService] Batch action completed', {
      creatorId,
      action,
      count,
    });

    return count || 0;
  }

  async pollMessages(creatorId: string): Promise<number> {
    const statuses = await this.platformService.getStatus(creatorId);
    let totalNew = 0;

    for (const platformStatus of statuses) {
      if (!platformStatus.connected) continue;

      try {
        const platform = platformStatus.platform as SupportedPlatform;
        const adapter = this.platformService.getAdapter(platform);
        const accessToken = await this.platformService.getDecryptedToken(creatorId, platform);

        // Get last fetch timestamp for this platform
        const { data: lastFetch } = await this.db
          .from('inbox_messages')
          .select('fetched_at')
          .eq('creator_id', creatorId)
          .eq('platform', platform)
          .order('fetched_at', { ascending: false })
          .limit(1)
          .single();

        const since = lastFetch?.fetched_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const messages = await adapter.getMessages(
          { access_token: accessToken, refresh_token: null, expires_at: null, scopes: [] },
          since
        );

        // Batch upsert messages (deduplicate by platform_message_id)
        if (messages.length > 0) {
          const allRows = messages.map(msg => ({
            creator_id: creatorId,
            platform: msg.platform,
            platform_message_id: msg.id,
            author: msg.author,
            content: msg.content,
            type: msg.type,
            parent_post_id: msg.parent_post_id,
            is_read: msg.is_read,
            platform_created_at: msg.created_at,
          }));

          const { error } = await this.db
            .from('inbox_messages')
            .upsert(allRows, { onConflict: 'creator_id,platform,platform_message_id' });

          if (!error) {
            totalNew += messages.length;
          }
        }
      } catch (err) {
        this.logger.error('[UnifiedInboxService] Poll failed for platform', {
          creatorId,
          platform: platformStatus.platform,
          error: (err as Error).message,
        });
      }
    }

    return totalNew;
  }
}
