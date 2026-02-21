/**
 * Webhook Service Interface
 * User Story: US-E5-029
 * Complete webhook delivery system for payment and subscription events
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type {
  WebhookEndpoint,
  CreateWebhookEndpointParams,
  UpdateWebhookEndpointParams,
  WebhookEventPayload,
  WebhookDelivery,
  WebhookDeliveryResult,
  WebhookSignatureVerification,
  WebhookDeliveryQuery,
  WebhookEndpointStats,
  WebhookSystemStats,
  WebhookTestEventRequest,
  WebhookSecretRotationRequest,
  WebhookReplayRequest,
  WebhookBulkManagementRequest,
  WebhookHealthCheck,
  WebhookNotification,
  DeadLetterQueueEntry
} from '../../types/webhook';
import {
  WebhookEventType,
} from '../../types/webhook';

/**
 * Webhook Service Interface
 * Manages webhook endpoints, event delivery, retries, and monitoring
 */
export interface IWebhookService {
  /**
   * ENDPOINT MANAGEMENT
   */

  /**
   * Register a new webhook endpoint
   */
  registerEndpoint(params: CreateWebhookEndpointParams): Promise<WebhookEndpoint>;

  /**
   * Update an existing webhook endpoint
   */
  updateEndpoint(endpointId: string, params: UpdateWebhookEndpointParams): Promise<WebhookEndpoint>;

  /**
   * Delete a webhook endpoint
   */
  deleteEndpoint(endpointId: string): Promise<void>;

  /**
   * Get a webhook endpoint by ID
   */
  getEndpoint(endpointId: string): Promise<WebhookEndpoint | null>;

  /**
   * List webhook endpoints for a user
   */
  listEndpoints(userId: string, limit?: number, offset?: number): Promise<WebhookEndpoint[]>;

  /**
   * Enable a webhook endpoint
   */
  enableEndpoint(endpointId: string): Promise<void>;

  /**
   * Disable a webhook endpoint
   */
  disableEndpoint(endpointId: string): Promise<void>;

  /**
   * EVENT SUBSCRIPTION & FILTERING
   */

  /**
   * Subscribe an endpoint to specific event types
   */
  subscribeToEvents(endpointId: string, eventTypes: WebhookEventType[]): Promise<void>;

  /**
   * Unsubscribe an endpoint from specific event types
   */
  unsubscribeFromEvents(endpointId: string, eventTypes: WebhookEventType[]): Promise<void>;

  /**
   * Get all endpoints subscribed to an event type
   */
  getSubscribedEndpoints(eventType: WebhookEventType): Promise<WebhookEndpoint[]>;

  /**
   * WEBHOOK DELIVERY
   */

  /**
   * Send a webhook event to all subscribed endpoints
   */
  sendWebhook(eventType: WebhookEventType, payload: WebhookEventPayload): Promise<WebhookDeliveryResult[]>;

  /**
   * Send a webhook to a specific endpoint
   */
  sendWebhookToEndpoint(endpointId: string, eventType: WebhookEventType, payload: WebhookEventPayload): Promise<WebhookDeliveryResult>;

  /**
   * Deliver a webhook (internal - called by job queue)
   */
  deliverWebhook(deliveryId: string): Promise<WebhookDeliveryResult>;

  /**
   * SIGNATURE VERIFICATION
   */

  /**
   * Generate HMAC-SHA256 signature for webhook payload
   */
  generateSignature(payload: string, secret: string, timestamp: number): string;

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string, timestamp: number): WebhookSignatureVerification;

  /**
   * RETRY LOGIC
   */

  /**
   * Schedule a webhook retry
   */
  scheduleRetry(deliveryId: string): Promise<void>;

  /**
   * Process a scheduled retry
   */
  processRetry(deliveryId: string): Promise<WebhookDeliveryResult>;

  /**
   * Cancel pending retries for a delivery
   */
  cancelRetries(deliveryId: string): Promise<void>;

  /**
   * DELIVERY STATUS & TRACKING
   */

  /**
   * Get delivery status
   */
  getDelivery(deliveryId: string): Promise<WebhookDelivery | null>;

  /**
   * Query delivery history
   */
  queryDeliveries(query: WebhookDeliveryQuery): Promise<WebhookDelivery[]>;

  /**
   * Get delivery history for an endpoint
   */
  getEndpointDeliveries(endpointId: string, limit?: number, offset?: number): Promise<WebhookDelivery[]>;

  /**
   * DEAD LETTER QUEUE
   */

  /**
   * Move delivery to dead letter queue
   */
  moveToDeadLetterQueue(deliveryId: string): Promise<void>;

  /**
   * Get dead letter queue entries
   */
  getDeadLetterQueue(limit?: number, offset?: number): Promise<DeadLetterQueueEntry[]>;

  /**
   * Get dead letter queue entry
   */
  getDeadLetterQueueEntry(entryId: string): Promise<DeadLetterQueueEntry | null>;

  /**
   * Remove entry from dead letter queue
   */
  removeFromDeadLetterQueue(entryId: string): Promise<void>;

  /**
   * WEBHOOK REPLAY
   */

  /**
   * Replay a specific delivery
   */
  replayDelivery(deliveryId: string): Promise<WebhookDeliveryResult>;

  /**
   * Replay multiple deliveries
   */
  replayDeliveries(request: WebhookReplayRequest): Promise<WebhookDeliveryResult[]>;

  /**
   * Replay dead letter queue entry
   */
  replayDeadLetterEntry(entryId: string): Promise<WebhookDeliveryResult>;

  /**
   * TESTING & VALIDATION
   */

  /**
   * Send a test event to an endpoint
   */
  sendTestEvent(request: WebhookTestEventRequest): Promise<WebhookDeliveryResult>;

  /**
   * Validate endpoint URL (must be HTTPS)
   */
  validateEndpointUrl(url: string): Promise<boolean>;

  /**
   * Ping endpoint to check availability
   */
  pingEndpoint(endpointId: string): Promise<boolean>;

  /**
   * SECRET MANAGEMENT
   */

  /**
   * Rotate endpoint secret
   */
  rotateSecret(request: WebhookSecretRotationRequest): Promise<WebhookEndpoint>;

  /**
   * Generate a new webhook secret
   */
  generateSecret(): string;

  /**
   * RATE LIMITING
   */

  /**
   * Check if endpoint is rate limited
   */
  isRateLimited(endpointId: string): Promise<boolean>;

  /**
   * Get rate limit status for endpoint
   */
  getRateLimitStatus(endpointId: string): Promise<{ limited: boolean; remaining: number; resetAt: Date }>;

  /**
   * CIRCUIT BREAKER
   */

  /**
   * Get circuit breaker state for endpoint
   */
  getCircuitState(endpointId: string): Promise<'open' | 'closed' | 'half_open'>;

  /**
   * Open circuit breaker (stop deliveries)
   */
  openCircuit(endpointId: string): Promise<void>;

  /**
   * Close circuit breaker (resume deliveries)
   */
  closeCircuit(endpointId: string): Promise<void>;

  /**
   * Reset circuit breaker failures
   */
  resetCircuit(endpointId: string): Promise<void>;

  /**
   * BULK OPERATIONS
   */

  /**
   * Bulk enable/disable/delete endpoints
   */
  bulkManageEndpoints(request: WebhookBulkManagementRequest): Promise<{ success: number; failed: number }>;

  /**
   * STATISTICS & MONITORING
   */

  /**
   * Get endpoint statistics
   */
  getEndpointStats(endpointId: string, startDate?: Date, endDate?: Date): Promise<WebhookEndpointStats>;

  /**
   * Get system-wide webhook statistics
   */
  getSystemStats(): Promise<WebhookSystemStats>;

  /**
   * Get delivery metrics for monitoring
   */
  getDeliveryMetrics(): Promise<{
    totalDeliveries: number;
    successRate: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
  }>;

  /**
   * REAL-TIME NOTIFICATIONS
   */

  /**
   * Subscribe to webhook notifications
   */
  subscribeToNotifications(callback: (notification: WebhookNotification) => void): string;

  /**
   * Unsubscribe from webhook notifications
   */
  unsubscribeFromNotifications(subscriptionId: string): void;

  /**
   * HEALTH & MAINTENANCE
   */

  /**
   * Health check
   */
  healthCheck(): Promise<WebhookHealthCheck>;

  /**
   * Process pending deliveries (scheduled job)
   */
  processPendingDeliveries(): Promise<number>;

  /**
   * Clean up old delivery history
   */
  cleanupOldDeliveries(olderThanDays: number): Promise<number>;

  /**
   * Dispose service and clean up resources
   */
  dispose(): Promise<void>;
}
