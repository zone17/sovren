/**
 * 🔐 NOSTR Authentication Middleware
 * US-305: Unified Authentication Middleware
 *
 * Express middleware for protecting routes with NOSTR authentication
 * Integrates with UnifiedNostrAuthService for token validation
 */

import { Request, Response, NextFunction } from 'express';
import { unifiedNostrAuth } from '../services/unified-nostr-auth';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface NostrAuthOptions {
  requireRole?: 'creator' | 'supporter' | 'admin';
  allowExpired?: boolean;
  skipSessionCheck?: boolean;
}

// =====================================================
// MAIN AUTHENTICATION MIDDLEWARE
// =====================================================

/**
 * Protect routes with NOSTR authentication
 * @param options Configuration options for authentication
 */
export function requireNostrAuth(options: NostrAuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Missing or invalid authorization header',
          code: 'AUTH_REQUIRED',
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Validate token
      const validation = await unifiedNostrAuth.validateToken(token);

      if (!validation.valid) {
        // Check if we should allow expired tokens
        if (!options.allowExpired || validation.error !== 'Token has expired') {
          return res.status(401).json({
            success: false,
            error: validation.error || 'Invalid token',
            code: 'AUTH_INVALID',
          });
        }
      }

      // Check session if required
      if (!options.skipSessionCheck && !validation.session) {
        return res.status(401).json({
          success: false,
          error: 'Session not found or expired',
          code: 'SESSION_INVALID',
        });
      }

      // Check role if specified
      if (options.requireRole) {
        const userRole = validation.session?.role || 'supporter';
        if (!hasRequiredRole(userRole, options.requireRole)) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            code: 'PERMISSION_DENIED',
            required_role: options.requireRole,
          });
        }
      }

      // Attach user info to request
      req.nostr = {
        pubkey: validation.pubkey!,
        npub: validation.session?.npub,
        sessionId: validation.session?.id,
        role: validation.session?.role || 'supporter',
        session: validation.session,
      };

      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication processing failed',
        code: 'AUTH_ERROR',
      });
    }
  };
}

// =====================================================
// OPTIONAL AUTHENTICATION MIDDLEWARE
// =====================================================

/**
 * Optional NOSTR authentication - doesn't fail if no token provided
 * Useful for routes that have different behavior for authenticated users
 */
export function optionalNostrAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided, continue without authentication
        return next();
      }

      const token = authHeader.substring(7);

      // Try to validate token
      const validation = await unifiedNostrAuth.validateToken(token);

      if (validation.valid && validation.pubkey) {
        // Attach user info if valid
        req.nostr = {
          pubkey: validation.pubkey,
          npub: validation.session?.npub,
          sessionId: validation.session?.id,
          role: validation.session?.role || 'supporter',
          session: validation.session,
        };
      }

      next();
    } catch (error) {
      // Ignore errors and continue without authentication
      console.warn('Optional auth error:', error);
      next();
    }
  };
}

// =====================================================
// CHALLENGE GENERATION MIDDLEWARE
// =====================================================

/**
 * Middleware for generating authentication challenges
 */
export async function generateChallenge(req: Request, res: Response, _next: NextFunction) {
  try {
    const { pubkey } = req.body;

    if (!pubkey || !/^[0-9a-fA-F]{64}$/.test(pubkey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing NOSTR public key',
        code: 'INVALID_PUBKEY',
      });
    }

    const challenge = await unifiedNostrAuth.generateChallenge(pubkey, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      challenge: challenge.challenge,
      pubkey: challenge.pubkey,
      created_at: challenge.created_at,
      expires_at: challenge.expires_at,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: error.message,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    console.error('Challenge generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate challenge',
      code: 'CHALLENGE_ERROR',
    });
  }
}

// =====================================================
// SIGNATURE VERIFICATION MIDDLEWARE
// =====================================================

/**
 * Middleware for verifying NOSTR signatures
 */
export async function verifySignature(req: Request, res: Response, _next: NextFunction) {
  try {
    const { pubkey, signature, challenge, timestamp, deviceInfo } = req.body;

    // Validate required fields
    if (!pubkey || !signature || !challenge || !timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required verification fields',
        code: 'INVALID_REQUEST',
      });
    }

    const result = await unifiedNostrAuth.verifyChallenge({
      pubkey,
      signature,
      challenge,
      timestamp,
      deviceInfo,
    });

    if (!result.valid) {
      return res.status(401).json({
        success: false,
        error: result.error || 'Verification failed',
        code: 'VERIFICATION_FAILED',
        retryAfter: result.retryAfter,
      });
    }

    res.json({
      success: true,
      token: result.token,
      sessionId: result.sessionId,
      pubkey: result.pubkey,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: error.message,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    console.error('Signature verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification processing failed',
      code: 'VERIFICATION_ERROR',
    });
  }
}

// =====================================================
// TOKEN REFRESH MIDDLEWARE
// =====================================================

/**
 * Middleware for refreshing JWT tokens
 */
export async function refreshToken(req: Request, res: Response, _next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
        code: 'AUTH_REQUIRED',
      });
    }

    const token = authHeader.substring(7);

    const result = await unifiedNostrAuth.refreshToken(token);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error || 'Token refresh failed',
        code: 'REFRESH_FAILED',
      });
    }

    res.json({
      success: true,
      token: result.newToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh processing failed',
      code: 'REFRESH_ERROR',
    });
  }
}

// =====================================================
// LOGOUT MIDDLEWARE
// =====================================================

/**
 * Middleware for logging out users
 */
export async function logout(req: Request, res: Response, _next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Already logged out
      return res.json({
        success: true,
        message: 'Logged out successfully',
      });
    }

    const token = authHeader.substring(7);

    const result = await unifiedNostrAuth.logout(token);

    res.json({
      success: result.success,
      message: result.success ? 'Logged out successfully' : result.error,
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Don't fail logout - best effort
    res.json({
      success: true,
      message: 'Logged out (with warnings)',
    });
  }
}

// =====================================================
// SESSION VALIDATION MIDDLEWARE
// =====================================================

/**
 * Middleware for validating existing tokens
 */
export async function validateToken(req: Request, res: Response, _next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
        code: 'AUTH_REQUIRED',
      });
    }

    const token = authHeader.substring(7);

    const validation = await unifiedNostrAuth.validateToken(token);

    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: validation.error || 'Invalid token',
        code: 'TOKEN_INVALID',
      });
    }

    res.json({
      success: true,
      valid: true,
      pubkey: validation.pubkey,
      sessionId: validation.session?.id,
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation processing failed',
      code: 'VALIDATION_ERROR',
    });
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Check if user has required role
 */
function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    supporter: 1,
    creator: 2,
    admin: 3,
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Extract pubkey from request (for backward compatibility)
 */
export function getNostrPubkey(req: Request): string | null {
  return req.nostr?.pubkey || null;
}

/**
 * Check if request is authenticated
 */
export function isAuthenticated(req: Request): boolean {
  return !!req.nostr?.pubkey;
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  requireNostrAuth,
  optionalNostrAuth,
  generateChallenge,
  verifySignature,
  refreshToken,
  logout,
  validateToken,
  getNostrPubkey,
  isAuthenticated,
};
