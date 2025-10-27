/**
 * NOSTR Key Management Types - Consolidated Type Definitions
 *
 * US-308: Consolidate NOSTR Type Definitions
 * Epic 003: NOSTR Consolidation
 *
 * Complete type definitions for NOSTR key management, storage, and security
 * Implements NIP-19 (bech32 encoding), NIP-26 (delegation), and security best practices
 */

import { z } from 'zod';

// ========================================
// Key Formats and Encoding
// ========================================

/**
 * NOSTR Key Formats
 * - hex: Raw 64-character hexadecimal
 * - npub: Bech32-encoded public key (NIP-19)
 * - nsec: Bech32-encoded private key (NIP-19)
 */
export enum NostrKeyFormat {
  HEX = 'hex',
  NPUB = 'npub',
  NSEC = 'nsec',
  NIP05 = 'nip05',
}

/**
 * Basic Key Pair Schema
 */
export const NostrKeyPairSchema = z.object({
  privateKey: z.string().length(64, 'Private key must be 64 characters'),
  publicKey: z.string().length(64, 'Public key must be 64 characters'),
  npub: z.string().startsWith('npub1', 'Invalid npub format').optional(),
  nsec: z.string().startsWith('nsec1', 'Invalid nsec format').optional(),
  created: z.number().positive('Creation timestamp must be positive'),
  encrypted: z.boolean().default(false),
});

export type NostrKeyPair = z.infer<typeof NostrKeyPairSchema>;

// ========================================
// Enhanced Key Management
// ========================================

/**
 * Entropy Sources for Key Generation
 */
export enum NostrEntropySource {
  WEB_CRYPTO_API = 'web_crypto_api',      // window.crypto.getRandomValues
  SECURE_RANDOM = 'secure_random',        // Node crypto.randomBytes
  HARDWARE_RNG = 'hardware_rng',          // Hardware random number generator
  USER_INPUT = 'user_input',              // User-provided entropy
  COMBINED = 'combined',                  // Multiple sources combined
}

/**
 * Key Storage Types
 */
export enum NostrKeyStorageType {
  INDEXED_DB = 'indexed_db',              // Browser IndexedDB
  LOCAL_STORAGE = 'local_storage',        // Browser localStorage (not recommended)
  SESSION_STORAGE = 'session_storage',    // Browser sessionStorage
  MEMORY_ONLY = 'memory_only',            // RAM only (no persistence)
  HARDWARE_WALLET = 'hardware_wallet',    // Hardware wallet device
  BROWSER_EXTENSION = 'browser_extension', // Browser extension (Alby, nos2x)
  SECURE_ENCLAVE = 'secure_enclave',      // OS-level secure storage
}

/**
 * Key Backup Methods
 */
export enum NostrKeyBackupMethod {
  MNEMONIC_PHRASE = 'mnemonic_phrase',    // BIP-39 mnemonic
  SEED_PHRASE = 'seed_phrase',            // Seed phrase
  ENCRYPTED_FILE = 'encrypted_file',      // Encrypted JSON/text file
  QR_CODE = 'qr_code',                    // QR code encoding
  HARDWARE_BACKUP = 'hardware_backup',    // Hardware device backup
  PAPER_WALLET = 'paper_wallet',          // Printed backup
  CLOUD_ENCRYPTED = 'cloud_encrypted',    // Encrypted cloud storage
}

/**
 * Key Security Levels
 */
export enum NostrKeySecurityLevel {
  BASIC = 'basic',                        // Standard encryption
  ENHANCED = 'enhanced',                  // Hardware-backed encryption
  MAXIMUM = 'maximum',                    // Multi-factor + hardware
}

/**
 * Enhanced Key Pair with Security Features
 */
export const NostrEnhancedKeyPairSchema = z.object({
  // Core Key Data
  privateKey: z.string().length(64, 'Private key must be 64 characters'),
  publicKey: z.string().length(64, 'Public key must be 64 characters'),
  npub: z.string().startsWith('npub1', 'Invalid npub format'),
  nsec: z.string().startsWith('nsec1', 'Invalid nsec format'),

  // Identity
  keyId: z.string().uuid('Key ID must be a valid UUID'),
  name: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),

  // Timestamps
  created: z.number().positive('Creation timestamp must be positive'),
  lastUsed: z.number().optional(),
  expiresAt: z.number().optional(),
  lastRotated: z.number().optional(),
  rotationScheduled: z.number().optional(),

  // Entropy and Generation
  entropySource: z.nativeEnum(NostrEntropySource),
  entropyBits: z.number().min(128, 'Minimum 128 bits of entropy required'),
  derivationPath: z.string().optional(), // For HD key derivation (BIP-32)

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
  compromised: z.boolean().default(false),
  compromiseReason: z.string().optional(),

  // Delegation (NIP-26)
  delegationToken: z.string().optional(),
  delegatedBy: z.string().length(64).optional(),
  delegationConditions: z.string().optional(),
});

export type NostrEnhancedKeyPair = z.infer<typeof NostrEnhancedKeyPairSchema>;

// ========================================
// HD Key Derivation (BIP-32)
// ========================================

/**
 * Hierarchical Deterministic Key Derivation
 */
export const NostrKeyDerivationSchema = z.object({
  masterSeed: z.string().min(32, 'Master seed must be at least 32 characters'),
  derivationPath: z.string().regex(/^m(\/\d+'?)*$/, 'Invalid BIP-32 derivation path'),
  chainCode: z.string().length(64, 'Chain code must be 64 characters'),
  depth: z.number().min(0).max(10, 'Derivation depth must be 0-10'),
  parentFingerprint: z.string().length(8, 'Parent fingerprint must be 8 characters'),
  childNumber: z.number().min(0),
  hardened: z.boolean().default(false),
});

export type NostrKeyDerivation = z.infer<typeof NostrKeyDerivationSchema>;

// ========================================
// Mnemonic Backup (BIP-39)
// ========================================

/**
 * Mnemonic Phrase Backup
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

// ========================================
// Key Storage Configuration
// ========================================

/**
 * Key Storage Configuration
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

// ========================================
// Hardware Wallet Integration
// ========================================

/**
 * Hardware Wallet Support
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

// ========================================
// Browser Extension Integration
// ========================================

/**
 * Browser Extension (Alby, nos2x, etc.)
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

// ========================================
// Key Operations and Analytics
// ========================================

/**
 * Key Usage Analytics
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
  ipAddress: z.string().optional(),
  location: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

export type NostrKeyUsageAnalytics = z.infer<typeof NostrKeyUsageAnalyticsSchema>;

/**
 * Key Security Monitoring
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

// ========================================
// Key Rotation
// ========================================

/**
 * Key Rotation Process
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

// ========================================
// Key Recovery
// ========================================

/**
 * Key Recovery Process
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

// ========================================
// Key Validation
// ========================================

/**
 * Key Validation Result
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

/**
 * Key Format Validation
 */
export interface KeyFormatValidation {
  isValid: boolean;
  format: NostrKeyFormat | null;
  normalizedKey: string | null;
  errors: string[];
}

// ========================================
// Key Management Operations
// ========================================

/**
 * Key Management Operation Types
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
 * Key Management Result
 */
export interface NostrKeyManagementResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

// ========================================
// Key Management Service State
// ========================================

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
  lastCleanup: number;
}

// ========================================
// Export Schemas for Validation
// ========================================

export const NostrKeySchemas = {
  KeyPair: NostrKeyPairSchema,
  EnhancedKeyPair: NostrEnhancedKeyPairSchema,
  KeyDerivation: NostrKeyDerivationSchema,
  MnemonicBackup: NostrMnemonicBackupSchema,
  KeyStorageConfig: NostrKeyStorageConfigSchema,
  HardwareWallet: NostrHardwareWalletSchema,
  BrowserExtension: NostrBrowserExtensionSchema,
  KeyUsageAnalytics: NostrKeyUsageAnalyticsSchema,
  KeySecurityMonitoring: NostrKeySecurityMonitoringSchema,
  KeyRotation: NostrKeyRotationSchema,
  KeyRecovery: NostrKeyRecoverySchema,
} as const;
