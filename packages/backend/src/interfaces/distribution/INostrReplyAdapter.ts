/**
 * NOSTR Reply Adapter Interface
 * EPIC-009B: Fixes silent void return in UnifiedInboxService.reply() for NOSTR
 */

export interface INostrReplyAdapter {
  /** Send a kind:1 reply event with NIP-10 threading tags */
  reply(creatorId: string, originalEventId: string, content: string): Promise<{ eventId: string }>;
}
