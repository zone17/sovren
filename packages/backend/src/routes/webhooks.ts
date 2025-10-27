/**
 * Webhook Routes
 *
 * Story: PAY-003 - Implement Webhook Signature Verification
 *
 * Handles incoming webhooks from Lightning Network payment providers.
 * Implements comprehensive HMAC-SHA256 signature verification, rate limiting,
 * replay attack prevention, and security logging.
 *
 * Security Features:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation (max 5 minutes old)
 * - Replay attack prevention
 * - Rate limiting (100 requests/minute per IP)
 * - Webhook secret rotation support
 * - IP address logging for security events
 *
 * @module webhooks
 * @category Routes
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PaymentStateMachine } from '../services/payment/PaymentStateMachine';
import { createClient } from '@supabase/supabase-js';
import {
  PaymentState,
  WebhookTimestampExpiredError,
  InvalidWebhookSignatureError,
  MissingWebhookHeadersError,
} from '@sovren/shared/types';

const router = express.Router();

// Initialize Supabase client (only if credentials exist)
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

// Initialize Payment State Machine (only if Supabase available)
const paymentStateMachine = supabase ? new PaymentStateMachine({ supabase }) : null;

// Webhook secrets for signature verification
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const WEBHOOK_SECRET_ROTATION = process.env.WEBHOOK_SECRET_ROTATION || '';
const WEBHOOK_TIMESTAMP_TOLERANCE = 300; // 5 minutes in seconds

// Rate limiting configuration
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Extract client IP address from request
 * Handles proxied requests and X-Forwarded-For header
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Rate Limiting Middleware for Webhooks
 * Limits webhooks to 100 requests per minute per IP address
 */
function rateLimitWebhook(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req);
  const now = Date.now();

  // Get or create rate limit entry for this IP
  let limitEntry = rateLimitStore.get(clientIp);

  // Reset counter if window has expired
  if (!limitEntry || now > limitEntry.resetTime) {
    limitEntry = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitStore.set(clientIp, limitEntry);
  }

  // Increment request count
  limitEntry.count++;

  // Check if limit exceeded
  if (limitEntry.count > RATE_LIMIT_MAX_REQUESTS) {
    console.error(
      `[WEBHOOK SECURITY] Rate limit exceeded for IP: ${clientIp}, ` +
        `Requests: ${limitEntry.count}/${RATE_LIMIT_MAX_REQUESTS}`
    );

    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((limitEntry.resetTime - now) / 1000),
    });
  }

  next();
}

/**
 * Verify HMAC signature with support for secret rotation
 */
function verifySignature(payload: string, signature: string): boolean {
  // Try primary secret
  const primarySignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (signature === primarySignature) {
    return true;
  }

  // Try rotation secret if configured
  if (WEBHOOK_SECRET_ROTATION) {
    const rotationSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET_ROTATION)
      .update(payload)
      .digest('hex');

    if (signature === rotationSignature) {
      console.info('[WEBHOOK] Request verified with rotation secret');
      return true;
    }
  }

  return false;
}

/**
 * Enhanced Webhook Signature Verification Middleware
 *
 * Security Features:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation (prevents replay attacks)
 * - Secret rotation support
 * - IP address logging for failed verifications
 */
function verifyWebhookSignature(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req);

  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;

    // Check for required headers
    if (!signature || !timestamp) {
      console.error(
        `[WEBHOOK SECURITY] Missing headers from IP: ${clientIp}, ` +
          `Signature: ${!!signature}, Timestamp: ${!!timestamp}`
      );
      throw new MissingWebhookHeadersError(['x-webhook-signature', 'x-webhook-timestamp']);
    }

    // Verify timestamp is recent (prevent replay attacks)
    const currentTime = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);
    const timeDifference = currentTime - webhookTime;

    // Check for future timestamps and old timestamps
    if (timeDifference < 0) {
      console.error(
        `[WEBHOOK SECURITY] Future timestamp detected from IP: ${clientIp}, ` +
          `Difference: ${Math.abs(timeDifference)}s`
      );
      throw new WebhookTimestampExpiredError(webhookTime, currentTime);
    }

    if (timeDifference > WEBHOOK_TIMESTAMP_TOLERANCE) {
      console.error(
        `[WEBHOOK SECURITY] Replay attack attempt from IP: ${clientIp}, ` +
          `Timestamp age: ${timeDifference}s, Max allowed: ${WEBHOOK_TIMESTAMP_TOLERANCE}s`
      );
      throw new WebhookTimestampExpiredError(webhookTime, currentTime);
    }

    // Verify signature with rotation support
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const isValid = verifySignature(payload, signature);

    if (!isValid) {
      console.error(
        `[WEBHOOK SECURITY] Invalid signature from IP: ${clientIp}, ` +
          `Timestamp: ${timestamp}, ` +
          `Payload hash: ${crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16)}...`
      );
      throw new InvalidWebhookSignatureError();
    }

    // Signature valid, proceed
    next();
  } catch (error) {
    // Check error by name (more reliable than instanceof in some cases)
    if (error && typeof error === 'object' && 'name' in error) {
      const errorName = (error as Error).name;
      if (
        errorName === 'WebhookTimestampExpiredError' ||
        errorName === 'InvalidWebhookSignatureError' ||
        errorName === 'MissingWebhookHeadersError'
      ) {
        return res.status(401).json({
          success: false,
          error: (error as Error).message,
        });
      }
    }

    // Also check instanceof for completeness
    if (
      error instanceof WebhookTimestampExpiredError ||
      error instanceof InvalidWebhookSignatureError ||
      error instanceof MissingWebhookHeadersError
    ) {
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }

    console.error(`[WEBHOOK] Verification error from IP: ${clientIp}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Webhook verification failed',
    });
  }
}

/**
 * @route POST /api/webhooks/lightning
 * @desc Process Lightning Network payment webhooks
 * @access Public (with rate limiting and signature verification)
 */
router.post(
  '/lightning',
  rateLimitWebhook,
  verifyWebhookSignature,
  async (req: Request, res: Response) => {
    try {
      const { event, paymentHash, preimage, amount, error, timestamp } = req.body;

      // Validate required fields
      if (!event || !paymentHash) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: event, paymentHash',
        });
      }

      // Check if Supabase is available
      if (!supabase || !paymentStateMachine) {
        console.error('[WEBHOOK] Supabase not configured, cannot process webhook');
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
        });
      }

      // Find payment by payment hash
      const { data: payment, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_hash', paymentHash)
        .single();

      if (fetchError || !payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      // Process webhook event based on type
      let targetState: PaymentState | null = null;
      const metadata: Record<string, unknown> = {
        webhookEvent: event,
        timestamp,
      };

      switch (event) {
        case 'payment.processing':
          targetState = PaymentState.PROCESSING;
          break;

        case 'payment.completed':
          targetState = PaymentState.COMPLETED;
          metadata.preimage = preimage;
          metadata.amount = amount;
          // Update payment record with preimage
          await supabase
            .from('payments')
            .update({ preimage })
            .eq('id', payment.id);
          break;

        case 'payment.failed':
          targetState = PaymentState.FAILED;
          metadata.error = error;
          metadata.failureReason = error;
          break;

        case 'payment.expired':
          targetState = PaymentState.EXPIRED;
          metadata.reason = 'Invoice expired';
          break;

        default:
          return res.status(400).json({
            success: false,
            error: `Unknown webhook event: ${event}`,
          });
      }

      // Transition payment state
      if (targetState) {
        await paymentStateMachine.transition(payment.id, targetState, metadata);
      }

      // Return success response
      res.json({
        success: true,
        message: `Webhook processed: ${event}`,
        paymentId: payment.id,
        newState: targetState,
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook',
      });
    }
  }
);

/**
 * @route GET /api/webhooks/health
 * @desc Health check endpoint for webhook service
 * @access Public
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'webhooks',
    status: 'healthy',
    timestamp: Date.now(),
  });
});

export default router;
