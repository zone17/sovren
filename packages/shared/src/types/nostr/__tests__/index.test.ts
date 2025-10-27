/**
 * NOSTR Types Test Suite - Comprehensive Type Validation
 *
 * US-308: Consolidate NOSTR Type Definitions
 * Epic 003: NOSTR Consolidation
 *
 * Tests for all consolidated NOSTR types and schemas
 */

import {describe, it, expect} from '@jest/globals';
import {
  // Events
  NostrEvent,
  NostrEventKind,
  NostrEventSchema,
  UnsignedNostrEventSchema,
  isReplaceableEvent,
  isEphemeralEvent,
  isParameterizedReplaceableEvent,
  getEventCoordinate,
  extractMentions,
  extractEventRefs,
  extractHashtags,
  isNostrEvent,
  // Keys
  NostrKeyPairSchema,
  NostrEnhancedKeyPairSchema,
  NostrKeyFormat,
  NostrEntropySource,
  NostrKeyStorageType,
  NostrKeySecurityLevel,
  // Relays
  RelayState,
  NostrRelaySchema,
  RelayConfigSchema,
  // Filters
  NostrFilterSchema,
  NostrFilterBuilder,
  CommonFilters,
  validateFilter,
  optimizeFilter,
  eventMatchesFilter,
  isNostrFilter,
  // NIPs
  NIP19EntityType,
  ReactionType,
  isNIPSupported,
  SUPPORTED_NIPS,
  // Errors
  NostrError,
  NostrConnectionError,
  NostrValidationError,
  // Constants
  DEFAULT_RELAYS,
  NostrSchemas,
} from '../index';

// ========================================
// Event Tests
// ========================================

describe('NOSTR Event Types', () => {
  const validEvent: NostrEvent = {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind: NostrEventKind.TEXT_NOTE,
    tags: [['p', 'c'.repeat(64)]],
    content: 'Hello, NOSTR!',
    sig: 'd'.repeat(128),
  };

  describe('NostrEventSchema', () => {
    it('should validate a correct event', () => {
      const result = NostrEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it('should reject event with invalid ID length', () => {
      const invalidEvent = { ...validEvent, id: 'short' };
      const result = NostrEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
    });

    it('should reject event with invalid pubkey length', () => {
      const invalidEvent = { ...validEvent, pubkey: 'short' };
      const result = NostrEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
    });

    it('should reject event with invalid signature length', () => {
      const invalidEvent = { ...validEvent, sig: 'short' };
      const result = NostrEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
    });

    it('should reject event with negative timestamp', () => {
      const invalidEvent = { ...validEvent, created_at: -1 };
      const result = NostrEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
    });

    it('should accept event with empty tags', () => {
      const event = { ...validEvent, tags: [] };
      const result = NostrEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should accept event with empty content', () => {
      const event = { ...validEvent, content: '' };
      const result = NostrEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('UnsignedNostrEventSchema', () => {
    it('should validate unsigned event', () => {
      const unsignedEvent = {
        pubkey: 'b'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: NostrEventKind.TEXT_NOTE,
        tags: [],
        content: 'Hello',
      };
      const result = UnsignedNostrEventSchema.safeParse(unsignedEvent);
      expect(result.success).toBe(true);
    });
  });

  describe('Event Kind Detection', () => {
    it('should identify replaceable events', () => {
      expect(isReplaceableEvent(0)).toBe(true);  // Metadata
      expect(isReplaceableEvent(3)).toBe(true);  // Contacts
      expect(isReplaceableEvent(10000)).toBe(true);
      expect(isReplaceableEvent(1)).toBe(false); // Text note
    });

    it('should identify ephemeral events', () => {
      expect(isEphemeralEvent(20000)).toBe(true);
      expect(isEphemeralEvent(25000)).toBe(true);
      expect(isEphemeralEvent(1)).toBe(false);
    });

    it('should identify parameterized replaceable events', () => {
      expect(isParameterizedReplaceableEvent(30000)).toBe(true);
      expect(isParameterizedReplaceableEvent(30023)).toBe(true);
      expect(isParameterizedReplaceableEvent(1)).toBe(false);
    });
  });

  describe('Event Coordinate', () => {
    it('should generate coordinate for parameterized replaceable event', () => {
      const event = {
        ...validEvent,
        kind: 30023,
        tags: [['d', 'my-article']],
      };
      const coordinate = getEventCoordinate(event);
      expect(coordinate).toBe(`30023:${validEvent.pubkey}:my-article`);
    });

    it('should return null for non-parameterized event', () => {
      const coordinate = getEventCoordinate(validEvent);
      expect(coordinate).toBeNull();
    });

    it('should use empty identifier when d tag missing', () => {
      const event = {
        ...validEvent,
        kind: 30023,
        tags: [],
      };
      const coordinate = getEventCoordinate(event);
      expect(coordinate).toBe(`30023:${validEvent.pubkey}:`);
    });
  });

  describe('Tag Extraction', () => {
    it('should extract mentions (p tags)', () => {
      const event = {
        ...validEvent,
        tags: [
          ['p', 'pubkey1'],
          ['p', 'pubkey2'],
          ['e', 'eventid'],
        ],
      };
      const mentions = extractMentions(event);
      expect(mentions).toEqual(['pubkey1', 'pubkey2']);
    });

    it('should extract event refs (e tags)', () => {
      const event = {
        ...validEvent,
        tags: [
          ['e', 'event1'],
          ['e', 'event2'],
          ['p', 'pubkey'],
        ],
      };
      const refs = extractEventRefs(event);
      expect(refs).toEqual(['event1', 'event2']);
    });

    it('should extract hashtags (t tags)', () => {
      const event = {
        ...validEvent,
        tags: [
          ['t', 'nostr'],
          ['t', 'bitcoin'],
          ['p', 'pubkey'],
        ],
      };
      const hashtags = extractHashtags(event);
      expect(hashtags).toEqual(['nostr', 'bitcoin']);
    });
  });

  describe('Type Guards', () => {
    it('should identify valid NostrEvent', () => {
      expect(isNostrEvent(validEvent)).toBe(true);
    });

    it('should reject invalid object', () => {
      expect(isNostrEvent({})).toBe(false);
      expect(isNostrEvent(null)).toBe(false);
      expect(isNostrEvent('string')).toBe(false);
    });
  });
});

// ========================================
// Key Tests
// ========================================

describe('NOSTR Key Types', () => {
  describe('NostrKeyPairSchema', () => {
    it('should validate correct key pair', () => {
      const keyPair = {
        privateKey: 'a'.repeat(64),
        publicKey: 'b'.repeat(64),
        created: Date.now(),
        encrypted: false,
      };
      const result = NostrKeyPairSchema.safeParse(keyPair);
      expect(result.success).toBe(true);
    });

    it('should reject invalid private key length', () => {
      const keyPair = {
        privateKey: 'short',
        publicKey: 'b'.repeat(64),
        created: Date.now(),
        encrypted: false,
      };
      const result = NostrKeyPairSchema.safeParse(keyPair);
      expect(result.success).toBe(false);
    });

    it('should default encrypted to false', () => {
      const keyPair = {
        privateKey: 'a'.repeat(64),
        publicKey: 'b'.repeat(64),
        created: Date.now(),
      };
      const result = NostrKeyPairSchema.safeParse(keyPair);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.encrypted).toBe(false);
      }
    });
  });

  describe('NostrEnhancedKeyPairSchema', () => {
    it('should validate enhanced key pair with all fields', () => {
      const enhancedKeyPair = {
        privateKey: 'a'.repeat(64),
        publicKey: 'b'.repeat(64),
        npub: 'npub1' + 'x'.repeat(59),
        nsec: 'nsec1' + 'y'.repeat(59),
        keyId: '550e8400-e29b-41d4-a716-446655440000',
        created: Date.now(),
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
        entropyBits: 256,
        storageType: NostrKeyStorageType.INDEXED_DB,
        encrypted: true,
        securityLevel: NostrKeySecurityLevel.ENHANCED,
      };
      const result = NostrEnhancedKeyPairSchema.safeParse(enhancedKeyPair);
      expect(result.success).toBe(true);
    });

    it('should reject npub without npub1 prefix', () => {
      const enhancedKeyPair = {
        privateKey: 'a'.repeat(64),
        publicKey: 'b'.repeat(64),
        npub: 'invalid',
        nsec: 'nsec1' + 'y'.repeat(59),
        keyId: '550e8400-e29b-41d4-a716-446655440000',
        created: Date.now(),
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
        entropyBits: 256,
        storageType: NostrKeyStorageType.INDEXED_DB,
        encrypted: true,
        securityLevel: NostrKeySecurityLevel.ENHANCED,
      };
      const result = NostrEnhancedKeyPairSchema.safeParse(enhancedKeyPair);
      expect(result.success).toBe(false);
    });

    it('should reject entropy bits below minimum', () => {
      const enhancedKeyPair = {
        privateKey: 'a'.repeat(64),
        publicKey: 'b'.repeat(64),
        npub: 'npub1' + 'x'.repeat(59),
        nsec: 'nsec1' + 'y'.repeat(59),
        keyId: '550e8400-e29b-41d4-a716-446655440000',
        created: Date.now(),
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
        entropyBits: 64, // Too low
        storageType: NostrKeyStorageType.INDEXED_DB,
        encrypted: true,
        securityLevel: NostrKeySecurityLevel.ENHANCED,
      };
      const result = NostrEnhancedKeyPairSchema.safeParse(enhancedKeyPair);
      expect(result.success).toBe(false);
    });
  });

  describe('Key Enums', () => {
    it('should have correct key format values', () => {
      expect(NostrKeyFormat.HEX).toBe('hex');
      expect(NostrKeyFormat.NPUB).toBe('npub');
      expect(NostrKeyFormat.NSEC).toBe('nsec');
    });

    it('should have correct entropy source values', () => {
      expect(NostrEntropySource.WEB_CRYPTO_API).toBe('web_crypto_api');
      expect(NostrEntropySource.HARDWARE_RNG).toBe('hardware_rng');
    });

    it('should have correct storage type values', () => {
      expect(NostrKeyStorageType.INDEXED_DB).toBe('indexed_db');
      expect(NostrKeyStorageType.MEMORY_ONLY).toBe('memory_only');
    });
  });
});

// ========================================
// Relay Tests
// ========================================

describe('NOSTR Relay Types', () => {
  describe('NostrRelaySchema', () => {
    it('should validate correct relay', () => {
      const relay = {
        url: 'wss://relay.damus.io',
        state: RelayState.CONNECTED,
        reconnectAttempts: 0,
        subscriptions: [],
        supportedNIPs: [1, 2, 4],
      };
      const result = NostrRelaySchema.safeParse(relay);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const relay = {
        url: 'not-a-url',
        state: RelayState.CONNECTED,
      };
      const result = NostrRelaySchema.safeParse(relay);
      expect(result.success).toBe(false);
    });

    it('should default arrays to empty', () => {
      const relay = {
        url: 'wss://relay.damus.io',
        state: RelayState.CONNECTED,
      };
      const result = NostrRelaySchema.safeParse(relay);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subscriptions).toEqual([]);
        expect(result.data.supportedNIPs).toEqual([]);
      }
    });
  });

  describe('RelayConfigSchema', () => {
    it('should validate relay config with defaults', () => {
      const config = {
        url: 'wss://relay.damus.io',
      };
      const result = RelayConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.read).toBe(true);
        expect(result.data.write).toBe(true);
        expect(result.data.autoReconnect).toBe(true);
      }
    });

    it('should accept custom configuration', () => {
      const config = {
        url: 'wss://relay.damus.io',
        read: true,
        write: false,
        autoReconnect: false,
        reconnectDelay: 2000,
        maxReconnectAttempts: 5,
      };
      const result = RelayConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Relay States', () => {
    it('should have all expected states', () => {
      expect(RelayState.DISCONNECTED).toBe('disconnected');
      expect(RelayState.CONNECTING).toBe('connecting');
      expect(RelayState.CONNECTED).toBe('connected');
      expect(RelayState.RECONNECTING).toBe('reconnecting');
      expect(RelayState.ERROR).toBe('error');
      expect(RelayState.CLOSED).toBe('closed');
    });
  });
});

// ========================================
// Filter Tests
// ========================================

describe('NOSTR Filter Types', () => {
  describe('NostrFilterSchema', () => {
    it('should validate filter with IDs', () => {
      const filter = {
        ids: ['a'.repeat(64)],
      };
      const result = NostrFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it('should validate filter with authors', () => {
      const filter = {
        authors: ['a'.repeat(64), 'b'.repeat(64)],
      };
      const result = NostrFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it('should validate filter with kinds', () => {
      const filter = {
        kinds: [0, 1, 3],
      };
      const result = NostrFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it('should validate filter with time range', () => {
      const filter = {
        since: 1000000,
        until: 2000000,
        limit: 50,
      };
      const result = NostrFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it('should validate filter with tag filters', () => {
      const filter = {
        '#p': ['a'.repeat(64)],
        '#e': ['b'.repeat(64)],
        '#t': ['nostr', 'bitcoin'],
      };
      const result = NostrFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it('should reject limit above maximum', () => {
      const filter = {
        limit: 10000,
      };
      const result = NostrFilterSchema.safeParse(filter);
      expect(result.success).toBe(false);
    });
  });

  describe('NostrFilterBuilder', () => {
    it('should build simple filter', () => {
      const filter = new NostrFilterBuilder()
        .kinds([1])
        .limit(50)
        .build();

      expect(filter.kinds).toEqual([1]);
      expect(filter.limit).toBe(50);
    });

    it('should build complex filter', () => {
      const filter = new NostrFilterBuilder()
        .authors(['a'.repeat(64)])
        .kinds([1, 6, 7])
        .since(1000000)
        .until(2000000)
        .limit(100)
        .hashtags(['nostr'])
        .build();

      expect(filter.authors).toEqual(['a'.repeat(64)]);
      expect(filter.kinds).toEqual([1, 6, 7]);
      expect(filter['#t']).toEqual(['nostr']);
    });

    it('should validate filter', () => {
      const builder = new NostrFilterBuilder().kinds([1]).limit(50);
      const validation = builder.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('CommonFilters', () => {
    it('should create user metadata filter', () => {
      const pubkey = 'a'.repeat(64);
      const filter = CommonFilters.userMetadata(pubkey);
      expect(filter.authors).toEqual([pubkey]);
      expect(filter.kinds).toEqual([0]);
      expect(filter.limit).toBe(1);
    });

    it('should create global feed filter', () => {
      const filter = CommonFilters.globalFeed(100);
      expect(filter.kinds).toEqual([1]);
      expect(filter.limit).toBe(100);
    });

    it('should create event replies filter', () => {
      const eventId = 'a'.repeat(64);
      const filter = CommonFilters.eventReplies(eventId);
      expect(filter['#e']).toEqual([eventId]);
      expect(filter.kinds).toEqual([1]);
    });
  });

  describe('Filter Utilities', () => {
    it('should validate well-formed filter', () => {
      const filter = {
        authors: ['a'.repeat(64)],
        kinds: [1],
        limit: 50,
      };
      const result = validateFilter(filter);
      expect(result.valid).toBe(true);
    });

    it('should warn about expensive queries', () => {
      const filter = { limit: 1000 };
      const result = validateFilter(filter);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should optimize filter by removing empty arrays', () => {
      const filter = {
        authors: [] as string[],
        kinds: [1],
        ids: [] as string[],
      };
      const optimized = optimizeFilter(filter);
      expect(optimized.authors).toBeUndefined();
      expect(optimized.ids).toBeUndefined();
      expect(optimized.kinds).toEqual([1]);
    });

    it('should remove duplicate values', () => {
      const filter = {
        authors: ['a'.repeat(64), 'a'.repeat(64)],
        kinds: [1, 1, 1],
      };
      const optimized = optimizeFilter(filter);
      expect(optimized.authors).toHaveLength(1);
      expect(optimized.kinds).toHaveLength(1);
    });
  });

  describe('Event Matching', () => {
    const event: NostrEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      created_at: 1500000,
      kind: 1,
      tags: [['p', 'c'.repeat(64)], ['t', 'nostr']],
      content: 'Test',
      sig: 'd'.repeat(128),
    };

    it('should match event by author', () => {
      const filter = { authors: ['b'.repeat(64)] };
      expect(eventMatchesFilter(event, filter)).toBe(true);
    });

    it('should not match event with wrong author', () => {
      const filter = { authors: ['x'.repeat(64)] };
      expect(eventMatchesFilter(event, filter)).toBe(false);
    });

    it('should match event by kind', () => {
      const filter = { kinds: [1, 6] };
      expect(eventMatchesFilter(event, filter)).toBe(true);
    });

    it('should match event in time range', () => {
      const filter = { since: 1000000, until: 2000000 };
      expect(eventMatchesFilter(event, filter)).toBe(true);
    });

    it('should not match event outside time range', () => {
      const filter = { since: 2000000 };
      expect(eventMatchesFilter(event, filter)).toBe(false);
    });

    it('should match event by tag', () => {
      const filter = { '#t': ['nostr'] };
      expect(eventMatchesFilter(event, filter)).toBe(true);
    });
  });

  describe('Type Guards', () => {
    it('should identify valid filter', () => {
      const filter = { kinds: [1], limit: 50 };
      expect(isNostrFilter(filter)).toBe(true);
    });

    it('should reject invalid object', () => {
      expect(isNostrFilter({})).toBe(false);
      expect(isNostrFilter(null)).toBe(false);
      expect(isNostrFilter('string')).toBe(false);
    });
  });
});

// ========================================
// NIP Tests
// ========================================

describe('NOSTR NIPs', () => {
  describe('NIP-19 Entity Types', () => {
    it('should have all entity types', () => {
      expect(NIP19EntityType.NPUB).toBe('npub');
      expect(NIP19EntityType.NSEC).toBe('nsec');
      expect(NIP19EntityType.NOTE).toBe('note');
      expect(NIP19EntityType.NPROFILE).toBe('nprofile');
      expect(NIP19EntityType.NEVENT).toBe('nevent');
    });
  });

  describe('Reaction Types', () => {
    it('should have standard reactions', () => {
      expect(ReactionType.LIKE).toBe('+');
      expect(ReactionType.DISLIKE).toBe('-');
      expect(ReactionType.HEART).toBe('❤️');
    });
  });

  describe('NIP Support', () => {
    it('should support core NIPs', () => {
      expect(isNIPSupported(1)).toBe(true);
      expect(isNIPSupported(4)).toBe(true);
      expect(isNIPSupported(19)).toBe(true);
    });

    it('should not support unsupported NIPs', () => {
      expect(isNIPSupported(999)).toBe(false);
    });

    it('should have comprehensive NIP list', () => {
      expect(SUPPORTED_NIPS).toContain(1);
      expect(SUPPORTED_NIPS).toContain(4);
      expect(SUPPORTED_NIPS).toContain(19);
      expect(SUPPORTED_NIPS).toContain(57);
    });
  });
});

// ========================================
// Error Tests
// ========================================

describe('NOSTR Errors', () => {
  it('should create base NostrError', () => {
    const error = new NostrError('Test error', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('NostrError');
  });

  it('should create NostrConnectionError', () => {
    const error = new NostrConnectionError('Connection failed', 'wss://relay.damus.io');
    expect(error.relay).toBe('wss://relay.damus.io');
    expect(error.code).toBe('CONNECTION_ERROR');
  });

  it('should create NostrValidationError', () => {
    const event: NostrEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      created_at: 1000000,
      kind: 1,
      tags: [],
      content: '',
      sig: 'c'.repeat(128),
    };
    const error = new NostrValidationError('Invalid event', event);
    expect(error.event).toEqual(event);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

// ========================================
// Constants Tests
// ========================================

describe('NOSTR Constants', () => {
  it('should have default relays', () => {
    expect(DEFAULT_RELAYS).toContain('wss://relay.damus.io');
    expect(DEFAULT_RELAYS.length).toBeGreaterThan(0);
  });

  it('should have all schemas', () => {
    expect(NostrSchemas).toBeDefined();
    expect(NostrSchemas.Event).toBeDefined();
    expect(NostrSchemas.KeyPair).toBeDefined();
    expect(NostrSchemas.Relay).toBeDefined();
    expect(NostrSchemas.Filter).toBeDefined();
  });
});
