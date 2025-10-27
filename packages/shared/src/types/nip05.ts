/**
 * 🔐 NIP-05 Types - Elite Implementation
 *
 * US-306: DNS-based NOSTR identifier verification
 * Spec: https://github.com/nostr-protocol/nips/blob/master/05.md
 *
 * NIP-05 provides human-readable identifiers (name@domain) that map to NOSTR pubkeys
 * via DNS-based verification using /.well-known/nostr.json
 */

import { z } from 'zod';

// ========================================
// NIP-05 Identifier Types
// ========================================

/**
 * Parsed NIP-05 Identifier
 * Format: localPart@domain
 */
export interface NIP05Identifier {
  /** Local part (before @) - e.g., "alice" */
  localPart: string;
  /** Domain part (after @) - e.g., "example.com" */
  domain: string;
  /** Full identifier - e.g., "alice@example.com" */
  full: string;
}

/**
 * NIP-05 Identifier Schema
 */
export const NIP05IdentifierSchema = z.object({
  localPart: z
    .string()
    .min(1, 'Local part cannot be empty')
    .max(64, 'Local part too long (max 64 characters)')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Local part contains invalid characters'),
  domain: z
    .string()
    .min(1, 'Domain cannot be empty')
    .max(253, 'Domain too long (max 253 characters)')
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format'),
  full: z
    .string()
    .min(3, 'Identifier too short')
    .max(320, 'Identifier too long (max 320 characters)')
    .email('Invalid email-like format'),
});

export type ValidatedNIP05Identifier = z.infer<typeof NIP05IdentifierSchema>;

// ========================================
// NIP-05 Well-Known Response Types
// ========================================

/**
 * NIP-05 Well-Known JSON Response
 * From https://domain/.well-known/nostr.json
 */
export interface NIP05WellKnownResponse {
  /** Maps local names to hex pubkeys */
  names: Record<string, string>;
  /** Optional relay hints for each pubkey */
  relays?: Record<string, string[]>;
}

/**
 * NIP-05 Well-Known Response Schema
 */
export const NIP05WellKnownResponseSchema = z.object({
  names: z.record(
    z.string(),
    z.string().length(64, 'Public key must be 64 characters').regex(/^[a-f0-9]{64}$/, 'Invalid hex pubkey')
  ),
  relays: z.record(
    z.string(),
    z.array(z.string().url('Invalid relay URL'))
  ).optional(),
});

export type ValidatedNIP05WellKnownResponse = z.infer<typeof NIP05WellKnownResponseSchema>;

// ========================================
// Verification Status Types
// ========================================

/**
 * NIP-05 Verification Status
 */
export enum NIP05VerificationStatus {
  /** Not yet verified */
  UNVERIFIED = 'unverified',
  /** Verification in progress */
  VERIFYING = 'verifying',
  /** Successfully verified */
  VERIFIED = 'verified',
  /** Verification failed */
  FAILED = 'failed',
  /** Verification expired (needs refresh) */
  EXPIRED = 'expired',
  /** Cached verification result */
  CACHED = 'cached',
}

/**
 * NIP-05 Verification Result
 */
export interface NIP05VerificationResult {
  /** Verification success flag */
  success: boolean;
  /** Whether identifier is verified */
  verified: boolean;
  /** Parsed identifier */
  identifier: NIP05Identifier;
  /** Expected public key */
  expectedPubkey: string;
  /** Actual public key from verification */
  actualPubkey?: string;
  /** Verification status */
  status: NIP05VerificationStatus;
  /** Optional relay list */
  relays?: string[];
  /** Verification timestamp */
  verifiedAt?: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Error message if verification failed */
  error?: string;
  /** Error code */
  errorCode?: NIP05ErrorCode;
  /** Whether result is from cache */
  fromCache?: boolean;
  /** Verification method used */
  method: 'http' | 'cache';
}

/**
 * NIP-05 Verification Result Schema
 */
export const NIP05VerificationResultSchema = z.object({
  success: z.boolean(),
  verified: z.boolean(),
  identifier: NIP05IdentifierSchema,
  expectedPubkey: z.string().length(64).regex(/^[a-f0-9]{64}$/),
  actualPubkey: z.string().length(64).regex(/^[a-f0-9]{64}$/).optional(),
  status: z.nativeEnum(NIP05VerificationStatus),
  relays: z.array(z.string().url()).optional(),
  verifiedAt: z.number().optional(),
  expiresAt: z.number().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  fromCache: z.boolean().optional(),
  method: z.enum(['http', 'cache']),
});

export type ValidatedNIP05VerificationResult = z.infer<typeof NIP05VerificationResultSchema>;

// ========================================
// Verification Options
// ========================================

/**
 * NIP-05 Verification Options
 */
export interface NIP05VerificationOptions {
  /** Timeout for HTTP requests (ms) */
  timeout?: number;
  /** Whether to use cached results */
  useCache?: boolean;
  /** Whether to force fresh verification */
  forceRefresh?: boolean;
  /** Custom fetch implementation */
  fetchFn?: typeof fetch;
  /** Whether to validate CORS */
  validateCORS?: boolean;
}

/**
 * NIP-05 Verification Options Schema
 */
export const NIP05VerificationOptionsSchema = z.object({
  timeout: z.number().positive().max(60000).optional(),
  useCache: z.boolean().optional(),
  forceRefresh: z.boolean().optional(),
  validateCORS: z.boolean().optional(),
}).strict();

export type ValidatedNIP05VerificationOptions = z.infer<typeof NIP05VerificationOptionsSchema>;

// ========================================
// Cache Types
// ========================================

/**
 * NIP-05 Cache Entry
 */
export interface NIP05CacheEntry {
  /** Cached verification result */
  result: NIP05VerificationResult;
  /** Timestamp when cached */
  cachedAt: number;
  /** TTL in milliseconds */
  ttl: number;
  /** Cache key */
  key: string;
}

/**
 * NIP-05 Cache Entry Schema
 */
export const NIP05CacheEntrySchema = z.object({
  result: NIP05VerificationResultSchema,
  cachedAt: z.number(),
  ttl: z.number().positive(),
  key: z.string().min(1),
});

export type ValidatedNIP05CacheEntry = z.infer<typeof NIP05CacheEntrySchema>;

/**
 * NIP-05 Cache Configuration
 */
export interface NIP05CacheConfig {
  /** Storage backend */
  storage: 'indexeddb' | 'localstorage' | 'memory';
  /** Default TTL for successful verifications (ms) - 24 hours */
  successTTL: number;
  /** Default TTL for failed verifications (ms) - 1 hour */
  failureTTL: number;
  /** Maximum cache size (number of entries) */
  maxSize: number;
  /** Whether to enable cache */
  enabled: boolean;
  /** Database name for IndexedDB */
  dbName?: string;
  /** Store name for IndexedDB */
  storeName?: string;
}

/**
 * Default NIP-05 Cache Configuration
 */
export const DEFAULT_NIP05_CACHE_CONFIG: NIP05CacheConfig = {
  storage: 'indexeddb',
  successTTL: 24 * 60 * 60 * 1000, // 24 hours
  failureTTL: 60 * 60 * 1000, // 1 hour
  maxSize: 1000,
  enabled: true,
  dbName: 'sovren-nip05-cache',
  storeName: 'verifications',
};

// ========================================
// Error Types
// ========================================

/**
 * NIP-05 Error Codes
 */
export enum NIP05ErrorCode {
  // Parsing Errors
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_LOCAL_PART = 'INVALID_LOCAL_PART',
  INVALID_DOMAIN = 'INVALID_DOMAIN',
  PARSE_ERROR = 'PARSE_ERROR',

  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CORS_ERROR = 'CORS_ERROR',
  DNS_ERROR = 'DNS_ERROR',

  // HTTP Errors
  HTTP_ERROR = 'HTTP_ERROR',
  HTTP_404 = 'HTTP_404',
  HTTP_500 = 'HTTP_500',

  // Response Errors
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_CONTENT_TYPE = 'INVALID_CONTENT_TYPE',
  MISSING_NAMES = 'MISSING_NAMES',

  // Verification Errors
  NAME_NOT_FOUND = 'NAME_NOT_FOUND',
  PUBKEY_MISMATCH = 'PUBKEY_MISMATCH',
  INVALID_PUBKEY_FORMAT = 'INVALID_PUBKEY_FORMAT',

  // Cache Errors
  CACHE_ERROR = 'CACHE_ERROR',
  CACHE_READ_ERROR = 'CACHE_READ_ERROR',
  CACHE_WRITE_ERROR = 'CACHE_WRITE_ERROR',

  // General Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * NIP-05 Error
 */
export class NIP05Error extends Error {
  constructor(
    message: string,
    public code: NIP05ErrorCode,
    public identifier?: NIP05Identifier,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NIP05Error';
  }
}

/**
 * NIP-05 Verification Error
 */
export class NIP05VerificationError extends NIP05Error {
  constructor(
    message: string,
    code: NIP05ErrorCode,
    identifier: NIP05Identifier,
    public expectedPubkey: string,
    context?: Record<string, unknown>
  ) {
    super(message, code, identifier, { ...context, expectedPubkey });
    this.name = 'NIP05VerificationError';
  }
}

/**
 * NIP-05 Cache Error
 */
export class NIP05CacheError extends NIP05Error {
  constructor(
    message: string,
    public operation: 'read' | 'write' | 'delete' | 'clear',
    context?: Record<string, unknown>
  ) {
    super(message, NIP05ErrorCode.CACHE_ERROR, undefined, { ...context, operation });
    this.name = 'NIP05CacheError';
  }
}

// ========================================
// Service Interface
// ========================================

/**
 * NIP-05 Service Interface
 */
export interface INIP05Service {
  /**
   * Parse NIP-05 identifier
   */
  parseIdentifier(identifier: string): {
    success: boolean;
    parsed?: NIP05Identifier;
    error?: string;
  };

  /**
   * Verify NIP-05 identifier
   */
  verifyIdentifier(
    identifier: string,
    expectedPubkey: string,
    options?: NIP05VerificationOptions
  ): Promise<NIP05VerificationResult>;

  /**
   * Get cached verification result
   */
  getCachedVerification(
    identifier: string,
    expectedPubkey: string
  ): Promise<NIP05VerificationResult | null>;

  /**
   * Clear cached verification
   */
  clearCache(identifier?: string): Promise<void>;

  /**
   * Check if verification is expired
   */
  isExpired(result: NIP05VerificationResult): boolean;
}

// ========================================
// Utility Types
// ========================================

/**
 * NIP-05 Statistics
 */
export interface NIP05Statistics {
  /** Total verifications attempted */
  totalAttempts: number;
  /** Successful verifications */
  successCount: number;
  /** Failed verifications */
  failureCount: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses */
  cacheMisses: number;
  /** Average verification time (ms) */
  averageVerificationTime: number;
  /** Verification success rate (0-100) */
  successRate: number;
  /** Cache hit rate (0-100) */
  cacheHitRate: number;
}

/**
 * Export all schemas for validation
 */
export const NIP05Schemas = {
  Identifier: NIP05IdentifierSchema,
  WellKnownResponse: NIP05WellKnownResponseSchema,
  VerificationResult: NIP05VerificationResultSchema,
  VerificationOptions: NIP05VerificationOptionsSchema,
  CacheEntry: NIP05CacheEntrySchema,
} as const;
