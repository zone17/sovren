/**
 * Payment API Routes
 *
 * Example routes demonstrating idempotency middleware integration
 * for Lightning Network payment endpoints.
 *
 * @module routes/payment
 * @story PAY-010
 */

import { Router, Request, Response } from 'express';
import { IdempotencyRepository } from '../repositories/IdempotencyRepository';
import { createIdempotencyMiddleware } from '../middleware/idempotency';

/**
 * Create payment router with idempotency protection
 *
 * @param dbClient - Database client for idempotency repository
 * @returns Express router
 */
export function createPaymentRouter(dbClient: any): Router {
  const router = Router();

  // Initialize idempotency middleware
  const idempotencyRepo = new IdempotencyRepository(dbClient);
  const idempotencyMiddleware = createIdempotencyMiddleware(idempotencyRepo, {
    ttl_ms: 24 * 60 * 60 * 1000, // 24 hours
    header_name: 'Idempotency-Key',
    required: true,
    endpoints: ['/api/lightning', '/api/payments'],
    enable_cleanup: true,
  });

  /**
   * POST /api/lightning/invoice
   *
   * Create Lightning Network invoice
   * Protected by idempotency middleware
   */
  router.post(
    '/api/lightning/invoice',
    idempotencyMiddleware,
    async (req: Request, res: Response) => {
      try {
        const { amount_sats, memo, expiry } = req.body;

        // Validate input
        if (!amount_sats || amount_sats <= 0) {
          return res.status(400).json({
            error: 'Invalid amount_sats. Must be positive integer.',
          });
        }

        // TODO: Integrate with actual Lightning Network node
        // For now, return mock invoice
        const invoice = {
          payment_request: `lnbc${amount_sats}n1...`, // Mock BOLT11 invoice
          payment_hash: generateMockPaymentHash(),
          amount_sats,
          memo: memo || '',
          expiry: expiry || 3600,
          created_at: new Date().toISOString(),
        };

        res.status(201).json({
          success: true,
          invoice,
        });
      } catch (error) {
        console.error('Invoice creation failed:', error);
        res.status(500).json({
          error: 'Failed to create invoice',
          code: 'INVOICE_CREATION_FAILED',
        });
      }
    }
  );

  /**
   * POST /api/payments/process
   *
   * Process payment
   * Protected by idempotency middleware
   */
  router.post(
    '/api/payments/process',
    idempotencyMiddleware,
    async (req: Request, res: Response) => {
      try {
        const { payment_request, amount_sats, creator_id } = req.body;

        // Validate input
        if (!payment_request) {
          return res.status(400).json({
            error: 'payment_request is required',
          });
        }

        // TODO: Integrate with actual Lightning Network payment processing
        // For now, return mock payment result
        const payment = {
          payment_hash: generateMockPaymentHash(),
          payment_request,
          amount_sats: amount_sats || 0,
          creator_id: creator_id || null,
          status: 'completed',
          fee_sats: Math.ceil(amount_sats * 0.001), // 0.1% fee
          settled_at: new Date().toISOString(),
        };

        res.status(200).json({
          success: true,
          payment,
        });
      } catch (error) {
        console.error('Payment processing failed:', error);
        res.status(500).json({
          error: 'Failed to process payment',
          code: 'PAYMENT_PROCESSING_FAILED',
        });
      }
    }
  );

  /**
   * GET /api/payments/:paymentHash
   *
   * Get payment status (no idempotency needed for GET)
   */
  router.get('/api/payments/:paymentHash', async (req: Request, res: Response) => {
    try {
      const { paymentHash } = req.params;

      // TODO: Fetch from database
      const payment = {
        payment_hash: paymentHash,
        status: 'completed',
        amount_sats: 10000,
        created_at: new Date().toISOString(),
      };

      res.status(200).json({
        success: true,
        payment,
      });
    } catch (error) {
      console.error('Payment lookup failed:', error);
      res.status(500).json({
        error: 'Failed to lookup payment',
        code: 'PAYMENT_LOOKUP_FAILED',
      });
    }
  });

  return router;
}

/**
 * Generate mock payment hash for testing
 */
function generateMockPaymentHash(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}
