/**
 * Unified Inbox Service Interface
 * EPIC-009: Multi-Platform Hub
 */

import type {
  AllPlatform,
  InboxMessage,
  DistributionPagination,
} from '@sovren/shared/types/distribution';

export interface InboxQuery {
  platform: AllPlatform | 'all';
  status: 'unread' | 'all' | 'archived';
  page: number;
  limit: number;
}

export interface IUnifiedInboxService {
  /** Get aggregated inbox messages */
  getMessages(
    creatorId: string,
    query: InboxQuery
  ): Promise<{ messages: InboxMessage[]; pagination: DistributionPagination }>;

  /** Reply to a message, routing to the correct platform */
  reply(creatorId: string, messageId: string, content: string): Promise<void>;

  /** Batch actions: mark read, mark unread, archive */
  batchAction(
    creatorId: string,
    messageIds: string[],
    action: 'mark_read' | 'mark_unread' | 'archive'
  ): Promise<number>;

  /** Poll connected platforms for new messages */
  pollMessages(creatorId: string): Promise<number>;
}
