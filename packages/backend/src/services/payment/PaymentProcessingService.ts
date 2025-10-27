/**
 * PaymentProcessingService Implementation
 * User Story: US-E5-025
 * Complete payment processing service with Lightning Network support
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { IPaymentProcessingService } from '../../interfaces/payment/IPaymentProcessingService';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
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
  PaymentStatus,
  PaymentMethod,
  PaymentIdempotency,
  PaymentWebhookEvent,
  PaymentError,
  PaymentFailureReason,
  PaymentRetryConfig,
  PaymentLimits
} from '../../types/payment';
import { DomainEventType, DomainEventBuilder } from '../../interfaces/shared/IEventBus';
import { createHash, randomBytes } from 'crypto';
import { performance } from 'perf_hooks';

/**
 * Payment repository interface (to be implemented separately)
 */
interface IPaymentRepository {
  saveInvoice(invoice: LightningInvoice): Promise<void>;
  getInvoice(invoiceId: string): Promise<LightningInvoice | null>;
  getInvoiceByHash(paymentHash: string): Promise<LightningInvoice | null>;
  updateInvoice(invoice: LightningInvoice): Promise<void>;
  listUserInvoices(userId: string, status?: PaymentStatus, limit?: number, offset?: number): Promise<LightningInvoice[]>;

  saveTransaction(transaction: PaymentTransaction): Promise<void>;
  getTransaction(transactionId: string): Promise<PaymentTransaction | null>;
  updateTransaction(transaction: PaymentTransaction): Promise<void>;
  queryTransactions(query: PaymentHistoryQuery): Promise<PaymentTransaction[]>;

  saveRefund(refund: PaymentRefund): Promise<void>;
  getRefund(refundId: string): Promise<PaymentRefund | null>;
  listTransactionRefunds(transactionId: string): Promise<PaymentRefund[]>;

  saveIdempotency(record: PaymentIdempotency): Promise<void>;
  getIdempotency(key: string): Promise<PaymentIdempotency | null>;
}

/**
 * In-memory payment repository (for development/testing)
 */
class InMemoryPaymentRepository implements IPaymentRepository {
  private invoices = new Map<string, LightningInvoice>();
  private invoicesByHash = new Map<string, LightningInvoice>();
  private transactions = new Map<string, PaymentTransaction>();
  private refunds = new Map<string, PaymentRefund>();
  private idempotency = new Map<string, PaymentIdempotency>();

  async saveInvoice(invoice: LightningInvoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
    this.invoicesByHash.set(invoice.paymentHash, invoice);
  }

  async getInvoice(invoiceId: string): Promise<LightningInvoice | null> {
    return this.invoices.get(invoiceId) || null;
  }

  async getInvoiceByHash(paymentHash: string): Promise<LightningInvoice | null> {
    return this.invoicesByHash.get(paymentHash) || null;
  }

  async updateInvoice(invoice: LightningInvoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
    this.invoicesByHash.set(invoice.paymentHash, invoice);
  }

  async listUserInvoices(userId: string, status?: PaymentStatus, limit = 100, offset = 0): Promise<LightningInvoice[]> {
    let invoices = Array.from(this.invoices.values()).filter(inv => inv.userId === userId);
    if (status) {
      invoices = invoices.filter(inv => inv.status === status);
    }
    return invoices.slice(offset, offset + limit);
  }

  async saveTransaction(transaction: PaymentTransaction): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  async getTransaction(transactionId: string): Promise<PaymentTransaction | null> {
    return this.transactions.get(transactionId) || null;
  }

  async updateTransaction(transaction: PaymentTransaction): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  async queryTransactions(query: PaymentHistoryQuery): Promise<PaymentTransaction[]> {
    let transactions = Array.from(this.transactions.values());

    if (query.userId) {
      transactions = transactions.filter(tx => tx.userId === query.userId);
    }
    if (query.status) {
      transactions = transactions.filter(tx => tx.status === query.status);
    }
    if (query.method) {
      transactions = transactions.filter(tx => tx.method === query.method);
    }
    if (query.startDate) {
      transactions = transactions.filter(tx => tx.createdAt >= query.startDate!);
    }
    if (query.endDate) {
      transactions = transactions.filter(tx => tx.createdAt <= query.endDate!);
    }
    if (query.minAmount) {
      transactions = transactions.filter(tx => tx.amount >= query.minAmount!);
    }
    if (query.maxAmount) {
      transactions = transactions.filter(tx => tx.amount <= query.maxAmount!);
    }

    // Sort
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    transactions.sort((a, b) => {
      const aVal = a[sortBy] as any;
      const bVal = b[sortBy] as any;
      return sortOrder === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    });

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return transactions.slice(offset, offset + limit);
  }

  async saveRefund(refund: PaymentRefund): Promise<void> {
    this.refunds.set(refund.id, refund);
  }

  async getRefund(refundId: string): Promise<PaymentRefund | null> {
    return this.refunds.get(refundId) || null;
  }

  async listTransactionRefunds(transactionId: string): Promise<PaymentRefund[]> {
    return Array.from(this.refunds.values()).filter(ref => ref.transactionId === transactionId);
  }

  async saveIdempotency(record: PaymentIdempotency): Promise<void> {
    this.idempotency.set(record.key, record);
  }

  async getIdempotency(key: string): Promise<PaymentIdempotency | null> {
    return this.idempotency.get(key) || null;
  }
}

/**
 * Payment state machine for status transitions
 */
class PaymentStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    [PaymentStatus.PENDING]: [PaymentStatus.PROCESSING, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED],
    [PaymentStatus.PROCESSING]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED],
    [PaymentStatus.COMPLETED]: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
    [PaymentStatus.FAILED]: [PaymentStatus.PENDING], // Allow retry
    [PaymentStatus.CANCELLED]: [],
    [PaymentStatus.EXPIRED]: [],
    [PaymentStatus.REFUNDED]: [],
    [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.REFUNDED]
  };

  static canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    return this.ALLOWED_TRANSITIONS[from]?.includes(to) || false;
  }

  static validateTransition(from: PaymentStatus, to: PaymentStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid payment status transition from ${from} to ${to}`);
    }
  }
}

/**
 * Concrete implementation of PaymentProcessingService
 */
export class PaymentProcessingService implements IPaymentProcessingService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache: ICacheService;
  private readonly repository: IPaymentRepository;
  private readonly retryConfig: PaymentRetryConfig;
  private readonly limits: PaymentLimits;
  private readonly eventSubscriptions = new Map<string, (event: PaymentWebhookEvent) => void>();
  private readonly metrics = {
    uptime: Date.now(),
    totalInvoices: 0,
    totalTransactions: 0,
    successfulPayments: 0,
    failedPayments: 0,
    totalProcessingTime: 0
  };
  private expirationCheckInterval?: NodeJS.Timeout;

  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    cache: ICacheService,
    repository?: IPaymentRepository,
    retryConfig?: PaymentRetryConfig,
    limits?: PaymentLimits
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;
    this.repository = repository || new InMemoryPaymentRepository();

    // Default retry configuration
    this.retryConfig = retryConfig || {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        PaymentFailureReason.NETWORK_ERROR,
        PaymentFailureReason.TIMEOUT,
        PaymentFailureReason.ROUTE_NOT_FOUND
      ]
    };

    // Default payment limits
    this.limits = limits || {
      minAmount: 1,              // 1 satoshi minimum
      maxAmount: 100_000_000,    // 1 BTC maximum
      invoiceExpiry: 3600        // 1 hour default
    };

    // Start expiration check process
    this.startExpirationCheck();
  }

  /**
   * INVOICE MANAGEMENT
   */

  async createInvoice(params: CreateInvoiceParams): Promise<LightningInvoice> {
    const startTime = performance.now();

    try {
      // Validate amount
      this.validateAmount(params.amount);

      // Check idempotency
      if (params.idempotencyKey) {
        const existing = await this.checkIdempotency(params.idempotencyKey);
        if (existing && existing.invoiceId) {
          const invoice = await this.repository.getInvoice(existing.invoiceId);
          if (invoice) {
            this.logger.info('Returning existing invoice from idempotency key', { invoiceId: invoice.id });
            return invoice;
          }
        }
      }

      // Generate invoice ID and payment hash
      const invoiceId = this.generateInvoiceId();
      const paymentHash = this.generatePaymentHash();
      const expiresIn = params.expiresIn || this.limits.invoiceExpiry;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Create BOLT11 payment request (simplified for now)
      const paymentRequest = this.generateBolt11Invoice(params.amount, paymentHash, params.description);

      // Create invoice
      const invoice: LightningInvoice = {
        id: invoiceId,
        userId: params.userId,
        paymentRequest,
        paymentHash,
        amount: params.amount,
        currency: params.currency || 'BTC',
        description: params.description,
        status: PaymentStatus.PENDING,
        method: params.method || PaymentMethod.LIGHTNING,
        expiresAt,
        createdAt: new Date(),
        metadata: params.metadata,
        idempotencyKey: params.idempotencyKey
      };

      // Save invoice
      await this.repository.saveInvoice(invoice);

      // Cache invoice
      await this.cacheInvoice(invoice);

      // Store idempotency
      if (params.idempotencyKey) {
        await this.storeIdempotency(params.idempotencyKey, invoiceId, {
          success: true,
          timestamp: new Date()
        });
      }

      // Update metrics
      this.metrics.totalInvoices++;

      // Emit event
      await this.emitEvent(DomainEventType.INVOICE_CREATED, invoiceId, {
        userId: params.userId,
        amount: params.amount,
        paymentHash
      });

      const duration = performance.now() - startTime;
      this.logger.info('Invoice created successfully', {
        invoiceId,
        amount: params.amount,
        duration: `${duration.toFixed(2)}ms`
      });

      return invoice;

    } catch (error) {
      this.logger.error('Failed to create invoice', error);
      throw error;
    }
  }

  async getInvoice(invoiceId: string): Promise<LightningInvoice | null> {
    // Check cache first
    const cacheKey = `invoice:${invoiceId}`;
    const cached = await this.cache.get<LightningInvoice>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get from repository
    const invoice = await this.repository.getInvoice(invoiceId);
    if (invoice) {
      await this.cacheInvoice(invoice);
    }

    return invoice;
  }

  async getInvoiceByPaymentHash(paymentHash: string): Promise<LightningInvoice | null> {
    return this.repository.getInvoiceByHash(paymentHash);
  }

  async cancelInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status !== PaymentStatus.PENDING) {
      throw new Error(`Cannot cancel invoice with status ${invoice.status}`);
    }

    invoice.status = PaymentStatus.CANCELLED;
    await this.repository.updateInvoice(invoice);
    await this.cacheInvoice(invoice);

    this.logger.info('Invoice cancelled', { invoiceId });
  }

  async listUserInvoices(
    userId: string,
    status?: PaymentStatus,
    limit = 100,
    offset = 0
  ): Promise<LightningInvoice[]> {
    return this.repository.listUserInvoices(userId, status, limit, offset);
  }

  /**
   * PAYMENT PROCESSING
   */

  async processPayment(params: ProcessPaymentParams): Promise<PaymentResult> {
    const startTime = performance.now();

    try {
      // Get invoice
      const invoice = await this.getInvoice(params.invoiceId);
      if (!invoice) {
        throw this.createPaymentError(
          'INVOICE_NOT_FOUND',
          `Invoice ${params.invoiceId} not found`,
          PaymentFailureReason.INVALID_INVOICE,
          false
        );
      }

      // Check invoice status
      if (invoice.status !== PaymentStatus.PENDING) {
        throw this.createPaymentError(
          'INVALID_INVOICE_STATUS',
          `Invoice status is ${invoice.status}, expected PENDING`,
          PaymentFailureReason.INVALID_INVOICE,
          false
        );
      }

      // Check expiration
      if (new Date() > invoice.expiresAt) {
        await this.expireInvoice(params.invoiceId);
        throw this.createPaymentError(
          'INVOICE_EXPIRED',
          'Invoice has expired',
          PaymentFailureReason.EXPIRED_INVOICE,
          false
        );
      }

      // Update invoice status to processing
      invoice.status = PaymentStatus.PROCESSING;
      await this.repository.updateInvoice(invoice);

      // Create transaction
      const transactionId = this.generateTransactionId();
      const transaction: PaymentTransaction = {
        id: transactionId,
        invoiceId: invoice.id,
        userId: invoice.userId,
        amount: invoice.amount,
        currency: invoice.currency,
        status: PaymentStatus.PROCESSING,
        method: params.method,
        paymentHash: invoice.paymentHash,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata
      };

      await this.repository.saveTransaction(transaction);
      this.metrics.totalTransactions++;

      // Process payment (simplified - in production would interact with Lightning node)
      const result = await this.executePayment(transaction, params);

      // Update transaction and invoice based on result
      if (result.success) {
        transaction.status = PaymentStatus.COMPLETED;
        transaction.completedAt = new Date();
        transaction.preimage = result.preimage;

        invoice.status = PaymentStatus.COMPLETED;
        invoice.paidAt = new Date();
        invoice.preimage = result.preimage;

        this.metrics.successfulPayments++;

        // Emit success event
        await this.emitEvent(DomainEventType.PAYMENT_RECEIVED, invoice.id, {
          userId: invoice.userId,
          amount: invoice.amount,
          transactionId
        });

        // Notify subscribers
        await this.notifyWebhookSubscribers({
          type: 'payment.received',
          invoiceId: invoice.id,
          transactionId,
          userId: invoice.userId,
          amount: invoice.amount,
          status: PaymentStatus.COMPLETED,
          timestamp: new Date()
        });

      } else {
        transaction.status = PaymentStatus.FAILED;
        transaction.failureReason = result.error?.reason;

        invoice.status = PaymentStatus.FAILED;

        this.metrics.failedPayments++;

        // Emit failure event
        await this.emitEvent(DomainEventType.PAYMENT_FAILED, invoice.id, {
          userId: invoice.userId,
          error: result.error?.message,
          reason: result.error?.reason
        });

        // Notify subscribers
        await this.notifyWebhookSubscribers({
          type: 'payment.failed',
          invoiceId: invoice.id,
          transactionId,
          userId: invoice.userId,
          amount: invoice.amount,
          status: PaymentStatus.FAILED,
          timestamp: new Date()
        });
      }

      transaction.updatedAt = new Date();
      await this.repository.updateTransaction(transaction);
      await this.repository.updateInvoice(invoice);
      await this.cacheInvoice(invoice);

      const duration = performance.now() - startTime;
      this.metrics.totalProcessingTime += duration;

      this.logger.info('Payment processing completed', {
        invoiceId: invoice.id,
        transactionId,
        success: result.success,
        duration: `${duration.toFixed(2)}ms`
      });

      return result;

    } catch (error) {
      this.logger.error('Payment processing failed', error);
      throw error;
    }
  }

  async verifyPayment(paymentHash: string, preimage?: string): Promise<PaymentVerification> {
    const invoice = await this.getInvoiceByPaymentHash(paymentHash);

    if (!invoice) {
      return {
        valid: false,
        paymentHash,
        error: 'Invoice not found'
      };
    }

    // If preimage provided, verify it matches the payment hash
    if (preimage) {
      const computedHash = this.hashPreimage(preimage);
      if (computedHash !== paymentHash) {
        return {
          valid: false,
          paymentHash,
          error: 'Preimage does not match payment hash'
        };
      }
    }

    return {
      valid: invoice.status === PaymentStatus.COMPLETED,
      paymentHash,
      preimage: invoice.preimage,
      amount: invoice.amount,
      amountExpected: invoice.amount,
      confirmedAt: invoice.paidAt
    };
  }

  async checkPaymentStatus(invoiceId: string): Promise<PaymentStatus> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    return invoice.status;
  }

  async getTransaction(transactionId: string): Promise<PaymentTransaction | null> {
    return this.repository.getTransaction(transactionId);
  }

  async retryPayment(transactionId: string): Promise<PaymentResult> {
    const transaction = await this.repository.getTransaction(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== PaymentStatus.FAILED) {
      throw new Error(`Cannot retry transaction with status ${transaction.status}`);
    }

    if (transaction.retryCount >= this.retryConfig.maxRetries) {
      throw new Error(`Maximum retry attempts (${this.retryConfig.maxRetries}) exceeded`);
    }

    // Calculate backoff delay
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, transaction.retryCount),
      this.retryConfig.maxDelay
    );

    await this.sleep(delay);

    transaction.retryCount++;
    transaction.status = PaymentStatus.PROCESSING;
    transaction.updatedAt = new Date();
    await this.repository.updateTransaction(transaction);

    return this.processPayment({
      invoiceId: transaction.invoiceId,
      method: transaction.method,
      idempotencyKey: `retry-${transactionId}-${transaction.retryCount}`
    });
  }

  /**
   * REFUND MANAGEMENT
   */

  async initiateRefund(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentRefund> {
    const transaction = await this.repository.getTransaction(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== PaymentStatus.COMPLETED) {
      throw new Error(`Cannot refund transaction with status ${transaction.status}`);
    }

    const refundAmount = amount || transaction.amount;
    if (refundAmount > transaction.amount) {
      throw new Error('Refund amount exceeds transaction amount');
    }

    const refundId = this.generateRefundId();
    const refund: PaymentRefund = {
      id: refundId,
      transactionId,
      amount: refundAmount,
      reason,
      status: PaymentStatus.PROCESSING,
      initiatedBy: transaction.userId,
      createdAt: new Date()
    };

    await this.repository.saveRefund(refund);

    // Update transaction status
    const isPartialRefund = refundAmount < transaction.amount;
    transaction.status = isPartialRefund ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED;
    transaction.updatedAt = new Date();
    await this.repository.updateTransaction(transaction);

    // Emit refund event
    await this.emitEvent(DomainEventType.PAYMENT_REFUNDED, transactionId, {
      refundId,
      amount: refundAmount,
      partial: isPartialRefund
    });

    this.logger.info('Refund initiated', { refundId, transactionId, amount: refundAmount });

    return refund;
  }

  async getRefund(refundId: string): Promise<PaymentRefund | null> {
    return this.repository.getRefund(refundId);
  }

  async listTransactionRefunds(transactionId: string): Promise<PaymentRefund[]> {
    return this.repository.listTransactionRefunds(transactionId);
  }

  /**
   * PAYMENT HISTORY & RECEIPTS
   */

  async getPaymentHistory(query: PaymentHistoryQuery): Promise<PaymentTransaction[]> {
    return this.repository.queryTransactions(query);
  }

  async getReceipt(transactionId: string): Promise<PaymentReceipt | null> {
    const transaction = await this.repository.getTransaction(transactionId);
    if (!transaction || transaction.status !== PaymentStatus.COMPLETED) {
      return null;
    }

    const invoice = await this.repository.getInvoice(transaction.invoiceId);
    if (!invoice) {
      return null;
    }

    return {
      id: `receipt-${transactionId}`,
      transactionId,
      userId: transaction.userId,
      amount: transaction.amount,
      currency: transaction.currency,
      description: invoice.description,
      paymentHash: transaction.paymentHash,
      preimage: transaction.preimage || '',
      paidAt: transaction.completedAt || new Date(),
      metadata: transaction.metadata
    };
  }

  async generateReceiptPdf(transactionId: string): Promise<Buffer> {
    // Simplified PDF generation - in production would use a PDF library
    const receipt = await this.getReceipt(transactionId);
    if (!receipt) {
      throw new Error('Receipt not found');
    }

    const pdfContent = `
      PAYMENT RECEIPT
      Receipt ID: ${receipt.id}
      Transaction ID: ${receipt.transactionId}
      Amount: ${receipt.amount} ${receipt.currency}
      Date: ${receipt.paidAt.toISOString()}
      Payment Hash: ${receipt.paymentHash}
    `;

    return Buffer.from(pdfContent, 'utf-8');
  }

  /**
   * PAYMENT STATISTICS
   */

  async getStatistics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PaymentStatistics> {
    const query: PaymentHistoryQuery = {
      userId,
      startDate,
      endDate,
      limit: Number.MAX_SAFE_INTEGER
    };

    const transactions = await this.repository.queryTransactions(query);

    const stats: PaymentStatistics = {
      totalTransactions: transactions.length,
      totalVolume: 0,
      successfulPayments: 0,
      failedPayments: 0,
      averageAmount: 0,
      averageFee: 0,
      totalFees: 0,
      successRate: 0,
      averageProcessingTime: 0,
      paymentsByMethod: {} as Record<PaymentMethod, number>,
      paymentsByStatus: {} as Record<PaymentStatus, number>
    };

    for (const tx of transactions) {
      stats.totalVolume += tx.amount;
      stats.totalFees += tx.fee || 0;

      if (tx.status === PaymentStatus.COMPLETED) {
        stats.successfulPayments++;
      } else if (tx.status === PaymentStatus.FAILED) {
        stats.failedPayments++;
      }

      // Count by method
      stats.paymentsByMethod[tx.method] = (stats.paymentsByMethod[tx.method] || 0) + 1;

      // Count by status
      stats.paymentsByStatus[tx.status] = (stats.paymentsByStatus[tx.status] || 0) + 1;
    }

    if (transactions.length > 0) {
      stats.averageAmount = stats.totalVolume / transactions.length;
      stats.averageFee = stats.totalFees / transactions.length;
      stats.successRate = (stats.successfulPayments / transactions.length) * 100;
    }

    stats.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalTransactions || 0;

    return stats;
  }

  /**
   * IDEMPOTENCY MANAGEMENT
   */

  async checkIdempotency(key: string): Promise<PaymentIdempotency | null> {
    // Check cache first
    const cacheKey = `idempotency:${key}`;
    const cached = await this.cache.get<PaymentIdempotency>(cacheKey);
    if (cached) {
      return cached;
    }

    return this.repository.getIdempotency(key);
  }

  async storeIdempotency(
    key: string,
    invoiceId: string,
    result: PaymentResult
  ): Promise<void> {
    const record: PaymentIdempotency = {
      key,
      invoiceId,
      status: result.success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      result,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000) // 24 hours
    };

    await this.repository.saveIdempotency(record);

    // Cache for quick access
    await this.cache.set(`idempotency:${key}`, record, 86400);
  }

  /**
   * INVOICE EXPIRATION
   */

  async checkExpiredInvoices(): Promise<number> {
    // In production, this would query the database for expired invoices
    // For now, this is a placeholder
    return 0;
  }

  async expireInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status !== PaymentStatus.PENDING) {
      return; // Already processed
    }

    invoice.status = PaymentStatus.EXPIRED;
    await this.repository.updateInvoice(invoice);
    await this.cacheInvoice(invoice);

    // Emit expiration event
    await this.emitEvent(DomainEventType.INVOICE_EXPIRED, invoiceId, {
      userId: invoice.userId,
      amount: invoice.amount
    });

    this.logger.info('Invoice expired', { invoiceId });
  }

  /**
   * WEBHOOK & EVENTS
   */

  subscribeToEvents(
    eventType: 'payment.received' | 'payment.failed' | 'invoice.expired' | 'payment.refunded',
    callback: (event: PaymentWebhookEvent) => void | Promise<void>
  ): string {
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.eventSubscriptions.set(subscriptionId, callback);
    return subscriptionId;
  }

  unsubscribeFromEvents(subscriptionId: string): void {
    this.eventSubscriptions.delete(subscriptionId);
  }

  /**
   * PAYMENT METHOD MANAGEMENT
   */

  getSupportedMethods(): PaymentMethod[] {
    return [
      PaymentMethod.LIGHTNING,
      PaymentMethod.ONCHAIN,
      PaymentMethod.LNURL,
      PaymentMethod.WEBLN
    ];
  }

  async isMethodAvailable(method: PaymentMethod): Promise<boolean> {
    return this.getSupportedMethods().includes(method);
  }

  /**
   * HEALTH & MAINTENANCE
   */

  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can query invoices
      await this.repository.listUserInvoices('health-check', undefined, 1, 0);
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  async getMetrics(): Promise<{
    uptime: number;
    totalInvoices: number;
    totalTransactions: number;
    successRate: number;
    averageProcessingTime: number;
  }> {
    const uptime = Date.now() - this.metrics.uptime;
    const successRate = this.metrics.totalTransactions > 0
      ? (this.metrics.successfulPayments / this.metrics.totalTransactions) * 100
      : 0;
    const avgProcessingTime = this.metrics.totalTransactions > 0
      ? this.metrics.totalProcessingTime / this.metrics.totalTransactions
      : 0;

    return {
      uptime,
      totalInvoices: this.metrics.totalInvoices,
      totalTransactions: this.metrics.totalTransactions,
      successRate,
      averageProcessingTime: avgProcessingTime
    };
  }

  async dispose(): Promise<void> {
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
    }
    this.eventSubscriptions.clear();
    this.logger.info('PaymentProcessingService disposed');
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private validateAmount(amount: number): void {
    if (amount < this.limits.minAmount) {
      throw new Error(`Amount ${amount} is below minimum ${this.limits.minAmount}`);
    }
    if (amount > this.limits.maxAmount) {
      throw new Error(`Amount ${amount} exceeds maximum ${this.limits.maxAmount}`);
    }
  }

  private generateInvoiceId(): string {
    return `inv_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateRefundId(): string {
    return `ref_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generatePaymentHash(): string {
    return randomBytes(32).toString('hex');
  }

  private hashPreimage(preimage: string): string {
    return createHash('sha256').update(preimage).digest('hex');
  }

  private generateBolt11Invoice(amount: number, paymentHash: string, description: string): string {
    // Simplified BOLT11 generation - in production would use proper Lightning library
    return `lnbc${amount}n1${paymentHash.substring(0, 20)}`;
  }

  private async executePayment(
    transaction: PaymentTransaction,
    params: ProcessPaymentParams
  ): Promise<PaymentResult> {
    // Simplified payment execution - in production would interact with Lightning node
    // For now, simulate successful payment
    const preimage = randomBytes(32).toString('hex');

    return {
      success: true,
      transactionId: transaction.id,
      paymentHash: transaction.paymentHash,
      preimage,
      amount: transaction.amount,
      fee: Math.floor(transaction.amount * 0.001), // 0.1% fee
      timestamp: new Date()
    };
  }

  private createPaymentError(
    code: string,
    message: string,
    reason: PaymentFailureReason,
    retryable: boolean
  ): PaymentError {
    return {
      code,
      message,
      reason,
      retryable
    };
  }

  private async cacheInvoice(invoice: LightningInvoice): Promise<void> {
    await this.cache.set(`invoice:${invoice.id}`, invoice, 3600);
    await this.cache.set(`invoice:hash:${invoice.paymentHash}`, invoice, 3600);
  }

  private async emitEvent(type: DomainEventType, aggregateId: string, payload: any): Promise<void> {
    const event = new DomainEventBuilder()
      .withType(type)
      .withAggregateId(aggregateId)
      .withAggregateType('payment')
      .withPayload(payload)
      .withSource('PaymentProcessingService')
      .build();

    await this.eventBus.publish(event);
  }

  private async notifyWebhookSubscribers(event: PaymentWebhookEvent): Promise<void> {
    for (const [, callback] of this.eventSubscriptions) {
      try {
        await callback(event);
      } catch (error) {
        this.logger.error('Webhook notification failed', error);
      }
    }
  }

  private startExpirationCheck(): void {
    // Check for expired invoices every 5 minutes
    this.expirationCheckInterval = setInterval(async () => {
      try {
        const count = await this.checkExpiredInvoices();
        if (count > 0) {
          this.logger.info(`Expired ${count} invoices`);
        }
      } catch (error) {
        this.logger.error('Expiration check failed', error);
      }
    }, 300000); // 5 minutes
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
