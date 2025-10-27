import { z } from 'zod';

// 🔐 NOSTR Key Management Types - Elite Security Implementation
// US-212: Comprehensive key management for NOSTR protocol

/**
 * Entropy Sources for Key Generation
 */
export enum NostrEntropySource {
  WEB_CRYPTO_API = 'web_crypto_api',
  SECURE_RANDOM = 'secure_random',
  HARDWARE_RNG = 'hardware_rng',
  USER_INPUT = 'user_input',
  COMBINED = 'combined',
}

/**
 * Key Storage Types
 */
export enum NostrKeyStorageType {
  INDEXED_DB = 'indexed_db',
  LOCAL_STORAGE = 'local_storage',
  SESSION_STORAGE = 'session_storage',
  MEMORY_ONLY = 'memory_only',
  HARDWARE_WALLET = 'hardware_wallet',
  BROWSER_EXTENSION = 'browser_extension',
}

/**
 * Key Backup Methods
 */
export enum NostrKeyBackupMethod {
  MNEMONIC_PHRASE = 'mnemonic_phrase',
  SEED_PHRASE = 'seed_phrase',
  ENCRYPTED_FILE = 'encrypted_file',
  QR_CODE = 'qr_code',
  HARDWARE_BACKUP = 'hardware_backup',
  PAPER_WALLET = 'paper_wallet',
}

/**
 * Key Security Levels
 */
export enum NostrKeySecurityLevel {
  BASIC = 'basic', // Standard encryption
  ENHANCED = 'enhanced', // Hardware-backed encryption
  MAXIMUM = 'maximum', // Multi-factor + hardware
}

/**
 * Enhanced NOSTR Key Pair Schema with Security Features
 */
export const NostrEnhancedKeyPairSchema = z.object({
  // Core Key Data
  privateKey: z.string().length(64, 'Private key must be 64 characters'),
  publicKey: z.string().length(64, 'Public key must be 64 characters'),
  npub: z.string().startsWith('npub1', 'Invalid npub format'),
  nsec: z.string().startsWith('nsec1', 'Invalid nsec format'),

  // Security Metadata
  keyId: z.string().uuid('Key ID must be a valid UUID'),
  created: z.number().positive('Creation timestamp must be positive'),
  lastUsed: z.number().optional(),
  expiresAt: z.number().optional(),

  // Entropy and Generation
  entropySource: z.nativeEnum(NostrEntropySource),
  entropyBits: z.number().min(128, 'Minimum 128 bits of entropy required'),
  derivationPath: z.string().optional(), // For HD key derivation

  // Storage and Backup
  storageType: z.nativeEnum(NostrKeyStorageType),
  encrypted: z.boolean().default(true),
  backupMethod: z.nativeEnum(NostrKeyBackupMethod).optional(),
  backedUp: z.boolean().default(false),
  backupVerified: z.boolean().default(false),

  // Security Features
  securityLevel: z.nativeEnum(NostrKeySecurityLevel),
  hardwareWalletSupported: z.boolean().default(false),
  hardwareWalletConnected: z.boolean().default(false),
  multiFactorEnabled: z.boolean().default(false),

  // Usage Tracking
  signatureCount: z.number().default(0),
  lastRotated: z.number().optional(),
  rotationScheduled: z.number().optional(),
  compromised: z.boolean().default(false),
  compromiseReason: z.string().optional(),

  // Metadata
  name: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type NostrEnhancedKeyPair = z.infer<typeof NostrEnhancedKeyPairSchema>;

/**
 * Key Derivation Schema for HD (Hierarchical Deterministic) Keys
 */
export const NostrKeyDerivationSchema = z.object({
  masterSeed: z.string().min(32, 'Master seed must be at least 32 characters'),
  derivationPath: z.string().regex(/^m(\/\d+'?)*$/, 'Invalid derivation path format'),
  chainCode: z.string().length(64, 'Chain code must be 64 characters'),
  depth: z.number().min(0).max(10, 'Derivation depth must be 0-10'),
  parentFingerprint: z.string().length(8, 'Parent fingerprint must be 8 characters'),
  childNumber: z.number().min(0),
  hardened: z.boolean().default(false),
});

export type NostrKeyDerivation = z.infer<typeof NostrKeyDerivationSchema>;

/**
 * Mnemonic Backup Schema
 */
export const NostrMnemonicBackupSchema = z.object({
  keyId: z.string().uuid('Key ID must be a valid UUID'),
  mnemonic: z.string().min(1, 'Mnemonic phrase required'),
  wordCount: z.number().int().min(12).max(24, 'Word count must be 12-24'),
  language: z.string().default('english'),
  passphrase: z.string().optional(),
  checksum: z.string().min(1, 'Checksum required for verification'),
  created: z.number().positive(),
  verified: z.boolean().default(false),
  encrypted: z.boolean().default(true),
  encryptionKey: z.string().optional(),
});

export type NostrMnemonicBackup = z.infer<typeof NostrMnemonicBackupSchema>;

/**
 * Key Storage Configuration Schema
 */
export const NostrKeyStorageConfigSchema = z.object({
  storageType: z.nativeEnum(NostrKeyStorageType),
  encrypted: z.boolean().default(true),
  encryptionAlgorithm: z.string().default('AES-GCM'),
  keyDerivationFunction: z.string().default('PBKDF2'),
  iterations: z.number().min(10000).default(100000),
  saltLength: z.number().min(16).default(32),
  compressionEnabled: z.boolean().default(false),
  backupEnabled: z.boolean().default(true),
  autoRotationEnabled: z.boolean().default(false),
  autoRotationInterval: z.number().positive().optional(),
});

export type NostrKeyStorageConfig = z.infer<typeof NostrKeyStorageConfigSchema>;

/**
 * Key Usage Analytics Schema
 */
export const NostrKeyUsageAnalyticsSchema = z.object({
  keyId: z.string().uuid(),
  timestamp: z.number().positive(),
  operation: z.enum(['generate', 'sign', 'encrypt', 'decrypt', 'backup', 'recover', 'rotate']),
  success: z.boolean(),
  duration: z.number().positive(), // Operation duration in milliseconds
  entropyQuality: z.number().min(0).max(1).optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(), // For security monitoring
  location: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

export type NostrKeyUsageAnalytics = z.infer<typeof NostrKeyUsageAnalyticsSchema>;

/**
 * Key Security Monitoring Schema
 */
export const NostrKeySecurityMonitoringSchema = z.object({
  keyId: z.string().uuid(),
  timestamp: z.number().positive(),
  eventType: z.enum([
    'key_created',
    'key_accessed',
    'key_used',
    'key_compromised',
    'key_rotated',
    'suspicious_activity',
    'failed_authentication',
    'unauthorized_access_attempt',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  resolved: z.boolean().default(false),
  resolvedAt: z.number().optional(),
  resolvedBy: z.string().optional(),
  actionTaken: z.string().optional(),
});

export type NostrKeySecurityMonitoring = z.infer<typeof NostrKeySecurityMonitoringSchema>;

/**
 * Key Rotation Schema
 */
export const NostrKeyRotationSchema = z.object({
  oldKeyId: z.string().uuid(),
  newKeyId: z.string().uuid(),
  rotationType: z.enum(['scheduled', 'manual', 'emergency', 'compromised']),
  scheduledAt: z.number().optional(),
  executedAt: z.number().positive(),
  completedAt: z.number().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'rolled_back']),
  reason: z.string().min(1),
  migrationProgress: z.number().min(0).max(1).default(0),
  rollbackPlan: z.string().optional(),
  validationResults: z
    .array(
      z.object({
        check: z.string(),
        passed: z.boolean(),
        details: z.string().optional(),
      })
    )
    .default([]),
});

export type NostrKeyRotation = z.infer<typeof NostrKeyRotationSchema>;

/**
 * Hardware Wallet Integration Schema
 */
export const NostrHardwareWalletSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  firmwareVersion: z.string().min(1),
  connected: z.boolean().default(false),
  supportsNostr: z.boolean().default(false),
  supportedFeatures: z.array(z.string()).default([]),
  keyPath: z.string().optional(),
  publicKey: z.string().length(64).optional(),
  lastConnected: z.number().optional(),
  connectionCount: z.number().default(0),
  verified: z.boolean().default(false),
  trustedDevice: z.boolean().default(false),
});

export type NostrHardwareWallet = z.infer<typeof NostrHardwareWalletSchema>;

/**
 * Browser Extension Integration Schema
 */
export const NostrBrowserExtensionSchema = z.object({
  extensionId: z.string().min(1),
  extensionName: z.string().min(1),
  version: z.string().min(1),
  available: z.boolean().default(false),
  enabled: z.boolean().default(false),
  permissions: z.array(z.string()).default([]),
  supportedNips: z.array(z.number()).default([]),
  publicKey: z.string().length(64).optional(),
  lastUsed: z.number().optional(),
  trustLevel: z.enum(['untrusted', 'basic', 'trusted', 'verified']).default('untrusted'),
});

export type NostrBrowserExtension = z.infer<typeof NostrBrowserExtensionSchema>;

/**
 * Key Recovery Schema
 */
export const NostrKeyRecoverySchema = z.object({
  recoveryId: z.string().uuid(),
  keyId: z.string().uuid(),
  recoveryMethod: z.nativeEnum(NostrKeyBackupMethod),
  initiatedAt: z.number().positive(),
  completedAt: z.number().optional(),
  status: z.enum(['initiated', 'in_progress', 'completed', 'failed', 'cancelled']),
  recoveryData: z.string().optional(), // Encrypted recovery data
  verificationCode: z.string().optional(),
  verificationAttempts: z.number().default(0),
  maxVerificationAttempts: z.number().default(3),
  securityQuestions: z
    .array(
      z.object({
        question: z.string(),
        answerHash: z.string(),
      })
    )
    .optional(),
  emergencyContacts: z.array(z.string()).optional(),
});

export type NostrKeyRecovery = z.infer<typeof NostrKeyRecoverySchema>;

/**
 * Key Management Service Configuration
 */
export const NostrKeyManagementConfigSchema = z.object({
  // Storage Configuration
  defaultStorageType: z.nativeEnum(NostrKeyStorageType).default(NostrKeyStorageType.INDEXED_DB),
  encryptionEnabled: z.boolean().default(true),
  compressionEnabled: z.boolean().default(false),

  // Security Configuration
  defaultSecurityLevel: z.nativeEnum(NostrKeySecurityLevel).default(NostrKeySecurityLevel.ENHANCED),
  enforceHardwareWallets: z.boolean().default(false),
  requireMultiFactor: z.boolean().default(false),

  // Backup Configuration
  autoBackupEnabled: z.boolean().default(true),
  defaultBackupMethod: z
    .nativeEnum(NostrKeyBackupMethod)
    .default(NostrKeyBackupMethod.MNEMONIC_PHRASE),
  backupVerificationRequired: z.boolean().default(true),

  // Rotation Configuration
  autoRotationEnabled: z.boolean().default(false),
  defaultRotationInterval: z.number().positive().default(7776000000), // 90 days in milliseconds
  compromiseRotationEnabled: z.boolean().default(true),

  // Monitoring Configuration
  usageAnalyticsEnabled: z.boolean().default(true),
  securityMonitoringEnabled: z.boolean().default(true),
  anomalyDetectionEnabled: z.boolean().default(true),

  // Performance Configuration
  cacheSize: z.number().positive().default(100),
  cacheTtl: z.number().positive().default(3600000), // 1 hour in milliseconds
  maxConcurrentOperations: z.number().positive().default(10),
});

export type NostrKeyManagementConfig = z.infer<typeof NostrKeyManagementConfigSchema>;

/**
 * Key Management Service State
 */
export interface NostrKeyManagementState {
  initialized: boolean;
  keys: Map<string, NostrEnhancedKeyPair>;
  activeKeyId: string | null;
  hardwareWallets: Map<string, NostrHardwareWallet>;
  browserExtensions: Map<string, NostrBrowserExtension>;
  usageAnalytics: Map<string, NostrKeyUsageAnalytics[]>;
  securityEvents: Map<string, NostrKeySecurityMonitoring[]>;
  rotationQueue: NostrKeyRotation[];
  recoveryRequests: Map<string, NostrKeyRecovery>;
  config: NostrKeyManagementConfig;
  lastCleanup: number;
}

/**
 * Key Management Service Events
 */
export interface NostrKeyManagementEvents {
  'key:generated': (keyPair: NostrEnhancedKeyPair) => void;
  'key:imported': (keyPair: NostrEnhancedKeyPair) => void;
  'key:backed_up': (keyId: string, method: NostrKeyBackupMethod) => void;
  'key:recovered': (keyId: string, method: NostrKeyBackupMethod) => void;
  'key:rotated': (rotation: NostrKeyRotation) => void;
  'key:compromised': (keyId: string, reason: string) => void;
  'key:deleted': (keyId: string) => void;
  'security:anomaly_detected': (event: NostrKeySecurityMonitoring) => void;
  'storage:error': (error: Error) => void;
  'hardware:connected': (device: NostrHardwareWallet) => void;
  'hardware:disconnected': (deviceId: string) => void;
  'extension:detected': (extension: NostrBrowserExtension) => void;
  'extension:enabled': (extensionId: string) => void;
}

/**
 * Export all schemas for validation
 */
export const NostrKeyManagementSchemas = {
  EnhancedKeyPair: NostrEnhancedKeyPairSchema,
  KeyDerivation: NostrKeyDerivationSchema,
  MnemonicBackup: NostrMnemonicBackupSchema,
  KeyStorageConfig: NostrKeyStorageConfigSchema,
  KeyUsageAnalytics: NostrKeyUsageAnalyticsSchema,
  KeySecurityMonitoring: NostrKeySecurityMonitoringSchema,
  KeyRotation: NostrKeyRotationSchema,
  HardwareWallet: NostrHardwareWalletSchema,
  BrowserExtension: NostrBrowserExtensionSchema,
  KeyRecovery: NostrKeyRecoverySchema,
  KeyManagementConfig: NostrKeyManagementConfigSchema,
} as const;

/**
 * Utility type for key management operations
 */
export type NostrKeyManagementOperation =
  | 'generate'
  | 'import'
  | 'export'
  | 'backup'
  | 'recover'
  | 'rotate'
  | 'delete'
  | 'sign'
  | 'encrypt'
  | 'decrypt';

/**
 * Result type for key management operations
 * Generic type T is constrained to prevent unsafe types
 */
export interface NostrKeyManagementResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Key validation result
 */
export interface NostrKeyValidationResult {
  valid: boolean;
  issues: Array<{
    severity: 'warning' | 'error';
    code: string;
    message: string;
    field?: string;
  }>;
  securityScore: number; // 0-100
  recommendations: string[];
}
