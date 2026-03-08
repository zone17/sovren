/**
 * Canonical AppError Base Class
 *
 * Single source of truth for the application error base class.
 * Located in lib/ to avoid circular dependencies between
 * error-handler-middleware and utils/errors.
 *
 * Supports both options object and legacy positional parameters:
 * @example
 * // Options object (preferred)
 * new AppError({ statusCode: 404, code: 'NOT_FOUND', message: 'User not found' });
 *
 * // Legacy positional params (backward compat)
 * new AppError(404, 'NOT_FOUND', 'User not found');
 *
 * @module app-error
 */

export interface AppErrorOptions {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown> | string;
  isOperational?: boolean;
  context?: Record<string, unknown>;
  cause?: Error | unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown> | string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error | unknown;
  public readonly timestamp: Date;

  // Options object pattern (preferred)
  constructor(options: AppErrorOptions);
  // Legacy positional params (backward compat for subclasses)
  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown> | string,
    isOperational?: boolean,
    context?: Record<string, unknown>,
    cause?: Error | unknown
  );
  constructor(
    optionsOrStatusCode: AppErrorOptions | number,
    code?: string,
    message?: string,
    details?: Record<string, unknown> | string,
    isOperational: boolean = true,
    context?: Record<string, unknown>,
    cause?: Error | unknown
  ) {
    if (typeof optionsOrStatusCode === 'object') {
      super(optionsOrStatusCode.message);
      this.statusCode = optionsOrStatusCode.statusCode;
      this.code = optionsOrStatusCode.code;
      this.details = optionsOrStatusCode.details;
      this.isOperational = optionsOrStatusCode.isOperational ?? true;
      this.context = optionsOrStatusCode.context;
      this.cause = optionsOrStatusCode.cause;
    } else {
      super(message!);
      this.statusCode = optionsOrStatusCode;
      this.code = code!;
      this.details = details;
      this.isOperational = isOperational;
      this.context = context;
      this.cause = cause;
    }
    this.name = this.constructor.name;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}
