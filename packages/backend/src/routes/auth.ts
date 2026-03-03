import { authenticate, optionalAuth } from '@/middleware/auth';
import { nostrAuth } from '@/services/nostr-auth';
import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const router = Router();

// 🏥 Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts',
    code: 'RATE_LIMITED',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in test environment
  skip: () => process.env.NODE_ENV === 'test',
});

// 🎯 Request/Response schemas
const AuthenticateRequestSchema = z.object({
  nostr_pubkey: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Invalid NOSTR public key format'),
  challenge: z.string().min(1, 'challenge is required'),
  timestamp: z.number(),
  signature: z.string().min(1, 'Signature is required'),
});

// 🎲 Generate authentication challenge
router.post('/challenge', authRateLimit, async (req: Request, res: Response) => {
  try {
    const challenge = await nostrAuth.generateChallenge();

    res.status(200).json({
      success: true,
      data: {
        challenge: challenge.challenge,
        timestamp: challenge.timestamp,
        expires_at: challenge.expires_at,
        message: `Please sign this challenge with your NOSTR private key to authenticate with Sovren.`,
      },
    });
  } catch (error) {
    console.error('Challenge generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authentication challenge',
      code: 'CHALLENGE_ERROR',
    });
  }
});

// 🔐 Authenticate with NOSTR signature
router.post('/authenticate', authRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = AuthenticateRequestSchema.parse(req.body);

    // NOSTR signature verification
    const verification = await nostrAuth.verifySignature({
      pubkey: validatedData.nostr_pubkey,
      signature: validatedData.signature,
      challenge: validatedData.challenge,
      timestamp: validatedData.timestamp,
    });

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        error: 'Challenge expired or invalid',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    // Fetch role from DB — never trust the client to self-assign a role
    const role = await nostrAuth.getUserRole(verification.pubkey);

    // Generate JWT token with DB-fetched role
    const token = await nostrAuth.generateJWT(verification.pubkey, role);

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          nostr_pubkey: verification.pubkey,
          role,
          signature_verified: true,
        },
        expires_in: '24h',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      // If it's a required field error, include the field name for clarity
      let errorMessage = firstError?.message || 'Validation failed';
      if (firstError?.code === 'invalid_type' && firstError?.expected === 'string') {
        errorMessage = `${firstError.path.join('.')} is required`;
      }
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      });
    }

    console.error('Authentication failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service error',
      code: 'AUTH_ERROR',
    });
  }
});

// 🔄 Refresh JWT token
router.post('/refresh', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    // Get the current token from the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    const currentToken = authHeader.substring(7);

    // Use the dedicated refresh method
    const refreshResult = await nostrAuth.refreshJWT(currentToken);

    if (!refreshResult.success || !refreshResult.newToken) {
      return res.status(401).json({
        success: false,
        error: refreshResult.error || 'Token refresh failed',
        code: 'REFRESH_ERROR',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        token: refreshResult.newToken,
        expires_in: '24h',
      },
    });
  } catch (error) {
    console.error('Token refresh failed:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'REFRESH_ERROR',
    });
  }
});

// 🔍 Verify current authentication status
router.get('/verify', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No authentication found',
        code: 'UNAUTHENTICATED',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          nostr_pubkey: req.user.nostr_pubkey,
          role: req.user.role || 'supporter',
          signature_verified: req.user.signature_verified,
          iat: req.user.iat,
          exp: req.user.exp,
        },
        valid: true,
      },
    });
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication verification error',
      code: 'VERIFY_ERROR',
    });
  }
});

// 🚪 Logout (client-side token invalidation)
router.post('/logout', optionalAuth, async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Successfully logged out',
      data: {
        instructions: 'Please delete the JWT token from your client storage',
      },
    });
  } catch (error) {
    console.error('Logout failed:', error);
    res.status(500).json({
      success: false,
      error: 'Logout service error',
      code: 'LOGOUT_ERROR',
    });
  }
});

// 📊 Authentication service statistics (admin only)
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'UNAUTHORIZED',
      });
    }

    const stats = nostrAuth.getStats();

    return res.status(200).json({
      success: true,
      data: {
        activeChallenges: stats.activeChallenges || 0,
        jwtExpiresIn: '24h',
        challengeTTL: '15m',
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('Stats retrieval failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Stats service error',
      code: 'STATS_ERROR',
    });
  }
});

// 🏥 Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test challenge generation to verify service health
    const challenge = await nostrAuth.generateChallenge();

    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'nostr-auth',
        timestamp: Date.now(),
        challenge_generated: !!challenge,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      code: 'HEALTH_ERROR',
    });
  }
});

export default router;
