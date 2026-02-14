import { JWTPayload, nostrAuth } from '@/services/nostr-auth';
import { NextFunction, Request, Response } from 'express';
import logger from '../lib/logger';

// 🔒 Authentication middleware for JWT verification
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization header required',
        code: 'MISSING_TOKEN',
        details: 'Expected Authorization: Bearer <token> header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const verification = await nostrAuth.verifyJWT(token);

    if (!verification.valid || !verification.payload) {
      logger.warn('JWT verification failed', {
        error: verification.error,
        ip: req.ip,
        path: req.path,
      });
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Attach user information to request
    req.user = {
      nostr_pubkey: verification.payload.nostr_pubkey,
      signature_verified: verification.payload.signature_verified,
      iat: verification.payload.iat,
      exp: verification.payload.exp,
      ...(verification.payload.role && { role: verification.payload.role }),
    };
    next();
  } catch (error) {
    logger.error('Authentication service error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      path: req.path,
    });
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};

// 🎭 Role-based authorization middleware
export const authorize = (allowedRoles: Array<'creator' | 'supporter' | 'admin'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
        details: 'User must be authenticated to access this resource',
      });
      return;
    }

    const userRole = req.user.role || 'supporter'; // Default to supporter

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Authorization failed', {
        requiredRoles: allowedRoles,
        currentRole: userRole,
        pubkey: req.user.nostr_pubkey,
        path: req.path,
      });
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    next();
  };
};

// 🌟 Optional authentication middleware (for public endpoints with user context)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user context
      next();
      return;
    }

    const token = authHeader.substring(7);
    const verification = await nostrAuth.verifyJWT(token);

    if (verification.valid && verification.payload) {
      // Attach user information if token is valid
      req.user = {
        nostr_pubkey: verification.payload.nostr_pubkey,
        signature_verified: verification.payload.signature_verified,
        iat: verification.payload.iat,
        exp: verification.payload.exp,
        ...(verification.payload.role && { role: verification.payload.role }),
      };
    }

    // Continue regardless of token validity
    next();
  } catch (error) {
    // Log error but don't block request
    console.warn('Optional auth failed:', error);
    next();
  }
};

// 🔒 Admin-only middleware
export const requireAdmin = authorize(['admin']);

// 🎨 Creator or admin middleware
export const requireCreator = authorize(['creator', 'admin']);

// 👥 Any authenticated user middleware
export const requireAuth = authorize(['supporter', 'creator', 'admin']);

// 🔐 NOSTR signature verification middleware for sensitive operations
export const requireNostrSignature = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    const { signature, challenge, timestamp } = req.body;

    if (!signature || !challenge || !timestamp) {
      res.status(400).json({
        error: 'NOSTR signature verification required',
        code: 'MISSING_SIGNATURE',
        details: 'Required fields: signature, challenge, timestamp',
      });
      return;
    }

    const verification = await nostrAuth.verifySignature({
      pubkey: req.user.nostr_pubkey,
      signature,
      challenge,
      timestamp,
    });

    if (!verification.valid) {
      logger.warn('NOSTR signature verification failed', {
        error: verification.error,
        pubkey: req.user.nostr_pubkey,
        path: req.path,
      });
      res.status(403).json({
        error: 'Invalid NOSTR signature',
        code: 'INVALID_SIGNATURE',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Signature verification error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
    });
    res.status(500).json({
      error: 'Signature verification failed',
      code: 'SIGNATURE_ERROR',
    });
  }
};

// 🏥 Rate limiting for authentication endpoints
export const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    code: 'RATE_LIMITED',
    details: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
};

// 🎯 Validation helpers for user roles
export const isAdmin = (user?: JWTPayload): boolean => {
  return user?.role === 'admin';
};

export const isCreator = (user?: JWTPayload): boolean => {
  return user?.role === 'creator' || user?.role === 'admin';
};

export const isAuthenticated = (user?: JWTPayload): boolean => {
  return !!user && user.signature_verified;
};

// 🔒 Resource ownership middleware
export const requireOwnership = (resourcePubkeyField: string = 'nostr_pubkey') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    // Check if user is admin (admins can access any resource)
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Extract resource pubkey from params, query, or body
    const resourcePubkey =
      req.params[resourcePubkeyField] ||
      req.query[resourcePubkeyField] ||
      req.body[resourcePubkeyField];

    if (!resourcePubkey) {
      res.status(400).json({
        error: 'Resource identifier missing',
        code: 'MISSING_RESOURCE_ID',
        details: `Required field: ${resourcePubkeyField}`,
      });
      return;
    }

    // Check if user owns the resource
    if (req.user.nostr_pubkey !== resourcePubkey) {
      res.status(403).json({
        error: 'Access denied',
        code: 'NOT_OWNER',
        details: 'You can only access your own resources',
      });
      return;
    }

    next();
  };
};

// 🎪 Error handling for authentication middleware
export const handleAuthError = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Authentication error:', error);

  res.status(500).json({
    error: 'Authentication system error',
    code: 'AUTH_SYSTEM_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
  });
};
