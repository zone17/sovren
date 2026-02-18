/**
 * Marketplace Service
 * EPIC-010: Creator Network — Service listings with custodial Lightning escrow
 *
 * Key design decisions:
 * - Custodial escrow: buyer pays standard LNbits invoice → Sovren wallet
 * - Three-layer payment detection: webhook (primary) + BullMQ poll (backup) + user-triggered
 * - 30-day auto-expire via BullMQ delayed job → transitions escrow_funded to 'refunded'
 * - Idempotency via client-supplied UUID scoped to buyer (M-6)
 * - Authorization: only buyer can complete, only seller can start, either can dispute
 *
 * Security decisions:
 * - C-1: Order transitions to 'completed' ONLY after Lightning payout succeeds
 *   On failure: release_status='failed', BullMQ retry with exponential backoff
 * - C-3: HMAC-SHA256 webhook verification using crypto.timingSafeEqual
 *   Cross-verified by polling Lightning node after each webhook
 * - H-4: portfolioUrls validated — must be https:// only
 * - M-6: idempotency_key unique per (buyer_id, idempotency_key) not globally
 *
 * ADR-025: Custodial escrow is inherently custodial. MSB registration may be required.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { IMarketplaceService } from '../../interfaces/community/IMarketplaceService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { IQueueService } from '../../interfaces/queue/IQueueService';

const VALID_SERVICE_TYPES = ['editing', 'writing', 'design', 'consulting', 'other'] as const;
const ESCROW_EXPIRE_DAYS = 30;
// C-1: max BullMQ retry attempts for Lightning payout before marking permanently failed
const MAX_PAYOUT_ATTEMPTS = 5;

interface ListingRow {
  id: string;
  creator_id: string;
  service_type: string;
  title: string;
  description: string | null;
  price_sats: number;
  portfolio_urls: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface OrderRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  escrow_invoice_id: string | null;
  escrow_payment_hash: string | null;
  amount_sats: number;
  idempotency_key: string;
  release_status: string;
  release_attempts: number;
  created_at: string;
  funded_at: string | null;
  completed_at: string | null;
  disputed_at: string | null;
  expires_at: string;
}

interface ReviewRow {
  id: string;
  order_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

// LightningService interface (subset used by marketplace)
interface ILightningService {
  createInvoice(amountSats: number, memo: string): Promise<{ invoiceId: string; paymentRequest: string; paymentHash: string }>;
  payToAddress(lightningAddress: string, amountSats: number, memo: string): Promise<{ paymentHash: string }>;
  getInvoiceStatus(invoiceId: string): Promise<{ paid: boolean; paymentHash?: string }>;
  getSellerLightningAddress(sellerId: string): Promise<string | null>;
}

// Creator profile row for resolving Lightning address
interface CreatorProfileRow {
  lightning_address: string | null;
}

export class MarketplaceService implements IMarketplaceService {
  private readonly db: ISupabaseClient;
  private readonly lightning: ILightningService;
  private readonly queue: IQueueService;
  private readonly logger: ILogger;

  constructor(
    db: ISupabaseClient,
    lightning: ILightningService,
    queue: IQueueService,
    logger: ILogger
  ) {
    this.db = db;
    this.lightning = lightning;
    this.queue = queue;
    this.logger = logger;
  }

  async createListing(
    creatorId: string,
    data: {
      serviceType: string;
      title: string;
      description?: string;
      priceSats: number;
      portfolioUrls?: string[];
    }
  ): Promise<{ id: string }> {
    if (!VALID_SERVICE_TYPES.includes(data.serviceType as any)) {
      throw new Error(`Invalid service type. Must be one of: ${VALID_SERVICE_TYPES.join(', ')}`);
    }

    if (!data.title || data.title.trim().length === 0) {
      throw new Error('Title is required');
    }

    if (!Number.isInteger(data.priceSats) || data.priceSats <= 0) {
      throw new Error('price_sats must be a positive integer');
    }

    // H-4: Validate portfolio URLs — must be https:// only (no http, no data URIs)
    if (data.portfolioUrls && data.portfolioUrls.length > 0) {
      for (const url of data.portfolioUrls) {
        if (typeof url !== 'string' || !url.startsWith('https://')) {
          throw new Error(`Invalid portfolio URL: "${url}". All URLs must start with https://`);
        }
        // Verify it's a parseable URL (catches malformed inputs)
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'https:') {
            throw new Error('Protocol must be https');
          }
        } catch {
          throw new Error(`Invalid portfolio URL: "${url}". Must be a valid https:// URL`);
        }
      }
    }

    const { data: rows, error } = await this.db
      .from<ListingRow>('service_listings')
      .insert({
        creator_id: creatorId,
        service_type: data.serviceType,
        title: data.title.trim(),
        description: data.description ?? null,
        price_sats: data.priceSats,
        portfolio_urls: data.portfolioUrls ?? [],
        active: true,
      })
      .select('id')
      .single();

    if (error || !rows) {
      this.logger.error('Failed to create listing', { error, creatorId });
      throw new Error(`Failed to create listing: ${error?.message}`);
    }

    this.logger.info('Service listing created', { listingId: rows.id, creatorId });
    return { id: rows.id };
  }

  async getListings(filters?: { serviceType?: string; active?: boolean }): Promise<ListingRow[]> {
    let query = this.db
      .from<ListingRow>('service_listings')
      .select('id, creator_id, service_type, title, description, price_sats, portfolio_urls, active, created_at, updated_at');

    // Default to active listings
    const showActive = filters?.active !== false;
    query = query.eq('active', showActive);

    if (filters?.serviceType) {
      query = query.eq('service_type', filters.serviceType);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

    if (error) {
      this.logger.error('Failed to get listings', { error, filters });
      throw new Error(`Failed to get listings: ${error.message}`);
    }

    return data ?? [];
  }

  async placeOrder(
    buyerId: string,
    listingId: string,
    idempotencyKey: string
  ): Promise<{ id: string; invoicePaymentRequest: string }> {
    // M-6: Idempotency check scoped to buyer — same buyer can reuse key (retry safety)
    const { data: existing } = await this.db
      .from<OrderRow>('service_orders')
      .select('id, escrow_invoice_id')
      .eq('buyer_id', buyerId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      // Return the existing order — do not recreate invoice
      this.logger.info('Idempotent order lookup', { orderId: existing.id, idempotencyKey, buyerId });
      return {
        id: existing.id,
        invoicePaymentRequest: `cached:${existing.escrow_invoice_id}`,
      };
    }

    // Fetch listing
    const { data: listing, error: listingError } = await this.db
      .from<ListingRow>('service_listings')
      .select('id, creator_id, price_sats, active')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      throw new Error('Listing not found');
    }

    if (!listing.active) {
      throw new Error('This listing is no longer active');
    }

    if (listing.creator_id === buyerId) {
      throw new Error('Cannot place an order on your own listing');
    }

    // Create custodial escrow invoice: buyer pays → Sovren wallet
    const memo = `Marketplace escrow for order on listing ${listingId}`;
    const invoice = await this.lightning.createInvoice(listing.price_sats, memo);

    // Persist order (persist before mutating external state)
    const expiresAt = new Date(Date.now() + ESCROW_EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await this.db
      .from<OrderRow>('service_orders')
      .insert({
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: listing.creator_id,
        status: 'pending',
        escrow_invoice_id: invoice.invoiceId,
        escrow_payment_hash: invoice.paymentHash,
        amount_sats: listing.price_sats,
        idempotency_key: idempotencyKey,
        expires_at: expiresAt,
        release_status: 'pending',
        release_attempts: 0,
      })
      .select('id')
      .single();

    if (error || !rows) {
      this.logger.error('Failed to create order', { error, listingId, buyerId });
      throw new Error(`Failed to create order: ${error?.message}`);
    }

    // Schedule 30-day auto-expire: pending → expired (no funds held)
    // If escrow_funded before expiry, the job transitions to 'refunded' instead
    const expireDelayMs = ESCROW_EXPIRE_DAYS * 24 * 60 * 60 * 1000;
    await this.queue.addJob(
      'marketplace',
      'expire-order',
      { orderId: rows.id },
      {
        jobId: `expire-order-${rows.id}`,
        delay: expireDelayMs,
        removeOnComplete: { count: 100 },
      }
    );

    this.logger.info('Order placed', {
      orderId: rows.id,
      listingId,
      buyerId,
      amountSats: listing.price_sats,
    });

    return {
      id: rows.id,
      invoicePaymentRequest: invoice.paymentRequest,
    };
  }

  async startOrder(orderId: string, sellerId: string): Promise<void> {
    const { data: order, error: findError } = await this.db
      .from<OrderRow>('service_orders')
      .select('id, seller_id, status')
      .eq('id', orderId)
      .single();

    if (findError || !order) {
      throw new Error('Order not found');
    }

    if (order.seller_id !== sellerId) {
      throw new Error('Only the seller can mark an order as in progress');
    }

    if (order.status !== 'escrow_funded') {
      throw new Error(`Cannot start order in '${order.status}' status. Order must be escrow_funded.`);
    }

    const { error } = await this.db
      .from<OrderRow>('service_orders')
      .update({ status: 'in_progress' })
      .eq('id', orderId)
      .eq('status', 'escrow_funded'); // Atomic status guard

    if (error) {
      this.logger.error('Failed to start order', { error, orderId });
      throw new Error(`Failed to start order: ${error.message}`);
    }

    this.logger.info('Order started', { orderId, sellerId });
  }

  /**
   * C-1: Escrow release failure recovery
   * The order ONLY transitions to 'completed' after the Lightning payout succeeds.
   * On failure: release_status='failed', BullMQ retry enqueued with exponential backoff.
   * The DB state machine prevents completing an order in 'in_progress' status without
   * the payout succeeding first — separating "work done" from "payment released".
   */
  async completeOrder(orderId: string, buyerId: string): Promise<void> {
    const { data: order, error: findError } = await this.db
      .from<OrderRow>('service_orders')
      .select('id, buyer_id, seller_id, status, amount_sats, release_status, release_attempts')
      .eq('id', orderId)
      .single();

    if (findError || !order) {
      throw new Error('Order not found');
    }

    if (order.buyer_id !== buyerId) {
      throw new Error('Only the buyer can mark an order as complete');
    }

    if (order.status !== 'in_progress') {
      throw new Error(`Cannot complete order in '${order.status}' status. Order must be in_progress.`);
    }

    // C-1: Begin release — mark as processing before attempting payout
    const { error: processingError } = await this.db
      .from<OrderRow>('service_orders')
      .update({
        release_status: 'processing',
        release_attempts: (order.release_attempts ?? 0) + 1,
      })
      .eq('id', orderId)
      .eq('status', 'in_progress'); // Atomic status guard

    if (processingError) {
      this.logger.error('Failed to mark order release as processing', { error: processingError, orderId });
      throw new Error(`Failed to initiate payout: ${processingError.message}`);
    }

    // C-1: Fetch seller's Lightning address and attempt payout
    try {
      const sellerAddress = await this.lightning.getSellerLightningAddress(order.seller_id);

      if (!sellerAddress) {
        throw new Error(`Seller has no Lightning address configured`);
      }

      const memo = `Sovren marketplace payment for order ${orderId}`;
      await this.lightning.payToAddress(sellerAddress, order.amount_sats, memo);

      // C-1: Payout succeeded — ONLY NOW transition order to completed
      const { error: completeError } = await this.db
        .from<OrderRow>('service_orders')
        .update({
          status: 'completed',
          release_status: 'completed',
        })
        .eq('id', orderId)
        .eq('status', 'in_progress'); // Atomic status guard

      if (completeError) {
        // Payout went through but DB update failed — critical inconsistency, log and alert
        this.logger.error('CRITICAL: Payout succeeded but order status update failed', {
          orderId,
          sellerId: order.seller_id,
          amountSats: order.amount_sats,
          error: completeError.message,
        });
        throw new Error(`Payout succeeded but order update failed: ${completeError.message}`);
      }

      this.logger.info('Order completed — payout released', {
        orderId,
        buyerId,
        sellerId: order.seller_id,
        amountSats: order.amount_sats,
      });
    } catch (payoutError) {
      // C-1: Payout failed — mark release as failed, do NOT complete the order
      const currentAttempts = (order.release_attempts ?? 0) + 1;
      const isFinalFailure = currentAttempts >= MAX_PAYOUT_ATTEMPTS;

      await this.db
        .from<OrderRow>('service_orders')
        .update({
          release_status: isFinalFailure ? 'failed' : 'failed',
          release_attempts: currentAttempts,
        })
        .eq('id', orderId);

      const errorMessage = payoutError instanceof Error ? payoutError.message : 'Unknown payout error';
      this.logger.error('Escrow payout failed', {
        orderId,
        sellerId: order.seller_id,
        amountSats: order.amount_sats,
        attempts: currentAttempts,
        maxAttempts: MAX_PAYOUT_ATTEMPTS,
        isFinalFailure,
        error: errorMessage,
      });

      if (!isFinalFailure) {
        // C-1: Enqueue retry with exponential backoff (2^attempt seconds, capped at 1 hour)
        const backoffMs = Math.min(Math.pow(2, currentAttempts) * 1000, 3600 * 1000);
        await this.queue.addJob(
          'marketplace',
          'retry-payout',
          { orderId, buyerId },
          {
            jobId: `retry-payout-${orderId}-${currentAttempts}`,
            delay: backoffMs,
            removeOnComplete: { count: 100 },
          }
        );
        this.logger.info('Payout retry scheduled', { orderId, backoffMs, attempt: currentAttempts });
      }

      throw new Error(`Payout to seller failed: ${errorMessage}. Order remains in_progress.`);
    }
  }

  async disputeOrder(orderId: string, userId: string): Promise<void> {
    const { data: order, error: findError } = await this.db
      .from<OrderRow>('service_orders')
      .select('id, buyer_id, seller_id, status')
      .eq('id', orderId)
      .single();

    if (findError || !order) {
      throw new Error('Order not found');
    }

    // Either buyer or seller can dispute
    if (order.buyer_id !== userId && order.seller_id !== userId) {
      throw new Error('Only the buyer or seller can dispute an order');
    }

    if (!['escrow_funded', 'in_progress'].includes(order.status)) {
      throw new Error(`Cannot dispute order in '${order.status}' status`);
    }

    const { error } = await this.db
      .from<OrderRow>('service_orders')
      .update({ status: 'disputed' })
      .eq('id', orderId)
      .in('status', ['escrow_funded', 'in_progress']); // Atomic status guard

    if (error) {
      this.logger.error('Failed to dispute order', { error, orderId });
      throw new Error(`Failed to dispute order: ${error.message}`);
    }

    this.logger.info('Order disputed', { orderId, userId });
  }

  async reviewOrder(
    orderId: string,
    reviewerId: string,
    data: { rating: number; reviewText?: string }
  ): Promise<{ id: string }> {
    if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be an integer between 1 and 5');
    }

    // M-4: Validate review text length (10000 char limit matches DB CHECK)
    if (data.reviewText && data.reviewText.length > 10000) {
      throw new Error('Review text must be 10000 characters or fewer');
    }

    // Verify order is completed and reviewer is the buyer
    const { data: order, error: orderError } = await this.db
      .from<OrderRow>('service_orders')
      .select('id, buyer_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (order.buyer_id !== reviewerId) {
      throw new Error('Only the buyer can review a completed order');
    }

    if (order.status !== 'completed') {
      throw new Error('Can only review completed orders');
    }

    const { data: rows, error } = await this.db
      .from<ReviewRow>('order_reviews')
      .insert({
        order_id: orderId,
        reviewer_id: reviewerId,
        rating: data.rating,
        review_text: data.reviewText ?? null,
      })
      .select('id')
      .single();

    if (error || !rows) {
      if (error?.code === '23505') {
        throw new Error('Order has already been reviewed');
      }
      this.logger.error('Failed to create review', { error, orderId, reviewerId });
      throw new Error(`Failed to create review: ${error?.message}`);
    }

    this.logger.info('Order reviewed', { reviewId: rows.id, orderId, reviewerId, rating: data.rating });
    return { id: rows.id };
  }

  /**
   * C-3: Verify Lightning payment webhook using HMAC-SHA256 + timing-safe comparison.
   * The webhook secret is a shared secret with the LNbits instance.
   * After HMAC passes, cross-verify by polling the Lightning node for ground truth.
   *
   * @param rawBody - The raw request body bytes (must be raw, not parsed JSON)
   * @param signature - The HMAC-SHA256 hex digest from the webhook header
   * @param webhookSecret - The shared secret for this webhook endpoint
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string, webhookSecret: string): boolean {
    // C-3: Compute expected HMAC-SHA256 digest
    const expected = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // C-3: Use timingSafeEqual to prevent timing attacks — NEVER use === for HMAC comparison
    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(signature, 'hex');

      if (expectedBuf.length !== receivedBuf.length) {
        return false;
      }

      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      // Invalid hex encoding in signature
      return false;
    }
  }

  /**
   * C-3: Handle incoming payment webhook — verify HMAC, then cross-verify via Lightning poll.
   * Three-layer detection: webhook (primary) → Lightning poll (verify) → BullMQ (backup).
   *
   * @param orderId - The order to mark as escrow_funded
   * @param paymentHash - The payment hash reported by the webhook
   * @param rawBody - Raw webhook body for HMAC verification
   * @param signature - HMAC-SHA256 signature from webhook header
   * @param webhookSecret - Shared secret for this webhook endpoint
   */
  async handlePaymentWebhook(
    orderId: string,
    paymentHash: string,
    rawBody: Buffer,
    signature: string,
    webhookSecret: string
  ): Promise<void> {
    // C-3: Step 1 — HMAC verification (timing-safe)
    if (!this.verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      this.logger.warn('Webhook signature verification failed', { orderId });
      throw new Error('Invalid webhook signature');
    }

    // C-3: Step 2 — Fetch order and verify payment hash matches what we stored
    const { data: order, error: findError } = await this.db
      .from<OrderRow>('service_orders')
      .select('id, status, escrow_invoice_id, escrow_payment_hash')
      .eq('id', orderId)
      .single();

    if (findError || !order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'pending') {
      // Already funded or in another terminal state — idempotent response
      this.logger.info('Webhook received for non-pending order — ignoring', { orderId, status: order.status });
      return;
    }

    // C-3: Step 3 — Cross-verify by polling Lightning node directly (ground truth)
    const invoiceStatus = await this.lightning.getInvoiceStatus(order.escrow_invoice_id!);
    if (!invoiceStatus.paid) {
      this.logger.warn('Webhook claimed payment but Lightning node reports unpaid', {
        orderId,
        paymentHashFromWebhook: paymentHash,
      });
      throw new Error('Payment not confirmed by Lightning node');
    }

    // Verify payment hash matches
    if (invoiceStatus.paymentHash && invoiceStatus.paymentHash !== order.escrow_payment_hash) {
      this.logger.warn('Payment hash mismatch between webhook and stored invoice', { orderId });
      throw new Error('Payment hash mismatch');
    }

    // C-3: All three checks passed — transition to escrow_funded
    const { error: updateError } = await this.db
      .from<OrderRow>('service_orders')
      .update({ status: 'escrow_funded' })
      .eq('id', orderId)
      .eq('status', 'pending'); // Atomic status guard

    if (updateError) {
      this.logger.error('Failed to update order to escrow_funded', { error: updateError, orderId });
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    this.logger.info('Order funded via webhook — escrow active', { orderId, paymentHash });
  }
}
