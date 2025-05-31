import {
    NostrContact,
    NostrCryptographyError,
    NostrError,
    NostrEventKind,
    NostrUserProfile,
    NostrValidationError
} from '../../../../shared/src/types/nostr';
import { NostrService } from '../nostrService';

// Mock nostr-tools
jest.mock('nostr-tools', () => ({
  generateSecretKey: jest.fn(),
  getPublicKey: jest.fn(),
  finalizeEvent: jest.fn(),
  validateEvent: jest.fn(),
  verifyEvent: jest.fn(),
  nip04: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
  nip19: {
    encode: jest.fn(),
    decode: jest.fn(),
  },
  SimplePool: jest.fn().mockImplementation(() => ({
    ensureRelay: jest.fn(),
    subscribeMany: jest.fn(),
    publish: jest.fn().mockResolvedValue([]),
    close: jest.fn(),
  })),
}));

// Mock config
jest.mock('../../config/environment', () => ({
  config: {
    nostr: {
      relays: ['wss://relay.test.com', 'wss://another.relay.com'],
      privateKey: undefined,
      publicKey: undefined,
      autoConnect: true,
      connectionTimeout: 5000,
      maxRelays: 10,
      cacheTtl: 300000,
    },
  },
}));

// Mock feature flags
jest.mock('../../../../shared/src/featureFlags', () => ({
  parseFeatureFlags: jest.fn().mockReturnValue({
    enableNostrIntegration: true,
    enableNostrKeyGeneration: true,
    enableNostrEventPublishing: true,
    enableNostrEventSubscription: true,
    enableNostrDirectMessages: true,
    enableNostrContactList: true,
    enableNostrEventCaching: true,
    enableNostrRelay: true,
    enableNostrAIContentDiscovery: false,
    enableNostrMobileOptimizations: true,
  }),
}));

describe('🌐 NOSTR Service - Elite Implementation', () => {
  let nostrService: NostrService;

  beforeEach(() => {
    // Reset singleton instance for each test
    (NostrService as any).instance = undefined;
    nostrService = NostrService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    nostrService.disconnect();
  });

  describe('🏗️ Service Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = NostrService.getInstance();
      const instance2 = NostrService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize successfully with default configuration', async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      const mockGetPublicKey = require('nostr-tools').getPublicKey;

      mockGenerateSecretKey.mockReturnValue(new Uint8Array(32).fill(1));
      mockGetPublicKey.mockReturnValue('mock-public-key');

      await nostrService.initialize();

      expect(nostrService.getPublicKey()).toBe('mock-public-key');
    });

    it('should skip initialization when feature flag is disabled', async () => {
      const mockParseFeatureFlags = require('../../../../shared/src/featureFlags').parseFeatureFlags;
      mockParseFeatureFlags.mockReturnValueOnce({
        enableNostrIntegration: false,
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await nostrService.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('🌐 NOSTR integration disabled by feature flag');
      consoleSpy.mockRestore();
    });

    it('should handle initialization errors gracefully', async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      mockGenerateSecretKey.mockImplementation(() => {
        throw new Error('Crypto error');
      });

      await expect(nostrService.initialize()).rejects.toThrow(NostrError);
    });
  });

  describe('🔑 Key Management', () => {
    it('should generate new key pair successfully', async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      const mockGetPublicKey = require('nostr-tools').getPublicKey;

      const mockPrivateKey = new Uint8Array(32).fill(42);
      const mockPublicKey = 'generated-public-key';

      mockGenerateSecretKey.mockReturnValue(mockPrivateKey);
      mockGetPublicKey.mockReturnValue(mockPublicKey);

      const keyPair = await nostrService.generateKeyPair();

      expect(keyPair.privateKey).toBe(Buffer.from(mockPrivateKey).toString('hex'));
      expect(keyPair.publicKey).toBe(mockPublicKey);
      expect(keyPair.created).toBeCloseTo(Date.now(), -3);
      expect(keyPair.encrypted).toBe(false);
    });

    it('should import existing private key successfully', async () => {
      const mockGetPublicKey = require('nostr-tools').getPublicKey;
      const mockPublicKey = 'imported-public-key';
      const testPrivateKey = 'a'.repeat(64); // 64-character hex string

      mockGetPublicKey.mockReturnValue(mockPublicKey);

      const keyPair = await nostrService.importKeyPair(testPrivateKey);

      expect(keyPair.privateKey).toBe(testPrivateKey);
      expect(keyPair.publicKey).toBe(mockPublicKey);
    });

    it('should reject invalid private key length', async () => {
      const invalidPrivateKey = 'invalid-key';

      await expect(nostrService.importKeyPair(invalidPrivateKey))
        .rejects.toThrow(NostrCryptographyError);
    });

    it('should throw error when key generation is disabled', async () => {
      const mockParseFeatureFlags = require('../../../../shared/src/featureFlags').parseFeatureFlags;
      mockParseFeatureFlags.mockReturnValueOnce({
        enableNostrIntegration: true,
        enableNostrKeyGeneration: false,
      });

      // Re-initialize with disabled flag
      await nostrService.initialize();

      await expect(nostrService.generateKeyPair())
        .rejects.toThrow('Key generation disabled by feature flag');
    });
  });

  describe('📡 Relay Connection Management', () => {
    beforeEach(async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      const mockGetPublicKey = require('nostr-tools').getPublicKey;

      mockGenerateSecretKey.mockReturnValue(new Uint8Array(32).fill(1));
      mockGetPublicKey.mockReturnValue('test-public-key');

      await nostrService.initialize();
    });

    it('should connect to relays successfully', async () => {
      const mockPool = nostrService['pool'];
      const ensureRelaySpy = jest.spyOn(mockPool, 'ensureRelay');

      await nostrService.connectToRelays();

      expect(ensureRelaySpy).toHaveBeenCalledTimes(2);
      expect(ensureRelaySpy).toHaveBeenCalledWith('wss://relay.test.com');
      expect(ensureRelaySpy).toHaveBeenCalledWith('wss://another.relay.com');
    });

    it('should handle relay connection errors gracefully', async () => {
      const mockPool = nostrService['pool'];
      jest.spyOn(mockPool, 'ensureRelay').mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await nostrService.connectToRelays();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should throw error when relay connections are disabled', async () => {
      const mockParseFeatureFlags = require('../../../../shared/src/featureFlags').parseFeatureFlags;
      mockParseFeatureFlags.mockReturnValueOnce({
        enableNostrIntegration: true,
        enableNostrRelay: false,
      });

      // Re-initialize with disabled relay flag
      await nostrService.initialize();

      await expect(nostrService.connectToRelays())
        .rejects.toThrow('Relay connections disabled by feature flag');
    });
  });

  describe('📝 Event Publishing', () => {
    beforeEach(async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      const mockGetPublicKey = require('nostr-tools').getPublicKey;
      const mockFinalizeEvent = require('nostr-tools').finalizeEvent;
      const mockVerifyEvent = require('nostr-tools').verifyEvent;

      mockGenerateSecretKey.mockReturnValue(new Uint8Array(32).fill(1));
      mockGetPublicKey.mockReturnValue('test-public-key');
      mockFinalizeEvent.mockReturnValue({
        id: 'test-event-id',
        pubkey: 'test-public-key',
        created_at: Math.floor(Date.now() / 1000),
        kind: NostrEventKind.TEXT_NOTE,
        tags: [],
        content: 'test content',
        sig: 'test-signature',
      });
      mockVerifyEvent.mockReturnValue(true);

      await nostrService.initialize();
    });

    it('should publish text note successfully', async () => {
      const content = 'Hello NOSTR world!';

      const event = await nostrService.publishNote(content);

      expect(event.content).toBe(content);
      expect(event.kind).toBe(NostrEventKind.TEXT_NOTE);
      expect(event.pubkey).toBe('test-public-key');
    });

    it('should publish user profile successfully', async () => {
      const profile: NostrUserProfile = {
        name: 'Test User',
        about: 'A test user profile',
        picture: 'https://example.com/avatar.jpg',
      };

      const event = await nostrService.publishProfile(profile);

      expect(event.kind).toBe(NostrEventKind.SET_METADATA);
      expect(JSON.parse(event.content)).toEqual(profile);
    });

    it('should publish contact list successfully', async () => {
      const contacts: NostrContact[] = [
        { pubkey: 'a'.repeat(64), petname: 'Alice' },
        { pubkey: 'b'.repeat(64), relay: 'wss://example.com' },
      ];

      const event = await nostrService.publishContactList(contacts);

      expect(event.kind).toBe(NostrEventKind.CONTACTS);
      expect(event.tags).toEqual([
        ['p', 'a'.repeat(64), '', 'Alice'],
        ['p', 'b'.repeat(64), 'wss://example.com'],
      ]);
    });

    it('should send encrypted direct message successfully', async () => {
      const mockNip04 = require('nostr-tools').nip04;
      mockNip04.encrypt.mockResolvedValue('encrypted-content');

      const recipientPubkey = 'c'.repeat(64);
      const content = 'Secret message';

      const event = await nostrService.sendDirectMessage(recipientPubkey, content);

      expect(event.kind).toBe(NostrEventKind.ENCRYPTED_DIRECT_MESSAGE);
      expect(event.content).toBe('encrypted-content');
      expect(event.tags).toContainEqual(['p', recipientPubkey]);
    });

    it('should throw error when publishing is disabled', async () => {
      const mockParseFeatureFlags = require('../../../../shared/src/featureFlags').parseFeatureFlags;
      mockParseFeatureFlags.mockReturnValueOnce({
        enableNostrIntegration: true,
        enableNostrEventPublishing: false,
      });

      // Re-initialize with disabled publishing
      await nostrService.initialize();

      await expect(nostrService.publishNote('test'))
        .rejects.toThrow('Event publishing disabled by feature flag');
    });
  });

  describe('📡 Event Subscription', () => {
    beforeEach(async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      const mockGetPublicKey = require('nostr-tools').getPublicKey;

      mockGenerateSecretKey.mockReturnValue(new Uint8Array(32).fill(1));
      mockGetPublicKey.mockReturnValue('test-public-key');

      await nostrService.initialize();
    });

    it('should create subscription successfully', () => {
      const mockPool = nostrService['pool'];
      const mockSubscribeMany = jest.spyOn(mockPool, 'subscribeMany').mockReturnValue({
        on: jest.fn(),
      } as any);

      const filters = [{ kinds: [NostrEventKind.TEXT_NOTE], limit: 10 }];
      const onEvent = jest.fn();

      const subscriptionId = nostrService.subscribe(filters, onEvent);

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId.length).toBeGreaterThan(0);
      expect(mockSubscribeMany).toHaveBeenCalledWith([], filters, expect.any(Object));
    });

    it('should handle incoming events correctly', () => {
      const mockPool = nostrService['pool'];
      let eventCallback: any;

      jest.spyOn(mockPool, 'subscribeMany').mockReturnValue({
        on: jest.fn(),
        close: jest.fn(),
      } as any).mockImplementation((relays, filters, options) => {
        eventCallback = options.onevent;
        return { on: jest.fn(), close: jest.fn() };
      });

      const mockVerifyEvent = require('nostr-tools').verifyEvent;
      mockVerifyEvent.mockReturnValue(true);

      const onEvent = jest.fn();
      const filters = [{ kinds: [NostrEventKind.TEXT_NOTE] }];

      nostrService.subscribe(filters, onEvent);

      // Simulate incoming event
      const testEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: NostrEventKind.TEXT_NOTE,
        tags: [],
        content: 'test content',
        sig: 'test-sig',
      };

      eventCallback(testEvent);

      expect(onEvent).toHaveBeenCalledWith(testEvent);
    });

    it('should unsubscribe correctly', () => {
      const mockPool = nostrService['pool'];
      jest.spyOn(mockPool, 'subscribeMany').mockReturnValue({
        on: jest.fn(),
      } as any);

      const filters = [{ kinds: [NostrEventKind.TEXT_NOTE] }];
      const onEvent = jest.fn();

      const subscriptionId = nostrService.subscribe(filters, onEvent);
      nostrService.unsubscribe(subscriptionId);

      // Should not have the subscription in state anymore
      expect(nostrService['state'].subscriptions.has(subscriptionId)).toBe(false);
    });

    it('should throw error when subscription is disabled', () => {
      const mockParseFeatureFlags = require('../../../../shared/src/featureFlags').parseFeatureFlags;
      mockParseFeatureFlags.mockReturnValueOnce({
        enableNostrIntegration: true,
        enableNostrEventSubscription: false,
      });

      // Re-initialize with disabled subscription
      expect(() => {
        nostrService.subscribe([{ kinds: [1] }], jest.fn());
      }).toThrow('Event subscription disabled by feature flag');
    });
  });

  describe('💾 Event Caching', () => {
    beforeEach(async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      const mockGetPublicKey = require('nostr-tools').getPublicKey;

      mockGenerateSecretKey.mockReturnValue(new Uint8Array(32).fill(1));
      mockGetPublicKey.mockReturnValue('test-public-key');

      await nostrService.initialize();
    });

    it('should return empty array when caching is disabled', () => {
      const mockParseFeatureFlags = require('../../../../shared/src/featureFlags').parseFeatureFlags;
      mockParseFeatureFlags.mockReturnValueOnce({
        enableNostrIntegration: true,
        enableNostrEventCaching: false,
      });

      const events = nostrService.getCachedEvents();
      expect(events).toEqual([]);
    });

    it('should cache and retrieve events correctly', () => {
      const testEvent = {
        id: 'cached-event-id',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: NostrEventKind.TEXT_NOTE,
        tags: [],
        content: 'cached content',
        sig: 'test-sig',
      };

      // Cache the event by simulating subscription event
      nostrService['cacheEvent'](testEvent, 'test-relay');

      const cachedEvents = nostrService.getCachedEvents();
      expect(cachedEvents).toContainEqual(testEvent);
    });

    it('should filter cached events by criteria', () => {
      const textEvent = {
        id: 'text-event',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: NostrEventKind.TEXT_NOTE,
        tags: [],
        content: 'text content',
        sig: 'test-sig',
      };

      const metadataEvent = {
        id: 'metadata-event',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: NostrEventKind.SET_METADATA,
        tags: [],
        content: '{}',
        sig: 'test-sig',
      };

      nostrService['cacheEvent'](textEvent, 'test-relay');
      nostrService['cacheEvent'](metadataEvent, 'test-relay');

      const textEvents = nostrService.getCachedEvents({ kinds: [NostrEventKind.TEXT_NOTE] });
      expect(textEvents).toHaveLength(1);
      expect(textEvents[0].kind).toBe(NostrEventKind.TEXT_NOTE);
    });
  });

  describe('🧹 Cleanup and Disconnection', () => {
    beforeEach(async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      const mockGetPublicKey = require('nostr-tools').getPublicKey;

      mockGenerateSecretKey.mockReturnValue(new Uint8Array(32).fill(1));
      mockGetPublicKey.mockReturnValue('test-public-key');

      await nostrService.initialize();
    });

    it('should disconnect from all relays', async () => {
      const mockPool = nostrService['pool'];
      const closeSpy = jest.spyOn(mockPool, 'close');

      await nostrService.disconnect();

      expect(closeSpy).toHaveBeenCalled();
      expect(nostrService['state'].connectedRelays).toHaveLength(0);
      expect(nostrService['state'].isInitialized).toBe(false);
    });

    it('should clear all subscriptions on disconnect', async () => {
      // Create a subscription first
      const mockPool = nostrService['pool'];
      jest.spyOn(mockPool, 'subscribeMany').mockReturnValue({
        on: jest.fn(),
      } as any);

      const subscriptionId = nostrService.subscribe([{ kinds: [1] }], jest.fn());
      expect(nostrService['state'].subscriptions.size).toBe(1);

      await nostrService.disconnect();

      expect(nostrService['state'].subscriptions.size).toBe(0);
    });
  });

  describe('🔧 Utility Methods', () => {
    beforeEach(async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      const mockGetPublicKey = require('nostr-tools').getPublicKey;

      mockGenerateSecretKey.mockReturnValue(new Uint8Array(32).fill(1));
      mockGetPublicKey.mockReturnValue('test-public-key');

      await nostrService.initialize();
    });

    it('should return public key when available', () => {
      expect(nostrService.getPublicKey()).toBe('test-public-key');
    });

    it('should return null for public key when not available', () => {
      nostrService['keyPair'] = null;
      expect(nostrService.getPublicKey()).toBe(null);
    });

    it('should return user profile when available', () => {
      const testProfile: NostrUserProfile = { name: 'Test User' };
      nostrService['state'].userProfile = testProfile;

      expect(nostrService.getUserProfile()).toBe(testProfile);
    });

    it('should return contacts when available', () => {
      const testContacts: NostrContact[] = [{ pubkey: 'a'.repeat(64) }];
      nostrService['state'].contacts = testContacts;

      expect(nostrService.getContacts()).toBe(testContacts);
    });

    it('should return direct messages when available', () => {
      const testMessages = [
        {
          id: 'msg-1',
          from: 'a'.repeat(64),
          to: 'b'.repeat(64),
          content: 'encrypted',
          timestamp: Date.now(),
        }
      ];
      nostrService['state'].directMessages = testMessages;

      expect(nostrService.getDirectMessages()).toBe(testMessages);
    });
  });

  describe('⚠️ Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const mockVerifyEvent = require('nostr-tools').verifyEvent;
      mockVerifyEvent.mockReturnValue(false);

      const invalidEvent = {
        id: 'invalid-event',
        pubkey: 'invalid-pubkey',
        created_at: 0,
        kind: 999,
        tags: [],
        content: '',
        sig: 'invalid-sig',
      };

      expect(() => {
        nostrService['validateAndNormalizeEvent'](invalidEvent);
      }).toThrow(NostrValidationError);
    });

    it('should require private key for operations that need it', async () => {
      // Initialize without private key (read-only mode)
      nostrService['keyPair'] = {
        privateKey: '',
        publicKey: 'read-only-pubkey',
        created: Date.now(),
        encrypted: false,
      };

      await expect(nostrService.publishNote('test'))
        .rejects.toThrow(NostrCryptographyError);
    });

    it('should handle network errors during publishing', async () => {
      const mockGenerateSecretKey = require('nostr-tools').generateSecretKey;
      const mockGetPublicKey = require('nostr-tools').getPublicKey;
      const mockFinalizeEvent = require('nostr-tools').finalizeEvent;

      mockGenerateSecretKey.mockReturnValue(new Uint8Array(32).fill(1));
      mockGetPublicKey.mockReturnValue('test-public-key');
      mockFinalizeEvent.mockImplementation(() => {
        throw new Error('Network error');
      });

      await nostrService.initialize();

      await expect(nostrService.publishNote('test'))
        .rejects.toThrow(NostrError);
    });
  });
});
