/**
 * Canonical AppError Base Class
 *
 * Single source of truth for the application error base class.
 * Located in lib/ to avoid circular dependencies between
 * error-handler-middleware and utils/errors.
 *
 * @module app-error
 */

export class AppError extends Error {
  public readonly timestamp: Date;

  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown> | string,
    public isOperational: boolean = true,
    public readonly context?: Record<string, unknown>,
    public override readonly cause?: Error | unknown
  ) {
    super(message);
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
