/**
 * Webhook Security Utilities
 *
 * Provides constant-time HMAC verification for webhook payloads
 * to prevent timing side-channel attacks.
 *
 * @module webhook-security
 */

import crypto from 'crypto';

/**
 * Verify a webhook HMAC signature using constant-time comparison.
 *
 * @param payload - The raw webhook payload (string or Buffer)
 * @param signature - The HMAC signature to verify (hex-encoded)
 * @param secret - The shared webhook secret
 * @param algorithm - Hash algorithm (default: 'sha256')
 * @returns true if the signature is valid
 */
export function verifyWebhookHmac(
  payload: string | Buffer,
  signature: string,
  secret: string,
  algorithm: string = 'sha256'
): boolean {
  if (!payload || !signature || !secret) {
    return false;
  }

  const expected = crypto.createHmac(algorithm, secret).update(payload).digest('hex');

  // Length check before timingSafeEqual (required: both buffers must be same length)
  if (signature.length !== expected.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    // timingSafeEqual throws if buffers differ in byte length (e.g. invalid hex)
    return false;
  }
}
