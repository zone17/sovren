import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  NostrEnhancedKeyPair,
  NostrEntropySource,
  NostrKeyBackupMethod,
  NostrKeyManagementConfig,
  NostrKeyManagementResult,
  NostrKeySecurityLevel,
  NostrKeyStorageType,
  NostrMnemonicBackup,
} from '../../types/nostr-key-management';
import { NostrKeyManagementService } from '../NostrKeyManagementService';

// Mock dependencies with proper typing
const mockStorageService = {
  initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  storeKey: jest
    .fn<(keyPair: NostrEnhancedKeyPair) => Promise<NostrKeyManagementResult<void>>>()
    .mockResolvedValue({ success: true }),
  loadKey: jest
    .fn<(keyId: string) => Promise<NostrKeyManagementResult<NostrEnhancedKeyPair>>>()
    .mockResolvedValue({ success: false, error: 'Not found' }),
  loadAllKeys: jest
    .fn<() => Promise<NostrKeyManagementResult<NostrEnhancedKeyPair[]>>>()
    .mockResolvedValue({ success: true, data: [] }),
  deleteKey: jest
    .fn<(keyId: string) => Promise<NostrKeyManagementResult<void>>>()
    .mockResolvedValue({ success: true }),
  storeBackup: jest
    .fn<(backup: NostrMnemonicBackup) => Promise<NostrKeyManagementResult<void>>>()
    .mockResolvedValue({ success: true }),
  on: jest.fn(),
};

const mockCryptoService = {
  initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  calculateChecksum: jest
    .fn<(data: string) => Promise<string>>()
    .mockResolvedValue('mock-checksum'),
  on: jest.fn(),
};

const mockAnalyticsService = {
  recordEvent: jest.fn().mockResolvedValue(undefined),
};

const mockMonitoringService = {
  recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
};

// Mock crypto.getRandomValues for testing
const mockRandomValues = jest.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
});

// Mock global crypto
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: mockRandomValues,
  },
});

// Mock window object for browser extension detection
Object.defineProperty(global, 'window', {
  value: {
    nostr: {
      getPublicKey: jest.fn(),
    },
  },
});

describe('NostrKeyManagementService', () => {
  let service: NostrKeyManagementService;
  let config: NostrKeyManagementConfig;

  beforeEach(() => {
    config = {
      defaultStorageType: NostrKeyStorageType.INDEXED_DB,
      encryptionEnabled: true,
      compressionEnabled: false,
      defaultSecurityLevel: NostrKeySecurityLevel.ENHANCED,
      enforceHardwareWallets: false,
      requireMultiFactor: false,
      autoBackupEnabled: true,
      defaultBackupMethod: NostrKeyBackupMethod.MNEMONIC_PHRASE,
      backupVerificationRequired: true,
      autoRotationEnabled: false,
      defaultRotationInterval: 7776000000,
      compromiseRotationEnabled: true,
      usageAnalyticsEnabled: true,
      securityMonitoringEnabled: true,
      anomalyDetectionEnabled: true,
      cacheSize: 100,
      cacheTtl: 3600000,
      maxConcurrentOperations: 10,
    };

    service = new NostrKeyManagementService(config, {
      storage: mockStorageService as any,
      crypto: mockCryptoService as any,
      analytics: mockAnalyticsService as any,
      monitoring: mockMonitoringService as any,
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Initialization', () => {
    it('should initialize successfully with default configuration', async () => {
      const result = await service.initialize();

      expect(result.success).toBe(true);
      expect(mockStorageService.initialize).toHaveBeenCalledWith(config);
      expect(mockCryptoService.initialize).toHaveBeenCalled();
      expect(mockStorageService.loadAllKeys).toHaveBeenCalled();
      expect(mockMonitoringService.recordSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'key_created',
          description: 'Key management service initialized',
        })
      );
    });

    it('should handle initialization errors gracefully', async () => {
      mockStorageService.initialize.mockRejectedValueOnce(new Error('Storage init failed'));

      const result = await service.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage init failed');
    });

    it('should load existing keys from storage during initialization', async () => {
      const existingKeys: NostrEnhancedKeyPair[] = [
        {
          keyId: 'test-key-1',
          privateKey: 'a'.repeat(64),
          publicKey: 'b'.repeat(64),
          npub: 'npub1test',
          nsec: 'nsec1test',
          created: Date.now(),
          entropySource: NostrEntropySource.WEB_CRYPTO_API,
          entropyBits: 256,
          storageType: NostrKeyStorageType.INDEXED_DB,
          encrypted: true,
          backedUp: false,
          backupVerified: false,
          securityLevel: NostrKeySecurityLevel.ENHANCED,
          hardwareWalletSupported: false,
          hardwareWalletConnected: false,
          multiFactorEnabled: false,
          signatureCount: 0,
          compromised: false,
          tags: [],
        },
      ];

      mockStorageService.loadAllKeys.mockResolvedValueOnce({
        success: true,
        data: existingKeys,
      });

      await service.initialize();

      expect(mockStorageService.loadAllKeys).toHaveBeenCalled();
    });
  });

  describe('Key Generation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should generate a new NOSTR key pair successfully', async () => {
      const options = {
        name: 'Test Key',
        description: 'Test key for unit testing',
        securityLevel: NostrKeySecurityLevel.ENHANCED,
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
      };

      const result = await service.generateKeyPair(options);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.privateKey).toHaveLength(64);
      expect(result.data?.publicKey).toHaveLength(64);
      expect(result.data?.npub).toMatch(/^npub1/);
      expect(result.data?.nsec).toMatch(/^nsec1/);
      expect(result.data?.name).toBe(options.name);
      expect(result.data?.description).toBe(options.description);
      expect(result.data?.securityLevel).toBe(options.securityLevel);
      expect(result.data?.entropySource).toBe(options.entropySource);

      expect(mockStorageService.storeKey).toHaveBeenCalledWith(result.data);
      expect(mockAnalyticsService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'generate',
          success: true,
        })
      );
      expect(mockMonitoringService.recordSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'key_created',
          description: 'New NOSTR key pair generated',
        })
      );
    });

    it('should generate key with default options when none provided', async () => {
      const result = await service.generateKeyPair();

      expect(result.success).toBe(true);
      expect(result.data?.securityLevel).toBe(config.defaultSecurityLevel);
      expect(result.data?.storageType).toBe(config.defaultStorageType);
      expect(result.data?.encrypted).toBe(config.encryptionEnabled);
    });

    it('should emit key generation event', async () => {
      const eventSpy = jest.fn();
      service.on('key:generated', eventSpy);

      const result = await service.generateKeyPair();

      expect(result.success).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(result.data);
    });

    it('should handle key generation errors', async () => {
      (mockStorageService.storeKey as jest.MockedFunction<any>).mockResolvedValueOnce({
        success: false,
        error: 'Storage error',
      });

      const result = await service.generateKeyPair();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
      expect(mockAnalyticsService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'generate',
          success: false,
        })
      );
    });

    it('should validate generated key pair before storage', async () => {
      // Mock crypto to generate invalid key
      mockRandomValues.mockImplementationOnce((array: Uint8Array) => {
        // Fill with zeros to create invalid key
        array.fill(0);
        return array;
      });

      const result = await service.generateKeyPair();

      // The validation should catch the invalid key
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });
  });

  describe('Key Import', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should import existing NOSTR key successfully', async () => {
      const privateKey = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456';
      const options = {
        name: 'Imported Key',
        description: 'Imported from external source',
        validate: true,
        backup: true,
      };

      const result = await service.importKey(privateKey, options);

      expect(result.success).toBe(true);
      expect(result.data?.privateKey).toBe(privateKey);
      expect(result.data?.name).toBe(options.name);
      expect(result.data?.description).toBe(options.description);
      expect(result.data?.tags).toContain('imported');

      expect(mockStorageService.storeKey).toHaveBeenCalledWith(result.data);
      expect(mockAnalyticsService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'generate',
          success: true,
        })
      );
      expect(mockMonitoringService.recordSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'key_created',
          description: 'NOSTR key imported from external source',
        })
      );
    });

    it('should reject invalid private key format', async () => {
      const invalidPrivateKey = 'invalid-key';

      const result = await service.importKey(invalidPrivateKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid private key format');
    });

    it('should prevent importing duplicate keys', async () => {
      const privateKey = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456';

      // First import should succeed
      const firstResult = await service.importKey(privateKey);
      expect(firstResult.success).toBe(true);

      // Second import should fail
      const secondResult = await service.importKey(privateKey);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('already exists');
    });

    it('should emit key import event', async () => {
      const eventSpy = jest.fn();
      service.on('key:imported', eventSpy);

      const privateKey = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456';
      const result = await service.importKey(privateKey);

      expect(result.success).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(result.data);
    });
  });

  describe('Key Backup', () => {
    let testKeyPair: NostrEnhancedKeyPair;

    beforeEach(async () => {
      await service.initialize();

      const generateResult = await service.generateKeyPair();
      expect(generateResult.success).toBe(true);
      testKeyPair = generateResult.data!;
    });

    it('should create mnemonic backup successfully', async () => {
      const result = await service.createBackup(
        testKeyPair.keyId,
        NostrKeyBackupMethod.MNEMONIC_PHRASE,
        { verify: true }
      );

      expect(result.success).toBe(true);
      expect(result.data?.keyId).toBe(testKeyPair.keyId);
      expect(result.data?.mnemonic).toBeDefined();
      expect(result.data?.wordCount).toBeGreaterThanOrEqual(12);
      expect(result.data?.checksum).toBe('mock-checksum');

      expect(mockStorageService.storeBackup).toHaveBeenCalledWith(result.data);
      expect(mockAnalyticsService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'backup',
          success: true,
        })
      );
      expect(mockMonitoringService.recordSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'key_created',
          description: 'Key backup created',
        })
      );
    });

    it('should emit backup created event', async () => {
      const eventSpy = jest.fn();
      service.on('key:backed_up', eventSpy);

      const result = await service.createBackup(
        testKeyPair.keyId,
        NostrKeyBackupMethod.MNEMONIC_PHRASE
      );

      expect(result.success).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(
        testKeyPair.keyId,
        NostrKeyBackupMethod.MNEMONIC_PHRASE
      );
    });

    it('should reject backup for non-existent key', async () => {
      const result = await service.createBackup(
        'non-existent-key',
        NostrKeyBackupMethod.MNEMONIC_PHRASE
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Key not found');
    });

    it('should handle unsupported backup methods', async () => {
      const result = await service.createBackup(
        testKeyPair.keyId,
        NostrKeyBackupMethod.HARDWARE_BACKUP
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not yet implemented');
    });
  });

  describe('Key Rotation', () => {
    let testKeyPair: NostrEnhancedKeyPair;

    beforeEach(async () => {
      await service.initialize();

      const generateResult = await service.generateKeyPair();
      expect(generateResult.success).toBe(true);
      testKeyPair = generateResult.data!;
    });

    it('should rotate key successfully', async () => {
      const options = {
        type: 'manual' as const,
        reason: 'Scheduled rotation',
        migrateData: true,
      };

      const result = await service.rotateKey(testKeyPair.keyId, options);

      expect(result.success).toBe(true);
      expect(result.data?.oldKeyId).toBe(testKeyPair.keyId);
      expect(result.data?.newKeyId).toBeDefined();
      expect(result.data?.newKeyId).not.toBe(testKeyPair.keyId);
      expect(result.data?.rotationType).toBe(options.type);
      expect(result.data?.reason).toBe(options.reason);
      expect(result.data?.status).toBe('completed');

      expect(mockAnalyticsService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'rotate',
          success: true,
        })
      );
      expect(mockMonitoringService.recordSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'key_rotated',
          description: 'Key rotation completed',
        })
      );
    });

    it('should emit rotation event', async () => {
      const eventSpy = jest.fn();
      service.on('key:rotated', eventSpy);

      const result = await service.rotateKey(testKeyPair.keyId);

      expect(result.success).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(result.data);
    });

    it('should reject rotation for non-existent key', async () => {
      const result = await service.rotateKey('non-existent-key');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Key not found');
    });

    it('should handle rotation with different types', async () => {
      const compromisedResult = await service.rotateKey(testKeyPair.keyId, {
        type: 'compromised',
        reason: 'Key potentially compromised',
      });

      expect(compromisedResult.success).toBe(true);
      expect(compromisedResult.data?.rotationType).toBe('compromised');
      expect(mockMonitoringService.recordSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'high',
        })
      );
    });
  });

  describe('Key Validation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should validate valid key pair', async () => {
      const validKeyPair: NostrEnhancedKeyPair = {
        keyId: 'test-key',
        privateKey: 'a'.repeat(64),
        publicKey: 'b'.repeat(64),
        npub: 'npub1test',
        nsec: 'nsec1test',
        created: Date.now(),
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
        entropyBits: 256,
        storageType: NostrKeyStorageType.INDEXED_DB,
        encrypted: true,
        backedUp: true,
        backupVerified: true,
        securityLevel: NostrKeySecurityLevel.ENHANCED,
        hardwareWalletSupported: false,
        hardwareWalletConnected: false,
        multiFactorEnabled: false,
        signatureCount: 0,
        compromised: false,
        tags: [],
      };

      const validation = await service.validateKeyPair(validKeyPair);

      expect(validation.valid).toBe(true);
      expect(validation.securityScore).toBeGreaterThan(80);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid private key format', async () => {
      const invalidKeyPair: NostrEnhancedKeyPair = {
        keyId: 'test-key',
        privateKey: 'invalid-key',
        publicKey: 'b'.repeat(64),
        npub: 'npub1test',
        nsec: 'nsec1test',
        created: Date.now(),
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
        entropyBits: 256,
        storageType: NostrKeyStorageType.INDEXED_DB,
        encrypted: true,
        backedUp: false,
        backupVerified: false,
        securityLevel: NostrKeySecurityLevel.ENHANCED,
        hardwareWalletSupported: false,
        hardwareWalletConnected: false,
        multiFactorEnabled: false,
        signatureCount: 0,
        compromised: false,
        tags: [],
      };

      const validation = await service.validateKeyPair(invalidKeyPair);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          code: 'INVALID_PRIVATE_KEY_FORMAT',
        })
      );
    });

    it('should detect insufficient entropy', async () => {
      const lowEntropyKeyPair: NostrEnhancedKeyPair = {
        keyId: 'test-key',
        privateKey: 'a'.repeat(64),
        publicKey: 'b'.repeat(64),
        npub: 'npub1test',
        nsec: 'nsec1test',
        created: Date.now(),
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
        entropyBits: 64, // Insufficient entropy
        storageType: NostrKeyStorageType.INDEXED_DB,
        encrypted: true,
        backedUp: false,
        backupVerified: false,
        securityLevel: NostrKeySecurityLevel.ENHANCED,
        hardwareWalletSupported: false,
        hardwareWalletConnected: false,
        multiFactorEnabled: false,
        signatureCount: 0,
        compromised: false,
        tags: [],
      };

      const validation = await service.validateKeyPair(lowEntropyKeyPair);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          code: 'INSUFFICIENT_ENTROPY',
        })
      );
    });

    it('should detect compromised key', async () => {
      const compromisedKeyPair: NostrEnhancedKeyPair = {
        keyId: 'test-key',
        privateKey: 'a'.repeat(64),
        publicKey: 'b'.repeat(64),
        npub: 'npub1test',
        nsec: 'nsec1test',
        created: Date.now(),
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
        entropyBits: 256,
        storageType: NostrKeyStorageType.INDEXED_DB,
        encrypted: true,
        backedUp: false,
        backupVerified: false,
        securityLevel: NostrKeySecurityLevel.ENHANCED,
        hardwareWalletSupported: false,
        hardwareWalletConnected: false,
        multiFactorEnabled: false,
        signatureCount: 0,
        compromised: true, // Compromised key
        tags: [],
      };

      const validation = await service.validateKeyPair(compromisedKeyPair);

      expect(validation.valid).toBe(false);
      expect(validation.securityScore).toBe(0);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          code: 'KEY_COMPROMISED',
        })
      );
    });

    it('should provide security recommendations', async () => {
      const basicKeyPair: NostrEnhancedKeyPair = {
        keyId: 'test-key',
        privateKey: 'a'.repeat(64),
        publicKey: 'b'.repeat(64),
        npub: 'npub1test',
        nsec: 'nsec1test',
        created: Date.now(),
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
        entropyBits: 256,
        storageType: NostrKeyStorageType.INDEXED_DB,
        encrypted: true,
        backedUp: false, // Not backed up
        backupVerified: false,
        securityLevel: NostrKeySecurityLevel.BASIC, // Basic security
        hardwareWalletSupported: false,
        hardwareWalletConnected: false,
        multiFactorEnabled: false,
        signatureCount: 0,
        compromised: false,
        tags: [],
      };

      const validation = await service.validateKeyPair(basicKeyPair);

      expect(validation.valid).toBe(true);
      expect(validation.recommendations).toContain('Create a secure backup of this key');
      expect(validation.recommendations).toContain('Upgrade to enhanced or maximum security level');
    });
  });

  describe('Service Statistics', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return correct statistics', async () => {
      // Generate some test keys
      await service.generateKeyPair({ name: 'Key 1' });
      await service.generateKeyPair({ name: 'Key 2' });

      const stats = service.getStats();

      expect(stats.totalKeys).toBe(2);
      expect(stats.backedUpKeys).toBeGreaterThanOrEqual(0);
      expect(stats.compromisedKeys).toBe(0);
      expect(stats.hardwareWallets).toBe(0);
      expect(stats.browserExtensions).toBeGreaterThanOrEqual(0);
      expect(stats.rotationsPending).toBe(0);
      expect(stats.lastCleanup).toBeGreaterThan(0);
    });

    it('should track backed up keys correctly', async () => {
      const keyResult = await service.generateKeyPair();
      expect(keyResult.success).toBe(true);

      await service.createBackup(keyResult.data!.keyId, NostrKeyBackupMethod.MNEMONIC_PHRASE);

      const stats = service.getStats();
      expect(stats.backedUpKeys).toBe(1);
    });
  });

  describe('Security Monitoring', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should emit security anomaly events for high severity events', async () => {
      const anomalySpy = jest.fn();
      service.on('security:anomaly_detected', anomalySpy);

      // This should trigger a high severity event during rotation
      const keyResult = await service.generateKeyPair();
      expect(keyResult.success).toBe(true);

      await service.rotateKey(keyResult.data!.keyId, {
        type: 'compromised',
        reason: 'Key compromise detected',
      });

      expect(anomalySpy).toHaveBeenCalled();
    });

    it('should record all security events when monitoring is enabled', async () => {
      await service.generateKeyPair();

      // Should have recorded at least initialization and key generation events
      expect(mockMonitoringService.recordSecurityEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Browser Extension Detection', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should detect nos2x extension when available', async () => {
      const extensionSpy = jest.fn();
      service.on('extension:detected', extensionSpy);

      // Re-initialize to trigger extension detection
      const newService = new NostrKeyManagementService(config, {
        storage: mockStorageService as any,
        crypto: mockCryptoService as any,
        analytics: mockAnalyticsService as any,
        monitoring: mockMonitoringService as any,
      });

      await newService.initialize();

      expect(extensionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionId: 'nos2x',
          available: true,
        })
      );

      newService.destroy();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle storage service errors gracefully', async () => {
      const errorSpy = jest.fn();
      service.on('storage:error', errorSpy);

      (mockStorageService.storeKey as jest.MockedFunction<any>).mockResolvedValueOnce({
        success: false,
        error: 'Storage full',
      });

      const result = await service.generateKeyPair();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage full');
    });

    it('should record failed operations in analytics', async () => {
      (mockStorageService.storeKey as jest.MockedFunction<any>).mockResolvedValueOnce({
        success: false,
        error: 'Storage error',
      });

      await service.generateKeyPair();

      expect(mockAnalyticsService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorMessage: expect.stringContaining('Storage error'),
        })
      );
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources when destroyed', () => {
      const result = service.destroy();

      expect(result).toBeUndefined();
      expect(service.listenerCount('key:generated')).toBe(0);
    });
  });
});

/**
 * Integration Tests for Key Management Workflows
 */
describe('NostrKeyManagementService Integration Tests', () => {
  let service: NostrKeyManagementService;

  beforeEach(async () => {
    service = new NostrKeyManagementService({
      usageAnalyticsEnabled: true,
      securityMonitoringEnabled: true,
      autoBackupEnabled: true,
    });

    await service.initialize();
  });

  afterEach(() => {
    service.destroy();
  });

  it('should complete full key lifecycle successfully', async () => {
    // Generate key
    const generateResult = await service.generateKeyPair({
      name: 'Test Lifecycle Key',
      securityLevel: NostrKeySecurityLevel.ENHANCED,
    });

    expect(generateResult.success).toBe(true);
    const keyPair = generateResult.data!;

    // Create backup
    const backupResult = await service.createBackup(
      keyPair.keyId,
      NostrKeyBackupMethod.MNEMONIC_PHRASE
    );

    expect(backupResult.success).toBe(true);

    // Validate key
    const validation = await service.validateKeyPair(keyPair);
    expect(validation.valid).toBe(true);

    // Rotate key
    const rotationResult = await service.rotateKey(keyPair.keyId, {
      type: 'manual',
      reason: 'Scheduled rotation test',
    });

    expect(rotationResult.success).toBe(true);

    // Check statistics
    const stats = service.getStats();
    expect(stats.totalKeys).toBeGreaterThan(0);
    expect(stats.backedUpKeys).toBeGreaterThan(0);
  });

  it('should handle multiple concurrent key operations', async () => {
    const operations = Array.from({ length: 5 }, (_, i) =>
      service.generateKeyPair({ name: `Concurrent Key ${i}` })
    );

    const results = await Promise.all(operations);

    results.forEach((result) => {
      expect(result.success).toBe(true);
    });

    const stats = service.getStats();
    expect(stats.totalKeys).toBe(5);
  });
});
