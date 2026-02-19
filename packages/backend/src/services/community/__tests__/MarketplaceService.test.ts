/**
 * Tests for MarketplaceService
 * EPIC-010: Community Services — Custodial Lightning escrow lifecycle
 *
 * Coverage targets:
 * - createListing: serviceType validation, title validation, priceSats validation,
 *   DB error, success
 * - getListings: no filters, serviceType filter, active filter, DB error, empty
 * - placeOrder: idempotency key (hit/miss), listing not found, inactive listing,
 *   self-order guard, lightning invoice creation, queue scheduling, DB error
 * - startOrder: seller-only auth, wrong status (pending, completed, disputed),
 *   not found, DB error, success
 * - completeOrder: buyer-only auth, wrong status (pending, escrow_funded, disputed),
 *   not found, DB error, success + payout log
 * - disputeOrder: buyer can dispute, seller can dispute, third-party blocked,
 *   wrong status (pending, completed), not found, DB error
 * - reviewOrder: rating out of range (0, 6, float), buyer-only auth,
 *   order must be completed, duplicate review (code 23505), DB error, success
 */

import { MarketplaceService } from '../MarketplaceService';

// ---------------------------------------------------------------------------
// Supabase mock-chain factory
// ---------------------------------------------------------------------------
function makeChain(leafResolvedValue: { data: any; error: any; count?: number | null }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(leafResolvedValue),
    maybeSingle: jest.fn().mockResolvedValue(leafResolvedValue),
  };
  chain.then = (res: any, rej: any) => Promise.resolve(leafResolvedValue).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(leafResolvedValue).catch(fn);
  return chain;
}

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let mockDb: any;
  let mockLightning: any;
  let mockQueue: any;
  let mockLogger: any;

  const SELLER_ID = 'seller-creator';
  const BUYER_ID = 'buyer-creator';
  const LISTING_ID = 'listing-uuid';
  const ORDER_ID = 'order-uuid';
  const IDEMPOTENCY_KEY = 'idem-key-uuid-abc';

  const DEFAULT_INVOICE = {
    invoiceId: 'lnbits-invoice-123',
    paymentRequest: 'lnbc500n1...',
    paymentHash: 'abc123hash',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockLightning = {
      createInvoice: jest.fn().mockResolvedValue(DEFAULT_INVOICE),
      payToAddress: jest.fn().mockResolvedValue({ paymentHash: 'payout-hash' }),
      getInvoiceStatus: jest.fn().mockResolvedValue({ paid: false }),
      getSellerLightningAddress: jest.fn().mockResolvedValue('seller@ln.example.com'),
    };

    mockQueue = {
      addJob: jest.fn().mockResolvedValue('job-id'),
      createQueue: jest.fn(),
      registerProcessor: jest.fn(),
      getQueueNames: jest.fn().mockReturnValue([]),
      isHealthy: jest.fn().mockResolvedValue(true),
      closeAll: jest.fn().mockResolvedValue(undefined),
    };

    mockDb = { from: jest.fn() };
    service = new MarketplaceService(mockDb, mockLightning, mockQueue, mockLogger);
  });

  // -------------------------------------------------------------------------
  // createListing
  // -------------------------------------------------------------------------
  describe('createListing', () => {
    it('creates a listing with all valid fields', async () => {
      const insertChain = makeChain({ data: { id: 'listing-new' }, error: null });
      mockDb.from.mockReturnValueOnce(insertChain);

      const result = await service.createListing(SELLER_ID, {
        serviceType: 'editing',
        title: 'Professional Video Editing',
        description: 'I edit your videos',
        priceSats: 10000,
        portfolioUrls: ['https://example.com/portfolio'],
      });

      expect(result).toEqual({ id: 'listing-new' });
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: SELLER_ID,
          service_type: 'editing',
          title: 'Professional Video Editing',
          price_sats: 10000,
          active: true,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Service listing created',
        expect.objectContaining({ listingId: 'listing-new', creatorId: SELLER_ID })
      );
    });

    it('trims whitespace from title before saving', async () => {
      const insertChain = makeChain({ data: { id: 'trimmed-listing' }, error: null });
      mockDb.from.mockReturnValueOnce(insertChain);

      await service.createListing(SELLER_ID, {
        serviceType: 'writing',
        title: '  Ghost Writing  ',
        priceSats: 5000,
      });

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Ghost Writing' })
      );
    });

    it.each(['editing', 'writing', 'design', 'consulting', 'other'])(
      'accepts valid service type: %s',
      async (serviceType) => {
        const insertChain = makeChain({ data: { id: `listing-${serviceType}` }, error: null });
        mockDb.from.mockReturnValueOnce(insertChain);

        const result = await service.createListing(SELLER_ID, {
          serviceType,
          title: 'Test',
          priceSats: 1000,
        });

        expect(result.id).toBeDefined();
      }
    );

    it('throws when service type is invalid', async () => {
      await expect(
        service.createListing(SELLER_ID, {
          serviceType: 'massage',
          title: 'Test',
          priceSats: 1000,
        })
      ).rejects.toThrow('Invalid service type');
    });

    it('throws when title is empty', async () => {
      await expect(
        service.createListing(SELLER_ID, {
          serviceType: 'editing',
          title: '',
          priceSats: 1000,
        })
      ).rejects.toThrow('Title is required');
    });

    it('throws when title is only whitespace', async () => {
      await expect(
        service.createListing(SELLER_ID, {
          serviceType: 'editing',
          title: '   ',
          priceSats: 1000,
        })
      ).rejects.toThrow('Title is required');
    });

    it('throws when priceSats is zero', async () => {
      await expect(
        service.createListing(SELLER_ID, {
          serviceType: 'editing',
          title: 'Test',
          priceSats: 0,
        })
      ).rejects.toThrow('price_sats must be a positive integer');
    });

    it('throws when priceSats is negative', async () => {
      await expect(
        service.createListing(SELLER_ID, {
          serviceType: 'editing',
          title: 'Test',
          priceSats: -100,
        })
      ).rejects.toThrow('price_sats must be a positive integer');
    });

    it('throws when priceSats is a float', async () => {
      await expect(
        service.createListing(SELLER_ID, {
          serviceType: 'editing',
          title: 'Test',
          priceSats: 100.5,
        })
      ).rejects.toThrow('price_sats must be a positive integer');
    });

    it('throws and logs when the DB insert fails', async () => {
      const dbError = { message: 'insert failed' };
      const insertChain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValueOnce(insertChain);

      await expect(
        service.createListing(SELLER_ID, {
          serviceType: 'design',
          title: 'Logo Design',
          priceSats: 5000,
        })
      ).rejects.toThrow('Failed to create listing: insert failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create listing',
        expect.objectContaining({ error: dbError, creatorId: SELLER_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getListings
  // -------------------------------------------------------------------------
  describe('getListings', () => {
    it('returns active listings by default', async () => {
      const listings = [{ id: 'l1', active: true, service_type: 'editing' }];
      const chain = makeChain({ data: listings, error: null, count: 1 });
      mockDb.from.mockReturnValueOnce(chain);

      const result = await service.getListings();

      expect(result).toEqual({ items: listings, total: 1 });
      expect(chain.eq).toHaveBeenCalledWith('active', true);
    });

    it('applies serviceType filter when provided', async () => {
      const chain = makeChain({ data: [], error: null, count: 0 });
      mockDb.from.mockReturnValueOnce(chain);

      await service.getListings({ serviceType: 'design' });

      expect(chain.eq).toHaveBeenCalledWith('service_type', 'design');
    });

    it('queries inactive listings when active=false', async () => {
      const chain = makeChain({ data: [], error: null, count: 0 });
      mockDb.from.mockReturnValueOnce(chain);

      await service.getListings({ active: false });

      expect(chain.eq).toHaveBeenCalledWith('active', false);
    });

    it('returns empty result when no listings exist', async () => {
      const chain = makeChain({ data: null, error: null, count: 0 });
      mockDb.from.mockReturnValueOnce(chain);

      const result = await service.getListings();
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('throws and logs when the DB query fails', async () => {
      const dbError = { message: 'query failed' };
      const chain = makeChain({ data: null, error: dbError });
      mockDb.from.mockReturnValueOnce(chain);

      await expect(service.getListings()).rejects.toThrow('Failed to get listings: query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get listings',
        expect.objectContaining({ error: dbError })
      );
    });
  });

  // -------------------------------------------------------------------------
  // placeOrder
  // -------------------------------------------------------------------------
  describe('placeOrder', () => {
    it('returns cached order when idempotency key already exists', async () => {
      const idemChain = makeChain({
        data: { id: 'existing-order', escrow_invoice_id: 'cached-invoice' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(idemChain);

      const result = await service.placeOrder(BUYER_ID, LISTING_ID, IDEMPOTENCY_KEY);

      expect(result).toEqual({
        id: 'existing-order',
        invoicePaymentRequest: 'cached:cached-invoice',
      });
      expect(mockLightning.createInvoice).not.toHaveBeenCalled();
      expect(mockQueue.addJob).not.toHaveBeenCalled();
    });

    it('creates a new order and invoice when idempotency key is new', async () => {
      const idemChain = makeChain({ data: null, error: null }); // no existing order
      const listingChain = makeChain({
        data: { id: LISTING_ID, creator_id: SELLER_ID, price_sats: 5000, active: true },
        error: null,
      });
      const insertChain = makeChain({ data: { id: ORDER_ID }, error: null });

      mockDb.from
        .mockReturnValueOnce(idemChain)
        .mockReturnValueOnce(listingChain)
        .mockReturnValueOnce(insertChain);

      const result = await service.placeOrder(BUYER_ID, LISTING_ID, IDEMPOTENCY_KEY);

      expect(result).toEqual({
        id: ORDER_ID,
        invoicePaymentRequest: DEFAULT_INVOICE.paymentRequest,
      });
      expect(mockLightning.createInvoice).toHaveBeenCalledWith(5000, expect.any(String));
      expect(mockQueue.addJob).toHaveBeenCalledWith(
        'marketplace',
        'expire-order',
        { orderId: ORDER_ID },
        expect.objectContaining({
          jobId: `expire-order-${ORDER_ID}`,
          delay: 30 * 24 * 60 * 60 * 1000,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Order placed',
        expect.objectContaining({ orderId: ORDER_ID, listingId: LISTING_ID, buyerId: BUYER_ID })
      );
    });

    it('throws when the listing is not found', async () => {
      const idemChain = makeChain({ data: null, error: null });
      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });

      mockDb.from.mockReturnValueOnce(idemChain).mockReturnValueOnce(notFoundChain);

      await expect(service.placeOrder(BUYER_ID, LISTING_ID, IDEMPOTENCY_KEY)).rejects.toThrow(
        'Listing not found'
      );
    });

    it('throws when the listing is inactive', async () => {
      const idemChain = makeChain({ data: null, error: null });
      const listingChain = makeChain({
        data: { id: LISTING_ID, creator_id: SELLER_ID, price_sats: 5000, active: false },
        error: null,
      });

      mockDb.from.mockReturnValueOnce(idemChain).mockReturnValueOnce(listingChain);

      await expect(service.placeOrder(BUYER_ID, LISTING_ID, IDEMPOTENCY_KEY)).rejects.toThrow(
        'This listing is no longer active'
      );
    });

    it('throws when buyer tries to purchase their own listing', async () => {
      const idemChain = makeChain({ data: null, error: null });
      const listingChain = makeChain({
        data: { id: LISTING_ID, creator_id: BUYER_ID, price_sats: 5000, active: true },
        error: null,
      });

      mockDb.from.mockReturnValueOnce(idemChain).mockReturnValueOnce(listingChain);

      await expect(service.placeOrder(BUYER_ID, LISTING_ID, IDEMPOTENCY_KEY)).rejects.toThrow(
        'Cannot place an order on your own listing'
      );
    });

    it('throws and logs when the DB insert fails after invoice creation', async () => {
      const idemChain = makeChain({ data: null, error: null });
      const listingChain = makeChain({
        data: { id: LISTING_ID, creator_id: SELLER_ID, price_sats: 5000, active: true },
        error: null,
      });
      const dbError = { message: 'insert failed' };
      const insertChain = makeChain({ data: null, error: dbError });

      mockDb.from
        .mockReturnValueOnce(idemChain)
        .mockReturnValueOnce(listingChain)
        .mockReturnValueOnce(insertChain);

      await expect(service.placeOrder(BUYER_ID, LISTING_ID, IDEMPOTENCY_KEY)).rejects.toThrow(
        'Failed to create order: insert failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create order',
        expect.objectContaining({ error: dbError, listingId: LISTING_ID, buyerId: BUYER_ID })
      );
    });

    it('persists order with correct seller_id from listing', async () => {
      const idemChain = makeChain({ data: null, error: null });
      const listingChain = makeChain({
        data: { id: LISTING_ID, creator_id: SELLER_ID, price_sats: 2000, active: true },
        error: null,
      });
      const insertChain = makeChain({ data: { id: ORDER_ID }, error: null });

      mockDb.from
        .mockReturnValueOnce(idemChain)
        .mockReturnValueOnce(listingChain)
        .mockReturnValueOnce(insertChain);

      await service.placeOrder(BUYER_ID, LISTING_ID, IDEMPOTENCY_KEY);

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          buyer_id: BUYER_ID,
          seller_id: SELLER_ID,
          status: 'pending',
          idempotency_key: IDEMPOTENCY_KEY,
          escrow_invoice_id: DEFAULT_INVOICE.invoiceId,
          escrow_payment_hash: DEFAULT_INVOICE.paymentHash,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // startOrder
  // -------------------------------------------------------------------------
  describe('startOrder', () => {
    it('allows the seller to start an escrow_funded order', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, seller_id: SELLER_ID, status: 'escrow_funded' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(service.startOrder(ORDER_ID, SELLER_ID)).resolves.toBeUndefined();

      expect(updateChain.update).toHaveBeenCalledWith({ status: 'in_progress' });
      expect(updateChain.eq).toHaveBeenCalledWith('status', 'escrow_funded');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Order started',
        expect.objectContaining({ orderId: ORDER_ID, sellerId: SELLER_ID })
      );
    });

    it('throws when order is not found', async () => {
      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(service.startOrder(ORDER_ID, SELLER_ID)).rejects.toThrow('Order not found');
    });

    it('throws when requester is not the seller', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, seller_id: SELLER_ID, status: 'escrow_funded' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.startOrder(ORDER_ID, BUYER_ID)).rejects.toThrow(
        'Only the seller can mark an order as in progress'
      );
    });

    it('throws when order is in "pending" status', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, seller_id: SELLER_ID, status: 'pending' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.startOrder(ORDER_ID, SELLER_ID)).rejects.toThrow(
        "Cannot start order in 'pending' status. Order must be escrow_funded."
      );
    });

    it('throws when order is already in "in_progress" status', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, seller_id: SELLER_ID, status: 'in_progress' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.startOrder(ORDER_ID, SELLER_ID)).rejects.toThrow(
        "Cannot start order in 'in_progress' status"
      );
    });

    it('throws when order is in "completed" status', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, seller_id: SELLER_ID, status: 'completed' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.startOrder(ORDER_ID, SELLER_ID)).rejects.toThrow(
        "Cannot start order in 'completed' status"
      );
    });

    it('throws and logs when the DB update fails', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, seller_id: SELLER_ID, status: 'escrow_funded' },
        error: null,
      });
      const dbError = { message: 'update failed' };
      const updateChain = makeChain({ data: null, error: dbError });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(service.startOrder(ORDER_ID, SELLER_ID)).rejects.toThrow(
        'Failed to start order: update failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start order',
        expect.objectContaining({ error: dbError, orderId: ORDER_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // completeOrder
  // -------------------------------------------------------------------------
  describe('completeOrder', () => {
    it('allows the buyer to complete an in_progress order', async () => {
      const findChain = makeChain({
        data: {
          id: ORDER_ID,
          buyer_id: BUYER_ID,
          seller_id: SELLER_ID,
          status: 'in_progress',
          amount_sats: 5000,
          release_status: 'pending',
          release_attempts: 0,
        },
        error: null,
      });
      // Atomic guard: returns updated row (processing lock acquired)
      const guardChain = makeChain({ data: [{ id: ORDER_ID }], error: null });
      // Final status update
      const completeChain = makeChain({ data: null, error: null });

      mockDb.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(guardChain)
        .mockReturnValueOnce(completeChain);

      await expect(service.completeOrder(ORDER_ID, BUYER_ID)).resolves.toBeUndefined();

      expect(guardChain.update).toHaveBeenCalledWith({
        release_status: 'processing',
        release_attempts: 1,
      });
      expect(completeChain.update).toHaveBeenCalledWith({
        status: 'completed',
        release_status: 'completed',
      });
    });

    it('logs payout intent on completion', async () => {
      const findChain = makeChain({
        data: {
          id: ORDER_ID,
          buyer_id: BUYER_ID,
          seller_id: SELLER_ID,
          status: 'in_progress',
          amount_sats: 5000,
          release_status: 'pending',
          release_attempts: 0,
        },
        error: null,
      });
      const guardChain = makeChain({ data: [{ id: ORDER_ID }], error: null });
      const completeChain = makeChain({ data: null, error: null });

      mockDb.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(guardChain)
        .mockReturnValueOnce(completeChain);

      await service.completeOrder(ORDER_ID, BUYER_ID);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Order completed — payout released',
        expect.objectContaining({
          orderId: ORDER_ID,
          buyerId: BUYER_ID,
          sellerId: SELLER_ID,
          amountSats: 5000,
        })
      );
    });

    it('throws when order is not found', async () => {
      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(service.completeOrder(ORDER_ID, BUYER_ID)).rejects.toThrow('Order not found');
    });

    it('throws when requester is not the buyer', async () => {
      const findChain = makeChain({
        data: {
          id: ORDER_ID,
          buyer_id: BUYER_ID,
          seller_id: SELLER_ID,
          status: 'in_progress',
          amount_sats: 5000,
        },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.completeOrder(ORDER_ID, SELLER_ID)).rejects.toThrow(
        'Only the buyer can mark an order as complete'
      );
    });

    it('throws when order is in "pending" status', async () => {
      const findChain = makeChain({
        data: {
          id: ORDER_ID,
          buyer_id: BUYER_ID,
          seller_id: SELLER_ID,
          status: 'pending',
          amount_sats: 5000,
        },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.completeOrder(ORDER_ID, BUYER_ID)).rejects.toThrow(
        "Cannot complete order in 'pending' status"
      );
    });

    it('throws when order is in "escrow_funded" status (not yet started)', async () => {
      const findChain = makeChain({
        data: {
          id: ORDER_ID,
          buyer_id: BUYER_ID,
          seller_id: SELLER_ID,
          status: 'escrow_funded',
          amount_sats: 5000,
        },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.completeOrder(ORDER_ID, BUYER_ID)).rejects.toThrow(
        "Cannot complete order in 'escrow_funded' status"
      );
    });

    it('throws and logs when the atomic guard DB update fails', async () => {
      const findChain = makeChain({
        data: {
          id: ORDER_ID,
          buyer_id: BUYER_ID,
          seller_id: SELLER_ID,
          status: 'in_progress',
          amount_sats: 1000,
          release_status: 'pending',
          release_attempts: 0,
        },
        error: null,
      });
      const dbError = { message: 'update failed' };
      const guardChain = makeChain({ data: null, error: dbError });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(guardChain);

      await expect(service.completeOrder(ORDER_ID, BUYER_ID)).rejects.toThrow(
        'Failed to initiate payout: update failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to mark order release as processing',
        expect.objectContaining({ error: dbError, orderId: ORDER_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // disputeOrder — escrow state machine
  // -------------------------------------------------------------------------
  describe('disputeOrder', () => {
    it('allows the buyer to dispute an escrow_funded order', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID, status: 'escrow_funded' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(service.disputeOrder(ORDER_ID, BUYER_ID)).resolves.toBeUndefined();

      expect(updateChain.update).toHaveBeenCalledWith({ status: 'disputed' });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Order disputed',
        expect.objectContaining({ orderId: ORDER_ID, userId: BUYER_ID })
      );
    });

    it('allows the seller to dispute an in_progress order', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID, status: 'in_progress' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(service.disputeOrder(ORDER_ID, SELLER_ID)).resolves.toBeUndefined();
    });

    it('allows the buyer to dispute an in_progress order', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID, status: 'in_progress' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(service.disputeOrder(ORDER_ID, BUYER_ID)).resolves.toBeUndefined();
    });

    it('uses atomic .in() status guard on the update', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID, status: 'in_progress' },
        error: null,
      });
      const updateChain = makeChain({ data: null, error: null });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await service.disputeOrder(ORDER_ID, BUYER_ID);

      expect(updateChain.in).toHaveBeenCalledWith('status', ['escrow_funded', 'in_progress']);
    });

    it('throws when a third party attempts to dispute', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID, status: 'in_progress' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.disputeOrder(ORDER_ID, 'random-user')).rejects.toThrow(
        'Only the buyer or seller can dispute an order'
      );
    });

    it('throws when order is not found', async () => {
      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(service.disputeOrder(ORDER_ID, BUYER_ID)).rejects.toThrow('Order not found');
    });

    it('throws when order is in "pending" status (not funded)', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID, status: 'pending' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.disputeOrder(ORDER_ID, BUYER_ID)).rejects.toThrow(
        "Cannot dispute order in 'pending' status"
      );
    });

    it('throws when order is already "completed"', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID, status: 'completed' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.disputeOrder(ORDER_ID, BUYER_ID)).rejects.toThrow(
        "Cannot dispute order in 'completed' status"
      );
    });

    it('throws when order is already "disputed"', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID, status: 'disputed' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(findChain);

      await expect(service.disputeOrder(ORDER_ID, BUYER_ID)).rejects.toThrow(
        "Cannot dispute order in 'disputed' status"
      );
    });

    it('throws and logs when the DB update fails', async () => {
      const findChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID, status: 'escrow_funded' },
        error: null,
      });
      const dbError = { message: 'update failed' };
      const updateChain = makeChain({ data: null, error: dbError });

      mockDb.from.mockReturnValueOnce(findChain).mockReturnValueOnce(updateChain);

      await expect(service.disputeOrder(ORDER_ID, BUYER_ID)).rejects.toThrow(
        'Failed to dispute order: update failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to dispute order',
        expect.objectContaining({ error: dbError, orderId: ORDER_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // reviewOrder
  // -------------------------------------------------------------------------
  describe('reviewOrder', () => {
    it('creates a review for a completed order', async () => {
      const orderChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, status: 'completed' },
        error: null,
      });
      const insertChain = makeChain({ data: { id: 'review-uuid' }, error: null });

      mockDb.from.mockReturnValueOnce(orderChain).mockReturnValueOnce(insertChain);

      const result = await service.reviewOrder(ORDER_ID, BUYER_ID, {
        rating: 5,
        reviewText: 'Excellent work!',
      });

      expect(result).toEqual({ id: 'review-uuid' });
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: ORDER_ID,
          reviewer_id: BUYER_ID,
          rating: 5,
          review_text: 'Excellent work!',
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Order reviewed',
        expect.objectContaining({
          reviewId: 'review-uuid',
          orderId: ORDER_ID,
          reviewerId: BUYER_ID,
          rating: 5,
        })
      );
    });

    it('saves null review_text when not provided', async () => {
      const orderChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, status: 'completed' },
        error: null,
      });
      const insertChain = makeChain({ data: { id: 'review-no-text' }, error: null });

      mockDb.from.mockReturnValueOnce(orderChain).mockReturnValueOnce(insertChain);

      await service.reviewOrder(ORDER_ID, BUYER_ID, { rating: 3 });

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ review_text: null })
      );
    });

    it.each([1, 2, 3, 4, 5])('accepts valid rating: %i', async (rating) => {
      const orderChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, status: 'completed' },
        error: null,
      });
      const insertChain = makeChain({ data: { id: `review-${rating}` }, error: null });

      mockDb.from.mockReturnValueOnce(orderChain).mockReturnValueOnce(insertChain);

      const result = await service.reviewOrder(ORDER_ID, BUYER_ID, { rating });
      expect(result.id).toBeDefined();
    });

    it('throws when rating is 0', async () => {
      await expect(service.reviewOrder(ORDER_ID, BUYER_ID, { rating: 0 })).rejects.toThrow(
        'Rating must be an integer between 1 and 5'
      );
    });

    it('throws when rating is 6', async () => {
      await expect(service.reviewOrder(ORDER_ID, BUYER_ID, { rating: 6 })).rejects.toThrow(
        'Rating must be an integer between 1 and 5'
      );
    });

    it('throws when rating is a float', async () => {
      await expect(service.reviewOrder(ORDER_ID, BUYER_ID, { rating: 4.5 })).rejects.toThrow(
        'Rating must be an integer between 1 and 5'
      );
    });

    it('throws when order is not found', async () => {
      const notFoundChain = makeChain({ data: null, error: { message: 'not found' } });
      mockDb.from.mockReturnValueOnce(notFoundChain);

      await expect(service.reviewOrder(ORDER_ID, BUYER_ID, { rating: 5 })).rejects.toThrow(
        'Order not found'
      );
    });

    it('throws when reviewer is not the buyer', async () => {
      const orderChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, status: 'completed' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(orderChain);

      await expect(service.reviewOrder(ORDER_ID, SELLER_ID, { rating: 5 })).rejects.toThrow(
        'Only the buyer can review a completed order'
      );
    });

    it('throws when order is not completed (status: in_progress)', async () => {
      const orderChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, status: 'in_progress' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(orderChain);

      await expect(service.reviewOrder(ORDER_ID, BUYER_ID, { rating: 5 })).rejects.toThrow(
        'Can only review completed orders'
      );
    });

    it('throws when order is not completed (status: pending)', async () => {
      const orderChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, status: 'pending' },
        error: null,
      });
      mockDb.from.mockReturnValueOnce(orderChain);

      await expect(service.reviewOrder(ORDER_ID, BUYER_ID, { rating: 5 })).rejects.toThrow(
        'Can only review completed orders'
      );
    });

    it('throws "already been reviewed" when unique constraint (code 23505) is violated', async () => {
      const orderChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, status: 'completed' },
        error: null,
      });
      const dupError = { code: '23505', message: 'duplicate key' };
      const insertChain = makeChain({ data: null, error: dupError });

      mockDb.from.mockReturnValueOnce(orderChain).mockReturnValueOnce(insertChain);

      await expect(service.reviewOrder(ORDER_ID, BUYER_ID, { rating: 4 })).rejects.toThrow(
        'Order has already been reviewed'
      );
    });

    it('throws and logs on a generic DB insert error', async () => {
      const orderChain = makeChain({
        data: { id: ORDER_ID, buyer_id: BUYER_ID, status: 'completed' },
        error: null,
      });
      const dbError = { code: '50000', message: 'insert failed' };
      const insertChain = makeChain({ data: null, error: dbError });

      mockDb.from.mockReturnValueOnce(orderChain).mockReturnValueOnce(insertChain);

      await expect(service.reviewOrder(ORDER_ID, BUYER_ID, { rating: 4 })).rejects.toThrow(
        'Failed to create review: insert failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create review',
        expect.objectContaining({ error: dbError, orderId: ORDER_ID, reviewerId: BUYER_ID })
      );
    });
  });
});
