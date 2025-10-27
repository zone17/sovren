/**
 * 📝 Test Event Factory
 * US-318: Comprehensive Integration Tests
 *
 * Factory functions for creating test NOSTR events
 */

import type { UnsignedNostrEvent, NostrFilter } from '@shared/types/nostr';

/**
 * Test Event Factory
 */
export class TestEventFactory {
  /**
   * Create text note (kind 1)
   */
  static textNote(content: string, tags: string[][] = []): UnsignedNostrEvent {
    return {
      kind: 1,
      content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create profile metadata (kind 0)
   */
  static profile(metadata: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    website?: string;
  }): UnsignedNostrEvent {
    return {
      kind: 0,
      content: JSON.stringify(metadata),
      tags: [],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create encrypted DM template (kind 4)
   */
  static encryptedDM(recipientPubkey: string, encryptedContent: string): UnsignedNostrEvent {
    return {
      kind: 4,
      content: encryptedContent,
      tags: [['p', recipientPubkey]],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create reaction (kind 7)
   */
  static reaction(eventId: string, authorPubkey: string, emoji: string = '+'): UnsignedNostrEvent {
    return {
      kind: 7,
      content: emoji,
      tags: [
        ['e', eventId],
        ['p', authorPubkey],
      ],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create repost (kind 6)
   */
  static repost(eventId: string, authorPubkey: string, originalEventJson?: string): UnsignedNostrEvent {
    return {
      kind: 6,
      content: originalEventJson || '',
      tags: [
        ['e', eventId],
        ['p', authorPubkey],
      ],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create deletion event (kind 5)
   */
  static deletion(eventIds: string[], reason: string = ''): UnsignedNostrEvent {
    return {
      kind: 5,
      content: reason,
      tags: eventIds.map(id => ['e', id]),
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create contact list (kind 3)
   */
  static contactList(contacts: Array<{
    pubkey: string;
    relay?: string;
    petname?: string;
  }>): UnsignedNostrEvent {
    const tags = contacts.map(({ pubkey, relay, petname }) => {
      const tag = ['p', pubkey];
      if (relay) tag.push(relay);
      if (petname) tag.push(petname);
      return tag;
    });

    return {
      kind: 3,
      content: '',
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create relay list metadata (kind 10002 - NIP-65)
   */
  static relayList(relays: Array<{
    url: string;
    read?: boolean;
    write?: boolean;
  }>): UnsignedNostrEvent {
    const tags = relays.map(({ url, read, write }) => {
      const tag = ['r', url];
      if (read && !write) tag.push('read');
      if (write && !read) tag.push('write');
      return tag;
    });

    return {
      kind: 10002,
      content: '',
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create long-form content (kind 30023 - NIP-23)
   */
  static article(data: {
    title: string;
    content: string;
    summary?: string;
    image?: string;
    published_at?: number;
    tags?: string[];
  }): UnsignedNostrEvent {
    const tags: string[][] = [
      ['d', data.title.toLowerCase().replace(/\s+/g, '-')],
      ['title', data.title],
    ];

    if (data.summary) tags.push(['summary', data.summary]);
    if (data.image) tags.push(['image', data.image]);
    if (data.published_at) tags.push(['published_at', data.published_at.toString()]);
    if (data.tags) {
      data.tags.forEach(tag => tags.push(['t', tag]));
    }

    return {
      kind: 30023,
      content: data.content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create zap request (kind 9734 - NIP-57)
   */
  static zapRequest(data: {
    recipientPubkey: string;
    eventId?: string;
    amountSats: number;
    relays: string[];
    comment?: string;
  }): UnsignedNostrEvent {
    const tags: string[][] = [
      ['p', data.recipientPubkey],
      ['amount', (data.amountSats * 1000).toString()],
      ['relays', ...data.relays],
    ];

    if (data.eventId) {
      tags.push(['e', data.eventId]);
    }

    return {
      kind: 9734,
      content: data.comment || '',
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create NIP-05 identifier event (kind 0 with nip05)
   */
  static nip05Identifier(data: {
    name: string;
    nip05: string;
    about?: string;
    picture?: string;
  }): UnsignedNostrEvent {
    return {
      kind: 0,
      content: JSON.stringify(data),
      tags: [],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create event with many tags (stress test)
   */
  static manyTags(tagCount: number): UnsignedNostrEvent {
    const tags: string[][] = [];
    for (let i = 0; i < tagCount; i++) {
      tags.push(['t', `tag${i}`]);
    }

    return {
      kind: 1,
      content: `Event with ${tagCount} tags`,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create event with long content (stress test)
   */
  static longContent(lengthBytes: number): UnsignedNostrEvent {
    const content = 'x'.repeat(lengthBytes);

    return {
      kind: 1,
      content,
      tags: [],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create event with unicode and emojis
   */
  static unicode(content: string): UnsignedNostrEvent {
    return {
      kind: 1,
      content,
      tags: [],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create event with future timestamp (edge case)
   */
  static futureTimestamp(secondsInFuture: number): UnsignedNostrEvent {
    return {
      kind: 1,
      content: 'Event from the future',
      tags: [],
      created_at: Math.floor(Date.now() / 1000) + secondsInFuture,
    };
  }

  /**
   * Create event with old timestamp (edge case)
   */
  static oldTimestamp(secondsInPast: number): UnsignedNostrEvent {
    return {
      kind: 1,
      content: 'Old event',
      tags: [],
      created_at: Math.floor(Date.now() / 1000) - secondsInPast,
    };
  }

  /**
   * Batch create text notes
   */
  static batchTextNotes(count: number, prefix: string = 'Note'): UnsignedNostrEvent[] {
    return Array.from({ length: count }, (_, i) =>
      this.textNote(`${prefix} ${i + 1}`)
    );
  }
}

/**
 * Test Filter Factory
 */
export class TestFilterFactory {
  /**
   * Filter for text notes from author
   */
  static textNotesFromAuthor(authorPubkey: string, limit: number = 50): NostrFilter {
    return {
      kinds: [1],
      authors: [authorPubkey],
      limit,
    };
  }

  /**
   * Filter for profile metadata
   */
  static profileMetadata(authorPubkey: string): NostrFilter {
    return {
      kinds: [0],
      authors: [authorPubkey],
      limit: 1,
    };
  }

  /**
   * Filter for encrypted DMs
   */
  static encryptedDMs(userPubkey: string, limit: number = 50): NostrFilter {
    return {
      kinds: [4],
      '#p': [userPubkey],
      limit,
    };
  }

  /**
   * Filter for reactions to event
   */
  static reactionsToEvent(eventId: string): NostrFilter {
    return {
      kinds: [7],
      '#e': [eventId],
    };
  }

  /**
   * Filter for contact list
   */
  static contactList(authorPubkey: string): NostrFilter {
    return {
      kinds: [3],
      authors: [authorPubkey],
      limit: 1,
    };
  }

  /**
   * Filter for relay list (NIP-65)
   */
  static relayList(authorPubkey: string): NostrFilter {
    return {
      kinds: [10002],
      authors: [authorPubkey],
      limit: 1,
    };
  }

  /**
   * Filter with time range
   */
  static timeRange(data: {
    kinds?: number[];
    since?: number;
    until?: number;
    limit?: number;
  }): NostrFilter {
    return {
      kinds: data.kinds || [1],
      since: data.since,
      until: data.until,
      limit: data.limit || 50,
    };
  }

  /**
   * Filter for multiple kinds
   */
  static multipleKinds(kinds: number[], limit: number = 50): NostrFilter {
    return {
      kinds,
      limit,
    };
  }

  /**
   * Filter by event IDs
   */
  static byIds(ids: string[]): NostrFilter {
    return {
      ids,
    };
  }

  /**
   * Filter by authors
   */
  static byAuthors(authors: string[], limit: number = 50): NostrFilter {
    return {
      authors,
      limit,
    };
  }

  /**
   * Empty filter (should return limited events)
   */
  static empty(limit: number = 10): NostrFilter {
    return {
      limit,
    };
  }
}

/**
 * Test key generator (deterministic for testing)
 */
export function generateTestKeys(seed: string = 'test') {
  // Simple deterministic key generation for testing
  const hash = seed.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);

  const privateKey = Math.abs(hash).toString(16).padStart(64, '0');
  const publicKey = Math.abs(hash * 2).toString(16).padStart(64, '0');

  return {
    privateKey,
    publicKey,
    nsec: `nsec1${privateKey.substring(0, 58)}`,
    npub: `npub1${publicKey.substring(0, 58)}`,
  };
}
