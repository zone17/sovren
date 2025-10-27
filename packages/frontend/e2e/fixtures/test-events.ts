/**
 * 📝 Test Event Generators for E2E Tests
 * Creates valid NOSTR events for testing
 */
import { finalizeEvent, generateSecretKey, getPublicKey, nip04 } from 'nostr-tools';
import type { Event as NostrEvent, UnsignedEvent } from 'nostr-tools';

export interface TestUser {
  privateKey: Uint8Array;
  publicKey: string;
  privateKeyHex: string;
}

/**
 * Generate a test user with NOSTR keys
 */
export function generateTestUser(): TestUser {
  const privateKey = generateSecretKey();
  const publicKey = getPublicKey(privateKey);
  const privateKeyHex = Buffer.from(privateKey).toString('hex');

  return {
    privateKey,
    publicKey,
    privateKeyHex,
  };
}

/**
 * Create a text note event (kind 1)
 */
export function createTextNote(user: TestUser, content: string, tags: string[][] = []): NostrEvent {
  const unsignedEvent: UnsignedEvent = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
    pubkey: user.publicKey,
  };

  return finalizeEvent(unsignedEvent, user.privateKey);
}

/**
 * Create a metadata event (kind 0)
 */
export function createMetadata(
  user: TestUser,
  metadata: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
  }
): NostrEvent {
  const unsignedEvent: UnsignedEvent = {
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify(metadata),
    pubkey: user.publicKey,
  };

  return finalizeEvent(unsignedEvent, user.privateKey);
}

/**
 * Create a contacts event (kind 3)
 */
export function createContacts(user: TestUser, contacts: string[]): NostrEvent {
  const tags = contacts.map((pubkey) => ['p', pubkey]);

  const unsignedEvent: UnsignedEvent = {
    kind: 3,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
    pubkey: user.publicKey,
  };

  return finalizeEvent(unsignedEvent, user.privateKey);
}

/**
 * Create an encrypted DM event (kind 4)
 */
export async function createEncryptedDM(
  sender: TestUser,
  recipientPubkey: string,
  content: string
): Promise<NostrEvent> {
  const encryptedContent = await nip04.encrypt(sender.privateKey, recipientPubkey, content);

  const unsignedEvent: UnsignedEvent = {
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientPubkey]],
    content: encryptedContent,
    pubkey: sender.publicKey,
  };

  return finalizeEvent(unsignedEvent, sender.privateKey);
}

/**
 * Create a reaction event (kind 7)
 */
export function createReaction(
  user: TestUser,
  targetEventId: string,
  targetPubkey: string,
  content: string = '+'
): NostrEvent {
  const unsignedEvent: UnsignedEvent = {
    kind: 7,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', targetEventId],
      ['p', targetPubkey],
    ],
    content,
    pubkey: user.publicKey,
  };

  return finalizeEvent(unsignedEvent, user.privateKey);
}

/**
 * Create a repost event (kind 6)
 */
export function createRepost(
  user: TestUser,
  targetEventId: string,
  targetPubkey: string,
  relayUrl?: string
): NostrEvent {
  const tags: string[][] = [
    ['e', targetEventId, relayUrl || ''],
    ['p', targetPubkey],
  ];

  const unsignedEvent: UnsignedEvent = {
    kind: 6,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
    pubkey: user.publicKey,
  };

  return finalizeEvent(unsignedEvent, user.privateKey);
}

/**
 * Create a deletion event (kind 5)
 */
export function createDeletion(user: TestUser, eventIds: string[]): NostrEvent {
  const tags = eventIds.map((id) => ['e', id]);

  const unsignedEvent: UnsignedEvent = {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: 'Deleted',
    pubkey: user.publicKey,
  };

  return finalizeEvent(unsignedEvent, user.privateKey);
}

/**
 * Create a channel creation event (kind 40)
 */
export function createChannel(
  user: TestUser,
  metadata: {
    name: string;
    about?: string;
    picture?: string;
  }
): NostrEvent {
  const unsignedEvent: UnsignedEvent = {
    kind: 40,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify(metadata),
    pubkey: user.publicKey,
  };

  return finalizeEvent(unsignedEvent, user.privateKey);
}

/**
 * Create a channel message event (kind 42)
 */
export function createChannelMessage(
  user: TestUser,
  channelId: string,
  content: string,
  replyToId?: string
): NostrEvent {
  const tags: string[][] = [
    ['e', channelId, '', 'root'],
  ];

  if (replyToId) {
    tags.push(['e', replyToId, '', 'reply']);
  }

  const unsignedEvent: UnsignedEvent = {
    kind: 42,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
    pubkey: user.publicKey,
  };

  return finalizeEvent(unsignedEvent, user.privateKey);
}

/**
 * Test data sets
 */
export const TEST_METADATA = {
  alice: {
    name: 'Alice Test',
    about: 'Test user Alice for E2E tests',
    picture: 'https://example.com/alice.jpg',
    nip05: 'alice@test.com',
  },
  bob: {
    name: 'Bob Test',
    about: 'Test user Bob for E2E tests',
    picture: 'https://example.com/bob.jpg',
    nip05: 'bob@test.com',
  },
  charlie: {
    name: 'Charlie Test',
    about: 'Test user Charlie for E2E tests',
    picture: 'https://example.com/charlie.jpg',
  },
};

export const TEST_CONTENT = {
  notes: [
    'This is a test note for E2E testing',
    'Hello NOSTR world! Testing E2E flows',
    'Another test note with some content',
    'Testing relay connections and subscriptions',
    'Final test note for comprehensive coverage',
  ],
  dms: [
    'Hey, this is a test DM',
    'Testing encrypted messages',
    'Can you read this encrypted message?',
  ],
  channels: [
    {
      name: 'Test Channel',
      about: 'A test channel for E2E tests',
      picture: 'https://example.com/channel.jpg',
    },
  ],
  channelMessages: [
    'Welcome to the test channel!',
    'This is a test message in the channel',
    'Testing channel functionality',
  ],
};

/**
 * Batch create multiple test events
 */
export function createBatchTextNotes(
  user: TestUser,
  count: number,
  contentPrefix: string = 'Test note'
): NostrEvent[] {
  const events: NostrEvent[] = [];

  for (let i = 0; i < count; i++) {
    const content = `${contentPrefix} ${i + 1}`;
    events.push(createTextNote(user, content));
  }

  return events;
}

/**
 * Create a thread of events (reply chain)
 */
export function createThread(user: TestUser, messages: string[]): NostrEvent[] {
  const events: NostrEvent[] = [];

  messages.forEach((content, index) => {
    const tags: string[][] = [];

    if (index > 0) {
      // Add reply tags
      tags.push(['e', events[0].id, '', 'root']);
      if (index > 1) {
        tags.push(['e', events[index - 1].id, '', 'reply']);
      }
    }

    const event = createTextNote(user, content, tags);
    events.push(event);
  });

  return events;
}

/**
 * Verify event structure is valid
 */
export function isValidEvent(event: any): event is NostrEvent {
  return (
    event &&
    typeof event.id === 'string' &&
    typeof event.pubkey === 'string' &&
    typeof event.created_at === 'number' &&
    typeof event.kind === 'number' &&
    Array.isArray(event.tags) &&
    typeof event.content === 'string' &&
    typeof event.sig === 'string'
  );
}
