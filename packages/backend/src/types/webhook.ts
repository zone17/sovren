/**
 * Webhook Type Definitions
 * User Story: US-E5-029
 * Complete webhook delivery system for payment and subscription events
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

/**
 * Webhook event types
 */
export enum WebhookEventType {
  // Payment events
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',

  // Subscription events
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  SUBSCRIPTION_CANCELED = 'subscription.canceled',
  SUBSCRIPTION_UPDATED = 'subscription.updated',

  // Refund events
  REFUND_CREATED = 'refund.created',
  REFUND_PROCESSED = 'refund.processed',
  REFUND_FAILED = 'refund.failed',

  // Invoice events
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_FAILED = 'invoice.failed',
}

/**
 * Webhook delivery status
 */
export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  DELIVERING = 'delivering',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RATE_LIMITED = 'rate_limited',
  CIRCUIT_OPEN = 'circuit_open',
  DEAD_LETTER = 'dead_letter',
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpoint {
  id: string; // Unique endpoint ID
  userId: string; // Endpoint owner
  url: string; // HTTPS endpoint URL
  description?: string; // Endpoint description
  secret: string; // Signing secret (HMAC)
  events: WebhookEventType[]; // Subscribed events
  enabled: boolean; // Is endpoint active
  metadata?: Record<string, any>; // Custom metadata
  headers?: Record<string, string>; // Custom headers to send
  timeout?: number; // Request timeout (ms, default: 30000)
  ipAllowlist?: string[]; // Allowed source IPs
  createdAt: Date; // Creation timestamp
  updatedAt: Date; // Last update timestamp
  lastDeliveryAt?: Date; // Last successful delivery
  failureCount: number; // Consecutive failure count
  circuitState: CircuitBreakerState; // Circuit breaker state
  circuitOpenedAt?: Date; // Circuit opened timestamp
}

/**
 * Webhook endpoint creation parameters
 */
export interface CreateWebhookEndpointParams {
  userId: string;
  url: string;
  description?: string;
  events: WebhookEventType[];
  metadata?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  ipAllowlist?: string[];
}

/**
 * Webhook endpoint update parameters
 */
export interface UpdateWebhookEndpointParams {
  url?: string;
  description?: string;
  events?: WebhookEventType[];
  enabled?: boolean;
  metadata?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  ipAllowlist?: string[];
}

/**
 * Webhook event payload
 */
export interface WebhookEventPayload {
  id: string; // Event ID
  type: WebhookEventType; // Event type
  created: number; // Unix timestamp
  livemode: boolean; // Production vs test mode
  data: {
    object: any; // Event data
    previous?: any; // Previous state (for updates)
  };
  metadata?: Record<string, any>; // Custom metadata
}

/**
 * Webhook delivery attempt
 */
export interface WebhookDelivery {
  id: string; // Delivery ID
  endpointId: string; // Target endpoint ID
  eventType: WebhookEventType; // Event type
  payload: WebhookEventPayload; // Event payload
  signature: string; // HMAC-SHA256 signature
  status: WebhookDeliveryStatus; // Current status
  attempt: number; // Current attempt number (0-6)
  maxAttempts: number; // Maximum attempts (6)
  nextRetryAt?: Date; // Next retry timestamp
  lastAttemptAt?: Date; // Last attempt timestamp
  responseStatus?: number; // HTTP response status
  responseBody?: string; // HTTP response body
  responseHeaders?: Record<string, string>; // HTTP response headers
  errorMessage?: string; // Error message
  duration?: number; // Request duration (ms)
  createdAt: Date; // Creation timestamp
  deliveredAt?: Date; // Successful delivery timestamp
  failedAt?: Date; // Final failure timestamp
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  deliveryId: string;
  success: boolean;
  attempt: number;
  status: WebhookDeliveryStatus;
  responseStatus?: number;
  responseBody?: string;
  duration: number;
  errorMessage?: string;
  nextRetryAt?: Date;
}

/**
 * Webhook signature verification result
 */
export interface WebhookSignatureVerification {
  valid: boolean;
  timestamp: number;
  payload: string;
  signature: string;
  expectedSignature?: string;
  error?: string;
}

/**
 * Webhook delivery history query
 */
export interface WebhookDeliveryQuery {
  endpointId?: string;
  eventType?: WebhookEventType;
  status?: WebhookDeliveryStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'deliveredAt' | 'attempt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Webhook endpoint statistics
 */
export interface WebhookEndpointStats {
  endpointId: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  averageResponseTime: number;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  circuitState: CircuitBreakerState;
  deliveriesByStatus: Record<WebhookDeliveryStatus, number>;
  deliveriesByEventType: Record<WebhookEventType, number>;
}

/**
 * Webhook system statistics
 */
export interface WebhookSystemStats {
  totalEndpoints: number;
  activeEndpoints: number;
  disabledEndpoints: number;
  totalDeliveries: number;
  pendingDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deadLetterQueueSize: number;
  averageDeliveryTime: number;
  deliveriesPerMinute: number;
  circuitBreakersOpen: number;
}

/**
 * Webhook retry configuration
 */
export interface WebhookRetryConfig {
  maxAttempts: number; // Maximum retry attempts (6)
  delays: number[]; // Delay between attempts (ms)
  retryableStatusCodes: number[]; // HTTP status codes to retry
}

/**
 * Webhook rate limit configuration
 */
export interface WebhookRateLimitConfig {
  windowMs: number; // Rate limit window (ms)
  maxDeliveries: number; // Max deliveries per window
}

/**
 * Webhook circuit breaker configuration
 */
export interface WebhookCircuitBreakerConfig {
  failureThreshold: number; // Failures before opening (5)
  successThreshold: number; // Successes to close (3)
  halfOpenTimeout: number; // Time before half-open (ms)
  resetTimeout: number; // Time before attempting reset (ms)
}

/**
 * Webhook test event request
 */
export interface WebhookTestEventRequest {
  endpointId: string;
  eventType: WebhookEventType;
  testData?: any;
}

/**
 * Webhook secret rotation request
 */
export interface WebhookSecretRotationRequest {
  endpointId: string;
  newSecret?: string; // Optional - auto-generate if not provided
}

/**
 * Webhook replay request
 */
export interface WebhookReplayRequest {
  deliveryIds?: string[]; // Specific deliveries to replay
  endpointId?: string; // Replay all for endpoint
  eventType?: WebhookEventType; // Replay all of event type
  startDate?: Date; // Date range start
  endDate?: Date; // Date range end
  onlyFailed?: boolean; // Only replay failed deliveries
}

/**
 * Webhook bulk management request
 */
export interface WebhookBulkManagementRequest {
  endpointIds: string[];
  action: 'enable' | 'disable' | 'delete' | 'rotate_secrets';
}

/**
 * Webhook health check result
 */
export interface WebhookHealthCheck {
  healthy: boolean;
  endpoints: number;
  deliveryQueueSize: number;
  deadLetterQueueSize: number;
  circuitBreakersOpen: number;
  lastError?: string;
  lastErrorAt?: Date;
}

/**
 * Webhook notification (real-time)
 */
export interface WebhookNotification {
  type: 'delivery.success' | 'delivery.failure' | 'circuit.opened' | 'circuit.closed';
  endpointId: string;
  deliveryId?: string;
  timestamp: Date;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Webhook event filter
 */
export interface WebhookEventFilter {
  eventTypes?: WebhookEventType[];
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Dead letter queue entry
 */
export interface DeadLetterQueueEntry {
  id: string;
  deliveryId: string;
  endpointId: string;
  eventType: WebhookEventType;
  payload: WebhookEventPayload;
  attempts: number;
  lastError: string;
  createdAt: Date;
  processedAt?: Date;
  replayable: boolean;
}

/**
 * Webhook delivery job (for queue)
 */
export interface WebhookDeliveryJob {
  deliveryId: string;
  endpointId: string;
  url: string;
  payload: WebhookEventPayload;
  signature: string;
  headers: Record<string, string>;
  timeout: number;
  attempt: number;
  scheduledFor: Date;
}
