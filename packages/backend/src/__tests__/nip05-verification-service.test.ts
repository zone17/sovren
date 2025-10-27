import { jest } from '@jest/globals';
import { SupabaseDatabase } from '../config/database';
import { createNIP05VerificationService } from '../services/nip05-verification-service';

// 🧪 Mock Dependencies
jest.mock('../config/database');
jest.mock('dns');
jest.mock('crypto');

const mockDatabase = {
  client: {
    from: jest.fn(),
    raw: jest.fn(),
  },
} as unknown as SupabaseDatabase;

// Mock DNS functions
const mockDnsLookup = jest.fn();
const mockDnsResolveTxt = jest.fn();

// Mock fetch globally
global.fetch = jest.fn();

describe('🔍 NIP-05 Verification Service', () => {
  let service: ReturnType<typeof createNIP05VerificationService>;
  let mockFromChain: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock database chain
    mockFromChain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };

    (mockDatabase.client.from as jest.Mock).mockReturnValue(mockFromChain);

    service = createNIP05VerificationService(mockDatabase);
  });

  describe('📝 NIP-05 Identifier Parsing', () => {
    it('should parse valid NIP-05 identifier correctly', () => {
      const result = service.parseNIP05Identifier('alice@example.com');

      expect(result.success).toBe(true);
      expect(result.parsed).toEqual({
        localPart: 'alice',
        domain: 'example.com',
        full: 'alice@example.com',
      });
    });

    it('should handle case normalization', () => {
      const result = service.parseNIP05Identifier('ALICE@EXAMPLE.COM');

      expect(result.success).toBe(true);
      expect(result.parsed?.full).toBe('alice@example.com');
    });

    it('should reject invalid formats', () => {
      const testCases = [
        'invalid-format',
        'alice@',
        '@example.com',
        'alice@@example.com',
        'alice@example@com',
        '',
        'a'.repeat(65) + '@example.com', // Too long local part
        'alice@' + 'a'.repeat(250) + '.com', // Too long domain
      ];

      testCases.forEach((identifier) => {
        const result = service.parseNIP05Identifier(identifier);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should validate local part format', () => {
      const validCases = ['alice', 'alice.bob', 'alice_bob', 'alice-bob', 'alice123'];
      const invalidCases = ['alice@bob', 'alice/bob', 'alice bob', 'alice+bob'];

      validCases.forEach((localPart) => {
        const result = service.parseNIP05Identifier(`${localPart}@example.com`);
        expect(result.success).toBe(true);
      });

      invalidCases.forEach((localPart) => {
        const result = service.parseNIP05Identifier(`${localPart}@example.com`);
        expect(result.success).toBe(false);
      });
    });

    it('should validate domain format', () => {
      const validDomains = ['example.com', 'sub.example.com', 'example-site.co.uk'];
      const invalidDomains = ['example', 'example.', '.example.com', 'example..com'];

      validDomains.forEach((domain) => {
        const result = service.parseNIP05Identifier(`alice@${domain}`);
        expect(result.success).toBe(true);
      });

      invalidDomains.forEach((domain) => {
        const result = service.parseNIP05Identifier(`alice@${domain}`);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('🆕 Verification Request Creation', () => {
    const validRequest = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      nostr_pubkey: 'a'.repeat(64),
      nip05_identifier: 'alice@example.com',
      domain: 'example.com',
      local_part: 'alice',
      verification_method: 'http' as const,
      metadata: { test: true },
    };

    it('should create verification request successfully', async () => {
      // Mock successful database operations
      mockFromChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found (OK for new verification)
      });

      mockFromChain.insert.mockReturnValue({
        ...mockFromChain,
        single: jest.fn().mockResolvedValue({
          data: { id: 'verification-id', ...validRequest },
          error: null,
        }),
      });

      // Mock successful HTTP verification
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            names: { alice: 'a'.repeat(64) },
            relays: {},
          }),
      });

      const result = await service.createVerificationRequest(validRequest);

      expect(result.success).toBe(true);
      expect(result.verification).toBeDefined();
      expect(mockFromChain.insert).toHaveBeenCalled();
    });

    it('should reject invalid request data', async () => {
      const invalidRequests = [
        { ...validRequest, user_id: 'invalid-uuid' },
        { ...validRequest, nostr_pubkey: 'invalid-pubkey' },
        { ...validRequest, nip05_identifier: 'invalid-format' },
        { ...validRequest, verification_method: 'invalid' as any },
      ];

      for (const request of invalidRequests) {
        const result = await service.createVerificationRequest(request);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should prevent duplicate verified identifiers', async () => {
      // Mock existing verified identifier
      mockFromChain.single.mockResolvedValue({
        data: { verification_status: 'verified' },
        error: null,
      });

      const result = await service.createVerificationRequest(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already verified');
    });

    it('should check domain limits', async () => {
      // Mock no existing verification
      mockFromChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock domain limit exceeded
      mockFromChain.select.mockReturnValue({
        ...mockFromChain,
        eq: jest.fn().mockReturnValue({
          ...mockFromChain,
          data: new Array(1001).fill({ id: 'test' }), // Exceed limit
          error: null,
        }),
      });

      const result = await service.createVerificationRequest(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('limit exceeded');
    });
  });

  describe('🔍 HTTP Verification', () => {
    it('should perform successful HTTP verification', async () => {
      const mockResponse = {
        names: { alice: 'a'.repeat(64) },
        relays: { ['a'.repeat(64)]: ['wss://relay.example.com'] },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.method).toBe('http');
      expect(result.verification_data).toBeDefined();
      expect(result.expires_at).toBeDefined();
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error).toContain('HTTP 404');
    });

    it('should handle invalid JSON responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ invalid: 'response' }),
      });

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing names object');
    });

    it('should handle public key mismatches', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            names: { alice: 'b'.repeat(64) }, // Different pubkey
          }),
      });

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Public key mismatch');
    });

    it('should handle missing local parts', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            names: { bob: 'a'.repeat(64) }, // Different local part
          }),
      });

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in names');
    });

    it('should handle network timeouts', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should validate content type', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        json: () => Promise.resolve({}),
      });

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid content type');
    });
  });

  describe('🔍 DNS Verification', () => {
    beforeEach(() => {
      // Mock DNS resolution
      jest.doMock('dns', () => ({
        resolveTxt: mockDnsResolveTxt,
        lookup: mockDnsLookup,
      }));
    });

    it('should perform successful DNS verification', async () => {
      const mockTxtRecords = [['nostr={"names":{"alice":"' + 'a'.repeat(64) + '"}}']];

      mockDnsResolveTxt.mockResolvedValue(mockTxtRecords);

      const result = await service.performDNSVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.method).toBe('dns');
      expect(result.verification_data).toBeDefined();
    });

    it('should handle DNS resolution failures', async () => {
      mockDnsResolveTxt.mockRejectedValue(new Error('DNS resolution failed'));

      const result = await service.performDNSVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('DNS lookup failed');
    });

    it('should handle missing DNS records', async () => {
      mockDnsResolveTxt.mockResolvedValue([]);

      const result = await service.performDNSVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid NIP-05 DNS record found');
    });

    it('should handle invalid DNS record format', async () => {
      const mockTxtRecords = [['invalid-record'], ['nostr=invalid-json']];

      mockDnsResolveTxt.mockResolvedValue(mockTxtRecords);

      const result = await service.performDNSVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid NIP-05 DNS record found');
    });

    it('should handle public key mismatches in DNS', async () => {
      const mockTxtRecords = [['nostr={"names":{"alice":"' + 'b'.repeat(64) + '"}}']];

      mockDnsResolveTxt.mockResolvedValue(mockTxtRecords);

      const result = await service.performDNSVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid NIP-05 DNS record found');
    });
  });

  describe('📋 Verification Management', () => {
    it('should list user verifications', async () => {
      const mockVerifications = [
        {
          id: 'verification-1',
          nip05_identifier: 'alice@example.com',
          verification_status: 'verified',
        },
        {
          id: 'verification-2',
          nip05_identifier: 'bob@example.com',
          verification_status: 'pending',
        },
      ];

      mockFromChain.order.mockResolvedValue({
        data: mockVerifications,
        error: null,
      });

      const result = await service.listUserVerifications('user-id');

      expect(result.success).toBe(true);
      expect(result.verifications).toHaveLength(2);
      expect(mockFromChain.eq).toHaveBeenCalledWith('user_id', 'user-id');
    });

    it('should handle database errors in listing', async () => {
      mockFromChain.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await service.listUserVerifications('user-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should get verification by identifier', async () => {
      const mockVerification = {
        id: 'verification-1',
        nip05_identifier: 'alice@example.com',
        verification_status: 'verified',
      };

      mockFromChain.single.mockResolvedValue({
        data: mockVerification,
        error: null,
      });

      const result = await service.getVerificationByIdentifier('alice@example.com');

      expect(result.success).toBe(true);
      expect(result.verification).toEqual(mockVerification);
    });

    it('should handle not found verifications', async () => {
      mockFromChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found
      });

      const result = await service.getVerificationByIdentifier('alice@example.com');

      expect(result.success).toBe(true);
      expect(result.verification).toBeUndefined();
    });

    it('should revoke verification', async () => {
      mockFromChain.update.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.revokeVerification('verification-id', 'Test reason');

      expect(result.success).toBe(true);
      expect(mockFromChain.update).toHaveBeenCalledWith({
        verification_status: 'revoked',
        failure_reason: 'Test reason',
        updated_at: expect.any(String),
      });
    });

    it('should refresh verification', async () => {
      const mockVerification = {
        id: 'verification-id',
        domain: 'example.com',
        local_part: 'alice',
        nostr_pubkey: 'a'.repeat(64),
        verification_method: 'http',
      };

      mockFromChain.single.mockResolvedValue({
        data: mockVerification,
        error: null,
      });

      // Mock successful HTTP verification
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            names: { alice: 'a'.repeat(64) },
          }),
      });

      const result = await service.refreshVerification('verification-id');

      expect(result.success).toBe(true);
      expect(result.result?.verified).toBe(true);
    });
  });

  describe('🔄 Verification Updates', () => {
    it('should update verification record with success', async () => {
      const mockResult = {
        success: true,
        verified: true,
        method: 'http' as const,
        verification_data: { test: 'data' },
        expires_at: new Date().toISOString(),
      };

      mockFromChain.update.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.updateVerificationRecord('verification-id', mockResult);

      expect(result.success).toBe(true);
      expect(mockFromChain.update).toHaveBeenCalledWith({
        verification_status: 'verified',
        verification_data: { test: 'data' },
        last_checked_at: expect.any(String),
        check_count: expect.any(Object), // raw SQL
        failure_reason: null,
        verified_at: expect.any(String),
        expires_at: mockResult.expires_at,
        updated_at: expect.any(String),
      });
    });

    it('should update verification record with failure', async () => {
      const mockResult = {
        success: false,
        verified: false,
        method: 'http' as const,
        error: 'Verification failed',
      };

      mockFromChain.update.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.updateVerificationRecord('verification-id', mockResult);

      expect(result.success).toBe(true);
      expect(mockFromChain.update).toHaveBeenCalledWith({
        verification_status: 'failed',
        verification_data: {},
        last_checked_at: expect.any(String),
        check_count: expect.any(Object),
        failure_reason: 'Verification failed',
        verified_at: null,
        expires_at: null,
        updated_at: expect.any(String),
      });
    });

    it('should handle database update errors', async () => {
      const mockResult = {
        success: true,
        verified: true,
        method: 'http' as const,
      };

      mockFromChain.update.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      const result = await service.updateVerificationRecord('verification-id', mockResult);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  describe('⚡ Performance and Caching', () => {
    it('should cache verification results', async () => {
      // Mock successful HTTP verification
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            names: { alice: 'a'.repeat(64) },
          }),
      });

      // First call
      const result1 = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      // Second call (should use cache)
      const result2 = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it('should respect cache TTL', async () => {
      // Mock time progression
      const originalDateNow = Date.now;
      let mockTime = 1000000000000;
      Date.now = () => mockTime;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            names: { alice: 'a'.repeat(64) },
          }),
      });

      // First call
      await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      // Advance time beyond cache TTL (1 hour + 1 second)
      mockTime += 3601 * 1000;

      // Second call (should bypass cache)
      await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Restore original Date.now
      Date.now = originalDateNow;
    });
  });

  describe('🔒 Security and Validation', () => {
    it('should validate domain formats strictly', () => {
      const maliciousDomains = [
        'evil.com/../../../etc/passwd',
        'example.com\x00.evil.com',
        'example.com:8080/evil',
        '127.0.0.1',
        'localhost:3000',
      ];

      maliciousDomains.forEach((domain) => {
        const result = service.parseNIP05Identifier(`alice@${domain}`);
        expect(result.success).toBe(false);
      });
    });

    it('should validate public key formats', async () => {
      const invalidPubkeys = [
        'invalid-pubkey',
        'a'.repeat(63), // Too short
        'a'.repeat(65), // Too long
        'g'.repeat(64), // Invalid hex character
        'A'.repeat(64), // Uppercase (should be lowercase)
      ];

      for (const pubkey of invalidPubkeys) {
        const request = {
          user_id: '123e4567-e89b-12d3-a456-426614174000',
          nostr_pubkey: pubkey,
          nip05_identifier: 'alice@example.com',
          domain: 'example.com',
          local_part: 'alice',
          verification_method: 'http' as const,
        };

        const result = await service.createVerificationRequest(request);
        expect(result.success).toBe(false);
      }
    });

    it('should sanitize user inputs', async () => {
      const maliciousInputs = [
        'alice<script>alert(1)</script>@example.com',
        'alice@example.com<img src=x onerror=alert(1)>',
        'alice@example.com\x00\x01\x02',
      ];

      maliciousInputs.forEach((identifier) => {
        const result = service.parseNIP05Identifier(identifier);
        expect(result.success).toBe(false);
      });
    });

    it('should handle large payloads gracefully', async () => {
      const largeIdentifier = 'a'.repeat(1000) + '@' + 'b'.repeat(1000) + '.com';

      const result = service.parseNIP05Identifier(largeIdentifier);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('🔄 Error Handling and Recovery', () => {
    it('should handle network failures gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle malformed JSON responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should handle database connection failures', async () => {
      mockFromChain.single.mockRejectedValue(new Error('Database connection failed'));

      const request = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        nostr_pubkey: 'a'.repeat(64),
        nip05_identifier: 'alice@example.com',
        domain: 'example.com',
        local_part: 'alice',
        verification_method: 'http' as const,
      };

      const result = await service.createVerificationRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    it('should handle concurrent verification attempts', async () => {
      const request = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        nostr_pubkey: 'a'.repeat(64),
        nip05_identifier: 'alice@example.com',
        domain: 'example.com',
        local_part: 'alice',
        verification_method: 'http' as const,
      };

      // Mock database constraint violation
      mockFromChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockFromChain.insert.mockReturnValue({
        ...mockFromChain,
        single: jest.fn().mockRejectedValue({
          code: '23505', // Unique constraint violation
          message: 'duplicate key value violates unique constraint',
        }),
      });

      const result = await service.createVerificationRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('duplicate key value');
    });
  });

  describe('📊 Performance Metrics', () => {
    it('should complete verification within performance targets', async () => {
      const startTime = Date.now();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            names: { alice: 'a'.repeat(64) },
          }),
      });

      await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle timeout scenarios', async () => {
      // Mock a slow response that times out
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  headers: { get: () => 'application/json' },
                  json: () => Promise.resolve({ names: { alice: 'a'.repeat(64) } }),
                }),
              35000
            ); // 35 seconds (exceeds 30s timeout)
          })
      );

      const result = await service.performHTTPVerification('example.com', 'alice', 'a'.repeat(64));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
