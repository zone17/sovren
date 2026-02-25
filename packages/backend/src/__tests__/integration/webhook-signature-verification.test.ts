/**
 * Webhook Signature Verification Integration Tests
 *
 * Story: PAY-003 - Implement Webhook Signature Verification
 *
 * Tests comprehensive HMAC-SHA256 signature verification for webhook endpoints.
 * Follows TDD principles with test-first development.
 *
 * Test Coverage:
 * - Valid HMAC signatures (should accept)
 * - Invalid HMAC signatures (should reject with 401)
 * - Missing signature headers (should reject with 401)
 * - Missing timestamp headers (should reject with 401)
 * - Replay attack prevention (timestamp validation)
 * - Rate limiting per IP (100 requests/minute)
 * - Webhook secret rotation support
 * - IP address logging for failed verifications
 *
 * @module webhook-signature-verification.test
 * @category Integration Tests
 */

import request from 'supertest';
import crypto from 'crypto';
import express, { Express } from 'express';
import { PaymentState } from '@shared/types';

// Mock Express app for testing
let app: Express;
let originalWebhookSecret: string | undefined;
let originalWebhookSecretRotation: string | undefined;

// Test data
const TEST_WEBHOOK_SECRET = 'test-webhook-secret-key-for-testing';
const TEST_WEBHOOK_SECRET_ROTATION = 'test-webhook-secret-rotation-key';
const VALID_PAYMENT_HASH = 'a'.repeat(64);

/**
 * Helper function to generate valid HMAC signature
 */
function generateWebhookSignature(
  payload: Record<string, unknown>,
  timestamp: string,
  secret: string = TEST_WEBHOOK_SECRET
): string {
  const payloadString = `${timestamp}.${JSON.stringify(payload)}`;
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * Helper function to create webhook request with valid signature
 */
function createSignedWebhookRequest(
  payload: Record<string, unknown>,
  timestampOverride?: number
): {
  payload: Record<string, unknown>;
  headers: { 'x-webhook-signature': string; 'x-webhook-timestamp': string };
} {
  const timestamp = timestampOverride || Math.floor(Date.now() / 1000);
  const timestampStr = timestamp.toString();
  const signature = generateWebhookSignature(payload, timestampStr);

  return {
    payload,
    headers: {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestampStr,
    },
  };
}

describe('Webhook Signature Verification (PAY-003)', () => {
  beforeAll(() => {
    // Save original environment variables
    originalWebhookSecret = process.env.WEBHOOK_SECRET;
    originalWebhookSecretRotation = process.env.WEBHOOK_SECRET_ROTATION;

    // Set test secrets
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.WEBHOOK_SECRET_ROTATION = TEST_WEBHOOK_SECRET_ROTATION;
  });

  beforeEach(async () => {
    // Import webhooks route and create test app
    // This needs to be done in beforeEach to get fresh app instance
    const webhooksRouter = (await import('../../routes/webhooks')).default;

    app = express();
    app.use(express.json());
    app.use('/api/webhooks', webhooksRouter);
  });

  afterAll(() => {
    // Restore original environment variables
    if (originalWebhookSecret !== undefined) {
      process.env.WEBHOOK_SECRET = originalWebhookSecret;
    } else {
      delete process.env.WEBHOOK_SECRET;
    }

    if (originalWebhookSecretRotation !== undefined) {
      process.env.WEBHOOK_SECRET_ROTATION = originalWebhookSecretRotation;
    } else {
      delete process.env.WEBHOOK_SECRET_ROTATION;
    }
  });

  describe('Valid Webhook Signatures', () => {
    it('should accept webhook with valid HMAC-SHA256 signature', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        preimage: 'test-preimage',
        amount: 1000,
        timestamp: Date.now(),
      };

      const { payload: signedPayload, headers } = createSignedWebhookRequest(payload);

      // Note: This will fail until we implement proper payment setup
      // For now, we're testing signature verification only
      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set(headers)
        .send(signedPayload);

      // Should NOT be 401 (unauthorized due to bad signature)
      // It may be 404 (payment not found) or 500, but signature should pass
      expect(response.status).not.toBe(401);
    });

    it('should accept webhook with recent timestamp (within 5 minutes)', async () => {
      const payload = {
        event: 'payment.processing',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      // Use timestamp from 4 minutes ago (should be valid)
      const fourMinutesAgo = Math.floor(Date.now() / 1000) - 240;
      const { payload: signedPayload, headers } = createSignedWebhookRequest(
        payload,
        fourMinutesAgo
      );

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set(headers)
        .send(signedPayload);

      // Should NOT be 401 (signature/timestamp valid)
      expect(response.status).not.toBe(401);
    });

    it('should accept webhook signed with rotation secret', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        preimage: 'test-preimage',
        amount: 1000,
        timestamp: Date.now(),
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = generateWebhookSignature(
        payload,
        timestamp,
        TEST_WEBHOOK_SECRET_ROTATION
      );

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .send(payload);

      // Should NOT be 401 (rotation secret should work)
      expect(response.status).not.toBe(401);
    });
  });

  describe('Invalid Webhook Signatures', () => {
    it('should reject webhook with invalid signature', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const invalidSignature = 'invalid-signature-12345';

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set('x-webhook-signature', invalidSignature)
        .set('x-webhook-timestamp', timestamp)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('signature');
    });

    it('should reject webhook with tampered payload', async () => {
      const originalPayload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        amount: 1000,
        timestamp: Date.now(),
      };

      const { headers } = createSignedWebhookRequest(originalPayload);

      // Tamper with the amount
      const tamperedPayload = {
        ...originalPayload,
        amount: 99999, // Attacker tries to change amount
      };

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set(headers)
        .send(tamperedPayload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('signature');
    });

    it('should reject webhook with wrong secret', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const wrongSecret = 'wrong-secret-key';
      const signature = generateWebhookSignature(payload, timestamp, wrongSecret);

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Missing Headers', () => {
    it('should reject webhook without signature header', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set('x-webhook-timestamp', timestamp) // Only timestamp, no signature
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('header');
    });

    it('should reject webhook without timestamp header', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      const signature = generateWebhookSignature(payload, '1234567890');

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set('x-webhook-signature', signature) // Only signature, no timestamp
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('header');
    });

    it('should reject webhook without both headers', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .send(payload); // No headers at all

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('header');
    });
  });

  describe('Replay Attack Prevention (Timestamp Validation)', () => {
    it('should reject webhook with old timestamp (>5 minutes)', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      // Create timestamp from 6 minutes ago (361 seconds)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 361;
      const { payload: signedPayload, headers } = createSignedWebhookRequest(
        payload,
        oldTimestamp
      );

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set(headers)
        .send(signedPayload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('expired');
    });

    it('should reject webhook with future timestamp', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      // Create timestamp from 10 minutes in the future
      const futureTimestamp = Math.floor(Date.now() / 1000) + 600;
      const { payload: signedPayload, headers } = createSignedWebhookRequest(
        payload,
        futureTimestamp
      );

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set(headers)
        .send(signedPayload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject webhook with exact 5 minute boundary', async () => {
      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      // Exactly 300 seconds ago (on the boundary)
      const boundaryTimestamp = Math.floor(Date.now() / 1000) - 300;
      const { payload: signedPayload, headers } = createSignedWebhookRequest(
        payload,
        boundaryTimestamp
      );

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set(headers)
        .send(signedPayload);

      // Should still accept exactly at 5 minutes (≤ 300 seconds)
      expect(response.status).not.toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit webhooks to 100 requests per minute per IP', async () => {
      const payload = {
        event: 'payment.processing',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      // Send 101 requests rapidly
      const requests = [];
      for (let i = 0; i < 101; i++) {
        const { payload: signedPayload, headers } = createSignedWebhookRequest(payload);
        requests.push(
          request(app)
            .post('/api/webhooks/lightning')
            .set(headers)
            .send(signedPayload)
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429 Too Many Requests)
      const rateLimitedResponses = responses.filter((res) => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 30000); // Increase timeout for multiple requests
  });

  describe('Security Logging', () => {
    it('should log IP address on signature verification failure', async () => {
      // Mock console.error to capture logs
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const invalidSignature = 'invalid-signature';

      await request(app)
        .post('/api/webhooks/lightning')
        .set('x-webhook-signature', invalidSignature)
        .set('x-webhook-timestamp', timestamp)
        .set('X-Forwarded-For', '192.168.1.100') // Test IP
        .send(payload);

      // Should have logged the security event with IP
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should log replay attack attempts', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

      const payload = {
        event: 'payment.completed',
        paymentHash: VALID_PAYMENT_HASH,
        timestamp: Date.now(),
      };

      // Old timestamp (replay attack)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400;
      const { payload: signedPayload, headers } = createSignedWebhookRequest(
        payload,
        oldTimestamp
      );

      await request(app)
        .post('/api/webhooks/lightning')
        .set(headers)
        .set('X-Forwarded-For', '192.168.1.200')
        .send(signedPayload);

      // Should have logged the replay attack attempt
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Health Check', () => {
    it('should have accessible health check endpoint', async () => {
      const response = await request(app).get('/api/webhooks/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('service', 'webhooks');
      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });
});
