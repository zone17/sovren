/**
 * KeyManagementService Tests - TDD Implementation
 * US-315: Centralized Key Management Service
 *
 * Test Coverage:
 * - Key generation with entropy validation
 * - Key import/export (nsec, hex, mnemonic)
 * - Browser extension detection and integration
 * - Secure storage (IndexedDB with AES-256-GCM encryption)
 * - Event signing (local and extension)
 * - Key validation
 * - Security features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyManagementService } from '../KeyManagementService';
import type {
  NostrEnhancedKeyPair,
  NostrKeyManagementConfig,
  NostrBrowserExtension,
} from '@sovren/shared/types/nostr-key-management';

// Mock IndexedDB
const mockIndexedDB = {
  databases: new Map<string, any>(),
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

// Mock WebCrypto API
const mockCrypto = {
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    generateKey: vi.fn(),
    exportKey: vi.fn(),
    importKey: vi.fn(),
    deriveBits: vi.fn(),
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
};

// Mock window.nostr (browser extension)
const mockNostrExtension = {
  getPublicKey: vi.fn(),
  signEvent: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  getRelays: vi.fn(),
};

describe('KeyManagementService', () => {
  let service: KeyManagementService;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup global mocks
    global.crypto = mockCrypto as any;
    global.indexedDB = mockIndexedDB as any;

    // Create fresh service instance
    service = KeyManagementService.getInstance();
    await service.initialize();
  });

  afterEach(async () => {
    // Cleanup
    await service.destroy();
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = KeyManagementService.getInstance();
      const instance2 = KeyManagementService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should prevent direct instantiation', () => {
      expect(() => new (KeyManagementService as any)()).toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      const config = service.getConfig();

      expect(config.encryptionEnabled).toBe(true);
      expect(config.defaultSecurityLevel).toBe('enhanced');
      expect(config.defaultStorageType).toBe('indexed_db');
    });

    it('should allow custom configuration', async () => {
      const customConfig: Partial<NostrKeyManagementConfig> = {
        encryptionEnabled: false,
        defaultSecurityLevel: 'maximum',
      };

      await service.initialize(customConfig);
      const config = service.getConfig();

      expect(config.encryptionEnabled).toBe(false);
      expect(config.defaultSecurityLevel).toBe('maximum');
    });

    it('should restore state from IndexedDB on initialization', async () => {
      // This will be implemented once storage is ready
      expect(service.isInitialized()).toBe(true);
    });
  });

  describe('Key Generation', () => {
    it('should generate a valid NOSTR key pair', async () => {
      const keyPair = await service.generateKeyPair();

      expect(keyPair.privateKey).toHaveLength(64);
      expect(keyPair.publicKey).toHaveLength(64);
      expect(keyPair.nsec).toMatch(/^nsec1/);
      expect(keyPair.npub).toMatch(/^npub1/);
      expect(keyPair.entropyBits).toBeGreaterThanOrEqual(128);
    });

    it('should generate unique key pairs on each call', async () => {
      const keyPair1 = await service.generateKeyPair();
      const keyPair2 = await service.generateKeyPair();

      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    });

    it('should validate entropy meets minimum requirements', async () => {
      const keyPair = await service.generateKeyPair();

      expect(keyPair.entropyBits).toBeGreaterThanOrEqual(128);
      expect(keyPair.entropySource).toBeDefined();
    });

    it('should create key with proper metadata', async () => {
      const keyPair = await service.generateKeyPair({
        name: 'Test Key',
        description: 'Testing key generation',
      });

      expect(keyPair.name).toBe('Test Key');
      expect(keyPair.description).toBe('Testing key generation');
      expect(keyPair.keyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(keyPair.created).toBeGreaterThan(0);
    });

    it('should throw error if entropy is insufficient', async () => {
      // Mock low entropy
      mockCrypto.getRandomValues = vi.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = 1; // Low entropy
        }
        return arr;
      });

      await expect(service.generateKeyPair()).rejects.toThrow('Insufficient entropy');
    });
  });

  describe('Key Import', () => {
    it('should import key from nsec format', async () => {
      const testNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

      const keyPair = await service.importKey(testNsec);

      expect(keyPair.nsec).toBe(testNsec);
      expect(keyPair.privateKey).toHaveLength(64);
      expect(keyPair.publicKey).toHaveLength(64);
      expect(keyPair.npub).toMatch(/^npub1/);
    });

    it('should import key from hex private key', async () => {
      const testHex = '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa';

      const keyPair = await service.importKey(testHex, 'hex');

      expect(keyPair.privateKey).toBe(testHex);
      expect(keyPair.publicKey).toHaveLength(64);
    });

    it('should throw error for invalid nsec format', async () => {
      const invalidNsec = 'invalid-nsec-format';

      await expect(service.importKey(invalidNsec)).rejects.toThrow('Invalid nsec format');
    });

    it('should throw error for invalid hex format', async () => {
      const invalidHex = 'not-a-hex-string';

      await expect(service.importKey(invalidHex, 'hex')).rejects.toThrow('Invalid hex format');
    });

    it('should import with metadata', async () => {
      const testNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

      const keyPair = await service.importKey(testNsec, 'nsec', {
        name: 'Imported Key',
        tags: ['imported', 'test'],
      });

      expect(keyPair.name).toBe('Imported Key');
      expect(keyPair.tags).toContain('imported');
    });
  });

  describe('Key Export', () => {
    it('should export key as nsec', async () => {
      const keyPair = await service.generateKeyPair();

      const exported = await service.exportKey(keyPair.keyId, 'nsec');

      expect(exported).toMatch(/^nsec1/);
      expect(exported).toBe(keyPair.nsec);
    });

    it('should export key as hex', async () => {
      const keyPair = await service.generateKeyPair();

      const exported = await service.exportKey(keyPair.keyId, 'hex');

      expect(exported).toHaveLength(64);
      expect(exported).toBe(keyPair.privateKey);
    });

    it('should export key as npub (public only)', async () => {
      const keyPair = await service.generateKeyPair();

      const exported = await service.exportKey(keyPair.keyId, 'npub');

      expect(exported).toMatch(/^npub1/);
      expect(exported).toBe(keyPair.npub);
    });

    it('should throw error when exporting non-existent key', async () => {
      const fakeKeyId = '00000000-0000-0000-0000-000000000000';

      await expect(service.exportKey(fakeKeyId, 'nsec')).rejects.toThrow('Key not found');
    });

    it('should log security warning when exporting private key', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const keyPair = await service.generateKeyPair();

      await service.exportKey(keyPair.keyId, 'nsec');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Exporting private key')
      );
    });
  });

  describe('Browser Extension Integration', () => {
    it('should detect available browser extension', async () => {
      // Mock window.nostr
      (global as any).window = {
        nostr: mockNostrExtension,
      };

      const detected = await service.detectBrowserExtension();

      expect(detected.available).toBe(true);
    });

    it('should return false when no extension available', async () => {
      (global as any).window = {};

      const detected = await service.detectBrowserExtension();

      expect(detected.available).toBe(false);
    });

    it('should connect to browser extension and get public key', async () => {
      const testPubkey = 'd61f3bc5b3eb4400efdae6169a5c126311d3a50c2f78a3c4ee5a6fc1bf46dd8e';
      mockNostrExtension.getPublicKey.mockResolvedValue(testPubkey);

      (global as any).window = {
        nostr: mockNostrExtension,
      };

      const extension = await service.connectBrowserExtension();

      expect(extension.available).toBe(true);
      expect(extension.enabled).toBe(true);
      expect(extension.publicKey).toBe(testPubkey);
    });

    it('should handle extension connection errors gracefully', async () => {
      mockNostrExtension.getPublicKey.mockRejectedValue(new Error('User denied access'));

      (global as any).window = {
        nostr: mockNostrExtension,
      };

      const extension = await service.connectBrowserExtension();

      expect(extension.available).toBe(true);
      expect(extension.enabled).toBe(false);
    });

    it('should identify extension type (Alby, nos2x, etc.)', async () => {
      const testPubkey = 'd61f3bc5b3eb4400efdae6169a5c126311d3a50c2f78a3c4ee5a6fc1bf46dd8e';
      mockNostrExtension.getPublicKey.mockResolvedValue(testPubkey);

      (global as any).window = {
        nostr: {
          ...mockNostrExtension,
          _metadata: { name: 'Alby' },
        },
      };

      const extension = await service.detectBrowserExtension();

      expect(extension.extensionName).toMatch(/alby|nos2x|nostore/i);
    });
  });

  describe('Event Signing', () => {
    it('should sign event with local key', async () => {
      const keyPair = await service.generateKeyPair();

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Test message',
        pubkey: keyPair.publicKey,
      };

      const signed = await service.signEvent(keyPair.keyId, event);

      expect(signed.id).toBeDefined();
      expect(signed.sig).toHaveLength(128);
      expect(signed.pubkey).toBe(keyPair.publicKey);
    });

    it('should sign event with browser extension when available', async () => {
      const testPubkey = 'd61f3bc5b3eb4400efdae6169a5c126311d3a50c2f78a3c4ee5a6fc1bf46dd8e';
      const signedEvent = {
        id: 'event-id',
        sig: 'signature',
        pubkey: testPubkey,
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Test',
      };

      mockNostrExtension.getPublicKey.mockResolvedValue(testPubkey);
      mockNostrExtension.signEvent.mockResolvedValue(signedEvent);

      (global as any).window = {
        nostr: mockNostrExtension,
      };

      await service.connectBrowserExtension();

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Test',
        pubkey: testPubkey,
      };

      const signed = await service.signEvent('extension', event);

      expect(mockNostrExtension.signEvent).toHaveBeenCalled();
      expect(signed.sig).toBe('signature');
    });

    it('should verify signature after signing', async () => {
      const keyPair = await service.generateKeyPair();

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Test message',
        pubkey: keyPair.publicKey,
      };

      const signed = await service.signEvent(keyPair.keyId, event);
      const isValid = await service.verifyEventSignature(signed);

      expect(isValid).toBe(true);
    });

    it('should throw error when signing with non-existent key', async () => {
      const fakeKeyId = '00000000-0000-0000-0000-000000000000';

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Test',
        pubkey: 'fake-pubkey',
      };

      await expect(service.signEvent(fakeKeyId, event)).rejects.toThrow('Key not found');
    });
  });

  describe('Key Validation', () => {
    it('should validate correct key pair', async () => {
      const keyPair = await service.generateKeyPair();

      const validation = await service.validateKey(keyPair.keyId);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.securityScore).toBeGreaterThan(80);
    });

    it('should detect invalid public/private key relationship', async () => {
      // This will be tested once we have key corruption scenarios
      expect(true).toBe(true);
    });

    it('should validate key format (nsec, npub, hex)', async () => {
      const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
      const invalidNsec = 'invalid-nsec';

      expect(service.validateKeyFormat(validNsec, 'nsec')).toBe(true);
      expect(service.validateKeyFormat(invalidNsec, 'nsec')).toBe(false);
    });

    it('should calculate security score based on key properties', async () => {
      const keyPair = await service.generateKeyPair();

      const validation = await service.validateKey(keyPair.keyId);

      expect(validation.securityScore).toBeGreaterThanOrEqual(0);
      expect(validation.securityScore).toBeLessThanOrEqual(100);
    });

    it('should provide security recommendations', async () => {
      const keyPair = await service.generateKeyPair();

      const validation = await service.validateKey(keyPair.keyId);

      expect(Array.isArray(validation.recommendations)).toBe(true);
    });
  });

  describe('Secure Storage (IndexedDB)', () => {
    it('should store encrypted key in IndexedDB', async () => {
      const keyPair = await service.generateKeyPair();

      // Verify encryption was called
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
    });

    it('should retrieve and decrypt key from IndexedDB', async () => {
      const keyPair = await service.generateKeyPair();
      const keyId = keyPair.keyId;

      // Destroy and reinitialize service
      await service.destroy();
      const newService = KeyManagementService.getInstance();
      await newService.initialize();

      const retrieved = await newService.getKey(keyId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.publicKey).toBe(keyPair.publicKey);
    });

    it('should use AES-256-GCM for encryption', async () => {
      await service.generateKeyPair();

      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
        }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should never store unencrypted private keys', async () => {
      const keyPair = await service.generateKeyPair();

      // Check that raw private key is not in storage
      // This will be verified in implementation
      expect(keyPair.encrypted).toBe(true);
    });

    it('should handle storage quota exceeded error', async () => {
      // Mock quota exceeded error
      mockIndexedDB.open.mockRejectedValue(new Error('QuotaExceededError'));

      await expect(service.generateKeyPair()).rejects.toThrow('Storage quota exceeded');
    });
  });

  describe('Session Management', () => {
    it('should cache active key in session', async () => {
      const keyPair = await service.generateKeyPair();

      await service.setActiveKey(keyPair.keyId);
      const activeKey = service.getActiveKey();

      expect(activeKey?.keyId).toBe(keyPair.keyId);
    });

    it('should clear session cache on logout', async () => {
      const keyPair = await service.generateKeyPair();
      await service.setActiveKey(keyPair.keyId);

      await service.clearSession();
      const activeKey = service.getActiveKey();

      expect(activeKey).toBeNull();
    });

    it('should persist active key preference', async () => {
      const keyPair = await service.generateKeyPair();
      await service.setActiveKey(keyPair.keyId);

      // Reinitialize
      await service.destroy();
      const newService = KeyManagementService.getInstance();
      await newService.initialize();

      const activeKey = newService.getActiveKey();
      expect(activeKey?.keyId).toBe(keyPair.keyId);
    });
  });

  describe('Key Lifecycle', () => {
    it('should list all stored keys', async () => {
      await service.generateKeyPair({ name: 'Key 1' });
      await service.generateKeyPair({ name: 'Key 2' });

      const keys = await service.listKeys();

      expect(keys).toHaveLength(2);
      expect(keys.map(k => k.name)).toContain('Key 1');
      expect(keys.map(k => k.name)).toContain('Key 2');
    });

    it('should delete key by ID', async () => {
      const keyPair = await service.generateKeyPair();

      await service.deleteKey(keyPair.keyId);
      const keys = await service.listKeys();

      expect(keys).not.toContainEqual(expect.objectContaining({ keyId: keyPair.keyId }));
    });

    it('should securely wipe key data on deletion', async () => {
      const keyPair = await service.generateKeyPair();
      const keyId = keyPair.keyId;

      await service.deleteKey(keyId);

      await expect(service.getKey(keyId)).resolves.toBeNull();
    });

    it('should track key usage statistics', async () => {
      const keyPair = await service.generateKeyPair();

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Test',
        pubkey: keyPair.publicKey,
      };

      await service.signEvent(keyPair.keyId, event);

      const updatedKey = await service.getKey(keyPair.keyId);

      expect(updatedKey?.signatureCount).toBe(1);
      expect(updatedKey?.lastUsed).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupt key data gracefully', async () => {
      // Mock corrupt data
      const result = await service.importKey('corrupt-data').catch(e => e);

      expect(result).toBeInstanceOf(Error);
    });

    it('should handle network errors in extension communication', async () => {
      mockNostrExtension.getPublicKey.mockRejectedValue(new Error('Network error'));

      (global as any).window = {
        nostr: mockNostrExtension,
      };

      const extension = await service.connectBrowserExtension();

      expect(extension.enabled).toBe(false);
    });

    it('should never expose private keys in error messages', async () => {
      const keyPair = await service.generateKeyPair();

      try {
        // Trigger some error
        await service.signEvent('invalid-id', {} as any);
      } catch (error) {
        expect((error as Error).message).not.toContain(keyPair.privateKey);
        expect((error as Error).message).not.toContain(keyPair.nsec);
      }
    });

    it('should never log private keys', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const keyPair = await service.generateKeyPair();

      // Check all console calls
      const allCalls = consoleSpy.mock.calls.flat().join(' ');

      expect(allCalls).not.toContain(keyPair.privateKey);
      expect(allCalls).not.toContain(keyPair.nsec);
    });
  });

  describe('Security Features', () => {
    it('should enforce password-based encryption when configured', async () => {
      const password = 'secure-password-123';

      await service.setEncryptionPassword(password);
      const keyPair = await service.generateKeyPair();

      expect(keyPair.encrypted).toBe(true);
    });

    it('should support key derivation with PBKDF2', async () => {
      // Will be implemented with advanced features
      expect(true).toBe(true);
    });

    it('should detect and prevent compromised key usage', async () => {
      const keyPair = await service.generateKeyPair();

      await service.markKeyAsCompromised(keyPair.keyId, 'Test compromise');

      await expect(
        service.signEvent(keyPair.keyId, {} as any)
      ).rejects.toThrow('Key marked as compromised');
    });

    it('should support security level escalation', async () => {
      const keyPair = await service.generateKeyPair();

      await service.updateSecurityLevel(keyPair.keyId, 'maximum');
      const updated = await service.getKey(keyPair.keyId);

      expect(updated?.securityLevel).toBe('maximum');
    });
  });

  describe('Performance', () => {
    it('should generate key in under 500ms', async () => {
      const start = performance.now();
      await service.generateKeyPair();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should sign event in under 100ms', async () => {
      const keyPair = await service.generateKeyPair();

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Test',
        pubkey: keyPair.publicKey,
      };

      const start = performance.now();
      await service.signEvent(keyPair.keyId, event);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent operations efficiently', async () => {
      const operations = Array(10).fill(null).map(() =>
        service.generateKeyPair()
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      expect(new Set(results.map(r => r.publicKey)).size).toBe(10);
    });
  });
});
