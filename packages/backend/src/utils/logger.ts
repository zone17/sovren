/**
 * Logger Utility
 *
 * Thin wrapper around lib/logger (Winston) that provides the class-based
 * Logger API used by services. All logging is routed through the canonical
 * Winston logger which handles correlation IDs, sanitization, and structured
 * JSON output.
 *
 * @deprecated Import logger directly from '../lib/logger' for new code.
 */

import logger from '../lib/logger';

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  public error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    logger.error(message, {
      context: this.context,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      ...metadata,
    });
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    logger.warn(message, { context: this.context, ...metadata });
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    logger.info(message, { context: this.context, ...metadata });
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    logger.debug(message, { context: this.context, ...metadata });
  }
}
