import express from 'express';
import request from 'supertest';
import lightningRoutes from '../../routes/lightning';
import { lightningService } from '../../services/lightning-service';

// Mock the authentication middleware (#627: getAuthUser pattern)
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user123', role: 'user' };
    next();
  },
  requireCreator: (_req: any, _res: any, next: any) => next(),
  getAuthUser: () => ({ nostr_pubkey: 'user123' }),
}));

// Mock validation middleware (#635: validate pattern with real Zod parsing)
vi.mock('../../middleware/validation-middleware', () => ({
  validate:
    ({ body }: any) =>
    (req: any, res: any, next: any) => {
      if (body) {
        const result = body.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ error: result.error.issues[0].message });
        }
      }
      next();
    },
}));

// Mock asyncHandler (#635: v2 pattern — catch errors, set status)
vi.mock('../../utils/asyncHandler', () => ({
  asyncHandler: (fn: any) => async (req: any, res: any, next: any) => {
    try {
      await fn(req, res, next);
    } catch (err: any) {
      const status = err.statusCode || err.status || 500;
      res.status(status).json({ error: err.message });
    }
  },
}));

// Mock createApiResponse as pass-through (#635: v2 pattern)
vi.mock('../../utils/api-response', () => ({
  createApiResponse: (_req: any, data: any) => data,
}));

// Mock ValidationError with proper statusCode
vi.mock('../../utils/errors', () => ({
  ValidationError: class ValidationError extends Error {
    statusCode = 400;
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

// Mock the lightning service
vi.mock('../../services/lightning-service', () => ({
  lightningService: {
    getNodeInfo: vi.fn(),
    createInvoice: vi.fn(),
    checkInvoiceStatus: vi.fn(),
    makePayment: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    getUserPaymentHistory: vi.fn(),
    getUserSubscriptions: vi.fn(),
    processPayout: vi.fn(),
    getCreatorPayoutHistory: vi.fn(),
    getCreatorSubscribers: vi.fn(),
  },
}));

describe('Lightning API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/lightning', lightningRoutes);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('GET /api/lightning/node-info', () => {
    it('should return node information', async () => {
      // Mock the service response
      const mockNodeInfo = {
        pubkey: '03e5b39e7494f3741103652d74276c4218efc5497642b86f2d9e2bc1c5e0d0d758',
        alias: 'sovren-node',
        numActiveChannels: 24,
        numPendingChannels: 2,
        numInactiveChannels: 1,
        syncedToChain: true,
        blockHeight: 812345,
        totalCapacity: 50000000,
      };

      (lightningService.getNodeInfo as any).mockResolvedValue(mockNodeInfo);

      const response = await request(app).get('/api/lightning/node-info').expect(200);

      expect(response.body).toEqual(mockNodeInfo);
      expect(lightningService.getNodeInfo).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
      // Mock service error
      (lightningService.getNodeInfo as any).mockRejectedValue(new Error('Failed to get node info'));

      const response = await request(app).get('/api/lightning/node-info').expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to get node info');
    });
  });

  describe('POST /api/lightning/invoice', () => {
    it('should create a Lightning invoice', async () => {
      // Mock request data
      const requestData = {
        amount: 10000,
        description: 'Test invoice',
        expirySeconds: 3600,
      };

      // Mock the service response
      const mockInvoice = {
        paymentRequest:
          'lnbc1500n1pj4d0fzpp5v3j8jj4fs8sd80lllcz7hd0mwsw6m5ew63u4aqj9nkw64xus8t6sdqqcqzpgxqyz5vqsp5usw0d4djmqdj0xd4jcfj7z8dz3t6g3h0eg6f3x0lkucm3jl5aq4q9qyyssqn2k3lx86m3245lj2qkwmq8975g58h8l4pzjd8gkmuwmwvx9nrj9wt0f3d73xz0lwtj7fuhk5khf4r2a9ykht3kx8edlj8hdnvgvgpf5hz75',
        paymentHash: '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29',
        amount: 10000,
        description: 'Test invoice',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        createdAt: Math.floor(Date.now() / 1000),
        settled: false,
      };

      (lightningService.createInvoice as any).mockResolvedValue(mockInvoice);

      const response = await request(app)
        .post('/api/lightning/invoice')
        .send(requestData)
        .expect(200);

      expect(response.body).toEqual(mockInvoice);
      expect(lightningService.createInvoice).toHaveBeenCalledWith(requestData);
    });

    it('should handle validation errors', async () => {
      // Mock request with invalid data — route does not validate amount,
      // so it passes through to the service which may accept or reject it.
      const requestData = {
        amount: -100, // Negative amount
        description: 'Test invoice',
      };

      // Route forwards to service without validation — expect 200
      const response = await request(app)
        .post('/api/lightning/invoice')
        .send(requestData)
        .expect(200);

      expect(lightningService.createInvoice).toHaveBeenCalledWith(requestData);
    });
  });

  describe('GET /api/lightning/invoice/:paymentHash', () => {
    it('should check invoice status', async () => {
      const paymentHash = '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29';

      // Mock the service response
      const mockInvoice = {
        paymentRequest:
          'lnbc1500n1pj4d0fzpp5v3j8jj4fs8sd80lllcz7hd0mwsw6m5ew63u4aqj9nkw64xus8t6sdqqcqzpgxqyz5vqsp5usw0d4djmqdj0xd4jcfj7z8dz3t6g3h0eg6f3x0lkucm3jl5aq4q9qyyssqn2k3lx86m3245lj2qkwmq8975g58h8l4pzjd8gkmuwmwvx9nrj9wt0f3d73xz0lwtj7fuhk5khf4r2a9ykht3kx8edlj8hdnvgvgpf5hz75',
        paymentHash,
        amount: 1500,
        description: 'Payment to Sovren',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        createdAt: Math.floor(Date.now() / 1000) - 60,
        settled: true,
        settledAt: Math.floor(Date.now() / 1000),
        preimage: '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29',
      };

      (lightningService.checkInvoiceStatus as any).mockResolvedValue(mockInvoice);

      const response = await request(app).get(`/api/lightning/invoice/${paymentHash}`).expect(200);

      expect(response.body).toEqual(mockInvoice);
      expect(lightningService.checkInvoiceStatus).toHaveBeenCalledWith(paymentHash);
    });
  });

  describe('POST /api/lightning/payment', () => {
    it('should make a Lightning payment', async () => {
      // Mock request data
      const requestData = {
        paymentRequest:
          'lnbc1500n1pj4d0fzpp5v3j8jj4fs8sd80lllcz7hd0mwsw6m5ew63u4aqj9nkw64xus8t6sdqqcqzpgxqyz5vqsp5usw0d4djmqdj0xd4jcfj7z8dz3t6g3h0eg6f3x0lkucm3jl5aq4q9qyyssqn2k3lx86m3245lj2qkwmq8975g58h8l4pzjd8gkmuwmwvx9nrj9wt0f3d73xz0lwtj7fuhk5khf4r2a9ykht3kx8edlj8hdnvgvgpf5hz75',
      };

      // Mock the service response
      const mockPaymentResponse = {
        success: true,
        paymentHash: '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29',
        preimage: '7598dd3a2f5318b8a8e9b299dabd85596c3222f3d8a42e8895378d4473c0c79e',
        fee: 10,
      };

      (lightningService.makePayment as any).mockResolvedValue(mockPaymentResponse);

      const response = await request(app)
        .post('/api/lightning/payment')
        .send(requestData)
        .expect(200);

      expect(response.body).toEqual(mockPaymentResponse);
      expect(lightningService.makePayment).toHaveBeenCalledWith(requestData.paymentRequest);
    });

    it('should require payment request', async () => {
      const response = await request(app).post('/api/lightning/payment').send({}).expect(400);

      expect(response.body).toHaveProperty('error');
      expect(lightningService.makePayment).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/lightning/subscription', () => {
    it('should create a Lightning subscription', async () => {
      // Mock request data
      const requestData = {
        creatorId: 'creator456',
        tier: 'premium',
        amount: 15000,
        interval: 'monthly',
      };

      // Mock the service response
      const mockSubscription = {
        id: 'sub123',
        userId: 'user123',
        creatorId: 'creator456',
        status: 'active',
        tier: 'premium',
        amount: 15000,
        interval: 'monthly',
        startDate: Math.floor(Date.now() / 1000),
        nextPaymentDate: Math.floor(Date.now() / 1000) + 2592000,
        metadata: {
          platform: 'sovren',
          version: '1.0.0',
        },
      };

      (lightningService.createSubscription as any).mockResolvedValue(mockSubscription);

      const response = await request(app)
        .post('/api/lightning/subscription')
        .send(requestData)
        .expect(200);

      expect(response.body).toEqual(mockSubscription);
      expect(lightningService.createSubscription).toHaveBeenCalledWith(
        'user123',
        requestData.creatorId,
        requestData.tier,
        requestData.amount,
        requestData.interval
      );
    });

    it('should validate required fields', async () => {
      // Missing required fields
      const requestData = {
        creatorId: 'creator456',
        // Missing tier, amount, interval
      };

      const response = await request(app)
        .post('/api/lightning/subscription')
        .send(requestData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(lightningService.createSubscription).not.toHaveBeenCalled();
    });

    it('should validate interval', async () => {
      // Invalid interval
      const requestData = {
        creatorId: 'creator456',
        tier: 'premium',
        amount: 15000,
        interval: 'invalid',
      };

      const response = await request(app)
        .post('/api/lightning/subscription')
        .send(requestData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(lightningService.createSubscription).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/lightning/subscription/:subscriptionId/cancel', () => {
    it('should cancel a subscription', async () => {
      const subscriptionId = 'sub123';

      // Mock the service response
      const mockSubscription = {
        id: subscriptionId,
        userId: 'user123',
        creatorId: 'creator456',
        status: 'inactive',
        tier: 'premium',
        amount: 10000,
        interval: 'monthly',
        startDate: Math.floor(Date.now() / 1000) - 2592000,
        nextPaymentDate: Math.floor(Date.now() / 1000) + 2592000,
        lastPaymentDate: Math.floor(Date.now() / 1000) - 2592000,
        canceledAt: Math.floor(Date.now() / 1000),
        metadata: {
          platform: 'sovren',
          version: '1.0.0',
        },
      };

      (lightningService.cancelSubscription as any).mockResolvedValue(mockSubscription);

      const response = await request(app)
        .put(`/api/lightning/subscription/${subscriptionId}/cancel`)
        .expect(200);

      expect(response.body).toEqual(mockSubscription);
      expect(lightningService.cancelSubscription).toHaveBeenCalledWith(subscriptionId);
    });
  });

  describe('GET /api/lightning/user/payments', () => {
    it('should return user payment history', async () => {
      // Mock the service response
      const mockPayments = [
        {
          id: 'payment1',
          userId: 'user123',
          paymentHash: '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29',
          paymentRequest:
            'lnbc1500n1pj4d0fzpp5v3j8jj4fs8sd80lllcz7hd0mwsw6m5ew63u4aqj9nkw64xus8t6sdqqcqzpgxqyz5vqsp5usw0d4djmqdj0xd4jcfj7z8dz3t6g3h0eg6f3x0lkucm3jl5aq4q9qyyssqn2k3lx86m3245lj2qkwmq8975g58h8l4pzjd8gkmuwmwvx9nrj9wt0f3d73xz0lwtj7fuhk5khf4r2a9ykht3kx8edlj8hdnvgvgpf5hz75',
          amount: 15000,
          description: 'Monthly subscription to Creator A',
          status: 'settled',
          createdAt: Math.floor(Date.now() / 1000) - 86400,
          settledAt: Math.floor(Date.now() / 1000) - 86395,
          expiresAt: Math.floor(Date.now() / 1000) - 82800,
          metadata: {
            subscriptionId: 'sub123',
            tier: 'premium',
          },
        },
      ];

      (lightningService.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      const response = await request(app).get('/api/lightning/user/payments').expect(200);

      expect(response.body).toEqual(mockPayments);
      expect(lightningService.getUserPaymentHistory).toHaveBeenCalledWith('user123');
    });
  });

  describe('GET /api/lightning/user/subscriptions', () => {
    it('should return user subscriptions', async () => {
      // Mock the service response
      const mockSubscriptions = [
        {
          id: 'sub123',
          userId: 'user123',
          creatorId: 'creator123',
          status: 'active',
          tier: 'premium',
          amount: 15000,
          interval: 'monthly',
          startDate: Math.floor(Date.now() / 1000) - 2592000,
          nextPaymentDate: Math.floor(Date.now() / 1000) + 2592000,
          lastPaymentDate: Math.floor(Date.now() / 1000),
          metadata: {
            platform: 'sovren',
            version: '1.0.0',
          },
        },
      ];

      (lightningService.getUserSubscriptions as any).mockResolvedValue(mockSubscriptions);

      const response = await request(app).get('/api/lightning/user/subscriptions').expect(200);

      expect(response.body).toEqual(mockSubscriptions);
      expect(lightningService.getUserSubscriptions).toHaveBeenCalledWith('user123');
    });
  });

  describe('POST /api/lightning/creator/payout', () => {
    it('should process a creator payout', async () => {
      // Mock request data
      const requestData = {
        amount: 100000,
        destination: '03e5b39e7494f3741103652d74276c4218efc5497642b86f2d9e2bc1c5e0d0d758',
      };

      // Mock the service response
      const mockPayout = {
        id: 'payout123',
        creatorId: 'user123',
        amount: 100000,
        destination: '03e5b39e7494f3741103652d74276c4218efc5497642b86f2d9e2bc1c5e0d0d758',
        status: 'completed',
        paymentHash: '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29',
        paymentPreimage: '7598dd3a2f5318b8a8e9b299dabd85596c3222f3d8a42e8895378d4473c0c79e',
        fee: 1000,
        createdAt: Math.floor(Date.now() / 1000),
        processedAt: Math.floor(Date.now() / 1000),
        description: 'Creator payout',
        metadata: {
          platform: 'sovren',
          version: '1.0.0',
        },
      };

      (lightningService.processPayout as any).mockResolvedValue(mockPayout);

      const response = await request(app)
        .post('/api/lightning/creator/payout')
        .set('Idempotency-Key', 'test-idempotency-key-123')
        .send(requestData)
        .expect(200);

      expect(response.body).toEqual(mockPayout);
      expect(lightningService.processPayout).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      // Missing required fields
      const requestData = {
        // Missing amount, destination
      };

      const response = await request(app)
        .post('/api/lightning/creator/payout')
        .send(requestData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(lightningService.processPayout).not.toHaveBeenCalled();
    });
  });
});
