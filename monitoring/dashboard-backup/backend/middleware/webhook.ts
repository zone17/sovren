/**
 * Webhook Security Middleware - PAY-016
 *
 * HMAC signature verification for Lightning webhook requests.
 * Prevents replay attacks and ensures webhook authenticity.
 *
 * @module middleware/webhook
 * @story PAY-016 (PAY-003 implementation)
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Secret key for HMAC verification */
  secret: string;
  /** Algorithm (default: sha256) */
  algorithm?: string;
  /** Max age for webhook timestamp (default: 5 minutes) */
  maxAgeMs?: number;
  /** Signature header name */
  signatureHeader?: string;
  /** Timestamp header name */
  timestampHeader?: string;
}

/**
 * In-memory replay attack prevention store
 * In production, use Redis or similar distributed cache
 */
const processedWebhooks = new Map<string, number>();

/**
 * Compute HMAC signature
 */
function computeSignature(
  payload: string,
  timestamp: string,
  secret: string,
  algorithm: string = 'sha256'
): string {
  const data = `${timestamp}.${payload}`;
  return crypto.createHmac(algorithm, secret).update(data).digest('hex');
}

/**
 * Create webhook verification middleware
 */
export function createWebhookMiddleware(config: WebhookConfig) {
  const {
    secret,
    algorithm = 'sha256',
    maxAgeMs = 5 * 60 * 1000, // 5 minutes
    signatureHeader = 'X-Webhook-Signature',
    timestampHeader = 'X-Webhook-Timestamp',
  } = config;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract headers
      const signature = req.get(signatureHeader);
      const timestamp = req.get(timestampHeader);

      if (!signature || !timestamp) {
        res.status(401).json({
          error: 'Missing webhook signature or timestamp',
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: `${signatureHeader} and ${timestampHeader} headers are required`,
        });
        return;
      }

      // Validate timestamp format
      const webhookTimestamp = parseInt(timestamp, 10);
      if (isNaN(webhookTimestamp)) {
        res.status(401).json({
          error: 'Invalid timestamp format',
          code: 'INVALID_TIMESTAMP',
        });
        return;
      }

      // Check timestamp age (replay attack prevention)
      const now = Date.now();
      const age = now - webhookTimestamp;

      if (age > maxAgeMs) {
        res.status(401).json({
          error: 'Webhook timestamp too old',
          code: 'REPLAY_ATTACK_DETECTED',
          message: `Webhook must be delivered within ${maxAgeMs / 1000} seconds`,
        });
        return;
      }

      // Prevent future timestamps
      if (webhookTimestamp > now + 60000) {
        // Allow 1 minute clock skew
        res.status(401).json({
          error: 'Webhook timestamp is in the future',
          code: 'INVALID_TIMESTAMP',
        });
        return;
      }

      // Check for duplicate webhook (idempotency)
      const webhookId = `${timestamp}-${signature}`;
      if (processedWebhooks.has(webhookId)) {
        console.warn('Duplicate webhook detected:', webhookId);
        res.status(409).json({
          error: 'Duplicate webhook',
          code: 'DUPLICATE_WEBHOOK',
          message: 'This webhook has already been processed',
        });
        return;
      }

      // Compute expected signature
      const payload = JSON.stringify(req.body);
      const expectedSignature = computeSignature(payload, timestamp, secret, algorithm);

      // Constant-time comparison to prevent timing attacks
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length) {
        res.status(401).json({
          error: 'Invalid signature',
          code: 'INVALID_WEBHOOK_SIGNATURE',
        });
        return;
      }

      const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        console.error('Webhook signature verification failed');
        res.status(401).json({
          error: 'Invalid signature',
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'HMAC signature verification failed',
        });
        return;
      }

      // Mark webhook as processed
      processedWebhooks.set(webhookId, now);

      // Cleanup old entries (prevent memory leak)
      for (const [id, timestamp] of processedWebhooks.entries()) {
        if (now - timestamp > maxAgeMs * 2) {
          processedWebhooks.delete(id);
        }
      }

      // Webhook is valid, proceed
      next();
    } catch (error) {
      console.error('Webhook verification error:', error);
      res.status(500).json({
        error: 'Webhook verification failed',
        code: 'WEBHOOK_VERIFICATION_ERROR',
      });
    }
  };
}

/**
 * Generate webhook signature for testing
 */
export function generateWebhookSignature(
  payload: any,
  secret: string,
  algorithm: string = 'sha256'
): { signature: string; timestamp: string } {
  const timestamp = Date.now().toString();
  const payloadString = JSON.stringify(payload);
  const signature = computeSignature(payloadString, timestamp, secret, algorithm);

  return { signature, timestamp };
}

/**
 * Clear processed webhooks cache (for testing)
 */
export function clearWebhookCache(): void {
  processedWebhooks.clear();
}
