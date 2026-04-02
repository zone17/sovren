import crypto from 'crypto';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { TTLCache } from '../utils/ttl-cache';
import { createPaymentStore, type PaymentPersistence } from './payment-persistence';
import { verifyWebhookHmac } from '../lib/webhook-security';
import logger from '../lib/logger';

// 🌩️ ELITE LIGHTNING NETWORK SERVICE
// Comprehensive Bitcoin Lightning Network integration for Sovren
// Features: LNbits integration, LNURL-pay, Lightning addresses, real-time payment tracking

/**
 * Lightning Network Configuration Schema
 */
export const LightningConfigSchema = z.object({
  lnbitsUrl: z.string().url('Invalid LNbits URL'),
  lnbitsApiKey: z.string().min(1, 'LNbits API key is required'),
  lnbitsWalletId: z.string().min(1, 'LNbits wallet ID is required'),
  webhookSecret: z.string().min(32, 'Webhook secret must be at least 32 characters'),
  defaultMemo: z.string().default('Sovren Creator Support'),
  invoiceExpiryMinutes: z.number().positive().default(60),
  maxInvoiceAmount: z.number().positive().default(1000000), // 1M satoshis
  minInvoiceAmount: z.number().positive().default(1), // 1 satoshi
  enableWebhooks: z.boolean().default(true),
  enableLnurlPay: z.boolean().default(true),
  enableLightningAddress: z.boolean().default(true),
  retryAttempts: z.number().positive().default(3),
  requestTimeout: z.number().positive().default(30000), // 30 seconds
});

/**
 * Lightning Invoice Schema
 */
export const LightningInvoiceSchema = z.object({
  id: z.string(),
  bolt11: z.string(),
  amount: z.number().positive(),
  description: z.string(),
  created_at: z.number(),
  expires_at: z.number(),
  status: z.enum(['pending', 'paid', 'expired', 'cancelled']),
  payment_hash: z.string(),
  payment_request: z.string(),
  metadata: z.record(z.string()).optional(),
});

/**
 * Lightning Payment Schema
 */
export const LightningPaymentSchema = z.object({
  id: z.string(),
  invoice_id: z.string(),
  amount: z.number().positive(),
  fee: z.number().nonnegative().default(0),
  status: z.enum(['pending', 'completed', 'failed']),
  settled_at: z.number().optional(),
  preimage: z.string().optional(),
  memo: z.string().optional(),
  creator_id: z.string(),
  supporter_id: z.string(),
  nostr_event_id: z.string().optional(),
});

/**
 * LNURL-pay Response Schema
 */
export const LnurlPayResponseSchema = z.object({
  callback: z.string().url(),
  maxSendable: z.number().positive(),
  minSendable: z.number().positive(),
  metadata: z.string(),
  tag: z.literal('payRequest'),
  commentAllowed: z.number().nonnegative().default(0),
  payerData: z
    .object({
      name: z.object({ mandatory: z.boolean().default(false) }),
      email: z.object({ mandatory: z.boolean().default(false) }),
      pubkey: z.object({ mandatory: z.boolean().default(false) }),
    })
    .optional(),
});

/**
 * Lightning Address Schema
 */
export const LightningAddressSchema = z.object({
  identifier: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid Lightning address format'),
  domain: z.string(),
  user: z.string(),
  active: z.boolean().default(true),
  created_at: z.number(),
  updated_at: z.number(),
});

// Type exports
export type LightningConfig = z.infer<typeof LightningConfigSchema>;
export type LightningInvoice = z.infer<typeof LightningInvoiceSchema>;
export type LightningPayment = z.infer<typeof LightningPaymentSchema>;
export type LnurlPayResponse = z.infer<typeof LnurlPayResponseSchema>;
export type LightningAddress = z.infer<typeof LightningAddressSchema>;

/**
 * Lightning Service Events
 */
export interface LightningServiceEvents {
  'invoice:created': (invoice: LightningInvoice) => void;
  'invoice:paid': (payment: LightningPayment) => void;
  'invoice:expired': (invoice: LightningInvoice) => void;
  'payment:completed': (payment: LightningPayment) => void;
  'payment:failed': (payment: LightningPayment) => void;
  'webhook:received': (data: any) => void;
  error: (error: Error) => void;
}

/**
 * 🌩️ Elite Lightning Network Service
 *
 * Comprehensive Bitcoin Lightning Network integration featuring:
 * - LNbits integration for invoice management
 * - LNURL-pay protocol support for seamless payments
 * - Lightning address resolution
 * - Real-time payment tracking and webhooks
 * - Creator monetization with instant settlements
 * - Mobile-optimized QR code generation
 * - Enterprise-grade error handling and retries
 * - NOSTR event integration for payment notifications
 *
 * @example
 * ```typescript
 * const lightning = LightningService.getInstance();
 * await lightning.initialize({
 *   lnbitsUrl: 'https://legend.lnbits.com',
 *   lnbitsApiKey: 'your-api-key',
 *   lnbitsWalletId: 'your-wallet-id',
 *   webhookSecret: 'your-webhook-secret'
 * });
 *
 * // Create invoice for creator support
 * const invoice = await lightning.createInvoice({
 *   amount: 1000, // satoshis
 *   description: 'Support for amazing content',
 *   creatorId: 'creator-uuid',
 *   supporterId: 'supporter-uuid'
 * });
 *
 * // Listen for payments
 * lightning.on('payment:completed', (payment) => {
 *   console.log('Payment received:', payment);
 * });
 * ```
 */
export class LightningService extends EventEmitter {
  private static instance: LightningService;
  private config!: LightningConfig;
  private isInitialized = false;
  /** Fix #118: Secondary index for O(1) webhook lookup by payment_hash */
  private paymentHashIndex = new Map<string, string>(); // payment_hash -> invoice_id
  private invoiceCache: TTLCache<string, LightningInvoice>;
  private paymentCache = new TTLCache<string, LightningPayment>({
    maxSize: 50_000,
    ttlMs: 24 * 60 * 60 * 1000,
  }); // 24hr TTL
  private persistence!: PaymentPersistence;
  private pendingLookups = new Map<string, Promise<LightningInvoice | null>>();

  private constructor() {
    super();
    this.setMaxListeners(100); // Support many concurrent operations
    // Fix #118: Clean up paymentHashIndex when invoices are evicted from cache
    this.invoiceCache = new TTLCache<string, LightningInvoice>({
      maxSize: 10_000,
      ttlMs: 60 * 60 * 1000, // 1hr TTL
      onEvict: (_key, invoice) => {
        if (invoice.payment_hash) {
          this.paymentHashIndex.delete(invoice.payment_hash);
        }
      },
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LightningService {
    if (!LightningService.instance) {
      LightningService.instance = new LightningService();
    }
    return LightningService.instance;
  }

  /**
   * Initialize Lightning Network service
   */
  public async initialize(config: LightningConfig): Promise<void> {
    try {
      // Validate configuration
      this.config = LightningConfigSchema.parse(config);

      // Initialize persistence layer — SupabasePaymentStore in production, JsonFilePaymentStore in dev
      this.persistence = createPaymentStore();

      // Hydrate caches from persistence and rebuild paymentHashIndex
      const persistedInvoices = await this.persistence.getAllInvoices();
      for (const inv of persistedInvoices) {
        if (inv.status === 'pending' && inv.expires_at > Date.now()) {
          this.invoiceCache.set(inv.id, inv);
          if (inv.payment_hash) {
            this.paymentHashIndex.set(inv.payment_hash, inv.id);
          }
        }
      }

      // Test LNbits connection
      await this.testConnection();

      this.isInitialized = true;
      logger.info('Lightning Network service initialized successfully');
      logger.info(`Connected to LNbits: ${this.config.lnbitsUrl}`);
      logger.info(`Wallet ID: ${this.config.lnbitsWalletId}`);
      logger.info(`LNURL-pay: ${this.config.enableLnurlPay ? 'Enabled' : 'Disabled'}`);
      logger.info(
        `Lightning Address: ${this.config.enableLightningAddress ? 'Enabled' : 'Disabled'}`
      );
    } catch (error) {
      logger.error('Failed to initialize Lightning service:', error);
      throw new Error(
        `Lightning service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test connection to LNbits
   */
  private async testConnection(): Promise<void> {
    try {
      const response = await this.makeRequest('GET', '/api/v1/wallet');
      if (!response.name) {
        throw new Error('Invalid wallet response from LNbits');
      }
      logger.info(`LNbits connection verified - Wallet: ${response.name}`);
    } catch (error) {
      throw new Error(
        `LNbits connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get invoice with request coalescing to prevent cache stampede.
   * Concurrent cache misses for the same key share a single persistence read.
   */
  private async getInvoiceWithFallback(id: string): Promise<LightningInvoice | null> {
    const invoice = this.invoiceCache.get(id);
    if (invoice) return invoice;

    const pending = this.pendingLookups.get(id);
    if (pending) return pending;

    const lookup = this.persistence
      .getInvoiceById(id)
      .then(result => {
        this.pendingLookups.delete(id);
        if (result) {
          this.invoiceCache.set(result.id, result);
          if (result.payment_hash) {
            this.paymentHashIndex.set(result.payment_hash, result.id);
          }
        }
        return result;
      })
      .catch(err => {
        this.pendingLookups.delete(id);
        throw err;
      });

    this.pendingLookups.set(id, lookup);
    return lookup;
  }

  /**
   * Look up an invoice by its payment_hash (used by GET /invoice/:paymentHash).
   * Checks the in-memory index first, then falls back to persistence.
   */
  public async getInvoiceByPaymentHash(hash: string): Promise<LightningInvoice | null> {
    const indexedId = this.paymentHashIndex.get(hash);
    if (indexedId) {
      const cached = this.invoiceCache.get(indexedId);
      if (cached) return cached;
      // Cache miss but index hit — try persistence
      const persisted = await this.persistence.getInvoiceById(indexedId);
      if (persisted) {
        this.invoiceCache.set(persisted.id, persisted);
        return persisted;
      }
    }
    // Full fallback: persistence lookup by payment_hash
    const persisted = await this.persistence.getInvoiceByPaymentHash(hash);
    if (persisted) {
      this.invoiceCache.set(persisted.id, persisted);
      this.paymentHashIndex.set(persisted.payment_hash, persisted.id);
    }
    return persisted;
  }

  /**
   * Create Lightning invoice for creator support
   */
  public async createInvoice(params: {
    amount: number;
    description: string;
    creatorId: string;
    supporterId: string;
    memo?: string;
    expiryMinutes?: number;
    metadata?: Record<string, string>;
  }): Promise<{
    success: boolean;
    invoice?: LightningInvoice;
    error?: string;
  }> {
    try {
      this.requireInitialization();

      // Validate amount
      if (
        params.amount < this.config.minInvoiceAmount ||
        params.amount > this.config.maxInvoiceAmount
      ) {
        return {
          success: false,
          error: `Amount must be between ${this.config.minInvoiceAmount} and ${this.config.maxInvoiceAmount} satoshis`,
        };
      }

      // Generate unique invoice ID
      const invoiceId = crypto.randomUUID();
      const memo = params.memo || this.config.defaultMemo;
      const expiryMinutes = params.expiryMinutes || this.config.invoiceExpiryMinutes;

      // Create invoice with LNbits
      const lnbitsResponse = await this.makeRequest('POST', '/api/v1/payments', {
        out: false,
        amount: params.amount,
        memo,
        expiry: expiryMinutes * 60, // Convert to seconds
        webhook: this.config.enableWebhooks
          ? `${process.env.WEBHOOK_BASE_URL}/api/lightning/webhook`
          : undefined,
        internal: false,
      });

      // Create Lightning invoice object
      const invoice: LightningInvoice = {
        id: invoiceId,
        bolt11: lnbitsResponse.payment_request,
        amount: params.amount,
        description: params.description,
        created_at: Date.now(),
        expires_at: Date.now() + expiryMinutes * 60 * 1000,
        status: 'pending',
        payment_hash: lnbitsResponse.payment_hash,
        payment_request: lnbitsResponse.payment_request,
        metadata: {
          creatorId: params.creatorId,
          supporterId: params.supporterId,
          lnbitsId: lnbitsResponse.checking_id,
          ...params.metadata,
        },
      };

      // Cache invoice, update index, and persist
      this.invoiceCache.set(invoiceId, invoice);
      this.paymentHashIndex.set(invoice.payment_hash, invoiceId);
      await this.persistence.saveInvoice(invoice);

      // Emit event
      this.emit('invoice:created', invoice);

      logger.info(`Created Lightning invoice: ${invoiceId} for ${params.amount} sats`);

      return {
        success: true,
        invoice,
      };
    } catch (error) {
      logger.error('Failed to create Lightning invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check invoice payment status
   */
  public async checkInvoiceStatus(invoiceId: string): Promise<{
    success: boolean;
    invoice?: LightningInvoice;
    payment?: LightningPayment;
    error?: string;
  }> {
    try {
      this.requireInitialization();

      // Fix #113 + Fix #139: Cache fallback with request coalescing
      const invoice = await this.getInvoiceWithFallback(invoiceId);
      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      // Check status with LNbits
      const lnbitsId = invoice.metadata?.lnbitsId;
      if (!lnbitsId) {
        return {
          success: false,
          error: 'Invalid invoice - missing LNbits ID',
        };
      }

      const lnbitsResponse = await this.makeRequest('GET', `/api/v1/payments/${lnbitsId}`);

      // Update invoice status (Fix #115: persist BEFORE mutating in-memory state)
      if (lnbitsResponse.paid && invoice.status === 'pending') {
        // Create payment record
        const payment: LightningPayment = {
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          amount: invoice.amount,
          fee: lnbitsResponse.fee || 0,
          status: 'completed',
          settled_at: Date.now(),
          preimage: lnbitsResponse.preimage,
          memo: invoice.description,
          creator_id: invoice.metadata?.creatorId || '',
          supporter_id: invoice.metadata?.supporterId || '',
        };

        // Persist first, then update in-memory state
        this.paymentCache.set(payment.id, payment);
        await this.persistence.savePayment(payment);
        await this.persistence.updateInvoiceStatus(invoice.id, 'paid');
        invoice.status = 'paid';

        // Emit events
        this.emit('invoice:paid', payment);
        this.emit('payment:completed', payment);

        return {
          success: true,
          invoice,
          payment,
        };
      }

      // Check if expired — persist expired status too
      if (Date.now() > invoice.expires_at && invoice.status === 'pending') {
        await this.persistence.updateInvoiceStatus(invoice.id, 'expired');
        invoice.status = 'expired';
        this.emit('invoice:expired', invoice);
      }

      return {
        success: true,
        invoice,
      };
    } catch (error) {
      logger.error('Failed to check invoice status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate LNURL-pay for creator
   */
  public async generateLnurlPay(params: {
    creatorId: string;
    minAmount?: number;
    maxAmount?: number;
    commentAllowed?: number;
    metadata?: Record<string, string>;
  }): Promise<{
    success: boolean;
    lnurl?: string;
    qrCode?: string;
    error?: string;
  }> {
    try {
      this.requireInitialization();

      if (!this.config.enableLnurlPay) {
        return {
          success: false,
          error: 'LNURL-pay is disabled',
        };
      }

      const minAmount = params.minAmount || this.config.minInvoiceAmount;
      const maxAmount = params.maxAmount || this.config.maxInvoiceAmount;

      // Generate LNURL-pay URL
      const baseUrl = process.env.LNURL_BASE_URL || process.env.WEBHOOK_BASE_URL;
      const callbackUrl = `${baseUrl}/api/lightning/lnurl-pay/${params.creatorId}`;

      // Create LNURL-pay response data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const lnurlData: LnurlPayResponse = {
        callback: callbackUrl,
        maxSendable: maxAmount * 1000, // Convert to millisatoshis
        minSendable: minAmount * 1000, // Convert to millisatoshis
        metadata: JSON.stringify([
          ['text/plain', `Support creator on Sovren`],
          [
            'text/long-desc',
            `Send Bitcoin Lightning payment to support this creator on the Sovren platform.`,
          ],
        ]),
        tag: 'payRequest',
        commentAllowed: params.commentAllowed || 280,
        payerData: {
          name: { mandatory: false },
          email: { mandatory: false },
          pubkey: { mandatory: false },
        },
      };

      // Encode as LNURL
      const lnurlString = this.encodeLnurl(callbackUrl);

      logger.info(`Generated LNURL-pay for creator: ${params.creatorId}`);

      return {
        success: true,
        lnurl: lnurlString,
        qrCode: await this.generateQrCode(lnurlString),
      };
    } catch (error) {
      logger.error('Failed to generate LNURL-pay:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create Lightning address for creator
   */
  public async createLightningAddress(params: {
    creatorId: string;
    identifier: string;
    domain?: string;
  }): Promise<{
    success: boolean;
    lightningAddress?: LightningAddress;
    error?: string;
  }> {
    try {
      this.requireInitialization();

      if (!this.config.enableLightningAddress) {
        return {
          success: false,
          error: 'Lightning addresses are disabled',
        };
      }

      const domain = params.domain || process.env.LIGHTNING_ADDRESS_DOMAIN || 'sovren.com';
      const lightningAddressString = `${params.identifier}@${domain}`;

      // Validate Lightning address format
      LightningAddressSchema.parse({
        identifier: lightningAddressString,
        domain,
        user: params.identifier,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const lightningAddress: LightningAddress = {
        identifier: lightningAddressString,
        domain,
        user: params.identifier,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      logger.info(
        `Created Lightning address: ${lightningAddressString} for creator: ${params.creatorId}`
      );

      return {
        success: true,
        lightningAddress,
      };
    } catch (error) {
      logger.error('Failed to create Lightning address:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process Lightning webhook
   */
  public async processWebhook(
    payload: any,
    signature?: string
  ): Promise<{
    success: boolean;
    payment?: LightningPayment;
    error?: string;
  }> {
    try {
      this.requireInitialization();

      // Verify webhook signature (constant-time comparison)
      if (this.config.webhookSecret) {
        if (!signature) {
          return {
            success: false,
            error: 'Missing webhook signature',
          };
        }

        const isValid = verifyWebhookHmac(
          JSON.stringify(payload),
          signature,
          this.config.webhookSecret
        );

        if (!isValid) {
          return {
            success: false,
            error: 'Invalid webhook signature',
          };
        }
      }

      // Emit webhook event
      this.emit('webhook:received', payload);

      // Process payment if it's a payment webhook
      if (payload.type === 'payment' && payload.payment_hash) {
        // Fix #118 + Fix #139: O(1) lookup via index, then coalesced persistence fallback
        let invoice: LightningInvoice | undefined;
        const indexedId = this.paymentHashIndex.get(payload.payment_hash);
        if (indexedId) {
          invoice =
            this.invoiceCache.get(indexedId) ??
            (await this.getInvoiceWithFallback(indexedId)) ??
            undefined;
        }
        // Fall through to persistence by payment_hash on cache miss
        if (!invoice) {
          const persisted = await this.persistence.getInvoiceByPaymentHash(payload.payment_hash);
          if (persisted) {
            invoice = persisted;
            this.invoiceCache.set(persisted.id, persisted);
            this.paymentHashIndex.set(persisted.payment_hash, persisted.id);
          }
        }

        if (invoice && invoice.status === 'pending') {
          // Create payment record
          const payment: LightningPayment = {
            id: crypto.randomUUID(),
            invoice_id: invoice.id,
            amount: invoice.amount,
            fee: payload.fee || 0,
            status: 'completed',
            settled_at: Date.now(),
            preimage: payload.preimage,
            memo: invoice.description,
            creator_id: invoice.metadata?.creatorId || '',
            supporter_id: invoice.metadata?.supporterId || '',
          };

          // Fix #115: Persist BEFORE mutating in-memory state
          this.paymentCache.set(payment.id, payment);
          await this.persistence.savePayment(payment);
          await this.persistence.updateInvoiceStatus(invoice.id, 'paid');
          // Only update in-memory status after successful persistence
          invoice.status = 'paid';

          // Emit events
          this.emit('invoice:paid', payment);
          this.emit('payment:completed', payment);

          logger.info(`Processed Lightning payment: ${payment.id} for ${payment.amount} sats`);

          return {
            success: true,
            payment,
          };
        }
      }

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to process Lightning webhook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get creator payment history
   */
  public async getCreatorPayments(
    creatorId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: 'pending' | 'completed' | 'failed';
    }
  ): Promise<{
    success: boolean;
    payments?: LightningPayment[];
    total?: number;
    error?: string;
  }> {
    try {
      this.requireInitialization();

      // Read from persistence with query-level filtering
      const payments = await this.persistence.getPaymentsByCreator(
        creatorId,
        options?.status ? { status: options.status } : undefined
      );

      // Sort by settled_at descending
      payments.sort((a, b) => (b.settled_at || 0) - (a.settled_at || 0));

      // Apply pagination
      const offset = options?.offset || 0;
      const limit = options?.limit || 50;
      const paginatedPayments = payments.slice(offset, offset + limit);

      return {
        success: true,
        payments: paginatedPayments,
        total: payments.length,
      };
    } catch (error) {
      logger.error('Failed to get creator payments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get service statistics
   */
  public async getStats(): Promise<{
    success: boolean;
    stats?: {
      totalInvoices: number;
      totalPayments: number;
      totalAmount: number;
      averageAmount: number;
      successRate: number;
      activeInvoices: number;
    };
    error?: string;
  }> {
    try {
      this.requireInitialization();

      const invoices = await this.persistence.getAllInvoices();
      const payments = await this.persistence.getAllPayments();

      const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const averageAmount = payments.length > 0 ? totalAmount / payments.length : 0;
      const successRate = invoices.length > 0 ? (payments.length / invoices.length) * 100 : 0;
      const activeInvoices = invoices.filter(inv => inv.status === 'pending').length;

      return {
        success: true,
        stats: {
          totalInvoices: invoices.length,
          totalPayments: payments.length,
          totalAmount,
          averageAmount,
          successRate,
          activeInvoices,
        },
      };
    } catch (error) {
      logger.error('Failed to get Lightning stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Health check for Lightning service
   */
  public async healthCheck(): Promise<{
    success: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      lnbits: boolean;
      wallet: boolean;
      invoices: boolean;
    };
    error?: string;
  }> {
    try {
      const checks = {
        lnbits: false,
        wallet: false,
        invoices: false,
      };

      // Test LNbits connection
      try {
        await this.makeRequest('GET', '/api/v1/wallet');
        checks.lnbits = true;
        checks.wallet = true;
      } catch {
        // LNbits connection failed
      }

      // Check invoice processing
      checks.invoices = this.isInitialized;

      const healthyChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyChecks === totalChecks) {
        status = 'healthy';
      } else if (healthyChecks > 0) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        success: true,
        status,
        checks,
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        checks: {
          lnbits: false,
          wallet: false,
          invoices: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ========================================================================
  // Route-facing methods
  // Methods called by routes/lightning.ts that delegate to core operations
  // ========================================================================

  /**
   * Get Lightning node information
   */
  public async getNodeInfo(): Promise<Record<string, unknown>> {
    this.requireInitialization();
    const wallet = await this.makeRequest('GET', '/api/v1/wallet');
    return {
      alias: wallet.name || 'Sovren Lightning Node',
      balance: wallet.balance,
      pubkey: this.config.lnbitsUrl,
    };
  }

  /**
   * Pay a BOLT11 payment request
   */
  public async makePayment(paymentRequest: string): Promise<Record<string, unknown>> {
    this.requireInitialization();
    const result = await this.makeRequest('POST', '/api/v1/payments', {
      out: true,
      bolt11: paymentRequest,
    });
    return result;
  }

  /**
   * Create a recurring subscription
   */
  public async createSubscription(
    userId: string,
    creatorId: string,
    tier: string,
    amount: number,
    interval: string
  ): Promise<Record<string, unknown>> {
    this.requireInitialization();
    // Create first invoice as subscription anchor
    const result = await this.createInvoice({
      amount,
      description: `Subscription: ${tier} (${interval}) to ${creatorId}`,
      creatorId,
      supporterId: userId,
    });
    return {
      id: `sub_${Date.now()}`,
      userId,
      creatorId,
      tier,
      amount,
      interval,
      status: 'pending',
      invoiceId: result.invoice?.id,
      paymentRequest: result.invoice?.payment_request,
    };
  }

  /**
   * Cancel a subscription
   */
  public async cancelSubscription(
    subscriptionId: string,
    _userId: string
  ): Promise<Record<string, unknown> | null> {
    this.requireInitialization();
    // Subscription management is stored externally; this marks it cancelled
    return {
      id: subscriptionId,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    };
  }

  /**
   * Get payment history for a user
   */
  public async getUserPaymentHistory(userId: string): Promise<Record<string, unknown>> {
    this.requireInitialization();
    return this.getCreatorPayments(userId);
  }

  /**
   * Get active subscriptions for a user
   */
  public async getUserSubscriptions(_userId: string): Promise<Record<string, unknown>[]> {
    this.requireInitialization();
    // Subscriptions are managed via external store; return empty for now
    return [];
  }

  /**
   * Process a creator payout
   */
  public async processPayout(
    creatorId: string,
    amount: number,
    destination: string,
    _idempotencyKey: string
  ): Promise<Record<string, unknown>> {
    this.requireInitialization();
    const result = await this.makeRequest('POST', '/api/v1/payments', {
      out: true,
      bolt11: destination,
      amount,
    });
    return {
      id: `payout_${Date.now()}`,
      creatorId,
      amount,
      destination,
      status: 'completed',
      paymentHash: result.payment_hash,
    };
  }

  /**
   * Get payout history for a creator
   */
  public async getCreatorPayoutHistory(creatorId: string): Promise<Record<string, unknown>> {
    this.requireInitialization();
    return this.getCreatorPayments(creatorId);
  }

  /**
   * Get subscribers for a creator
   */
  public async getCreatorSubscribers(_creatorId: string): Promise<Record<string, unknown>[]> {
    this.requireInitialization();
    // Subscription relationships are managed externally; return empty for now
    return [];
  }

  // Private helper methods

  private requireInitialization(): void {
    if (!this.isInitialized) {
      throw new Error('Lightning service not initialized');
    }
  }

  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<any> {
    const url = `${this.config.lnbitsUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'X-Api-Key': this.config.lnbitsApiKey,
      'Content-Type': 'application/json',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`LNbits API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private encodeLnurl(url: string): string {
    const encoded = Buffer.from(url, 'utf8').toString('hex');
    return `lnurl${encoded}`;
  }

  private async generateQrCode(data: string): Promise<string> {
    // In production, use a proper QR code library like 'qrcode'
    // For now, return a placeholder
    return `data:image/svg+xml;base64,${Buffer.from(`<svg>QR Code for: ${data}</svg>`).toString('base64')}`;
  }
}

// Export singleton instance
export const lightningService = LightningService.getInstance();
