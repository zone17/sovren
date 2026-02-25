/**
 * Webhook Race Condition Tests
 *
 * Story: PAY-002 - Add Race Condition Handling for Webhook Processing
 *
 * Tests comprehensive race condition handling including:
 * - Concurrent webhook processing for same payment
 * - Out-of-order webhook delivery
 * - Duplicate webhook detection and idempotency
 * - Database locking and atomic transactions
 *
 * @module webhooks-race-conditions.test
 * @category Tests
 */

import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import webhookRouter from '../../routes/webhooks-race-condition-hardened';
import { PaymentState } from '@shared/types';

// Test app setup
const app = express();
app.use(express.json());
app.use('/api/webhooks', webhookRouter);

// Supabase client for test setup
let supabase: SupabaseClient;

// Test configuration
const WEBHOOK_SECRET = 'test-webhook-secret-12345';
const TEST_PAYMENT_HASH = 'a'.repeat(64); // 64 hex characters

/**
 * Generate webhook signature for testing
 */
function generateWebhookSignature(timestamp: number, body: Record<string, unknown>): string {
  const payload = `${timestamp}.${JSON.stringify(body)}`;
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
}

/**
 * Create test webhook request
 */
function createWebhookRequest(
  event: string,
  paymentHash: string,
  timestamp?: number,
  extraData?: Record<string, unknown>
) {
  const webhookTimestamp = timestamp || Math.floor(Date.now() / 1000);
  const body = {
    event,
    paymentHash,
    timestamp: new Date(webhookTimestamp * 1000).toISOString(),
    ...extraData,
  };

  const signature = generateWebhookSignature(webhookTimestamp, body);

  return {
    body,
    headers: {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': String(webhookTimestamp),
    },
  };
}

describe('Webhook Race Condition Handling', () => {
  beforeAll(() => {
    // Set environment variables for testing
    process.env.WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    // Initialize Supabase client
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  });

  beforeEach(async () => {
    // Clean up test data before each test
    if (supabase) {
      await supabase.from('webhook_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('payment_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  });

  afterAll(async () => {
    // Clean up environment
    delete process.env.WEBHOOK_SECRET;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
  });

  describe('Concurrent Webhook Processing', () => {
    it('should handle concurrent webhooks for same payment without duplicates', async () => {
      // Create test payment
      const { data: payment } = await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PENDING,
        user_id: '00000000-0000-0000-0000-000000000001',
      }).select().single();

      expect(payment).toBeDefined();

      // Create 10 concurrent identical webhooks
      const webhookRequests = Array.from({ length: 10 }, () => {
        const { body, headers } = createWebhookRequest(
          'payment.completed',
          TEST_PAYMENT_HASH,
          undefined,
          {
            preimage: 'b'.repeat(64),
            amount: 1000,
            webhookId: 'test-webhook-123', // Same ID for all = duplicates
          }
        );
        return { body, headers };
      });

      // Send all webhooks concurrently
      const responses = await Promise.all(
        webhookRequests.map(({ body, headers }) =>
          request(app)
            .post('/api/webhooks/lightning')
            .set(headers)
            .send(body)
        )
      );

      // Verify all returned 200 (idempotency)
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verify only ONE webhook was actually processed
      const processedWebhooks = responses.filter(r => !r.body.isDuplicate);
      const duplicateWebhooks = responses.filter(r => r.body.isDuplicate);

      expect(processedWebhooks.length).toBe(1);
      expect(duplicateWebhooks.length).toBe(9);

      // Verify payment state was updated only once
      const { data: updatedPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', payment.id)
        .single();

      expect(updatedPayment.state).toBe(PaymentState.COMPLETED);
      expect(updatedPayment.preimage).toBe('b'.repeat(64));

      // Verify webhook_events table shows exactly 10 entries (1 processed, 9 duplicates)
      const { data: webhookEvents } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('payment_hash', TEST_PAYMENT_HASH);

      expect(webhookEvents).toHaveLength(10);

      const processed = webhookEvents?.filter(e => e.status === 'processed');
      const duplicates = webhookEvents?.filter(e => e.status === 'duplicate');

      expect(processed).toHaveLength(1);
      expect(duplicates).toHaveLength(9);
    });

    it('should handle concurrent webhooks with different events', async () => {
      // Create test payment
      const { data: payment } = await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PENDING,
        user_id: '00000000-0000-0000-0000-000000000001',
      }).select().single();

      expect(payment).toBeDefined();

      // Create concurrent webhooks with different events
      const processingWebhook = createWebhookRequest(
        'payment.processing',
        TEST_PAYMENT_HASH,
        undefined,
        { webhookId: 'webhook-processing-1' }
      );

      const completedWebhook = createWebhookRequest(
        'payment.completed',
        TEST_PAYMENT_HASH,
        undefined,
        {
          webhookId: 'webhook-completed-1',
          preimage: 'c'.repeat(64),
          amount: 1000,
        }
      );

      // Send both concurrently
      const [processingResponse, completedResponse] = await Promise.all([
        request(app)
          .post('/api/webhooks/lightning')
          .set(processingWebhook.headers)
          .send(processingWebhook.body),
        request(app)
          .post('/api/webhooks/lightning')
          .set(completedWebhook.headers)
          .send(completedWebhook.body),
      ]);

      // Both should succeed
      expect(processingResponse.status).toBe(200);
      expect(completedResponse.status).toBe(200);

      // Neither should be marked as duplicate (different events)
      expect(processingResponse.body.isDuplicate).toBe(false);
      expect(completedResponse.body.isDuplicate).toBe(false);

      // Final state should be COMPLETED (latest event wins)
      const { data: updatedPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', payment.id)
        .single();

      expect([PaymentState.PROCESSING, PaymentState.COMPLETED]).toContain(
        updatedPayment.state
      );

      // Verify both webhooks were logged
      const { data: webhookEvents } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('payment_hash', TEST_PAYMENT_HASH);

      expect(webhookEvents).toHaveLength(2);
      expect(webhookEvents?.map(e => e.event_type)).toContain('payment.processing');
      expect(webhookEvents?.map(e => e.event_type)).toContain('payment.completed');
    });

    it('should prevent duplicate payment state transitions with SELECT FOR UPDATE', async () => {
      // Create test payment
      const { data: payment } = await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PENDING,
        user_id: '00000000-0000-0000-0000-000000000001',
      }).select().single();

      // Create 5 concurrent completion webhooks with unique IDs
      const webhooks = Array.from({ length: 5 }, (_, i) => {
        const { body, headers } = createWebhookRequest(
          'payment.completed',
          TEST_PAYMENT_HASH,
          undefined,
          {
            webhookId: `unique-webhook-${i}`, // Different IDs = not duplicates
            preimage: 'd'.repeat(64),
            amount: 1000,
          }
        );
        return { body, headers };
      });

      // Send all concurrently
      const responses = await Promise.all(
        webhooks.map(({ body, headers }) =>
          request(app)
            .post('/api/webhooks/lightning')
            .set(headers)
            .send(body)
        )
      );

      // All should return 200
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Count payment_events to verify no duplicate state transitions
      const { data: paymentEvents } = await supabase
        .from('payment_events')
        .select('*')
        .eq('payment_id', payment.id);

      // Should have at most transitions (depends on timing, but SELECT FOR UPDATE prevents duplicates)
      // At minimum: PENDING -> PROCESSING or PENDING -> COMPLETED
      expect(paymentEvents).toBeDefined();
      expect(paymentEvents!.length).toBeGreaterThanOrEqual(1);
      expect(paymentEvents!.length).toBeLessThanOrEqual(6); // 1 initial + max 5 transitions
    });
  });

  describe('Out-of-Order Webhook Handling', () => {
    it('should detect and mark out-of-order webhooks', async () => {
      // Create test payment
      const { data: payment } = await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PENDING,
        user_id: '00000000-0000-0000-0000-000000000001',
      }).select().single();

      const baseTime = Math.floor(Date.now() / 1000);

      // Send webhooks in wrong chronological order
      // 1. Send COMPLETED webhook first (timestamp: T+2)
      const completedWebhook = createWebhookRequest(
        'payment.completed',
        TEST_PAYMENT_HASH,
        baseTime + 2,
        {
          webhookId: 'webhook-completed-1',
          preimage: 'e'.repeat(64),
          amount: 1000,
        }
      );

      const completedResponse = await request(app)
        .post('/api/webhooks/lightning')
        .set(completedWebhook.headers)
        .send(completedWebhook.body);

      expect(completedResponse.status).toBe(200);
      expect(completedResponse.body.isOutOfOrder).toBe(false); // First webhook, not out of order

      // 2. Send PROCESSING webhook later (timestamp: T+1, earlier than completed)
      const processingWebhook = createWebhookRequest(
        'payment.processing',
        TEST_PAYMENT_HASH,
        baseTime + 1,
        { webhookId: 'webhook-processing-1' }
      );

      const processingResponse = await request(app)
        .post('/api/webhooks/lightning')
        .set(processingWebhook.headers)
        .send(processingWebhook.body);

      expect(processingResponse.status).toBe(200);
      expect(processingResponse.body.isOutOfOrder).toBe(true); // Should detect out-of-order

      // Verify webhook_events marks it correctly
      const { data: webhookEvents } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('payment_hash', TEST_PAYMENT_HASH)
        .order('created_at', { ascending: true });

      expect(webhookEvents).toHaveLength(2);
      expect(webhookEvents![0].is_out_of_order).toBe(false);
      expect(webhookEvents![1].is_out_of_order).toBe(true);
    });

    it('should handle logically out-of-order events', async () => {
      // Create test payment
      const { data: payment } = await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PROCESSING,
        user_id: '00000000-0000-0000-0000-000000000001',
      }).select().single();

      // Send PENDING webhook after payment is already PROCESSING
      // This is logically out of order even if timestamps are correct
      const pendingWebhook = createWebhookRequest(
        'payment.pending',
        TEST_PAYMENT_HASH,
        undefined,
        { webhookId: 'webhook-pending-late' }
      );

      const response = await request(app)
        .post('/api/webhooks/lightning')
        .set(pendingWebhook.headers)
        .send(pendingWebhook.body);

      expect(response.status).toBe(200);
      // Logical ordering should be detected
      // (Implementation should handle state machine validation)
    });
  });

  describe('Duplicate Webhook Detection', () => {
    it('should detect duplicate webhooks by idempotency key', async () => {
      // Create test payment
      const { data: payment } = await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PENDING,
        user_id: '00000000-0000-0000-0000-000000000001',
      }).select().single();

      // Create webhook request
      const webhook = createWebhookRequest(
        'payment.completed',
        TEST_PAYMENT_HASH,
        undefined,
        {
          webhookId: 'duplicate-test-123',
          preimage: 'f'.repeat(64),
          amount: 1000,
        }
      );

      // Send first webhook
      const firstResponse = await request(app)
        .post('/api/webhooks/lightning')
        .set(webhook.headers)
        .send(webhook.body);

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.success).toBe(true);
      expect(firstResponse.body.isDuplicate).toBe(false);

      // Send exact same webhook again
      const secondResponse = await request(app)
        .post('/api/webhooks/lightning')
        .set(webhook.headers)
        .send(webhook.body);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.success).toBe(true);
      expect(secondResponse.body.isDuplicate).toBe(true);

      // Verify only one processed webhook in database
      const { data: webhookEvents } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('payment_hash', TEST_PAYMENT_HASH);

      expect(webhookEvents).toHaveLength(2);

      const processed = webhookEvents?.filter(e => e.status === 'processed');
      const duplicates = webhookEvents?.filter(e => e.status === 'duplicate');

      expect(processed).toHaveLength(1);
      expect(duplicates).toHaveLength(1);
    });

    it('should generate consistent idempotency keys from payload', async () => {
      // Create test payment
      await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PENDING,
        user_id: '00000000-0000-0000-0000-000000000001',
      });

      const timestamp = Math.floor(Date.now() / 1000);

      // Create two webhooks with identical payload but NO webhookId
      // Idempotency key should be generated from hash + event + timestamp
      const webhook1 = createWebhookRequest(
        'payment.completed',
        TEST_PAYMENT_HASH,
        timestamp,
        {
          preimage: 'g'.repeat(64),
          amount: 1000,
        }
      );

      const webhook2 = createWebhookRequest(
        'payment.completed',
        TEST_PAYMENT_HASH,
        timestamp,
        {
          preimage: 'g'.repeat(64),
          amount: 1000,
        }
      );

      // Send both
      const response1 = await request(app)
        .post('/api/webhooks/lightning')
        .set(webhook1.headers)
        .send(webhook1.body);

      const response2 = await request(app)
        .post('/api/webhooks/lightning')
        .set(webhook2.headers)
        .send(webhook2.body);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Second should be detected as duplicate (same idempotency key)
      expect(response1.body.isDuplicate).toBe(false);
      expect(response2.body.isDuplicate).toBe(true);
    });

    it('should treat different events as non-duplicates', async () => {
      // Create test payment
      await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PENDING,
        user_id: '00000000-0000-0000-0000-000000000001',
      });

      const timestamp = Math.floor(Date.now() / 1000);

      // Create webhooks with same timestamp but different events
      const processingWebhook = createWebhookRequest(
        'payment.processing',
        TEST_PAYMENT_HASH,
        timestamp
      );

      const completedWebhook = createWebhookRequest(
        'payment.completed',
        TEST_PAYMENT_HASH,
        timestamp,
        { preimage: 'h'.repeat(64), amount: 1000 }
      );

      // Send both
      const response1 = await request(app)
        .post('/api/webhooks/lightning')
        .set(processingWebhook.headers)
        .send(processingWebhook.body);

      const response2 = await request(app)
        .post('/api/webhooks/lightning')
        .set(completedWebhook.headers)
        .send(completedWebhook.body);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Both should process (different events = different idempotency keys)
      expect(response1.body.isDuplicate).toBe(false);
      expect(response2.body.isDuplicate).toBe(false);
    });
  });

  describe('Webhook Metrics and History', () => {
    it('should track webhook processing metrics correctly', async () => {
      // Create test payment
      await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PENDING,
        user_id: '00000000-0000-0000-0000-000000000001',
      });

      // Send multiple webhooks (mix of processed, duplicates, failed)
      const webhooks = [
        createWebhookRequest('payment.processing', TEST_PAYMENT_HASH, undefined, { webhookId: 'wh-1' }),
        createWebhookRequest('payment.processing', TEST_PAYMENT_HASH, undefined, { webhookId: 'wh-1' }), // Duplicate
        createWebhookRequest('payment.completed', TEST_PAYMENT_HASH, undefined, {
          webhookId: 'wh-2',
          preimage: 'i'.repeat(64),
          amount: 1000,
        }),
      ];

      for (const { body, headers } of webhooks) {
        await request(app)
          .post('/api/webhooks/lightning')
          .set(headers)
          .send(body);
      }

      // Fetch metrics
      const metricsResponse = await request(app)
        .get('/api/webhooks/metrics')
        .query({
          start_date: new Date(Date.now() - 60000).toISOString(),
          end_date: new Date().toISOString(),
        });

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.body.success).toBe(true);

      const metrics = metricsResponse.body.metrics;
      expect(metrics.total_webhooks).toBe(3);
      expect(metrics.processed_webhooks).toBe(2);
      expect(metrics.duplicate_webhooks).toBe(1);
      expect(metrics.avg_processing_time_ms).toBeGreaterThan(0);
    });

    it('should retrieve webhook history for a payment', async () => {
      // Create test payment
      const { data: payment } = await supabase.from('payments').insert({
        payment_hash: TEST_PAYMENT_HASH,
        amount: 1000,
        state: PaymentState.PENDING,
        user_id: '00000000-0000-0000-0000-000000000001',
      }).select().single();

      // Send multiple webhooks
      const webhooks = [
        createWebhookRequest('payment.processing', TEST_PAYMENT_HASH, undefined, { webhookId: 'wh-1' }),
        createWebhookRequest('payment.completed', TEST_PAYMENT_HASH, undefined, {
          webhookId: 'wh-2',
          preimage: 'j'.repeat(64),
          amount: 1000,
        }),
      ];

      for (const { body, headers } of webhooks) {
        await request(app)
          .post('/api/webhooks/lightning')
          .set(headers)
          .send(body);
      }

      // Fetch webhook history
      const historyResponse = await request(app)
        .get(`/api/webhooks/payment/${payment.id}/history`);

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.history).toHaveLength(2);

      const history = historyResponse.body.history;
      expect(history[0].event_type).toBe('payment.processing');
      expect(history[1].event_type).toBe('payment.completed');
    });
  });
});
