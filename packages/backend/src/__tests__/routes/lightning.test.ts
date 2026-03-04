import express from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import lightningRoutes from '../../routes/lightning';

const mockLightningInstance = {
  createInvoice: vi.fn(),
  checkInvoiceStatus: vi.fn(),
  getInvoiceByPaymentHash: vi.fn(),
  getStats: vi.fn(),
  getCreatorPayments: vi.fn(),
  processWebhook: vi.fn(),
};

// Mock LightningService singleton
vi.mock('../../services/lightning-service', () => ({
  LightningService: {
    getInstance: () => mockLightningInstance,
  },
}));

// Mock the authentication middleware
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'user' };
    next();
  },
  requireCreator: (_req: any, _res: any, next: any) => next(),
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('Lightning API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/lightning', lightningRoutes);
    vi.clearAllMocks();
  });

  describe('POST /api/lightning/invoice', () => {
    it('creates invoice and returns frontend shape', async () => {
      mockLightningInstance.createInvoice.mockResolvedValue({
        success: true,
        invoice: {
          id: 'inv-1',
          payment_request: 'lnbc1500n...',
          payment_hash: 'abc123',
          amount: 1000,
          description: 'Test',
          created_at: 1000,
          expires_at: 2000,
          status: 'pending',
        },
      });

      const res = await request(app)
        .post('/api/lightning/invoice')
        .send({
          amount: 1000,
          creatorId: '550e8400-e29b-41d4-a716-446655440000',
          description: 'Test',
        })
        .expect(200);

      expect(res.body).toEqual({
        paymentRequest: 'lnbc1500n...',
        paymentHash: 'abc123',
        amount: 1000,
        description: 'Test',
        createdAt: 1000,
        expiresAt: 2000,
        settled: false,
      });
    });

    it('validates request body with Zod', async () => {
      const res = await request(app)
        .post('/api/lightning/invoice')
        .send({ amount: -100 })
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(mockLightningInstance.createInvoice).not.toHaveBeenCalled();
    });

    it('converts expirySeconds to expiryMinutes', async () => {
      mockLightningInstance.createInvoice.mockResolvedValue({
        success: true,
        invoice: {
          payment_request: 'lnbc...',
          payment_hash: 'h1',
          amount: 500,
          description: 'd',
          created_at: 1,
          expires_at: 2,
          status: 'pending',
        },
      });

      await request(app)
        .post('/api/lightning/invoice')
        .send({
          amount: 500,
          creatorId: '550e8400-e29b-41d4-a716-446655440000',
          expirySeconds: 3600,
        })
        .expect(200);

      expect(mockLightningInstance.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ expiryMinutes: 60 })
      );
    });
  });

  describe('GET /api/lightning/invoice/:paymentHash', () => {
    it('looks up by payment hash then checks status', async () => {
      mockLightningInstance.getInvoiceByPaymentHash.mockResolvedValue({
        id: 'inv-1',
        payment_hash: 'abc123',
      });
      mockLightningInstance.checkInvoiceStatus.mockResolvedValue({
        success: true,
        invoice: {
          payment_request: 'lnbc...',
          payment_hash: 'abc123',
          amount: 1000,
          description: 'Test',
          created_at: 1000,
          expires_at: 2000,
          status: 'paid',
        },
      });

      const res = await request(app).get('/api/lightning/invoice/abc123').expect(200);

      expect(res.body.settled).toBe(true);
      expect(mockLightningInstance.getInvoiceByPaymentHash).toHaveBeenCalledWith('abc123');
      expect(mockLightningInstance.checkInvoiceStatus).toHaveBeenCalledWith('inv-1');
    });

    it('returns 404 when invoice not found', async () => {
      mockLightningInstance.getInvoiceByPaymentHash.mockResolvedValue(null);

      await request(app).get('/api/lightning/invoice/nonexistent').expect(404);
    });
  });

  describe('POST /api/lightning/webhook', () => {
    it('processes webhook without auth', async () => {
      mockLightningInstance.processWebhook.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/lightning/webhook')
        .send({ type: 'payment', payment_hash: 'abc' })
        .expect(200);

      expect(res.body).toEqual({ received: true });
    });

    it('returns 400 on webhook failure', async () => {
      mockLightningInstance.processWebhook.mockResolvedValue({
        success: false,
        error: 'Invalid signature',
      });

      await request(app).post('/api/lightning/webhook').send({ type: 'payment' }).expect(400);
    });
  });

  describe('POST /api/lightning/subscription', () => {
    it('validates required fields with Zod', async () => {
      const res = await request(app)
        .post('/api/lightning/subscription')
        .send({ creatorId: 'not-a-uuid' })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('validates interval with Zod enum', async () => {
      const res = await request(app)
        .post('/api/lightning/subscription')
        .send({
          creatorId: '00000000-0000-0000-0000-000000000001',
          tier: 'basic',
          amount: 1000,
          interval: 'biweekly',
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/lightning/node-info', () => {
    it('returns stats from service', async () => {
      const stats = { totalInvoices: 10 };
      mockLightningInstance.getStats.mockResolvedValue(stats);

      const res = await request(app).get('/api/lightning/node-info').expect(200);

      expect(res.body).toEqual(stats);
    });
  });
});
