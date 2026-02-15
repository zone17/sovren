/**
 * Shared sensitive field definitions for sanitization across the codebase.
 * Single source of truth used by logger, sentry, and error handlers.
 */

export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'signature',
  'authorization',
  'credit_card',
  'ssn',
  'nsec',
  'cookie',
  'x-api-key',
  'authToken',
  'authSecret',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'encryptionKey',
  'signingKey',
  'secretKey',
  'secret_key',
] as const;

const SENSITIVE_REGEX = new RegExp(
  `\\b(${SENSITIVE_FIELDS.map((f) => f.replace(/[-_]/g, '[-_]?')).join('|')})\\b`,
  'i'
);

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_REGEX.test(key);
}

const MAX_SANITIZE_DEPTH = 10;

export function sanitizeObject(
  data: Record<string, unknown>,
  depth: number = 0,
  seen: WeakMap<object, Record<string, unknown>> = new WeakMap()
): Record<string, unknown> {
  if (depth >= MAX_SANITIZE_DEPTH) return { _truncated: '[MAX_DEPTH]' };
  if (seen.has(data)) return seen.get(data)!;

  const sanitized: Record<string, unknown> = {};
  seen.set(data, sanitized);

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        item !== null && typeof item === 'object'
          ? sanitizeObject(item as Record<string, unknown>, depth + 1, seen)
          : item
      );
    } else if (value !== null && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, depth + 1, seen);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
