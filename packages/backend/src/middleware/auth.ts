import { nostrAuth } from '@/services/nostr-auth';
import { NextFunction, Request, Response } from 'express';
import logger from '../lib/logger';
import { AppError } from '../lib/app-error';
import { UnauthorizedError, AuthorizationError, ValidationError, ServiceError } from '../utils/errors';

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
      throw new UnauthorizedError('Authorization header required', {
        details: 'Expected Authorization: Bearer <token> header',
      });
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
      throw new UnauthorizedError('Authentication failed');
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
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Authentication service error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      path: req.path,
    });
    next(new AppError({ statusCode: 500, code: 'AUTH_ERROR', message: 'Authentication failed' }));
  }
};

// 🎭 Role-based authorization middleware
export const authorize = (allowedRoles: Array<'creator' | 'supporter' | 'admin'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required', {
        details: 'User must be authenticated to access this resource',
      }));
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
      next(new AuthorizationError('Insufficient permissions'));
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
    logger.warn('Optional auth failed', { error: (error as Error).message });
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
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const { signature, challenge, timestamp } = req.body;

    if (!signature || !challenge || !timestamp) {
      next(new ValidationError('NOSTR signature verification required', {
        details: 'Required fields: signature, challenge, timestamp',
      }));
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
      next(new AuthorizationError('Invalid NOSTR signature'));
      return;
    }

    next();
  } catch (error) {
    logger.error('Signature verification error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
    });
    next(new ServiceError('Signature verification failed', { cause: error }));
  }
};


// 🔒 Resource ownership middleware
export const requireOwnership = (resourcePubkeyField: string = 'nostr_pubkey') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
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
      next(new ValidationError('Resource identifier missing', {
        details: `Required field: ${resourcePubkeyField}`,
      }));
      return;
    }

    // Check if user owns the resource
    if (req.user.nostr_pubkey !== resourcePubkey) {
      next(new AuthorizationError('Access denied: you can only access your own resources'));
      return;
    }

    next();
  };
};

