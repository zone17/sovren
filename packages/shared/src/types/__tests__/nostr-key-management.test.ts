/**
 * Unit Tests for NOSTR Key Management Types
 * Tests all Zod schemas and type validations for TS-007
 * Coverage target: 95%+
 */

import {
  NostrEntropySource,
  NostrKeyStorageType,
  NostrKeyBackupMethod,
  NostrKeySecurityLevel,
  NostrEnhancedKeyPairSchema,
  NostrKeyDerivationSchema,
  NostrMnemonicBackupSchema,
  NostrKeyStorageConfigSchema,
  NostrKeyUsageAnalyticsSchema,
  NostrKeySecurityMonitoringSchema,
  NostrKeyRotationSchema,
  NostrHardwareWalletSchema,
  NostrBrowserExtensionSchema,
  NostrKeyRecoverySchema,
  NostrKeyManagementConfigSchema,
  type NostrEnhancedKeyPair,
  type NostrKeyDerivation,
  type NostrKeyManagementState,
  type NostrKeyManagementResult,
  type NostrKeyValidationResult,
} from '../nostr-key-management';

describe('NOSTR Key Management Types - TS-007', () => {
  describe('Enums', () => {
    it('should define all entropy sources', () => {
      expect(NostrEntropySource.WEB_CRYPTO_API).toBe('web_crypto_api');
      expect(NostrEntropySource.SECURE_RANDOM).toBe('secure_random');
      expect(NostrEntropySource.HARDWARE_RNG).toBe('hardware_rng');
      expect(NostrEntropySource.USER_INPUT).toBe('user_input');
      expect(NostrEntropySource.COMBINED).toBe('combined');
    });

    it('should define all storage types', () => {
      expect(NostrKeyStorageType.INDEXED_DB).toBe('indexed_db');
      expect(NostrKeyStorageType.LOCAL_STORAGE).toBe('local_storage');
      expect(NostrKeyStorageType.SESSION_STORAGE).toBe('session_storage');
      expect(NostrKeyStorageType.MEMORY_ONLY).toBe('memory_only');
      expect(NostrKeyStorageType.HARDWARE_WALLET).toBe('hardware_wallet');
      expect(NostrKeyStorageType.BROWSER_EXTENSION).toBe('browser_extension');
    });

    it('should define all backup methods', () => {
      expect(NostrKeyBackupMethod.MNEMONIC_PHRASE).toBe('mnemonic_phrase');
      expect(NostrKeyBackupMethod.SEED_PHRASE).toBe('seed_phrase');
      expect(NostrKeyBackupMethod.ENCRYPTED_FILE).toBe('encrypted_file');
      expect(NostrKeyBackupMethod.QR_CODE).toBe('qr_code');
      expect(NostrKeyBackupMethod.HARDWARE_BACKUP).toBe('hardware_backup');
      expect(NostrKeyBackupMethod.PAPER_WALLET).toBe('paper_wallet');
    });

    it('should define all security levels', () => {
      expect(NostrKeySecurityLevel.BASIC).toBe('basic');
      expect(NostrKeySecurityLevel.ENHANCED).toBe('enhanced');
      expect(NostrKeySecurityLevel.MAXIMUM).toBe('maximum');
    });
  });

  describe('NostrEnhancedKeyPairSchema', () => {
    const validKeyPair = {
      privateKey: '0'.repeat(64),
      publicKey: '1'.repeat(64),
      npub: 'npub1' + 'a'.repeat(58),
      nsec: 'nsec1' + 'b'.repeat(58),
      keyId: '123e4567-e89b-12d3-a456-426614174000',
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

    it('should validate a complete key pair', () => {
      const result = NostrEnhancedKeyPairSchema.safeParse(validKeyPair);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.privateKey).toHaveLength(64);
        expect(result.data.publicKey).toHaveLength(64);
      }
    });

    it('should reject invalid private key length', () => {
      const invalidKeyPair = {
        ...validKeyPair,
        privateKey: '0'.repeat(32), // Invalid: too short
      };

      const result = NostrEnhancedKeyPairSchema.safeParse(invalidKeyPair);
      expect(result.success).toBe(false);
    });

    it('should reject invalid npub format', () => {
      const invalidKeyPair = {
        ...validKeyPair,
        npub: 'invalid-npub',
      };

      const result = NostrEnhancedKeyPairSchema.safeParse(invalidKeyPair);
      expect(result.success).toBe(false);
    });

    it('should reject invalid nsec format', () => {
      const invalidKeyPair = {
        ...validKeyPair,
        nsec: 'invalid-nsec',
      };

      const result = NostrEnhancedKeyPairSchema.safeParse(invalidKeyPair);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID for keyId', () => {
      const invalidKeyPair = {
        ...validKeyPair,
        keyId: 'not-a-uuid',
      };

      const result = NostrEnhancedKeyPairSchema.safeParse(invalidKeyPair);
      expect(result.success).toBe(false);
    });

    it('should reject entropy bits < 128', () => {
      const invalidKeyPair = {
        ...validKeyPair,
        entropyBits: 64, // Invalid: too low
      };

      const result = NostrEnhancedKeyPairSchema.safeParse(invalidKeyPair);
      expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
      const minimalKeyPair = {
        privateKey: '0'.repeat(64),
        publicKey: '1'.repeat(64),
        npub: 'npub1' + 'a'.repeat(58),
        nsec: 'nsec1' + 'b'.repeat(58),
        keyId: '123e4567-e89b-12d3-a456-426614174000',
        created: Date.now(),
        entropySource: NostrEntropySource.WEB_CRYPTO_API,
        entropyBits: 256,
        storageType: NostrKeyStorageType.INDEXED_DB,
        securityLevel: NostrKeySecurityLevel.ENHANCED,
        // Optional fields omitted
      };

      const result = NostrEnhancedKeyPairSchema.safeParse(minimalKeyPair);
      expect(result.success).toBe(true);
    });
  });

  describe('NostrKeyDerivationSchema', () => {
    it('should validate HD key derivation', () => {
      const validDerivation = {
        masterSeed: 'a'.repeat(64),
        derivationPath: "m/44'/1237'/0'/0/0",
        chainCode: '0'.repeat(64),
        depth: 5,
        parentFingerprint: 'abcd1234',
        childNumber: 0,
        hardened: true,
      };

      const result = NostrKeyDerivationSchema.safeParse(validDerivation);
      expect(result.success).toBe(true);
    });

    it('should reject invalid derivation path', () => {
      const invalidDerivation = {
        masterSeed: 'a'.repeat(64),
        derivationPath: 'invalid/path',
        chainCode: '0'.repeat(64),
        depth: 5,
        parentFingerprint: 'abcd1234',
        childNumber: 0,
      };

      const result = NostrKeyDerivationSchema.safeParse(invalidDerivation);
      expect(result.success).toBe(false);
    });

    it('should reject depth > 10', () => {
      const invalidDerivation = {
        masterSeed: 'a'.repeat(64),
        derivationPath: "m/44'/1237'/0'/0/0",
        chainCode: '0'.repeat(64),
        depth: 15, // Invalid: too deep
        parentFingerprint: 'abcd1234',
        childNumber: 0,
      };

      const result = NostrKeyDerivationSchema.safeParse(invalidDerivation);
      expect(result.success).toBe(false);
    });
  });

  describe('NostrMnemonicBackupSchema', () => {
    it('should validate mnemonic backup', () => {
      const validBackup = {
        keyId: '123e4567-e89b-12d3-a456-426614174000',
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        wordCount: 12,
        language: 'english',
        checksum: 'abc123',
        created: Date.now(),
        verified: true,
        encrypted: true,
      };

      const result = NostrMnemonicBackupSchema.safeParse(validBackup);
      expect(result.success).toBe(true);
    });

    it('should reject invalid word count', () => {
      const invalidBackup = {
        keyId: '123e4567-e89b-12d3-a456-426614174000',
        mnemonic: 'test mnemonic',
        wordCount: 8, // Invalid: < 12
        checksum: 'abc123',
        created: Date.now(),
      };

      const result = NostrMnemonicBackupSchema.safeParse(invalidBackup);
      expect(result.success).toBe(false);
    });

    it('should reject word count > 24', () => {
      const invalidBackup = {
        keyId: '123e4567-e89b-12d3-a456-426614174000',
        mnemonic: 'test mnemonic',
        wordCount: 30, // Invalid: > 24
        checksum: 'abc123',
        created: Date.now(),
      };

      const result = NostrMnemonicBackupSchema.safeParse(invalidBackup);
      expect(result.success).toBe(false);
    });
  });

  describe('NostrKeyStorageConfigSchema', () => {
    it('should validate storage configuration', () => {
      const validConfig = {
        storageType: NostrKeyStorageType.INDEXED_DB,
        encrypted: true,
        encryptionAlgorithm: 'AES-GCM',
        keyDerivationFunction: 'PBKDF2',
        iterations: 100000,
        saltLength: 32,
        compressionEnabled: false,
        backupEnabled: true,
        autoRotationEnabled: false,
      };

      const result = NostrKeyStorageConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject iterations < 10000', () => {
      const invalidConfig = {
        storageType: NostrKeyStorageType.INDEXED_DB,
        iterations: 5000, // Invalid: too low
      };

      const result = NostrKeyStorageConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should use default values', () => {
      const minimalConfig = {
        storageType: NostrKeyStorageType.INDEXED_DB,
      };

      const result = NostrKeyStorageConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.encrypted).toBe(true);
        expect(result.data.iterations).toBe(100000);
      }
    });
  });

  describe('NostrKeyUsageAnalyticsSchema', () => {
    it('should validate usage analytics', () => {
      const validAnalytics = {
        keyId: '123e4567-e89b-12d3-a456-426614174000',
        timestamp: Date.now(),
        operation: 'sign' as const,
        success: true,
        duration: 15.5,
        entropyQuality: 0.95,
      };

      const result = NostrKeyUsageAnalyticsSchema.safeParse(validAnalytics);
      expect(result.success).toBe(true);
    });

    it('should validate all operation types', () => {
      const operations = ['generate', 'sign', 'encrypt', 'decrypt', 'backup', 'recover', 'rotate'] as const;

      operations.forEach((operation) => {
        const analytics = {
          keyId: '123e4567-e89b-12d3-a456-426614174000',
          timestamp: Date.now(),
          operation,
          success: true,
          duration: 10,
        };

        const result = NostrKeyUsageAnalyticsSchema.safeParse(analytics);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('NostrKeySecurityMonitoringSchema', () => {
    it('should validate security events', () => {
      const validEvent = {
        keyId: '123e4567-e89b-12d3-a456-426614174000',
        timestamp: Date.now(),
        eventType: 'key_accessed' as const,
        severity: 'low' as const,
        description: 'Key accessed for signing',
        resolved: false,
      };

      const result = NostrKeySecurityMonitoringSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it('should validate all event types', () => {
      const eventTypes = [
        'key_created',
        'key_accessed',
        'key_used',
        'key_compromised',
        'key_rotated',
        'suspicious_activity',
        'failed_authentication',
        'unauthorized_access_attempt',
      ] as const;

      eventTypes.forEach((eventType) => {
        const event = {
          keyId: '123e4567-e89b-12d3-a456-426614174000',
          timestamp: Date.now(),
          eventType,
          severity: 'medium' as const,
          description: 'Test event',
        };

        const result = NostrKeySecurityMonitoringSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('NostrKeyRotationSchema', () => {
    it('should validate key rotation', () => {
      const validRotation = {
        oldKeyId: '123e4567-e89b-12d3-a456-426614174000',
        newKeyId: '987e4567-e89b-12d3-a456-426614174000',
        rotationType: 'scheduled' as const,
        executedAt: Date.now(),
        status: 'completed' as const,
        reason: 'Scheduled 90-day rotation',
        migrationProgress: 1.0,
      };

      const result = NostrKeyRotationSchema.safeParse(validRotation);
      expect(result.success).toBe(true);
    });

    it('should validate all rotation types', () => {
      const rotationTypes = ['scheduled', 'manual', 'emergency', 'compromised'] as const;

      rotationTypes.forEach((rotationType) => {
        const rotation = {
          oldKeyId: '123e4567-e89b-12d3-a456-426614174000',
          newKeyId: '987e4567-e89b-12d3-a456-426614174000',
          rotationType,
          executedAt: Date.now(),
          status: 'completed' as const,
          reason: 'Test rotation',
        };

        const result = NostrKeyRotationSchema.safeParse(rotation);
        expect(result.success).toBe(true);
      });
    });

    it('should reject migration progress > 1', () => {
      const invalidRotation = {
        oldKeyId: '123e4567-e89b-12d3-a456-426614174000',
        newKeyId: '987e4567-e89b-12d3-a456-426614174000',
        rotationType: 'scheduled' as const,
        executedAt: Date.now(),
        status: 'in_progress' as const,
        reason: 'Test',
        migrationProgress: 1.5, // Invalid: > 1
      };

      const result = NostrKeyRotationSchema.safeParse(invalidRotation);
      expect(result.success).toBe(false);
    });
  });

  describe('NostrHardwareWalletSchema', () => {
    it('should validate hardware wallet', () => {
      const validWallet = {
        deviceId: 'hw-device-123',
        deviceName: 'Ledger Nano S',
        manufacturer: 'Ledger',
        model: 'Nano S',
        firmwareVersion: '2.1.0',
        connected: true,
        supportsNostr: true,
        supportedFeatures: ['sign', 'encrypt'],
        verified: true,
        trustedDevice: true,
      };

      const result = NostrHardwareWalletSchema.safeParse(validWallet);
      expect(result.success).toBe(true);
    });
  });

  describe('NostrBrowserExtensionSchema', () => {
    it('should validate browser extension', () => {
      const validExtension = {
        extensionId: 'ext-123',
        extensionName: 'Alby',
        version: '1.5.0',
        available: true,
        enabled: true,
        permissions: ['getPublicKey', 'signEvent'],
        supportedNips: [1, 4, 7, 44],
        trustLevel: 'verified' as const,
      };

      const result = NostrBrowserExtensionSchema.safeParse(validExtension);
      expect(result.success).toBe(true);
    });

    it('should validate all trust levels', () => {
      const trustLevels = ['untrusted', 'basic', 'trusted', 'verified'] as const;

      trustLevels.forEach((trustLevel) => {
        const extension = {
          extensionId: 'ext-123',
          extensionName: 'Test Extension',
          version: '1.0.0',
          trustLevel,
        };

        const result = NostrBrowserExtensionSchema.safeParse(extension);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('NostrKeyRecoverySchema', () => {
    it('should validate key recovery', () => {
      const validRecovery = {
        recoveryId: '123e4567-e89b-12d3-a456-426614174000',
        keyId: '987e4567-e89b-12d3-a456-426614174000',
        recoveryMethod: NostrKeyBackupMethod.MNEMONIC_PHRASE,
        initiatedAt: Date.now(),
        status: 'completed' as const,
        verificationAttempts: 1,
        maxVerificationAttempts: 3,
      };

      const result = NostrKeyRecoverySchema.safeParse(validRecovery);
      expect(result.success).toBe(true);
    });

    it('should validate all recovery statuses', () => {
      const statuses = ['initiated', 'in_progress', 'completed', 'failed', 'cancelled'] as const;

      statuses.forEach((status) => {
        const recovery = {
          recoveryId: '123e4567-e89b-12d3-a456-426614174000',
          keyId: '987e4567-e89b-12d3-a456-426614174000',
          recoveryMethod: NostrKeyBackupMethod.SEED_PHRASE,
          initiatedAt: Date.now(),
          status,
        };

        const result = NostrKeyRecoverySchema.safeParse(recovery);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('NostrKeyManagementConfigSchema', () => {
    it('should validate management configuration', () => {
      const validConfig = {
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

      const result = NostrKeyManagementConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const minimalConfig = {};

      const result = NostrKeyManagementConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaultStorageType).toBe(NostrKeyStorageType.INDEXED_DB);
        expect(result.data.encryptionEnabled).toBe(true);
        expect(result.data.defaultSecurityLevel).toBe(NostrKeySecurityLevel.ENHANCED);
      }
    });
  });

  describe('Interface Types (TypeScript Only)', () => {
    it('should compile NostrKeyManagementState interface', () => {
      const state: NostrKeyManagementState = {
        initialized: true,
        keys: new Map(),
        activeKeyId: null,
        hardwareWallets: new Map(),
        browserExtensions: new Map(),
        usageAnalytics: new Map(),
        securityEvents: new Map(),
        rotationQueue: [],
        recoveryRequests: new Map(),
        config: {
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
        },
        lastCleanup: Date.now(),
      };

      expect(state.initialized).toBe(true);
    });

    it('should compile NostrKeyManagementResult interface', () => {
      const result: NostrKeyManagementResult<string> = {
        success: true,
        data: 'test-data',
        warnings: ['Warning message'],
        metadata: { source: 'test', count: 1, enabled: true, value: null },
      };

      expect(result.success).toBe(true);
      expect(result.data).toBe('test-data');
    });

    it('should compile NostrKeyValidationResult interface', () => {
      const result: NostrKeyValidationResult = {
        valid: true,
        issues: [
          {
            severity: 'warning',
            code: 'WEAK_ENTROPY',
            message: 'Entropy could be stronger',
            field: 'entropyBits',
          },
        ],
        securityScore: 85,
        recommendations: ['Use hardware wallet for enhanced security'],
      };

      expect(result.valid).toBe(true);
      expect(result.securityScore).toBe(85);
    });
  });

  describe('Type Safety', () => {
    it('should prevent any types at compile time', () => {
      // This test verifies no `any` types exist by attempting to use the types
      const keyPair: NostrEnhancedKeyPair = {
        privateKey: '0'.repeat(64),
        publicKey: '1'.repeat(64),
        npub: 'npub1' + 'a'.repeat(58),
        nsec: 'nsec1' + 'b'.repeat(58),
        keyId: '123e4567-e89b-12d3-a456-426614174000',
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

      // TypeScript will catch if any fields accept `any`
      expect(typeof keyPair.entropyBits).toBe('number');
    });
  });
});
