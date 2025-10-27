/**
 * Logger Interface
 * Standard logging interface for all services
 * Part of Epic 005 - Backend Service Refactoring
 */

export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error | any): void;
}
