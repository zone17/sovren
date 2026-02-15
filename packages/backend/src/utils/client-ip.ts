import type { Request } from 'express';

/**
 * Extract client IP address from an Express request.
 * Checks X-Forwarded-For and X-Real-IP headers for proxy environments,
 * then falls back to the direct socket connection address.
 */
export function getClientIP(req: Request): string {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return req.get('x-real-ip') || req.ip || req.socket.remoteAddress || 'unknown';
}
