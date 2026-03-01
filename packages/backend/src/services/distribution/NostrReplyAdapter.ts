// @ts-nocheck
/**
 * NOSTR Reply Adapter
 * EPIC-009B: Fixes the silent void return in UnifiedInboxService.reply() for NOSTR platform
 *
 * Implements kind:1 event creation with NIP-10 threading tags:
 *   - "e" tag: root event ID (NIP-10 marker: "root") and the replied-to event (marker: "reply")
 *   - "p" tag: public key of the author being replied to
 *
 * NIP-10 reference: https://github.com/nostr-protocol/nips/blob/master/10.md
 */

import { finalizeEvent, type EventTemplate } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { hexToBytes } from '@noble/hashes/utils';
import type { INostrReplyAdapter } from '../../interfaces/distribution/INostrReplyAdapter';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
];

interface NostrKeyRow {
  nostr_private_key_encrypted: string;
  nostr_private_key_iv: string;
  nostr_private_key_auth_tag: string;
  nostr_pubkey: string;
}

interface InboxMessageRow {
  platform_message_id: string; // original event ID
  author: string; // original author pubkey (hex)
}

export class NostrReplyAdapter implements INostrReplyAdapter {
  private readonly db: ISupabaseClient;
  private readonly logger: ILogger;
  private readonly pool: SimplePool;
  private readonly relays: string[];

  constructor(db: ISupabaseClient, logger: ILogger) {
    this.db = db;
    this.logger = logger;
    this.pool = new SimplePool();
    this.relays = (process.env.NOSTR_RELAYS || DEFAULT_RELAYS.join(','))
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
  }

  /**
   * Send a kind:1 reply event with NIP-10 threading tags.
   *
   * NIP-10 threading:
   *   - Root event: ["e", <root-event-id>, "", "root"]
   *   - Reply-to event: ["e", <parent-event-id>, "", "reply"]
   *   - Author mention: ["p", <author-pubkey>]
   *
   * When the original event IS the root (no further thread context), both
   * "root" and "reply" markers point to the same event ID.
   */
  async reply(
    creatorId: string,
    originalEventId: string,
    content: string
  ): Promise<{ eventId: string }> {
    // Resolve the creator's NOSTR private key
    const privateKeyHex = await this.resolvePrivateKey(creatorId);

    // Resolve the original event's author pubkey for the "p" tag
    const originalAuthorPubkey = await this.resolveOriginalAuthor(creatorId, originalEventId);

    // Build NIP-10 threading tags
    // Both root and reply point to the same event when we don't have deeper thread context
    const tags: string[][] = [
      ['e', originalEventId, '', 'root'],
      ['e', originalEventId, '', 'reply'],
    ];

    if (originalAuthorPubkey) {
      tags.push(['p', originalAuthorPubkey]);
    }

    const eventTemplate: EventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    };

    const secretKeyBytes = hexToBytes(privateKeyHex);
    const signedEvent = finalizeEvent(eventTemplate, secretKeyBytes);

    // Publish to all configured relays
    try {
      await Promise.allSettled(this.relays.map((relay) => this.pool.publish([relay], signedEvent)));
    } catch (err) {
      this.logger.warn('[NostrReplyAdapter] Relay publish partial failure', {
        eventId: signedEvent.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.logger.info('[NostrReplyAdapter] Reply event published', {
      creatorId,
      originalEventId,
      replyEventId: signedEvent.id,
      relayCount: this.relays.length,
    });

    return { eventId: signedEvent.id };
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async resolvePrivateKey(creatorId: string): Promise<string> {
    // Retrieve the creator's NOSTR private key from the profiles table.
    // The backend stores encrypted keys; for NOSTR signing we need the plaintext key.
    // This follows the same decryption pattern as PlatformConnectionService.
    const { data, error } = await this.db
      .from<NostrKeyRow>('user_profiles')
      .select(
        'nostr_private_key_encrypted, nostr_private_key_iv, nostr_private_key_auth_tag, nostr_pubkey'
      )
      .eq('id', creatorId)
      .single();

    if (error || !data) {
      throw new Error(`NOSTR private key not found for creator ${creatorId}`);
    }

    // #269: Reject incomplete encryption state — never fall back to plaintext
    if (!data.nostr_private_key_iv || !data.nostr_private_key_auth_tag) {
      throw new Error(
        'NOSTR private key encryption data is incomplete. Key must be re-stored with proper encryption.'
      );
    }

    // Decrypt AES-256-GCM encrypted key
    const { decryptToken, getEncryptionKey } = await import('./crypto');
    const encKey = getEncryptionKey();
    return decryptToken(
      Buffer.from(data.nostr_private_key_encrypted, 'hex'),
      encKey,
      Buffer.from(data.nostr_private_key_iv, 'hex'),
      Buffer.from(data.nostr_private_key_auth_tag, 'hex')
    );
  }

  private async resolveOriginalAuthor(
    creatorId: string,
    originalEventId: string
  ): Promise<string | null> {
    // Look up the original message in the inbox to get the author pubkey
    const { data } = await this.db
      .from<InboxMessageRow>('inbox_messages')
      .select('platform_message_id, author')
      .eq('creator_id', creatorId)
      .eq('platform', 'nostr')
      .eq('platform_message_id', originalEventId)
      .maybeSingle();

    return data?.author || null;
  }
}
