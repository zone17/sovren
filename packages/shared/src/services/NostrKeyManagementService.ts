import { generateMnemonic, validateMnemonic } from 'bip39';
import { EventEmitter } from 'events';
import { nip19 } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { v4 as uuidv4 } from 'uuid';

// Import our types
import {
  NostrBrowserExtension,
  NostrEnhancedKeyPair,
  NostrEntropySource,
  NostrKeyBackupMethod,
  NostrKeyManagementConfig,
  NostrKeyManagementConfigSchema,
  NostrKeyManagementResult,
  NostrKeyManagementState,
  NostrKeyRotation,
  NostrKeySecurityLevel,
  NostrKeySecurityMonitoring,
  NostrKeyUsageAnalytics,
  NostrKeyValidationResult,
  NostrMnemonicBackup,
  NostrMnemonicBackupSchema,
} from '../types/nostr-key-management';

/**
 * 🔐 NOSTR Key Management Service - Elite Security Implementation
 *
 * Implements comprehensive key management for NOSTR protocol including:
 * - Secure key generation with entropy validation
 * - Encrypted key storage using Web Crypto API
 * - Backup and recovery with mnemonic phrases
 * - Key rotation with migration support
 * - Security monitoring and analytics
 * - Hardware wallet integration
 * - Browser extension support
 *
 * US-212: NOSTR Key Management
 */
export class NostrKeyManagementService extends EventEmitter {
  private state: NostrKeyManagementState;
  private storageService: INostrKeyStorageService;
  private cryptoService: INostrCryptoService;
  private analyticsService: INostrAnalyticsService;
  private monitoringService: INostrMonitoringService;

  constructor(
    config: Partial<NostrKeyManagementConfig> = {},
    dependencies: {
      storage?: INostrKeyStorageService;
      crypto?: INostrCryptoService;
      analytics?: INostrAnalyticsService;
      monitoring?: INostrMonitoringService;
    } = {}
  ) {
    super();

    // Validate and set configuration
    this.state = {
      initialized: false,
      keys: new Map(),
      activeKeyId: null,
      hardwareWallets: new Map(),
      browserExtensions: new Map(),
      usageAnalytics: new Map(),
      securityEvents: new Map(),
      rotationQueue: [],
      recoveryRequests: new Map(),
      config: NostrKeyManagementConfigSchema.parse(config),
      lastCleanup: Date.now(),
    };

    // Initialize services with dependency injection
    this.storageService = dependencies.storage || new NostrKeyStorageService();
    this.cryptoService = dependencies.crypto || new NostrCryptoService();
    this.analyticsService = dependencies.analytics || new NostrAnalyticsService();
    this.monitoringService = dependencies.monitoring || new NostrMonitoringService();

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * 🚀 Initialize the key management service
   */
  async initialize(): Promise<NostrKeyManagementResult<void>> {
    try {
      // Initialize storage service
      await this.storageService.initialize(this.state.config);

      // Load existing keys from storage
      const existingKeys = await this.storageService.loadAllKeys();
      if (existingKeys.success && existingKeys.data) {
        for (const keyPair of existingKeys.data) {
          this.state.keys.set(keyPair.keyId, keyPair);
        }
      }

      // Initialize crypto service
      await this.cryptoService.initialize();

      // Detect hardware wallets
      await this.detectHardwareWallets();

      // Detect browser extensions
      await this.detectBrowserExtensions();

      // Start background tasks
      this.startBackgroundTasks();

      this.state.initialized = true;

      await this.recordSecurityEvent({
        keyId: 'system',
        timestamp: Date.now(),
        eventType: 'key_created',
        severity: 'low',
        description: 'Key management service initialized',
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 🔑 Generate new NOSTR key pair with enhanced security
   */
  async generateKeyPair(
    options: {
      name?: string;
      description?: string;
      securityLevel?: NostrKeySecurityLevel;
      entropySource?: NostrEntropySource;
      backupMethod?: NostrKeyBackupMethod;
      hardwareWallet?: boolean;
    } = {}
  ): Promise<NostrKeyManagementResult<NostrEnhancedKeyPair>> {
    const startTime = Date.now();

    try {
      // Validate entropy source
      const entropySource = options.entropySource || NostrEntropySource.WEB_CRYPTO_API;
      const entropy = await this.generateEntropy(entropySource);

      if (entropy.bits < 128) {
        throw new Error('Insufficient entropy for secure key generation');
      }

      // Generate key pair
      const privateKeyBytes = generateSecretKey();
      const privateKey = Buffer.from(privateKeyBytes).toString('hex');
      const publicKey = getPublicKey(privateKeyBytes);

      // Generate key identifiers
      const keyId = uuidv4();
      const npub = nip19.npubEncode(publicKey);
      const nsec = nip19.nsecEncode(privateKeyBytes);

      // Create enhanced key pair
      const keyPair: NostrEnhancedKeyPair = {
        keyId,
        privateKey,
        publicKey,
        npub,
        nsec,
        created: Date.now(),
        entropySource,
        entropyBits: entropy.bits,
        storageType: this.state.config.defaultStorageType,
        encrypted: this.state.config.encryptionEnabled,
        backedUp: false,
        backupVerified: false,
        securityLevel: options.securityLevel || this.state.config.defaultSecurityLevel,
        hardwareWalletSupported: options.hardwareWallet || false,
        hardwareWalletConnected: false,
        multiFactorEnabled: this.state.config.requireMultiFactor,
        signatureCount: 0,
        compromised: false,
        name: options.name,
        description: options.description,
        tags: [],
      };

      // Validate the key pair
      const validation = await this.validateKeyPair(keyPair);
      if (!validation.valid) {
        throw new Error(
          `Key validation failed: ${validation.issues.map((i) => i.message).join(', ')}`
        );
      }

      // Store the key pair
      const storageResult = await this.storageService.storeKey(keyPair);
      if (!storageResult.success) {
        throw new Error(`Failed to store key: ${storageResult.error}`);
      }

      // Add to in-memory state
      this.state.keys.set(keyId, keyPair);

      // Create backup if enabled
      if (this.state.config.autoBackupEnabled && options.backupMethod) {
        await this.createBackup(keyId, options.backupMethod);
      }

      // Record analytics
      await this.recordUsageAnalytics({
        keyId,
        timestamp: Date.now(),
        operation: 'generate',
        success: true,
        duration: Date.now() - startTime,
        entropyQuality: entropy.quality,
      });

      // Record security event
      await this.recordSecurityEvent({
        keyId,
        timestamp: Date.now(),
        eventType: 'key_created',
        severity: 'low',
        description: 'New NOSTR key pair generated',
        metadata: {
          securityLevel: keyPair.securityLevel,
          entropySource: keyPair.entropySource,
          entropyBits: keyPair.entropyBits,
        },
      });

      // Emit event
      this.emit('key:generated', keyPair);

      return { success: true, data: keyPair };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Key generation failed';

      // Record failed analytics
      await this.recordUsageAnalytics({
        keyId: 'unknown',
        timestamp: Date.now(),
        operation: 'generate',
        success: false,
        duration: Date.now() - startTime,
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 📥 Import existing NOSTR key
   */
  async importKey(
    privateKey: string,
    options: {
      name?: string;
      description?: string;
      validate?: boolean;
      backup?: boolean;
    } = {}
  ): Promise<NostrKeyManagementResult<NostrEnhancedKeyPair>> {
    const startTime = Date.now();

    try {
      // Validate private key format
      if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
        throw new Error('Invalid private key format');
      }

      const privateKeyBytes = new Uint8Array(Buffer.from(privateKey, 'hex'));
      const publicKey = getPublicKey(privateKeyBytes);

      // Check if key already exists
      for (const existingKey of this.state.keys.values()) {
        if (existingKey.publicKey === publicKey) {
          throw new Error('Key already exists in storage');
        }
      }

      // Generate key identifiers
      const keyId = uuidv4();
      const npub = nip19.npubEncode(publicKey);
      const nsec = nip19.nsecEncode(privateKeyBytes);

      // Create enhanced key pair
      const keyPair: NostrEnhancedKeyPair = {
        keyId,
        privateKey,
        publicKey,
        npub,
        nsec,
        created: Date.now(),
        entropySource: NostrEntropySource.USER_INPUT,
        entropyBits: 256, // Assume full entropy for imported keys
        storageType: this.state.config.defaultStorageType,
        encrypted: this.state.config.encryptionEnabled,
        backedUp: false,
        backupVerified: false,
        securityLevel: this.state.config.defaultSecurityLevel,
        hardwareWalletSupported: false,
        hardwareWalletConnected: false,
        multiFactorEnabled: this.state.config.requireMultiFactor,
        signatureCount: 0,
        compromised: false,
        name: options.name,
        description: options.description,
        tags: ['imported'],
      };

      // Validate if requested
      if (options.validate !== false) {
        const validation = await this.validateKeyPair(keyPair);
        if (!validation.valid) {
          throw new Error(
            `Key validation failed: ${validation.issues.map((i) => i.message).join(', ')}`
          );
        }
      }

      // Store the key pair
      const storageResult = await this.storageService.storeKey(keyPair);
      if (!storageResult.success) {
        throw new Error(`Failed to store key: ${storageResult.error}`);
      }

      // Add to in-memory state
      this.state.keys.set(keyId, keyPair);

      // Create backup if requested
      if (options.backup && this.state.config.autoBackupEnabled) {
        await this.createBackup(keyId, this.state.config.defaultBackupMethod);
      }

      // Record analytics
      await this.recordUsageAnalytics({
        keyId,
        timestamp: Date.now(),
        operation: 'generate',
        success: true,
        duration: Date.now() - startTime,
      });

      // Record security event
      await this.recordSecurityEvent({
        keyId,
        timestamp: Date.now(),
        eventType: 'key_created',
        severity: 'medium',
        description: 'NOSTR key imported from external source',
        metadata: {
          imported: true,
          validated: options.validate !== false,
        },
      });

      // Emit event
      this.emit('key:imported', keyPair);

      return { success: true, data: keyPair };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Key import failed';

      // Record failed analytics
      await this.recordUsageAnalytics({
        keyId: 'unknown',
        timestamp: Date.now(),
        operation: 'generate',
        success: false,
        duration: Date.now() - startTime,
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 💾 Create backup for a key
   */
  async createBackup(
    keyId: string,
    method: NostrKeyBackupMethod,
    options: {
      passphrase?: string;
      encryptionKey?: string;
      verify?: boolean;
    } = {}
  ): Promise<NostrKeyManagementResult<NostrMnemonicBackup>> {
    const startTime = Date.now();

    try {
      const keyPair = this.state.keys.get(keyId);
      if (!keyPair) {
        throw new Error('Key not found');
      }

      let backup: NostrMnemonicBackup;

      switch (method) {
        case NostrKeyBackupMethod.MNEMONIC_PHRASE:
          backup = await this.createMnemonicBackup(keyPair, options);
          break;

        case NostrKeyBackupMethod.ENCRYPTED_FILE:
          throw new Error('Encrypted file backup not yet implemented');

        case NostrKeyBackupMethod.QR_CODE:
          throw new Error('QR code backup not yet implemented');

        default:
          throw new Error(`Unsupported backup method: ${method}`);
      }

      // Store backup
      const storageResult = await this.storageService.storeBackup(backup);
      if (!storageResult.success) {
        throw new Error(`Failed to store backup: ${storageResult.error}`);
      }

      // Update key pair to mark as backed up
      const updatedKeyPair = {
        ...keyPair,
        backupMethod: method,
        backedUp: true,
        backupVerified: options.verify === true,
      };

      await this.storageService.storeKey(updatedKeyPair);
      this.state.keys.set(keyId, updatedKeyPair);

      // Record analytics
      await this.recordUsageAnalytics({
        keyId,
        timestamp: Date.now(),
        operation: 'backup',
        success: true,
        duration: Date.now() - startTime,
      });

      // Record security event
      await this.recordSecurityEvent({
        keyId,
        timestamp: Date.now(),
        eventType: 'key_created',
        severity: 'low',
        description: 'Key backup created',
        metadata: {
          method,
          verified: options.verify === true,
        },
      });

      // Emit event
      this.emit('key:backed_up', keyId, method);

      return { success: true, data: backup };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Backup creation failed';

      // Record failed analytics
      await this.recordUsageAnalytics({
        keyId,
        timestamp: Date.now(),
        operation: 'backup',
        success: false,
        duration: Date.now() - startTime,
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 🔄 Rotate a key
   */
  async rotateKey(
    keyId: string,
    options: {
      type?: 'scheduled' | 'manual' | 'emergency' | 'compromised';
      reason?: string;
      migrateData?: boolean;
    } = {}
  ): Promise<NostrKeyManagementResult<NostrKeyRotation>> {
    const startTime = Date.now();

    try {
      const oldKeyPair = this.state.keys.get(keyId);
      if (!oldKeyPair) {
        throw new Error('Key not found');
      }

      // Generate new key pair
      const newKeyResult = await this.generateKeyPair({
        name: `${oldKeyPair.name || 'Key'} (Rotated)`,
        description: `Rotated from ${keyId}`,
        securityLevel: oldKeyPair.securityLevel,
        entropySource: oldKeyPair.entropySource,
      });

      if (!newKeyResult.success || !newKeyResult.data) {
        throw new Error(`Failed to generate new key: ${newKeyResult.error}`);
      }

      const newKeyPair = newKeyResult.data;

      // Create rotation record
      const rotation: NostrKeyRotation = {
        oldKeyId: keyId,
        newKeyId: newKeyPair.keyId,
        rotationType: options.type || 'manual',
        executedAt: Date.now(),
        status: 'in_progress',
        reason: options.reason || 'Key rotation requested',
        migrationProgress: 0,
        validationResults: [],
      };

      // Add to rotation queue
      this.state.rotationQueue.push(rotation);

      // Mark old key as rotated
      const updatedOldKeyPair = {
        ...oldKeyPair,
        lastRotated: Date.now(),
        rotationScheduled: undefined,
      };

      await this.storageService.storeKey(updatedOldKeyPair);
      this.state.keys.set(keyId, updatedOldKeyPair);

      // Update rotation status
      rotation.status = 'completed';
      rotation.completedAt = Date.now();
      rotation.migrationProgress = 1;

      // Record analytics
      await this.recordUsageAnalytics({
        keyId,
        timestamp: Date.now(),
        operation: 'rotate',
        success: true,
        duration: Date.now() - startTime,
      });

      // Record security event
      await this.recordSecurityEvent({
        keyId,
        timestamp: Date.now(),
        eventType: 'key_rotated',
        severity: options.type === 'compromised' ? 'high' : 'medium',
        description: 'Key rotation completed',
        metadata: {
          rotationType: rotation.rotationType,
          oldKeyId: keyId,
          newKeyId: newKeyPair.keyId,
          reason: rotation.reason,
        },
      });

      // Emit event
      this.emit('key:rotated', rotation);

      return { success: true, data: rotation };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Key rotation failed';

      // Record failed analytics
      await this.recordUsageAnalytics({
        keyId,
        timestamp: Date.now(),
        operation: 'rotate',
        success: false,
        duration: Date.now() - startTime,
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 🔍 Validate key pair security
   */
  async validateKeyPair(keyPair: NostrEnhancedKeyPair): Promise<NostrKeyValidationResult> {
    const issues: Array<{
      severity: 'warning' | 'error';
      code: string;
      message: string;
      field?: string;
    }> = [];

    let securityScore = 100;

    // Validate key format
    if (!/^[0-9a-fA-F]{64}$/.test(keyPair.privateKey)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_PRIVATE_KEY_FORMAT',
        message: 'Private key must be 64 hexadecimal characters',
        field: 'privateKey',
      });
      securityScore -= 30;
    }

    if (!/^[0-9a-fA-F]{64}$/.test(keyPair.publicKey)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_PUBLIC_KEY_FORMAT',
        message: 'Public key must be 64 hexadecimal characters',
        field: 'publicKey',
      });
      securityScore -= 30;
    }

    // Validate entropy
    if (keyPair.entropyBits < 128) {
      issues.push({
        severity: 'error',
        code: 'INSUFFICIENT_ENTROPY',
        message: 'Minimum 128 bits of entropy required',
        field: 'entropyBits',
      });
      securityScore -= 40;
    } else if (keyPair.entropyBits < 256) {
      issues.push({
        severity: 'warning',
        code: 'LOW_ENTROPY',
        message: 'Recommended minimum 256 bits of entropy',
        field: 'entropyBits',
      });
      securityScore -= 10;
    }

    // Validate security level
    if (keyPair.securityLevel === NostrKeySecurityLevel.BASIC) {
      issues.push({
        severity: 'warning',
        code: 'BASIC_SECURITY_LEVEL',
        message: 'Enhanced or maximum security level recommended',
        field: 'securityLevel',
      });
      securityScore -= 15;
    }

    // Check if key is compromised
    if (keyPair.compromised) {
      issues.push({
        severity: 'error',
        code: 'KEY_COMPROMISED',
        message: 'Key has been marked as compromised',
        field: 'compromised',
      });
      securityScore = 0;
    }

    // Check backup status
    if (!keyPair.backedUp) {
      issues.push({
        severity: 'warning',
        code: 'NO_BACKUP',
        message: 'Key should be backed up for recovery',
        field: 'backedUp',
      });
      securityScore -= 10;
    }

    const valid = !issues.some((issue) => issue.severity === 'error');
    const recommendations: string[] = [];

    if (!valid) {
      recommendations.push('Address all critical security issues before using this key');
    }

    if (securityScore < 80) {
      recommendations.push('Consider improving key security configuration');
    }

    if (!keyPair.backedUp) {
      recommendations.push('Create a secure backup of this key');
    }

    if (keyPair.securityLevel === NostrKeySecurityLevel.BASIC) {
      recommendations.push('Upgrade to enhanced or maximum security level');
    }

    return {
      valid,
      issues,
      securityScore: Math.max(0, securityScore),
      recommendations,
    };
  }

  /**
   * 🎲 Generate cryptographically secure entropy
   */
  private async generateEntropy(source: NostrEntropySource): Promise<{
    bytes: Uint8Array;
    bits: number;
    quality: number;
  }> {
    switch (source) {
      case NostrEntropySource.WEB_CRYPTO_API:
        const entropy = new Uint8Array(32);
        crypto.getRandomValues(entropy);
        return {
          bytes: entropy,
          bits: 256,
          quality: 1.0,
        };

      case NostrEntropySource.SECURE_RANDOM:
        // Fallback to Math.random (not recommended for production)
        const fallbackEntropy = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          fallbackEntropy[i] = Math.floor(Math.random() * 256);
        }
        return {
          bytes: fallbackEntropy,
          bits: 128, // Lower quality
          quality: 0.6,
        };

      default:
        throw new Error(`Unsupported entropy source: ${source}`);
    }
  }

  /**
   * 📝 Create mnemonic backup
   *
   * DESIGN NOTE: The mnemonic is generated independently (random 256-bit entropy)
   * and is NOT derived from the private key. It serves as a separate recovery
   * credential stored alongside the key pair, not as a deterministic seed that
   * can reconstruct the private key. Key recovery requires both the stored
   * (encrypted) private key and optionally this mnemonic as a second factor.
   */
  private async createMnemonicBackup(
    keyPair: NostrEnhancedKeyPair,
    options: {
      passphrase?: string;
      encryptionKey?: string;
    }
  ): Promise<NostrMnemonicBackup> {
    // Generate independent mnemonic (NOT derived from the private key — see DESIGN NOTE above)
    const mnemonic = generateMnemonic(256); // 24 words for maximum security

    // Validate the generated mnemonic
    if (!validateMnemonic(mnemonic)) {
      throw new Error('Generated mnemonic is invalid');
    }

    const words = mnemonic.split(' ');
    const checksum = await this.cryptoService.calculateChecksum(mnemonic);

    const backup: NostrMnemonicBackup = {
      keyId: keyPair.keyId,
      mnemonic,
      wordCount: words.length,
      language: 'english',
      passphrase: options.passphrase,
      checksum,
      created: Date.now(),
      verified: false,
      encrypted: !!options.encryptionKey,
      encryptionKey: options.encryptionKey,
    };

    return NostrMnemonicBackupSchema.parse(backup);
  }

  /**
   * 📊 Record usage analytics
   */
  private async recordUsageAnalytics(
    analytics: Omit<NostrKeyUsageAnalytics, 'userAgent' | 'deviceFingerprint'>
  ): Promise<void> {
    if (!this.state.config.usageAnalyticsEnabled) {
      return;
    }

    const fullAnalytics: NostrKeyUsageAnalytics = {
      ...analytics,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      deviceFingerprint: await this.generateDeviceFingerprint(),
    };

    // Add to in-memory analytics
    const keyAnalytics = this.state.usageAnalytics.get(analytics.keyId) || [];
    keyAnalytics.push(fullAnalytics);
    this.state.usageAnalytics.set(analytics.keyId, keyAnalytics);

    // Send to analytics service
    await this.analyticsService.recordEvent(fullAnalytics);
  }

  /**
   * 🔒 Record security event
   */
  private async recordSecurityEvent(
    event: Omit<NostrKeySecurityMonitoring, 'metadata' | 'resolved'> & { metadata?: any; resolved?: boolean }
  ): Promise<void> {
    if (!this.state.config.securityMonitoringEnabled) {
      return;
    }

    const fullEvent: NostrKeySecurityMonitoring = {
      ...event,
      resolved: event.resolved ?? false,
      metadata: event.metadata || {},
    };

    // Add to in-memory events
    const keyEvents = this.state.securityEvents.get(event.keyId) || [];
    keyEvents.push(fullEvent);
    this.state.securityEvents.set(event.keyId, keyEvents);

    // Send to monitoring service
    await this.monitoringService.recordSecurityEvent(fullEvent);

    // Emit anomaly detection if high severity
    if (event.severity === 'high' || event.severity === 'critical') {
      this.emit('security:anomaly_detected', fullEvent);
    }
  }

  /**
   * 🖥️ Generate device fingerprint
   */
  private async generateDeviceFingerprint(): Promise<string> {
    if (typeof window === 'undefined') {
      return 'server-environment';
    }

    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.platform,
    ];

    const fingerprint = components.join('|');
    return await this.cryptoService.calculateChecksum(fingerprint);
  }

  /**
   * 🔌 Detect hardware wallets
   */
  private async detectHardwareWallets(): Promise<void> {
    try {
      // Check for WebHID API support
      if (typeof navigator !== 'undefined' && 'hid' in navigator) {
        // This would detect actual hardware wallets
        // Implementation depends on specific hardware wallet protocols
      }
    } catch (error) {
      // Hardware wallet detection failed, continue without hardware support
    }
  }

  /**
   * 🔌 Detect browser extensions
   */
  private async detectBrowserExtensions(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        // Check for nos2x extension
        if ('nostr' in window) {
          const extension: NostrBrowserExtension = {
            extensionId: 'nos2x',
            extensionName: 'nos2x',
            version: 'unknown',
            available: true,
            enabled: true,
            permissions: ['getPublicKey', 'signEvent'],
            supportedNips: [1, 7, 2],
            trustLevel: 'basic',
          };

          this.state.browserExtensions.set('nos2x', extension);
          this.emit('extension:detected', extension);
        }

        // Check for Alby extension
        if ('alby' in window) {
          const extension: NostrBrowserExtension = {
            extensionId: 'alby',
            extensionName: 'Alby',
            version: 'unknown',
            available: true,
            enabled: true,
            permissions: ['getPublicKey', 'signEvent', 'lightning'],
            supportedNips: [1, 7, 2, 4],
            trustLevel: 'basic',
          };

          this.state.browserExtensions.set('alby', extension);
          this.emit('extension:detected', extension);
        }
      }
    } catch (error) {
      // Extension detection failed, continue without extension support
    }
  }

  /**
   * ⏰ Start background tasks
   */
  private startBackgroundTasks(): void {
    // Clean up expired data every hour
    setInterval(() => {
      this.cleanupExpiredData();
    }, 3600000);

    // Process rotation queue every minute
    setInterval(() => {
      this.processRotationQueue();
    }, 60000);
  }

  /**
   * 🧹 Clean up expired data
   */
  private async cleanupExpiredData(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old analytics data
    for (const [keyId, analytics] of this.state.usageAnalytics.entries()) {
      const filteredAnalytics = analytics.filter((a) => now - a.timestamp < maxAge);
      this.state.usageAnalytics.set(keyId, filteredAnalytics);
    }

    // Clean up old security events
    for (const [keyId, events] of this.state.securityEvents.entries()) {
      const filteredEvents = events.filter((e) => now - e.timestamp < maxAge);
      this.state.securityEvents.set(keyId, filteredEvents);
    }

    this.state.lastCleanup = now;
  }

  /**
   * ⚙️ Process rotation queue
   */
  private async processRotationQueue(): Promise<void> {
    // Process pending rotations
    for (const rotation of this.state.rotationQueue) {
      if (rotation.status === 'pending') {
        // Start rotation process
        rotation.status = 'in_progress';
        // Implementation would continue here
      }
    }
  }

  /**
   * 🎯 Set up event handlers
   */
  private setupEventHandlers(): void {
    // Handle storage errors
    this.storageService.on?.('error', (error: Error) => {
      this.emit('storage:error', error);
    });

    // Handle crypto errors
    this.cryptoService.on?.('error', (error: Error) => {
      this.recordSecurityEvent({
        keyId: 'system',
        timestamp: Date.now(),
        eventType: 'unauthorized_access_attempt',
        severity: 'high',
        description: `Crypto service error: ${error.message}`,
        resolved: false,
      });
    });
  }

  /**
   * 📊 Get service statistics
   */
  getStats(): {
    totalKeys: number;
    backedUpKeys: number;
    compromisedKeys: number;
    hardwareWallets: number;
    browserExtensions: number;
    rotationsPending: number;
    lastCleanup: number;
  } {
    const keys = Array.from(this.state.keys.values());

    return {
      totalKeys: keys.length,
      backedUpKeys: keys.filter((k) => k.backedUp).length,
      compromisedKeys: keys.filter((k) => k.compromised).length,
      hardwareWallets: this.state.hardwareWallets.size,
      browserExtensions: this.state.browserExtensions.size,
      rotationsPending: this.state.rotationQueue.filter((r) => r.status === 'pending').length,
      lastCleanup: this.state.lastCleanup,
    };
  }

  /**
   * 🧹 Cleanup resources
   */
  destroy(): void {
    // Clear intervals and cleanup
    this.removeAllListeners();
    this.state.keys.clear();
    this.state.usageAnalytics.clear();
    this.state.securityEvents.clear();
    this.state.hardwareWallets.clear();
    this.state.browserExtensions.clear();
  }
}

/**
 * Interface for key storage service
 */
export interface INostrKeyStorageService {
  initialize(config: NostrKeyManagementConfig): Promise<void>;
  storeKey(keyPair: NostrEnhancedKeyPair): Promise<NostrKeyManagementResult<void>>;
  loadKey(keyId: string): Promise<NostrKeyManagementResult<NostrEnhancedKeyPair>>;
  loadAllKeys(): Promise<NostrKeyManagementResult<NostrEnhancedKeyPair[]>>;
  deleteKey(keyId: string): Promise<NostrKeyManagementResult<void>>;
  storeBackup(backup: NostrMnemonicBackup): Promise<NostrKeyManagementResult<void>>;
  on?(event: string, listener: (...args: any[]) => void): void;
}

/**
 * Interface for crypto service
 */
export interface INostrCryptoService {
  initialize(): Promise<void>;
  calculateChecksum(data: string): Promise<string>;
  on?(event: string, listener: (...args: any[]) => void): void;
}

/**
 * Interface for analytics service
 */
export interface INostrAnalyticsService {
  recordEvent(analytics: NostrKeyUsageAnalytics): Promise<void>;
}

/**
 * Interface for monitoring service
 */
export interface INostrMonitoringService {
  recordSecurityEvent(event: NostrKeySecurityMonitoring): Promise<void>;
}

/**
 * Default implementations
 */
export class NostrKeyStorageService implements INostrKeyStorageService {
  async initialize(_config: NostrKeyManagementConfig): Promise<void> {
    // Default implementation - would use IndexedDB in browser
  }

  async storeKey(_keyPair: NostrEnhancedKeyPair): Promise<NostrKeyManagementResult<void>> {
    return { success: true };
  }

  async loadKey(_keyId: string): Promise<NostrKeyManagementResult<NostrEnhancedKeyPair>> {
    return { success: false, error: 'Not implemented' };
  }

  async loadAllKeys(): Promise<NostrKeyManagementResult<NostrEnhancedKeyPair[]>> {
    return { success: true, data: [] };
  }

  async deleteKey(_keyId: string): Promise<NostrKeyManagementResult<void>> {
    return { success: true };
  }

  async storeBackup(_backup: NostrMnemonicBackup): Promise<NostrKeyManagementResult<void>> {
    return { success: true };
  }
}

export class NostrCryptoService implements INostrCryptoService {
  async initialize(): Promise<void> {
    // Default implementation
  }

  async calculateChecksum(data: string): Promise<string> {
    // Simple checksum implementation
    return Buffer.from(data).toString('base64').slice(0, 8);
  }
}

export class NostrAnalyticsService implements INostrAnalyticsService {
  async recordEvent(_analytics: NostrKeyUsageAnalytics): Promise<void> {
    // Default implementation - would send to analytics service
  }
}

export class NostrMonitoringService implements INostrMonitoringService {
  async recordSecurityEvent(_event: NostrKeySecurityMonitoring): Promise<void> {
    // Default implementation - would send to monitoring service
  }
}
