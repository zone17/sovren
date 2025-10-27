/**
 * Authentication Middleware - PAY-016
 *
 * JWT-based authentication middleware for payment endpoints.
 * Validates bearer tokens and extracts user context.
 *
 * @module middleware/auth
 * @story PAY-016
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Extended request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    permissions: string[];
    pubkey?: string;
  };
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** JWT secret key (from environment) */
  jwtSecret: string;
  /** Optional public key for verification */
  jwtPublicKey?: string;
  /** Token expiry in seconds */
  tokenExpiry?: number;
  /** Allow requests without auth (for testing) */
  allowUnauthenticated?: boolean;
}

/**
 * Mock JWT verification (replace with actual JWT library in production)
 */
function verifyJWT(token: string, secret: string): any {
  // In production, use jsonwebtoken library:
  // import jwt from 'jsonwebtoken';
  // return jwt.verify(token, secret);

  // Mock implementation for testing
  if (token === 'valid-test-token') {
    return {
      sub: 'test-user-123',
      email: 'test@example.com',
      permissions: ['read:payments', 'write:payments'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  throw new Error('Invalid token');
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthConfig) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.get('Authorization');

      // Check if authentication is required
      if (!authHeader) {
        if (config.allowUnauthenticated) {
          return next();
        }

        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          message: 'Authorization header is required',
        });
        return;
      }

      // Validate Bearer format
      if (!authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Invalid authentication format',
          code: 'INVALID_AUTH_FORMAT',
          message: 'Authorization header must use Bearer scheme',
        });
        return;
      }

      // Extract token
      const token = authHeader.substring(7);

      if (!token) {
        res.status(401).json({
          error: 'Missing token',
          code: 'MISSING_TOKEN',
          message: 'Bearer token is empty',
        });
        return;
      }

      // Verify token
      let decoded: any;
      try {
        decoded = verifyJWT(token, config.jwtSecret);
      } catch (error) {
        res.status(403).json({
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
          message: 'Token verification failed',
        });
        return;
      }

      // Check expiration
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        res.status(403).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          message: 'JWT token has expired',
        });
        return;
      }

      // Attach user to request
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        permissions: decoded.permissions || [],
        pubkey: decoded.pubkey,
      };

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({
        error: 'Authentication failed',
        code: 'AUTH_ERROR',
        message: 'An error occurred during authentication',
      });
    }
  };
}

/**
 * Create authorization middleware (permission-based)
 */
export function requirePermission(requiredPermission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!req.user.permissions.includes(requiredPermission)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredPermission,
      });
      return;
    }

    next();
  };
}

/**
 * Create ownership verification middleware
 */
export function requireOwnership(userIdParam: string = 'userId') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const requestedUserId = req.params[userIdParam];

    if (req.user.id !== requestedUserId) {
      res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
        message: 'You can only access your own resources',
      });
      return;
    }

    next();
  };
}
