/**
 * Correlation ID Middleware
 *
 * Assigns a unique correlation ID to every incoming request and propagates
 * it through the entire request lifecycle via AsyncLocalStorage.
 *
 * This allows tracing a single request across all log entries, database
 * queries, and external service calls without manually passing IDs.
 *
 * @module middleware/correlation-id
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export interface RequestContext {
  correlationId: string;
  requestStartTime: number;
  method: string;
  path: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context from AsyncLocalStorage.
 * Returns undefined if called outside a request context.
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current correlation ID.
 * Returns 'no-context' if called outside a request lifecycle.
 */
export function getCorrelationId(): string {
  return asyncLocalStorage.getStore()?.correlationId ?? 'no-context';
}

/**
 * Express middleware that assigns a correlation ID and wraps the request
 * in an AsyncLocalStorage context.
 *
 * If the incoming request has an X-Correlation-ID header (from an upstream
 * service or load balancer), that value is reused. Otherwise a new UUID is
 * generated.
 */
// Only accept alphanumeric, hyphens; max 128 chars (covers UUIDs, ULIDs, etc.)
const VALID_CORRELATION_ID = /^[a-zA-Z0-9-]{1,128}$/;

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const rawId = req.get('x-correlation-id') || req.get('x-request-id');
  const correlationId =
    rawId && VALID_CORRELATION_ID.test(rawId) ? rawId : randomUUID();

  // Set the correlation ID on the response header so clients can reference it
  res.setHeader('X-Correlation-ID', correlationId);

  const context: RequestContext = {
    correlationId,
    requestStartTime: Date.now(),
    method: req.method,
    path: req.path,
  };

  asyncLocalStorage.run(context, () => {
    next();
  });
}
