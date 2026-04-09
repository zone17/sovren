import { authenticate, authorize, optionalAuth } from '@/middleware/auth';
import { nostrAuth } from '@/services/nostr-auth';
import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';

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
router.post(
  '/challenge',
  authRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

// 🔐 Authenticate with NOSTR signature
router.post(
  '/authenticate',
  authRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
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
        error: verification.error || 'Authentication failed',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    // Fetch role from DB — never trust the client to self-assign a role
    const role = await nostrAuth.getUserRole(verification.pubkey);

    // Generate JWT token with DB-fetched role
    const token = await nostrAuth.generateJWT(verification.pubkey, role);

    // Set JWT in HttpOnly cookie for browser clients
    res.cookie('sovren_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
      sameSite: 'strict',
      path: '/api',
      maxAge: 24 * 60 * 60 * 1000, // 24h
    });

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
  })
);

// 🔄 Refresh JWT token
router.post(
  '/refresh',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    // Get the current token from cookie or authorization header
    let currentToken: string | undefined;
    if (req.cookies?.sovren_token) {
      currentToken = req.cookies.sovren_token;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        currentToken = authHeader.substring(7);
      }
    }

    if (!currentToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    // Use the dedicated refresh method
    const refreshResult = await nostrAuth.refreshJWT(currentToken);

    if (!refreshResult.success || !refreshResult.newToken) {
      return res.status(401).json({
        success: false,
        error: refreshResult.error || 'Token refresh failed',
        code: 'REFRESH_ERROR',
      });
    }

    // Set new JWT in HttpOnly cookie
    res.cookie('sovren_token', refreshResult.newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
      sameSite: 'strict',
      path: '/api',
      maxAge: 24 * 60 * 60 * 1000, // 24h
    });

    return res.status(200).json({
      success: true,
      data: {
        token: refreshResult.newToken,
        expires_in: '24h',
      },
    });
  })
);

// 🔍 Verify current authentication status
router.get(
  '/verify',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

// 🚪 Logout (server-side token revocation + client-side cleanup)
// TODO(SOV-SEC-002): Implement Redis JWT blacklist — add token jti to Redis with TTL matching remaining JWT lifetime. Check blacklist in authenticate middleware.
router.post(
  '/logout',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    // Revoke the JWT token server-side so it cannot be reused
    // Check cookie first, then Authorization header
    const token =
      req.cookies?.sovren_token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : undefined);

    if (token) {
      await nostrAuth.revokeToken(token);
    }

    // Clear the HttpOnly auth cookie
    res.clearCookie('sovren_token', { path: '/api' });

    res.status(200).json({
      success: true,
      message: 'Successfully logged out',
    });
  })
);

// 📊 Authentication service statistics (admin only)
router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

// 🏥 Health check endpoint
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

export default router;
