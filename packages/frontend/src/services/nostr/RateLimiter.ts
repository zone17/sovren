/**
 * 🚦 ELITE SERVICE: NOSTR Rate Limiter
 *
 * US-321: Implement NOSTR Rate Limiting
 * Epic 003: NOSTR Consolidation
 *
 * Token bucket rate limiting with:
 * - Multi-tier rate limits (per-relay, per-operation, global)
 * - Request queuing with priority support
 * - Automatic backpressure handling
 * - Comprehensive metrics and monitoring
 * - Alert generation for rate limit issues
 *
 * Algorithm: Token Bucket
 * - Tokens refill at a constant rate
 * - Each request consumes 1 token
 * - Requests are denied when no tokens available
 * - Burst capacity allows temporary spikes
 *
 * @example
 * ```typescript
 * const limiter = RateLimiter.getInstance();
 * await limiter.initialize({
 *   enabled: true,
 *   enableQueuing: true,
 *   enablePriority: true,
 * });
 *
 * // Check if request is allowed
 * const result = await limiter.checkLimit({
 *   operation: RateLimitOperation.PUBLISH_EVENT,
 *   relay: 'wss://relay.damus.io',
 *   priority: RequestPriority.HIGH,
 * });
 *
 * if (result.allowed) {
 *   // Proceed with request
 * } else {
 *   // Handle rate limit (queued or denied)
 * }
 * ```
 */

import { EventEmitter } from 'events';
import {
  RateLimitOperation,
  RateLimitTier,
  RateLimitDenialReason,
  RequestPriority,
  RateLimitEventType,
  RateLimitAlertType,
  RateLimitAlertSeverity,
  DEFAULT_RATE_LIMITS,
  DEFAULT_QUEUE_CONFIG,
  type RateLimitConfig,
  type RateLimitPolicy,
  type RateLimitResult,
  type TokenBucket,
  type TokenBucketMetrics,
  type QueuedRequest,
  type QueueMetrics,
  type RateLimitMetrics,
  type RateLimitStats,
  type RelayRateLimitStats,
  type OperationRateLimitStats,
  type RateLimitEvent,
  type RateLimitAlert,
} from './types/rate-limit';

// ========================================
// Request Options
// ========================================

/**
 * Options for rate limit check
 */
export interface CheckLimitOptions<T = unknown> {
  /** Operation type */
  operation: RateLimitOperation;
  /** Target relay (optional, used for relay-specific limits) */
  relay?: string;
  /** Request priority (for queuing) */
  priority?: RequestPriority;
  /** Request payload (for queuing) */
  payload?: T;
  /** Skip queuing even if enabled */
  skipQueue?: boolean;
}

// ========================================
// Default Configuration
// ========================================

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  enabled: true,
  relayLimits: new Map(),
  defaultRelayLimit: { requests: 50, window: 1000 }, // 50/sec per relay default
  operationLimits: {
    [RateLimitOperation.PUBLISH_EVENT]: DEFAULT_RATE_LIMITS.publishEvent,
    [RateLimitOperation.SUBSCRIBE]: DEFAULT_RATE_LIMITS.subscribe,
    [RateLimitOperation.QUERY]: DEFAULT_RATE_LIMITS.query,
    [RateLimitOperation.NIP05_VERIFY]: DEFAULT_RATE_LIMITS.nip05Verify,
    [RateLimitOperation.FETCH_EVENT]: DEFAULT_RATE_LIMITS.fetchEvent,
    [RateLimitOperation.BATCH]: DEFAULT_RATE_LIMITS.batch,
  },
  globalLimit: DEFAULT_RATE_LIMITS.global,
  enableQueuing: DEFAULT_QUEUE_CONFIG.enabled,
  maxQueueSize: DEFAULT_QUEUE_CONFIG.maxQueueSize,
  queueTimeout: DEFAULT_QUEUE_CONFIG.queueTimeout,
  enablePriority: DEFAULT_QUEUE_CONFIG.enablePriority,
  enableMetrics: true,
};

// ========================================
// Rate Limiter Service (Singleton)
// ========================================

export class RateLimiter extends EventEmitter {
  private static instance: RateLimiter | null = null;

  private config: Required<RateLimitConfig>;
  private initialized = false;

  // Token buckets for different rate limit tiers
  private relayBuckets: Map<string, TokenBucket> = new Map();
  private operationBuckets: Map<RateLimitOperation, TokenBucket> = new Map();
  private globalBucket: TokenBucket | null = null;

  // Request queue (priority queue implementation)
  private requestQueue: QueuedRequest[] = [];
  private queueProcessingTimer?: NodeJS.Timeout;
  private requestCounter = 0;

  // Metrics tracking
  private stats: Map<string, RateLimitStats> = new Map();
  private queueMetrics: QueueMetrics = {
    size: 0,
    maxSize: 0,
    totalQueued: 0,
    totalProcessed: 0,
    totalTimedOut: 0,
    averageWaitTime: 0,
    byPriority: {
      [RequestPriority.CRITICAL]: 0,
      [RequestPriority.HIGH]: 0,
      [RequestPriority.NORMAL]: 0,
      [RequestPriority.LOW]: 0,
      [RequestPriority.LOWEST]: 0,
    },
  };

  // Alert tracking
  private alerts: RateLimitAlert[] = [];
  private maxAlerts = 100;

  /**
   * Private constructor (Singleton pattern)
   */
  private constructor() {
    super();
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  // ========================================
  // Initialization
  // ========================================

  /**
   * Initialize rate limiter
   */
  async initialize(config?: Partial<RateLimitConfig>): Promise<void> {
    if (this.initialized) {
      console.warn('[RateLimiter] Already initialized');
      return;
    }

    // Merge configuration
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      operationLimits: {
        ...DEFAULT_CONFIG.operationLimits,
        ...config?.operationLimits,
      },
    };

    if (!this.config.enabled) {
      console.log('[RateLimiter] Rate limiting disabled');
      this.initialized = true;
      return;
    }

    // Initialize global bucket
    if (this.config.globalLimit) {
      this.globalBucket = this.createTokenBucket(this.config.globalLimit);
    }

    // Initialize operation buckets
    Object.entries(this.config.operationLimits).forEach(([operation, policy]) => {
      this.operationBuckets.set(operation as RateLimitOperation, this.createTokenBucket(policy));
    });

    // Start queue processing if enabled
    if (this.config.enableQueuing) {
      this.startQueueProcessing();
    }

    this.initialized = true;
    console.log('[RateLimiter] Initialized successfully');
  }

  /**
   * Check if rate limiter is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ========================================
  // Token Bucket Management
  // ========================================

  /**
   * Create a new token bucket
   */
  private createTokenBucket(policy: RateLimitPolicy): TokenBucket {
    const refillRate = policy.refillRate || policy.requests / (policy.window / 1000);
    const capacity = policy.burstSize || policy.requests;

    return {
      tokens: capacity, // Start with full bucket
      capacity,
      refillRate,
      lastRefill: Date.now(),
      policy,
    };
  }

  /**
   * Refill tokens in a bucket based on elapsed time
   */
  private refillTokens(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = elapsed * bucket.refillRate;

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Consume a token from a bucket
   */
  private consumeToken(bucket: TokenBucket): boolean {
    this.refillTokens(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get time until next token is available
   */
  private getTimeUntilNextToken(bucket: TokenBucket): number {
    this.refillTokens(bucket);

    if (bucket.tokens >= 1) {
      return 0;
    }

    // Calculate time needed for one token
    const tokensNeeded = 1 - bucket.tokens;
    const timeNeeded = (tokensNeeded / bucket.refillRate) * 1000; // Convert to milliseconds

    return Math.ceil(timeNeeded);
  }

  /**
   * Get token bucket metrics
   */
  private getBucketMetrics(bucket: TokenBucket): TokenBucketMetrics {
    this.refillTokens(bucket);

    return {
      currentTokens: bucket.tokens,
      capacity: bucket.capacity,
      refillRate: bucket.refillRate,
      timeUntilNextToken: this.getTimeUntilNextToken(bucket),
      utilization: ((bucket.capacity - bucket.tokens) / bucket.capacity) * 100,
    };
  }

  // ========================================
  // Rate Limit Checking
  // ========================================

  /**
   * Check if a request is allowed under rate limits
   */
  async checkLimit<T = unknown>(options: CheckLimitOptions<T>): Promise<RateLimitResult> {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    const { operation, relay, skipQueue = false } = options;

    // Check global limit first
    if (this.globalBucket) {
      const globalAllowed = this.consumeToken(this.globalBucket);
      if (!globalAllowed) {
        const retryAfter = this.getTimeUntilNextToken(this.globalBucket);

        // Try to queue if enabled
        if (this.config.enableQueuing && !skipQueue) {
          return this.queueRequest(options, retryAfter);
        }

        this.recordDenial(operation, RateLimitTier.GLOBAL, 'global', relay);
        this.emitEvent({
          type: RateLimitEventType.DENIED,
          operation,
          relay,
          tier: RateLimitTier.GLOBAL,
          timestamp: Date.now(),
        });

        return {
          allowed: false,
          reason: RateLimitDenialReason.GLOBAL_LIMIT_EXCEEDED,
          retryAfter,
          limitTier: RateLimitTier.GLOBAL,
          limitName: 'global',
        };
      }
    }

    // Check operation-specific limit
    const operationBucket = this.operationBuckets.get(operation);
    if (operationBucket) {
      const operationAllowed = this.consumeToken(operationBucket);
      if (!operationAllowed) {
        const retryAfter = this.getTimeUntilNextToken(operationBucket);

        // Try to queue if enabled
        if (this.config.enableQueuing && !skipQueue) {
          return this.queueRequest(options, retryAfter);
        }

        this.recordDenial(operation, RateLimitTier.OPERATION, operation, relay);
        this.emitEvent({
          type: RateLimitEventType.DENIED,
          operation,
          relay,
          tier: RateLimitTier.OPERATION,
          timestamp: Date.now(),
        });

        return {
          allowed: false,
          reason: RateLimitDenialReason.OPERATION_LIMIT_EXCEEDED,
          retryAfter,
          limitTier: RateLimitTier.OPERATION,
          limitName: operation,
        };
      }
    }

    // Check relay-specific limit (if relay is specified)
    if (relay) {
      const relayBucket = this.getOrCreateRelayBucket(relay);
      const relayAllowed = this.consumeToken(relayBucket);

      if (!relayAllowed) {
        const retryAfter = this.getTimeUntilNextToken(relayBucket);

        // Try to queue if enabled
        if (this.config.enableQueuing && !skipQueue) {
          return this.queueRequest(options, retryAfter);
        }

        this.recordDenial(operation, RateLimitTier.RELAY, relay, relay);
        this.emitEvent({
          type: RateLimitEventType.DENIED,
          operation,
          relay,
          tier: RateLimitTier.RELAY,
          timestamp: Date.now(),
        });

        return {
          allowed: false,
          reason: RateLimitDenialReason.RELAY_LIMIT_EXCEEDED,
          retryAfter,
          limitTier: RateLimitTier.RELAY,
          limitName: relay,
        };
      }
    }

    // Request is allowed
    this.recordAllowed(operation, relay);
    this.emitEvent({
      type: RateLimitEventType.ALLOWED,
      operation,
      relay,
      tier: RateLimitTier.GLOBAL,
      timestamp: Date.now(),
    });

    return { allowed: true };
  }

  /**
   * Get or create relay-specific bucket
   */
  private getOrCreateRelayBucket(relay: string): TokenBucket {
    let bucket = this.relayBuckets.get(relay);

    if (!bucket) {
      const policy = this.config.relayLimits?.get(relay) || this.config.defaultRelayLimit;
      bucket = this.createTokenBucket(policy);
      this.relayBuckets.set(relay, bucket);
    }

    return bucket;
  }

  // ========================================
  // Request Queuing
  // ========================================

  /**
   * Queue a request for later processing
   */
  private queueRequest<T>(
    options: CheckLimitOptions<T>,
    estimatedWait: number
  ): Promise<RateLimitResult> {
    // Check if queue is full
    if (this.config.maxQueueSize > 0 && this.requestQueue.length >= this.config.maxQueueSize) {
      this.recordDenial(options.operation, RateLimitTier.GLOBAL, 'queue', options.relay);
      return Promise.resolve({
        allowed: false,
        reason: RateLimitDenialReason.QUEUE_FULL,
        retryAfter: estimatedWait,
      });
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${++this.requestCounter}_${Date.now()}`;
      const queuedRequest: QueuedRequest<T> = {
        id: requestId,
        payload: options.payload as T,
        operation: options.operation,
        relay: options.relay,
        priority: options.priority ?? RequestPriority.NORMAL,
        createdAt: Date.now(),
        timeout: Date.now() + this.config.queueTimeout,
        retries: 0,
        resolve,
        reject,
      };

      // Insert into queue based on priority
      this.insertIntoQueue(queuedRequest);

      // Update metrics
      this.queueMetrics.totalQueued++;
      this.queueMetrics.size = this.requestQueue.length;
      this.queueMetrics.maxSize = Math.max(this.queueMetrics.maxSize, this.requestQueue.length);
      this.queueMetrics.byPriority[queuedRequest.priority]++;

      this.recordQueued(options.operation, options.relay);
      this.emitEvent({
        type: RateLimitEventType.QUEUED,
        operation: options.operation,
        relay: options.relay,
        tier: RateLimitTier.GLOBAL,
        data: { requestId, priority: queuedRequest.priority, queueSize: this.requestQueue.length },
        timestamp: Date.now(),
      });

      // Check for queue growth alert
      if (this.requestQueue.length > this.config.maxQueueSize * 0.8) {
        this.emitAlert({
          severity: RateLimitAlertSeverity.WARNING,
          type: RateLimitAlertType.QUEUE_GROWING,
          message: `Request queue is growing: ${this.requestQueue.length} requests`,
          operation: options.operation,
          relay: options.relay,
          metadata: { queueSize: this.requestQueue.length, maxSize: this.config.maxQueueSize },
        });
      }
    });
  }

  /**
   * Insert request into queue based on priority
   */
  private insertIntoQueue<T>(request: QueuedRequest<T>): void {
    if (!this.config.enablePriority) {
      // FIFO if priority disabled
      this.requestQueue.push(request);
      return;
    }

    // Find insertion point based on priority (lower number = higher priority)
    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      if (request.priority < this.requestQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    this.requestQueue.splice(insertIndex, 0, request);
  }

  /**
   * Start queue processing loop
   */
  private startQueueProcessing(): void {
    if (this.queueProcessingTimer) {
      return;
    }

    // Process queue every 10ms for responsiveness
    this.queueProcessingTimer = setInterval(() => {
      this.processQueue();
    }, 10);
  }

  /**
   * Stop queue processing
   */
  private stopQueueProcessing(): void {
    if (this.queueProcessingTimer) {
      clearInterval(this.queueProcessingTimer);
      this.queueProcessingTimer = undefined;
    }
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    const now = Date.now();
    const processedRequests: string[] = [];
    const timedOutRequests: string[] = [];

    // Process requests in priority order
    for (const request of this.requestQueue) {
      // Check for timeout
      if (now > request.timeout) {
        timedOutRequests.push(request.id);
        request.reject(new Error('Request timed out in queue'));

        this.queueMetrics.totalTimedOut++;
        this.recordTimeout(request.operation, request.relay);
        this.emitEvent({
          type: RateLimitEventType.TIMEOUT,
          operation: request.operation,
          relay: request.relay,
          tier: RateLimitTier.GLOBAL,
          data: { requestId: request.id, waitTime: now - request.createdAt },
          timestamp: now,
        });
        continue;
      }

      // Try to process request
      const result = await this.checkLimit({
        operation: request.operation,
        relay: request.relay,
        priority: request.priority,
        skipQueue: true, // Prevent re-queuing
      });

      if (result.allowed) {
        processedRequests.push(request.id);
        const waitTime = now - request.createdAt;

        request.resolve(result);

        this.queueMetrics.totalProcessed++;
        this.updateAverageWaitTime(waitTime);

        this.emitEvent({
          type: RateLimitEventType.PROCESSED,
          operation: request.operation,
          relay: request.relay,
          tier: RateLimitTier.GLOBAL,
          data: { requestId: request.id, waitTime },
          timestamp: now,
        });
      }
    }

    // Remove processed and timed out requests
    this.requestQueue = this.requestQueue.filter(
      (req) => !processedRequests.includes(req.id) && !timedOutRequests.includes(req.id)
    );
    this.queueMetrics.size = this.requestQueue.length;

    // Check for high timeout rate alert
    const timeoutRate =
      this.queueMetrics.totalQueued > 0
        ? this.queueMetrics.totalTimedOut / this.queueMetrics.totalQueued
        : 0;

    if (timeoutRate > 0.2) {
      this.emitAlert({
        severity: RateLimitAlertSeverity.ERROR,
        type: RateLimitAlertType.HIGH_TIMEOUT_RATE,
        message: `High timeout rate: ${(timeoutRate * 100).toFixed(1)}%`,
        metadata: {
          timeoutRate,
          totalTimedOut: this.queueMetrics.totalTimedOut,
          totalQueued: this.queueMetrics.totalQueued,
        },
      });
    }
  }

  /**
   * Update average wait time metric
   */
  private updateAverageWaitTime(waitTime: number): void {
    const totalProcessed = this.queueMetrics.totalProcessed;
    const currentAverage = this.queueMetrics.averageWaitTime;

    // Rolling average
    this.queueMetrics.averageWaitTime =
      (currentAverage * (totalProcessed - 1) + waitTime) / totalProcessed;
  }

  // ========================================
  // Metrics and Statistics
  // ========================================

  /**
   * Record successful request
   */
  private recordAllowed(operation: RateLimitOperation, relay?: string): void {
    if (!this.config.enableMetrics) return;

    const key = this.getStatsKey(operation, relay);
    const stats = this.getOrCreateStats(key);

    stats.totalRequests++;
    stats.allowed++;
    stats.successRate = (stats.allowed / stats.totalRequests) * 100;
  }

  /**
   * Record denied request
   */
  private recordDenial(
    operation: RateLimitOperation,
    tier: RateLimitTier,
    limitName: string,
    relay?: string
  ): void {
    if (!this.config.enableMetrics) return;

    const key = this.getStatsKey(operation, relay);
    const stats = this.getOrCreateStats(key);

    stats.totalRequests++;
    stats.denied++;
    stats.successRate = (stats.allowed / stats.totalRequests) * 100;

    // Check for consistent limit hits
    if (stats.denied > 10 && stats.denied / stats.totalRequests > 0.5) {
      this.emitAlert({
        severity: RateLimitAlertSeverity.WARNING,
        type: RateLimitAlertType.CONSISTENT_LIMIT_HIT,
        message: `Consistently hitting ${tier} rate limit: ${limitName}`,
        operation,
        relay,
        metadata: {
          tier,
          limitName,
          denialRate: stats.denied / stats.totalRequests,
          totalDenied: stats.denied,
        },
      });
    }
  }

  /**
   * Record queued request
   */
  private recordQueued(operation: RateLimitOperation, relay?: string): void {
    if (!this.config.enableMetrics) return;

    const key = this.getStatsKey(operation, relay);
    const stats = this.getOrCreateStats(key);

    stats.totalRequests++;
    stats.queued++;
  }

  /**
   * Record timed out request
   */
  private recordTimeout(operation: RateLimitOperation, relay?: string): void {
    if (!this.config.enableMetrics) return;

    const key = this.getStatsKey(operation, relay);
    const stats = this.getOrCreateStats(key);

    stats.timedOut++;
  }

  /**
   * Get stats key for operation/relay combination
   */
  private getStatsKey(operation: RateLimitOperation, relay?: string): string {
    return relay ? `${operation}:${relay}` : operation;
  }

  /**
   * Get or create stats object
   */
  private getOrCreateStats(key: string): RateLimitStats {
    let stats = this.stats.get(key);

    if (!stats) {
      stats = {
        totalRequests: 0,
        allowed: 0,
        denied: 0,
        queued: 0,
        timedOut: 0,
        successRate: 100,
        averageWaitTime: 0,
      };
      this.stats.set(key, stats);
    }

    return stats;
  }

  /**
   * Get complete rate limit metrics
   */
  getMetrics(): RateLimitMetrics {
    // Calculate overall stats
    const overall: RateLimitStats = {
      totalRequests: 0,
      allowed: 0,
      denied: 0,
      queued: 0,
      timedOut: 0,
      successRate: 100,
      averageWaitTime: this.queueMetrics.averageWaitTime,
    };

    const byRelay = new Map<string, RelayRateLimitStats>();
    const byOperation = new Map<RateLimitOperation, OperationRateLimitStats>();

    // Aggregate stats
    this.stats.forEach((stats, key) => {
      overall.totalRequests += stats.totalRequests;
      overall.allowed += stats.allowed;
      overall.denied += stats.denied;
      overall.queued += stats.queued;
      overall.timedOut += stats.timedOut;

      // Parse key to determine type
      if (key.includes(':')) {
        const [, relay] = key.split(':');
        byRelay.set(relay, {
          ...stats,
          relay,
          connected: true, // Would need to check with RelayPoolManager
        });
      } else {
        byOperation.set(key as RateLimitOperation, {
          ...stats,
          operation: key as RateLimitOperation,
        });
      }
    });

    overall.successRate =
      overall.totalRequests > 0 ? (overall.allowed / overall.totalRequests) * 100 : 100;

    // Global stats from global bucket
    const globalStats: RateLimitStats = {
      totalRequests: overall.totalRequests,
      allowed: overall.allowed,
      denied: overall.denied,
      queued: overall.queued,
      timedOut: overall.timedOut,
      successRate: overall.successRate,
      averageWaitTime: overall.averageWaitTime,
      bucketState: this.globalBucket ? this.getBucketMetrics(this.globalBucket) : undefined,
    };

    return {
      overall,
      byRelay,
      byOperation,
      global: globalStats,
      queue: { ...this.queueMetrics },
      lastUpdate: Date.now(),
    };
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics(): QueueMetrics {
    return { ...this.queueMetrics };
  }

  /**
   * Get stats for specific operation
   */
  getOperationStats(operation: RateLimitOperation): OperationRateLimitStats | null {
    const stats = this.stats.get(operation);
    if (!stats) return null;

    return {
      ...stats,
      operation,
      bucketState: this.operationBuckets.get(operation)
        ? this.getBucketMetrics(this.operationBuckets.get(operation)!)
        : undefined,
    };
  }

  /**
   * Get stats for specific relay
   */
  getRelayStats(relay: string): RelayRateLimitStats | null {
    const stats = Array.from(this.stats.entries())
      .filter(([key]) => key.includes(`:${relay}`))
      .reduce<RateLimitStats | null>((acc, [, s]) => {
        if (!acc) return { ...s };
        return {
          totalRequests: acc.totalRequests + s.totalRequests,
          allowed: acc.allowed + s.allowed,
          denied: acc.denied + s.denied,
          queued: acc.queued + s.queued,
          timedOut: acc.timedOut + s.timedOut,
          successRate: 0, // Will calculate below
          averageWaitTime: (acc.averageWaitTime + s.averageWaitTime) / 2,
        };
      }, null);

    if (!stats) return null;

    stats.successRate = stats.totalRequests > 0 ? (stats.allowed / stats.totalRequests) * 100 : 100;

    return {
      ...stats,
      relay,
      connected: true, // Would need to check with RelayPoolManager
      bucketState: this.relayBuckets.get(relay)
        ? this.getBucketMetrics(this.relayBuckets.get(relay)!)
        : undefined,
    };
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats.clear();
    this.queueMetrics = {
      size: this.requestQueue.length,
      maxSize: 0,
      totalQueued: 0,
      totalProcessed: 0,
      totalTimedOut: 0,
      averageWaitTime: 0,
      byPriority: {
        [RequestPriority.CRITICAL]: 0,
        [RequestPriority.HIGH]: 0,
        [RequestPriority.NORMAL]: 0,
        [RequestPriority.LOW]: 0,
        [RequestPriority.LOWEST]: 0,
      },
    };
  }

  // ========================================
  // Configuration Management
  // ========================================

  /**
   * Update rate limit configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      operationLimits: {
        ...this.config.operationLimits,
        ...config.operationLimits,
      },
    };

    // Recreate buckets with new policies
    if (config.operationLimits) {
      Object.entries(config.operationLimits).forEach(([operation, policy]) => {
        this.operationBuckets.set(operation as RateLimitOperation, this.createTokenBucket(policy));
      });
    }

    if (config.globalLimit) {
      this.globalBucket = this.createTokenBucket(config.globalLimit);
    }

    // Update queue processing
    if (config.enableQueuing === false && this.queueProcessingTimer) {
      this.stopQueueProcessing();
    } else if (config.enableQueuing === true && !this.queueProcessingTimer) {
      this.startQueueProcessing();
    }
  }

  /**
   * Set relay-specific limit
   */
  setRelayLimit(relay: string, policy: RateLimitPolicy): void {
    if (!this.config.relayLimits) {
      this.config.relayLimits = new Map();
    }
    this.config.relayLimits.set(relay, policy);
    this.relayBuckets.set(relay, this.createTokenBucket(policy));
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<RateLimitConfig> {
    return { ...this.config };
  }

  // ========================================
  // Event Emission
  // ========================================

  /**
   * Emit rate limit event
   */
  private emitEvent(event: RateLimitEvent): void {
    this.emit('rate-limit-event', event);
    this.emit(event.type, event);
  }

  /**
   * Emit rate limit alert
   */
  private emitAlert(alert: Omit<RateLimitAlert, 'id' | 'timestamp'>): void {
    const fullAlert: RateLimitAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
    };

    this.alerts.push(fullAlert);

    // Trim alerts if exceeding max
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    this.emit('alert', fullAlert);
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit?: number): RateLimitAlert[] {
    return limit ? this.alerts.slice(-limit) : [...this.alerts];
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  // ========================================
  // Lifecycle
  // ========================================

  /**
   * Destroy rate limiter and cleanup
   */
  async destroy(): Promise<void> {
    // Stop queue processing
    this.stopQueueProcessing();

    // Reject all queued requests
    this.requestQueue.forEach((request) => {
      request.reject(new Error('Rate limiter is being destroyed'));
    });
    this.requestQueue = [];

    // Clear all state
    this.relayBuckets.clear();
    this.operationBuckets.clear();
    this.globalBucket = null;
    this.stats.clear();
    this.alerts = [];

    // Remove all listeners
    this.removeAllListeners();

    this.initialized = false;
    RateLimiter.instance = null;

    console.log('[RateLimiter] Destroyed successfully');
  }
}

// ========================================
// Singleton Export
// ========================================

export const rateLimiter = RateLimiter.getInstance();
