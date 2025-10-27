/**
 * 🚦 ELITE TYPE DEFINITIONS: Rate Limiting
 *
 * US-321: Implement NOSTR Rate Limiting
 * Epic 003: NOSTR Consolidation
 *
 * Type definitions for token bucket rate limiting system with:
 * - Token bucket algorithm configuration
 * - Multi-tier rate limits (per-relay, per-operation, global)
 * - Request queuing and priority management
 * - Rate limit metrics and monitoring
 * - Backpressure handling
 */

// ========================================
// Rate Limit Configuration
// ========================================

/**
 * Rate limit policy configuration
 */
export interface RateLimitPolicy {
  /** Maximum number of requests allowed */
  requests: number;
  /** Time window in milliseconds */
  window: number;
  /** Token refill rate (tokens per second) */
  refillRate?: number;
  /** Maximum burst size (defaults to requests) */
  burstSize?: number;
}

/**
 * Rate limit tier
 */
export enum RateLimitTier {
  /** Per-relay limits */
  RELAY = 'relay',
  /** Per-operation type limits */
  OPERATION = 'operation',
  /** Global limits across all operations */
  GLOBAL = 'global',
}

/**
 * Operation types for rate limiting
 */
export enum RateLimitOperation {
  /** Event publishing */
  PUBLISH_EVENT = 'publishEvent',
  /** Subscription creation */
  SUBSCRIBE = 'subscribe',
  /** Query operations */
  QUERY = 'query',
  /** NIP-05 verification */
  NIP05_VERIFY = 'nip05Verify',
  /** Event fetching */
  FETCH_EVENT = 'fetchEvent',
  /** Batch operations */
  BATCH = 'batch',
}

/**
 * Complete rate limit configuration
 */
export interface RateLimitConfig {
  /** Enable rate limiting */
  enabled?: boolean;
  /** Per-relay rate limits */
  relayLimits?: Map<string, RateLimitPolicy>;
  /** Default relay limit (if not specified per-relay) */
  defaultRelayLimit?: RateLimitPolicy;
  /** Per-operation rate limits */
  operationLimits?: Record<RateLimitOperation, RateLimitPolicy>;
  /** Global rate limit across all operations */
  globalLimit?: RateLimitPolicy;
  /** Enable request queuing */
  enableQueuing?: boolean;
  /** Maximum queue size (0 = unlimited) */
  maxQueueSize?: number;
  /** Queue timeout in milliseconds */
  queueTimeout?: number;
  /** Enable priority queuing */
  enablePriority?: boolean;
  /** Enable metrics tracking */
  enableMetrics?: boolean;
}

// ========================================
// Token Bucket
// ========================================

/**
 * Token bucket state
 */
export interface TokenBucket {
  /** Current token count */
  tokens: number;
  /** Maximum tokens (burst size) */
  capacity: number;
  /** Token refill rate (per second) */
  refillRate: number;
  /** Last refill timestamp */
  lastRefill: number;
  /** Policy configuration */
  policy: RateLimitPolicy;
}

/**
 * Token bucket metrics
 */
export interface TokenBucketMetrics {
  /** Current token count */
  currentTokens: number;
  /** Maximum capacity */
  capacity: number;
  /** Refill rate */
  refillRate: number;
  /** Time until next token */
  timeUntilNextToken: number;
  /** Bucket utilization percentage (0-100) */
  utilization: number;
}

// ========================================
// Request Queuing
// ========================================

/**
 * Request priority levels
 */
export enum RequestPriority {
  /** Critical operations (key management, security) */
  CRITICAL = 0,
  /** High priority (user-initiated actions) */
  HIGH = 1,
  /** Normal priority (standard operations) */
  NORMAL = 2,
  /** Low priority (background tasks) */
  LOW = 3,
  /** Lowest priority (analytics, logging) */
  LOWEST = 4,
}

/**
 * Queued request metadata
 */
export interface QueuedRequest<T = unknown> {
  /** Unique request ID */
  id: string;
  /** Request payload */
  payload: T;
  /** Operation type */
  operation: RateLimitOperation;
  /** Target relay (if applicable) */
  relay?: string;
  /** Request priority */
  priority: RequestPriority;
  /** Creation timestamp */
  createdAt: number;
  /** Queue timeout timestamp */
  timeout: number;
  /** Retry count */
  retries: number;
  /** Resolve callback */
  resolve: (value: unknown) => void;
  /** Reject callback */
  reject: (error: Error) => void;
}

/**
 * Queue metrics
 */
export interface QueueMetrics {
  /** Current queue size */
  size: number;
  /** Maximum queue size seen */
  maxSize: number;
  /** Total requests queued */
  totalQueued: number;
  /** Total requests processed */
  totalProcessed: number;
  /** Total requests timed out */
  totalTimedOut: number;
  /** Average wait time in milliseconds */
  averageWaitTime: number;
  /** Requests by priority */
  byPriority: Record<RequestPriority, number>;
}

// ========================================
// Rate Limit Results
// ========================================

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Reason for denial (if not allowed) */
  reason?: RateLimitDenialReason;
  /** Time until rate limit resets (milliseconds) */
  retryAfter?: number;
  /** Remaining requests in current window */
  remaining?: number;
  /** Rate limit that was hit (if denied) */
  limitTier?: RateLimitTier;
  /** Specific limit name (relay URL or operation type) */
  limitName?: string;
}

/**
 * Reasons for rate limit denial
 */
export enum RateLimitDenialReason {
  /** Relay-specific limit exceeded */
  RELAY_LIMIT_EXCEEDED = 'relay_limit_exceeded',
  /** Operation-specific limit exceeded */
  OPERATION_LIMIT_EXCEEDED = 'operation_limit_exceeded',
  /** Global limit exceeded */
  GLOBAL_LIMIT_EXCEEDED = 'global_limit_exceeded',
  /** Queue is full */
  QUEUE_FULL = 'queue_full',
  /** Request timed out in queue */
  QUEUE_TIMEOUT = 'queue_timeout',
  /** Rate limiting disabled */
  DISABLED = 'disabled',
}

// ========================================
// Rate Limit Metrics
// ========================================

/**
 * Rate limit statistics for a specific limit
 */
export interface RateLimitStats {
  /** Total requests attempted */
  totalRequests: number;
  /** Requests allowed */
  allowed: number;
  /** Requests denied */
  denied: number;
  /** Requests queued */
  queued: number;
  /** Requests that timed out */
  timedOut: number;
  /** Success rate percentage */
  successRate: number;
  /** Average wait time (milliseconds) */
  averageWaitTime: number;
  /** Current bucket state */
  bucketState?: TokenBucketMetrics;
}

/**
 * Per-relay rate limit statistics
 */
export interface RelayRateLimitStats extends RateLimitStats {
  /** Relay URL */
  relay: string;
  /** Current connection state */
  connected: boolean;
}

/**
 * Per-operation rate limit statistics
 */
export interface OperationRateLimitStats extends RateLimitStats {
  /** Operation type */
  operation: RateLimitOperation;
}

/**
 * Complete rate limit metrics
 */
export interface RateLimitMetrics {
  /** Overall statistics */
  overall: RateLimitStats;
  /** Per-relay statistics */
  byRelay: Map<string, RelayRateLimitStats>;
  /** Per-operation statistics */
  byOperation: Map<RateLimitOperation, OperationRateLimitStats>;
  /** Global rate limit stats */
  global: RateLimitStats;
  /** Queue metrics */
  queue: QueueMetrics;
  /** Last update timestamp */
  lastUpdate: number;
}

/**
 * Rate limit event data
 */
export interface RateLimitEvent {
  /** Event type */
  type: RateLimitEventType;
  /** Operation that triggered the event */
  operation: RateLimitOperation;
  /** Relay involved (if applicable) */
  relay?: string;
  /** Rate limit tier */
  tier: RateLimitTier;
  /** Additional event data */
  data?: Record<string, unknown>;
  /** Event timestamp */
  timestamp: number;
}

/**
 * Rate limit event types
 */
export enum RateLimitEventType {
  /** Request allowed */
  ALLOWED = 'allowed',
  /** Request denied */
  DENIED = 'denied',
  /** Request queued */
  QUEUED = 'queued',
  /** Request processed from queue */
  PROCESSED = 'processed',
  /** Request timed out */
  TIMEOUT = 'timeout',
  /** Rate limit hit (warning threshold) */
  LIMIT_HIT = 'limit_hit',
  /** Rate limit reset */
  LIMIT_RESET = 'limit_reset',
}

// ========================================
// Rate Limit Alerts
// ========================================

/**
 * Rate limit alert
 */
export interface RateLimitAlert {
  /** Alert ID */
  id: string;
  /** Alert severity */
  severity: RateLimitAlertSeverity;
  /** Alert type */
  type: RateLimitAlertType;
  /** Alert message */
  message: string;
  /** Operation involved */
  operation?: RateLimitOperation;
  /** Relay involved */
  relay?: string;
  /** Alert metadata */
  metadata: Record<string, unknown>;
  /** Alert timestamp */
  timestamp: number;
}

/**
 * Rate limit alert severity
 */
export enum RateLimitAlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Rate limit alert types
 */
export enum RateLimitAlertType {
  /** Consistently hitting rate limits */
  CONSISTENT_LIMIT_HIT = 'consistent_limit_hit',
  /** Queue size growing rapidly */
  QUEUE_GROWING = 'queue_growing',
  /** High timeout rate */
  HIGH_TIMEOUT_RATE = 'high_timeout_rate',
  /** Rate limit configuration issue */
  CONFIG_ISSUE = 'config_issue',
  /** Performance degradation due to rate limiting */
  PERFORMANCE_DEGRADED = 'performance_degraded',
}

// ========================================
// Export Configuration
// ========================================

/**
 * Default rate limit policies
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitPolicy> = {
  // Per-operation defaults (per relay)
  publishEvent: { requests: 10, window: 1000 }, // 10/sec per relay
  subscribe: { requests: 5, window: 1000 }, // 5/sec per relay
  query: { requests: 20, window: 1000 }, // 20/sec per relay
  nip05Verify: { requests: 2, window: 1000 }, // 2/sec per relay
  fetchEvent: { requests: 30, window: 1000 }, // 30/sec per relay
  batch: { requests: 3, window: 1000 }, // 3/sec per relay

  // Global limit across all operations
  global: { requests: 100, window: 1000 }, // 100/sec total
};

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG = {
  enabled: true,
  maxQueueSize: 1000,
  queueTimeout: 5000, // 5 seconds
  enablePriority: true,
};
