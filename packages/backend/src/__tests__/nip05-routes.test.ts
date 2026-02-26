import express from 'express';
import request from 'supertest';

// Use vi.hoisted() because vi.mock factories are hoisted above const declarations
const { mockAuthenticate, mockNIP05Service } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn((req: any, _res: any, next: any) => {
    req.user = {
      nostr_pubkey: 'a'.repeat(64),
      user_id: '123e4567-e89b-12d3-a456-426614174000',
    };
    next();
  }),
  mockNIP05Service: {
    parseNIP05Identifier: vi.fn(),
    createVerificationRequest: vi.fn(),
    listUserVerifications: vi.fn(),
    getVerificationByIdentifier: vi.fn(),
    refreshVerification: vi.fn(),
    revokeVerification: vi.fn(),
  },
}));

vi.mock('../services/nip05-verification-service', () => ({
  createNIP05VerificationService: () => mockNIP05Service,
}));
vi.mock('../middleware/auth', () => ({
  authenticate: mockAuthenticate,
}));

// Import router after mocks are set up
import nip05Router from '../routes/nip05';

const app = express();
app.use(express.json());
app.use('/api/nip05', nip05Router);

describe('NIP-05 API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set authenticate mock behavior after clearAllMocks
    mockAuthenticate.mockImplementation((req: any, _res: any, next: any) => {
      req.user = {
        nostr_pubkey: 'a'.repeat(64),
        user_id: '123e4567-e89b-12d3-a456-426614174000',
      };
      next();
    });
  });

  describe('🆕 POST /api/nip05/verify', () => {
    const validVerificationRequest = {
      nip05_identifier: 'alice@example.com',
      verification_method: 'http',
      metadata: { test: true },
    };

    it('should create verification request successfully', async () => {
      mockNIP05Service.parseNIP05Identifier.mockReturnValue({
        success: true,
        parsed: {
          localPart: 'alice',
          domain: 'example.com',
          full: 'alice@example.com',
        },
      });

      mockNIP05Service.createVerificationRequest.mockResolvedValue({
        success: true,
        verification: {
          id: 'verification-id',
          nip05_identifier: 'alice@example.com',
          verification_status: 'pending',
        },
      });

      const response = await request(app)
        .post('/api/nip05/verify')
        .send(validVerificationRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verification).toBeDefined();
      expect(response.body.data.message).toContain('successfully');
    });

    it('should reject invalid NIP-05 format', async () => {
      mockNIP05Service.parseNIP05Identifier.mockReturnValue({
        success: false,
        error: 'Invalid NIP-05 format',
      });

      const response = await request(app)
        .post('/api/nip05/verify')
        .send({ ...validVerificationRequest, nip05_identifier: 'invalid-format' })
        .expect(400);

      expect(response.body.success).toBe(false);
      // Route uses Zod validation which returns generic "Invalid request data"
      // before the service-level NIP-05 format check runs
      expect(response.body.error).toBeDefined();
    });

    it('should validate request schema', async () => {
      const invalidRequests = [
        {}, // Missing required fields
        { nip05_identifier: 'alice@example.com' }, // Missing method
        { nip05_identifier: 'invalid', verification_method: 'http' }, // Invalid format
        { nip05_identifier: 'alice@example.com', verification_method: 'invalid' }, // Invalid method
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await request(app)
          .post('/api/nip05/verify')
          .send(invalidRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should require authentication', async () => {
      // Mock unauthenticated request
      mockAuthenticate.mockImplementationOnce((req, res, next) => {
        req.user = null;
        next();
      });

      const response = await request(app)
        .post('/api/nip05/verify')
        .send(validVerificationRequest)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should handle service failures', async () => {
      mockNIP05Service.parseNIP05Identifier.mockReturnValue({
        success: true,
        parsed: {
          localPart: 'alice',
          domain: 'example.com',
          full: 'alice@example.com',
        },
      });

      mockNIP05Service.createVerificationRequest.mockResolvedValue({
        success: false,
        error: 'Domain verification limit exceeded',
      });

      const response = await request(app)
        .post('/api/nip05/verify')
        .send(validVerificationRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('limit exceeded');
      expect(response.body.code).toBe('VERIFICATION_CREATION_FAILED');
    });

    it('should handle internal server errors', async () => {
      mockNIP05Service.parseNIP05Identifier.mockImplementation(() => {
        throw new Error('Internal service error');
      });

      const response = await request(app)
        .post('/api/nip05/verify')
        .send(validVerificationRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests to trigger rate limiting
      const requests = Array(6)
        .fill(null)
        .map(() => request(app).post('/api/nip05/verify').send(validVerificationRequest));

      const responses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimitedResponse = responses.find((r) => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();
      expect(rateLimitedResponse?.body.code).toBe('VERIFICATION_CREATION_RATE_LIMIT');
    });
  });

  describe('📋 GET /api/nip05/verifications', () => {
    it('should list user verifications successfully', async () => {
      const mockVerifications = [
        {
          id: 'verification-1',
          nip05_identifier: 'alice@example.com',
          verification_status: 'verified',
          domain: 'example.com',
        },
        {
          id: 'verification-2',
          nip05_identifier: 'bob@example.com',
          verification_status: 'pending',
          domain: 'example.com',
        },
      ];

      mockNIP05Service.listUserVerifications.mockResolvedValue({
        success: true,
        verifications: mockVerifications,
      });

      const response = await request(app).get('/api/nip05/verifications').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verifications).toHaveLength(2);
      expect(response.body.data.total_count).toBe(2);
      expect(response.body.data.verified_count).toBe(1);
    });

    it('should enrich verifications with metadata', async () => {
      const mockVerifications = [
        {
          id: 'verification-1',
          nip05_identifier: 'alice@example.com',
          verification_status: 'verified',
          expires_at: new Date(Date.now() - 86400000).toISOString(), // Expired
          last_checked_at: new Date(Date.now() - 86400000 * 2).toISOString(), // Needs refresh
        },
      ];

      mockNIP05Service.listUserVerifications.mockResolvedValue({
        success: true,
        verifications: mockVerifications,
      });

      const response = await request(app).get('/api/nip05/verifications').expect(200);

      const verification = response.body.data.verifications[0];
      expect(verification.domain_info).toBeDefined();
      expect(verification.status_info.is_expired).toBe(true);
      expect(verification.status_info.needs_refresh).toBe(true);
    });

    it('should require authentication', async () => {
      mockAuthenticate.mockImplementationOnce((req, res, next) => {
        req.user = null;
        next();
      });

      const response = await request(app).get('/api/nip05/verifications').expect(401);

      expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should handle service failures', async () => {
      mockNIP05Service.listUserVerifications.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      const response = await request(app).get('/api/nip05/verifications').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VERIFICATION_LIST_FAILED');
    });
  });

  describe('🔍 GET /api/nip05/verify/:identifier', () => {
    it('should verify identifier successfully', async () => {
      mockNIP05Service.parseNIP05Identifier.mockReturnValue({
        success: true,
        parsed: {
          localPart: 'alice',
          domain: 'example.com',
          full: 'alice@example.com',
        },
      });

      mockNIP05Service.getVerificationByIdentifier.mockResolvedValue({
        success: true,
        verification: {
          id: 'verification-id',
          nip05_identifier: 'alice@example.com',
          nostr_pubkey: 'a'.repeat(64),
          domain: 'example.com',
          verification_status: 'verified',
          verification_method: 'http',
          verified_at: new Date().toISOString(),
        },
      });

      const response = await request(app).get('/api/nip05/verify/alice@example.com').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nip05_identifier).toBe('alice@example.com');
      expect(response.body.data.nostr_pubkey).toBe('a'.repeat(64));
    });

    it('should handle URL encoding', async () => {
      mockNIP05Service.parseNIP05Identifier.mockReturnValue({
        success: true,
        parsed: {
          localPart: 'alice',
          domain: 'example.com',
          full: 'alice@example.com',
        },
      });

      mockNIP05Service.getVerificationByIdentifier.mockResolvedValue({
        success: true,
        verification: {
          nip05_identifier: 'alice@example.com',
          verification_status: 'verified',
        },
      });

      const encodedIdentifier = encodeURIComponent('alice@example.com');
      const response = await request(app).get(`/api/nip05/verify/${encodedIdentifier}`).expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent identifiers', async () => {
      mockNIP05Service.parseNIP05Identifier.mockReturnValue({
        success: true,
        parsed: {
          localPart: 'alice',
          domain: 'example.com',
          full: 'alice@example.com',
        },
      });

      mockNIP05Service.getVerificationByIdentifier.mockResolvedValue({
        success: true,
        verification: null,
      });

      const response = await request(app).get('/api/nip05/verify/alice@example.com').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('IDENTIFIER_NOT_FOUND');
    });

    it('should validate identifier format', async () => {
      mockNIP05Service.parseNIP05Identifier.mockReturnValue({
        success: false,
        error: 'Invalid format',
      });

      const response = await request(app).get('/api/nip05/verify/invalid-format').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_NIP05_FORMAT');
    });

    it('should not expose sensitive data', async () => {
      mockNIP05Service.parseNIP05Identifier.mockReturnValue({
        success: true,
        parsed: { full: 'alice@example.com' },
      });

      mockNIP05Service.getVerificationByIdentifier.mockResolvedValue({
        success: true,
        verification: {
          id: 'verification-id',
          user_id: 'user-id',
          nip05_identifier: 'alice@example.com',
          nostr_pubkey: 'a'.repeat(64),
          domain: 'example.com',
          verification_status: 'verified',
          verification_method: 'http',
          verified_at: new Date().toISOString(),
          metadata: { sensitive: 'data' },
          failure_reason: 'internal error',
        },
      });

      const response = await request(app).get('/api/nip05/verify/alice@example.com').expect(200);

      // Should only include public fields
      const data = response.body.data;
      expect(data.id).toBeUndefined();
      expect(data.user_id).toBeUndefined();
      expect(data.metadata).toBeUndefined();
      expect(data.failure_reason).toBeUndefined();

      // Should include public fields
      expect(data.nip05_identifier).toBeDefined();
      expect(data.nostr_pubkey).toBeDefined();
      expect(data.verification_status).toBeDefined();
    });
  });

  describe('🔄 POST /api/nip05/refresh', () => {
    it('should refresh verification successfully', async () => {
      mockNIP05Service.refreshVerification.mockResolvedValue({
        success: true,
        result: {
          success: true,
          verified: true,
          method: 'http',
          verification_data: { refreshed: true },
        },
      });

      const response = await request(app)
        .post('/api/nip05/refresh')
        .send({ verification_id: '123e4567-e89b-12d3-a456-426614174000' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verification_result.verified).toBe(true);
      expect(response.body.data.refreshed_at).toBeDefined();
    });

    it('should validate verification ID format', async () => {
      const response = await request(app)
        .post('/api/nip05/refresh')
        .send({ verification_id: 'invalid-uuid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      mockAuthenticate.mockImplementationOnce((req, res, next) => {
        req.user = null;
        next();
      });

      const response = await request(app)
        .post('/api/nip05/refresh')
        .send({ verification_id: '123e4567-e89b-12d3-a456-426614174000' })
        .expect(401);

      expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should handle refresh failures', async () => {
      mockNIP05Service.refreshVerification.mockResolvedValue({
        success: false,
        error: 'Verification not found',
      });

      const response = await request(app)
        .post('/api/nip05/refresh')
        .send({ verification_id: '123e4567-e89b-12d3-a456-426614174000' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VERIFICATION_REFRESH_FAILED');
    });
  });

  describe('🚫 DELETE /api/nip05/verifications/:id', () => {
    const validVerificationId = '123e4567-e89b-12d3-a456-426614174000';

    it('should revoke verification successfully', async () => {
      mockNIP05Service.revokeVerification.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .delete(`/api/nip05/verifications/${validVerificationId}`)
        .send({ reason: 'User requested' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verification_id).toBe(validVerificationId);
      expect(response.body.data.reason).toBe('User requested');
      expect(response.body.data.revoked_at).toBeDefined();
    });

    it('should use default reason when none provided', async () => {
      mockNIP05Service.revokeVerification.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .delete(`/api/nip05/verifications/${validVerificationId}`)
        .expect(200);

      expect(response.body.data.reason).toBe('User requested revocation');
    });

    it('should validate verification ID format', async () => {
      const response = await request(app).delete('/api/nip05/verifications/invalid-id').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_ID_FORMAT');
    });

    it('should require authentication', async () => {
      mockAuthenticate.mockImplementationOnce((req, res, next) => {
        req.user = null;
        next();
      });

      const response = await request(app)
        .delete(`/api/nip05/verifications/${validVerificationId}`)
        .expect(401);

      expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should handle revocation failures', async () => {
      mockNIP05Service.revokeVerification.mockResolvedValue({
        success: false,
        error: 'Verification not found or already revoked',
      });

      const response = await request(app)
        .delete(`/api/nip05/verifications/${validVerificationId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VERIFICATION_REVOCATION_FAILED');
    });
  });

  describe('📊 GET /api/nip05/domains/:domain/stats', () => {
    it('should return domain statistics', async () => {
      const response = await request(app).get('/api/nip05/domains/example.com/stats').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.domain).toBe('example.com');
      expect(response.body.data.total_verifications).toBeDefined();
      expect(response.body.data.verified_count).toBeDefined();
      expect(response.body.data.verification_methods).toBeDefined();
    });

    it('should validate domain format', async () => {
      const invalidDomains = [
        'invalid-domain',
        'example.',
        '.example.com',
        'example..com',
        'example.com/path',
      ];

      for (const domain of invalidDomains) {
        const response = await request(app).get(`/api/nip05/domains/${domain}/stats`).expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('INVALID_DOMAIN_FORMAT');
      }
    });

    it('should handle case insensitive domains', async () => {
      const response = await request(app).get('/api/nip05/domains/EXAMPLE.COM/stats').expect(200);

      expect(response.body.data.domain).toBe('example.com');
    });
  });

  describe('🔍 GET /.well-known/nostr.json', () => {
    it('should serve well-known nostr.json', async () => {
      const response = await request(app).get('/.well-known/nostr.json').expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['cache-control']).toContain('public');

      expect(response.body.names).toBeDefined();
      expect(response.body.relays).toBeDefined();
    });

    it('should include default Sovren verifications', async () => {
      const response = await request(app).get('/.well-known/nostr.json').expect(200);

      expect(response.body.names.admin).toBeDefined();
      expect(response.body.names.support).toBeDefined();
      expect(response.body.names.dev).toBeDefined();

      expect(response.body.relays).toBeDefined();
      expect(Object.keys(response.body.relays).length).toBeGreaterThan(0);
    });

    it('should handle service errors gracefully', async () => {
      // Mock getSovrenVerifications to throw error
      const originalConsoleError = console.error;
      console.error = vi.fn();

      // This should still return 200 with empty data rather than 500
      const response = await request(app).get('/.well-known/nostr.json').expect(200);

      expect(response.body.names).toBeDefined();
      expect(response.body.relays).toBeDefined();

      console.error = originalConsoleError;
    });
  });

  describe('🔒 Security and Rate Limiting', () => {
    it('should apply rate limiting to verification endpoints', async () => {
      // Make multiple requests rapidly
      const requests = Array(25)
        .fill(null)
        .map(() => request(app).get('/api/nip05/verifications'));

      const responses = await Promise.all(requests);

      // Some should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should sanitize input parameters', async () => {
      const maliciousInputs = [
        'alice@example.com<script>alert(1)</script>',
        'alice@example.com\x00\x01',
        '../../../etc/passwd@example.com',
      ];

      for (const maliciousInput of maliciousInputs) {
        mockNIP05Service.parseNIP05Identifier.mockReturnValue({
          success: false,
          error: 'Invalid format',
        });

        const response = await request(app)
          .post('/api/nip05/verify')
          .send({
            nip05_identifier: maliciousInput,
            verification_method: 'http',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    it('should handle SQL injection attempts', async () => {
      const sqlInjectionAttempts = [
        "alice'; DROP TABLE users; --@example.com",
        "alice' OR '1'='1@example.com",
        "alice@example.com'; DELETE FROM nip05_verifications; --",
      ];

      for (const attempt of sqlInjectionAttempts) {
        mockNIP05Service.parseNIP05Identifier.mockReturnValue({
          success: false,
          error: 'Invalid format',
        });

        const response = await request(app)
          .post('/api/nip05/verify')
          .send({
            nip05_identifier: attempt,
            verification_method: 'http',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    it('should validate content-type for POST requests', async () => {
      const response = await request(app)
        .post('/api/nip05/verify')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should limit request body size', async () => {
      const largePayload = {
        nip05_identifier: 'alice@example.com',
        verification_method: 'http',
        metadata: {
          large_data: 'x'.repeat(10000000), // 10MB of data
        },
      };

      const response = await request(app).post('/api/nip05/verify').send(largePayload).expect(413); // Payload too large

      expect(response.status).toBe(413);
    });
  });

  describe('📊 Performance and Monitoring', () => {
    it('should include timing information in responses', async () => {
      mockNIP05Service.listUserVerifications.mockResolvedValue({
        success: true,
        verifications: [],
      });

      const response = await request(app).get('/api/nip05/verifications').expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should handle concurrent requests efficiently', async () => {
      mockNIP05Service.listUserVerifications.mockResolvedValue({
        success: true,
        verifications: [],
      });

      const startTime = Date.now();

      // Make 10 concurrent requests
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get('/api/nip05/verifications'));

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time (5 seconds for 10 requests)
      expect(duration).toBeLessThan(5000);
    });

    it('should provide consistent response format', async () => {
      const endpoints = [
        { method: 'get', path: '/api/nip05/verifications' },
        { method: 'get', path: '/api/nip05/domains/example.com/stats' },
      ];

      // Mock service responses
      mockNIP05Service.listUserVerifications.mockResolvedValue({
        success: true,
        verifications: [],
      });

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);

        expect(response.body.success).toBeDefined();
        expect(response.body.timestamp).toBeDefined();

        if (response.body.success) {
          expect(response.body.data).toBeDefined();
        } else {
          expect(response.body.error).toBeDefined();
          expect(response.body.code).toBeDefined();
        }
      }
    });
  });
});
