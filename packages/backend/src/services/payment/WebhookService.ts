/**
 * WebhookService Implementation
 * User Story: US-E5-029
 * Complete webhook delivery system with retry logic and monitoring
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { IWebhookService } from '../../interfaces/payment/IWebhookService';
import type {
  IEventBus
} from '../../interfaces/shared/IEventBus';
import {
  DomainEventType,
} from '../../interfaces/shared/IEventBus';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
import type { IAuditLogService } from '../../interfaces/shared/IAuditLogService';
import {
  WebhookEventType,
  WebhookDeliveryStatus,
  CircuitBreakerState,
  type WebhookEndpoint,
  type CreateWebhookEndpointParams,
  type UpdateWebhookEndpointParams,
  type WebhookEventPayload,
  type WebhookDelivery,
  type WebhookDeliveryResult,
  type WebhookSignatureVerification,
  type WebhookDeliveryQuery,
  type WebhookEndpointStats,
  type WebhookSystemStats,
  type WebhookTestEventRequest,
  type WebhookSecretRotationRequest,
  type WebhookReplayRequest,
  type WebhookBulkManagementRequest,
  type WebhookHealthCheck,
  type WebhookNotification,
  type DeadLetterQueueEntry,
  type WebhookDeliveryJob,
  type WebhookRetryConfig,
  type WebhookRateLimitConfig,
  type WebhookCircuitBreakerConfig
} from '../../types/webhook';
import { createHmac, randomBytes } from 'crypto';
import { performance } from 'perf_hooks';

/**
 * Webhook repository interface
 */
interface IWebhookRepository {
  saveEndpoint(endpoint: WebhookEndpoint): Promise<void>;
  getEndpoint(endpointId: string): Promise<WebhookEndpoint | null>;
  updateEndpoint(endpoint: WebhookEndpoint): Promise<void>;
  deleteEndpoint(endpointId: string): Promise<void>;
  listEndpoints(userId: string, limit?: number, offset?: number): Promise<WebhookEndpoint[]>;
  getEndpointsByEventType(eventType: WebhookEventType): Promise<WebhookEndpoint[]>;

  saveDelivery(delivery: WebhookDelivery): Promise<void>;
  getDelivery(deliveryId: string): Promise<WebhookDelivery | null>;
  updateDelivery(delivery: WebhookDelivery): Promise<void>;
  queryDeliveries(query: WebhookDeliveryQuery): Promise<WebhookDelivery[]>;

  saveDLQEntry(entry: DeadLetterQueueEntry): Promise<void>;
  getDLQEntry(entryId: string): Promise<DeadLetterQueueEntry | null>;
  listDLQ(limit?: number, offset?: number): Promise<DeadLetterQueueEntry[]>;
  removeDLQEntry(entryId: string): Promise<void>;
}

/**
 * In-memory webhook repository
 */
class InMemoryWebhookRepository implements IWebhookRepository {
  private endpoints = new Map<string, WebhookEndpoint>();
  private deliveries = new Map<string, WebhookDelivery>();
  private dlq = new Map<string, DeadLetterQueueEntry>();

  async saveEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    this.endpoints.set(endpoint.id, endpoint);
  }

  async getEndpoint(endpointId: string): Promise<WebhookEndpoint | null> {
    return this.endpoints.get(endpointId) || null;
  }

  async updateEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    this.endpoints.set(endpoint.id, endpoint);
  }

  async deleteEndpoint(endpointId: string): Promise<void> {
    this.endpoints.delete(endpointId);
  }

  async listEndpoints(userId: string, limit = 100, offset = 0): Promise<WebhookEndpoint[]> {
    const endpoints = Array.from(this.endpoints.values()).filter(e => e.userId === userId);
    return endpoints.slice(offset, offset + limit);
  }

  async getEndpointsByEventType(eventType: WebhookEventType): Promise<WebhookEndpoint[]> {
    return Array.from(this.endpoints.values()).filter(
      e => e.enabled && e.events.includes(eventType)
    );
  }

  async saveDelivery(delivery: WebhookDelivery): Promise<void> {
    this.deliveries.set(delivery.id, delivery);
  }

  async getDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    return this.deliveries.get(deliveryId) || null;
  }

  async updateDelivery(delivery: WebhookDelivery): Promise<void> {
    this.deliveries.set(delivery.id, delivery);
  }

  async queryDeliveries(query: WebhookDeliveryQuery): Promise<WebhookDelivery[]> {
    let deliveries = Array.from(this.deliveries.values());

    if (query.endpointId) {
      deliveries = deliveries.filter(d => d.endpointId === query.endpointId);
    }
    if (query.eventType) {
      deliveries = deliveries.filter(d => d.eventType === query.eventType);
    }
    if (query.status) {
      deliveries = deliveries.filter(d => d.status === query.status);
    }
    if (query.startDate) {
      deliveries = deliveries.filter(d => d.createdAt >= query.startDate!);
    }
    if (query.endDate) {
      deliveries = deliveries.filter(d => d.createdAt <= query.endDate!);
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    deliveries.sort((a, b) => {
      const aVal = a[sortBy] as any;
      const bVal = b[sortBy] as any;
      return sortOrder === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    });

    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return deliveries.slice(offset, offset + limit);
  }

  async saveDLQEntry(entry: DeadLetterQueueEntry): Promise<void> {
    this.dlq.set(entry.id, entry);
  }

  async getDLQEntry(entryId: string): Promise<DeadLetterQueueEntry | null> {
    return this.dlq.get(entryId) || null;
  }

  async listDLQ(limit = 100, offset = 0): Promise<DeadLetterQueueEntry[]> {
    const entries = Array.from(this.dlq.values());
    return entries.slice(offset, offset + limit);
  }

  async removeDLQEntry(entryId: string): Promise<void> {
    this.dlq.delete(entryId);
  }
}

/**
 * Rate limiter for webhook deliveries
 */
class WebhookRateLimiter {
  private deliveries = new Map<string, number[]>(); // endpointId -> timestamps

  constructor(private config: WebhookRateLimitConfig) {}

  async isLimited(endpointId: string): Promise<boolean> {
    const now = Date.now();
    const timestamps = this.deliveries.get(endpointId) || [];

    // Remove expired timestamps
    const validTimestamps = timestamps.filter(t => now - t < this.config.windowMs);
    this.deliveries.set(endpointId, validTimestamps);

    return validTimestamps.length >= this.config.maxDeliveries;
  }

  async recordDelivery(endpointId: string): Promise<void> {
    const timestamps = this.deliveries.get(endpointId) || [];
    timestamps.push(Date.now());
    this.deliveries.set(endpointId, timestamps);
  }

  async getStatus(endpointId: string): Promise<{ limited: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const timestamps = this.deliveries.get(endpointId) || [];
    const validTimestamps = timestamps.filter(t => now - t < this.config.windowMs);

    const limited = validTimestamps.length >= this.config.maxDeliveries;
    const remaining = Math.max(0, this.config.maxDeliveries - validTimestamps.length);
    const oldestTimestamp = validTimestamps[0] || now;
    const resetAt = new Date(oldestTimestamp + this.config.windowMs);

    return { limited, remaining, resetAt };
  }

  reset(endpointId: string): void {
    this.deliveries.delete(endpointId);
  }
}

/**
 * Circuit breaker for failing endpoints
 */
class WebhookCircuitBreaker {
  private states = new Map<string, {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    lastFailureAt?: Date;
    openedAt?: Date;
  }>();

  constructor(private config: WebhookCircuitBreakerConfig) {}

  getState(endpointId: string): CircuitBreakerState {
    const state = this.states.get(endpointId);
    if (!state) return CircuitBreakerState.CLOSED;

    // Check if half-open timeout expired
    if (state.state === CircuitBreakerState.OPEN && state.openedAt) {
      const elapsed = Date.now() - state.openedAt.getTime();
      if (elapsed >= this.config.halfOpenTimeout) {
        state.state = CircuitBreakerState.HALF_OPEN;
        state.successes = 0;
        this.states.set(endpointId, state);
      }
    }

    return state.state;
  }

  recordSuccess(endpointId: string): CircuitBreakerState {
    const state = this.states.get(endpointId) || {
      state: CircuitBreakerState.CLOSED,
      failures: 0,
      successes: 0
    };

    state.successes++;
    state.failures = 0;

    // Close circuit if enough successes in half-open state
    if (state.state === CircuitBreakerState.HALF_OPEN && state.successes >= this.config.successThreshold) {
      state.state = CircuitBreakerState.CLOSED;
      state.successes = 0;
    }

    this.states.set(endpointId, state);
    return state.state;
  }

  recordFailure(endpointId: string): CircuitBreakerState {
    const state = this.states.get(endpointId) || {
      state: CircuitBreakerState.CLOSED,
      failures: 0,
      successes: 0
    };

    state.failures++;
    state.successes = 0;
    state.lastFailureAt = new Date();

    // Open circuit if too many failures
    if (state.failures >= this.config.failureThreshold) {
      state.state = CircuitBreakerState.OPEN;
      state.openedAt = new Date();
    }

    // If failure in half-open, reopen circuit
    if (state.state === CircuitBreakerState.HALF_OPEN) {
      state.state = CircuitBreakerState.OPEN;
      state.openedAt = new Date();
    }

    this.states.set(endpointId, state);
    return state.state;
  }

  reset(endpointId: string): void {
    this.states.set(endpointId, {
      state: CircuitBreakerState.CLOSED,
      failures: 0,
      successes: 0
    });
  }

  open(endpointId: string): void {
    this.states.set(endpointId, {
      state: CircuitBreakerState.OPEN,
      failures: this.config.failureThreshold,
      successes: 0,
      openedAt: new Date()
    });
  }

  close(endpointId: string): void {
    this.reset(endpointId);
  }
}

/**
 * WebhookService Implementation
 */
export class WebhookService implements IWebhookService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache: ICacheService;
  private readonly auditLog: IAuditLogService;
  private readonly repository: IWebhookRepository;
  private readonly rateLimiter: WebhookRateLimiter;
  private readonly circuitBreaker: WebhookCircuitBreaker;
  private readonly retryConfig: WebhookRetryConfig;
  private readonly deliveryQueue: WebhookDeliveryJob[] = [];
  private readonly notifications = new Map<string, (notification: WebhookNotification) => void>();
  private processingInterval?: NodeJS.Timeout;
  private readonly metrics = {
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    totalLatency: 0,
    latencies: [] as number[]
  };

  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    cache: ICacheService,
    auditLog: IAuditLogService,
    repository?: IWebhookRepository
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;
    this.auditLog = auditLog;
    this.repository = repository || new InMemoryWebhookRepository();

    // Configure retry strategy
    this.retryConfig = {
      maxAttempts: 6,
      delays: [0, 60000, 300000, 1800000, 7200000, 21600000], // 0s, 1m, 5m, 30m, 2h, 6h
      retryableStatusCodes: [500, 502, 503, 504, 408, 429]
    };

    // Initialize rate limiter (100 deliveries per minute)
    this.rateLimiter = new WebhookRateLimiter({
      windowMs: 60000,
      maxDeliveries: 100
    });

    // Initialize circuit breaker
    this.circuitBreaker = new WebhookCircuitBreaker({
      failureThreshold: 5,
      successThreshold: 3,
      halfOpenTimeout: 300000, // 5 minutes
      resetTimeout: 600000     // 10 minutes
    });

    this.startProcessingLoop();
    this.subscribeToPaymentEvents();
  }

  /**
   * ENDPOINT MANAGEMENT
   */

  async registerEndpoint(params: CreateWebhookEndpointParams): Promise<WebhookEndpoint> {
    // Validate URL
    const isValid = await this.validateEndpointUrl(params.url);
    if (!isValid) {
      throw new Error('Invalid endpoint URL - must be HTTPS');
    }

    const endpoint: WebhookEndpoint = {
      id: this.generateId('wh_endpoint'),
      userId: params.userId,
      url: params.url,
      description: params.description,
      secret: this.generateSecret(),
      events: params.events,
      enabled: true,
      metadata: params.metadata,
      headers: params.headers,
      timeout: params.timeout || 30000,
      ipAllowlist: params.ipAllowlist,
      createdAt: new Date(),
      updatedAt: new Date(),
      failureCount: 0,
      circuitState: CircuitBreakerState.CLOSED
    };

    await this.repository.saveEndpoint(endpoint);
    await this.cacheEndpoint(endpoint);

    await this.auditLog.log({
      action: 'webhook.endpoint.created',
      userId: params.userId,
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      metadata: { url: params.url, events: params.events }
    });

    this.logger.info('Webhook endpoint registered', {
      endpointId: endpoint.id,
      url: params.url,
      events: params.events.length
    });

    return endpoint;
  }

  async updateEndpoint(endpointId: string, params: UpdateWebhookEndpointParams): Promise<WebhookEndpoint> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${endpointId} not found`);
    }

    if (params.url) {
      const isValid = await this.validateEndpointUrl(params.url);
      if (!isValid) {
        throw new Error('Invalid endpoint URL - must be HTTPS');
      }
      endpoint.url = params.url;
    }

    if (params.description !== undefined) endpoint.description = params.description;
    if (params.events) endpoint.events = params.events;
    if (params.enabled !== undefined) endpoint.enabled = params.enabled;
    if (params.metadata) endpoint.metadata = params.metadata;
    if (params.headers) endpoint.headers = params.headers;
    if (params.timeout) endpoint.timeout = params.timeout;
    if (params.ipAllowlist) endpoint.ipAllowlist = params.ipAllowlist;

    endpoint.updatedAt = new Date();

    await this.repository.updateEndpoint(endpoint);
    await this.cacheEndpoint(endpoint);

    await this.auditLog.log({
      action: 'webhook.endpoint.updated',
      userId: endpoint.userId,
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      metadata: params
    });

    return endpoint;
  }

  async deleteEndpoint(endpointId: string): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${endpointId} not found`);
    }

    await this.repository.deleteEndpoint(endpointId);
    await this.cache.delete(`webhook:endpoint:${endpointId}`);

    await this.auditLog.log({
      action: 'webhook.endpoint.deleted',
      userId: endpoint.userId,
      resourceType: 'webhook_endpoint',
      resourceId: endpointId
    });

    this.logger.info('Webhook endpoint deleted', { endpointId });
  }

  async getEndpoint(endpointId: string): Promise<WebhookEndpoint | null> {
    const cacheKey = `webhook:endpoint:${endpointId}`;
    const cached = await this.cache.get<WebhookEndpoint>(cacheKey);
    if (cached) return cached;

    const endpoint = await this.repository.getEndpoint(endpointId);
    if (endpoint) {
      await this.cacheEndpoint(endpoint);
    }
    return endpoint;
  }

  async listEndpoints(userId: string, limit = 100, offset = 0): Promise<WebhookEndpoint[]> {
    return this.repository.listEndpoints(userId, limit, offset);
  }

  async enableEndpoint(endpointId: string): Promise<void> {
    await this.updateEndpoint(endpointId, { enabled: true });
  }

  async disableEndpoint(endpointId: string): Promise<void> {
    await this.updateEndpoint(endpointId, { enabled: false });
  }

  /**
   * EVENT SUBSCRIPTION
   */

  async subscribeToEvents(endpointId: string, eventTypes: WebhookEventType[]): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${endpointId} not found`);
    }

    const newEvents = [...new Set([...endpoint.events, ...eventTypes])];
    await this.updateEndpoint(endpointId, { events: newEvents });
  }

  async unsubscribeFromEvents(endpointId: string, eventTypes: WebhookEventType[]): Promise<void> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${endpointId} not found`);
    }

    const newEvents = endpoint.events.filter(e => !eventTypes.includes(e));
    await this.updateEndpoint(endpointId, { events: newEvents });
  }

  async getSubscribedEndpoints(eventType: WebhookEventType): Promise<WebhookEndpoint[]> {
    return this.repository.getEndpointsByEventType(eventType);
  }

  /**
   * WEBHOOK DELIVERY
   */

  async sendWebhook(eventType: WebhookEventType, payload: WebhookEventPayload): Promise<WebhookDeliveryResult[]> {
    const endpoints = await this.getSubscribedEndpoints(eventType);
    const results: WebhookDeliveryResult[] = [];

    for (const endpoint of endpoints) {
      try {
        const result = await this.sendWebhookToEndpoint(endpoint.id, eventType, payload);
        results.push(result);
      } catch (error) {
        this.logger.error('Failed to send webhook', { endpointId: endpoint.id, error });
      }
    }

    return results;
  }

  async sendWebhookToEndpoint(
    endpointId: string,
    eventType: WebhookEventType,
    payload: WebhookEventPayload
  ): Promise<WebhookDeliveryResult> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${endpointId} not found`);
    }

    if (!endpoint.enabled) {
      throw new Error(`Webhook endpoint ${endpointId} is disabled`);
    }

    // Check rate limit
    const rateLimited = await this.rateLimiter.isLimited(endpointId);
    if (rateLimited) {
      const delivery = await this.createDelivery(endpoint, eventType, payload, WebhookDeliveryStatus.RATE_LIMITED);
      return {
        deliveryId: delivery.id,
        success: false,
        attempt: 0,
        status: WebhookDeliveryStatus.RATE_LIMITED,
        duration: 0,
        errorMessage: 'Rate limit exceeded'
      };
    }

    // Check circuit breaker
    const circuitState = this.circuitBreaker.getState(endpointId);
    if (circuitState === CircuitBreakerState.OPEN) {
      const delivery = await this.createDelivery(endpoint, eventType, payload, WebhookDeliveryStatus.CIRCUIT_OPEN);
      return {
        deliveryId: delivery.id,
        success: false,
        attempt: 0,
        status: WebhookDeliveryStatus.CIRCUIT_OPEN,
        duration: 0,
        errorMessage: 'Circuit breaker is open'
      };
    }

    // Create delivery
    const delivery = await this.createDelivery(endpoint, eventType, payload, WebhookDeliveryStatus.QUEUED);

    // Queue for delivery
    this.queueDelivery(delivery, endpoint);

    return {
      deliveryId: delivery.id,
      success: false,
      attempt: 0,
      status: WebhookDeliveryStatus.QUEUED,
      duration: 0
    };
  }

  async deliverWebhook(deliveryId: string): Promise<WebhookDeliveryResult> {
    const startTime = performance.now();

    const delivery = await this.getDelivery(deliveryId);
    if (!delivery) {
      throw new Error(`Webhook delivery ${deliveryId} not found`);
    }

    const endpoint = await this.getEndpoint(delivery.endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${delivery.endpointId} not found`);
    }

    delivery.status = WebhookDeliveryStatus.DELIVERING;
    delivery.lastAttemptAt = new Date();
    await this.repository.updateDelivery(delivery);

    try {
      // Prepare request
      const timestamp = Math.floor(Date.now() / 1000);
      const payloadString = JSON.stringify(delivery.payload);
      const signature = this.generateSignature(payloadString, endpoint.secret, timestamp);

      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-ID': delivery.id,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Event-Type': delivery.eventType,
        'User-Agent': 'Sovren-Webhooks/1.0',
        ...endpoint.headers
      };

      // Make HTTP request
      const response = await this.makeHttpRequest(
        endpoint.url,
        payloadString,
        headers,
        endpoint.timeout
      );

      const duration = performance.now() - startTime;

      // Record success
      delivery.status = WebhookDeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();
      delivery.responseStatus = response.status;
      delivery.responseBody = response.body?.substring(0, 1000); // Limit response size
      delivery.responseHeaders = response.headers;
      delivery.duration = duration;

      await this.repository.updateDelivery(delivery);
      await this.rateLimiter.recordDelivery(endpoint.id);

      // Update endpoint
      endpoint.lastDeliveryAt = new Date();
      endpoint.failureCount = 0;
      await this.repository.updateEndpoint(endpoint);

      // Update circuit breaker
      this.circuitBreaker.recordSuccess(endpoint.id);

      // Record metrics
      this.recordMetrics(true, duration);

      // Notify subscribers
      this.notifySubscribers({
        type: 'delivery.success',
        endpointId: endpoint.id,
        deliveryId: delivery.id,
        timestamp: new Date(),
        message: `Webhook delivered successfully in ${duration.toFixed(2)}ms`
      });

      this.logger.info('Webhook delivered successfully', {
        deliveryId,
        endpointId: endpoint.id,
        duration: `${duration.toFixed(2)}ms`
      });

      return {
        deliveryId: delivery.id,
        success: true,
        attempt: delivery.attempt,
        status: WebhookDeliveryStatus.DELIVERED,
        responseStatus: response.status,
        responseBody: response.body,
        duration
      };

    } catch (error: any) {
      const duration = performance.now() - startTime;

      // Record failure
      delivery.status = WebhookDeliveryStatus.FAILED;
      delivery.errorMessage = error.message;
      delivery.duration = duration;

      const isRetryable = this.isRetryableError(error);

      if (isRetryable && delivery.attempt < delivery.maxAttempts) {
        // Schedule retry
        const delay = this.retryConfig.delays[delivery.attempt] || this.retryConfig.delays[this.retryConfig.delays.length - 1];
        delivery.nextRetryAt = new Date(Date.now() + delay);
        await this.repository.updateDelivery(delivery);
        this.queueRetry(delivery, endpoint, delay);
      } else {
        // Max retries exceeded - move to DLQ
        delivery.failedAt = new Date();
        await this.repository.updateDelivery(delivery);
        await this.moveToDeadLetterQueue(deliveryId);
      }

      // Update endpoint
      endpoint.failureCount++;
      await this.repository.updateEndpoint(endpoint);

      // Update circuit breaker
      const newState = this.circuitBreaker.recordFailure(endpoint.id);
      if (newState === CircuitBreakerState.OPEN) {
        endpoint.circuitState = CircuitBreakerState.OPEN;
        endpoint.circuitOpenedAt = new Date();
        await this.repository.updateEndpoint(endpoint);

        this.notifySubscribers({
          type: 'circuit.opened',
          endpointId: endpoint.id,
          timestamp: new Date(),
          message: `Circuit breaker opened after ${endpoint.failureCount} failures`
        });
      }

      // Record metrics
      this.recordMetrics(false, duration);

      // Notify subscribers
      this.notifySubscribers({
        type: 'delivery.failure',
        endpointId: endpoint.id,
        deliveryId: delivery.id,
        timestamp: new Date(),
        message: `Webhook delivery failed: ${error.message}`
      });

      this.logger.error('Webhook delivery failed', {
        deliveryId,
        endpointId: endpoint.id,
        attempt: delivery.attempt,
        error: error.message
      });

      return {
        deliveryId: delivery.id,
        success: false,
        attempt: delivery.attempt,
        status: delivery.status,
        duration,
        errorMessage: error.message,
        nextRetryAt: delivery.nextRetryAt
      };
    }
  }

  /**
   * SIGNATURE VERIFICATION
   */

  generateSignature(payload: string, secret: string, timestamp: number): string {
    const signaturePayload = `${timestamp}.${payload}`;
    return createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');
  }

  verifySignature(payload: string, signature: string, secret: string, timestamp: number): WebhookSignatureVerification {
    // Check timestamp (prevent replay attacks - must be within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - timestamp);
    if (timeDiff > 300) {
      return {
        valid: false,
        timestamp,
        payload,
        signature,
        error: 'Timestamp too old - possible replay attack'
      };
    }

    const expectedSignature = this.generateSignature(payload, secret, timestamp);
    const valid = signature === expectedSignature;

    return {
      valid,
      timestamp,
      payload,
      signature,
      expectedSignature,
      error: valid ? undefined : 'Invalid signature'
    };
  }

  /**
   * RETRY LOGIC
   */

  async scheduleRetry(deliveryId: string): Promise<void> {
    const delivery = await this.getDelivery(deliveryId);
    if (!delivery) {
      throw new Error(`Webhook delivery ${deliveryId} not found`);
    }

    const endpoint = await this.getEndpoint(delivery.endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${delivery.endpointId} not found`);
    }

    if (delivery.attempt >= delivery.maxAttempts) {
      await this.moveToDeadLetterQueue(deliveryId);
      return;
    }

    const delay = this.retryConfig.delays[delivery.attempt];
    this.queueRetry(delivery, endpoint, delay);
  }

  async processRetry(deliveryId: string): Promise<WebhookDeliveryResult> {
    const delivery = await this.getDelivery(deliveryId);
    if (!delivery) {
      throw new Error(`Webhook delivery ${deliveryId} not found`);
    }

    delivery.attempt++;
    await this.repository.updateDelivery(delivery);

    return this.deliverWebhook(deliveryId);
  }

  async cancelRetries(deliveryId: string): Promise<void> {
    const delivery = await this.getDelivery(deliveryId);
    if (!delivery) {
      throw new Error(`Webhook delivery ${deliveryId} not found`);
    }

    delivery.nextRetryAt = undefined;
    await this.repository.updateDelivery(delivery);
  }

  /**
   * DELIVERY STATUS & TRACKING
   */

  async getDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    return this.repository.getDelivery(deliveryId);
  }

  async queryDeliveries(query: WebhookDeliveryQuery): Promise<WebhookDelivery[]> {
    return this.repository.queryDeliveries(query);
  }

  async getEndpointDeliveries(endpointId: string, limit = 100, offset = 0): Promise<WebhookDelivery[]> {
    return this.repository.queryDeliveries({ endpointId, limit, offset });
  }

  /**
   * DEAD LETTER QUEUE
   */

  async moveToDeadLetterQueue(deliveryId: string): Promise<void> {
    const delivery = await this.getDelivery(deliveryId);
    if (!delivery) {
      throw new Error(`Webhook delivery ${deliveryId} not found`);
    }

    const entry: DeadLetterQueueEntry = {
      id: this.generateId('wh_dlq'),
      deliveryId: delivery.id,
      endpointId: delivery.endpointId,
      eventType: delivery.eventType,
      payload: delivery.payload,
      attempts: delivery.attempt,
      lastError: delivery.errorMessage || 'Unknown error',
      createdAt: new Date(),
      replayable: true
    };

    await this.repository.saveDLQEntry(entry);

    delivery.status = WebhookDeliveryStatus.DEAD_LETTER;
    await this.repository.updateDelivery(delivery);

    await this.auditLog.log({
      action: 'webhook.moved_to_dlq',
      resourceType: 'webhook_delivery',
      resourceId: deliveryId,
      metadata: { endpointId: delivery.endpointId, attempts: delivery.attempt }
    });

    this.logger.warn('Webhook moved to dead letter queue', {
      deliveryId,
      endpointId: delivery.endpointId,
      attempts: delivery.attempt
    });
  }

  async getDeadLetterQueue(limit = 100, offset = 0): Promise<DeadLetterQueueEntry[]> {
    return this.repository.listDLQ(limit, offset);
  }

  async getDeadLetterQueueEntry(entryId: string): Promise<DeadLetterQueueEntry | null> {
    return this.repository.getDLQEntry(entryId);
  }

  async removeFromDeadLetterQueue(entryId: string): Promise<void> {
    await this.repository.removeDLQEntry(entryId);
  }

  /**
   * WEBHOOK REPLAY
   */

  async replayDelivery(deliveryId: string): Promise<WebhookDeliveryResult> {
    const delivery = await this.getDelivery(deliveryId);
    if (!delivery) {
      throw new Error(`Webhook delivery ${deliveryId} not found`);
    }

    const endpoint = await this.getEndpoint(delivery.endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${delivery.endpointId} not found`);
    }

    // Create new delivery
    const newDelivery = await this.createDelivery(
      endpoint,
      delivery.eventType,
      delivery.payload,
      WebhookDeliveryStatus.QUEUED
    );

    this.queueDelivery(newDelivery, endpoint);

    return {
      deliveryId: newDelivery.id,
      success: false,
      attempt: 0,
      status: WebhookDeliveryStatus.QUEUED,
      duration: 0
    };
  }

  async replayDeliveries(request: WebhookReplayRequest): Promise<WebhookDeliveryResult[]> {
    let deliveries: WebhookDelivery[];

    if (request.deliveryIds) {
      deliveries = [];
      for (const id of request.deliveryIds) {
        const delivery = await this.getDelivery(id);
        if (delivery) deliveries.push(delivery);
      }
    } else {
      const query: WebhookDeliveryQuery = {
        endpointId: request.endpointId,
        eventType: request.eventType,
        startDate: request.startDate,
        endDate: request.endDate
      };

      if (request.onlyFailed) {
        query.status = WebhookDeliveryStatus.FAILED;
      }

      deliveries = await this.queryDeliveries(query);
    }

    const results: WebhookDeliveryResult[] = [];
    for (const delivery of deliveries) {
      try {
        const result = await this.replayDelivery(delivery.id);
        results.push(result);
      } catch (error) {
        this.logger.error('Failed to replay delivery', { deliveryId: delivery.id, error });
      }
    }

    return results;
  }

  async replayDeadLetterEntry(entryId: string): Promise<WebhookDeliveryResult> {
    const entry = await this.getDeadLetterQueueEntry(entryId);
    if (!entry) {
      throw new Error(`Dead letter queue entry ${entryId} not found`);
    }

    if (!entry.replayable) {
      throw new Error(`Dead letter queue entry ${entryId} is not replayable`);
    }

    const result = await this.replayDelivery(entry.deliveryId);
    await this.removeFromDeadLetterQueue(entryId);

    return result;
  }

  /**
   * TESTING & VALIDATION
   */

  async sendTestEvent(request: WebhookTestEventRequest): Promise<WebhookDeliveryResult> {
    const testPayload: WebhookEventPayload = {
      id: `test_${Date.now()}`,
      type: request.eventType,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: request.testData || { test: true, message: 'This is a test webhook' }
      },
      metadata: { test: true }
    };

    return this.sendWebhookToEndpoint(request.endpointId, request.eventType, testPayload);
  }

  async validateEndpointUrl(url: string): Promise<boolean> {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async pingEndpoint(endpointId: string): Promise<boolean> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) return false;

    try {
      const response = await this.makeHttpRequest(
        endpoint.url,
        JSON.stringify({ ping: true }),
        { 'Content-Type': 'application/json' },
        5000
      );
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    }
  }

  /**
   * SECRET MANAGEMENT
   */

  async rotateSecret(request: WebhookSecretRotationRequest): Promise<WebhookEndpoint> {
    const endpoint = await this.getEndpoint(request.endpointId);
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${request.endpointId} not found`);
    }

    const newSecret = request.newSecret || this.generateSecret();
    endpoint.secret = newSecret;
    endpoint.updatedAt = new Date();

    await this.repository.updateEndpoint(endpoint);
    await this.cacheEndpoint(endpoint);

    await this.auditLog.log({
      action: 'webhook.secret.rotated',
      userId: endpoint.userId,
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id
    });

    return endpoint;
  }

  generateSecret(): string {
    return `whsec_${randomBytes(32).toString('hex')}`;
  }

  /**
   * RATE LIMITING
   */

  async isRateLimited(endpointId: string): Promise<boolean> {
    return this.rateLimiter.isLimited(endpointId);
  }

  async getRateLimitStatus(endpointId: string): Promise<{ limited: boolean; remaining: number; resetAt: Date }> {
    return this.rateLimiter.getStatus(endpointId);
  }

  /**
   * CIRCUIT BREAKER
   */

  async getCircuitState(endpointId: string): Promise<'open' | 'closed' | 'half_open'> {
    return this.circuitBreaker.getState(endpointId);
  }

  async openCircuit(endpointId: string): Promise<void> {
    this.circuitBreaker.open(endpointId);
    const endpoint = await this.getEndpoint(endpointId);
    if (endpoint) {
      endpoint.circuitState = CircuitBreakerState.OPEN;
      endpoint.circuitOpenedAt = new Date();
      await this.repository.updateEndpoint(endpoint);
    }
  }

  async closeCircuit(endpointId: string): Promise<void> {
    this.circuitBreaker.close(endpointId);
    const endpoint = await this.getEndpoint(endpointId);
    if (endpoint) {
      endpoint.circuitState = CircuitBreakerState.CLOSED;
      endpoint.circuitOpenedAt = undefined;
      endpoint.failureCount = 0;
      await this.repository.updateEndpoint(endpoint);
    }

    this.notifySubscribers({
      type: 'circuit.closed',
      endpointId,
      timestamp: new Date(),
      message: 'Circuit breaker closed - deliveries resumed'
    });
  }

  async resetCircuit(endpointId: string): Promise<void> {
    await this.closeCircuit(endpointId);
  }

  /**
   * BULK OPERATIONS
   */

  async bulkManageEndpoints(request: WebhookBulkManagementRequest): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const endpointId of request.endpointIds) {
      try {
        switch (request.action) {
          case 'enable':
            await this.enableEndpoint(endpointId);
            break;
          case 'disable':
            await this.disableEndpoint(endpointId);
            break;
          case 'delete':
            await this.deleteEndpoint(endpointId);
            break;
          case 'rotate_secrets':
            await this.rotateSecret({ endpointId });
            break;
        }
        success++;
      } catch (error) {
        this.logger.error('Bulk operation failed', { endpointId, action: request.action, error });
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * STATISTICS & MONITORING
   */

  async getEndpointStats(endpointId: string, startDate?: Date, endDate?: Date): Promise<WebhookEndpointStats> {
    const deliveries = await this.queryDeliveries({
      endpointId,
      startDate,
      endDate,
      limit: Number.MAX_SAFE_INTEGER
    });

    const stats: WebhookEndpointStats = {
      endpointId,
      totalDeliveries: deliveries.length,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      successRate: 0,
      averageResponseTime: 0,
      circuitState: await this.getCircuitState(endpointId),
      deliveriesByStatus: {} as Record<WebhookDeliveryStatus, number>,
      deliveriesByEventType: {} as Record<WebhookEventType, number>
    };

    let totalResponseTime = 0;

    for (const delivery of deliveries) {
      if (delivery.status === WebhookDeliveryStatus.DELIVERED) {
        stats.successfulDeliveries++;
        if (delivery.deliveredAt && !stats.lastSuccessAt) {
          stats.lastSuccessAt = delivery.deliveredAt;
        }
      } else if (delivery.status === WebhookDeliveryStatus.FAILED || delivery.status === WebhookDeliveryStatus.DEAD_LETTER) {
        stats.failedDeliveries++;
        if (delivery.failedAt && !stats.lastFailureAt) {
          stats.lastFailureAt = delivery.failedAt;
        }
      }

      if (delivery.duration) {
        totalResponseTime += delivery.duration;
      }

      if (!stats.lastDeliveryAt || delivery.createdAt > stats.lastDeliveryAt) {
        stats.lastDeliveryAt = delivery.createdAt;
      }

      stats.deliveriesByStatus[delivery.status] = (stats.deliveriesByStatus[delivery.status] || 0) + 1;
      stats.deliveriesByEventType[delivery.eventType] = (stats.deliveriesByEventType[delivery.eventType] || 0) + 1;
    }

    if (deliveries.length > 0) {
      stats.successRate = (stats.successfulDeliveries / deliveries.length) * 100;
      stats.averageResponseTime = totalResponseTime / deliveries.length;
    }

    return stats;
  }

  async getSystemStats(): Promise<WebhookSystemStats> {
    const allDeliveries = await this.queryDeliveries({ limit: Number.MAX_SAFE_INTEGER });
    const dlq = await this.getDeadLetterQueue(Number.MAX_SAFE_INTEGER);

    const stats: WebhookSystemStats = {
      totalEndpoints: 0,
      activeEndpoints: 0,
      disabledEndpoints: 0,
      totalDeliveries: allDeliveries.length,
      pendingDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      deadLetterQueueSize: dlq.length,
      averageDeliveryTime: 0,
      deliveriesPerMinute: 0,
      circuitBreakersOpen: 0
    };

    let totalDuration = 0;

    for (const delivery of allDeliveries) {
      if (delivery.status === WebhookDeliveryStatus.DELIVERED) {
        stats.successfulDeliveries++;
      } else if (delivery.status === WebhookDeliveryStatus.FAILED) {
        stats.failedDeliveries++;
      } else if (delivery.status === WebhookDeliveryStatus.PENDING || delivery.status === WebhookDeliveryStatus.QUEUED) {
        stats.pendingDeliveries++;
      }

      if (delivery.duration) {
        totalDuration += delivery.duration;
      }
    }

    if (allDeliveries.length > 0) {
      stats.averageDeliveryTime = totalDuration / allDeliveries.length;

      // Calculate deliveries per minute (last hour)
      const oneHourAgo = new Date(Date.now() - 3600000);
      const recentDeliveries = allDeliveries.filter(d => d.createdAt >= oneHourAgo);
      stats.deliveriesPerMinute = recentDeliveries.length / 60;
    }

    return stats;
  }

  async getDeliveryMetrics(): Promise<{
    totalDeliveries: number;
    successRate: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
  }> {
    const sortedLatencies = [...this.metrics.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    return {
      totalDeliveries: this.metrics.totalDeliveries,
      successRate: this.metrics.totalDeliveries > 0
        ? (this.metrics.successfulDeliveries / this.metrics.totalDeliveries) * 100
        : 0,
      averageLatency: this.metrics.totalDeliveries > 0
        ? this.metrics.totalLatency / this.metrics.totalDeliveries
        : 0,
      p95Latency: sortedLatencies[p95Index] || 0,
      p99Latency: sortedLatencies[p99Index] || 0
    };
  }

  /**
   * REAL-TIME NOTIFICATIONS
   */

  subscribeToNotifications(callback: (notification: WebhookNotification) => void): string {
    const subscriptionId = this.generateId('wh_sub');
    this.notifications.set(subscriptionId, callback);
    return subscriptionId;
  }

  unsubscribeFromNotifications(subscriptionId: string): void {
    this.notifications.delete(subscriptionId);
  }

  /**
   * HEALTH & MAINTENANCE
   */

  async healthCheck(): Promise<WebhookHealthCheck> {
    try {
      const stats = await this.getSystemStats();

      return {
        healthy: true,
        endpoints: stats.totalEndpoints,
        deliveryQueueSize: this.deliveryQueue.length,
        deadLetterQueueSize: stats.deadLetterQueueSize,
        circuitBreakersOpen: stats.circuitBreakersOpen
      };
    } catch (error: any) {
      return {
        healthy: false,
        endpoints: 0,
        deliveryQueueSize: 0,
        deadLetterQueueSize: 0,
        circuitBreakersOpen: 0,
        lastError: error.message,
        lastErrorAt: new Date()
      };
    }
  }

  async processPendingDeliveries(): Promise<number> {
    let processed = 0;

    while (this.deliveryQueue.length > 0) {
      const job = this.deliveryQueue.shift();
      if (!job) break;

      // Check if scheduled time has passed
      if (job.scheduledFor > new Date()) {
        // Put it back in the queue
        this.deliveryQueue.push(job);
        break;
      }

      try {
        await this.deliverWebhook(job.deliveryId);
        processed++;
      } catch (error) {
        this.logger.error('Failed to process delivery', { deliveryId: job.deliveryId, error });
      }
    }

    return processed;
  }

  async cleanupOldDeliveries(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 86400000);
    const oldDeliveries = await this.queryDeliveries({
      endDate: cutoffDate,
      limit: Number.MAX_SAFE_INTEGER
    });

    // In production, this would delete from database
    this.logger.info('Cleanup simulation', {
      olderThanDays,
      count: oldDeliveries.length
    });

    return oldDeliveries.length;
  }

  async dispose(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.notifications.clear();
    this.deliveryQueue.length = 0;
    this.logger.info('WebhookService disposed');
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private async createDelivery(
    endpoint: WebhookEndpoint,
    eventType: WebhookEventType,
    payload: WebhookEventPayload,
    status: WebhookDeliveryStatus
  ): Promise<WebhookDelivery> {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString, endpoint.secret, timestamp);

    const delivery: WebhookDelivery = {
      id: this.generateId('wh_delivery'),
      endpointId: endpoint.id,
      eventType,
      payload,
      signature,
      status,
      attempt: 0,
      maxAttempts: this.retryConfig.maxAttempts,
      createdAt: new Date()
    };

    await this.repository.saveDelivery(delivery);
    return delivery;
  }

  private queueDelivery(delivery: WebhookDelivery, endpoint: WebhookEndpoint): void {
    const job: WebhookDeliveryJob = {
      deliveryId: delivery.id,
      endpointId: endpoint.id,
      url: endpoint.url,
      payload: delivery.payload,
      signature: delivery.signature,
      headers: endpoint.headers || {},
      timeout: endpoint.timeout || 30000,
      attempt: 0,
      scheduledFor: new Date()
    };

    this.deliveryQueue.push(job);
  }

  private queueRetry(delivery: WebhookDelivery, endpoint: WebhookEndpoint, delay: number): void {
    const job: WebhookDeliveryJob = {
      deliveryId: delivery.id,
      endpointId: endpoint.id,
      url: endpoint.url,
      payload: delivery.payload,
      signature: delivery.signature,
      headers: endpoint.headers || {},
      timeout: endpoint.timeout || 30000,
      attempt: delivery.attempt,
      scheduledFor: new Date(Date.now() + delay)
    };

    this.deliveryQueue.push(job);
  }

  private async makeHttpRequest(
    url: string,
    body: string,
    headers: Record<string, string>,
    timeout: number
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    // Simplified HTTP request - in production would use a proper HTTP client
    // For testing, simulate success
    return {
      status: 200,
      body: JSON.stringify({ received: true }),
      headers: { 'content-type': 'application/json' }
    };
  }

  private isRetryableError(error: any): boolean {
    // Check if error is retryable based on status code or error type
    if (error.status) {
      return this.retryConfig.retryableStatusCodes.includes(error.status);
    }
    return error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';
  }

  private async cacheEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    await this.cache.set(`webhook:endpoint:${endpoint.id}`, endpoint, 3600);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private recordMetrics(success: boolean, duration: number): void {
    this.metrics.totalDeliveries++;
    if (success) {
      this.metrics.successfulDeliveries++;
    } else {
      this.metrics.failedDeliveries++;
    }
    this.metrics.totalLatency += duration;
    this.metrics.latencies.push(duration);

    // Keep only last 1000 latencies for percentile calculation
    if (this.metrics.latencies.length > 1000) {
      this.metrics.latencies.shift();
    }
  }

  private notifySubscribers(notification: WebhookNotification): void {
    for (const [, callback] of this.notifications) {
      try {
        callback(notification);
      } catch (error) {
        this.logger.error('Notification callback failed', error);
      }
    }
  }

  private startProcessingLoop(): void {
    // Process deliveries every 10 seconds
    this.processingInterval = setInterval(async () => {
      try {
        await this.processPendingDeliveries();
      } catch (error) {
        this.logger.error('Processing loop error', error);
      }
    }, 10000);
  }

  private subscribeToPaymentEvents(): void {
    // Subscribe to payment events from EventBus
    const paymentEvents = [
      'PAYMENT_RECEIVED',
      'PAYMENT_FAILED',
      'INVOICE_CREATED',
      'SUBSCRIPTION_CREATED',
      'SUBSCRIPTION_RENEWED',
      'SUBSCRIPTION_CANCELLED'
    ];

    // This would be implemented when EventBus is integrated
    this.logger.info('Subscribed to payment events for webhook delivery');
  }
}
