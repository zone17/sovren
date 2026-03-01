/**
 * Refund Type Definitions
 * User Story: US-E5-027 (RefundService)
 * Comprehensive refund processing types for payment refunds
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { PaymentMethod, Currency } from './payment';

/**
 * Refund status state machine
 */
export enum RefundStatus {
  PENDING = 'pending', // Refund initiated, awaiting authorization
  AUTHORIZED = 'authorized', // Refund authorized, ready to process
  PROCESSING = 'processing', // Refund being processed
  COMPLETED = 'completed', // Refund successfully completed
  FAILED = 'failed', // Refund failed
  CANCELED = 'canceled', // Refund canceled
  RETRY = 'retry', // Refund scheduled for retry
}

/**
 * Refund type
 */
export enum RefundType {
  FULL = 'full', // Full refund (100% of payment)
  PARTIAL = 'partial', // Partial refund (specified amount)
  AUTOMATIC = 'automatic', // System-initiated refund
  MANUAL = 'manual', // Admin-initiated refund
}

/**
 * Refund reason categories
 */
export enum RefundReason {
  CUSTOMER_REQUEST = 'customer_request',
  FRAUD_DETECTED = 'fraud_detected',
  PAYMENT_ERROR = 'payment_error',
  DUPLICATE_PAYMENT = 'duplicate_payment',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  PRODUCT_UNAVAILABLE = 'product_unavailable',
  DISPUTE_RESOLVED = 'dispute_resolved',
  FAILED_SUBSCRIPTION = 'failed_subscription',
  CHARGEBACK = 'chargeback',
  OTHER = 'other',
}

/**
 * Refund authorization level
 */
export enum RefundAuthorizationLevel {
  AUTO_APPROVED = 'auto_approved', // Automatically approved (< $100)
  MANUAL_REVIEW = 'manual_review', // Requires manual approval (≥ $100)
  ADMIN_OVERRIDE = 'admin_override', // Admin override for any amount
}

/**
 * Refund method (how refund is processed)
 */
export enum RefundMethod {
  LIGHTNING = 'lightning', // Lightning Network refund
  ONCHAIN = 'onchain', // On-chain Bitcoin refund (fallback)
  ORIGINAL_METHOD = 'original_method', // Refund via original payment method
}

/**
 * Core refund record
 */
export interface Refund {
  id: string; // Unique refund ID
  transactionId: string; // Original transaction ID
  invoiceId: string; // Original invoice ID
  userId: string; // User ID receiving refund
  amount: number; // Refund amount in satoshis
  amountFiat?: number; // Refund amount in fiat currency
  currency: Currency; // Currency
  status: RefundStatus; // Current refund status
  type: RefundType; // Refund type
  reason: RefundReason; // Refund reason
  reasonNotes?: string; // Additional reason details
  method: RefundMethod; // Refund method
  authorizationLevel: RefundAuthorizationLevel; // Authorization level
  initiatedBy: string; // User ID who initiated refund
  authorizedBy?: string; // User ID who authorized refund
  processedBy?: string; // User ID who processed refund
  idempotencyKey?: string; // Idempotency key (24-hour dedup)
  paymentHash?: string; // Original payment hash
  refundHash?: string; // Refund payment hash (if Lightning)
  refundPreimage?: string; // Refund preimage (proof)
  fee?: number; // Refund processing fee
  feeHandling: 'deducted' | 'absorbed'; // How fee is handled
  createdAt: Date; // Creation timestamp
  authorizedAt?: Date; // Authorization timestamp
  processedAt?: Date; // Processing start timestamp
  completedAt?: Date; // Completion timestamp
  failedAt?: Date; // Failure timestamp
  expiresAt?: Date; // Expiration for pending refunds
  metadata?: RefundMetadata; // Additional metadata
  history: RefundStateTransition[]; // State transition history
  retryCount: number; // Number of retry attempts
  maxRetries: number; // Maximum retry attempts allowed
  nextRetryAt?: Date; // Next retry timestamp
}

/**
 * Refund metadata
 */
export interface RefundMetadata {
  originalPaymentMethod?: PaymentMethod;
  lightningInvoiceExpired?: boolean; // If original Lightning invoice expired
  onchainFallback?: boolean; // If using on-chain fallback
  batchRefundId?: string; // Batch refund ID (if part of batch)
  disputeId?: string; // Associated dispute ID
  fraudCaseId?: string; // Associated fraud case ID
  supportTicketId?: string; // Associated support ticket ID
  customData?: Record<string, any>; // Custom metadata
}

/**
 * Refund state transition
 */
export interface RefundStateTransition {
  fromStatus: RefundStatus; // Previous status
  toStatus: RefundStatus; // New status
  timestamp: Date; // Transition timestamp
  reason?: string; // Transition reason
  triggeredBy?: string; // User/system that triggered transition
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Refund authorization request
 */
export interface RefundAuthorizationRequest {
  refundId: string; // Refund ID
  transactionId: string; // Transaction ID
  amount: number; // Refund amount
  reason: RefundReason; // Refund reason
  reasonNotes?: string; // Additional notes
  requestedBy: string; // User requesting authorization
  urgency: 'low' | 'medium' | 'high'; // Authorization urgency
}

/**
 * Refund authorization result
 */
export interface RefundAuthorizationResult {
  authorized: boolean; // Whether refund is authorized
  refundId: string; // Refund ID
  authorizationLevel: RefundAuthorizationLevel;
  authorizedBy?: string; // User who authorized
  authorizedAt?: Date; // Authorization timestamp
  reason?: string; // Authorization/rejection reason
  requiresManualReview: boolean; // If manual review required
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Refund processing result
 */
export interface RefundResult {
  success: boolean; // Whether refund was successful
  refundId: string; // Refund ID
  transactionId: string; // Original transaction ID
  amount: number; // Refund amount
  status: RefundStatus; // Final refund status
  method: RefundMethod; // Refund method used
  refundHash?: string; // Refund payment hash (if Lightning)
  refundPreimage?: string; // Refund preimage (proof)
  fee?: number; // Refund fee
  error?: RefundError; // Error details if failed
  timestamp: Date; // Result timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Refund error details
 */
export interface RefundError {
  code: string; // Error code
  message: string; // Error message
  reason: RefundFailureReason; // Failure reason
  retryable: boolean; // Whether refund can be retried
  retryAfter?: Date; // Earliest retry time
  details?: Record<string, any>; // Additional error details
}

/**
 * Refund failure reasons
 */
export enum RefundFailureReason {
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  INVALID_TRANSACTION = 'invalid_transaction',
  TRANSACTION_NOT_REFUNDABLE = 'transaction_not_refundable',
  REFUND_LIMIT_EXCEEDED = 'refund_limit_exceeded',
  AUTHORIZATION_DENIED = 'authorization_denied',
  NETWORK_ERROR = 'network_error',
  ROUTE_NOT_FOUND = 'route_not_found',
  TIMEOUT = 'timeout',
  DUPLICATE_REFUND = 'duplicate_refund',
  EXPIRED = 'expired',
  VALIDATION_ERROR = 'validation_error',
  UNKNOWN = 'unknown',
}

/**
 * Refund validation result
 */
export interface RefundValidation {
  valid: boolean; // Whether refund is valid
  transactionId: string; // Transaction ID
  amount: number; // Requested refund amount
  remainingRefundable: number; // Remaining refundable amount
  totalRefunded: number; // Total already refunded
  canRefund: boolean; // Whether refund can proceed
  requiresAuthorization: boolean; // If authorization required
  authorizationLevel: RefundAuthorizationLevel;
  errors: string[]; // Validation errors
  warnings: string[]; // Validation warnings
  timeLimitValid: boolean; // If within refund time limit
  timeLimitDays: number; // Refund time limit in days
  daysRemaining: number; // Days remaining for refund
}

/**
 * Refund time limit configuration
 */
export interface RefundTimeLimit {
  enabled: boolean; // Whether time limits are enforced
  defaultDays: number; // Default refund window (90 days)
  byPaymentMethod: Record<PaymentMethod, number>; // Limits by payment method
  gracePeriodDays: number; // Grace period after limit
}

/**
 * Refund request parameters
 */
export interface CreateRefundRequest {
  transactionId: string; // Transaction ID to refund
  amount?: number; // Refund amount (full if not specified)
  type?: RefundType; // Refund type (auto-detected if not specified)
  reason: RefundReason; // Refund reason
  reasonNotes?: string; // Additional reason details
  initiatedBy: string; // User initiating refund
  idempotencyKey?: string; // Idempotency key
  forceAuthorization?: boolean; // Force manual authorization
  feeHandling?: 'deducted' | 'absorbed'; // Fee handling (default: absorbed)
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Refund reversal (undo accidental refund)
 */
export interface RefundReversal {
  id: string; // Reversal ID
  refundId: string; // Refund ID being reversed
  transactionId: string; // Original transaction ID
  amount: number; // Amount being reversed
  reason: string; // Reversal reason
  initiatedBy: string; // User initiating reversal
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date; // Creation timestamp
  completedAt?: Date; // Completion timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Batch refund operation
 */
export interface BatchRefundOperation {
  id: string; // Batch ID
  transactionIds: string[]; // Transaction IDs to refund
  totalAmount: number; // Total refund amount
  reason: RefundReason; // Batch refund reason
  reasonNotes?: string; // Additional notes
  initiatedBy: string; // User initiating batch
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedCount: number; // Completed refunds
  failedCount: number; // Failed refunds
  refunds: Refund[]; // Individual refunds
  createdAt: Date; // Creation timestamp
  completedAt?: Date; // Completion timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Refund query parameters
 */
export interface RefundQuery {
  userId?: string; // Filter by user ID
  transactionId?: string; // Filter by transaction ID
  status?: RefundStatus; // Filter by status
  type?: RefundType; // Filter by type
  reason?: RefundReason; // Filter by reason
  startDate?: Date; // Start date range
  endDate?: Date; // End date range
  minAmount?: number; // Minimum refund amount
  maxAmount?: number; // Maximum refund amount
  initiatedBy?: string; // Filter by initiator
  limit?: number; // Result limit
  offset?: number; // Result offset
  sortBy?: 'createdAt' | 'amount' | 'status'; // Sort field
  sortOrder?: 'asc' | 'desc'; // Sort order
}

/**
 * Refund statistics
 */
export interface RefundStatistics {
  totalRefunds: number; // Total refund count
  totalAmount: number; // Total refund amount
  totalAmountFiat?: number; // Total amount in fiat
  refundsByStatus: Record<RefundStatus, number>;
  refundsByReason: Record<RefundReason, number>;
  refundsByType: Record<RefundType, number>;
  refundRate: number; // Refund rate percentage
  averageRefundAmount: number; // Average refund amount
  averageProcessingTime: number; // Average processing time (ms)
  fullRefundCount: number; // Full refund count
  partialRefundCount: number; // Partial refund count
  automaticRefundCount: number; // Automatic refund count
  manualRefundCount: number; // Manual refund count
  successRate: number; // Success rate percentage
  period: {
    // Statistics period
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Refund receipt
 */
export interface RefundReceipt {
  id: string; // Receipt ID
  refundId: string; // Refund ID
  transactionId: string; // Original transaction ID
  userId: string; // User ID
  amount: number; // Refund amount
  currency: Currency; // Currency
  reason: RefundReason; // Refund reason
  method: RefundMethod; // Refund method
  refundHash?: string; // Refund payment hash
  refundPreimage?: string; // Refund preimage (proof)
  completedAt: Date; // Completion timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Refund notification
 */
export interface RefundNotification {
  type: 'refund.initiated' | 'refund.completed' | 'refund.failed' | 'refund.authorization_required';
  refundId: string; // Refund ID
  transactionId: string; // Transaction ID
  userId: string; // User ID
  amount: number; // Refund amount
  status: RefundStatus; // Refund status
  reason: RefundReason; // Refund reason
  timestamp: Date; // Event timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Refund analytics data
 */
export interface RefundAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalRefunds: number;
  totalAmount: number;
  refundRate: number; // Percentage of payments refunded
  topReasons: Array<{
    // Top refund reasons
    reason: RefundReason;
    count: number;
    percentage: number;
  }>;
  trend: Array<{
    // Refund trend over time
    date: Date;
    count: number;
    amount: number;
  }>;
  byMethod: Record<
    RefundMethod,
    {
      // Breakdown by refund method
      count: number;
      amount: number;
      averageProcessingTime: number;
    }
  >;
  fraudIndicators: {
    // Fraud detection metrics
    suspiciousRefundCount: number;
    highRiskUserCount: number;
    duplicateAttempts: number;
  };
}

/**
 * Refund fraud detection result
 */
export interface RefundFraudDetection {
  refundId: string; // Refund ID
  riskScore: number; // Risk score (0-100)
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: FraudFlag[]; // Detected fraud flags
  requiresReview: boolean; // If manual review required
  blocked: boolean; // If refund blocked
  reason?: string; // Block/flag reason
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Fraud flag for refund
 */
export interface FraudFlag {
  type:
    | 'high_frequency'
    | 'large_amount'
    | 'duplicate_request'
    | 'suspicious_pattern'
    | 'blacklisted_user';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Refund rate limit configuration
 */
export interface RefundRateLimitConfig {
  enabled: boolean; // Whether rate limiting is enabled
  maxRefundsPerHour: number; // Max refunds per hour per user
  maxRefundsPerDay: number; // Max refunds per day per user
  maxAmountPerDay: number; // Max refund amount per day
  cooldownPeriod: number; // Cooldown between refunds (seconds)
  bypassRoles: string[]; // Roles that bypass rate limits
}

/**
 * Refund idempotency record
 */
export interface RefundIdempotency {
  key: string; // Idempotency key
  refundId?: string; // Associated refund ID
  transactionId: string; // Transaction ID
  status: RefundStatus; // Refund status
  result?: RefundResult; // Cached result
  createdAt: Date; // Creation timestamp
  expiresAt: Date; // Expiration timestamp (24 hours)
}

/**
 * Refund webhook event
 */
export interface RefundWebhookEvent {
  type:
    | 'refund.initiated'
    | 'refund.authorized'
    | 'refund.processing'
    | 'refund.completed'
    | 'refund.failed'
    | 'refund.canceled';
  refundId: string; // Refund ID
  transactionId: string; // Transaction ID
  userId: string; // User ID
  amount: number; // Refund amount
  status: RefundStatus; // Refund status
  reason: RefundReason; // Refund reason
  timestamp: Date; // Event timestamp
  metadata?: Record<string, any>; // Additional metadata
}
