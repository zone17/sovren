/**
 * Async Route Handler Wrapper
 * Wraps Express route handlers to catch async errors and forward to error middleware.
 * Eliminates try/catch boilerplate across route files.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
