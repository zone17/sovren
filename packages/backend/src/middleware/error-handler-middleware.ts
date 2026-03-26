/**
 * Global Error Handler Middleware
 *
 * Centralized error handling for all API routes
 * Provides consistent error response format and logging
 */

import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { getCorrelationId } from './correlation-id';
import { Sentry } from '../lib/sentry';
import logger from '../lib/logger';

// ============================================================================
// Error Types — AppError imported from canonical location (lib/app-error.ts)
// ============================================================================

import { AppError } from '../lib/app-error';
export { AppError };

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', details?: Record<string, unknown> | string) {
    super(429, 'RATE_LIMIT_EXCEEDED', message, details);
  }
}

// Import and re-export canonical error classes from utils/errors
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ServiceError,
  UnauthorizedError,
  AuthorizationError,
} from '../utils/errors';
export {
  ValidationError,
  NotFoundError,
  ConflictError,
  ServiceError,
  UnauthorizedError,
  AuthorizationError,
};

// ============================================================================
// Error Response Interface
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, unknown> | string | Array<Record<string, unknown>>;
  stack?: string;
  metadata: {
    requestId: string;
    timestamp: string;
    path: string;
    method: string;
  };
}

// ============================================================================
// Error Handler Middleware
// ============================================================================

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const requestId = getCorrelationId();

  // Log error details
  logError(error, req, requestId);

  // Handle specific error types
  if (error instanceof AppError) {
    handleAppError(error, req, res, requestId, isDevelopment);
    return;
  }

  if (error instanceof ZodError) {
    handleZodError(error, req, res, requestId);
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    handleJWTError(error, req, res, requestId);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    handleTokenExpiredError(error, req, res, requestId);
    return;
  }

  // Handle unexpected errors
  handleUnexpectedError(error, req, res, requestId, isDevelopment);
};

// ============================================================================
// Error Handler Functions
// ============================================================================

function handleAppError(
  error: AppError,
  req: Request,
  res: Response,
  requestId: string,
  isDevelopment: boolean
): void {
  const response: ErrorResponse = {
    success: false,
    error: error.message,
    code: error.code,
    ...(error.details && { details: error.details }),
    ...(isDevelopment && { stack: error.stack }),
    metadata: {
      requestId,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  res.status(error.statusCode).json(response);
}

function handleZodError(error: ZodError, req: Request, res: Response, requestId: string): void {
  const validationErrors = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    ...('expected' in err && { expected: err.expected }),
    ...('received' in err && { received: err.received }),
  }));

  const response: ErrorResponse = {
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: validationErrors,
    metadata: {
      requestId,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  res.status(400).json(response);
}

function handleJWTError(error: Error, req: Request, res: Response, requestId: string): void {
  const response: ErrorResponse = {
    success: false,
    error: 'Invalid authentication token',
    code: 'INVALID_TOKEN',
    metadata: {
      requestId,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  res.status(401).json(response);
}

function handleTokenExpiredError(
  error: Error,
  req: Request,
  res: Response,
  requestId: string
): void {
  const response: ErrorResponse = {
    success: false,
    error: 'Authentication token expired',
    code: 'TOKEN_EXPIRED',
    details: 'Please refresh your authentication token',
    metadata: {
      requestId,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  res.status(401).json(response);
}

function handleUnexpectedError(
  error: Error,
  req: Request,
  res: Response,
  requestId: string,
  isDevelopment: boolean
): void {
  const response: ErrorResponse = {
    success: false,
    error: isDevelopment ? error.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: error.stack }),
    metadata: {
      requestId,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  res.status(500).json(response);
}

// ============================================================================
// Error Logging
// ============================================================================

function logError(error: Error | AppError, req: Request, requestId: string): void {
  // Capture to Sentry with correlation context
  Sentry.withScope((scope) => {
    scope.setTag('correlationId', requestId);
    scope.setExtra('url', req.path); // Use path, not full URL — query params may contain PII
    scope.setExtra('method', req.method);
    Sentry.captureException(error);
  });

  const errorLog = {
    requestId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof AppError && {
        code: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
      }),
    },
    url: req.path, // path only — query params may contain PII
    method: req.method,
    ip: req.ip,
    user: crypto.createHash('sha256').update(req.user?.nostr_pubkey || '').digest('hex').slice(0, 8),
  };

  if (error instanceof AppError && error.isOperational) {
    logger.warn('Operational error', errorLog);
  } else {
    logger.error('Unexpected error', errorLog);
  }
}

// ============================================================================
// Async Handler Wrapper
// ============================================================================

/**
 * Wraps async route handlers to catch errors and pass to error middleware
 *
 * @example
 * ```typescript
 * router.get('/users/:id', asyncHandler(async (req, res) => {
 *   const user = await userService.getById(req.params.id);
 *   res.json({ success: true, data: user });
 * }));
 * ```
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============================================================================
// 404 Handler
// ============================================================================

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError('Endpoint', {
    details: {
      path: req.path,
      method: req.method,
      suggestion: 'Check the API documentation for available endpoints',
    },
  });
  next(error);
};
