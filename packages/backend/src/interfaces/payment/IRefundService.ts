/**
 * RefundService Interface
 * User Story: US-E5-027
 * Comprehensive refund processing interface for payment refunds
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type {
  Refund,
  RefundResult,
  RefundValidation,
  RefundAuthorizationRequest,
  RefundAuthorizationResult,
  RefundStatistics,
  RefundReceipt,
  RefundReversal,
  BatchRefundOperation,
  RefundQuery,
  RefundAnalytics,
  RefundFraudDetection,
  RefundIdempotency,
  RefundWebhookEvent,
  CreateRefundRequest,
  RefundNotification,
} from '../../types/refund';
import { RefundStatus, RefundReason } from '../../types/refund';

/**
 * Refund service interface
 * Handles complete refund lifecycle: validation, authorization, processing,
 * tracking, and analytics
 */
export interface IRefundService {
  /**
   * REFUND CREATION & VALIDATION
   */

  /**
   * Create and initiate a refund
   * @param request - Refund creation request
   * @returns Created refund record
   * @throws Error if refund creation fails
   */
  createRefund(request: CreateRefundRequest): Promise<Refund>;

  /**
   * Validate refund request before creation
   * @param transactionId - Transaction ID to refund
   * @param amount - Refund amount (optional, full refund if not specified)
   * @returns Validation result
   */
  validateRefund(transactionId: string, amount?: number): Promise<RefundValidation>;

  /**
   * Check remaining refundable amount for a transaction
   * @param transactionId - Transaction ID
   * @returns Remaining refundable amount in satoshis
   */
  getRemainingRefundableAmount(transactionId: string): Promise<number>;

  /**
   * Check if transaction is refundable
   * @param transactionId - Transaction ID
   * @returns Whether transaction can be refunded
   */
  isRefundable(transactionId: string): Promise<boolean>;

  /**
   * REFUND AUTHORIZATION
   */

  /**
   * Request refund authorization
   * @param request - Authorization request
   * @returns Authorization result
   */
  requestAuthorization(request: RefundAuthorizationRequest): Promise<RefundAuthorizationResult>;

  /**
   * Authorize a pending refund (manual approval)
   * @param refundId - Refund ID
   * @param authorizedBy - User ID authorizing the refund
   * @param notes - Authorization notes (optional)
   * @returns Updated refund record
   */
  authorizeRefund(refundId: string, authorizedBy: string, notes?: string): Promise<Refund>;

  /**
   * Deny a pending refund
   * @param refundId - Refund ID
   * @param deniedBy - User ID denying the refund
   * @param reason - Denial reason
   * @returns Updated refund record
   */
  denyRefund(refundId: string, deniedBy: string, reason: string): Promise<Refund>;

  /**
   * Check if refund requires manual authorization
   * @param amount - Refund amount in satoshis
   * @param transactionId - Transaction ID
   * @returns Whether manual authorization is required
   */
  requiresAuthorization(amount: number, transactionId: string): Promise<boolean>;

  /**
   * REFUND PROCESSING
   */

  /**
   * Process an authorized refund
   * @param refundId - Refund ID
   * @returns Refund result
   */
  processRefund(refundId: string): Promise<RefundResult>;

  /**
   * Process refund with Lightning Network
   * @param refundId - Refund ID
   * @returns Refund result
   */
  processLightningRefund(refundId: string): Promise<RefundResult>;

  /**
   * Process refund with on-chain fallback (for expired Lightning invoices)
   * @param refundId - Refund ID
   * @returns Refund result
   */
  processOnchainRefund(refundId: string): Promise<RefundResult>;

  /**
   * Retry failed refund
   * @param refundId - Refund ID
   * @returns Refund result
   */
  retryRefund(refundId: string): Promise<RefundResult>;

  /**
   * Cancel pending refund
   * @param refundId - Refund ID
   * @param canceledBy - User ID canceling the refund
   * @param reason - Cancellation reason
   * @returns Updated refund record
   */
  cancelRefund(refundId: string, canceledBy: string, reason: string): Promise<Refund>;

  /**
   * REFUND RETRIEVAL & QUERIES
   */

  /**
   * Get refund by ID
   * @param refundId - Refund ID
   * @returns Refund or null if not found
   */
  getRefund(refundId: string): Promise<Refund | null>;

  /**
   * Get refund by idempotency key
   * @param idempotencyKey - Idempotency key
   * @returns Refund or null if not found
   */
  getRefundByIdempotencyKey(idempotencyKey: string): Promise<Refund | null>;

  /**
   * List refunds for a transaction
   * @param transactionId - Transaction ID
   * @returns List of refunds
   */
  listTransactionRefunds(transactionId: string): Promise<Refund[]>;

  /**
   * List refunds for a user
   * @param userId - User ID
   * @param status - Optional status filter
   * @param limit - Result limit
   * @param offset - Result offset
   * @returns List of refunds
   */
  listUserRefunds(
    userId: string,
    status?: RefundStatus,
    limit?: number,
    offset?: number
  ): Promise<Refund[]>;

  /**
   * Query refunds with advanced filters
   * @param query - Query parameters
   * @returns List of refunds matching criteria
   */
  queryRefunds(query: RefundQuery): Promise<Refund[]>;

  /**
   * Get refund count for a user
   * @param userId - User ID
   * @param status - Optional status filter
   * @returns Refund count
   */
  getUserRefundCount(userId: string, status?: RefundStatus): Promise<number>;

  /**
   * REFUND STATE MANAGEMENT
   */

  /**
   * Update refund status
   * @param refundId - Refund ID
   * @param status - New status
   * @param reason - Status change reason (optional)
   * @param triggeredBy - User/system triggering change
   * @returns Updated refund
   */
  updateRefundStatus(
    refundId: string,
    status: RefundStatus,
    reason?: string,
    triggeredBy?: string
  ): Promise<Refund>;

  /**
   * Get refund state history
   * @param refundId - Refund ID
   * @returns State transition history
   */
  getRefundHistory(refundId: string): Promise<Refund['history']>;

  /**
   * Check if status transition is valid
   * @param fromStatus - Current status
   * @param toStatus - Target status
   * @returns Whether transition is allowed
   */
  canTransitionStatus(fromStatus: RefundStatus, toStatus: RefundStatus): boolean;

  /**
   * REFUND RECEIPTS & DOCUMENTATION
   */

  /**
   * Get refund receipt
   * @param refundId - Refund ID
   * @returns Refund receipt
   */
  getRefundReceipt(refundId: string): Promise<RefundReceipt | null>;

  /**
   * Generate refund receipt PDF
   * @param refundId - Refund ID
   * @returns PDF buffer
   */
  generateRefundReceiptPdf(refundId: string): Promise<Buffer>;

  /**
   * REFUND REVERSALS
   */

  /**
   * Reverse a completed refund (undo accidental refund)
   * @param refundId - Refund ID to reverse
   * @param reason - Reversal reason
   * @param initiatedBy - User initiating reversal
   * @returns Refund reversal record
   */
  reverseRefund(refundId: string, reason: string, initiatedBy: string): Promise<RefundReversal>;

  /**
   * Get refund reversal
   * @param reversalId - Reversal ID
   * @returns Refund reversal or null
   */
  getRefundReversal(reversalId: string): Promise<RefundReversal | null>;

  /**
   * List reversals for a refund
   * @param refundId - Refund ID
   * @returns List of reversals
   */
  listRefundReversals(refundId: string): Promise<RefundReversal[]>;

  /**
   * BATCH REFUND OPERATIONS
   */

  /**
   * Create batch refund operation
   * @param transactionIds - Array of transaction IDs to refund
   * @param reason - Batch refund reason
   * @param reasonNotes - Additional notes (optional)
   * @param initiatedBy - User initiating batch
   * @returns Batch refund operation
   */
  createBatchRefund(
    transactionIds: string[],
    reason: RefundReason,
    reasonNotes: string | undefined,
    initiatedBy: string
  ): Promise<BatchRefundOperation>;

  /**
   * Process batch refund
   * @param batchId - Batch ID
   * @returns Updated batch operation with results
   */
  processBatchRefund(batchId: string): Promise<BatchRefundOperation>;

  /**
   * Get batch refund operation
   * @param batchId - Batch ID
   * @returns Batch operation or null
   */
  getBatchRefund(batchId: string): Promise<BatchRefundOperation | null>;

  /**
   * REFUND STATISTICS & ANALYTICS
   */

  /**
   * Get refund statistics
   * @param userId - User ID (optional, for user-specific stats)
   * @param startDate - Start date range (optional)
   * @param endDate - End date range (optional)
   * @returns Refund statistics
   */
  getRefundStatistics(userId?: string, startDate?: Date, endDate?: Date): Promise<RefundStatistics>;

  /**
   * Get refund analytics
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Refund analytics data
   */
  getRefundAnalytics(startDate: Date, endDate: Date): Promise<RefundAnalytics>;

  /**
   * Calculate refund rate for a period
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Refund rate percentage
   */
  calculateRefundRate(startDate: Date, endDate: Date): Promise<number>;

  /**
   * Get top refund reasons
   * @param limit - Number of top reasons to return
   * @param startDate - Start date (optional)
   * @param endDate - End date (optional)
   * @returns Top refund reasons with counts
   */
  getTopRefundReasons(
    limit: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ reason: RefundReason; count: number; percentage: number }>>;

  /**
   * FRAUD DETECTION & SECURITY
   */

  /**
   * Detect fraud indicators in refund request
   * @param refundId - Refund ID
   * @returns Fraud detection result
   */
  detectFraud(refundId: string): Promise<RefundFraudDetection>;

  /**
   * Check if user has suspicious refund pattern
   * @param userId - User ID
   * @returns Whether user has suspicious pattern
   */
  hasSuspiciousRefundPattern(userId: string): Promise<boolean>;

  /**
   * Check refund rate limit for user
   * @param userId - User ID
   * @returns Whether user has exceeded rate limit
   */
  checkRateLimit(userId: string): Promise<{
    exceeded: boolean;
    refundsThisHour: number;
    refundsToday: number;
    amountToday: number;
    nextAllowedAt?: Date;
  }>;

  /**
   * IDEMPOTENCY MANAGEMENT
   */

  /**
   * Check if idempotency key exists
   * @param key - Idempotency key
   * @returns Cached refund result or null
   */
  checkIdempotency(key: string): Promise<RefundIdempotency | null>;

  /**
   * Store idempotency record
   * @param key - Idempotency key
   * @param refundId - Refund ID
   * @param result - Refund result
   */
  storeIdempotency(key: string, refundId: string, result: RefundResult): Promise<void>;

  /**
   * Clear expired idempotency records
   * @returns Number of cleared records
   */
  clearExpiredIdempotency(): Promise<number>;

  /**
   * NOTIFICATIONS & WEBHOOKS
   */

  /**
   * Send refund notification
   * @param notification - Notification data
   */
  sendNotification(notification: RefundNotification): Promise<void>;

  /**
   * Subscribe to refund events
   * @param eventType - Event type
   * @param callback - Event handler
   * @returns Subscription ID
   */
  subscribeToEvents(
    eventType: RefundWebhookEvent['type'],
    callback: (event: RefundWebhookEvent) => void | Promise<void>
  ): string;

  /**
   * Unsubscribe from events
   * @param subscriptionId - Subscription ID
   */
  unsubscribeFromEvents(subscriptionId: string): void;

  /**
   * AUTOMATIC REFUNDS
   */

  /**
   * Process automatic refund for failed subscription
   * @param transactionId - Transaction ID
   * @param reason - Failure reason
   * @returns Refund record
   */
  processAutomaticRefund(transactionId: string, reason: string): Promise<Refund>;

  /**
   * Schedule automatic refund
   * @param transactionId - Transaction ID
   * @param reason - Refund reason
   * @param scheduledFor - Scheduled time
   * @returns Refund record
   */
  scheduleAutomaticRefund(
    transactionId: string,
    reason: string,
    scheduledFor: Date
  ): Promise<Refund>;

  /**
   * HEALTH & MAINTENANCE
   */

  /**
   * Health check for refund service
   * @returns Whether service is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get service metrics
   * @returns Service metrics
   */
  getMetrics(): Promise<{
    uptime: number;
    totalRefunds: number;
    successfulRefunds: number;
    failedRefunds: number;
    successRate: number;
    averageProcessingTime: number;
    pendingAuthorizations: number;
  }>;

  /**
   * Process pending refunds
   * @returns Number of refunds processed
   */
  processPendingRefunds(): Promise<number>;

  /**
   * Cleanup expired refunds
   * @returns Number of expired refunds cleaned up
   */
  cleanupExpiredRefunds(): Promise<number>;

  /**
   * Dispose resources
   */
  dispose(): Promise<void>;
}
