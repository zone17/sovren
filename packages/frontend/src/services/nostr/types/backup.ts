/**
 * NOSTR Backup and Recovery Types
 * US-322: Secure backup and recovery for NOSTR keys, events, and configuration
 *
 * Implements:
 * - Encrypted backup format
 * - Multiple backup types
 * - Verification and integrity checks
 * - Secure restoration
 */

import { z } from 'zod';
import type { NostrEnhancedKeyPair } from '@shared/types/nostr';

// ========================================
// Backup Types and Formats
// ========================================

/**
 * Backup File Version for compatibility tracking
 */
export const BACKUP_VERSION = '1.0.0';

/**
 * Backup Content Types
 */
export enum BackupContentType {
  KEYS_ONLY = 'keys_only',
  EVENTS_ONLY = 'events_only',
  CONFIG_ONLY = 'config_only',
  COMPLETE = 'complete', // Keys + Events + Config
}

/**
 * Backup Format Types
 */
export enum BackupFormat {
  JSON = 'json',
  ENCRYPTED_JSON = 'encrypted_json',
  BINARY = 'binary',
  QR_CODE = 'qr_code',
}

/**
 * Backup Compression Types
 */
export enum BackupCompressionType {
  NONE = 'none',
  GZIP = 'gzip',
  BROTLI = 'brotli',
}

// ========================================
// Encryption Configuration
// ========================================

/**
 * Encryption Metadata
 */
export const EncryptionMetadataSchema = z.object({
  algorithm: z.literal('AES-256-GCM'),
  keyDerivation: z.literal('PBKDF2'),
  iterations: z.number().min(100000), // OWASP recommendation
  saltLength: z.number().min(32),
  ivLength: z.number().min(12),
  tagLength: z.number().min(16),
  version: z.string(),
});

export type EncryptionMetadata = z.infer<typeof EncryptionMetadataSchema>;

// ========================================
// Backup Data Structures
// ========================================

/**
 * Keys Backup Data
 */
export const KeysBackupDataSchema = z.object({
  keys: z.array(
    z.object({
      keyId: z.string().uuid(),
      publicKey: z.string().length(64),
      privateKey: z.string().length(64),
      npub: z.string().startsWith('npub1'),
      nsec: z.string().startsWith('nsec1'),
      name: z.string().optional(),
      description: z.string().optional(),
      created: z.number(),
      tags: z.array(z.string()).default([]),
    })
  ),
  activeKeyId: z.string().uuid().nullable(),
});

export type KeysBackupData = z.infer<typeof KeysBackupDataSchema>;

/**
 * Events Backup Data
 */
export const EventsBackupDataSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      pubkey: z.string().length(64),
      created_at: z.number(),
      kind: z.number(),
      tags: z.array(z.array(z.string())),
      content: z.string(),
      sig: z.string(),
    })
  ),
  eventCount: z.number(),
  dateRange: z.object({
    oldest: z.number(),
    newest: z.number(),
  }),
});

export type EventsBackupData = z.infer<typeof EventsBackupDataSchema>;

/**
 * Configuration Backup Data
 */
export const ConfigBackupDataSchema = z.object({
  relays: z.array(
    z.object({
      url: z.string().url(),
      read: z.boolean(),
      write: z.boolean(),
      enabled: z.boolean(),
    })
  ),
  subscriptionFilters: z.array(z.record(z.any())).optional(),
  preferences: z
    .object({
      defaultRelay: z.string().optional(),
      autoPublish: z.boolean().default(true),
      cacheEnabled: z.boolean().default(true),
      cacheTTL: z.number().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ConfigBackupData = z.infer<typeof ConfigBackupDataSchema>;

/**
 * Complete Backup Data (all content types combined)
 */
export const BackupDataSchema = z.object({
  keys: KeysBackupDataSchema.optional(),
  events: EventsBackupDataSchema.optional(),
  configuration: ConfigBackupDataSchema.optional(),
});

export type BackupData = z.infer<typeof BackupDataSchema>;

// ========================================
// Backup File Structure
// ========================================

/**
 * Encrypted Backup Container
 */
export const EncryptedBackupSchema = z.object({
  // Encrypted data (base64 encoded)
  encryptedData: z.string().min(1),

  // Encryption parameters (NOT encrypted)
  salt: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),

  // Metadata
  encryption: EncryptionMetadataSchema,
});

export type EncryptedBackup = z.infer<typeof EncryptedBackupSchema>;

/**
 * Complete Backup File
 */
export const BackupFileSchema = z.object({
  // Metadata
  version: z.string(),
  created: z.number(),
  contentType: z.nativeEnum(BackupContentType),
  format: z.nativeEnum(BackupFormat),
  compression: z.nativeEnum(BackupCompressionType),
  encrypted: z.boolean(),

  // Content checksum (SHA-256 of original data)
  checksum: z.string().min(64).max(64),

  // Backup description
  description: z.string().optional(),
  metadata: z
    .object({
      keyCount: z.number().optional(),
      eventCount: z.number().optional(),
      relayCount: z.number().optional(),
      originalSizeBytes: z.number().optional(),
      compressedSizeBytes: z.number().optional(),
      compressionRatio: z.number().optional(),
    })
    .optional(),

  // Data (encrypted if encrypted=true, otherwise plain)
  data: z.union([EncryptedBackupSchema, BackupDataSchema]),
});

export type BackupFile = z.infer<typeof BackupFileSchema>;

// ========================================
// Verification and Recovery
// ========================================

/**
 * Backup Verification Result
 */
export const BackupVerificationSchema = z.object({
  valid: z.boolean(),
  version: z.string(),
  contentType: z.nativeEnum(BackupContentType),
  encrypted: z.boolean(),
  checksumValid: z.boolean(),
  structureValid: z.boolean(),
  errors: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      severity: z.enum(['error', 'warning']),
    })
  ),
  warnings: z.array(z.string()),
  metadata: z
    .object({
      keyCount: z.number().optional(),
      eventCount: z.number().optional(),
      relayCount: z.number().optional(),
      estimatedRecoveryTime: z.number().optional(),
    })
    .optional(),
});

export type BackupVerification = z.infer<typeof BackupVerificationSchema>;

/**
 * Recovery Options
 */
export const RecoveryOptionsSchema = z.object({
  // What to recover
  recoverKeys: z.boolean().default(true),
  recoverEvents: z.boolean().default(true),
  recoverConfiguration: z.boolean().default(true),

  // How to handle conflicts
  overwriteExisting: z.boolean().default(false),
  mergeWithExisting: z.boolean().default(true),

  // Verification
  verifyAfterRestore: z.boolean().default(true),
  testSignature: z.boolean().default(true),
});

export type RecoveryOptions = z.infer<typeof RecoveryOptionsSchema>;

/**
 * Recovery Result
 */
export const RecoveryResultSchema = z.object({
  success: z.boolean(),
  keysRecovered: z.number().default(0),
  eventsRecovered: z.number().default(0),
  relaysRecovered: z.number().default(0),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  duration: z.number(), // milliseconds
  verificationResult: z
    .object({
      keysValid: z.boolean(),
      signaturesValid: z.boolean(),
      configValid: z.boolean(),
    })
    .optional(),
});

export type RecoveryResult = z.infer<typeof RecoveryResultSchema>;

// ========================================
// Backup Scheduling
// ========================================

/**
 * Backup Schedule Configuration
 */
export const BackupScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
  enabled: z.boolean().default(false),
  frequency: z.enum(['manual', 'daily', 'weekly', 'monthly']),
  lastBackup: z.number().optional(),
  nextBackup: z.number().optional(),
  autoDelete: z.boolean().default(false),
  retentionDays: z.number().min(1).default(90),
  maxBackups: z.number().min(1).default(10),
  contentType: z.nativeEnum(BackupContentType),
  destination: z.enum(['local', 'cloud', 'both']).default('local'),
});

export type BackupSchedule = z.infer<typeof BackupScheduleSchema>;

/**
 * Backup History Entry
 */
export const BackupHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  created: z.number(),
  contentType: z.nativeEnum(BackupContentType),
  encrypted: z.boolean(),
  sizeBytes: z.number(),
  checksum: z.string(),
  location: z.string(), // file path or URL
  verified: z.boolean().default(false),
  lastVerified: z.number().optional(),
  description: z.string().optional(),
});

export type BackupHistoryEntry = z.infer<typeof BackupHistoryEntrySchema>;

// ========================================
// Security and Validation
// ========================================

/**
 * Password Strength Requirements
 */
export interface PasswordStrength {
  score: number; // 0-100
  valid: boolean;
  requirements: {
    minLength: boolean; // >= 12 characters
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
  entropy: number; // bits
  feedback: string[];
}

/**
 * Backup Security Audit
 */
export const BackupSecurityAuditSchema = z.object({
  timestamp: z.number(),
  backupId: z.string().uuid(),
  checks: z.array(
    z.object({
      check: z.string(),
      passed: z.boolean(),
      severity: z.enum(['info', 'warning', 'error']),
      details: z.string().optional(),
    })
  ),
  overallScore: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
});

export type BackupSecurityAudit = z.infer<typeof BackupSecurityAuditSchema>;

// ========================================
// Export All Schemas
// ========================================

export const BackupSchemas = {
  EncryptionMetadata: EncryptionMetadataSchema,
  KeysBackupData: KeysBackupDataSchema,
  EventsBackupData: EventsBackupDataSchema,
  ConfigBackupData: ConfigBackupDataSchema,
  BackupData: BackupDataSchema,
  EncryptedBackup: EncryptedBackupSchema,
  BackupFile: BackupFileSchema,
  BackupVerification: BackupVerificationSchema,
  RecoveryOptions: RecoveryOptionsSchema,
  RecoveryResult: RecoveryResultSchema,
  BackupSchedule: BackupScheduleSchema,
  BackupHistoryEntry: BackupHistoryEntrySchema,
  BackupSecurityAudit: BackupSecurityAuditSchema,
} as const;
