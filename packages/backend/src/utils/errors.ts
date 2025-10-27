/**
 * Service Error Utilities
 * Custom error classes for service layer
 */

export interface ServiceErrorOptions {
  cause?: Error | unknown;
  context?: Record<string, any>;
}

/**
 * ServiceError - Base error class for service layer operations
 * Provides enhanced error tracking with cause chain and context
 */
export class ServiceError extends Error {
  public readonly cause?: Error | unknown;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(message: string, options?: ServiceErrorOptions) {
    super(message);
    this.name = 'ServiceError';
    this.cause = options?.cause;
    this.context = options?.context;
    this.timestamp = new Date();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceError);
    }
  }

  /**
   * Returns a JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

/**
 * ValidationError - Error for validation failures
 */
export class ValidationError extends ServiceError {
  constructor(message: string, options?: ServiceErrorOptions) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

/**
 * NotFoundError - Error for resource not found
 */
export class NotFoundError extends ServiceError {
  constructor(resource: string, options?: ServiceErrorOptions) {
    super(`${resource} not found`, options);
    this.name = 'NotFoundError';
  }
}

/**
 * ConflictError - Error for resource conflicts
 */
export class ConflictError extends ServiceError {
  constructor(message: string, options?: ServiceErrorOptions) {
    super(message, options);
    this.name = 'ConflictError';
  }
}

/**
 * UnauthorizedError - Error for unauthorized access
 */
export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized', options?: ServiceErrorOptions) {
    super(message, options);
    this.name = 'UnauthorizedError';
  }
}
