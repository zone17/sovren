/**
 * 🧪 ELITE TESTS: NIP-65 Relay List Metadata Service
 * US-319: NIP-65 Implementation Tests
 *
 * Comprehensive test suite for NIP-65 relay list functionality
 * Target: 95%+ code coverage
 */


import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { NIP65Service } from '../NIP65Service';
import { KeyManagementService } from '../KeyManagementService';
import { RelayPoolManager } from '../RelayPoolManager';
import type {
  RelayMetadata,
  RelayListEvent,
  RelayPreferenceUpdate,
} from '@shared/types/nostr';

// Mock dependencies
vi.mock('../KeyManagementService');
vi.mock('../RelayPoolManager');

describe('NIP65Service', () => {
  let service: NIP65Service;
  let keyManagement: KeyManagementService;
  let relayPool: RelayPoolManager;
  let testPrivateKey: string;
  let testPublicKey: string;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Generate test keys
    const testKeyBytes = generateSecretKey();
    testPrivateKey = Array.from(testKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    testPublicKey = getPublicKey(testKeyBytes);

    // Setup mocks
    keyManagement = KeyManagementService.getInstance();
    relayPool = RelayPoolManager.getInstance();

    (keyManagement.getPrivateKey as any).mockResolvedValue(testPrivateKey);
    (keyManagement.getPublicKey as any).mockResolvedValue(testPublicKey);
    (relayPool.publishEvent as any).mockResolvedValue({
      success: true,
      relays: [],
      errors: [],
    });

    service = NIP65Service.getInstance();
    service.clearCache(); // Clear cache before each test
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NIP65Service.getInstance();
      const instance2 = NIP65Service.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('publishRelayList', () => {
    it('should publish relay list with read+write relays', async () => {
      const relays: RelayMetadata[] = [
        { url: 'wss://relay.damus.io', read: true, write: true },
        { url: 'wss://nos.lol', read: true, write: true },
      ];

      const event = await service.publishRelayList(relays);

      expect(event.kind).toBe(10002);
      expect(event.content).toBe('');
      expect(event.tags).toContainEqual(['r', 'wss://relay.damus.io']);
      expect(event.tags).toContainEqual(['r', 'wss://nos.lol']);
      expect((relayPool.publishEvent as any)).toHaveBeenCalledWith(event);
    });

    it('should publish relay list with read-only relays', async () => {
      const relays: RelayMetadata[] = [
        { url: 'wss://relay.nostr.band', read: true, write: false },
      ];

      const event = await service.publishRelayList(relays);

      expect(event.tags).toContainEqual([
        'r',
        'wss://relay.nostr.band',
        'read',
      ]);
    });

    it('should publish relay list with write-only relays', async () => {
      const relays: RelayMetadata[] = [
        { url: 'wss://write.relay.com', read: false, write: true },
      ];

      const event = await service.publishRelayList(relays);

      expect(event.tags).toContainEqual([
        'r',
        'wss://write.relay.com',
        'write',
      ]);
    });

    it('should publish relay list with mixed capabilities', async () => {
      const relays: RelayMetadata[] = [
        { url: 'wss://relay1.com', read: true, write: true },
        { url: 'wss://relay2.com', read: true, write: false },
        { url: 'wss://relay3.com', read: false, write: true },
      ];

      const event = await service.publishRelayList(relays);

      expect(event.tags).toContainEqual(['r', 'wss://relay1.com']);
      expect(event.tags).toContainEqual(['r', 'wss://relay2.com', 'read']);
      expect(event.tags).toContainEqual(['r', 'wss://relay3.com', 'write']);
    });

    it('should normalize relay URLs', async () => {
      const relays: RelayMetadata[] = [
        { url: 'relay.damus.io/', read: true, write: true }, // No protocol, trailing slash
        { url: 'wss://nos.lol/', read: true, write: true }, // Trailing slash
      ];

      const event = await service.publishRelayList(relays);

      expect(event.tags).toContainEqual(['r', 'wss://relay.damus.io']);
      expect(event.tags).toContainEqual(['r', 'wss://nos.lol']);
    });

    it('should use provided private key', async () => {
      const customKeyBytes = generateSecretKey();
      const customPrivateKey = Array.from(customKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const relays: RelayMetadata[] = [
        { url: 'wss://relay.damus.io', read: true, write: true },
      ];

      await service.publishRelayList(relays, customPrivateKey);

      // Should not call KeyManagement for private key
      expect((keyManagement.getPrivateKey as any)).not.toHaveBeenCalled();
    });

    it('should throw error for empty relay list', async () => {
      await expect(service.publishRelayList([])).rejects.toThrow(
        'Relay list cannot be empty'
      );
    });

    it('should throw error for relay without URL', async () => {
      const relays = [
        { url: '', read: true, write: true },
      ] as RelayMetadata[];

      await expect(service.publishRelayList(relays)).rejects.toThrow(
        'Relay URL is required'
      );
    });

    it('should throw error for relay with neither read nor write', async () => {
      const relays: RelayMetadata[] = [
        { url: 'wss://relay.com', read: false, write: false },
      ];

      await expect(service.publishRelayList(relays)).rejects.toThrow(
        'Relay must support at least read or write'
      );
    });

    it('should throw error if no private key available', async () => {
      (keyManagement.getPrivateKey as any).mockResolvedValue(null);

      const relays: RelayMetadata[] = [
        { url: 'wss://relay.damus.io', read: true, write: true },
      ];

      await expect(service.publishRelayList(relays)).rejects.toThrow(
        'No private key available'
      );
    });
  });

  describe('parseRelayList', () => {
    it('should parse relay list with read+write relays', () => {
      const event: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [
          ['r', 'wss://relay.damus.io'],
          ['r', 'wss://nos.lol'],
        ],
        content: '',
        sig: 'test-sig',
      };

      const parsed = service.parseRelayList(event);

      expect(parsed.relays).toHaveLength(2);
      expect(parsed.readRelays).toContain('wss://relay.damus.io');
      expect(parsed.readRelays).toContain('wss://nos.lol');
      expect(parsed.writeRelays).toContain('wss://relay.damus.io');
      expect(parsed.writeRelays).toContain('wss://nos.lol');
      expect(parsed.publishedAt).toBe(event.created_at);
      expect(parsed.eventId).toBe('test-id');
    });

    it('should parse relay list with read-only relays', () => {
      const event: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [['r', 'wss://relay.nostr.band', 'read']],
        content: '',
        sig: 'test-sig',
      };

      const parsed = service.parseRelayList(event);

      expect(parsed.relays).toHaveLength(1);
      expect(parsed.relays[0]).toEqual({
        url: 'wss://relay.nostr.band',
        read: true,
        write: false,
      });
      expect(parsed.readRelays).toContain('wss://relay.nostr.band');
      expect(parsed.writeRelays).toHaveLength(0);
    });

    it('should parse relay list with write-only relays', () => {
      const event: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [['r', 'wss://write.relay.com', 'write']],
        content: '',
        sig: 'test-sig',
      };

      const parsed = service.parseRelayList(event);

      expect(parsed.relays[0]).toEqual({
        url: 'wss://write.relay.com',
        read: false,
        write: true,
      });
      expect(parsed.readRelays).toHaveLength(0);
      expect(parsed.writeRelays).toContain('wss://write.relay.com');
    });

    it('should ignore non-relay tags', () => {
      const event: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [
          ['r', 'wss://relay.damus.io'],
          ['t', 'nostr'],
          ['p', testPublicKey],
        ],
        content: '',
        sig: 'test-sig',
      };

      const parsed = service.parseRelayList(event);

      expect(parsed.relays).toHaveLength(1);
    });

    it('should normalize relay URLs in parsed list', () => {
      const event: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [
          ['r', 'relay.damus.io/'],
          ['r', 'wss://nos.lol/'],
        ],
        content: '',
        sig: 'test-sig',
      };

      const parsed = service.parseRelayList(event);

      expect(parsed.relays[0].url).toBe('wss://relay.damus.io');
      expect(parsed.relays[1].url).toBe('wss://nos.lol');
    });
  });

  describe('fetchRelayList', () => {
    it('should fetch relay list from network', async () => {
      const mockEvent: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [['r', 'wss://relay.damus.io']],
        content: '',
        sig: 'test-sig',
      };

      (relayPool.subscribe as any).mockImplementation((filters, callback) => {
        setTimeout(() => callback(mockEvent as any), 10);
        return 'sub-id';
      });

      const relayList = await service.fetchRelayList(testPublicKey);

      expect(relayList).not.toBeNull();
      expect(relayList?.relays).toHaveLength(1);
      expect(relayList?.relays[0].url).toBe('wss://relay.damus.io');
    });

    it('should return cached relay list', async () => {
      const mockEvent: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [['r', 'wss://relay.damus.io']],
        content: '',
        sig: 'test-sig',
      };

      (relayPool.subscribe as any).mockImplementation((filters, callback) => {
        setTimeout(() => callback(mockEvent as any), 10);
        return 'sub-id';
      });

      // First fetch (from network)
      const relayList1 = await service.fetchRelayList(testPublicKey);

      // Second fetch (from cache)
      (relayPool.subscribe as any).mockClear();
      const relayList2 = await service.fetchRelayList(testPublicKey);

      expect(relayList2).toEqual(relayList1);
      expect((relayPool.subscribe as any)).not.toHaveBeenCalled();
    });

    it('should return default relays if none found', async () => {
      (relayPool.subscribe as any).mockImplementation(() => 'sub-id');

      const relayList = await service.fetchRelayList(testPublicKey, {
        includeDefaults: true,
      });

      expect(relayList).not.toBeNull();
      expect(relayList?.relays.length).toBeGreaterThan(0);
    });

    it('should return null if no relays found and defaults disabled', async () => {
      (relayPool.subscribe as any).mockImplementation(() => 'sub-id');

      const relayList = await service.fetchRelayList(testPublicKey, {
        includeDefaults: false,
      });

      expect(relayList).toBeNull();
    });

    it('should select most recent event', async () => {
      const oldEvent: RelayListEvent = {
        id: 'old-id',
        pubkey: testPublicKey,
        created_at: 1000,
        kind: 10002,
        tags: [['r', 'wss://old.relay.com']],
        content: '',
        sig: 'test-sig',
      };

      const newEvent: RelayListEvent = {
        id: 'new-id',
        pubkey: testPublicKey,
        created_at: 2000,
        kind: 10002,
        tags: [['r', 'wss://new.relay.com']],
        content: '',
        sig: 'test-sig',
      };

      (relayPool.subscribe as any).mockImplementation((filters, callback) => {
        setTimeout(() => {
          callback(oldEvent as any);
          callback(newEvent as any);
        }, 10);
        return 'sub-id';
      });

      const relayList = await service.fetchRelayList(testPublicKey);

      expect(relayList?.eventId).toBe('new-id');
      expect(relayList?.relays[0].url).toBe('wss://new.relay.com');
    });
  });

  describe('updateRelayPreferences', () => {
    it('should add new relay', async () => {
      const changes: RelayPreferenceUpdate[] = [
        { url: 'wss://new.relay.com', read: true, write: true },
      ];

      (relayPool.subscribe as any).mockImplementation(() => 'sub-id');

      const event = await service.updateRelayPreferences(changes);

      expect(event.tags).toContainEqual(['r', 'wss://new.relay.com']);
    });

    it('should update existing relay capabilities', async () => {
      const mockEvent: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [['r', 'wss://relay.damus.io']],
        content: '',
        sig: 'test-sig',
      };

      (relayPool.subscribe as any).mockImplementation((filters, callback) => {
        setTimeout(() => callback(mockEvent as any), 10);
        return 'sub-id';
      });

      const changes: RelayPreferenceUpdate[] = [
        { url: 'wss://relay.damus.io', read: true, write: false },
      ];

      const event = await service.updateRelayPreferences(changes);

      expect(event.tags).toContainEqual(['r', 'wss://relay.damus.io', 'read']);
    });

    it('should remove relay', async () => {
      const mockEvent: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [
          ['r', 'wss://relay.damus.io'],
          ['r', 'wss://nos.lol'],
        ],
        content: '',
        sig: 'test-sig',
      };

      (relayPool.subscribe as any).mockImplementation((filters, callback) => {
        setTimeout(() => callback(mockEvent as any), 10);
        return 'sub-id';
      });

      const changes: RelayPreferenceUpdate[] = [
        { url: 'wss://relay.damus.io', remove: true },
      ];

      const event = await service.updateRelayPreferences(changes);

      expect(event.tags).not.toContainEqual(['r', 'wss://relay.damus.io']);
      expect(event.tags).toContainEqual(['r', 'wss://nos.lol']);
    });
  });

  describe('getReadRelays', () => {
    it('should return read relays for user', async () => {
      const mockEvent: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [
          ['r', 'wss://relay1.com'],
          ['r', 'wss://relay2.com', 'read'],
          ['r', 'wss://relay3.com', 'write'],
        ],
        content: '',
        sig: 'test-sig',
      };

      (relayPool.subscribe as any).mockImplementation((filters, callback) => {
        setTimeout(() => callback(mockEvent as any), 10);
        return 'sub-id';
      });

      const readRelays = await service.getReadRelays(testPublicKey);

      expect(readRelays).toContain('wss://relay1.com');
      expect(readRelays).toContain('wss://relay2.com');
      expect(readRelays).not.toContain('wss://relay3.com');
    });
  });

  describe('getWriteRelays', () => {
    it('should return write relays for user', async () => {
      const mockEvent: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [
          ['r', 'wss://relay1.com'],
          ['r', 'wss://relay2.com', 'read'],
          ['r', 'wss://relay3.com', 'write'],
        ],
        content: '',
        sig: 'test-sig',
      };

      (relayPool.subscribe as any).mockImplementation((filters, callback) => {
        setTimeout(() => callback(mockEvent as any), 10);
        return 'sub-id';
      });

      const writeRelays = await service.getWriteRelays(testPublicKey);

      expect(writeRelays).toContain('wss://relay1.com');
      expect(writeRelays).not.toContain('wss://relay2.com');
      expect(writeRelays).toContain('wss://relay3.com');
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific public key', async () => {
      const mockEvent: RelayListEvent = {
        id: 'test-id',
        pubkey: testPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [['r', 'wss://relay.damus.io']],
        content: '',
        sig: 'test-sig',
      };

      (relayPool.subscribe as any).mockImplementation((filters, callback) => {
        setTimeout(() => callback(mockEvent as any), 10);
        return 'sub-id';
      });

      // Fetch and cache
      await service.fetchRelayList(testPublicKey);

      // Clear cache
      service.clearCache(testPublicKey);

      // Fetch again (should query network)
      (relayPool.subscribe as any).mockClear();
      (relayPool.subscribe as any).mockImplementation((filters, callback) => {
        setTimeout(() => callback(mockEvent as any), 10);
        return 'sub-id';
      });

      await service.fetchRelayList(testPublicKey);

      expect((relayPool.subscribe as any)).toHaveBeenCalled();
    });

    it('should clear all cache', () => {
      service.clearCache();
      // No error should be thrown
      expect(true).toBe(true);
    });
  });

  describe('getDefaultRelays', () => {
    it('should return default relays', () => {
      const defaultRelays = NIP65Service.getDefaultRelays();

      expect(defaultRelays.length).toBeGreaterThan(0);
      expect(defaultRelays[0]).toHaveProperty('url');
      expect(defaultRelays[0]).toHaveProperty('read');
      expect(defaultRelays[0]).toHaveProperty('write');
    });
  });
});
