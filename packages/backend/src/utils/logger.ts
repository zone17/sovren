/**
 * 📝 **LOGGER UTILITY**
 *
 * Elite logging utility for the backend with structured logging,
 * different log levels, and production-ready features.
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  metadata?: Record<string, any>;
  error?: Error;
}

export class Logger {
  private context: string;
  private logLevel: LogLevel;

  constructor(context: string) {
    this.context = context;
    this.logLevel = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    switch (level) {
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
        return LogLevel.DEBUG;
      default:
        return LogLevel.INFO;
    }
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): void {
    if (level > this.logLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: this.context,
      metadata,
      error,
    };

    const logMessage = this.formatMessage(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
    }
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    let message = `[${timestamp}] [${level}] [${entry.context}] ${entry.message}`;

    if (entry.metadata) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      message += ` Error: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n${entry.error.stack}`;
      }
    }

    return message;
  }

  public error(message: string, error?: Error | unknown, metadata?: Record<string, any>): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log(LogLevel.ERROR, message, metadata, errorObj);
  }

  public warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  public info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  public debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }
}
