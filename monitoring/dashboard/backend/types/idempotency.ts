/**
 * Idempotency System Types
 *
 * Provides type safety for the idempotency key system used to prevent
 * duplicate payment transactions.
 *
 * @module types/idempotency
 * @story PAY-010
 */

/**
 * Idempotency cache entry stored in the database
 */
export interface IdempotencyCache {
  /** Client-provided UUID v4 idempotency key */
  idempotency_key: string;

  /** SHA-256 hash of the request body */
  request_hash: string;

  /** HTTP method (POST, PUT, etc.) */
  http_method: string;

  /** API endpoint path */
  endpoint_path: string;

  /** Cached HTTP response status code */
  response_status: number;

  /** Cached response body (JSON) */
  response_body: Record<string, unknown>;

  /** Cached response headers */
  response_headers: Record<string, string>;

  /** Timestamp when cache entry was created */
  created_at: Date;

  /** Expiration timestamp (TTL: 24 hours) */
  expires_at: Date;

  /** Client IP address (for audit) */
  client_ip?: string;

  /** User agent string (for audit) */
  user_agent?: string;
}

/**
 * Request data for storing idempotency cache
 */
export interface IdempotencyCacheRequest {
  idempotency_key: string;
  request_hash: string;
  http_method: string;
  endpoint_path: string;
  response_status: number;
  response_body: Record<string, unknown>;
  response_headers?: Record<string, string>;
  client_ip?: string;
  user_agent?: string;
}

/**
 * Cached response to return for duplicate requests
 */
export interface CachedResponse {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  cached_at: Date;
  expires_at: Date;
}

/**
 * Idempotency validation result
 */
export interface IdempotencyValidation {
  /** Whether the idempotency key is valid */
  valid: boolean;

  /** Error message if invalid */
  error?: string;

  /** Validated idempotency key */
  idempotency_key?: string;
}

/**
 * Idempotency check result
 */
export interface IdempotencyCheckResult {
  /** Whether this is a duplicate request */
  is_duplicate: boolean;

  /** Cached response if duplicate */
  cached_response?: CachedResponse;

  /** Request hash for storage */
  request_hash: string;
}

/**
 * Idempotency middleware configuration
 */
export interface IdempotencyConfig {
  /** TTL for cache entries in milliseconds (default: 24 hours) */
  ttl_ms?: number;

  /** Header name for idempotency key (default: 'Idempotency-Key') */
  header_name?: string;

  /** Whether to require idempotency key (default: true) */
  required?: boolean;

  /** Endpoints to apply idempotency (default: all) */
  endpoints?: string[];

  /** Whether to enable automatic cleanup (default: true) */
  enable_cleanup?: boolean;

  /** Cleanup interval in milliseconds (default: 1 hour) */
  cleanup_interval_ms?: number;
}

/**
 * Idempotency cleanup statistics
 */
export interface IdempotencyCleanupStats {
  /** Number of entries removed */
  deleted_count: number;

  /** Timestamp of cleanup */
  cleanup_at: Date;

  /** Cleanup duration in milliseconds */
  duration_ms: number;
}
