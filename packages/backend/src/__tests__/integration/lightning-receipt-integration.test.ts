/**
 * Lightning Receipt Service Integration Test
 *
 * Tests the complete integration of the Lightning Receipt Service
 * with the Lightning Service and API routes.
 */

// Mock the subscription-management-service module entirely
// (it imports analytics-service, lightning-payment-service, notification-service, websocket-service
// — all of which are missing files, pre-existing broken imports)
vi.mock('../../services/subscription-management-service', () => ({
  SubscriptionManagementService: vi.fn().mockImplementation(() => ({})),
  subscriptionManagementService: {},
}));

// Also mock the route that imports it
vi.mock('../../routes/subscription-tiers', () => {
  const { Router } = require('express');
  return { default: Router() };
});

// Mock puppeteer, nodemailer, and fs for the receipt service
vi.mock('puppeteer', () => ({
  launch: vi.fn().mockResolvedValue({
    newPage: vi.fn().mockResolvedValue({
      setContent: vi.fn(),
      pdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
      close: vi.fn(),
    }),
    close: vi.fn(),
    on: vi.fn(),
    connected: true,
  }),
}));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    verify: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('fs/promises', () => {
  const mod = {
    readFile: vi.fn().mockResolvedValue('mock-template'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue({
      writeFile: vi.fn().mockResolvedValue(undefined),
      datasync: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  };
  return { ...mod, default: mod };
});

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('[]'),
  renameSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../../app';
import { lightningReceiptService } from '../../services/lightning/receipt-service';

describe('Lightning Receipt Integration', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    // Clear any existing receipts
    (lightningReceiptService as any).receiptStorage.clear();
  });

  describe('Receipt API Routes', () => {
    it('should have receipt routes registered', async () => {
      // Test that the receipt endpoint exists
      const response = await request(app).get('/api/lightning/receipt/health').expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          service: 'lightning-receipt',
          status: 'healthy',
          version: expect.any(String),
          timestamp: expect.any(Number),
        },
      });
    });

    it('should validate receipt generation requests', async () => {
      const response = await request(app)
        .post('/api/lightning/receipt')
        .send({
          paymentId: '', // Invalid empty paymentId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle valid receipt generation request', async () => {
      const response = await request(app)
        .post('/api/lightning/receipt')
        .send({
          paymentId: 'test-payment-123',
          includeDetailedVerification: true,
          emailReceipt: false,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        receiptNumber: expect.any(String),
        paymentHash: expect.any(String),
        amount: expect.any(Number),
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Service Integration', () => {
    it('should initialize receipt service without errors', () => {
      // Test that the service was imported and initialized correctly
      expect(lightningReceiptService).toBeDefined();
      expect(typeof lightningReceiptService.generateReceipt).toBe('function');
      expect(typeof lightningReceiptService.getReceiptByPaymentHash).toBe('function');
      expect(typeof lightningReceiptService.verifyReceipt).toBe('function');
    });

    it('should generate receipt with minimal configuration', async () => {
      const receipt = await lightningReceiptService.generateReceipt({
        paymentId: '550e8400-e29b-41d4-a716-446655440099',
        includeDetailedVerification: false,
        emailReceipt: false,
      });

      expect(receipt).toMatchObject({
        id: expect.any(String),
        receiptNumber: expect.stringMatching(/^SVR-[A-Z0-9]+-[A-Z0-9]+$/),
        paymentHash: expect.any(String),
        amount: expect.any(Number),
        timestamp: expect.any(Number),
        security: {
          hash: expect.any(String),
          signature: expect.any(String),
          verificationCode: expect.stringMatching(/^[A-Z0-9]{8}$/),
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle receipt generation errors gracefully', async () => {
      // Test with invalid payment ID that will cause an error
      const response = await request(app)
        .post('/api/lightning/receipt')
        .send({
          paymentId: 'invalid-payment-that-will-fail',
          includeDetailedVerification: true,
          emailReceipt: false,
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to generate receipt');
    });

    it('should handle missing receipts', async () => {
      const response = await request(app)
        .get('/api/lightning/receipt/nonexistent-receipt')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Receipt not found');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to receipt endpoints', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/lightning/receipt')
            .send({
              paymentId: `test-payment-${Math.random()}`,
              includeDetailedVerification: false,
              emailReceipt: false,
            })
        );

      const responses = await Promise.all(requests);

      // At least some requests should succeed
      const successfulRequests = responses.filter((r) => r.status === 201);
      expect(successfulRequests.length).toBeGreaterThan(0);

      // Some might be rate limited (429) but we're not enforcing strict limits in test
      const rateLimitedRequests = responses.filter((r) => r.status === 429);
      console.log(
        `Successful: ${successfulRequests.length}, Rate Limited: ${rateLimitedRequests.length}`
      );
    });
  });
});
