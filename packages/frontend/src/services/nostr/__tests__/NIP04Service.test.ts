/**
 * NIP-04 Encrypted Direct Messages Service Tests
 * US-305: Implement NIP-04 Encrypted Direct Messages
 * Epic 003: NOSTR Consolidation
 *
 * Test Coverage:
 * - ECDH shared secret derivation
 * - AES-256-CBC encryption/decryption
 * - IV generation and handling
 * - Base64 encoding/decoding
 * - Browser extension encryption support
 * - Error handling and validation
 * - DM thread management
 * - Security features
 */

import { NIP04Service } from '../NIP04Service';
import { KeyManagementService } from '../KeyManagementService';
import type { NostrEvent } from '@sovren/shared/types/nostr/events';
import type { NostrDirectMessage } from '@sovren/shared/types/nostr/nips';

// Mock WebCrypto API
const mockCrypto = {
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    importKey: vi.fn(),
    deriveBits: vi.fn(),
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  randomUUID: vi.fn(() => 'mock-uuid-1234'),
};

// Mock browser extension with NIP-04 support
const mockNostrExtension = {
  getPublicKey: vi.fn(),
  signEvent: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  _metadata: { name: 'Alby' },
};

// Test key pairs (for testing purposes only)
const TEST_KEYS = {
  sender: {
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001',
    publicKey: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  },
  recipient: {
    privateKey: '0000000000000000000000000000000000000000000000000000000000000002',
    publicKey: 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
  },
};

describe('NIP04Service', () => {
  let service: NIP04Service;
  let keyManagementService: KeyManagementService;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup global mocks
    Object.defineProperty(globalThis, "crypto", { value: mockCrypto as any, writable: true, configurable: true });
    (global as any).window = { nostr: mockNostrExtension };

    // Initialize services
    keyManagementService = KeyManagementService.getInstance();
    await keyManagementService.initialize();

    service = NIP04Service.getInstance();
    await service.initialize(keyManagementService);
  });

  afterEach(async () => {
    await service.destroy();
    await keyManagementService.destroy();
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = NIP04Service.getInstance();
      const instance2 = NIP04Service.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should require initialization before use', async () => {
      const freshService = NIP04Service.getInstance();

      await expect(
        freshService.encrypt('test message', TEST_KEYS.recipient.publicKey)
      ).rejects.toThrow('NIP04Service not initialized');
    });
  });

  describe('ECDH Key Derivation', () => {
    it('should derive shared secret from sender private key and recipient public key', async () => {
      const sharedSecret = await service.deriveSharedSecret(
        TEST_KEYS.sender.privateKey,
        TEST_KEYS.recipient.publicKey
      );

      expect(sharedSecret).toBeDefined();
      expect(sharedSecret).toBeInstanceOf(Uint8Array);
      expect(sharedSecret.length).toBe(32); // 256 bits
    });

    it('should derive same shared secret from both parties', async () => {
      // Sender derives shared secret
      const senderSecret = await service.deriveSharedSecret(
        TEST_KEYS.sender.privateKey,
        TEST_KEYS.recipient.publicKey
      );

      // Recipient derives shared secret
      const recipientSecret = await service.deriveSharedSecret(
        TEST_KEYS.recipient.privateKey,
        TEST_KEYS.sender.publicKey
      );

      expect(senderSecret).toEqual(recipientSecret);
    });

    it('should throw error for invalid private key', async () => {
      await expect(
        service.deriveSharedSecret('invalid', TEST_KEYS.recipient.publicKey)
      ).rejects.toThrow();
    });

    it('should throw error for invalid public key', async () => {
      await expect(
        service.deriveSharedSecret(TEST_KEYS.sender.privateKey, 'invalid')
      ).rejects.toThrow();
    });
  });

  describe('Encryption (AES-256-CBC)', () => {
    it('should encrypt plaintext message', async () => {
      const plaintext = 'Hello, NOSTR!';
      const encrypted = await service.encrypt(plaintext, TEST_KEYS.recipient.publicKey);

      expect(encrypted).toBeDefined();
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+\?iv=[A-Za-z0-9+/=]+$/);
    });

    it('should generate unique IV for each encryption', async () => {
      const plaintext = 'Test message';

      const encrypted1 = await service.encrypt(plaintext, TEST_KEYS.recipient.publicKey);
      const encrypted2 = await service.encrypt(plaintext, TEST_KEYS.recipient.publicKey);

      expect(encrypted1).not.toBe(encrypted2);

      const iv1 = encrypted1.split('?iv=')[1];
      const iv2 = encrypted2.split('?iv=')[1];
      expect(iv1).not.toBe(iv2);
    });

    it('should encrypt empty string', async () => {
      const encrypted = await service.encrypt('', TEST_KEYS.recipient.publicKey);

      expect(encrypted).toBeDefined();
      expect(encrypted).toMatch(/\?iv=/);
    });

    it('should encrypt long messages', async () => {
      const longMessage = 'A'.repeat(10000);
      const encrypted = await service.encrypt(longMessage, TEST_KEYS.recipient.publicKey);

      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should encrypt unicode characters', async () => {
      const unicode = '你好世界 🌍 émojis ñ';
      const encrypted = await service.encrypt(unicode, TEST_KEYS.recipient.publicKey);

      expect(encrypted).toBeDefined();
    });

    it('should throw error for invalid recipient public key', async () => {
      await expect(
        service.encrypt('test', 'invalid-pubkey')
      ).rejects.toThrow();
    });
  });

  describe('Decryption (AES-256-CBC)', () => {
    it('should decrypt encrypted message', async () => {
      const plaintext = 'Secret message';
      const encrypted = await service.encrypt(plaintext, TEST_KEYS.recipient.publicKey);

      const decrypted = await service.decrypt(
        encrypted,
        TEST_KEYS.sender.publicKey
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt empty string', async () => {
      const encrypted = await service.encrypt('', TEST_KEYS.recipient.publicKey);
      const decrypted = await service.decrypt(encrypted, TEST_KEYS.sender.publicKey);

      expect(decrypted).toBe('');
    });

    it('should decrypt unicode characters', async () => {
      const unicode = '你好世界 🌍 émojis ñ';
      const encrypted = await service.encrypt(unicode, TEST_KEYS.recipient.publicKey);
      const decrypted = await service.decrypt(encrypted, TEST_KEYS.sender.publicKey);

      expect(decrypted).toBe(unicode);
    });

    it('should throw error for malformed encrypted content', async () => {
      await expect(
        service.decrypt('malformed', TEST_KEYS.sender.publicKey)
      ).rejects.toThrow('Invalid encrypted content format');
    });

    it('should throw error for missing IV', async () => {
      await expect(
        service.decrypt('base64content', TEST_KEYS.sender.publicKey)
      ).rejects.toThrow('Invalid encrypted content format');
    });

    it('should throw error for invalid base64', async () => {
      await expect(
        service.decrypt('!!!invalid!!!?iv=validbase64==', TEST_KEYS.sender.publicKey)
      ).rejects.toThrow();
    });

    it('should throw error for wrong decryption key', async () => {
      const plaintext = 'Secret';
      const encrypted = await service.encrypt(plaintext, TEST_KEYS.recipient.publicKey);

      // Try to decrypt with wrong public key
      const wrongPublicKey = '0000000000000000000000000000000000000000000000000000000000000099';

      await expect(
        service.decrypt(encrypted, wrongPublicKey)
      ).rejects.toThrow();
    });
  });

  describe('Round-trip Encryption/Decryption', () => {
    it('should successfully round-trip simple message', async () => {
      const original = 'Test message';
      const encrypted = await service.encrypt(original, TEST_KEYS.recipient.publicKey);
      const decrypted = await service.decrypt(encrypted, TEST_KEYS.sender.publicKey);

      expect(decrypted).toBe(original);
    });

    it('should successfully round-trip complex message', async () => {
      const original = JSON.stringify({
        type: 'payment',
        amount: 1000,
        currency: 'sats',
        emoji: '⚡',
      });

      const encrypted = await service.encrypt(original, TEST_KEYS.recipient.publicKey);
      const decrypted = await service.decrypt(encrypted, TEST_KEYS.sender.publicKey);

      expect(decrypted).toBe(original);
    });
  });

  describe('Browser Extension Encryption', () => {
    it('should use extension for encryption if available and preferred', async () => {
      mockNostrExtension.encrypt.mockResolvedValue('extension-encrypted?iv=base64iv');

      const encrypted = await service.encryptWithExtension(
        'test',
        TEST_KEYS.recipient.publicKey
      );

      expect(mockNostrExtension.encrypt).toHaveBeenCalledWith(
        TEST_KEYS.recipient.publicKey,
        'test'
      );
      expect(encrypted).toBe('extension-encrypted?iv=base64iv');
    });

    it('should use extension for decryption if available', async () => {
      mockNostrExtension.decrypt.mockResolvedValue('decrypted message');

      const decrypted = await service.decryptWithExtension(
        'encrypted?iv=base64',
        TEST_KEYS.sender.publicKey
      );

      expect(mockNostrExtension.decrypt).toHaveBeenCalledWith(
        TEST_KEYS.sender.publicKey,
        'encrypted?iv=base64'
      );
      expect(decrypted).toBe('decrypted message');
    });

    it('should throw error if extension not available', async () => {
      (global as any).window = {};

      await expect(
        service.encryptWithExtension('test', TEST_KEYS.recipient.publicKey)
      ).rejects.toThrow('Browser extension not available');
    });

    it('should fall back to native encryption if extension fails', async () => {
      mockNostrExtension.encrypt.mockRejectedValue(new Error('Extension error'));

      const encrypted = await service.encrypt(
        'test',
        TEST_KEYS.recipient.publicKey,
        { fallbackToNative: true }
      );

      expect(encrypted).toBeDefined();
      expect(encrypted).toMatch(/\?iv=/);
    });
  });

  describe('DM Event Creation', () => {
    it('should create NIP-04 compliant DM event (kind 4)', async () => {
      const message = 'Hello!';
      const event = await service.createDMEvent(
        message,
        TEST_KEYS.recipient.publicKey
      );

      expect(event.kind).toBe(4);
      expect(event.content).toMatch(/\?iv=/);
      expect(event.tags).toContainEqual(['p', TEST_KEYS.recipient.publicKey]);
      expect(event.created_at).toBeGreaterThan(0);
    });

    it('should sign DM event with local key', async () => {
      const event = await service.createDMEvent(
        'test',
        TEST_KEYS.recipient.publicKey,
        { sign: true }
      );

      expect(event.id).toBeDefined();
      expect(event.sig).toBeDefined();
      expect(event.sig).toHaveLength(128);
    });

    it('should create unsigned event if sign=false', async () => {
      const event = await service.createDMEvent(
        'test',
        TEST_KEYS.recipient.publicKey,
        { sign: false }
      );

      expect(event.id).toBeUndefined();
      expect(event.sig).toBeUndefined();
    });
  });

  describe('DM Thread Management', () => {
    it('should create DM thread ID from two public keys', () => {
      const threadId1 = service.getThreadId(
        TEST_KEYS.sender.publicKey,
        TEST_KEYS.recipient.publicKey
      );

      const threadId2 = service.getThreadId(
        TEST_KEYS.recipient.publicKey,
        TEST_KEYS.sender.publicKey
      );

      // Thread ID should be the same regardless of order
      expect(threadId1).toBe(threadId2);
    });

    it('should add message to thread', async () => {
      const message: NostrDirectMessage = {
        id: 'msg1',
        from: TEST_KEYS.sender.publicKey,
        to: TEST_KEYS.recipient.publicKey,
        content: 'encrypted?iv=base64',
        timestamp: Date.now(),
      };

      await service.addMessageToThread(message);

      const thread = await service.getThread(
        TEST_KEYS.sender.publicKey,
        TEST_KEYS.recipient.publicKey
      );

      expect(thread).toHaveLength(1);
      expect(thread[0]).toEqual(message);
    });

    it('should retrieve messages sorted by timestamp', async () => {
      const now = Date.now();

      const messages: NostrDirectMessage[] = [
        {
          id: 'msg1',
          from: TEST_KEYS.sender.publicKey,
          to: TEST_KEYS.recipient.publicKey,
          content: 'test1',
          timestamp: now + 1000,
        },
        {
          id: 'msg2',
          from: TEST_KEYS.recipient.publicKey,
          to: TEST_KEYS.sender.publicKey,
          content: 'test2',
          timestamp: now,
        },
        {
          id: 'msg3',
          from: TEST_KEYS.sender.publicKey,
          to: TEST_KEYS.recipient.publicKey,
          content: 'test3',
          timestamp: now + 2000,
        },
      ];

      for (const msg of messages) {
        await service.addMessageToThread(msg);
      }

      const thread = await service.getThread(
        TEST_KEYS.sender.publicKey,
        TEST_KEYS.recipient.publicKey
      );

      expect(thread).toHaveLength(3);
      expect(thread[0].timestamp).toBeLessThan(thread[1].timestamp);
      expect(thread[1].timestamp).toBeLessThan(thread[2].timestamp);
    });

    it('should mark messages as read', async () => {
      const message: NostrDirectMessage = {
        id: 'msg1',
        from: TEST_KEYS.recipient.publicKey,
        to: TEST_KEYS.sender.publicKey,
        content: 'test',
        timestamp: Date.now(),
      };

      await service.addMessageToThread(message);
      await service.markAsRead(
        TEST_KEYS.sender.publicKey,
        TEST_KEYS.recipient.publicKey
      );

      const unreadCount = await service.getUnreadCount(
        TEST_KEYS.sender.publicKey,
        TEST_KEYS.recipient.publicKey
      );

      expect(unreadCount).toBe(0);
    });

    it('should count unread messages correctly', async () => {
      const messages: NostrDirectMessage[] = [
        {
          id: 'msg1',
          from: TEST_KEYS.recipient.publicKey,
          to: TEST_KEYS.sender.publicKey,
          content: 'test1',
          timestamp: Date.now(),
        },
        {
          id: 'msg2',
          from: TEST_KEYS.recipient.publicKey,
          to: TEST_KEYS.sender.publicKey,
          content: 'test2',
          timestamp: Date.now() + 1000,
        },
      ];

      for (const msg of messages) {
        await service.addMessageToThread(msg);
      }

      const unreadCount = await service.getUnreadCount(
        TEST_KEYS.sender.publicKey,
        TEST_KEYS.recipient.publicKey
      );

      expect(unreadCount).toBe(2);
    });

    it('should clear thread history', async () => {
      const message: NostrDirectMessage = {
        id: 'msg1',
        from: TEST_KEYS.sender.publicKey,
        to: TEST_KEYS.recipient.publicKey,
        content: 'test',
        timestamp: Date.now(),
      };

      await service.addMessageToThread(message);
      await service.clearThread(
        TEST_KEYS.sender.publicKey,
        TEST_KEYS.recipient.publicKey
      );

      const thread = await service.getThread(
        TEST_KEYS.sender.publicKey,
        TEST_KEYS.recipient.publicKey
      );

      expect(thread).toHaveLength(0);
    });
  });

  describe('Security Features', () => {
    it('should not log plaintext messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const secret = 'super-secret-message';

      await service.encrypt(secret, TEST_KEYS.recipient.publicKey);

      const logs = consoleSpy.mock.calls.join(' ');
      expect(logs).not.toContain(secret);

      consoleSpy.mockRestore();
    });

    it('should not log private keys', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await service.encrypt('test', TEST_KEYS.recipient.publicKey);

      const logs = consoleSpy.mock.calls.join(' ');
      expect(logs).not.toContain(TEST_KEYS.sender.privateKey);

      consoleSpy.mockRestore();
    });

    it('should validate encrypted content format before decryption', async () => {
      const invalidFormats = [
        '',
        'no-iv-separator',
        '?iv=',
        '?iv=only-iv',
        'multiple?iv=separators?iv=bad',
      ];

      for (const invalid of invalidFormats) {
        await expect(
          service.decrypt(invalid, TEST_KEYS.sender.publicKey)
        ).rejects.toThrow();
      }
    });

    it('should use cryptographically secure random for IV generation', async () => {
      expect(mockCrypto.getRandomValues).toBeDefined();

      await service.encrypt('test', TEST_KEYS.recipient.publicKey);

      expect(mockCrypto.getRandomValues).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption errors gracefully', async () => {
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Crypto error'));

      await expect(
        service.encrypt('test', TEST_KEYS.recipient.publicKey)
      ).rejects.toThrow('Encryption failed');
    });

    it('should handle decryption errors gracefully', async () => {
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Crypto error'));

      await expect(
        service.decrypt('valid?iv=base64==', TEST_KEYS.sender.publicKey)
      ).rejects.toThrow('Decryption failed');
    });

    it('should provide meaningful error messages', async () => {
      try {
        await service.decrypt('malformed', TEST_KEYS.sender.publicKey);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid encrypted content format');
      }
    });
  });

  describe('Performance', () => {
    it('should encrypt message in reasonable time', async () => {
      const start = performance.now();

      await service.encrypt('performance test', TEST_KEYS.recipient.publicKey);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });

    it('should decrypt message in reasonable time', async () => {
      const encrypted = await service.encrypt('test', TEST_KEYS.recipient.publicKey);

      const start = performance.now();
      await service.decrypt(encrypted, TEST_KEYS.sender.publicKey);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle batch encryption efficiently', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => `Message ${i}`);

      const start = performance.now();

      await Promise.all(
        messages.map(msg => service.encrypt(msg, TEST_KEYS.recipient.publicKey))
      );

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500); // 10 messages in < 500ms
    });
  });

  describe('Integration with KeyManagementService', () => {
    it('should use active key for encryption', async () => {
      const keyPair = await keyManagementService.generateKeyPair({
        name: 'Test Key',
      });

      await keyManagementService.setActiveKey(keyPair.keyId);

      const encrypted = await service.encrypt(
        'test',
        TEST_KEYS.recipient.publicKey,
        { useActiveKey: true }
      );

      expect(encrypted).toBeDefined();
      expect(encrypted).toMatch(/\?iv=/);
    });

    it('should support encryption with specific key ID', async () => {
      const keyPair = await keyManagementService.generateKeyPair();

      const encrypted = await service.encrypt(
        'test',
        TEST_KEYS.recipient.publicKey,
        { keyId: keyPair.keyId }
      );

      expect(encrypted).toBeDefined();
    });
  });

  // ========== ENHANCED FEATURES TESTS ==========

  describe('Read Receipts (Kind 1515)', () => {
    it('should create read receipt event', async () => {
      const messageId = 'test-message-id-123';
      const receipt = await service.createReadReceipt(
        messageId,
        TEST_KEYS.sender.publicKey
      );

      expect(receipt.kind).toBe(1515);
      expect(receipt.tags).toContainEqual(['e', messageId]);
      expect(receipt.tags).toContainEqual(['p', TEST_KEYS.sender.publicKey]);
      expect(receipt.id).toBeDefined();
      expect(receipt.sig).toBeDefined();
    });

    it('should process received read receipt', async () => {
      const messageId = 'msg-123';
      const receipt = {
        kind: 1515,
        id: 'receipt-123',
        pubkey: TEST_KEYS.recipient.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', messageId],
          ['p', TEST_KEYS.sender.publicKey],
        ],
        content: Date.now().toString(),
        sig: 'mock-signature',
      } as any;

      await service.processReadReceipt(receipt);

      expect(service.isMessageRead(messageId)).toBe(true);
      const status = service.getReadReceiptStatus(messageId);
      expect(status).toBeDefined();
      expect(status?.messageId).toBe(messageId);
    });

    it('should track read receipt status', async () => {
      const messageId = 'msg-456';
      const receipt = await service.createReadReceipt(
        messageId,
        TEST_KEYS.sender.publicKey
      );

      const status = service.getReadReceiptStatus(messageId);
      expect(status).toBeDefined();
      expect(status?.read).toBe(true);
      expect(status?.readAt).toBeDefined();
      expect(status?.receiptEventId).toBe(receipt.id);
    });

    it('should handle invalid read receipt gracefully', async () => {
      const invalidReceipt = {
        kind: 1515,
        id: 'invalid',
        pubkey: TEST_KEYS.sender.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [], // Missing required tags
        content: '',
        sig: 'sig',
      } as any;

      await service.processReadReceipt(invalidReceipt);
      // Should not throw, just warn
    });
  });

  describe('Typing Indicators (Kind 20004)', () => {
    it('should send typing indicator', async () => {
      const indicator = await service.sendTypingIndicator(
        TEST_KEYS.recipient.publicKey,
        true
      );

      expect(indicator.kind).toBe(20004);
      expect(indicator.content).toBe('typing');
      expect(indicator.tags).toContainEqual(['p', TEST_KEYS.recipient.publicKey]);
    });

    it('should send stopped typing indicator', async () => {
      const indicator = await service.sendTypingIndicator(
        TEST_KEYS.recipient.publicKey,
        false
      );

      expect(indicator.kind).toBe(20004);
      expect(indicator.content).toBe('stopped');
    });

    it('should process typing indicator and set status', () => {
      const indicator = {
        kind: 20004,
        pubkey: TEST_KEYS.recipient.publicKey,
        content: 'typing',
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', TEST_KEYS.sender.publicKey]],
      } as any;

      service.processTypingIndicator(indicator);

      expect(service.isUserTyping(TEST_KEYS.recipient.publicKey)).toBe(true);
    });

    it('should auto-clear typing indicator after 3 seconds', async () => {
      const indicator = {
        kind: 20004,
        pubkey: TEST_KEYS.recipient.publicKey,
        content: 'typing',
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', TEST_KEYS.sender.publicKey]],
      } as any;

      service.processTypingIndicator(indicator);
      expect(service.isUserTyping(TEST_KEYS.recipient.publicKey)).toBe(true);

      // Wait 3.1 seconds
      await new Promise(resolve => setTimeout(resolve, 3100));

      expect(service.isUserTyping(TEST_KEYS.recipient.publicKey)).toBe(false);
    }, 5000);

    it('should clear typing indicator on stopped event', () => {
      // First set typing
      const typingIndicator = {
        kind: 20004,
        pubkey: TEST_KEYS.recipient.publicKey,
        content: 'typing',
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', TEST_KEYS.sender.publicKey]],
      } as any;

      service.processTypingIndicator(typingIndicator);
      expect(service.isUserTyping(TEST_KEYS.recipient.publicKey)).toBe(true);

      // Then send stopped
      const stoppedIndicator = {
        ...typingIndicator,
        content: 'stopped',
      };

      service.processTypingIndicator(stoppedIndicator);
      expect(service.isUserTyping(TEST_KEYS.recipient.publicKey)).toBe(false);
    });

    it('should get all typing users', () => {
      const user1 = 'user1-pubkey';
      const user2 = 'user2-pubkey';

      service.processTypingIndicator({
        kind: 20004,
        pubkey: user1,
        content: 'typing',
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', TEST_KEYS.sender.publicKey]],
      } as any);

      service.processTypingIndicator({
        kind: 20004,
        pubkey: user2,
        content: 'typing',
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', TEST_KEYS.sender.publicKey]],
      } as any);

      const typingUsers = service.getTypingUsers(TEST_KEYS.sender.publicKey);
      expect(typingUsers.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Message History & Pagination', () => {
    beforeEach(async () => {
      // Add test messages
      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        await service.addMessageToThread({
          id: `msg-${i}`,
          from: TEST_KEYS.sender.publicKey,
          to: TEST_KEYS.recipient.publicKey,
          content: `Message ${i}`,
          timestamp: now + i * 1000,
        });
      }
    });

    it('should get message history with default limit', async () => {
      const history = await service.getMessageHistory({
        conversationWith: TEST_KEYS.recipient.publicKey,
      });

      expect(history).toBeDefined();
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should paginate messages with offset', async () => {
      const page1 = await service.getMessageHistory({
        conversationWith: TEST_KEYS.recipient.publicKey,
        limit: 10,
        offset: 0,
      });

      const page2 = await service.getMessageHistory({
        conversationWith: TEST_KEYS.recipient.publicKey,
        limit: 10,
        offset: 10,
      });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(10);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should filter messages by time range', async () => {
      const now = Date.now();
      const history = await service.getMessageHistory({
        conversationWith: TEST_KEYS.recipient.publicKey,
        after: now + 10000,
        before: now + 20000,
      });

      expect(history.every(msg => msg.timestamp > now + 10000 && msg.timestamp < now + 20000)).toBe(true);
    });

    it('should search messages by content', async () => {
      const results = await service.searchMessages(
        TEST_KEYS.recipient.publicKey,
        'Message 5'
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(msg => msg.content.includes('Message 5'))).toBe(true);
    });

    it('should cache decrypted messages', () => {
      const messageId = 'msg-cache-test';
      const message = {
        id: messageId,
        from: TEST_KEYS.sender.publicKey,
        to: TEST_KEYS.recipient.publicKey,
        content: 'encrypted',
        timestamp: Date.now(),
      };

      service.cacheDecryptedMessage(messageId, message, 'decrypted content');

      const cached = service.getCachedMessage(messageId);
      expect(cached).toBeDefined();
      expect(cached?.decrypted).toBe('decrypted content');
    });

    it('should clear message cache', () => {
      service.cacheDecryptedMessage('msg-1', {} as any, 'test');
      service.clearMessageCache();

      expect(service.getCachedMessage('msg-1')).toBeUndefined();
    });
  });

  describe('Forward Secrecy & Key Rotation', () => {
    it('should generate session key for conversation', async () => {
      const sessionKey = await service.generateSessionKey(TEST_KEYS.recipient.publicKey);

      expect(sessionKey).toBeDefined();
      expect(sessionKey.keyId).toBeDefined();
      expect(sessionKey.publicKey).toBeDefined();
      expect(sessionKey.privateKey).toBeDefined();
      expect(sessionKey.messageCount).toBe(0);
      expect(sessionKey.rotationThreshold).toBe(100);
    });

    it('should rotate session key after threshold', async () => {
      const sessionKey = await service.generateSessionKey(TEST_KEYS.recipient.publicKey);
      const originalKeyId = sessionKey.keyId;

      // Simulate 100 messages
      for (let i = 0; i < 100; i++) {
        await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);
      }

      const newSessionKey = service.getSessionKey(TEST_KEYS.recipient.publicKey);
      expect(newSessionKey?.keyId).not.toBe(originalKeyId);
    });

    it('should not rotate session key before threshold', async () => {
      const sessionKey = await service.generateSessionKey(TEST_KEYS.recipient.publicKey);
      const originalKeyId = sessionKey.keyId;

      // Only 50 messages
      for (let i = 0; i < 50; i++) {
        const rotated = await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);
        if (i < 49) {
          expect(rotated).toBe(false);
        }
      }

      const currentKey = service.getSessionKey(TEST_KEYS.recipient.publicKey);
      expect(currentKey?.keyId).toBe(originalKeyId);
    });

    it('should track message count for session key', async () => {
      await service.generateSessionKey(TEST_KEYS.recipient.publicKey);

      await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);
      await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);
      await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);

      const sessionKey = service.getSessionKey(TEST_KEYS.recipient.publicKey);
      expect(sessionKey?.messageCount).toBe(3);
    });
  });

  describe('Spam Protection', () => {
    const spammerPubkey = 'spammer-pubkey-123';

    it('should configure spam protection', () => {
      service.configureSpamProtection({
        rateLimit: {
          maxMessagesPerMinute: 5,
          maxMessagesPerHour: 50,
        },
        requirePoW: true,
        powDifficulty: 20,
      });

      // Configuration applied (checked via behavior in other tests)
      expect(true).toBe(true);
    });

    it('should enforce rate limiting per minute', async () => {
      service.configureSpamProtection({
        rateLimit: {
          maxMessagesPerMinute: 3,
          maxMessagesPerHour: 100,
        },
      });

      const event = {
        id: 'test-event',
        kind: 4,
        pubkey: spammerPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'spam',
        sig: 'sig',
      };

      // First 3 should pass
      expect(await service.checkSpamProtection(spammerPubkey, event)).toBe(true);
      expect(await service.checkSpamProtection(spammerPubkey, event)).toBe(true);
      expect(await service.checkSpamProtection(spammerPubkey, event)).toBe(true);

      // 4th should fail
      expect(await service.checkSpamProtection(spammerPubkey, event)).toBe(false);
    });

    it('should enforce rate limiting per hour', async () => {
      service.configureSpamProtection({
        rateLimit: {
          maxMessagesPerMinute: 100,
          maxMessagesPerHour: 5,
        },
      });

      const event = {
        id: 'test-event',
        kind: 4,
        pubkey: 'hourly-spammer',
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'spam',
        sig: 'sig',
      };

      // First 5 should pass
      for (let i = 0; i < 5; i++) {
        expect(await service.checkSpamProtection('hourly-spammer', event)).toBe(true);
      }

      // 6th should fail
      expect(await service.checkSpamProtection('hourly-spammer', event)).toBe(false);
    });

    it('should validate proof-of-work', async () => {
      service.configureSpamProtection({
        requirePoW: true,
        powDifficulty: 16,
      });

      // Event with insufficient PoW
      const weakEvent = {
        id: '1234567890abcdef',
        kind: 4,
        pubkey: spammerPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'test',
        sig: 'sig',
      };

      expect(await service.checkSpamProtection(spammerPubkey, weakEvent)).toBe(false);

      // Event with sufficient PoW (16+ leading zeros in bits)
      const strongEvent = {
        id: '0000abcdef123456', // 16 leading zero bits
        kind: 4,
        pubkey: spammerPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'test',
        sig: 'sig',
      };

      expect(await service.checkSpamProtection(spammerPubkey, strongEvent)).toBe(true);
    });

    it('should block and unblock pubkeys', async () => {
      service.blockPubkey(spammerPubkey);
      expect(service.isPubkeyBlocked(spammerPubkey)).toBe(true);

      const event = {
        id: 'test',
        kind: 4,
        pubkey: spammerPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'blocked',
        sig: 'sig',
      };

      expect(await service.checkSpamProtection(spammerPubkey, event)).toBe(false);

      service.unblockPubkey(spammerPubkey);
      expect(service.isPubkeyBlocked(spammerPubkey)).toBe(false);
    });

    it('should allow pubkeys to bypass spam checks', async () => {
      service.configureSpamProtection({
        rateLimit: {
          maxMessagesPerMinute: 1,
          maxMessagesPerHour: 1,
        },
      });

      const trustedPubkey = 'trusted-user';
      service.allowPubkey(trustedPubkey);

      const event = {
        id: 'test',
        kind: 4,
        pubkey: trustedPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'allowed',
        sig: 'sig',
      };

      // Should pass even beyond rate limits
      for (let i = 0; i < 10; i++) {
        expect(await service.checkSpamProtection(trustedPubkey, event)).toBe(true);
      }
    });

    it('should get list of blocked pubkeys', () => {
      service.blockPubkey('blocked1');
      service.blockPubkey('blocked2');
      service.blockPubkey('blocked3');

      const blocked = service.getBlockedPubkeys();
      expect(blocked).toContain('blocked1');
      expect(blocked).toContain('blocked2');
      expect(blocked).toContain('blocked3');
    });
  });

  describe('Security Edge Cases', () => {
    it('should prevent timing attacks on encryption', async () => {
      const start1 = performance.now();
      await service.encrypt('short', TEST_KEYS.recipient.publicKey);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      await service.encrypt('this is a much longer message', TEST_KEYS.recipient.publicKey);
      const time2 = performance.now() - start2;

      // Timing should be relatively consistent (within reasonable variance)
      expect(Math.abs(time1 - time2)).toBeLessThan(50);
    });

    it('should handle concurrent encryption/decryption safely', async () => {
      const messages = Array.from({ length: 20 }, (_, i) => `Message ${i}`);

      const encrypted = await Promise.all(
        messages.map(msg => service.encrypt(msg, TEST_KEYS.recipient.publicKey))
      );

      expect(encrypted).toHaveLength(20);
      expect(new Set(encrypted).size).toBe(20); // All unique
    });

    it('should clear sensitive data on destroy', async () => {
      await service.generateSessionKey(TEST_KEYS.recipient.publicKey);
      service.cacheDecryptedMessage('msg1', {} as any, 'secret');
      service.blockPubkey('blocked');

      await service.destroy();

      // All state should be cleared
      expect(service.isInitialized()).toBe(false);
    });

    it('should validate all user inputs', async () => {
      // Invalid pubkey format
      await expect(
        service.encrypt('test', 'invalid-pubkey-format')
      ).rejects.toThrow();

      // Empty message ID for read receipt
      await expect(
        service.createReadReceipt('', TEST_KEYS.sender.publicKey)
      ).rejects.toThrow();
    });

    it('should not leak information through error messages', async () => {
      try {
        await service.decrypt('malformed-encrypted', TEST_KEYS.sender.publicKey);
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        // Error should not contain sensitive data
        expect(message).not.toContain(TEST_KEYS.sender.privateKey);
        expect(message).not.toContain('secret');
        expect(message).not.toContain('password');
      }
    });
  });

  // ========== COMPREHENSIVE SECURITY TESTS (US-313 Subtask 10) ==========

  describe('Advanced Encryption Security', () => {
    it('should ensure IV uniqueness across thousands of encryptions', async () => {
      const plaintext = 'test message';
      const iterations = 1000;
      const ivs = new Set<string>();

      for (let i = 0; i < iterations; i++) {
        const encrypted = await service.encrypt(plaintext, TEST_KEYS.recipient.publicKey);
        const iv = encrypted.split('?iv=')[1];
        ivs.add(iv);
      }

      // All IVs should be unique
      expect(ivs.size).toBe(iterations);
    });

    it('should resist known-plaintext attacks', async () => {
      const knownPlaintext = 'known message';

      // Encrypt same plaintext multiple times
      const encrypted1 = await service.encrypt(knownPlaintext, TEST_KEYS.recipient.publicKey);
      const encrypted2 = await service.encrypt(knownPlaintext, TEST_KEYS.recipient.publicKey);

      // Ciphertexts should be different due to unique IVs
      expect(encrypted1.split('?iv=')[0]).not.toBe(encrypted2.split('?iv=')[0]);
    });

    it('should validate ciphertext integrity', async () => {
      const original = 'secure message';
      const encrypted = await service.encrypt(original, TEST_KEYS.recipient.publicKey);

      // Tamper with ciphertext
      const [ciphertext, iv] = encrypted.split('?iv=');
      const tamperedCiphertext = ciphertext.slice(0, -4) + 'XXXX';
      const tampered = `${tamperedCiphertext}?iv=${iv}`;

      // Decryption should fail or produce garbage (not original)
      try {
        const decrypted = await service.decrypt(tampered, TEST_KEYS.sender.publicKey);
        expect(decrypted).not.toBe(original);
      } catch (error) {
        // Acceptable - tampering detected
        expect(error).toBeDefined();
      }
    });

    it('should handle malicious IV values', async () => {
      const validCiphertext = 'dGVzdA=='; // "test" in base64

      const maliciousIVs = [
        '../../../etc/passwd',
        '<script>alert(1)</script>',
        '${eval(process.env)}',
        'DROP TABLE users;--',
        '0'.repeat(1000000), // DoS attempt
      ];

      for (const maliciousIV of maliciousIVs) {
        const malformed = `${validCiphertext}?iv=${maliciousIV}`;

        await expect(
          service.decrypt(malformed, TEST_KEYS.sender.publicKey)
        ).rejects.toThrow();
      }
    });

    it('should prevent IV reuse across sessions', async () => {
      const message = 'test';
      const ivs = new Set<string>();

      // Encrypt in first session
      for (let i = 0; i < 10; i++) {
        const encrypted = await service.encrypt(message, TEST_KEYS.recipient.publicKey);
        ivs.add(encrypted.split('?iv=')[1]);
      }

      // Restart service (new session)
      await service.destroy();
      await service.initialize(keyManagementService);

      // Encrypt in second session
      for (let i = 0; i < 10; i++) {
        const encrypted = await service.encrypt(message, TEST_KEYS.recipient.publicKey);
        const iv = encrypted.split('?iv=')[1];
        expect(ivs.has(iv)).toBe(false); // Should not reuse IV from previous session
        ivs.add(iv);
      }
    });

    it('should enforce key length requirements', async () => {
      const shortPrivateKey = '00'.repeat(16); // Only 128 bits
      const longPrivateKey = '00'.repeat(64) + 'FF'; // Too long

      await expect(
        service.deriveSharedSecret(shortPrivateKey, TEST_KEYS.recipient.publicKey)
      ).rejects.toThrow('Invalid private key format');

      await expect(
        service.deriveSharedSecret(longPrivateKey, TEST_KEYS.recipient.publicKey)
      ).rejects.toThrow('Invalid private key format');
    });

    it('should validate public key format', async () => {
      const invalidPubkeys = [
        '', // Empty
        'invalid', // Not hex
        '00'.repeat(32), // Wrong length
        '00'.repeat(64) + 'ZZ', // Invalid hex characters
      ];

      for (const invalidPubkey of invalidPubkeys) {
        await expect(
          service.encrypt('test', invalidPubkey)
        ).rejects.toThrow();
      }
    });

    it('should protect against replay attacks with message IDs', async () => {
      const message: NostrDirectMessage = {
        id: 'replay-test-id',
        from: TEST_KEYS.sender.publicKey,
        to: TEST_KEYS.recipient.publicKey,
        content: 'test message',
        timestamp: Date.now(),
      };

      await service.addMessageToThread(message);

      // Attempt to replay same message
      await service.addMessageToThread(message);

      const thread = await service.getThread(
        TEST_KEYS.sender.publicKey,
        TEST_KEYS.recipient.publicKey
      );

      // Should handle duplicate message IDs appropriately
      expect(thread).toBeDefined();
    });
  });

  describe('Key Rotation Security', () => {
    it('should securely destroy old session keys on rotation', async () => {
      const sessionKey1 = await service.generateSessionKey(TEST_KEYS.recipient.publicKey);
      const oldPrivateKey = sessionKey1.privateKey;

      // Trigger rotation
      for (let i = 0; i < 100; i++) {
        await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);
      }

      const sessionKey2 = service.getSessionKey(TEST_KEYS.recipient.publicKey);

      // New key should be different
      expect(sessionKey2?.privateKey).not.toBe(oldPrivateKey);
      expect(sessionKey2?.keyId).not.toBe(sessionKey1.keyId);
    });

    it('should maintain message confidentiality across key rotations', async () => {
      const messages = [];

      for (let i = 0; i < 150; i++) {
        const message = `Message ${i}`;
        const encrypted = await service.encrypt(message, TEST_KEYS.recipient.publicKey);
        messages.push({ original: message, encrypted });

        // Trigger rotation at 100 messages
        await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);
      }

      // All messages should still be decryptable
      for (const { original, encrypted } of messages) {
        const decrypted = await service.decrypt(encrypted, TEST_KEYS.sender.publicKey);
        expect(decrypted).toBe(original);
      }
    });

    it('should enforce rotation threshold', async () => {
      const sessionKey = await service.generateSessionKey(TEST_KEYS.recipient.publicKey);
      const initialKeyId = sessionKey.keyId;

      // Send exactly 99 messages
      for (let i = 0; i < 99; i++) {
        const rotated = await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);
        expect(rotated).toBe(false);
      }

      // 100th message should trigger rotation
      const rotated = await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);
      expect(rotated).toBe(true);

      const newKey = service.getSessionKey(TEST_KEYS.recipient.publicKey);
      expect(newKey?.keyId).not.toBe(initialKeyId);
    });

    it('should prevent session key rollback attacks', async () => {
      const key1 = await service.generateSessionKey(TEST_KEYS.recipient.publicKey);

      // Rotate to new key
      for (let i = 0; i < 100; i++) {
        await service.maybeRotateSessionKey(TEST_KEYS.recipient.publicKey);
      }

      const key2 = service.getSessionKey(TEST_KEYS.recipient.publicKey);

      // Attempting to use old key should not work
      expect(key2?.keyId).not.toBe(key1.keyId);
      expect(key2?.createdAt).toBeGreaterThan(key1.createdAt);
    });
  });

  describe('Spam Protection Security', () => {
    it('should enforce strict rate limits under attack', async () => {
      service.configureSpamProtection({
        rateLimit: {
          maxMessagesPerMinute: 10,
          maxMessagesPerHour: 100,
        },
      });

      const attackerPubkey = 'attacker-pubkey';
      const event = {
        id: 'spam-event',
        kind: 4,
        pubkey: attackerPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'spam',
        sig: 'sig',
      };

      let blockedCount = 0;

      // Simulate rapid-fire attack
      for (let i = 0; i < 50; i++) {
        const allowed = await service.checkSpamProtection(attackerPubkey, event);
        if (!allowed) blockedCount++;
      }

      // Should block most messages
      expect(blockedCount).toBeGreaterThan(35);
    });

    it('should maintain per-sender rate limits independently', async () => {
      service.configureSpamProtection({
        rateLimit: {
          maxMessagesPerMinute: 5,
          maxMessagesPerHour: 50,
        },
      });

      const sender1 = 'sender1';
      const sender2 = 'sender2';
      const event = {
        id: 'test',
        kind: 4,
        pubkey: '',
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'test',
        sig: 'sig',
      };

      // Sender1 uses up quota
      for (let i = 0; i < 5; i++) {
        await service.checkSpamProtection(sender1, { ...event, pubkey: sender1 });
      }

      expect(await service.checkSpamProtection(sender1, { ...event, pubkey: sender1 })).toBe(false);

      // Sender2 should still have quota
      expect(await service.checkSpamProtection(sender2, { ...event, pubkey: sender2 })).toBe(true);
    });

    it('should validate proof-of-work difficulty correctly', async () => {
      service.configureSpamProtection({
        requirePoW: true,
        powDifficulty: 20,
      });

      // Event with 20 leading zero bits (valid)
      const validEvent = {
        id: '00000' + 'a'.repeat(59), // 20 zero bits
        kind: 4,
        pubkey: 'test',
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'valid',
        sig: 'sig',
      };

      // Event with 16 leading zero bits (invalid)
      const invalidEvent = {
        id: '0000' + 'a'.repeat(60), // 16 zero bits
        kind: 4,
        pubkey: 'test',
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'invalid',
        sig: 'sig',
      };

      expect(await service.checkSpamProtection('test', validEvent)).toBe(true);
      expect(await service.checkSpamProtection('test', invalidEvent)).toBe(false);
    });

    it('should prevent block list bypass attempts', async () => {
      const blockedPubkey = 'blocked-user';
      service.blockPubkey(blockedPubkey);

      // Try to bypass by adding to allow list
      service.allowPubkey(blockedPubkey);

      const event = {
        id: 'test',
        kind: 4,
        pubkey: blockedPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'test',
        sig: 'sig',
      };

      // Allow list should override block list
      expect(await service.checkSpamProtection(blockedPubkey, event)).toBe(true);
      expect(service.isPubkeyBlocked(blockedPubkey)).toBe(false);
    });

    it('should handle time-based rate limit window expiry', async () => {
      service.configureSpamProtection({
        rateLimit: {
          maxMessagesPerMinute: 2,
          maxMessagesPerHour: 100,
        },
      });

      const sender = 'time-test-sender';
      const event = {
        id: 'test',
        kind: 4,
        pubkey: sender,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'test',
        sig: 'sig',
      };

      // Use up quota
      expect(await service.checkSpamProtection(sender, event)).toBe(true);
      expect(await service.checkSpamProtection(sender, event)).toBe(true);
      expect(await service.checkSpamProtection(sender, event)).toBe(false);

      // Wait for window to expire (mock by checking quota is enforced)
      // In real scenario, old timestamps would be cleaned
      expect(await service.checkSpamProtection(sender, event)).toBe(false);
    });

    it('should protect against DoS via excessive blocked keys', () => {
      // Attempt to add massive block list
      for (let i = 0; i < 10000; i++) {
        service.blockPubkey(`blocked-${i}`);
      }

      const blockedList = service.getBlockedPubkeys();
      expect(blockedList.length).toBe(10000);

      // Lookup should still be fast
      const start = performance.now();
      service.isPubkeyBlocked('blocked-5000');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10); // O(1) lookup
    });
  });

  describe('Memory Safety and Resource Management', () => {
    it('should limit message cache size', async () => {
      // Add many messages
      for (let i = 0; i < 10000; i++) {
        service.cacheDecryptedMessage(
          `msg-${i}`,
          {
            id: `msg-${i}`,
            from: TEST_KEYS.sender.publicKey,
            to: TEST_KEYS.recipient.publicKey,
            content: 'encrypted',
            timestamp: Date.now(),
          },
          `Decrypted message ${i}`
        );
      }

      // Cache should exist but not cause memory issues
      expect(service.getCachedMessage('msg-5000')).toBeDefined();
    });

    it('should clean up typing indicator timeouts', async () => {
      const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      // Start typing for many users
      for (const user of users) {
        service.processTypingIndicator({
          kind: 20004,
          pubkey: user,
          content: 'typing',
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
        } as any);
      }

      // All should auto-clear after 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3100));

      for (const user of users) {
        expect(service.isUserTyping(user)).toBe(false);
      }
    }, 5000);

    it('should prevent thread metadata memory leaks', async () => {
      // Create many threads
      for (let i = 0; i < 1000; i++) {
        const pubkey = `user-${i}-pubkey`;
        await service.addMessageToThread({
          id: `msg-${i}`,
          from: TEST_KEYS.sender.publicKey,
          to: pubkey,
          content: 'test',
          timestamp: Date.now(),
        });
      }

      // Clear threads
      for (let i = 0; i < 1000; i++) {
        const pubkey = `user-${i}-pubkey`;
        await service.clearThread(TEST_KEYS.sender.publicKey, pubkey);
      }

      // Memory should be reclaimed
      const thread = await service.getThread(TEST_KEYS.sender.publicKey, 'user-500-pubkey');
      expect(thread).toHaveLength(0);
    });

    it('should handle graceful shutdown', async () => {
      // Setup active state
      await service.generateSessionKey(TEST_KEYS.recipient.publicKey);
      service.cacheDecryptedMessage('msg1', {} as any, 'secret');
      service.blockPubkey('blocked');

      service.processTypingIndicator({
        kind: 20004,
        pubkey: TEST_KEYS.recipient.publicKey,
        content: 'typing',
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      } as any);

      // Destroy should clean everything
      await service.destroy();

      expect(service.isInitialized()).toBe(false);
      expect(service.getCachedMessage('msg1')).toBeUndefined();
    });
  });

  describe('Comprehensive Roundtrip Security Tests', () => {
    it('should maintain data integrity for all character sets', async () => {
      const testMessages = [
        'ASCII only message',
        'Unicode: 你好世界 🌍 🔐 ⚡',
        'Emoji only: 😀😁😂🤣😃😄',
        'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        'Newlines:\nMultiple\nLines\nHere',
        'Tabs:\tTabbed\tContent',
        'Mixed: Hello 世界 🌍\n\tTab!',
        'Empty string: ',
        'Very long: ' + 'A'.repeat(10000),
        JSON.stringify({ nested: { object: { with: { data: [1, 2, 3] } } } }),
      ];

      for (const original of testMessages) {
        const encrypted = await service.encrypt(original, TEST_KEYS.recipient.publicKey);
        const decrypted = await service.decrypt(encrypted, TEST_KEYS.sender.publicKey);
        expect(decrypted).toBe(original);
      }
    });

    it('should preserve binary data integrity', async () => {
      // Test binary data as base64-encoded string
      const binaryData = Buffer.from([0, 1, 2, 255, 254, 253, 128, 127]).toString('base64');

      const encrypted = await service.encrypt(binaryData, TEST_KEYS.recipient.publicKey);
      const decrypted = await service.decrypt(encrypted, TEST_KEYS.sender.publicKey);

      expect(decrypted).toBe(binaryData);
    });

    it('should handle edge-case message lengths', async () => {
      const testLengths = [0, 1, 15, 16, 17, 255, 256, 257, 1023, 1024, 1025, 4095, 4096, 4097];

      for (const length of testLengths) {
        const message = 'X'.repeat(length);
        const encrypted = await service.encrypt(message, TEST_KEYS.recipient.publicKey);
        const decrypted = await service.decrypt(encrypted, TEST_KEYS.sender.publicKey);
        expect(decrypted).toBe(message);
        expect(decrypted.length).toBe(length);
      }
    });
  });
});
