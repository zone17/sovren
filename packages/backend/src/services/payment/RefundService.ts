// TODO(SOV-REFACTOR-003): This file is 1804 lines. Decompose into:
// - RefundAuthorizationService (requestAuthorization, authorizeRefund, denyRefund, requiresAuthorization — ~150 lines)
// - RefundProcessingService (processRefund, processLightningRefund, processOnchainRefund, retryRefund,
//   processAutomaticRefund, scheduleAutomaticRefund — ~250 lines)
// - RefundFraudService (detectFraud, hasSuspiciousRefundPattern, checkRateLimit — ~100 lines)
// - RefundBatchService (createBatchRefund, processBatchRefund, getBatchRefund — ~100 lines)
// - RefundAnalyticsService (getRefundStatistics, getRefundAnalytics, calculateRefundRate, getTopRefundReasons — ~150 lines)
// - RefundIdempotencyService (checkIdempotency, storeIdempotency, clearExpiredIdempotency — ~60 lines)
// Keep RefundService as a thin façade orchestrating the above; the in-memory InMemoryRefundRepository (~200 lines at top)
// should move to a dedicated repository file under repositories/refund/.
/**
 * RefundService Implementation
 * User Story: US-E5-027
 * Complete refund processing service with authorization, fraud detection, and Lightning Network support
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { IRefundService } from '../../interfaces/payment/IRefundService';
import type { IPaymentProcessingService } from '../../interfaces/payment/IPaymentProcessingService';
import type { ICurrencyService } from '../../interfaces/payment/ICurrencyService';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
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
  RefundTimeLimit,
  RefundRateLimitConfig,
  RefundError,
  FraudFlag,
} from '../../types/refund';
import {
  RefundStatus,
  RefundReason,
  RefundType,
  RefundAuthorizationLevel,
  RefundMethod,
  RefundFailureReason,
} from '../../types/refund';
import type { PaymentTransaction } from '../../types/payment';
import { Currency } from '../../types/payment';
import { DomainEventType, DomainEventBuilder } from '../../interfaces/shared/IEventBus';
import crypto, { createHash, randomBytes } from 'crypto';
import { performance } from 'perf_hooks';

/**
 * Refund repository interface
 */
interface IRefundRepository {
  saveRefund(refund: Refund): Promise<void>;
  getRefund(refundId: string): Promise<Refund | null>;
  getRefundByIdempotencyKey(key: string): Promise<Refund | null>;
  updateRefund(refund: Refund): Promise<void>;
  listTransactionRefunds(transactionId: string): Promise<Refund[]>;
  listUserRefunds(
    userId: string,
    status?: RefundStatus,
    limit?: number,
    offset?: number
  ): Promise<Refund[]>;
  queryRefunds(query: RefundQuery): Promise<Refund[]>;
  getUserRefundCount(userId: string, status?: RefundStatus): Promise<number>;

  saveReversal(reversal: RefundReversal): Promise<void>;
  getReversal(reversalId: string): Promise<RefundReversal | null>;
  listRefundReversals(refundId: string): Promise<RefundReversal[]>;

  saveBatchOperation(batch: BatchRefundOperation): Promise<void>;
  getBatchOperation(batchId: string): Promise<BatchRefundOperation | null>;
  updateBatchOperation(batch: BatchRefundOperation): Promise<void>;

  saveIdempotency(record: RefundIdempotency): Promise<void>;
  getIdempotency(key: string): Promise<RefundIdempotency | null>;
  clearExpiredIdempotency(): Promise<number>;
}

/**
 * In-memory refund repository (for development/testing)
 */
class InMemoryRefundRepository implements IRefundRepository {
  private refunds = new Map<string, Refund>();
  private refundsByIdempotency = new Map<string, Refund>();
  private reversals = new Map<string, RefundReversal>();
  private batches = new Map<string, BatchRefundOperation>();
  private idempotency = new Map<string, RefundIdempotency>();

  async saveRefund(refund: Refund): Promise<void> {
    this.refunds.set(refund.id, refund);
    if (refund.idempotencyKey) {
      this.refundsByIdempotency.set(refund.idempotencyKey, refund);
    }
  }

  async getRefund(refundId: string): Promise<Refund | null> {
    return this.refunds.get(refundId) || null;
  }

  async getRefundByIdempotencyKey(key: string): Promise<Refund | null> {
    return this.refundsByIdempotency.get(key) || null;
  }

  async updateRefund(refund: Refund): Promise<void> {
    this.refunds.set(refund.id, refund);
    if (refund.idempotencyKey) {
      this.refundsByIdempotency.set(refund.idempotencyKey, refund);
    }
  }

  async listTransactionRefunds(transactionId: string): Promise<Refund[]> {
    return Array.from(this.refunds.values()).filter((r) => r.transactionId === transactionId);
  }

  async listUserRefunds(
    userId: string,
    status?: RefundStatus,
    limit = 100,
    offset = 0
  ): Promise<Refund[]> {
    let refunds = Array.from(this.refunds.values()).filter((r) => r.userId === userId);
    if (status) {
      refunds = refunds.filter((r) => r.status === status);
    }
    return refunds.slice(offset, offset + limit);
  }

  async queryRefunds(query: RefundQuery): Promise<Refund[]> {
    let refunds = Array.from(this.refunds.values());

    if (query.userId) refunds = refunds.filter((r) => r.userId === query.userId);
    if (query.transactionId)
      refunds = refunds.filter((r) => r.transactionId === query.transactionId);
    if (query.status) refunds = refunds.filter((r) => r.status === query.status);
    if (query.type) refunds = refunds.filter((r) => r.type === query.type);
    if (query.reason) refunds = refunds.filter((r) => r.reason === query.reason);
    if (query.startDate) refunds = refunds.filter((r) => r.createdAt >= query.startDate!);
    if (query.endDate) refunds = refunds.filter((r) => r.createdAt <= query.endDate!);
    if (query.minAmount) refunds = refunds.filter((r) => r.amount >= query.minAmount!);
    if (query.maxAmount) refunds = refunds.filter((r) => r.amount <= query.maxAmount!);
    if (query.initiatedBy) refunds = refunds.filter((r) => r.initiatedBy === query.initiatedBy);

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    refunds.sort((a, b) => {
      const aVal = a[sortBy] as any;
      const bVal = b[sortBy] as any;
      return sortOrder === 'desc' ? (bVal > aVal ? 1 : -1) : aVal > bVal ? 1 : -1;
    });

    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return refunds.slice(offset, offset + limit);
  }

  async getUserRefundCount(userId: string, status?: RefundStatus): Promise<number> {
    let refunds = Array.from(this.refunds.values()).filter((r) => r.userId === userId);
    if (status) {
      refunds = refunds.filter((r) => r.status === status);
    }
    return refunds.length;
  }

  async saveReversal(reversal: RefundReversal): Promise<void> {
    this.reversals.set(reversal.id, reversal);
  }

  async getReversal(reversalId: string): Promise<RefundReversal | null> {
    return this.reversals.get(reversalId) || null;
  }

  async listRefundReversals(refundId: string): Promise<RefundReversal[]> {
    return Array.from(this.reversals.values()).filter((r) => r.refundId === refundId);
  }

  async saveBatchOperation(batch: BatchRefundOperation): Promise<void> {
    this.batches.set(batch.id, batch);
  }

  async getBatchOperation(batchId: string): Promise<BatchRefundOperation | null> {
    return this.batches.get(batchId) || null;
  }

  async updateBatchOperation(batch: BatchRefundOperation): Promise<void> {
    this.batches.set(batch.id, batch);
  }

  async saveIdempotency(record: RefundIdempotency): Promise<void> {
    this.idempotency.set(record.key, record);
  }

  async getIdempotency(key: string): Promise<RefundIdempotency | null> {
    return this.idempotency.get(key) || null;
  }

  async clearExpiredIdempotency(): Promise<number> {
    const now = new Date();
    let cleared = 0;
    for (const [key, record] of this.idempotency.entries()) {
      if (record.expiresAt < now) {
        this.idempotency.delete(key);
        cleared++;
      }
    }
    return cleared;
  }
}

/**
 * Refund state machine for status transitions
 */
class RefundStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
    [RefundStatus.PENDING]: [RefundStatus.AUTHORIZED, RefundStatus.CANCELED, RefundStatus.FAILED],
    [RefundStatus.AUTHORIZED]: [RefundStatus.PROCESSING, RefundStatus.CANCELED],
    [RefundStatus.PROCESSING]: [RefundStatus.COMPLETED, RefundStatus.FAILED, RefundStatus.RETRY],
    [RefundStatus.COMPLETED]: [], // Terminal state
    [RefundStatus.FAILED]: [RefundStatus.RETRY, RefundStatus.CANCELED],
    [RefundStatus.RETRY]: [RefundStatus.PROCESSING, RefundStatus.FAILED, RefundStatus.CANCELED],
    [RefundStatus.CANCELED]: [], // Terminal state
  };

  static canTransition(from: RefundStatus, to: RefundStatus): boolean {
    return this.ALLOWED_TRANSITIONS[from]?.includes(to) || false;
  }

  static validateTransition(from: RefundStatus, to: RefundStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid refund status transition from ${from} to ${to}`);
    }
  }
}

/**
 * Concrete implementation of RefundService
 */
export class RefundService implements IRefundService {
  private readonly paymentService: IPaymentProcessingService;
  private readonly currencyService: ICurrencyService;
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache: ICacheService;
  private readonly repository: IRefundRepository;
  private readonly timeLimit: RefundTimeLimit;
  private readonly rateLimit: RefundRateLimitConfig;
  private readonly authorizationThreshold: number; // USD equivalent
  private readonly eventSubscriptions = new Map<string, (event: RefundWebhookEvent) => void>();
  private readonly metrics = {
    uptime: Date.now(),
    totalRefunds: 0,
    successfulRefunds: 0,
    failedRefunds: 0,
    totalProcessingTime: 0,
  };
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    paymentService: IPaymentProcessingService,
    currencyService: ICurrencyService,
    eventBus: IEventBus,
    logger: ILogger,
    cache: ICacheService,
    repository?: IRefundRepository,
    timeLimit?: RefundTimeLimit,
    rateLimit?: RefundRateLimitConfig,
    authorizationThreshold = 100 // $100 USD
  ) {
    this.paymentService = paymentService;
    this.currencyService = currencyService;
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;
    this.repository = repository || new InMemoryRefundRepository();
    this.authorizationThreshold = authorizationThreshold;

    // Default time limit configuration (90 days)
    this.timeLimit = timeLimit || {
      enabled: true,
      defaultDays: 90,
      byPaymentMethod: {
        lightning: 90,
        onchain: 180,
        lnurl: 90,
        webln: 90,
        keysend: 90,
      },
      gracePeriodDays: 7,
    };

    // Default rate limit configuration
    this.rateLimit = rateLimit || {
      enabled: true,
      maxRefundsPerHour: 10,
      maxRefundsPerDay: 50,
      maxAmountPerDay: 100_000_000, // 1 BTC
      cooldownPeriod: 300, // 5 minutes
      bypassRoles: ['admin', 'support'],
    };

    // Start cleanup process
    this.startCleanupProcess();
  }

  /**
   * REFUND CREATION & VALIDATION
   */

  async createRefund(request: CreateRefundRequest): Promise<Refund> {
    const startTime = performance.now();

    try {
      // Check idempotency
      if (request.idempotencyKey) {
        const existing = await this.checkIdempotency(request.idempotencyKey);
        if (existing && existing.refundId) {
          const refund = await this.repository.getRefund(existing.refundId);
          if (refund) {
            this.logger.info('Returning existing refund from idempotency key', {
              refundId: refund.id,
            });
            return refund;
          }
        }
      }

      // Get and validate transaction
      const transaction = await this.paymentService.getTransaction(request.transactionId);
      if (!transaction) {
        throw this.createRefundError(
          'TRANSACTION_NOT_FOUND',
          `Transaction ${request.transactionId} not found`,
          RefundFailureReason.INVALID_TRANSACTION,
          false
        );
      }

      // Validate refund
      const amount = request.amount || transaction.amount;
      const validation = await this.validateRefund(request.transactionId, amount);
      if (!validation.valid) {
        throw this.createRefundError(
          'REFUND_VALIDATION_FAILED',
          validation.errors.join(', '),
          RefundFailureReason.VALIDATION_ERROR,
          false
        );
      }

      // Check rate limit
      const rateLimitCheck = await this.checkRateLimit(transaction.userId);
      if (rateLimitCheck.exceeded) {
        throw this.createRefundError(
          'RATE_LIMIT_EXCEEDED',
          'Refund rate limit exceeded',
          RefundFailureReason.VALIDATION_ERROR,
          true,
          { nextAllowedAt: rateLimitCheck.nextAllowedAt }
        );
      }

      // Determine refund type
      const type =
        request.type || (amount === transaction.amount ? RefundType.FULL : RefundType.PARTIAL);

      // Determine authorization level
      const usdAmount = await this.convertToUSD(amount, transaction.currency as Currency);
      const requiresAuth = request.forceAuthorization || usdAmount >= this.authorizationThreshold;
      const authLevel = requiresAuth
        ? RefundAuthorizationLevel.MANUAL_REVIEW
        : RefundAuthorizationLevel.AUTO_APPROVED;

      // Create refund record
      const refundId = this.generateRefundId();
      const now = new Date();
      const refund: Refund = {
        id: refundId,
        transactionId: request.transactionId,
        invoiceId: transaction.invoiceId,
        userId: transaction.userId,
        amount,
        amountFiat: usdAmount,
        currency: transaction.currency as Currency,
        status:
          authLevel === RefundAuthorizationLevel.AUTO_APPROVED
            ? RefundStatus.AUTHORIZED
            : RefundStatus.PENDING,
        type,
        reason: request.reason,
        reasonNotes: request.reasonNotes,
        method: RefundMethod.ORIGINAL_METHOD,
        authorizationLevel: authLevel,
        initiatedBy: request.initiatedBy,
        idempotencyKey: request.idempotencyKey,
        paymentHash: transaction.paymentHash,
        feeHandling: request.feeHandling || 'absorbed',
        createdAt: now,
        authorizedAt: authLevel === RefundAuthorizationLevel.AUTO_APPROVED ? now : undefined,
        expiresAt: new Date(now.getTime() + 7 * 86400000), // 7 days expiration
        metadata: request.metadata,
        history: [
          {
            fromStatus: RefundStatus.PENDING,
            toStatus:
              authLevel === RefundAuthorizationLevel.AUTO_APPROVED
                ? RefundStatus.AUTHORIZED
                : RefundStatus.PENDING,
            timestamp: now,
            reason: 'Refund initiated',
            triggeredBy: request.initiatedBy,
          },
        ],
        retryCount: 0,
        maxRetries: 3,
      };

      // Save refund
      await this.repository.saveRefund(refund);

      // Cache refund
      await this.cacheRefund(refund);

      // Store idempotency
      if (request.idempotencyKey) {
        await this.storeIdempotency(request.idempotencyKey, refundId, {
          success: true,
          refundId,
          transactionId: request.transactionId,
          amount,
          status: refund.status,
          method: refund.method,
          timestamp: now,
        });
      }

      // Update metrics
      this.metrics.totalRefunds++;

      // Emit event
      await this.emitEvent(DomainEventType.REFUND_INITIATED, refundId, {
        userId: transaction.userId,
        transactionId: request.transactionId,
        amount,
        reason: request.reason,
      });

      // Send notification
      await this.sendNotification({
        type: 'refund.initiated',
        refundId,
        transactionId: request.transactionId,
        userId: transaction.userId,
        amount,
        status: refund.status,
        reason: request.reason,
        timestamp: now,
      });

      // Auto-process if authorized
      if (authLevel === RefundAuthorizationLevel.AUTO_APPROVED) {
        // Process asynchronously
        this.processRefund(refundId).catch((error) => {
          this.logger.error('Failed to auto-process refund', error);
        });
      }

      const duration = performance.now() - startTime;
      this.logger.info('Refund created successfully', {
        refundId,
        transactionId: request.transactionId,
        amount,
        requiresAuth,
        duration: `${duration.toFixed(2)}ms`,
      });

      return refund;
    } catch (error) {
      this.logger.error('Failed to create refund', error);
      throw error;
    }
  }

  async validateRefund(transactionId: string, amount?: number): Promise<RefundValidation> {
    const validation: RefundValidation = {
      valid: true,
      transactionId,
      amount: amount || 0,
      remainingRefundable: 0,
      totalRefunded: 0,
      canRefund: true,
      requiresAuthorization: false,
      authorizationLevel: RefundAuthorizationLevel.AUTO_APPROVED,
      errors: [],
      warnings: [],
      timeLimitValid: true,
      timeLimitDays: this.timeLimit.defaultDays,
      daysRemaining: 0,
    };

    // Get transaction
    const transaction = await this.paymentService.getTransaction(transactionId);
    if (!transaction) {
      validation.valid = false;
      validation.canRefund = false;
      validation.errors.push('Transaction not found');
      return validation;
    }

    // Check transaction status
    if (transaction.status !== 'completed') {
      validation.valid = false;
      validation.canRefund = false;
      validation.errors.push(`Transaction status is ${transaction.status}, must be completed`);
      return validation;
    }

    // Calculate refundable amount
    const existingRefunds = await this.repository.listTransactionRefunds(transactionId);
    const totalRefunded = existingRefunds
      .filter((r) => r.status === RefundStatus.COMPLETED)
      .reduce((sum, r) => sum + r.amount, 0);

    validation.totalRefunded = totalRefunded;
    validation.remainingRefundable = transaction.amount - totalRefunded;

    // Validate amount
    const refundAmount = amount || transaction.amount;
    validation.amount = refundAmount;

    if (refundAmount <= 0) {
      validation.valid = false;
      validation.errors.push('Refund amount must be greater than 0');
    }

    if (refundAmount > validation.remainingRefundable) {
      validation.valid = false;
      validation.errors.push(
        `Refund amount ${refundAmount} exceeds remaining refundable amount ${validation.remainingRefundable}`
      );
    }

    // Check time limit
    if (this.timeLimit.enabled) {
      const daysSincePurchase = (Date.now() - transaction.createdAt.getTime()) / 86400000;
      validation.daysRemaining = Math.max(0, this.timeLimit.defaultDays - daysSincePurchase);
      validation.timeLimitValid =
        daysSincePurchase <= this.timeLimit.defaultDays + this.timeLimit.gracePeriodDays;

      if (!validation.timeLimitValid) {
        validation.valid = false;
        validation.canRefund = false;
        validation.errors.push(
          `Transaction is ${Math.floor(daysSincePurchase)} days old, exceeds refund limit of ${this.timeLimit.defaultDays} days`
        );
      } else if (daysSincePurchase > this.timeLimit.defaultDays) {
        validation.warnings.push('Transaction is in grace period for refunds');
      }
    }

    // Check authorization requirement
    const usdAmount = await this.convertToUSD(refundAmount, transaction.currency as Currency);
    validation.requiresAuthorization = usdAmount >= this.authorizationThreshold;
    validation.authorizationLevel = validation.requiresAuthorization
      ? RefundAuthorizationLevel.MANUAL_REVIEW
      : RefundAuthorizationLevel.AUTO_APPROVED;

    return validation;
  }

  async getRemainingRefundableAmount(transactionId: string): Promise<number> {
    const transaction = await this.paymentService.getTransaction(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const existingRefunds = await this.repository.listTransactionRefunds(transactionId);
    const totalRefunded = existingRefunds
      .filter((r) => r.status === RefundStatus.COMPLETED)
      .reduce((sum, r) => sum + r.amount, 0);

    return transaction.amount - totalRefunded;
  }

  async isRefundable(transactionId: string): Promise<boolean> {
    const validation = await this.validateRefund(transactionId);
    return validation.valid && validation.canRefund;
  }

  /**
   * REFUND AUTHORIZATION
   */

  async requestAuthorization(
    request: RefundAuthorizationRequest
  ): Promise<RefundAuthorizationResult> {
    const refund = await this.repository.getRefund(request.refundId);
    if (!refund) {
      throw new Error(`Refund ${request.refundId} not found`);
    }

    const usdAmount = await this.convertToUSD(request.amount, refund.currency);
    const requiresManualReview = usdAmount >= this.authorizationThreshold;

    return {
      authorized: !requiresManualReview,
      refundId: request.refundId,
      authorizationLevel: requiresManualReview
        ? RefundAuthorizationLevel.MANUAL_REVIEW
        : RefundAuthorizationLevel.AUTO_APPROVED,
      authorizedAt: !requiresManualReview ? new Date() : undefined,
      requiresManualReview,
      reason: requiresManualReview
        ? `Amount $${usdAmount.toFixed(2)} requires manual authorization`
        : 'Auto-approved',
    };
  }

  async authorizeRefund(refundId: string, authorizedBy: string, notes?: string): Promise<Refund> {
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new Error(`Cannot authorize refund with status ${refund.status}`);
    }

    const now = new Date();
    refund.status = RefundStatus.AUTHORIZED;
    refund.authorizedBy = authorizedBy;
    refund.authorizedAt = now;
    refund.history.push({
      fromStatus: RefundStatus.PENDING,
      toStatus: RefundStatus.AUTHORIZED,
      timestamp: now,
      reason: notes || 'Manual authorization',
      triggeredBy: authorizedBy,
    });

    await this.repository.updateRefund(refund);
    await this.cacheRefund(refund);

    // Emit event
    await this.emitEvent(DomainEventType.REFUND_AUTHORIZED, refundId, {
      userId: refund.userId,
      amount: refund.amount,
      authorizedBy,
    });

    // Auto-process authorized refund
    this.processRefund(refundId).catch((error) => {
      this.logger.error('Failed to auto-process authorized refund', error);
    });

    this.logger.info('Refund authorized', { refundId, authorizedBy });

    return refund;
  }

  async denyRefund(refundId: string, deniedBy: string, reason: string): Promise<Refund> {
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new Error(`Cannot deny refund with status ${refund.status}`);
    }

    const now = new Date();
    refund.status = RefundStatus.CANCELED;
    refund.history.push({
      fromStatus: RefundStatus.PENDING,
      toStatus: RefundStatus.CANCELED,
      timestamp: now,
      reason: `Denied: ${reason}`,
      triggeredBy: deniedBy,
    });

    await this.repository.updateRefund(refund);
    await this.cacheRefund(refund);

    // Emit event
    await this.emitEvent(DomainEventType.REFUND_DENIED, refundId, {
      userId: refund.userId,
      amount: refund.amount,
      deniedBy,
      reason,
    });

    this.logger.info('Refund denied', { refundId, deniedBy, reason });

    return refund;
  }

  async requiresAuthorization(amount: number, transactionId: string): Promise<boolean> {
    const transaction = await this.paymentService.getTransaction(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const usdAmount = await this.convertToUSD(amount, transaction.currency as Currency);
    return usdAmount >= this.authorizationThreshold;
  }

  /**
   * REFUND PROCESSING
   */

  async processRefund(refundId: string): Promise<RefundResult> {
    const startTime = performance.now();

    try {
      const refund = await this.repository.getRefund(refundId);
      if (!refund) {
        throw this.createRefundError(
          'REFUND_NOT_FOUND',
          `Refund ${refundId} not found`,
          RefundFailureReason.INVALID_TRANSACTION,
          false
        );
      }

      // Check refund status
      if (refund.status !== RefundStatus.AUTHORIZED && refund.status !== RefundStatus.RETRY) {
        throw this.createRefundError(
          'INVALID_REFUND_STATUS',
          `Refund status is ${refund.status}, expected AUTHORIZED or RETRY`,
          RefundFailureReason.VALIDATION_ERROR,
          false
        );
      }

      // Update status to processing
      await this.updateRefundStatus(
        refundId,
        RefundStatus.PROCESSING,
        'Starting refund processing',
        'system'
      );

      // Determine refund method
      const transaction = await this.paymentService.getTransaction(refund.transactionId);
      if (!transaction) {
        throw this.createRefundError(
          'TRANSACTION_NOT_FOUND',
          `Transaction ${refund.transactionId} not found`,
          RefundFailureReason.INVALID_TRANSACTION,
          false
        );
      }

      // Process based on payment method
      let result: RefundResult;
      if (transaction.method === 'lightning' || transaction.method === 'webln') {
        // Check if Lightning invoice is expired (> 1 hour)
        const invoiceAge = Date.now() - transaction.createdAt.getTime();
        if (invoiceAge > 3600000) {
          // Use on-chain fallback
          result = await this.processOnchainRefund(refundId);
        } else {
          result = await this.processLightningRefund(refundId);
        }
      } else {
        result = await this.executeRefund(refund, transaction);
      }

      // Update refund based on result
      if (result.success) {
        refund.status = RefundStatus.COMPLETED;
        refund.completedAt = new Date();
        refund.refundHash = result.refundHash;
        refund.refundPreimage = result.refundPreimage;
        refund.fee = result.fee;

        this.metrics.successfulRefunds++;

        // Emit success event
        await this.emitEvent(DomainEventType.REFUND_COMPLETED, refundId, {
          userId: refund.userId,
          amount: refund.amount,
          transactionId: refund.transactionId,
        });

        // Send notification
        await this.sendNotification({
          type: 'refund.completed',
          refundId,
          transactionId: refund.transactionId,
          userId: refund.userId,
          amount: refund.amount,
          status: RefundStatus.COMPLETED,
          reason: refund.reason,
          timestamp: new Date(),
        });
      } else {
        refund.status = result.error?.retryable ? RefundStatus.RETRY : RefundStatus.FAILED;
        refund.failedAt = new Date();

        if (result.error?.retryable && refund.retryCount < refund.maxRetries) {
          refund.nextRetryAt = new Date(Date.now() + 300000); // 5 minutes
        }

        this.metrics.failedRefunds++;

        // Emit failure event
        await this.emitEvent(DomainEventType.REFUND_FAILED, refundId, {
          userId: refund.userId,
          error: result.error?.message,
          reason: result.error?.reason,
        });

        // Send notification
        await this.sendNotification({
          type: 'refund.failed',
          refundId,
          transactionId: refund.transactionId,
          userId: refund.userId,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason,
          timestamp: new Date(),
        });
      }

      refund.history.push({
        fromStatus: RefundStatus.PROCESSING,
        toStatus: refund.status,
        timestamp: new Date(),
        reason: result.success ? 'Refund completed' : result.error?.message,
        triggeredBy: 'system',
      });

      await this.repository.updateRefund(refund);
      await this.cacheRefund(refund);

      const duration = performance.now() - startTime;
      this.metrics.totalProcessingTime += duration;

      this.logger.info('Refund processing completed', {
        refundId,
        success: result.success,
        duration: `${duration.toFixed(2)}ms`,
      });

      return result;
    } catch (error) {
      this.logger.error('Refund processing failed', error);
      throw error;
    }
  }

  async processLightningRefund(refundId: string): Promise<RefundResult> {
    // Simplified Lightning refund - in production would interact with Lightning node
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    const refundPreimage = randomBytes(32).toString('hex');
    const refundHash = createHash('sha256').update(refundPreimage).digest('hex');

    return {
      success: true,
      refundId: refund.id,
      transactionId: refund.transactionId,
      amount: refund.amount,
      status: RefundStatus.COMPLETED,
      method: RefundMethod.LIGHTNING,
      refundHash,
      refundPreimage,
      fee: Math.floor(refund.amount * 0.001), // 0.1% fee
      timestamp: new Date(),
    };
  }

  async processOnchainRefund(refundId: string): Promise<RefundResult> {
    // Simplified on-chain refund - in production would create Bitcoin transaction
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    return {
      success: true,
      refundId: refund.id,
      transactionId: refund.transactionId,
      amount: refund.amount,
      status: RefundStatus.COMPLETED,
      method: RefundMethod.ONCHAIN,
      fee: Math.floor(refund.amount * 0.002), // 0.2% fee (higher for on-chain)
      timestamp: new Date(),
      metadata: { fallback: true, reason: 'Lightning invoice expired' },
    };
  }

  async retryRefund(refundId: string): Promise<RefundResult> {
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    if (refund.status !== RefundStatus.RETRY && refund.status !== RefundStatus.FAILED) {
      throw new Error(`Cannot retry refund with status ${refund.status}`);
    }

    if (refund.retryCount >= refund.maxRetries) {
      throw new Error(`Maximum retry attempts (${refund.maxRetries}) exceeded`);
    }

    refund.retryCount++;
    refund.status = RefundStatus.RETRY;
    await this.repository.updateRefund(refund);

    this.logger.info('Retrying refund', { refundId, retryCount: refund.retryCount });

    return this.processRefund(refundId);
  }

  async cancelRefund(refundId: string, canceledBy: string, reason: string): Promise<Refund> {
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    if (refund.status === RefundStatus.COMPLETED) {
      throw new Error('Cannot cancel completed refund');
    }

    const now = new Date();
    refund.status = RefundStatus.CANCELED;
    refund.history.push({
      fromStatus: refund.status,
      toStatus: RefundStatus.CANCELED,
      timestamp: now,
      reason: `Canceled: ${reason}`,
      triggeredBy: canceledBy,
    });

    await this.repository.updateRefund(refund);
    await this.cacheRefund(refund);

    // Emit event
    await this.emitEvent(DomainEventType.REFUND_CANCELED, refundId, {
      userId: refund.userId,
      amount: refund.amount,
      canceledBy,
      reason,
    });

    this.logger.info('Refund canceled', { refundId, canceledBy, reason });

    return refund;
  }

  /**
   * REFUND RETRIEVAL & QUERIES
   */

  async getRefund(refundId: string): Promise<Refund | null> {
    const cacheKey = `refund:${refundId}`;
    const cached = await this.cache.get<Refund>(cacheKey);
    if (cached) {
      return cached;
    }

    const refund = await this.repository.getRefund(refundId);
    if (refund) {
      await this.cacheRefund(refund);
    }

    return refund;
  }

  async getRefundByIdempotencyKey(idempotencyKey: string): Promise<Refund | null> {
    return this.repository.getRefundByIdempotencyKey(idempotencyKey);
  }

  async listTransactionRefunds(transactionId: string): Promise<Refund[]> {
    return this.repository.listTransactionRefunds(transactionId);
  }

  async listUserRefunds(
    userId: string,
    status?: RefundStatus,
    limit = 100,
    offset = 0
  ): Promise<Refund[]> {
    return this.repository.listUserRefunds(userId, status, limit, offset);
  }

  async queryRefunds(query: RefundQuery): Promise<Refund[]> {
    return this.repository.queryRefunds(query);
  }

  async getUserRefundCount(userId: string, status?: RefundStatus): Promise<number> {
    return this.repository.getUserRefundCount(userId, status);
  }

  /**
   * REFUND STATE MANAGEMENT
   */

  async updateRefundStatus(
    refundId: string,
    status: RefundStatus,
    reason?: string,
    triggeredBy?: string
  ): Promise<Refund> {
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    RefundStateMachine.validateTransition(refund.status, status);

    const now = new Date();
    const previousStatus = refund.status;
    refund.status = status;

    // Update timestamps based on status
    if (status === RefundStatus.AUTHORIZED) {
      refund.authorizedAt = now;
    } else if (status === RefundStatus.PROCESSING) {
      refund.processedAt = now;
    } else if (status === RefundStatus.COMPLETED) {
      refund.completedAt = now;
    } else if (status === RefundStatus.FAILED) {
      refund.failedAt = now;
    }

    refund.history.push({
      fromStatus: previousStatus,
      toStatus: status,
      timestamp: now,
      reason,
      triggeredBy,
    });

    await this.repository.updateRefund(refund);
    await this.cacheRefund(refund);

    return refund;
  }

  async getRefundHistory(refundId: string): Promise<Refund['history']> {
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }
    return refund.history;
  }

  canTransitionStatus(fromStatus: RefundStatus, toStatus: RefundStatus): boolean {
    return RefundStateMachine.canTransition(fromStatus, toStatus);
  }

  /**
   * REFUND RECEIPTS & DOCUMENTATION
   */

  async getRefundReceipt(refundId: string): Promise<RefundReceipt | null> {
    const refund = await this.repository.getRefund(refundId);
    if (!refund || refund.status !== RefundStatus.COMPLETED) {
      return null;
    }

    return {
      id: `receipt-${refundId}`,
      refundId: refund.id,
      transactionId: refund.transactionId,
      userId: refund.userId,
      amount: refund.amount,
      currency: refund.currency,
      reason: refund.reason,
      method: refund.method,
      refundHash: refund.refundHash,
      refundPreimage: refund.refundPreimage,
      completedAt: refund.completedAt || new Date(),
      metadata: refund.metadata,
    };
  }

  async generateRefundReceiptPdf(refundId: string): Promise<Buffer> {
    const receipt = await this.getRefundReceipt(refundId);
    if (!receipt) {
      throw new Error('Refund receipt not found');
    }

    // Simplified PDF generation
    const pdfContent = `
      REFUND RECEIPT
      Receipt ID: ${receipt.id}
      Refund ID: ${receipt.refundId}
      Transaction ID: ${receipt.transactionId}
      Amount: ${receipt.amount} ${receipt.currency}
      Reason: ${receipt.reason}
      Date: ${receipt.completedAt.toISOString()}
    `;

    return Buffer.from(pdfContent, 'utf-8');
  }

  /**
   * REFUND REVERSALS
   */

  async reverseRefund(
    refundId: string,
    reason: string,
    initiatedBy: string
  ): Promise<RefundReversal> {
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    if (refund.status !== RefundStatus.COMPLETED) {
      throw new Error('Can only reverse completed refunds');
    }

    const reversalId = this.generateReversalId();
    const reversal: RefundReversal = {
      id: reversalId,
      refundId: refund.id,
      transactionId: refund.transactionId,
      amount: refund.amount,
      reason,
      initiatedBy,
      status: 'completed',
      createdAt: new Date(),
      completedAt: new Date(),
    };

    await this.repository.saveReversal(reversal);

    // Emit event
    await this.emitEvent(DomainEventType.REFUND_REVERSED, refundId, {
      reversalId,
      amount: refund.amount,
      reason,
      initiatedBy,
    });

    this.logger.info('Refund reversed', { refundId, reversalId, reason });

    return reversal;
  }

  async getRefundReversal(reversalId: string): Promise<RefundReversal | null> {
    return this.repository.getReversal(reversalId);
  }

  async listRefundReversals(refundId: string): Promise<RefundReversal[]> {
    return this.repository.listRefundReversals(refundId);
  }

  /**
   * BATCH REFUND OPERATIONS
   */

  async createBatchRefund(
    transactionIds: string[],
    reason: RefundReason,
    reasonNotes: string | undefined,
    initiatedBy: string
  ): Promise<BatchRefundOperation> {
    const batchId = this.generateBatchId();
    const batch: BatchRefundOperation = {
      id: batchId,
      transactionIds,
      totalAmount: 0,
      reason,
      reasonNotes,
      initiatedBy,
      status: 'pending',
      completedCount: 0,
      failedCount: 0,
      refunds: [],
      createdAt: new Date(),
    };

    await this.repository.saveBatchOperation(batch);

    this.logger.info('Batch refund created', { batchId, transactionCount: transactionIds.length });

    return batch;
  }

  async processBatchRefund(batchId: string): Promise<BatchRefundOperation> {
    const batch = await this.repository.getBatchOperation(batchId);
    if (!batch) {
      throw new Error(`Batch operation ${batchId} not found`);
    }

    batch.status = 'processing';
    await this.repository.updateBatchOperation(batch);

    // Process each refund
    for (const transactionId of batch.transactionIds) {
      try {
        const refund = await this.createRefund({
          transactionId,
          reason: batch.reason,
          reasonNotes: batch.reasonNotes,
          initiatedBy: batch.initiatedBy,
          metadata: { batchRefundId: batchId },
        });

        batch.refunds.push(refund);
        batch.totalAmount += refund.amount;
        batch.completedCount++;
      } catch (error) {
        this.logger.error(`Failed to process refund in batch ${batchId}`, error);
        batch.failedCount++;
      }
    }

    batch.status = 'completed';
    batch.completedAt = new Date();
    await this.repository.updateBatchOperation(batch);

    this.logger.info('Batch refund completed', {
      batchId,
      completed: batch.completedCount,
      failed: batch.failedCount,
    });

    return batch;
  }

  async getBatchRefund(batchId: string): Promise<BatchRefundOperation | null> {
    return this.repository.getBatchOperation(batchId);
  }

  /**
   * REFUND STATISTICS & ANALYTICS
   */

  async getRefundStatistics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<RefundStatistics> {
    const query: RefundQuery = {
      userId,
      startDate,
      endDate,
      limit: Number.MAX_SAFE_INTEGER,
    };

    const refunds = await this.repository.queryRefunds(query);

    const stats: RefundStatistics = {
      totalRefunds: refunds.length,
      totalAmount: 0,
      refundsByStatus: {} as Record<RefundStatus, number>,
      refundsByReason: {} as Record<RefundReason, number>,
      refundsByType: {} as Record<RefundType, number>,
      refundRate: 0,
      averageRefundAmount: 0,
      averageProcessingTime: 0,
      fullRefundCount: 0,
      partialRefundCount: 0,
      automaticRefundCount: 0,
      manualRefundCount: 0,
      successRate: 0,
      period: {
        startDate: startDate || new Date(0),
        endDate: endDate || new Date(),
      },
    };

    for (const refund of refunds) {
      stats.totalAmount += refund.amount;

      // Count by status
      stats.refundsByStatus[refund.status] = (stats.refundsByStatus[refund.status] || 0) + 1;

      // Count by reason
      stats.refundsByReason[refund.reason] = (stats.refundsByReason[refund.reason] || 0) + 1;

      // Count by type
      stats.refundsByType[refund.type] = (stats.refundsByType[refund.type] || 0) + 1;

      if (refund.type === RefundType.FULL) stats.fullRefundCount++;
      if (refund.type === RefundType.PARTIAL) stats.partialRefundCount++;
      if (refund.type === RefundType.AUTOMATIC) stats.automaticRefundCount++;
      if (refund.type === RefundType.MANUAL) stats.manualRefundCount++;
    }

    if (refunds.length > 0) {
      stats.averageRefundAmount = stats.totalAmount / refunds.length;
      const completedRefunds = refunds.filter((r) => r.status === RefundStatus.COMPLETED).length;
      stats.successRate = (completedRefunds / refunds.length) * 100;
    }

    stats.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalRefunds || 0;

    return stats;
  }

  async getRefundAnalytics(startDate: Date, endDate: Date): Promise<RefundAnalytics> {
    const refunds = await this.repository.queryRefunds({
      startDate,
      endDate,
      limit: Number.MAX_SAFE_INTEGER,
    });

    const analytics: RefundAnalytics = {
      period: { startDate, endDate },
      totalRefunds: refunds.length,
      totalAmount: refunds.reduce((sum, r) => sum + r.amount, 0),
      refundRate: 0,
      topReasons: [],
      trend: [],
      byMethod: {} as any,
      fraudIndicators: {
        suspiciousRefundCount: 0,
        highRiskUserCount: 0,
        duplicateAttempts: 0,
      },
    };

    // Calculate refund rate (would need total payments in production)
    analytics.refundRate = 0; // Placeholder

    // Top reasons
    const reasonCounts = new Map<RefundReason, number>();
    for (const refund of refunds) {
      reasonCounts.set(refund.reason, (reasonCounts.get(refund.reason) || 0) + 1);
    }

    analytics.topReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: (count / refunds.length) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return analytics;
  }

  async calculateRefundRate(startDate: Date, endDate: Date): Promise<number> {
    const refunds = await this.repository.queryRefunds({
      startDate,
      endDate,
      status: RefundStatus.COMPLETED,
      limit: Number.MAX_SAFE_INTEGER,
    });

    // In production, would get total payments for the period
    // For now, return 0 as placeholder
    return 0;
  }

  async getTopRefundReasons(
    limit: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ reason: RefundReason; count: number; percentage: number }>> {
    const refunds = await this.repository.queryRefunds({
      startDate,
      endDate,
      limit: Number.MAX_SAFE_INTEGER,
    });

    const reasonCounts = new Map<RefundReason, number>();
    for (const refund of refunds) {
      reasonCounts.set(refund.reason, (reasonCounts.get(refund.reason) || 0) + 1);
    }

    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: (count / refunds.length) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * FRAUD DETECTION & SECURITY
   */

  async detectFraud(refundId: string): Promise<RefundFraudDetection> {
    const refund = await this.repository.getRefund(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    const flags: FraudFlag[] = [];
    let riskScore = 0;

    // Check refund frequency
    const userRefunds = await this.repository.listUserRefunds(refund.userId);
    const recentRefunds = userRefunds.filter(
      (r) => r.createdAt.getTime() > Date.now() - 86400000
    ).length;

    if (recentRefunds > 5) {
      flags.push({
        type: 'high_frequency',
        severity: 'high',
        description: `${recentRefunds} refunds in last 24 hours`,
        detectedAt: new Date(),
      });
      riskScore += 30;
    }

    // Check amount
    if (refund.amount > 10_000_000) {
      // > 0.1 BTC
      flags.push({
        type: 'large_amount',
        severity: 'medium',
        description: 'Large refund amount',
        detectedAt: new Date(),
      });
      riskScore += 20;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';
    else riskLevel = 'low';

    return {
      refundId: refund.id,
      riskScore,
      riskLevel,
      flags,
      requiresReview: riskScore >= 50,
      blocked: riskScore >= 70,
      reason: flags.length > 0 ? flags.map((f) => f.description).join(', ') : undefined,
    };
  }

  async hasSuspiciousRefundPattern(userId: string): Promise<boolean> {
    const userRefunds = await this.repository.listUserRefunds(userId);
    const recentRefunds = userRefunds.filter(
      (r) => r.createdAt.getTime() > Date.now() - 604800000 // Last 7 days
    );

    return recentRefunds.length > 10; // More than 10 refunds in a week
  }

  async checkRateLimit(userId: string): Promise<{
    exceeded: boolean;
    refundsThisHour: number;
    refundsToday: number;
    amountToday: number;
    nextAllowedAt?: Date;
  }> {
    if (!this.rateLimit.enabled) {
      return {
        exceeded: false,
        refundsThisHour: 0,
        refundsToday: 0,
        amountToday: 0,
      };
    }

    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;

    const userRefunds = await this.repository.listUserRefunds(userId);

    const refundsThisHour = userRefunds.filter((r) => r.createdAt.getTime() > hourAgo).length;
    const refundsToday = userRefunds.filter((r) => r.createdAt.getTime() > dayAgo).length;
    const amountToday = userRefunds
      .filter((r) => r.createdAt.getTime() > dayAgo)
      .reduce((sum, r) => sum + r.amount, 0);

    const exceeded =
      refundsThisHour >= this.rateLimit.maxRefundsPerHour ||
      refundsToday >= this.rateLimit.maxRefundsPerDay ||
      amountToday >= this.rateLimit.maxAmountPerDay;

    return {
      exceeded,
      refundsThisHour,
      refundsToday,
      amountToday,
      nextAllowedAt: exceeded ? new Date(now + this.rateLimit.cooldownPeriod * 1000) : undefined,
    };
  }

  /**
   * IDEMPOTENCY MANAGEMENT
   */

  async checkIdempotency(key: string): Promise<RefundIdempotency | null> {
    const cacheKey = `refund:idempotency:${key}`;
    const cached = await this.cache.get<RefundIdempotency>(cacheKey);
    if (cached) {
      return cached;
    }

    return this.repository.getIdempotency(key);
  }

  async storeIdempotency(key: string, refundId: string, result: RefundResult): Promise<void> {
    const record: RefundIdempotency = {
      key,
      refundId,
      transactionId: result.transactionId,
      status: result.status,
      result,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
    };

    await this.repository.saveIdempotency(record);
    await this.cache.set(`refund:idempotency:${key}`, record, 86400);
  }

  async clearExpiredIdempotency(): Promise<number> {
    return this.repository.clearExpiredIdempotency();
  }

  /**
   * NOTIFICATIONS & WEBHOOKS
   */

  async sendNotification(notification: RefundNotification): Promise<void> {
    // Emit webhook event
    const webhookEvent: RefundWebhookEvent = {
      type: notification.type as RefundWebhookEvent['type'],
      refundId: notification.refundId,
      transactionId: notification.transactionId,
      userId: notification.userId,
      amount: notification.amount,
      status: notification.status,
      reason: notification.reason,
      timestamp: notification.timestamp,
      metadata: notification.metadata,
    };

    await this.notifyWebhookSubscribers(webhookEvent);

    // In production, would also send email/push notifications
    this.logger.info('Refund notification sent', {
      type: notification.type,
      refundId: notification.refundId,
    });
  }

  subscribeToEvents(
    eventType: RefundWebhookEvent['type'],
    callback: (event: RefundWebhookEvent) => void | Promise<void>
  ): string {
    const subscriptionId = `sub-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    this.eventSubscriptions.set(subscriptionId, callback);
    return subscriptionId;
  }

  unsubscribeFromEvents(subscriptionId: string): void {
    this.eventSubscriptions.delete(subscriptionId);
  }

  /**
   * AUTOMATIC REFUNDS
   */

  async processAutomaticRefund(transactionId: string, reason: string): Promise<Refund> {
    return this.createRefund({
      transactionId,
      type: RefundType.AUTOMATIC,
      reason: RefundReason.FAILED_SUBSCRIPTION,
      reasonNotes: reason,
      initiatedBy: 'system',
    });
  }

  async scheduleAutomaticRefund(
    transactionId: string,
    reason: string,
    scheduledFor: Date
  ): Promise<Refund> {
    // In production, would schedule with a job queue
    // For now, create immediately
    return this.processAutomaticRefund(transactionId, reason);
  }

  /**
   * HEALTH & MAINTENANCE
   */

  async healthCheck(): Promise<boolean> {
    try {
      await this.repository.getUserRefundCount('health-check');
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  async getMetrics(): Promise<{
    uptime: number;
    totalRefunds: number;
    successfulRefunds: number;
    failedRefunds: number;
    successRate: number;
    averageProcessingTime: number;
    pendingAuthorizations: number;
  }> {
    const uptime = Date.now() - this.metrics.uptime;
    const successRate =
      this.metrics.totalRefunds > 0
        ? (this.metrics.successfulRefunds / this.metrics.totalRefunds) * 100
        : 0;
    const avgProcessingTime =
      this.metrics.totalRefunds > 0
        ? this.metrics.totalProcessingTime / this.metrics.totalRefunds
        : 0;

    const pendingAuthorizations = await this.repository.getUserRefundCount(
      '*',
      RefundStatus.PENDING
    );

    return {
      uptime,
      totalRefunds: this.metrics.totalRefunds,
      successfulRefunds: this.metrics.successfulRefunds,
      failedRefunds: this.metrics.failedRefunds,
      successRate,
      averageProcessingTime: avgProcessingTime,
      pendingAuthorizations,
    };
  }

  async processPendingRefunds(): Promise<number> {
    const pendingRefunds = await this.repository.queryRefunds({
      status: RefundStatus.AUTHORIZED,
      limit: 100,
    });

    let processed = 0;
    for (const refund of pendingRefunds) {
      try {
        await this.processRefund(refund.id);
        processed++;
      } catch (error) {
        this.logger.error(`Failed to process pending refund ${refund.id}`, error);
      }
    }

    return processed;
  }

  async cleanupExpiredRefunds(): Promise<number> {
    const now = new Date();
    const expiredRefunds = await this.repository.queryRefunds({
      status: RefundStatus.PENDING,
      endDate: now,
      limit: 1000,
    });

    let cleaned = 0;
    for (const refund of expiredRefunds) {
      if (refund.expiresAt && refund.expiresAt < now) {
        try {
          await this.updateRefundStatus(refund.id, RefundStatus.CANCELED, 'Expired', 'system');
          cleaned++;
        } catch (error) {
          this.logger.error(`Failed to cleanup expired refund ${refund.id}`, error);
        }
      }
    }

    return cleaned;
  }

  async dispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.eventSubscriptions.clear();
    this.logger.info('RefundService disposed');
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private generateRefundId(): string {
    return `ref_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateReversalId(): string {
    return `rev_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private async convertToUSD(amount: number, currency: Currency): Promise<number> {
    if (currency === 'USD') {
      return amount;
    }

    try {
      const result = await this.currencyService.convert({
        amount,
        from: currency as unknown as import('../../types/currency').Currency,
        to: 'USD' as unknown as import('../../types/currency').Currency,
      });
      return result.convertedAmount;
    } catch (error) {
      this.logger.error('Failed to convert currency to USD', error);
      // Fallback: assume $50,000/BTC if conversion fails
      if (currency === 'BTC') {
        return (amount * 50000) / 100_000_000; // satoshis to USD
      }
      return 0;
    }
  }

  private async executeRefund(
    refund: Refund,
    transaction: PaymentTransaction
  ): Promise<RefundResult> {
    // Simplified refund execution
    return {
      success: true,
      refundId: refund.id,
      transactionId: refund.transactionId,
      amount: refund.amount,
      status: RefundStatus.COMPLETED,
      method: refund.method,
      fee: refund.feeHandling === 'deducted' ? Math.floor(refund.amount * 0.001) : 0,
      timestamp: new Date(),
    };
  }

  private createRefundError(
    code: string,
    message: string,
    reason: RefundFailureReason,
    retryable: boolean,
    details?: Record<string, any>
  ): RefundError {
    return {
      code,
      message,
      reason,
      retryable,
      details,
    };
  }

  private async cacheRefund(refund: Refund): Promise<void> {
    await this.cache.set(`refund:${refund.id}`, refund, 3600);
  }

  private async emitEvent(type: DomainEventType, aggregateId: string, payload: any): Promise<void> {
    const event = new DomainEventBuilder()
      .withType(type)
      .withAggregateId(aggregateId)
      .withAggregateType('refund')
      .withPayload(payload)
      .withSource('RefundService')
      .build();

    await this.eventBus.publish(event);
  }

  private async notifyWebhookSubscribers(event: RefundWebhookEvent): Promise<void> {
    for (const [, callback] of this.eventSubscriptions) {
      try {
        await callback(event);
      } catch (error) {
        this.logger.error('Webhook notification failed', error);
      }
    }
  }

  private startCleanupProcess(): void {
    // Cleanup expired refunds and idempotency records every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        const expiredRefunds = await this.cleanupExpiredRefunds();
        const expiredIdempotency = await this.clearExpiredIdempotency();
        if (expiredRefunds > 0 || expiredIdempotency > 0) {
          this.logger.info('Cleanup completed', { expiredRefunds, expiredIdempotency });
        }
      } catch (error) {
        this.logger.error('Cleanup process failed', error);
      }
    }, 3600000); // 1 hour
  }
}
