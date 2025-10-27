import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { createNIP05VerificationService } from '../services/nip05-verification-service';

const router = express.Router();
const nip05Service = createNIP05VerificationService();

// 🔒 Rate limiting for NIP-05 verification endpoints
const nip05RateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    success: false,
    error: 'Too many NIP-05 verification requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔒 Strict rate limiting for verification creation
const verificationCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit verification creation requests
  message: {
    success: false,
    error: 'Too many verification creation requests, please try again later',
    code: 'VERIFICATION_CREATION_RATE_LIMIT',
  },
});

// 📝 Request Validation Schemas
const CreateVerificationSchema = z.object({
  nip05_identifier: z
    .string()
    .min(3)
    .max(320)
    .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  verification_method: z.enum(['http', 'dns', 'manual']).default('http'),
  metadata: z.record(z.any()).optional(),
});

const RefreshVerificationSchema = z.object({
  verification_id: z.string().uuid(),
});

const RevokeVerificationSchema = z.object({
  verification_id: z.string().uuid(),
  reason: z.string().optional(),
});

/**
 * 🆕 POST /api/nip05/verify
 * Create a new NIP-05 verification request
 */
router.post(
  '/verify',
  verificationCreationRateLimit,
  authenticate,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const validatedData = CreateVerificationSchema.parse(req.body);

      // Parse NIP-05 identifier
      const parseResult = nip05Service.parseNIP05Identifier(validatedData.nip05_identifier);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: parseResult.error,
          code: 'INVALID_NIP05_FORMAT',
        });
      }

      const { parsed } = parseResult;
      if (!parsed) {
        return res.status(400).json({
          success: false,
          error: 'Failed to parse NIP-05 identifier',
          code: 'PARSE_ERROR',
        });
      }

      // Get user ID from NOSTR pubkey
      const userId = await getUserIdFromNostrPubkey(req.user.nostr_pubkey);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Create verification request
      const verificationRequest = {
        user_id: userId,
        nostr_pubkey: req.user.nostr_pubkey,
        nip05_identifier: parsed.full,
        domain: parsed.domain,
        local_part: parsed.localPart,
        verification_method: validatedData.verification_method,
        metadata: validatedData.metadata,
      };

      const result = await nip05Service.createVerificationRequest(verificationRequest);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'VERIFICATION_CREATION_FAILED',
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          verification: result.verification,
          message: 'Verification request created successfully',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      console.error('NIP-05 verification creation failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * 📋 GET /api/nip05/verifications
 * List all verification records for the authenticated user
 */
router.get('/verifications', nip05RateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    const userId = await getUserIdFromNostrPubkey(req.user.nostr_pubkey);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const result = await nip05Service.listUserVerifications(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'VERIFICATION_LIST_FAILED',
      });
    }

    // Enrich verifications with additional metadata
    const enrichedVerifications = result.verifications?.map((verification) => ({
      ...verification,
      domain_info: {
        is_trusted: false, // Would be determined from domain config
        verification_methods_supported: ['http', 'dns'],
      },
      status_info: {
        is_expired: verification.expires_at
          ? new Date(verification.expires_at) < new Date()
          : false,
        needs_refresh:
          verification.verification_status === 'verified' &&
          verification.last_checked_at &&
          new Date(verification.last_checked_at) < new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    }));

    return res.status(200).json({
      success: true,
      data: {
        verifications: enrichedVerifications,
        total_count: enrichedVerifications?.length || 0,
        verified_count:
          enrichedVerifications?.filter((v) => v.verification_status === 'verified').length || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('NIP-05 verification listing failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * 🔍 GET /api/nip05/verify/:identifier
 * Verify a specific NIP-05 identifier (public endpoint)
 */
router.get('/verify/:identifier', nip05RateLimit, async (req: Request, res: Response) => {
  try {
    const identifier = decodeURIComponent(req.params.identifier);

    // Parse identifier
    const parseResult = nip05Service.parseNIP05Identifier(identifier);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error,
        code: 'INVALID_NIP05_FORMAT',
      });
    }

    // Look up existing verification
    const result = await nip05Service.getVerificationByIdentifier(identifier);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'VERIFICATION_LOOKUP_FAILED',
      });
    }

    if (!result.verification) {
      return res.status(404).json({
        success: false,
        error: 'NIP-05 identifier not found or not verified',
        code: 'IDENTIFIER_NOT_FOUND',
      });
    }

    // Return verification info (public data only)
    return res.status(200).json({
      success: true,
      data: {
        nip05_identifier: result.verification.nip05_identifier,
        nostr_pubkey: result.verification.nostr_pubkey,
        domain: result.verification.domain,
        verification_status: result.verification.verification_status,
        verification_method: result.verification.verification_method,
        verified_at: result.verification.verified_at,
        expires_at: result.verification.expires_at,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('NIP-05 verification lookup failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * 🔄 POST /api/nip05/refresh
 * Refresh an existing verification
 */
router.post('/refresh', nip05RateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    const validatedData = RefreshVerificationSchema.parse(req.body);

    const result = await nip05Service.refreshVerification(validatedData.verification_id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'VERIFICATION_REFRESH_FAILED',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        verification_id: validatedData.verification_id,
        verification_result: result.result,
        refreshed_at: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    console.error('NIP-05 verification refresh failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * 🚫 DELETE /api/nip05/verifications/:id
 * Revoke a verification
 */
router.delete(
  '/verifications/:id',
  nip05RateLimit,
  authenticate,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const verificationId = req.params.id;
      const { reason } = req.body;

      // Validate verification ID format
      if (
        !verificationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid verification ID format',
          code: 'INVALID_ID_FORMAT',
        });
      }

      const result = await nip05Service.revokeVerification(verificationId, reason);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'VERIFICATION_REVOCATION_FAILED',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          verification_id: verificationId,
          revoked_at: new Date().toISOString(),
          reason: reason || 'User requested revocation',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('NIP-05 verification revocation failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * 🔍 GET /api/nip05/domains/:domain/stats
 * Get domain verification statistics (public endpoint)
 */
router.get('/domains/:domain/stats', nip05RateLimit, async (req: Request, res: Response) => {
  try {
    const domain = req.params.domain.toLowerCase();

    // Validate domain format
    if (!domain.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid domain format',
        code: 'INVALID_DOMAIN_FORMAT',
      });
    }

    // Get domain statistics (mock implementation)
    const stats = await getDomainStats(domain);

    return res.status(200).json({
      success: true,
      data: {
        domain,
        ...stats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Domain stats retrieval failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * 🔍 GET /.well-known/nostr.json
 * Serve NIP-05 well-known endpoint for Sovren domain
 */
router.get('/.well-known/nostr.json', async (req: Request, res: Response) => {
  try {
    // Get all verified NIP-05 identifiers for Sovren domain
    const sovrenVerifications = await getSovrenVerifications();

    const response = {
      names: sovrenVerifications.names,
      relays: sovrenVerifications.relays,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache

    return res.status(200).json(response);
  } catch (error) {
    console.error('Well-known nostr.json generation failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// 🔧 Helper Functions

async function getUserIdFromNostrPubkey(nostrPubkey: string): Promise<string | null> {
  try {
    // Mock implementation - in production, query users table
    return `user_${nostrPubkey.substring(0, 8)}`;
  } catch (error) {
    console.warn('Failed to get user ID:', error);
    return null;
  }
}

async function getDomainStats(domain: string): Promise<{
  total_verifications: number;
  verified_count: number;
  pending_count: number;
  failed_count: number;
  verification_methods: Record<string, number>;
  last_verification: string | null;
}> {
  try {
    // Mock implementation - in production, query database
    return {
      total_verifications: Math.floor(Math.random() * 100) + 10,
      verified_count: Math.floor(Math.random() * 50) + 5,
      pending_count: Math.floor(Math.random() * 10),
      failed_count: Math.floor(Math.random() * 20),
      verification_methods: {
        http: Math.floor(Math.random() * 30) + 5,
        dns: Math.floor(Math.random() * 15) + 2,
        manual: Math.floor(Math.random() * 5),
      },
      last_verification: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('Failed to get domain stats:', error);
    return {
      total_verifications: 0,
      verified_count: 0,
      pending_count: 0,
      failed_count: 0,
      verification_methods: {},
      last_verification: null,
    };
  }
}

async function getSovrenVerifications(): Promise<{
  names: Record<string, string>;
  relays: Record<string, string[]>;
}> {
  try {
    // Mock implementation - in production, query verified NIP-05 records
    return {
      names: {
        admin: 'a'.repeat(64),
        support: 'b'.repeat(64),
        dev: 'c'.repeat(64),
      },
      relays: {
        ['a'.repeat(64)]: ['wss://relay.sovren.app', 'wss://relay.damus.io'],
        ['b'.repeat(64)]: ['wss://relay.sovren.app'],
        ['c'.repeat(64)]: ['wss://relay.sovren.app', 'wss://relay.snort.social'],
      },
    };
  } catch (error) {
    console.warn('Failed to get Sovren verifications:', error);
    return { names: {}, relays: {} };
  }
}

export default router;
