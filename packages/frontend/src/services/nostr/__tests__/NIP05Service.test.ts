/**
 * 🧪 NIP-05 Service Tests - Elite TDD Implementation
 *
 * US-306: DNS-based NOSTR identifier verification
 * Test Coverage Target: ≥95%
 *
 * Test Structure:
 * 1. Identifier Parsing
 * 2. HTTP Verification
 * 3. Caching System
 * 4. Error Handling
 * 5. Performance
 * 6. Security
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NIP05Service } from '../NIP05Service';
import type {
  NIP05Identifier,
  NIP05VerificationResult,
  NIP05VerificationStatus,
  NIP05ErrorCode,
  NIP05WellKnownResponse,
} from '@shared/types/nip05';

// ========================================
// Test Setup
// ========================================

describe('NIP05Service', () => {
  let service: NIP05Service;
  let mockFetch: ReturnType<typeof vi.fn>;

  const VALID_PUBKEY = 'a'.repeat(64);
  const VALID_IDENTIFIER = 'alice@example.com';

  beforeEach(() => {
    // Reset service instance
    service = new NIP05Service({
      storage: 'memory',
      enabled: true,
      successTTL: 24 * 60 * 60 * 1000,
      failureTTL: 60 * 60 * 1000,
      maxSize: 100,
    });

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Clear all timers
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================
  // 1. Identifier Parsing Tests
  // ========================================

  describe('parseIdentifier', () => {
    it('should parse valid NIP-05 identifier correctly', () => {
      const result = service.parseIdentifier('alice@example.com');

      expect(result.success).toBe(true);
      expect(result.parsed).toEqual({
        localPart: 'alice',
        domain: 'example.com',
        full: 'alice@example.com',
      });
      expect(result.error).toBeUndefined();
    });

    it('should normalize identifiers to lowercase', () => {
      const result = service.parseIdentifier('ALICE@EXAMPLE.COM');

      expect(result.success).toBe(true);
      expect(result.parsed?.full).toBe('alice@example.com');
      expect(result.parsed?.localPart).toBe('alice');
      expect(result.parsed?.domain).toBe('example.com');
    });

    it('should trim whitespace from identifiers', () => {
      const result = service.parseIdentifier('  alice@example.com  ');

      expect(result.success).toBe(true);
      expect(result.parsed?.full).toBe('alice@example.com');
    });

    it('should reject identifiers without @ symbol', () => {
      const result = service.parseIdentifier('aliceexample.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing @ symbol');
    });

    it('should reject identifiers with multiple @ symbols', () => {
      const result = service.parseIdentifier('alice@test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('multiple @ symbols');
    });

    it('should reject empty local parts', () => {
      const result = service.parseIdentifier('@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty domains', () => {
      const result = service.parseIdentifier('alice@');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate local part characters', () => {
      const validCases = [
        'alice@example.com',
        'alice.bob@example.com',
        'alice_bob@example.com',
        'alice-bob@example.com',
        'alice123@example.com',
        'alice.bob.charlie@example.com',
      ];

      validCases.forEach((identifier) => {
        const result = service.parseIdentifier(identifier);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid local part characters', () => {
      const invalidCases = [
        'alice+bob@example.com',
        'alice bob@example.com',
        'alice/bob@example.com',
        'alice@bob@example.com',
        'alice!@example.com',
        'alice#@example.com',
      ];

      invalidCases.forEach((identifier) => {
        const result = service.parseIdentifier(identifier);
        expect(result.success).toBe(false);
      });
    });

    it('should validate domain formats', () => {
      const validDomains = [
        'alice@example.com',
        'alice@sub.example.com',
        'alice@deep.sub.example.com',
        'alice@example.co.uk',
        'alice@example-site.com',
      ];

      validDomains.forEach((identifier) => {
        const result = service.parseIdentifier(identifier);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid domain formats', () => {
      const invalidDomains = [
        'alice@example',
        'alice@example.',
        'alice@.example.com',
        'alice@example..com',
        'alice@-example.com',
        'alice@example.com-',
      ];

      invalidDomains.forEach((identifier) => {
        const result = service.parseIdentifier(identifier);
        expect(result.success).toBe(false);
      });
    });

    it('should enforce length limits on local part', () => {
      const tooLong = 'a'.repeat(65) + '@example.com';
      const result = service.parseIdentifier(tooLong);

      expect(result.success).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should enforce length limits on domain', () => {
      const tooLong = 'alice@' + 'a'.repeat(250) + '.com';
      const result = service.parseIdentifier(tooLong);

      expect(result.success).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = ['', ' ', '@', '@@', 'alice', 'example.com'];

      edgeCases.forEach((identifier) => {
        const result = service.parseIdentifier(identifier);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  // ========================================
  // 2. HTTP Verification Tests
  // ========================================

  describe('verifyIdentifier', () => {
    const mockWellKnownResponse: NIP05WellKnownResponse = {
      names: {
        alice: VALID_PUBKEY,
      },
      relays: {
        [VALID_PUBKEY]: ['wss://relay.example.com', 'wss://relay2.example.com'],
      },
    };

    it('should verify valid NIP-05 identifier successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockWellKnownResponse,
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('verified');
      expect(result.identifier.full).toBe(VALID_IDENTIFIER);
      expect(result.actualPubkey).toBe(VALID_PUBKEY);
      expect(result.relays).toEqual(['wss://relay.example.com', 'wss://relay2.example.com']);
      expect(result.verifiedAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should construct correct .well-known URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockWellKnownResponse,
      });

      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/.well-known/nostr.json?name=alice',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });

    it('should include query parameter for local part', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ names: { 'bob.smith': VALID_PUBKEY } }),
      });

      await service.verifyIdentifier('bob.smith@example.com', VALID_PUBKEY);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/.well-known/nostr.json?name=bob.smith',
        expect.any(Object)
      );
    });

    it('should fail on HTTP 404 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('HTTP 404');
      expect(result.errorCode).toBe('HTTP_404');
    });

    it('should fail on HTTP 500 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('HTTP 500');
      expect(result.errorCode).toBe('HTTP_500');
    });

    it('should fail on network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Network error');
      expect(result.errorCode).toBe('NETWORK_ERROR');
    });

    it('should fail on timeout', async () => {
      // In jsdom, DOMException does not extend Error, so the service's
      // `instanceof Error` check fails. Use a plain Error with name='AbortError'
      // to correctly simulate what the fetch API throws on abort.
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            setTimeout(() => reject(abortError), 100);
          })
      );

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY, {
        timeout: 50,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('TIMEOUT_ERROR');
    }, 10000);

    it('should validate content-type header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        json: async () => mockWellKnownResponse,
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid content type');
      expect(result.errorCode).toBe('INVALID_CONTENT_TYPE');
    });

    it('should fail on invalid JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
    });

    it('should fail on missing names object', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ invalid: 'response' }),
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing names');
      expect(result.errorCode).toBe('MISSING_NAMES');
    });

    it('should fail when local part not found in names', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          names: {
            bob: VALID_PUBKEY,
          },
        }),
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.errorCode).toBe('NAME_NOT_FOUND');
    });

    it('should fail on pubkey mismatch', async () => {
      const differentPubkey = 'b'.repeat(64);

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          names: {
            alice: differentPubkey,
          },
        }),
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error).toContain('mismatch');
      expect(result.errorCode).toBe('PUBKEY_MISMATCH');
      expect(result.actualPubkey).toBe(differentPubkey);
    });

    it('should fail on invalid pubkey format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          names: {
            alice: 'invalid-pubkey-format',
          },
        }),
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PUBKEY_FORMAT');
    });

    it('should handle optional relays field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          names: {
            alice: VALID_PUBKEY,
          },
          // No relays field
        }),
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.relays).toBeUndefined();
    });

    it('should validate relay URLs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          names: {
            alice: VALID_PUBKEY,
          },
          relays: {
            [VALID_PUBKEY]: ['invalid-relay-url', 'wss://valid-relay.com'],
          },
        }),
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_RESPONSE');
    });

    it('should respect custom timeout option', async () => {
      const customTimeout = 100;

      // In jsdom, DOMException does not extend Error, so use a plain Error
      // with name='AbortError' to correctly simulate an aborted fetch.
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            setTimeout(() => {
              reject(abortError);
            }, customTimeout - 10);
          })
      );

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY, {
        timeout: customTimeout,
      });

      expect(result.errorCode).toBe('TIMEOUT_ERROR');
    });

    it('should set expiration timestamp to 24 hours in future', async () => {
      const now = Date.now();

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockWellKnownResponse,
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.expiresAt).toBeDefined();
      const expectedExpiration = now + 24 * 60 * 60 * 1000;
      expect(result.expiresAt!).toBeGreaterThan(now);
      expect(result.expiresAt!).toBeLessThanOrEqual(expectedExpiration + 1000); // Allow 1s tolerance
    });
  });

  // ========================================
  // 3. Caching Tests
  // ========================================

  describe('caching', () => {
    const mockWellKnownResponse: NIP05WellKnownResponse = {
      names: {
        alice: VALID_PUBKEY,
      },
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockWellKnownResponse,
      });
    });

    it('should cache successful verification results', async () => {
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only first call hits network
    });

    it('should return cached results with fromCache flag', async () => {
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);
      const cachedResult = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(cachedResult.fromCache).toBe(true);
      expect(cachedResult.method).toBe('cache');
    });

    it('should cache failed verification results with shorter TTL', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache when forceRefresh is true', async () => {
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY, {
        forceRefresh: true,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should bypass cache when useCache is false', async () => {
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY, {
        useCache: false,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should support getCachedVerification method', async () => {
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);
      const cached = await service.getCachedVerification(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(cached).toBeDefined();
      expect(cached?.verified).toBe(true);
      expect(cached?.identifier.full).toBe(VALID_IDENTIFIER);
    });

    it('should return null for non-existent cache entries', async () => {
      const cached = await service.getCachedVerification('bob@example.com', VALID_PUBKEY);

      expect(cached).toBeNull();
    });

    it('should support clearCache for specific identifier', async () => {
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);
      await service.clearCache(VALID_IDENTIFIER);
      const cached = await service.getCachedVerification(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(cached).toBeNull();
    });

    it('should support clearCache for all entries', async () => {
      await service.verifyIdentifier('alice@example.com', VALID_PUBKEY);
      await service.verifyIdentifier('bob@example.com', VALID_PUBKEY);
      await service.clearCache();

      const cached1 = await service.getCachedVerification('alice@example.com', VALID_PUBKEY);
      const cached2 = await service.getCachedVerification('bob@example.com', VALID_PUBKEY);

      expect(cached1).toBeNull();
      expect(cached2).toBeNull();
    });

    it('should expire cached entries after TTL', async () => {
      // Use fake timers
      vi.useFakeTimers();

      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      // Advance time past TTL (24 hours + 1 second)
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000);

      const cached = await service.getCachedVerification(VALID_IDENTIFIER, VALID_PUBKEY);
      expect(cached).toBeNull(); // Expired

      vi.useRealTimers();
    });

    it('should support isExpired method', async () => {
      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);
      expect(service.isExpired(result)).toBe(false);

      // Manually set expiration to past
      result.expiresAt = Date.now() - 1000;
      expect(service.isExpired(result)).toBe(true);
    });
  });

  // ========================================
  // 4. Error Handling Tests
  // ========================================

  describe('error handling', () => {
    it('should handle invalid identifier gracefully', async () => {
      const result = await service.verifyIdentifier('invalid-format', VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('INVALID_FORMAT');
    });

    it('should handle invalid pubkey format', async () => {
      const result = await service.verifyIdentifier(VALID_IDENTIFIER, 'invalid-pubkey');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle CORS errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CORS_ERROR');
    });

    it('should include error context in results', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('HTTP_404');
      expect(result.identifier).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{invalid json}',
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      });

      const result = await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
    });
  });

  // ========================================
  // 5. Performance Tests
  // ========================================

  describe('performance', () => {
    it('should complete verification within timeout', async () => {
      const timeout = 5000;

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          names: { alice: VALID_PUBKEY },
        }),
      });

      const start = Date.now();
      await service.verifyIdentifier(VALID_IDENTIFIER, VALID_PUBKEY, { timeout });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(timeout);
    });

    it('should handle concurrent verifications', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          names: { alice: VALID_PUBKEY, bob: VALID_PUBKEY, charlie: VALID_PUBKEY },
        }),
      });

      const identifiers = ['alice@example.com', 'bob@example.com', 'charlie@example.com'];

      const results = await Promise.all(
        identifiers.map((id) => service.verifyIdentifier(id, VALID_PUBKEY))
      );

      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });
  });

  // ========================================
  // 6. Security Tests
  // ========================================

  describe('security', () => {
    it('should sanitize domain inputs', () => {
      const maliciousDomains = [
        'alice@evil.com/../../../etc/passwd',
        'alice@example.com\x00.evil.com',
        'alice@example.com:8080/evil',
        'alice@127.0.0.1',
        'alice@localhost',
      ];

      maliciousDomains.forEach((identifier) => {
        const result = service.parseIdentifier(identifier);
        expect(result.success).toBe(false);
      });
    });

    it('should validate pubkey format strictly', async () => {
      const invalidPubkeys = [
        'g'.repeat(64), // Invalid hex
        'A'.repeat(64), // Uppercase
        'a'.repeat(63), // Too short
        'a'.repeat(65), // Too long
      ];

      for (const pubkey of invalidPubkeys) {
        const result = await service.verifyIdentifier(VALID_IDENTIFIER, pubkey);
        expect(result.success).toBe(false);
      }
    });

    it('should reject excessively long inputs', () => {
      const longIdentifier = 'a'.repeat(1000) + '@' + 'b'.repeat(1000) + '.com';

      const result = service.parseIdentifier(longIdentifier);
      expect(result.success).toBe(false);
    });

    it('should handle special characters safely', () => {
      const specialChars = [
        'alice<script>@example.com',
        'alice@example.com<img>',
        'alice\x00@example.com',
        'alice\n@example.com',
      ];

      specialChars.forEach((identifier) => {
        const result = service.parseIdentifier(identifier);
        expect(result.success).toBe(false);
      });
    });
  });
});
