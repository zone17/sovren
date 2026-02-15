/**
 * Structured Logger
 *
 * Winston logger configured for production observability:
 * - JSON format for Loki/Promtail ingestion
 * - Automatic correlation ID injection from AsyncLocalStorage
 * - Sensitive data sanitization
 * - Log level driven by LOG_LEVEL env var
 *
 * @module lib/logger
 */

import winston from 'winston';
import { getRequestContext } from '../middleware/correlation-id';
import { isSensitiveKey } from './sensitive-fields';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Custom format that injects the correlation ID and request context
 * from AsyncLocalStorage into every log entry.
 */
const correlationFormat = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx) {
    info.correlationId = ctx.correlationId;
    info.requestMethod = ctx.method;
    info.requestPath = ctx.path;
  }
  return info;
});

/**
 * Sanitize log data to prevent leaking sensitive information.
 * Redacts common secret field names.
 */
const sanitizeFormat = winston.format((info) => {
  const sanitize = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = sanitize(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  // Sanitize any metadata object
  if (info.metadata && typeof info.metadata === 'object') {
    info.metadata = sanitize(info.metadata as Record<string, unknown>);
  }

  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'sovren-api',
    environment: process.env.NODE_ENV || 'development',
  },
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    correlationFormat(),
    sanitizeFormat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: isProduction
        ? winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
            winston.format.json()
          )
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, correlationId, timestamp, ...rest }) => {
              const cid = correlationId ? ` [${correlationId}]` : '';
              const extra =
                Object.keys(rest).length > 2 // service + environment
                  ? ` ${JSON.stringify(rest)}`
                  : '';
              return `${timestamp} ${level}${cid}: ${message}${extra}`;
            })
          ),
    }),
  ],
});

export default logger;
