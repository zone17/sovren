/**
 * Shared sensitive field definitions for sanitization across the codebase.
 * Single source of truth used by logger, sentry, and error handlers.
 */

export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'privateKey',
  'signature',
  'authorization',
  'credit_card',
  'ssn',
  'nsec',
  'private_key',
  'cookie',
  'x-api-key',
] as const;

const SENSITIVE_REGEX = new RegExp(SENSITIVE_FIELDS.join('|'), 'i');

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_REGEX.test(key);
}

export function sanitizeObject(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };
  for (const key of Object.keys(sanitized)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}
