/**
 * Payment Type Definitions
 * User Story: US-E5-025 (PaymentProcessingService)
 * Comprehensive payment processing types for Lightning Network and Bitcoin
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

/**
 * Payment status state machine
 */
export enum PaymentStatus {
  PENDING = 'pending', // Payment initiated, awaiting processing
  PROCESSING = 'processing', // Payment being processed
  COMPLETED = 'completed', // Payment successfully completed
  FAILED = 'failed', // Payment failed
  CANCELLED = 'cancelled', // Payment cancelled by user
  EXPIRED = 'expired', // Invoice expired
  REFUNDED = 'refunded', // Payment refunded
  PARTIALLY_REFUNDED = 'partially_refunded', // Partial refund issued
}

/**
 * Payment methods supported
 */
export enum PaymentMethod {
  LIGHTNING = 'lightning', // Lightning Network BOLT11
  ONCHAIN = 'onchain', // On-chain Bitcoin transaction
  LNURL = 'lnurl', // LNURL payment
  WEBLN = 'webln', // WebLN browser wallet
  KEYSEND = 'keysend', // Spontaneous payment (keysend)
}

/**
 * Payment failure reasons
 */
export enum PaymentFailureReason {
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  INVALID_INVOICE = 'invalid_invoice',
  EXPIRED_INVOICE = 'expired_invoice',
  NETWORK_ERROR = 'network_error',
  ROUTE_NOT_FOUND = 'route_not_found',
  TIMEOUT = 'timeout',
  AMOUNT_MISMATCH = 'amount_mismatch',
  VALIDATION_ERROR = 'validation_error',
  PREIMAGE_MISMATCH = 'preimage_mismatch',
  DUPLICATE_PAYMENT = 'duplicate_payment',
  UNKNOWN = 'unknown',
}

/**
 * Lightning Network invoice
 */
export interface LightningInvoice {
  id: string; // Unique invoice ID
  userId: string; // Creator user ID
  paymentRequest: string; // BOLT11 payment request
  paymentHash: string; // Payment hash
  amount: number; // Amount in satoshis
  currency: string; // Original currency (BTC, USD, etc.)
  description: string; // Invoice description
  status: PaymentStatus; // Current payment status
  method: PaymentMethod; // Payment method
  expiresAt: Date; // Expiration timestamp
  createdAt: Date; // Creation timestamp
  paidAt?: Date; // Payment timestamp
  preimage?: string; // Payment preimage (proof of payment)
  metadata?: InvoiceMetadata; // Additional metadata
  idempotencyKey?: string; // Idempotency key for duplicate prevention
}

/**
 * Invoice metadata
 */
export interface InvoiceMetadata {
  contentId?: string; // Associated content ID
  subscriptionId?: string; // Associated subscription ID
  tipId?: string; // Associated tip ID
  productId?: string; // Associated product ID
  customData?: Record<string, any>; // Custom metadata
}

/**
 * Payment transaction record
 */
export interface PaymentTransaction {
  id: string; // Transaction ID
  invoiceId: string; // Associated invoice ID
  userId: string; // User ID
  payerId?: string; // Payer user ID (if different)
  amount: number; // Amount in satoshis
  amountFiat?: number; // Amount in fiat currency
  currency: string; // Currency code
  status: PaymentStatus; // Transaction status
  method: PaymentMethod; // Payment method
  paymentHash: string; // Payment hash
  preimage?: string; // Payment preimage
  fee?: number; // Transaction fee in satoshis
  route?: LightningRoute; // Payment route (if Lightning)
  failureReason?: PaymentFailureReason; // Failure reason
  retryCount: number; // Number of retry attempts
  createdAt: Date; // Creation timestamp
  updatedAt: Date; // Last update timestamp
  completedAt?: Date; // Completion timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Lightning Network payment route
 */
export interface LightningRoute {
  totalAmount: number; // Total amount including fees
  totalFee: number; // Total routing fee
  totalTimeLock: number; // Total time lock
  hops: RouteHop[]; // Route hops
}

/**
 * Route hop in Lightning payment
 */
export interface RouteHop {
  nodeId: string; // Node public key
  channel: string; // Channel ID
  amountToForward: number; // Amount to forward
  fee: number; // Hop fee
  expiry: number; // Expiry height
}

/**
 * Payment receipt
 */
export interface PaymentReceipt {
  id: string; // Receipt ID
  transactionId: string; // Transaction ID
  userId: string; // User ID
  amount: number; // Amount paid
  currency: string; // Currency
  description: string; // Payment description
  paymentHash: string; // Payment hash
  preimage: string; // Payment preimage (proof)
  paidAt: Date; // Payment timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Payment refund
 */
export interface PaymentRefund {
  id: string; // Refund ID
  transactionId: string; // Original transaction ID
  amount: number; // Refund amount in satoshis
  reason?: string; // Refund reason
  status: PaymentStatus; // Refund status
  initiatedBy: string; // User who initiated refund
  processedBy?: string; // User who processed refund
  createdAt: Date; // Creation timestamp
  completedAt?: Date; // Completion timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Payment state transition
 */
export interface PaymentStateTransition {
  fromStatus: PaymentStatus; // Previous status
  toStatus: PaymentStatus; // New status
  timestamp: Date; // Transition timestamp
  reason?: string; // Transition reason
  triggeredBy?: string; // User/system that triggered transition
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Payment processing result
 */
export interface PaymentResult {
  success: boolean; // Whether payment was successful
  transactionId?: string; // Transaction ID if successful
  paymentHash?: string; // Payment hash
  preimage?: string; // Payment preimage
  amount?: number; // Amount paid
  fee?: number; // Transaction fee
  error?: PaymentError; // Error details if failed
  timestamp: Date; // Result timestamp
}

/**
 * Payment error details
 */
export interface PaymentError {
  code: string; // Error code
  message: string; // Error message
  reason: PaymentFailureReason; // Failure reason
  retryable: boolean; // Whether payment can be retried
  details?: Record<string, any>; // Additional error details
}

/**
 * Payment verification result
 */
export interface PaymentVerification {
  valid: boolean; // Whether payment is valid
  paymentHash: string; // Payment hash
  preimage?: string; // Payment preimage
  amount?: number; // Amount paid
  amountExpected?: number; // Expected amount
  confirmedAt?: Date; // Confirmation timestamp
  error?: string; // Validation error
}

/**
 * Payment history query parameters
 */
export interface PaymentHistoryQuery {
  userId?: string; // Filter by user ID
  status?: PaymentStatus; // Filter by status
  method?: PaymentMethod; // Filter by method
  startDate?: Date; // Start date range
  endDate?: Date; // End date range
  minAmount?: number; // Minimum amount
  maxAmount?: number; // Maximum amount
  limit?: number; // Result limit
  offset?: number; // Result offset
  sortBy?: 'createdAt' | 'amount' | 'status'; // Sort field
  sortOrder?: 'asc' | 'desc'; // Sort order
}

/**
 * Payment statistics
 */
export interface PaymentStatistics {
  totalTransactions: number; // Total transaction count
  totalVolume: number; // Total volume in satoshis
  totalVolumeFiat?: number; // Total volume in fiat
  successfulPayments: number; // Successful payment count
  failedPayments: number; // Failed payment count
  averageAmount: number; // Average payment amount
  averageFee: number; // Average transaction fee
  totalFees: number; // Total fees paid
  successRate: number; // Success rate percentage
  averageProcessingTime: number; // Average processing time (ms)
  paymentsByMethod: Record<PaymentMethod, number>; // Breakdown by method
  paymentsByStatus: Record<PaymentStatus, number>; // Breakdown by status
}

/**
 * Invoice creation parameters
 */
export interface CreateInvoiceParams {
  userId: string; // Creator user ID
  amount: number; // Amount in satoshis
  currency?: string; // Currency (default: BTC)
  description: string; // Invoice description
  expiresIn?: number; // Expiration time in seconds (default: 3600)
  method?: PaymentMethod; // Payment method (default: LIGHTNING)
  metadata?: InvoiceMetadata; // Additional metadata
  idempotencyKey?: string; // Idempotency key
}

/**
 * Payment processing parameters
 */
export interface ProcessPaymentParams {
  invoiceId: string; // Invoice ID to pay
  paymentRequest?: string; // Payment request (if external)
  method: PaymentMethod; // Payment method
  preimage?: string; // Preimage for verification
  idempotencyKey?: string; // Idempotency key
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Payment retry configuration
 */
export interface PaymentRetryConfig {
  maxRetries: number; // Maximum retry attempts
  initialDelay: number; // Initial delay in ms
  maxDelay: number; // Maximum delay in ms
  backoffMultiplier: number; // Backoff multiplier (exponential)
  retryableErrors: PaymentFailureReason[]; // Which errors to retry
}

/**
 * Payment limits and constraints
 */
export interface PaymentLimits {
  minAmount: number; // Minimum payment amount (satoshis)
  maxAmount: number; // Maximum payment amount (satoshis)
  maxDailyAmount?: number; // Maximum daily amount per user
  maxMonthlyAmount?: number; // Maximum monthly amount per user
  maxDailyTransactions?: number; // Maximum daily transactions
  invoiceExpiry: number; // Default invoice expiry (seconds)
}

/**
 * Payment webhook event
 */
export interface PaymentWebhookEvent {
  type: 'payment.received' | 'payment.failed' | 'payment.refunded' | 'invoice.expired';
  invoiceId: string; // Invoice ID
  transactionId?: string; // Transaction ID
  userId: string; // User ID
  amount: number; // Amount
  status: PaymentStatus; // Payment status
  timestamp: Date; // Event timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Payment idempotency record
 */
export interface PaymentIdempotency {
  key: string; // Idempotency key
  invoiceId?: string; // Associated invoice ID
  transactionId?: string; // Associated transaction ID
  status: PaymentStatus; // Payment status
  result?: PaymentResult; // Cached result
  createdAt: Date; // Creation timestamp
  expiresAt: Date; // Expiration timestamp
}

/**
 * Currency type (shared with CurrencyService)
 */
export type Currency = 'BTC' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'INR' | 'CAD' | 'AUD';
