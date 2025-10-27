/**
 * Global Error Handler Middleware
 *
 * Centralized error handling for all API routes
 * Provides consistent error response format and logging
 */

import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

// ============================================================================
// Error Types
// ============================================================================

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(401, 'AUTHENTICATION_ERROR', message, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', details?: any) {
    super(403, 'AUTHORIZATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: any) {
    super(404, 'NOT_FOUND', `${resource} not found`, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(409, 'CONFLICT', message, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', details?: any) {
    super(429, 'RATE_LIMIT_EXCEEDED', message, details);
  }
}

export class ServiceError extends AppError {
  constructor(message: string, details?: any) {
    super(500, 'SERVICE_ERROR', message, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(500, 'DATABASE_ERROR', message, details, false); // Not operational
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(503, 'EXTERNAL_SERVICE_ERROR', `${service} service unavailable: ${message}`, details);
  }
}

// ============================================================================
// Error Response Interface
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: any;
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
  next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const requestId = (req as any).id || generateRequestId();

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
  const errorLog = {
    requestId,
    timestamp: new Date().toISOString(),
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
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      body: sanitizeForLogging(req.body),
      headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type'),
      },
      ip: req.ip,
    },
    user: (req as any).user?.nostr_pubkey,
  };

  if (error instanceof AppError && error.isOperational) {
    console.warn('⚠️  Operational Error:', JSON.stringify(errorLog, null, 2));
  } else {
    console.error('🔥 Unexpected Error:', JSON.stringify(errorLog, null, 2));
  }
}

function sanitizeForLogging(data: any): any {
  if (!data) return data;

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'privateKey',
    'signature',
    'authorization',
  ];

  if (typeof data === 'object') {
    const sanitized = { ...data };
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  return data;
}

// ============================================================================
// Request ID Generation
// ============================================================================

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Middleware to attach request ID to all requests
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  (req as any).id = generateRequestId();
  res.setHeader('X-Request-ID', (req as any).id);
  next();
};

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
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
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
    path: req.path,
    method: req.method,
    suggestion: 'Check the API documentation for available endpoints',
  });
  next(error);
};

// ============================================================================
// Shutdown Handler
// ============================================================================

export const handleUnhandledRejections = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
    // In production, you might want to exit the process or alert monitoring
    if (process.env.NODE_ENV === 'production') {
      // Alert monitoring service
      console.error('Production unhandled rejection - alerting monitoring');
    }
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('🔥 Uncaught Exception:', error);
    // In production, gracefully shutdown
    if (process.env.NODE_ENV === 'production') {
      console.error('Production uncaught exception - initiating graceful shutdown');
      process.exit(1);
    }
  });
};
