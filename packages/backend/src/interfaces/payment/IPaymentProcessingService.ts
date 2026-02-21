/**
 * PaymentProcessingService Interface
 * User Story: US-E5-025
 * Core payment processing interface for Lightning Network and Bitcoin payments
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type {
  LightningInvoice,
  PaymentTransaction,
  PaymentReceipt,
  PaymentRefund,
  PaymentResult,
  PaymentVerification,
  PaymentStatistics,
  CreateInvoiceParams,
  ProcessPaymentParams,
  PaymentHistoryQuery,
  PaymentIdempotency,
  PaymentWebhookEvent
} from '../../types/payment';
import {
  PaymentStatus,
  PaymentMethod,
} from '../../types/payment';

/**
 * Payment processing service interface
 * Handles Lightning Network invoice generation, payment processing,
 * verification, refunds, and payment lifecycle management
 */
export interface IPaymentProcessingService {
  /**
   * INVOICE MANAGEMENT
   */

  /**
   * Create a new Lightning Network invoice
   * @param params - Invoice creation parameters
   * @returns Created invoice
   * @throws Error if invoice creation fails
   */
  createInvoice(params: CreateInvoiceParams): Promise<LightningInvoice>;

  /**
   * Get invoice by ID
   * @param invoiceId - Invoice ID
   * @returns Invoice or null if not found
   */
  getInvoice(invoiceId: string): Promise<LightningInvoice | null>;

  /**
   * Get invoice by payment hash
   * @param paymentHash - Payment hash
   * @returns Invoice or null if not found
   */
  getInvoiceByPaymentHash(paymentHash: string): Promise<LightningInvoice | null>;

  /**
   * Cancel an unpaid invoice
   * @param invoiceId - Invoice ID
   * @throws Error if invoice cannot be cancelled
   */
  cancelInvoice(invoiceId: string): Promise<void>;

  /**
   * List invoices for a user
   * @param userId - User ID
   * @param status - Optional status filter
   * @param limit - Result limit
   * @param offset - Result offset
   * @returns List of invoices
   */
  listUserInvoices(
    userId: string,
    status?: PaymentStatus,
    limit?: number,
    offset?: number
  ): Promise<LightningInvoice[]>;

  /**
   * PAYMENT PROCESSING
   */

  /**
   * Process a payment
   * @param params - Payment processing parameters
   * @returns Payment result
   */
  processPayment(params: ProcessPaymentParams): Promise<PaymentResult>;

  /**
   * Verify a payment using payment hash and preimage
   * @param paymentHash - Payment hash
   * @param preimage - Payment preimage (optional)
   * @returns Verification result
   */
  verifyPayment(paymentHash: string, preimage?: string): Promise<PaymentVerification>;

  /**
   * Check payment status
   * @param invoiceId - Invoice ID
   * @returns Current payment status
   */
  checkPaymentStatus(invoiceId: string): Promise<PaymentStatus>;

  /**
   * Get payment transaction
   * @param transactionId - Transaction ID
   * @returns Transaction or null if not found
   */
  getTransaction(transactionId: string): Promise<PaymentTransaction | null>;

  /**
   * Retry failed payment
   * @param transactionId - Transaction ID to retry
   * @returns Payment result
   */
  retryPayment(transactionId: string): Promise<PaymentResult>;

  /**
   * REFUND MANAGEMENT
   */

  /**
   * Initiate a refund
   * @param transactionId - Transaction ID to refund
   * @param amount - Refund amount (optional, full refund if not specified)
   * @param reason - Refund reason (optional)
   * @returns Refund record
   */
  initiateRefund(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentRefund>;

  /**
   * Get refund by ID
   * @param refundId - Refund ID
   * @returns Refund or null if not found
   */
  getRefund(refundId: string): Promise<PaymentRefund | null>;

  /**
   * List refunds for a transaction
   * @param transactionId - Transaction ID
   * @returns List of refunds
   */
  listTransactionRefunds(transactionId: string): Promise<PaymentRefund[]>;

  /**
   * PAYMENT HISTORY & RECEIPTS
   */

  /**
   * Get payment history
   * @param query - Query parameters
   * @returns List of transactions
   */
  getPaymentHistory(query: PaymentHistoryQuery): Promise<PaymentTransaction[]>;

  /**
   * Get payment receipt
   * @param transactionId - Transaction ID
   * @returns Payment receipt
   */
  getReceipt(transactionId: string): Promise<PaymentReceipt | null>;

  /**
   * Generate receipt PDF
   * @param transactionId - Transaction ID
   * @returns PDF buffer
   */
  generateReceiptPdf(transactionId: string): Promise<Buffer>;

  /**
   * PAYMENT STATISTICS
   */

  /**
   * Get payment statistics
   * @param userId - User ID (optional, for user-specific stats)
   * @param startDate - Start date range (optional)
   * @param endDate - End date range (optional)
   * @returns Payment statistics
   */
  getStatistics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PaymentStatistics>;

  /**
   * IDEMPOTENCY MANAGEMENT
   */

  /**
   * Check if idempotency key exists
   * @param key - Idempotency key
   * @returns Cached payment result or null
   */
  checkIdempotency(key: string): Promise<PaymentIdempotency | null>;

  /**
   * Store idempotency record
   * @param key - Idempotency key
   * @param invoiceId - Invoice ID
   * @param result - Payment result
   */
  storeIdempotency(
    key: string,
    invoiceId: string,
    result: PaymentResult
  ): Promise<void>;

  /**
   * INVOICE EXPIRATION
   */

  /**
   * Check for expired invoices and update status
   * @returns Number of expired invoices
   */
  checkExpiredInvoices(): Promise<number>;

  /**
   * Manually expire an invoice
   * @param invoiceId - Invoice ID
   */
  expireInvoice(invoiceId: string): Promise<void>;

  /**
   * WEBHOOK & EVENTS
   */

  /**
   * Subscribe to payment events
   * @param eventType - Event type
   * @param callback - Event handler
   * @returns Subscription ID
   */
  subscribeToEvents(
    eventType: 'payment.received' | 'payment.failed' | 'invoice.expired' | 'payment.refunded',
    callback: (event: PaymentWebhookEvent) => void | Promise<void>
  ): string;

  /**
   * Unsubscribe from events
   * @param subscriptionId - Subscription ID
   */
  unsubscribeFromEvents(subscriptionId: string): void;

  /**
   * PAYMENT METHOD MANAGEMENT
   */

  /**
   * List supported payment methods
   * @returns List of supported payment methods
   */
  getSupportedMethods(): PaymentMethod[];

  /**
   * Check if payment method is available
   * @param method - Payment method
   * @returns Whether method is available
   */
  isMethodAvailable(method: PaymentMethod): Promise<boolean>;

  /**
   * HEALTH & MAINTENANCE
   */

  /**
   * Health check for payment processing
   * @returns Whether service is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get service metrics
   * @returns Service metrics
   */
  getMetrics(): Promise<{
    uptime: number;
    totalInvoices: number;
    totalTransactions: number;
    successRate: number;
    averageProcessingTime: number;
  }>;

  /**
   * Dispose resources
   */
  dispose(): Promise<void>;
}
