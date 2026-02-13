/**
 * Canonical Error Classes
 *
 * Single source of truth for all application error types.
 * These extend AppError from the error-handler-middleware and are
 * re-exported from there for backward compatibility.
 */

import { AppError } from '../middleware/error-handler-middleware';

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
    super(400, 'VALIDATION_ERROR', message, options?.details, true, options?.context, options?.cause);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, options?: ServiceErrorOptions) {
    super(404, 'NOT_FOUND', `${resource} not found`, options?.details, true, options?.context, options?.cause);
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
    super(401, 'AUTHENTICATION_ERROR', message, options?.details, true, options?.context, options?.cause);
    this.name = 'UnauthorizedError';
  }
}
