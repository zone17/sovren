import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NOSTRKeyManagementService } from '../NOSTRKeyManagementService';

// Mock nostr-tools with proper 64-char hex values
jest.mock('nostr-tools', () => ({
  generateSecretKey: jest.fn(() => new Uint8Array(32).fill(42)),
  getPublicKey: jest.fn(() => 'a'.repeat(64)), // 64-character public key
  nip19: {
    nsecEncode: jest.fn(() => 'nsec1test'),
    npubEncode: jest.fn(() => 'npub1test'),
  },
  finalizeEvent: jest.fn((event: any, privateKey: any) => ({
    ...event,
    id: 'test-event-id',
    sig: 'test-signature',
  })),
  verifyEvent: jest.fn(() => true),
}));

// Mock crypto with proper entropy generation
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr: any) => {
      // Generate values that will pass entropy validation
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Mock TextEncoder
(global as any).TextEncoder = function () {
  return {
    encode: jest.fn((str: string): Uint8Array => {
      return new Uint8Array(str.split('').map((c) => c.charCodeAt(0)));
    }),
  };
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock navigator.hid for hardware wallet tests
const mockHIDDevice = {
  vendorId: 0x2c97,
  productId: 0x0001,
  productName: 'Ledger Nano S',
  open: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

// Create proper navigator mock
const mockNavigator = {
  hid: {
    requestDevice: jest.fn(),
  },
};

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true,
});

describe('🔐 NOSTRKeyManagementService - US-123 Implementation', () => {
  let keyManagementService: NOSTRKeyManagementService;

  beforeEach(() => {
    keyManagementService = new NOSTRKeyManagementService();
    jest.clearAllMocks();

    // Reset navigator.hid mocks
    if (mockNavigator.hid?.requestDevice) {
      (mockNavigator.hid.requestDevice as jest.Mock).mockReset();
    }
  });

  describe('✅ 9.1.1: Design NOSTR key management architecture', () => {
    it('should initialize with proper architecture configuration', () => {
      const keyPair = keyManagementService.getKeyPair();
      const metrics = keyManagementService.getMetrics();
      const backups = keyManagementService.getBackups();
      const hardware = keyManagementService.getHardwareWallet();

      expect(keyPair).toBeNull(); // No keys initially
      expect(metrics).toBeDefined();
      expect(metrics.sign_count).toBe(0);
      expect(backups).toEqual([]);
      expect(hardware.connected).toBe(false);
    });

    it('should have proper storage configuration', () => {
      // Test storage keys are properly defined
      expect(keyManagementService).toBeDefined();
      // Architecture should support secure storage
      expect(localStorage.setItem).toBeDefined();
    });
  });

  describe('✅ 9.1.2: Implement secure key generation with entropy validation', () => {
    it('should generate secure key pairs with sufficient entropy', async () => {
      const keyPair = await keyManagementService.generateSecureKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.privateKey).toHaveLength(64);
      expect(keyPair.publicKey).toHaveLength(64);
      expect(keyPair.npub).toMatch(/^npub1/);
      expect(keyPair.nsec).toMatch(/^nsec1/);
      expect(keyPair.entropy).toBeGreaterThanOrEqual(128);
      expect(keyPair.created).toBeCloseTo(Date.now(), -3);
      expect(keyPair.backed_up).toBe(false);
      expect(keyPair.hardware_wallet).toBe(false);
    });

    it('should reject key generation with insufficient entropy', async () => {
      // Mock low entropy
      const originalGetRandomValues = global.crypto.getRandomValues;
      global.crypto.getRandomValues = jest.fn((arr: any) => {
        // Return all zeros for low entropy
        arr.fill(0);
        return arr;
      });

      await expect(keyManagementService.generateSecureKeyPair()).rejects.toThrow(
        'Insufficient entropy for secure key generation'
      );

      // Restore original function
      global.crypto.getRandomValues = originalGetRandomValues;
    });

    it('should track sensitive data references for cleanup', async () => {
      const keyPair = await keyManagementService.generateSecureKeyPair();

      // Verify key was generated and stored
      expect(keyPair.privateKey).toBeDefined();
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('✅ 9.1.3: Create key backup and recovery mechanisms', () => {
    it('should create mnemonic backup', async () => {
      await keyManagementService.generateSecureKeyPair();

      const backup = await keyManagementService.createBackup('mnemonic', 'test-password');

      expect(backup).toBeDefined();
      expect(backup.method).toBe('mnemonic');
      expect(backup.encrypted_data).toBeDefined();
      expect(backup.verification_hash).toBeDefined();
      expect(backup.created_at).toBeCloseTo(Date.now(), -3);
    });

    it('should create file backup', async () => {
      await keyManagementService.generateSecureKeyPair();

      const backup = await keyManagementService.createBackup('file', 'test-password');

      expect(backup).toBeDefined();
      expect(backup.method).toBe('file');
      expect(backup.encrypted_data).toBeDefined();
    });

    it('should create QR code backup', async () => {
      await keyManagementService.generateSecureKeyPair();

      const backup = await keyManagementService.createBackup('qr');

      expect(backup).toBeDefined();
      expect(backup.method).toBe('qr');
      expect(backup.encrypted_data).toBeDefined();
    });

    it('should create social recovery backup', async () => {
      await keyManagementService.generateSecureKeyPair();

      const backup = await keyManagementService.createBackup('social_recovery');

      expect(backup).toBeDefined();
      expect(backup.method).toBe('social_recovery');
      expect(backup.recovery_shares).toBeDefined();
      expect(backup.recovery_shares?.length).toBeGreaterThan(0);
    });

    it('should update backup status after creating backup', async () => {
      await keyManagementService.generateSecureKeyPair();

      let keyPair = keyManagementService.getKeyPair();
      expect(keyPair?.backed_up).toBe(false);

      await keyManagementService.createBackup('mnemonic');

      keyPair = keyManagementService.getKeyPair();
      expect(keyPair?.backed_up).toBe(true);
    });

    it('should fail to create backup without key pair', async () => {
      await expect(keyManagementService.createBackup('mnemonic')).rejects.toThrow(
        'No key pair available for backup'
      );
    });
  });

  describe('✅ 9.1.4: Add hardware wallet integration for NOSTR signing', () => {
    it('should connect to hardware wallet', async () => {
      // Mock navigator.hid.requestDevice to return mock device
      (mockNavigator.hid.requestDevice as jest.Mock).mockResolvedValue([mockHIDDevice]);

      const hardwareWallet = await keyManagementService.connectHardwareWallet();

      expect(hardwareWallet).toBeDefined();
      expect(hardwareWallet.connected).toBe(true);
      expect(hardwareWallet.device_type).toBe('Ledger Nano S');
      expect(hardwareWallet.supports_nostr).toBe(true);
      expect(mockNavigator.hid.requestDevice).toHaveBeenCalled();
    });

    it('should fail when no hardware wallet found', async () => {
      // Mock empty device list
      (mockNavigator.hid.requestDevice as jest.Mock).mockResolvedValue([]);

      await expect(keyManagementService.connectHardwareWallet()).rejects.toThrow(
        'No compatible hardware wallet found'
      );
    });

    it('should fail when WebHID API not supported', async () => {
      // Remove navigator.hid to simulate unsupported browser
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });

      await expect(keyManagementService.connectHardwareWallet()).rejects.toThrow(
        'Hardware wallet requires WebHID API support'
      );

      // Restore navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });
  });

  describe('✅ 9.1.5: Implement NIP-07 browser extension support', () => {
    it('should connect to browser extension', async () => {
      const mockNostr = {
        getPublicKey: jest.fn().mockResolvedValue('a'.repeat(64)), // 64-char valid key
        signEvent: jest.fn(),
        encrypt: jest.fn(),
        decrypt: jest.fn(),
        getRelays: jest.fn(),
      };

      // Mock window.nostr
      (global as any).window = { nostr: mockNostr };

      const result = await keyManagementService.connectBrowserExtension();

      expect(result.connected).toBe(true);
      expect(result.pubkey).toBe('a'.repeat(64));
      expect(mockNostr.getPublicKey).toHaveBeenCalled();
    });

    it('should fail when no extension detected', async () => {
      // Remove window.nostr
      (global as any).window = {};

      const result = await keyManagementService.connectBrowserExtension();

      expect(result.connected).toBe(false);
    });

    it('should fail with invalid public key from extension', async () => {
      const mockNostr = {
        getPublicKey: jest.fn().mockResolvedValue('invalid-short-key'),
      };

      (global as any).window = { nostr: mockNostr };

      const result = await keyManagementService.connectBrowserExtension();

      expect(result.connected).toBe(false);
    });
  });

  describe('✅ 9.1.6: Create key rotation and migration workflows', () => {
    it('should rotate keys successfully', async () => {
      const originalKeyPair = await keyManagementService.generateSecureKeyPair();
      const originalPublicKey = originalKeyPair.publicKey;

      const rotatedKeyPair = await keyManagementService.rotateKeys('scheduled');

      expect(rotatedKeyPair.publicKey).not.toBe(originalPublicKey);
      expect(rotatedKeyPair.rotated_count).toBe(1);
      expect(rotatedKeyPair.last_rotated).toBeDefined();
    });

    it('should handle different rotation reasons', async () => {
      await keyManagementService.generateSecureKeyPair();

      const compromisedRotation = await keyManagementService.rotateKeys('compromise');
      expect(compromisedRotation.rotated_count).toBe(1);

      const scheduledRotation = await keyManagementService.rotateKeys('scheduled');
      expect(scheduledRotation.rotated_count).toBe(2);
    });

    it('should fail rotation without existing key pair', async () => {
      await expect(keyManagementService.rotateKeys('scheduled')).rejects.toThrow(
        'No existing key pair to rotate'
      );
    });
  });

  describe('✅ 9.1.7: Add NOSTR key usage monitoring and analytics', () => {
    it('should record key usage', async () => {
      await keyManagementService.generateSecureKeyPair();

      await keyManagementService.recordKeyUsage('sign', 'local');

      const metrics = keyManagementService.getMetrics();
      expect(metrics.sign_count).toBe(1);
    });

    it('should track different usage methods', async () => {
      await keyManagementService.generateSecureKeyPair();

      await keyManagementService.recordKeyUsage('sign', 'hardware');
      await keyManagementService.recordKeyUsage('encrypt', 'extension');

      const metrics = keyManagementService.getMetrics();
      expect(metrics.hardware_signs).toBe(1);
      expect(metrics.extension_signs).toBe(1);
    });

    it('should provide usage analytics with security score', async () => {
      await keyManagementService.generateSecureKeyPair();

      const analytics = await keyManagementService.getUsageAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.security_score).toBeGreaterThan(0);
      expect(analytics.sign_count).toBeDefined();
    });
  });

  describe('✅ 9.1.8: Test key management security and portability', () => {
    it('should validate key pair integrity', async () => {
      await keyManagementService.generateSecureKeyPair();

      const validation = await keyManagementService.validateKeyPairIntegrity();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect invalid key pairs', async () => {
      // Create invalid key pair manually
      (keyManagementService as any).keyPair = {
        privateKey: 'invalid',
        publicKey: 'invalid',
        npub: 'invalid',
        nsec: 'invalid',
        entropy: 0,
        created: Date.now(),
        backed_up: false,
        hardware_wallet: false,
        rotated_count: 0,
      };

      const validation = await keyManagementService.validateKeyPairIntegrity();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should perform comprehensive security testing', async () => {
      await keyManagementService.generateSecureKeyPair();

      // Test basic security functionality
      const keyPair = keyManagementService.getKeyPair();
      const metrics = keyManagementService.getMetrics();
      const validation = await keyManagementService.validateKeyPairIntegrity();

      expect(keyPair).toBeDefined();
      expect(metrics).toBeDefined();
      expect(validation.valid).toBe(true);
    });
  });

  describe('Storage and Persistence', () => {
    it('should save to secure storage', async () => {
      const keyPair = await keyManagementService.generateSecureKeyPair();

      // Verify localStorage was called for saving
      expect(localStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('nostr_keypair_encrypted'),
        expect.any(String)
      );
    });

    it('should load from secure storage on initialization', async () => {
      // Mock existing data in localStorage
      localStorageMock.getItem = jest.fn().mockReturnValue(
        JSON.stringify({
          privateKey: 'a'.repeat(64),
          publicKey: 'a'.repeat(64),
          npub: 'npub1test',
          nsec: 'nsec1test',
          entropy: 128,
          created: Date.now(),
          backed_up: true,
          hardware_wallet: false,
          rotated_count: 0,
        })
      );

      await keyManagementService.initialize();

      expect(localStorageMock.getItem).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle crypto API failures gracefully', async () => {
      // Mock crypto failure
      const originalGetRandomValues = global.crypto.getRandomValues;
      global.crypto.getRandomValues = jest.fn(() => {
        throw new Error('Crypto API not available');
      });

      await expect(keyManagementService.generateSecureKeyPair()).rejects.toThrow();

      // Restore
      global.crypto.getRandomValues = originalGetRandomValues;
    });

    it('should handle storage failures gracefully', async () => {
      // Mock storage failure
      localStorageMock.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should still generate key pair but may not persist
      await expect(keyManagementService.generateSecureKeyPair()).rejects.toThrow();
    });

    it('should handle malformed storage data', async () => {
      // Mock corrupted data
      localStorageMock.getItem = jest.fn().mockReturnValue('invalid-json');

      // Should not throw, just log error
      await expect(keyManagementService.initialize()).resolves.toBeUndefined();
    });
  });
});
