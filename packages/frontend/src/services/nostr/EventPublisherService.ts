/**
 * 📡 ELITE SERVICE: Event Publisher Service
 * US-303: Create Unified Event Publisher Service
 *
 * Centralized service for creating, signing, and publishing NOSTR events.
 *
 * Features:
 * - Event creation from templates with auto-population
 * - Event signing (local key or browser extension)
 * - Multi-relay publishing with health-based selection
 * - Publishing strategies: broadcast, targeted, smart, batch
 * - Retry logic with exponential backoff
 * - Pre-publish validation
 * - Event tracking and analytics
 * - NIP compliance checking
 *
 * @example
 * ```typescript
 * const publisher = EventPublisherService.getInstance();
 * await publisher.initialize();
 *
 * // Create and publish a text note
 * const result = await publisher.createAndPublish({
 *   kind: 1,
 *   content: 'Hello NOSTR!',
 *   tags: [['t', 'nostr']],
 * });
 *
 * // Publish with retry
 * const retryResult = await publisher.publishWithRetry(event, {
 *   maxRetries: 3,
 *   backoffMs: 1000,
 * });
 *
 * // Batch publish
 * const batchResult = await publisher.publishBatch([event1, event2, event3]);
 * ```
 */

import { EventEmitter } from 'events';
import {
  type NostrEvent,
  type UnsignedNostrEvent,
  type EventTemplate,
  type PublishResult as BasePublishResult,
  type RelayPublishResult,
  type BatchPublishResult,
  type EventValidationResult,
  NostrEventSchema,
} from '@shared/types/nostr/index';
import { KeyManagementService } from './KeyManagementService';
import { RelayPoolManager } from './RelayPoolManager';
import type { PublishResult } from './types';
import { RateLimiter } from './RateLimiter';
import { RateLimitOperation, RequestPriority } from './types/rate-limit';

/**
 * Publishing strategy types
 */
export type PublishStrategy = 'broadcast' | 'targeted' | 'smart' | 'batch';

/**
 * Publishing options
 */
export interface PublishOptions {
  /** Publishing strategy */
  strategy?: PublishStrategy;
  /** Specific relays to publish to (targeted strategy) */
  relays?: string[];
  /** Number of relays for smart strategy */
  relayCount?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Skip pre-publish validation */
  skipValidation?: boolean;
  /** Require minimum successful relays */
  requireMinRelays?: number;
  /** NIP-26 delegation (if event is delegated) */
  delegation?: import('./NIP26Service').DelegationResult;
}

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds */
  backoffMs?: number;
  /** Maximum backoff delay in milliseconds */
  maxBackoffMs?: number;
}

/**
 * Complete publish result with metrics
 */
export interface PublishResultComplete extends BasePublishResult {
  /** Publishing strategy used */
  strategy?: PublishStrategy;
  /** Retry attempts made */
  retryAttempts?: number;
}

/**
 * Event Publisher Service (Singleton)
 */
export class EventPublisherService extends EventEmitter {
  private static instance: EventPublisherService | null = null;
  private keyManagement: KeyManagementService;
  private relayPool: RelayPoolManager;
  private rateLimiter: RateLimiter;
  private initialized = false;

  /** Event publishing statistics */
  private stats = {
    totalPublished: 0,
    successfulPublishes: 0,
    failedPublishes: 0,
    totalRetries: 0,
    rateLimited: 0,
  };

  /**
   * Private constructor (Singleton pattern)
   */
  private constructor() {
    super();
    this.keyManagement = KeyManagementService.getInstance();
    this.relayPool = RelayPoolManager.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EventPublisherService {
    if (!EventPublisherService.instance) {
      EventPublisherService.instance = new EventPublisherService();
    }
    return EventPublisherService.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[EventPublisher] Service already initialized');
      return;
    }

    // Verify dependencies are initialized
    if (!this.keyManagement.isInitialized()) {
      throw new Error('KeyManagementService must be initialized first');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(this.relayPool as any).isInitialized) {
      console.warn(
        '[EventPublisher] RelayPoolManager not initialized, some features may be limited'
      );
    }

    this.initialized = true;
    console.log('[EventPublisher] Service initialized');
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create unsigned event from template
   */
  async createUnsignedEvent(template: EventTemplate): Promise<UnsignedNostrEvent> {
    const activeKey = this.keyManagement.getActiveKey();
    if (!activeKey) {
      throw new Error('No active key available');
    }

    const event: UnsignedNostrEvent = {
      pubkey: activeKey.publicKey,
      created_at: template.created_at || Math.floor(Date.now() / 1000),
      kind: template.kind as number,
      tags: template.tags || [],
      content: template.content || '',
    };

    return event;
  }

  /**
   * Create and sign event from template
   */
  async createEvent(template: EventTemplate, keyId?: string): Promise<NostrEvent> {
    // Create unsigned event
    const unsignedEvent = await this.createUnsignedEvent(template);

    // Sign the event
    const signedEvent = await this.signEvent(unsignedEvent, keyId);

    return signedEvent;
  }

  /**
   * Sign an unsigned event
   */
  async signEvent(unsignedEvent: UnsignedNostrEvent, keyId?: string): Promise<NostrEvent> {
    // Determine which key to use
    let signingKeyId = keyId;
    if (!signingKeyId) {
      const activeKey = this.keyManagement.getActiveKey();
      if (!activeKey) {
        throw new Error('No active key available for signing');
      }
      signingKeyId = activeKey.keyId;
    }

    // Sign with KeyManagementService
    const signedEvent = await this.keyManagement.signEvent(signingKeyId, unsignedEvent);

    // Verify signature
    const isValid = await this.keyManagement.verifyEventSignature(signedEvent);
    if (!isValid) {
      throw new Error('Event signature verification failed after signing');
    }

    return signedEvent;
  }

  /**
   * Validate event before publishing
   */
  async validateEvent(event: NostrEvent): Promise<EventValidationResult> {
    const errors: EventValidationResult['errors'] = [];
    const warnings: EventValidationResult['warnings'] = [];

    // Validate with Zod schema
    try {
      NostrEventSchema.parse(event);
    } catch (error: any) {
      if (error.errors) {
        error.errors.forEach((err: any) => {
          errors.push({
            field: err.path.join('.'),
            message: err.message,
            code: 'SCHEMA_VALIDATION_ERROR',
          });
        });
      }
    }

    // Validate ID length
    if (event.id.length !== 64) {
      errors.push({
        field: 'id',
        message: 'Event ID must be 64 character hex string',
        code: 'INVALID_ID_LENGTH',
      });
    }

    // Validate pubkey length
    if (event.pubkey.length !== 64) {
      errors.push({
        field: 'pubkey',
        message: 'Public key must be 64 character hex string',
        code: 'INVALID_PUBKEY_LENGTH',
      });
    }

    // Validate signature length
    if (event.sig.length !== 128) {
      errors.push({
        field: 'sig',
        message: 'Signature must be 128 character hex string',
        code: 'INVALID_SIGNATURE_LENGTH',
      });
    }

    // Check for future timestamps
    const now = Math.floor(Date.now() / 1000);
    const maxFutureOffset = 300; // 5 minutes
    if (event.created_at > now + maxFutureOffset) {
      warnings.push({
        field: 'created_at',
        message: `Timestamp is ${event.created_at - now}s in the future`,
        code: 'FUTURE_TIMESTAMP',
      });
    }

    // Check for very old timestamps
    const oneYearAgo = now - 365 * 24 * 60 * 60;
    if (event.created_at < oneYearAgo) {
      warnings.push({
        field: 'created_at',
        message: 'Timestamp is more than 1 year old',
        code: 'OLD_TIMESTAMP',
      });
    }

    // Verify signature
    const signatureValid = await this.keyManagement.verifyEventSignature(event);
    if (!signatureValid) {
      errors.push({
        field: 'sig',
        message: 'Invalid signature',
        code: 'INVALID_SIGNATURE',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Publish event to relays
   */
  async publish(event: NostrEvent, options: PublishOptions = {}): Promise<PublishResultComplete> {
    const startTime = Date.now();

    // Check rate limit before proceeding
    const rateLimitResult = await this.rateLimiter.checkLimit({
      operation: RateLimitOperation.PUBLISH_EVENT,
      priority: RequestPriority.HIGH, // User-initiated publish is high priority
      payload: event,
    });

    if (!rateLimitResult.allowed) {
      this.stats.rateLimited++;
      throw new Error(
        `Rate limit exceeded: ${rateLimitResult.reason}. Retry after ${rateLimitResult.retryAfter}ms`
      );
    }

    // Validate event unless skipped
    if (!options.skipValidation) {
      const validation = await this.validateEvent(event);
      if (!validation.valid) {
        throw new Error(
          `Event validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        );
      }
    }

    // Determine publishing strategy
    const strategy = options.strategy || 'broadcast';
    let relayResults: PublishResult[] = [];

    try {
      switch (strategy) {
        case 'broadcast':
          relayResults = await this.relayPool.publishEvent(event, options.relays);
          break;

        case 'targeted':
          if (!options.relays || options.relays.length === 0) {
            throw new Error('Targeted strategy requires relay list');
          }
          relayResults = await this.relayPool.publishEvent(event, options.relays);
          break;

        case 'smart': {
          const relayCount = options.relayCount || 3;
          relayResults = await this.relayPool.publishEventToFastest(event, relayCount);
          break;
        }

        case 'batch':
          // Batch is handled separately
          relayResults = await this.relayPool.publishEvent(event, options.relays);
          break;

        default:
          throw new Error(`Unknown publishing strategy: ${strategy}`);
      }

      // Analyze results
      const publishedTo = relayResults.filter(r => r.success).map(r => r.relay);
      const failedRelays = relayResults.filter(r => !r.success).map(r => r.relay);
      const totalLatency = Date.now() - startTime;

      // Check minimum relay requirement
      if (options.requireMinRelays && publishedTo.length < options.requireMinRelays) {
        throw new Error(
          `Published to ${publishedTo.length} relays, required minimum: ${options.requireMinRelays}`
        );
      }

      // Update statistics
      this.stats.totalPublished++;
      if (publishedTo.length > 0) {
        this.stats.successfulPublishes++;
      } else {
        this.stats.failedPublishes++;
      }

      // Map local PublishResult[] to shared RelayPublishResult[] for type compatibility
      const mappedRelayResults: RelayPublishResult[] = relayResults.map(r => ({
        relay: r.relay,
        success: r.success,
        error: r.error?.message,
        timestamp: Date.now(),
        latency: r.latency,
      }));

      const result: PublishResultComplete = {
        success: publishedTo.length > 0,
        event,
        eventId: event.id,
        relayResults: mappedRelayResults,
        publishedTo,
        failedRelays,
        timestamp: Date.now(),
        totalLatency,
        strategy,
      };

      this.emit('event:published', result);

      return result;
    } catch (error) {
      this.stats.failedPublishes++;
      this.emit('publish:error', event, error);
      throw error;
    }
  }

  /**
   * Publish to fastest relays
   */
  async publishToFastest(event: NostrEvent, count: number = 3): Promise<PublishResultComplete> {
    return this.publish(event, { strategy: 'smart', relayCount: count });
  }

  /**
   * Publish with retry logic
   */
  async publishWithRetry(
    event: NostrEvent,
    retryOptions: RetryOptions = {}
  ): Promise<PublishResultComplete> {
    const { maxRetries = 3, backoffMs = 1000, maxBackoffMs = 10000 } = retryOptions;

    let lastResult: PublishResultComplete | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        lastResult = await this.publish(event);

        // Success if at least one relay accepted
        if (lastResult.success) {
          lastResult.retryAttempts = attempt;
          return lastResult;
        }

        // No relays succeeded, prepare for retry
        lastError = new Error('No relays accepted the event');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }

      // Don't wait after last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.min(backoffMs * Math.pow(2, attempt), maxBackoffMs);
        await this.sleep(delay);
        this.stats.totalRetries++;
      }
    }

    // All retries exhausted
    if (lastResult) {
      lastResult.retryAttempts = maxRetries - 1;
      return lastResult;
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Batch publish multiple events
   */
  async publishBatch(
    events: NostrEvent[],
    options: PublishOptions = {}
  ): Promise<BatchPublishResult> {
    const startTime = Date.now();
    const results: PublishResultComplete[] = [];

    // Publish events in parallel with proper error handling
    const publishPromises = events.map(async event => {
      try {
        const result = await this.publish(event, options);
        return result;
      } catch (error) {
        // Wrap error in result format
        return {
          success: false,
          event,
          eventId: event.id,
          relayResults: [],
          publishedTo: [],
          failedRelays: [],
          timestamp: Date.now(),
          totalLatency: 0,
        } as PublishResultComplete;
      }
    });

    const batchResults = await Promise.all(publishPromises);
    results.push(...batchResults);

    // Calculate metrics
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const duration = Date.now() - startTime;
    const averageLatency =
      results.length > 0
        ? results.reduce((sum, r) => sum + (r.totalLatency || 0), 0) / results.length
        : 0;

    return {
      totalEvents: events.length,
      successCount,
      failureCount,
      results,
      duration,
      averageLatency,
    };
  }

  /**
   * Create and publish event in one operation
   */
  async createAndPublish(
    template: EventTemplate,
    publishOptions?: PublishOptions
  ): Promise<PublishResultComplete> {
    const event = await this.createEvent(template);
    return this.publish(event, publishOptions);
  }

  /**
   * Get publishing statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalPublished: 0,
      successfulPublishes: 0,
      failedPublishes: 0,
      totalRetries: 0,
      rateLimited: 0,
    };
  }

  /**
   * Destroy service instance and cleanup
   */
  async destroy(): Promise<void> {
    this.removeAllListeners();
    this.initialized = false;
    this.resetStats();
    EventPublisherService.instance = null;
    console.log('[EventPublisher] Service destroyed');
  }

  /**
   * Sleep helper for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const eventPublisherService = EventPublisherService.getInstance();
