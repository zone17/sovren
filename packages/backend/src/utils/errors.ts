/**
 * Canonical Error Classes
 *
 * Single source of truth for all application error types.
 * These extend AppError from lib/app-error.
 *
 * NOTE: This file imports from lib/app-error.ts, which is also imported by
 * error-handler-middleware.ts. The error-handler-middleware re-exports from
 * this file, creating a circular reference. This is SAFE because:
 * - All references are function-level (resolved at call time, not module init)
 * - TypeScript handles the module initialization order correctly
 * - Verified safe in P2 remediation sprint (2026-02-13)
 */

import { AppError } from '../lib/app-error';

export interface ServiceErrorOptions {
  cause?: Error | unknown;
  context?: Record<string, unknown>;
  details?: Record<string, unknown> | string;
}

export class ServiceError extends AppError {
  constructor(message: string, options?: ServiceErrorOptions) {
    super(500, 'SERVICE_ERROR', message, options?.details, true, options?.context, options?.cause);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, options?: ServiceErrorOptions) {
    super(
      400,
      'VALIDATION_ERROR',
      message,
      options?.details,
      true,
      options?.context,
      options?.cause
    );
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, options?: ServiceErrorOptions) {
    super(
      404,
      'NOT_FOUND',
      `${resource} not found`,
      options?.details,
      true,
      options?.context,
      options?.cause
    );
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, options?: ServiceErrorOptions) {
    super(409, 'CONFLICT', message, options?.details, true, options?.context, options?.cause);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', options?: ServiceErrorOptions) {
    super(
      401,
      'AUTHENTICATION_ERROR',
      message,
      options?.details,
      true,
      options?.context,
      options?.cause
    );
    this.name = 'UnauthorizedError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', options?: ServiceErrorOptions) {
    super(
      403,
      'AUTHORIZATION_ERROR',
      message,
      options?.details,
      true,
      options?.context,
      options?.cause
    );
    this.name = 'AuthorizationError';
  }
}

/**
 * #733: DatabaseError — for 500-class DB failures.
 * Use instead of ValidationError when a Supabase `if (error)` check fires after a DB operation.
 * Ensures the correct HTTP 500 status code and prevents DB internals from leaking to clients.
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', options?: ServiceErrorOptions) {
    super(500, 'DATABASE_ERROR', message, options?.details, true, options?.context, options?.cause);
    this.name = 'DatabaseError';
  }
}
