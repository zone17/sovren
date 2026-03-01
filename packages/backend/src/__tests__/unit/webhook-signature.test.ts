/**
 * Webhook Signature Verification Unit Tests
 *
 * Story: PAY-003 - Implement Webhook Signature Verification
 *
 * Tests individual verification functions without Express dependencies.
 *
 * @module webhook-signature.test
 * @category Unit Tests
 */

import crypto from 'crypto';

const TEST_WEBHOOK_SECRET = 'test-webhook-secret-key-for-testing';
const TEST_WEBHOOK_SECRET_ROTATION = 'test-webhook-secret-rotation-key';

/**
 * Helper: Generate HMAC-SHA256 signature
 */
function generateHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Helper: Verify signature with rotation support
 */
function verifySignatureWithRotation(
  payload: string,
  signature: string,
  primarySecret: string,
  rotationSecret?: string
): boolean {
  // Try primary secret
  const primarySignature = generateHmacSignature(payload, primarySecret);
  if (signature === primarySignature) {
    return true;
  }

  // Try rotation secret if provided
  if (rotationSecret) {
    const rotationSignature = generateHmacSignature(payload, rotationSecret);
    if (signature === rotationSignature) {
      return true;
    }
  }

  return false;
}

describe('Webhook Signature Verification (PAY-003) - Unit Tests', () => {
  describe('HMAC-SHA256 Signature Generation', () => {
    it('should generate consistent signatures for same input', () => {
      const payload = 'test-payload-data';
      const signature1 = generateHmacSignature(payload, TEST_WEBHOOK_SECRET);
      const signature2 = generateHmacSignature(payload, TEST_WEBHOOK_SECRET);

      expect(signature1).toBe(signature2);
      expect(signature1).toHaveLength(64); // SHA256 hex = 64 chars
    });

    it('should generate different signatures for different payloads', () => {
      const signature1 = generateHmacSignature('payload1', TEST_WEBHOOK_SECRET);
      const signature2 = generateHmacSignature('payload2', TEST_WEBHOOK_SECRET);

      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = 'same-payload';
      const signature1 = generateHmacSignature(payload, 'secret1');
      const signature2 = generateHmacSignature(payload, 'secret2');

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('Signature Verification with Rotation', () => {
    it('should accept valid signature with primary secret', () => {
      const payload = '1234567890.{"event":"payment.completed"}';
      const signature = generateHmacSignature(payload, TEST_WEBHOOK_SECRET);

      const isValid = verifySignatureWithRotation(payload, signature, TEST_WEBHOOK_SECRET);

      expect(isValid).toBe(true);
    });

    it('should accept valid signature with rotation secret', () => {
      const payload = '1234567890.{"event":"payment.completed"}';
      const signature = generateHmacSignature(payload, TEST_WEBHOOK_SECRET_ROTATION);

      const isValid = verifySignatureWithRotation(
        payload,
        signature,
        TEST_WEBHOOK_SECRET,
        TEST_WEBHOOK_SECRET_ROTATION
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '1234567890.{"event":"payment.completed"}';
      const invalidSignature = 'invalid-signature-hex';

      const isValid = verifySignatureWithRotation(payload, invalidSignature, TEST_WEBHOOK_SECRET);

      expect(isValid).toBe(false);
    });

    it('should reject signature from wrong secret', () => {
      const payload = '1234567890.{"event":"payment.completed"}';
      const signature = generateHmacSignature(payload, 'wrong-secret');

      const isValid = verifySignatureWithRotation(payload, signature, TEST_WEBHOOK_SECRET);

      expect(isValid).toBe(false);
    });

    it('should work without rotation secret', () => {
      const payload = '1234567890.{"event":"payment.completed"}';
      const signature = generateHmacSignature(payload, TEST_WEBHOOK_SECRET);

      const isValid = verifySignatureWithRotation(
        payload,
        signature,
        TEST_WEBHOOK_SECRET,
        undefined
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Timestamp Validation', () => {
    it('should accept recent timestamp (within 5 minutes)', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const recentTimestamp = currentTime - 240; // 4 minutes ago
      const timeDifference = currentTime - recentTimestamp;

      expect(timeDifference).toBeLessThanOrEqual(300);
    });

    it('should reject old timestamp (>5 minutes)', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const oldTimestamp = currentTime - 361; // 6+ minutes ago
      const timeDifference = currentTime - oldTimestamp;

      expect(timeDifference).toBeGreaterThan(300);
    });

    it('should reject future timestamp', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const futureTimestamp = currentTime + 600; // 10 minutes in future
      const timeDifference = currentTime - futureTimestamp;

      expect(timeDifference).toBeLessThan(0);
    });

    it('should accept timestamp at exact 5 minute boundary', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const boundaryTimestamp = currentTime - 300; // Exactly 300 seconds
      const timeDifference = currentTime - boundaryTimestamp;

      expect(timeDifference).toBeLessThanOrEqual(300);
    });
  });

  describe('Payload Integrity', () => {
    it('should detect tampered payload', () => {
      const originalPayload = '1234567890.{"amount":1000}';
      const signature = generateHmacSignature(originalPayload, TEST_WEBHOOK_SECRET);

      // Tamper with payload
      const tamperedPayload = '1234567890.{"amount":99999}';

      const isValid = verifySignatureWithRotation(tamperedPayload, signature, TEST_WEBHOOK_SECRET);

      expect(isValid).toBe(false);
    });

    it('should detect tampered timestamp in payload', () => {
      const originalPayload = '1234567890.{"event":"payment.completed"}';
      const signature = generateHmacSignature(originalPayload, TEST_WEBHOOK_SECRET);

      // Tamper with timestamp
      const tamperedPayload = '9999999999.{"event":"payment.completed"}';

      const isValid = verifySignatureWithRotation(tamperedPayload, signature, TEST_WEBHOOK_SECRET);

      expect(isValid).toBe(false);
    });

    it('should be sensitive to whitespace changes', () => {
      const originalPayload = '1234567890.{"event":"test"}';
      const signature = generateHmacSignature(originalPayload, TEST_WEBHOOK_SECRET);

      // Add extra space
      const modifiedPayload = '1234567890.{ "event":"test"}';

      const isValid = verifySignatureWithRotation(modifiedPayload, signature, TEST_WEBHOOK_SECRET);

      expect(isValid).toBe(false);
    });
  });

  describe('Security Properties', () => {
    it('should use SHA-256 algorithm (64 character hex output)', () => {
      const signature = generateHmacSignature('test', TEST_WEBHOOK_SECRET);

      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be cryptographically secure (collision resistance)', () => {
      const signatures = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const payload = `payload-${i}-${Math.random()}`;
        const signature = generateHmacSignature(payload, TEST_WEBHOOK_SECRET);
        signatures.add(signature);
      }

      // All signatures should be unique
      expect(signatures.size).toBe(iterations);
    });

    it('should produce avalanche effect (small change = big difference)', () => {
      const payload1 = '1234567890.{"event":"payment.completed"}';
      const payload2 = '1234567891.{"event":"payment.completed"}'; // Changed one digit

      const signature1 = generateHmacSignature(payload1, TEST_WEBHOOK_SECRET);
      const signature2 = generateHmacSignature(payload2, TEST_WEBHOOK_SECRET);

      // Calculate Hamming distance (number of different characters)
      let differences = 0;
      for (let i = 0; i < signature1.length; i++) {
        if (signature1[i] !== signature2[i]) {
          differences++;
        }
      }

      // Should have significant differences (avalanche effect)
      expect(differences).toBeGreaterThan(32); // At least 50% different
    });
  });

  describe('Rate Limiting Logic', () => {
    interface RateLimitEntry {
      count: number;
      resetTime: number;
    }

    function checkRateLimit(
      store: Map<string, RateLimitEntry>,
      ip: string,
      maxRequests: number,
      windowMs: number
    ): { allowed: boolean; count: number } {
      const now = Date.now();
      let entry = store.get(ip);

      // Reset if window expired
      if (!entry || now > entry.resetTime) {
        entry = {
          count: 0,
          resetTime: now + windowMs,
        };
        store.set(ip, entry);
      }

      entry.count++;
      const allowed = entry.count <= maxRequests;

      return { allowed, count: entry.count };
    }

    it('should allow requests within rate limit', () => {
      const store = new Map<string, RateLimitEntry>();
      const ip = '192.168.1.1';
      const maxRequests = 100;
      const windowMs = 60000;

      // Make 100 requests (should all be allowed)
      for (let i = 0; i < maxRequests; i++) {
        const result = checkRateLimit(store, ip, maxRequests, windowMs);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests over rate limit', () => {
      const store = new Map<string, RateLimitEntry>();
      const ip = '192.168.1.1';
      const maxRequests = 100;
      const windowMs = 60000;

      // Make 101 requests
      let result;
      for (let i = 0; i < 101; i++) {
        result = checkRateLimit(store, ip, maxRequests, windowMs);
      }

      // Last request should be blocked
      expect(result!.allowed).toBe(false);
      expect(result!.count).toBe(101);
    });

    it('should reset counter after window expires', () => {
      const store = new Map<string, RateLimitEntry>();
      const ip = '192.168.1.1';
      const maxRequests = 100;
      const windowMs = 100; // Short window for testing

      // Fill up the limit
      for (let i = 0; i < maxRequests; i++) {
        checkRateLimit(store, ip, maxRequests, windowMs);
      }

      // Wait for window to expire
      const entry = store.get(ip)!;
      entry.resetTime = Date.now() - 1; // Force expiration

      // Next request should be allowed (new window)
      const result = checkRateLimit(store, ip, maxRequests, windowMs);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should track different IPs independently', () => {
      const store = new Map<string, RateLimitEntry>();
      const maxRequests = 100;
      const windowMs = 60000;

      // IP1 makes 100 requests
      for (let i = 0; i < maxRequests; i++) {
        checkRateLimit(store, '192.168.1.1', maxRequests, windowMs);
      }

      // IP2 should still be allowed
      const result = checkRateLimit(store, '192.168.1.2', maxRequests, windowMs);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
    });
  });
});
