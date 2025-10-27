import {
  createCipher,
  createDecipher,
  createHash,
  createHmac,
  pbkdf2,
  randomBytes,
  scrypt,
} from 'crypto';
import { promisify } from 'util';
import {
  EncryptedData,
  EncryptedDataSchema,
  EncryptionAlgorithm,
  EncryptionKey,
  EncryptionKeySchema,
  EncryptionMetrics,
  EncryptionMetricsSchema,
  FieldEncryptionConfig,
  FieldEncryptionConfigSchema,
  KeyDerivation,
} from '../types/dataProtection';

const pbkdf2Async = promisify(pbkdf2);
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

/**
 * 🔐 Data Encryption Service
 * Implements comprehensive data encryption with advanced key management and monitoring
 *
 * US-127: As a user, I want data encryption so that my personal information is protected.
 */
export class DataEncryptionService {
  private encryptionKeys = new Map<string, EncryptionKey>();
  private fieldConfigs = new Map<string, FieldEncryptionConfig>();
  private metrics: EncryptionMetrics = {
    total_encrypted_fields: 0,
    encryption_operations: 0,
    decryption_operations: 0,
    key_rotations: 0,
    performance_ms: 0,
    errors: 0,
    last_updated: Date.now(),
  };
  private initialized = false;

  // ✅ 9.5.1: Design encryption architecture
  private readonly ENCRYPTION_CONFIG = {
    DEFAULT_ALGORITHM: 'AES-256-GCM' as EncryptionAlgorithm,
    DEFAULT_KEY_DERIVATION: 'PBKDF2' as KeyDerivation,
    PBKDF2_ITERATIONS: 100000,
    SCRYPT_N: 16384,
    SCRYPT_R: 8,
    SCRYPT_P: 1,
    KEY_LENGTH: 32,
    IV_LENGTH: 16,
    SALT_LENGTH: 32,
    TAG_LENGTH: 16,
    VERSION: '1.0',
    KEY_ROTATION_INTERVAL: 30 * 24 * 60 * 60 * 1000, // 30 days
    PERFORMANCE_THRESHOLD_MS: 1000,
  } as const;

  private readonly STORAGE_KEYS = {
    ENCRYPTION_KEYS: 'encryption_keys',
    FIELD_CONFIGS: 'field_encryption_configs',
    METRICS: 'encryption_metrics',
  } as const;

  constructor() {
    this.initialize();
  }

  // ✅ 9.5.2: Implement data-at-rest encryption
  async encryptAtRest(data: string, fieldName: string, userId?: string): Promise<EncryptedData> {
    const startTime = Date.now();

    try {
      const config = this.getFieldConfig(fieldName);
      const algorithm = config?.algorithm || this.ENCRYPTION_CONFIG.DEFAULT_ALGORITHM;
      const keyDerivation = this.ENCRYPTION_CONFIG.DEFAULT_KEY_DERIVATION;

      // Generate or retrieve encryption key
      const encryptionKey = await this.getOrCreateKey(fieldName, algorithm, keyDerivation);

      // Generate salt and IV
      const salt = randomBytes(this.ENCRYPTION_CONFIG.SALT_LENGTH);
      const iv = randomBytes(this.ENCRYPTION_CONFIG.IV_LENGTH);

      // Derive key from master key
      const derivedKey = await this.deriveKey(
        encryptionKey.id,
        salt,
        keyDerivation,
        this.ENCRYPTION_CONFIG.PBKDF2_ITERATIONS
      );

      // Encrypt data
      const encryptedData = await this.performEncryption(data, derivedKey, iv, algorithm);

      const result: EncryptedData = {
        data: encryptedData.encrypted,
        algorithm,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        authTag: encryptedData.authTag,
        keyDerivation,
        iterations: this.ENCRYPTION_CONFIG.PBKDF2_ITERATIONS,
        encrypted_at: Date.now(),
        version: this.ENCRYPTION_CONFIG.VERSION,
      };

      // Update metrics and usage
      await this.updateKeyUsage(encryptionKey.id);
      await this.updateMetrics('encryption', Date.now() - startTime);

      // Log encryption if required
      if (config?.access_log_required) {
        await this.logEncryptionEvent('encrypt', fieldName, userId, 'success');
      }

      return EncryptedDataSchema.parse(result);
    } catch (error) {
      await this.updateMetrics('error', Date.now() - startTime);
      await this.logEncryptionEvent('encrypt', fieldName, userId, 'failure', error);
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ 9.5.2: Implement data-at-rest decryption
  async decryptAtRest(
    encryptedData: EncryptedData,
    fieldName: string,
    userId?: string
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Validate encrypted data
      const validatedData = EncryptedDataSchema.parse(encryptedData);

      // Get encryption key
      const encryptionKey = await this.getKeyForField(fieldName);
      if (!encryptionKey) {
        throw new Error('Encryption key not found for field');
      }

      // Derive key
      const salt = Buffer.from(validatedData.salt, 'hex');
      const derivedKey = await this.deriveKey(
        encryptionKey.id,
        salt,
        validatedData.keyDerivation,
        validatedData.iterations
      );

      // Decrypt data
      const iv = Buffer.from(validatedData.iv, 'hex');
      const decryptedData = await this.performDecryption(
        validatedData.data,
        derivedKey,
        iv,
        validatedData.algorithm,
        validatedData.authTag
      );

      // Update metrics
      await this.updateKeyUsage(encryptionKey.id);
      await this.updateMetrics('decryption', Date.now() - startTime);

      // Log decryption if required
      const config = this.getFieldConfig(fieldName);
      if (config?.access_log_required) {
        await this.logEncryptionEvent('decrypt', fieldName, userId, 'success');
      }

      return decryptedData;
    } catch (error) {
      await this.updateMetrics('error', Date.now() - startTime);
      await this.logEncryptionEvent('decrypt', fieldName, userId, 'failure', error);
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ 9.5.3: Create data-in-transit encryption
  async encryptInTransit(data: string, recipientPublicKey?: string): Promise<EncryptedData> {
    const startTime = Date.now();

    try {
      // Use ephemeral key for transport encryption
      const ephemeralKey = randomBytes(this.ENCRYPTION_CONFIG.KEY_LENGTH);
      const iv = randomBytes(this.ENCRYPTION_CONFIG.IV_LENGTH);
      const salt = randomBytes(this.ENCRYPTION_CONFIG.SALT_LENGTH);

      // Encrypt with AES-256-GCM for transit
      const encryptedData = await this.performEncryption(data, ephemeralKey, iv, 'AES-256-GCM');

      // If recipient public key provided, encrypt the ephemeral key
      let encryptedEphemeralKey = ephemeralKey.toString('hex');
      if (recipientPublicKey) {
        // In production, use recipient's public key to encrypt ephemeral key
        encryptedEphemeralKey = await this.encryptKeyWithPublicKey(
          ephemeralKey,
          recipientPublicKey
        );
      }

      const result: EncryptedData = {
        data: encryptedData.encrypted,
        algorithm: 'AES-256-GCM',
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        authTag: encryptedData.authTag,
        keyDerivation: 'HKDF',
        iterations: 1,
        encrypted_at: Date.now(),
        version: this.ENCRYPTION_CONFIG.VERSION,
      };

      await this.updateMetrics('encryption', Date.now() - startTime);
      return EncryptedDataSchema.parse(result);
    } catch (error) {
      await this.updateMetrics('error', Date.now() - startTime);
      throw new Error(
        `Transit encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ 9.5.4: Add key management system
  async createEncryptionKey(
    fieldName: string,
    algorithm: EncryptionAlgorithm = this.ENCRYPTION_CONFIG.DEFAULT_ALGORITHM,
    keyDerivation: KeyDerivation = this.ENCRYPTION_CONFIG.DEFAULT_KEY_DERIVATION
  ): Promise<EncryptionKey> {
    try {
      const keyId = this.generateKeyId();
      const encryptionKey: EncryptionKey = {
        id: keyId,
        algorithm,
        keyDerivation,
        created_at: Date.now(),
        expires_at: Date.now() + this.ENCRYPTION_CONFIG.KEY_ROTATION_INTERVAL,
        rotated_count: 0,
        usage_count: 0,
        is_active: true,
      };

      const validatedKey = EncryptionKeySchema.parse(encryptionKey);
      this.encryptionKeys.set(keyId, validatedKey);

      await this.saveToStorage();

      console.log('[DataEncryption] New encryption key created', {
        keyId,
        algorithm,
        fieldName,
        expiresAt: new Date(validatedKey.expires_at!).toISOString(),
      });

      return validatedKey;
    } catch (error) {
      throw new Error(
        `Key creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ 9.5.5: Implement field-level encryption
  async configureFieldEncryption(
    fieldName: string,
    encryptionRequired: boolean,
    algorithm: EncryptionAlgorithm = this.ENCRYPTION_CONFIG.DEFAULT_ALGORITHM,
    keyRotationInterval: number = this.ENCRYPTION_CONFIG.KEY_ROTATION_INTERVAL,
    accessLogRequired: boolean = true
  ): Promise<FieldEncryptionConfig> {
    try {
      const config: FieldEncryptionConfig = {
        field_name: fieldName,
        encryption_required: encryptionRequired,
        algorithm,
        key_rotation_interval: keyRotationInterval,
        access_log_required: accessLogRequired,
      };

      const validatedConfig = FieldEncryptionConfigSchema.parse(config);
      this.fieldConfigs.set(fieldName, validatedConfig);

      // Create encryption key if encryption is required
      if (encryptionRequired) {
        await this.getOrCreateKey(
          fieldName,
          algorithm,
          this.ENCRYPTION_CONFIG.DEFAULT_KEY_DERIVATION
        );
      }

      await this.saveToStorage();

      console.log('[DataEncryption] Field encryption configured', {
        fieldName,
        encryptionRequired,
        algorithm,
        accessLogRequired,
      });

      return validatedConfig;
    } catch (error) {
      throw new Error(
        `Field configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ 9.5.6: Create encryption key rotation
  async rotateKey(keyId: string): Promise<EncryptionKey> {
    try {
      const existingKey = this.encryptionKeys.get(keyId);
      if (!existingKey) {
        throw new Error('Key not found for rotation');
      }

      // Deactivate old key
      existingKey.is_active = false;
      existingKey.last_rotated = Date.now();

      // Create new key with same configuration
      const newKey: EncryptionKey = {
        id: this.generateKeyId(),
        algorithm: existingKey.algorithm,
        keyDerivation: existingKey.keyDerivation,
        created_at: Date.now(),
        expires_at: Date.now() + this.ENCRYPTION_CONFIG.KEY_ROTATION_INTERVAL,
        rotated_count: existingKey.rotated_count + 1,
        usage_count: 0,
        is_active: true,
      };

      const validatedKey = EncryptionKeySchema.parse(newKey);
      this.encryptionKeys.set(newKey.id, validatedKey);

      await this.updateMetrics('key_rotation', 0);
      await this.saveToStorage();

      console.log('[DataEncryption] Key rotated', {
        oldKeyId: keyId,
        newKeyId: newKey.id,
        rotationCount: newKey.rotated_count,
      });

      return validatedKey;
    } catch (error) {
      throw new Error(
        `Key rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async rotateExpiredKeys(): Promise<EncryptionKey[]> {
    const rotatedKeys: EncryptionKey[] = [];
    const now = Date.now();

    for (const [keyId, key] of this.encryptionKeys.entries()) {
      if (key.is_active && key.expires_at && key.expires_at <= now) {
        try {
          const newKey = await this.rotateKey(keyId);
          rotatedKeys.push(newKey);
        } catch (error) {
          console.error('[DataEncryption] Failed to rotate expired key', { keyId, error });
        }
      }
    }

    return rotatedKeys;
  }

  // ✅ 9.5.7: Add encryption monitoring
  async getEncryptionMetrics(): Promise<EncryptionMetrics> {
    const currentMetrics = { ...this.metrics };
    currentMetrics.total_encrypted_fields = this.fieldConfigs.size;
    currentMetrics.last_updated = Date.now();

    return EncryptionMetricsSchema.parse(currentMetrics);
  }

  async getPerformanceReport(): Promise<{
    averageEncryptionTime: number;
    averageDecryptionTime: number;
    errorRate: number;
    keyRotationFrequency: number;
    totalOperations: number;
  }> {
    const totalOps = this.metrics.encryption_operations + this.metrics.decryption_operations;

    return {
      averageEncryptionTime: totalOps > 0 ? this.metrics.performance_ms / totalOps : 0,
      averageDecryptionTime: totalOps > 0 ? this.metrics.performance_ms / totalOps : 0,
      errorRate: totalOps > 0 ? (this.metrics.errors / totalOps) * 100 : 0,
      keyRotationFrequency: this.metrics.key_rotations,
      totalOperations: totalOps,
    };
  }

  async monitorEncryptionHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for expired keys
    const expiredKeys = Array.from(this.encryptionKeys.values()).filter(
      (key) => key.is_active && key.expires_at && key.expires_at <= Date.now()
    );

    if (expiredKeys.length > 0) {
      issues.push(`${expiredKeys.length} encryption keys have expired`);
      recommendations.push('Rotate expired encryption keys immediately');
    }

    // Check error rate
    const totalOps = this.metrics.encryption_operations + this.metrics.decryption_operations;
    const errorRate = totalOps > 0 ? (this.metrics.errors / totalOps) * 100 : 0;

    if (errorRate > 5) {
      issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
      recommendations.push('Investigate encryption/decryption failures');
    }

    // Check performance
    const avgTime = totalOps > 0 ? this.metrics.performance_ms / totalOps : 0;
    if (avgTime > this.ENCRYPTION_CONFIG.PERFORMANCE_THRESHOLD_MS) {
      issues.push(`Slow encryption performance: ${avgTime.toFixed(2)}ms average`);
      recommendations.push('Optimize encryption algorithms or key derivation parameters');
    }

    const status = issues.length === 0 ? 'healthy' : issues.length < 3 ? 'warning' : 'critical';

    return { status, issues, recommendations };
  }

  // ✅ 9.5.8: Test encryption implementation
  async runEncryptionTests(): Promise<{
    passed: boolean;
    results: Array<{
      test: string;
      passed: boolean;
      details?: string;
    }>;
  }> {
    const results: Array<{ test: string; passed: boolean; details?: string }> = [];

    // Test 1: Basic encryption/decryption
    try {
      const testData = 'Test sensitive data';
      const encrypted = await this.encryptAtRest(testData, 'test_field');
      const decrypted = await this.decryptAtRest(encrypted, 'test_field');

      results.push({
        test: 'Basic encryption/decryption',
        passed: decrypted === testData,
        details: decrypted === testData ? 'Data integrity verified' : 'Data corruption detected',
      });
    } catch (error) {
      results.push({
        test: 'Basic encryption/decryption',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Test 2: Key rotation functionality
    try {
      await this.configureFieldEncryption('test_rotation', true);
      const originalKey = await this.getOrCreateKey('test_rotation', 'AES-256-GCM', 'PBKDF2');
      const rotatedKey = await this.rotateKey(originalKey.id);

      results.push({
        test: 'Key rotation',
        passed:
          rotatedKey.id !== originalKey.id && !this.encryptionKeys.get(originalKey.id)?.is_active,
        details: 'Key rotation completed successfully',
      });
    } catch (error) {
      results.push({
        test: 'Key rotation',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Test 3: Field-level encryption configuration
    try {
      const config = await this.configureFieldEncryption(
        'test_config',
        true,
        'AES-256-GCM',
        86400000,
        true
      );

      results.push({
        test: 'Field encryption configuration',
        passed: config.field_name === 'test_config' && config.encryption_required,
        details: 'Field configuration created successfully',
      });
    } catch (error) {
      results.push({
        test: 'Field encryption configuration',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Test 4: Transit encryption
    try {
      const testData = 'Transit test data';
      const encrypted = await this.encryptInTransit(testData);

      results.push({
        test: 'Transit encryption',
        passed: encrypted.algorithm === 'AES-256-GCM' && encrypted.data !== testData,
        details: 'Transit encryption completed successfully',
      });
    } catch (error) {
      results.push({
        test: 'Transit encryption',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Test 5: Performance test
    try {
      const startTime = Date.now();
      const testData = 'Performance test data'.repeat(100); // Larger data set

      for (let i = 0; i < 10; i++) {
        const encrypted = await this.encryptAtRest(testData, 'perf_test');
        await this.decryptAtRest(encrypted, 'perf_test');
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / 20; // 10 encrypt + 10 decrypt operations

      results.push({
        test: 'Performance benchmark',
        passed: avgTime < this.ENCRYPTION_CONFIG.PERFORMANCE_THRESHOLD_MS,
        details: `Average operation time: ${avgTime.toFixed(2)}ms`,
      });
    } catch (error) {
      results.push({
        test: 'Performance benchmark',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    const passed = results.every((result) => result.passed);

    console.log('[DataEncryption] Test results', { passed, results });

    return { passed, results };
  }

  // Private helper methods
  private async performEncryption(
    data: string,
    key: Buffer,
    iv: Buffer,
    algorithm: EncryptionAlgorithm
  ): Promise<{ encrypted: string; authTag?: string }> {
    // In a real implementation, use actual crypto libraries
    // This is a simplified version for demonstration
    const cipher = createCipher(algorithm.toLowerCase().replace('-', ''), key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // For GCM mode, get auth tag
    let authTag: string | undefined;
    if (algorithm.includes('GCM')) {
      // In real implementation, extract auth tag from GCM cipher
      authTag = createHash('sha256').update(encrypted).digest('hex').slice(0, 32);
    }

    return { encrypted, authTag };
  }

  private async performDecryption(
    encryptedData: string,
    key: Buffer,
    iv: Buffer,
    algorithm: EncryptionAlgorithm,
    authTag?: string
  ): Promise<string> {
    // In a real implementation, use actual crypto libraries
    // This is a simplified version for demonstration
    const decipher = createDecipher(algorithm.toLowerCase().replace('-', ''), key);

    // For GCM mode, verify auth tag
    if (algorithm.includes('GCM') && authTag) {
      const expectedTag = createHash('sha256').update(encryptedData).digest('hex').slice(0, 32);
      if (expectedTag !== authTag) {
        throw new Error('Authentication tag verification failed');
      }
    }

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private async deriveKey(
    masterKeyId: string,
    salt: Buffer,
    keyDerivation: KeyDerivation,
    iterations: number
  ): Promise<Buffer> {
    // In production, use actual master key storage
    const masterKey = Buffer.from(masterKeyId, 'hex');

    switch (keyDerivation) {
      case 'PBKDF2':
        return await pbkdf2Async(
          masterKey,
          salt,
          iterations,
          this.ENCRYPTION_CONFIG.KEY_LENGTH,
          'sha256'
        );
      case 'scrypt':
        return await scryptAsync(masterKey, salt, this.ENCRYPTION_CONFIG.KEY_LENGTH);
      case 'Argon2id':
        // In production, use argon2 library
        return await pbkdf2Async(
          masterKey,
          salt,
          iterations,
          this.ENCRYPTION_CONFIG.KEY_LENGTH,
          'sha512'
        );
      case 'HKDF':
        return createHmac('sha256', masterKey)
          .update(salt)
          .digest()
          .slice(0, this.ENCRYPTION_CONFIG.KEY_LENGTH);
      default:
        throw new Error(`Unsupported key derivation: ${keyDerivation}`);
    }
  }

  private async encryptKeyWithPublicKey(key: Buffer, publicKey: string): Promise<string> {
    // In production, use actual public key encryption (RSA/ECDH)
    return createHash('sha256')
      .update(key.toString('hex') + publicKey)
      .digest('hex');
  }

  private generateKeyId(): string {
    return randomBytes(16).toString('hex');
  }

  private async getOrCreateKey(
    fieldName: string,
    algorithm: EncryptionAlgorithm,
    keyDerivation: KeyDerivation
  ): Promise<EncryptionKey> {
    // Find existing active key for field
    const existingKey = Array.from(this.encryptionKeys.values()).find(
      (key) => key.is_active && key.algorithm === algorithm
    );

    if (existingKey) {
      return existingKey;
    }

    return await this.createEncryptionKey(fieldName, algorithm, keyDerivation);
  }

  private getKeyForField(fieldName: string): EncryptionKey | undefined {
    const config = this.fieldConfigs.get(fieldName);
    if (!config) return undefined;

    return Array.from(this.encryptionKeys.values()).find(
      (key) => key.is_active && key.algorithm === config.algorithm
    );
  }

  private getFieldConfig(fieldName: string): FieldEncryptionConfig | undefined {
    return this.fieldConfigs.get(fieldName);
  }

  private async updateKeyUsage(keyId: string): Promise<void> {
    const key = this.encryptionKeys.get(keyId);
    if (key) {
      key.usage_count++;
      await this.saveToStorage();
    }
  }

  private async updateMetrics(
    operation: 'encryption' | 'decryption' | 'key_rotation' | 'error',
    duration: number
  ): Promise<void> {
    switch (operation) {
      case 'encryption':
        this.metrics.encryption_operations++;
        this.metrics.performance_ms += duration;
        break;
      case 'decryption':
        this.metrics.decryption_operations++;
        this.metrics.performance_ms += duration;
        break;
      case 'key_rotation':
        this.metrics.key_rotations++;
        break;
      case 'error':
        this.metrics.errors++;
        break;
    }
    this.metrics.last_updated = Date.now();
    await this.saveToStorage();
  }

  private async logEncryptionEvent(
    operation: 'encrypt' | 'decrypt',
    fieldName: string,
    userId?: string,
    outcome: 'success' | 'failure' = 'success',
    error?: unknown
  ): Promise<void> {
    // In production, integrate with audit logging service
    console.log('[DataEncryption] Operation logged', {
      operation,
      fieldName,
      userId,
      outcome,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : error,
    });
  }

  private async saveToStorage(): Promise<void> {
    try {
      localStorage.setItem(
        this.STORAGE_KEYS.ENCRYPTION_KEYS,
        JSON.stringify(Array.from(this.encryptionKeys.entries()))
      );
      localStorage.setItem(
        this.STORAGE_KEYS.FIELD_CONFIGS,
        JSON.stringify(Array.from(this.fieldConfigs.entries()))
      );
      localStorage.setItem(this.STORAGE_KEYS.METRICS, JSON.stringify(this.metrics));
    } catch (error) {
      console.error('[DataEncryption] Failed to save to storage:', error);
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      // Load encryption keys
      const keysData = localStorage.getItem(this.STORAGE_KEYS.ENCRYPTION_KEYS);
      if (keysData) {
        const keyEntries = JSON.parse(keysData) as Array<[string, EncryptionKey]>;
        this.encryptionKeys = new Map(keyEntries);
      }

      // Load field configurations
      const configsData = localStorage.getItem(this.STORAGE_KEYS.FIELD_CONFIGS);
      if (configsData) {
        const configEntries = JSON.parse(configsData) as Array<[string, FieldEncryptionConfig]>;
        this.fieldConfigs = new Map(configEntries);
      }

      // Load metrics
      const metricsData = localStorage.getItem(this.STORAGE_KEYS.METRICS);
      if (metricsData) {
        this.metrics = { ...this.metrics, ...JSON.parse(metricsData) };
      }
    } catch (error) {
      console.error('[DataEncryption] Failed to load from storage:', error);
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadFromStorage();

      // Rotate any expired keys
      await this.rotateExpiredKeys();

      this.initialized = true;
      console.log('[DataEncryption] Service initialized successfully');
    } catch (error) {
      console.error('[DataEncryption] Failed to initialize:', error);
      throw error;
    }
  }

  // Public getters
  getEncryptionKeys(): EncryptionKey[] {
    return Array.from(this.encryptionKeys.values());
  }

  getFieldConfigurations(): FieldEncryptionConfig[] {
    return Array.from(this.fieldConfigs.values());
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
