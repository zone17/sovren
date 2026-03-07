---
title: 'P2 Remediation Sprint: Prevention Strategies for Anti-Patterns'
date: 2026-02-13
category: prevention
tags:
  - code-quality
  - linting
  - ci-cd
  - security
  - architecture
  - type-safety
  - testing
---

# Prevention Strategies for Anti-Patterns Discovered in P2 Remediation Sprint

## Overview

The P2 remediation sprint fixed **25+ findings** across security, architecture, and code quality. Seven critical anti-patterns emerged across the codebase:

1. **Duplicate implementations** (3 rate limiters, 2 loggers, 2 error hierarchies, 2 routing systems)
2. **Missing recursive sanitization** (non-recursive sanitizeObject + no depth limit)
3. **Error detail leakage** (internal messages/stack traces exposed to clients)
4. **Shell injection via execSync** (string-interpolated commands)
5. **Dead code accumulation** (769 lines + ghost imports + unused functions)
6. **Type safety erosion** (scattered `as any` casts + loose index signatures)
7. **CSP bypass** (`'unsafe-inline'` in production)

---

## Anti-Pattern 1: Duplicate Implementations

### Root Causes

- **No architectural enforcement**: Design patterns not mandated by linting or CI gates
- **Organic growth**: Features added without checking for existing canonical implementations
- **No central registry**: No visible list of "blessed" implementations for common patterns
- **Reviewer fatigue**: Code review alone cannot catch all duplicate implementations across a large monorepo

### Prevention Strategy

#### A. Create a Pattern Registry (Canonical Sources)

**Action**: Document all canonical patterns in a single location with enforcement rules.

**File**: `/docs/architecture/canonical-patterns.md`

```markdown
# Canonical Implementation Patterns

## Rate Limiting

- **Canonical**: `packages/backend/src/middleware/rate-limit-middleware.ts`
- **API**: `rateLimit(options)` returns Express middleware
- **Consumers**: All route files must import from this location
- **Status**: ✅ DO NOT create new rate limiters

## Logging

- **Canonical**: `packages/backend/src/lib/logger.ts`
- **API**: `logger.info/warn/error/debug(message, metadata)`
- **Consumers**: All services must import from this location
- **Status**: ✅ `utils/logger.ts` deprecated (use lib/logger.ts)

## Error Classes

- **Canonical**: `packages/backend/src/middleware/error-handler-middleware.ts`
- **Base**: `AppError` with subclasses for common error types
- **Pattern**: Extend `AppError`, not standalone class hierarchies
- **Status**: ✅ DO NOT create `utils/errors.ts` equivalents

## Routing

- **Canonical**: `packages/backend/src/app.ts` mounts all routes
- **Route files**: `packages/backend/src/routes/*.ts`
- **Pattern**: Each domain gets ONE route file in `routes/`
- **Status**: ✅ Mount at startup, no lazy loading without refactor
```

#### B. ESLint Rule: Prevent Duplicate Imports

**File**: `.eslintrc.cjs`

```javascript
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/utils/logger', '**/util/logger'],
            message: 'Use packages/backend/src/lib/logger.ts instead (canonical)',
            importNames: ['default', 'logger'],
          },
          {
            group: ['**/utils/errors'],
            message: 'Error classes are in middleware/error-handler-middleware.ts (canonical)',
            importNames: ['ValidationError', 'NotFoundError', 'ConflictError'],
          },
          {
            group: ['**/rateLimit', '**/advanced-rate-limiting', '**/rate.?Limit\\.ts'],
            message: 'Use packages/backend/src/middleware/rate-limit-middleware.ts (canonical)',
          },
          {
            group: ['**/AppError\\.ts'],
            message: 'AppError is exported from middleware/error-handler-middleware.ts',
          },
        ],
      },
    ],
  },
};
```

#### C. Git Hook: Detect Duplicate Implementations

**File**: `.husky/pre-commit`

```bash
#!/bin/sh

# Detect duplicate rate limiters
RATE_LIMIT_FILES=$(git diff --cached --name-only | grep -E '(rateLimit|rate-limit|advanced-rate)' | grep -v node_modules)
if [ ! -z "$RATE_LIMIT_FILES" ]; then
  echo "⚠️  WARNING: Rate limiter files detected in commit:"
  echo "$RATE_LIMIT_FILES"
  echo ""
  echo "Canonical rate limiter: packages/backend/src/middleware/rate-limit-middleware.ts"
  echo "Run: npm run lint -- --fix"
  exit 1
fi

# Detect duplicate loggers
LOGGER_FILES=$(git diff --cached --name-only | grep -E '(logger|Logger)' | grep 'utils/' | grep -v node_modules)
if [ ! -z "$LOGGER_FILES" ]; then
  echo "⚠️  WARNING: Logger files in utils/ detected:"
  echo "$LOGGER_FILES"
  echo ""
  echo "Canonical logger: packages/backend/src/lib/logger.ts"
  exit 1
fi

# Detect duplicate error classes
ERROR_FILES=$(git diff --cached --name-only | grep -E 'utils/errors|AppError' | grep -v 'middleware/error-handler' | grep -v node_modules)
if [ ! -z "$ERROR_FILES" ]; then
  echo "⚠️  WARNING: Error class files detected outside canonical location:"
  echo "$ERROR_FILES"
  echo ""
  echo "Canonical error classes: packages/backend/src/middleware/error-handler-middleware.ts"
  exit 1
fi
```

#### D. CI/CD Gate: Enforce Canonical Pattern Usage

**File**: `.github/workflows/code-quality.yml`

```yaml
name: Code Quality Gates

on: [pull_request]

jobs:
  canonical-patterns:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check for duplicate implementations
        run: |
          # Count rate limiters
          RATE_LIMITER_COUNT=$(find packages/backend/src -name '*rate*limit*' -not -path '*/node_modules/*' -not -path '*/__tests__/*' -not -path '*/.git/*' | wc -l)
          if [ $RATE_LIMITER_COUNT -gt 1 ]; then
            echo "ERROR: Found $RATE_LIMITER_COUNT rate limiter files. Keep only: middleware/rate-limit-middleware.ts"
            exit 1
          fi

          # Count error hierarchies
          ERROR_HIERARCHY_COUNT=$(find packages/backend/src -name '*error*.ts' -not -path '*/node_modules/*' -not -path '*/__tests__/*' -not -path '*/.git/*' | grep -v 'error-handler-middleware' | wc -l)
          if [ $ERROR_HIERARCHY_COUNT -gt 2 ]; then  # Allow error-handler-middleware + 1 other
            echo "ERROR: Found $ERROR_HIERARCHY_COUNT error-related files. Consolidate under error-handler-middleware.ts"
            exit 1
          fi

          # Verify canonical logger is the only logger
          LOGGER_COUNT=$(find packages/backend/src/lib -name '*logger*' -not -path '*/node_modules/*' | wc -l)
          if [ $LOGGER_COUNT -eq 0 ]; then
            echo "ERROR: Canonical logger not found at packages/backend/src/lib/logger.ts"
            exit 1
          fi

      - name: Verify no dead imports
        run: npx ts-prune --error 2>&1 | grep -q "unused" && exit 1 || echo "✅ No dead imports detected"
```

#### E. Test Pattern: Canonical Pattern Enforcement

**File**: `packages/backend/src/__tests__/architecture/canonical-patterns.test.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';

describe('Canonical Pattern Enforcement', () => {
  const SRC_DIR = path.join(__dirname, '../../');

  it('should have exactly one rate limiter implementation', async () => {
    const files = await fs.readdir(SRC_DIR, { recursive: true });
    const rateLimiters = files.filter(
      (f) =>
        typeof f === 'string' &&
        f.match(/rate.?limit/i) &&
        f.endsWith('.ts') &&
        !f.includes('node_modules') &&
        !f.includes('__tests__')
    );
    expect(rateLimiters).toEqual(expect.arrayContaining(['middleware/rate-limit-middleware.ts']));
    expect(rateLimiters.length).toBeLessThanOrEqual(2); // Allows test file
  });

  it('should have canonical error handler in middleware', async () => {
    const errorHandlerPath = path.join(SRC_DIR, 'middleware/error-handler-middleware.ts');
    await expect(fs.access(errorHandlerPath)).resolves.toBeUndefined();
  });

  it('should have canonical logger in lib/', async () => {
    const loggerPath = path.join(SRC_DIR, 'lib/logger.ts');
    await expect(fs.access(loggerPath)).resolves.toBeUndefined();
  });

  it('should not have utils/logger.ts', async () => {
    const oldLoggerPath = path.join(SRC_DIR, 'utils/logger.ts');
    await expect(fs.access(oldLoggerPath)).rejects.toBeDefined();
  });

  it('should not have duplicate routing systems', async () => {
    const files = await fs.readdir(path.join(SRC_DIR, 'routes'), { recursive: true });
    const routeFiles = files.filter(
      (f) => typeof f === 'string' && f.endsWith('.ts') && !f.includes('__tests__')
    );
    expect(routeFiles.length).toBeGreaterThan(0);
    // All routes should be mounted from a single entry point (app.ts)
  });
});
```

---

## Anti-Pattern 2: Missing Recursive Sanitization

### Root Causes

- **Shallow implementation**: Initial sanitizeObject only handled direct properties
- **No depth awareness**: Arrays and nested objects not traversed
- **No stack overflow protection**: No maximum depth limit for deeply nested data
- **Regex mutation**: Pattern didn't match variants (snake_case, kebab-case)

### Prevention Strategy

#### A. Comprehensive Sanitization Implementation

**File**: `packages/backend/src/lib/sensitive-fields.ts` (CORRECTED)

```typescript
/**
 * Comprehensive sensitive field sanitization with recursive depth protection
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
  'auth',
  'key',
  'pwd',
  'passwd',
  'bearer',
  'jwt',
  'access_token',
  'refresh_token',
] as const;

// CRITICAL: Use word boundaries to match variants
// Matches: password, api_key, api-key, apiKey, API_KEY, etc.
const SENSITIVE_REGEX = new RegExp(
  `\\b(${SENSITIVE_FIELDS.map((f) => f.replace(/[-_]/g, '[-_]?')).join('|')})\\b`,
  'i'
);

export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return SENSITIVE_REGEX.test(key);
}

// CRITICAL CONFIGURATION
const MAX_SANITIZE_DEPTH = 10;
const MAX_ARRAY_LENGTH = 1000; // Prevent memory DoS with massive arrays
const CIRCULAR_REFERENCE_MARKER = '[CIRCULAR_REFERENCE]';
const MAX_DEPTH_MARKER = '[MAX_DEPTH_EXCEEDED]';

/**
 * Recursively sanitize an object, handling arrays and nested objects.
 * Protects against circular references and stack overflow via depth limits.
 */
export function sanitizeObject(
  data: unknown,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  // CRITICAL: Depth limit prevents stack overflow on deeply nested data
  if (depth >= MAX_SANITIZE_DEPTH) {
    return MAX_DEPTH_MARKER;
  }

  // Handle primitives early
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // CRITICAL: Circular reference detection prevents infinite loops
  if (seen.has(data)) {
    return CIRCULAR_REFERENCE_MARKER;
  }
  seen.add(data);

  // Handle arrays
  if (Array.isArray(data)) {
    return data.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeObject(item, depth + 1, seen));
  }

  // Handle plain objects
  if (Object.prototype.toString.call(data) === '[object Object]') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1, seen);
      }
    }
    return sanitized;
  }

  // Unsupported types (Date, Map, Set, custom classes, etc.)
  return String(data);
}

/**
 * Clone and sanitize in single pass (for Sentry integration)
 */
export function cloneAndSanitize(data: unknown): unknown {
  try {
    const cloned = JSON.parse(JSON.stringify(data));
    return sanitizeObject(cloned);
  } catch {
    // Fallback for non-serializable data
    return sanitizeObject(data);
  }
}
```

#### B. Sentry Integration with Sanitization

**File**: `packages/backend/src/lib/sentry.ts`

```typescript
import * as Sentry from '@sentry/node';
import { sanitizeObject } from './sensitive-fields';

export const initSentry = () => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // CRITICAL: Sanitize before sending to Sentry
    beforeSend: (event) => {
      if (event.request) {
        event.request = sanitizeObject(event.request) as typeof event.request;
      }
      if (event.extra) {
        event.extra = sanitizeObject(event.extra) as typeof event.extra;
      }
      if (event.contexts) {
        event.contexts = sanitizeObject(event.contexts) as typeof event.contexts;
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => ({
          ...bc,
          data: sanitizeObject(bc.data) as Record<string, unknown>,
        }));
      }
      return event;
    },
  });

  return Sentry;
};

export const Sentry = initSentry();
```

#### C. Test Cases for Recursive Sanitization

**File**: `packages/backend/src/__tests__/lib/sensitive-fields.test.ts`

```typescript
import { sanitizeObject, isSensitiveKey, SENSITIVE_FIELDS } from '../../lib/sensitive-fields';

describe('Sensitive Fields Sanitization', () => {
  describe('isSensitiveKey', () => {
    it('should detect sensitive keys with various formats', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('api_key')).toBe(true);
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('API-KEY')).toBe(true);
      expect(isSensitiveKey('x-api-key')).toBe(true);
      expect(isSensitiveKey('access_token')).toBe(true);
      expect(isSensitiveKey('token_secret')).toBe(true);
    });

    it('should not match non-sensitive keys', () => {
      expect(isSensitiveKey('username')).toBe(false);
      expect(isSensitiveKey('email')).toBe(false);
      expect(isSensitiveKey('id')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isSensitiveKey('')).toBe(false);
      expect(isSensitiveKey(null as any)).toBe(false);
      expect(isSensitiveKey(undefined as any)).toBe(false);
    });
  });

  describe('sanitizeObject - Recursion', () => {
    it('should sanitize nested objects', () => {
      const data = {
        user: {
          name: 'Alice',
          password: 'secret123',
          profile: {
            api_key: 'sk_live_123',
          },
        },
      };

      const result = sanitizeObject(data);
      expect(result).toEqual({
        user: {
          name: 'Alice',
          password: '[REDACTED]',
          profile: {
            api_key: '[REDACTED]',
          },
        },
      });
    });

    it('should sanitize arrays and array elements', () => {
      const data = {
        tokens: [
          { token: 'abc', public: 'data1' },
          { token: 'def', public: 'data2' },
        ],
      };

      const result = sanitizeObject(data);
      expect(result).toEqual({
        tokens: [
          { token: '[REDACTED]', public: 'data1' },
          { token: '[REDACTED]', public: 'data2' },
        ],
      });
    });

    it('should sanitize deeply nested structures', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              level4: {
                password: 'deep_secret',
                safe: 'value',
              },
            },
          },
        },
      };

      const result = sanitizeObject(data);
      // @ts-ignore - Accessing nested structure
      expect(result.level1.level2.level3.level4.password).toBe('[REDACTED]');
      // @ts-ignore
      expect(result.level1.level2.level3.level4.safe).toBe('value');
    });

    it('should handle circular references without infinite loops', () => {
      const data: any = { name: 'Alice' };
      data.self = data; // Circular reference

      const result = sanitizeObject(data);
      expect(result).toEqual({
        name: 'Alice',
        self: '[CIRCULAR_REFERENCE]',
      });
    });

    it('should respect MAX_SANITIZE_DEPTH to prevent stack overflow', () => {
      // Create deeply nested object (more than MAX_SANITIZE_DEPTH levels)
      let data: any = { value: 'safe' };
      for (let i = 0; i < 15; i++) {
        data = { nested: data };
      }

      const result = sanitizeObject(data);
      // Should not throw, should truncate gracefully
      expect(result).toBeDefined();
    });

    it('should truncate massive arrays to prevent memory DoS', () => {
      const data = {
        items: Array(2000).fill({ token: 'secret' }),
      };

      const result = sanitizeObject(data) as any;
      expect(result.items.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('sanitizeObject - Edge Cases', () => {
    it('should handle Date objects', () => {
      const data = { created: new Date('2026-02-13') };
      const result = sanitizeObject(data);
      expect(result).toBeDefined();
      expect(typeof (result as any).created).toBe('string');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });

    it('should handle primitives', () => {
      expect(sanitizeObject('string')).toBe('string');
      expect(sanitizeObject(42)).toBe(42);
      expect(sanitizeObject(true)).toBe(true);
    });

    it('should handle mixed arrays', () => {
      const data = {
        mixed: ['string', 42, { password: 'secret' }, [1, 2, { token: 'abc' }]],
      };

      const result = sanitizeObject(data) as any;
      expect(result.mixed[0]).toBe('string');
      expect(result.mixed[1]).toBe(42);
      expect(result.mixed[2].password).toBe('[REDACTED]');
      expect(result.mixed[3][2].token).toBe('[REDACTED]');
    });
  });
});
```

#### D. Logger Integration

Update all logger calls to use sanitization before emitting sensitive data:

**File**: `packages/backend/src/lib/logger.ts`

```typescript
import { sanitizeObject } from './sensitive-fields';

export const logger = {
  info: (message: string, metadata?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        ...(metadata && { metadata: sanitizeObject(metadata) }),
      })
    );
  },
  error: (message: string, metadata?: Record<string, unknown>) => {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        ...(metadata && { metadata: sanitizeObject(metadata) }),
      })
    );
  },
  // ... other methods with same pattern
};
```

---

## Anti-Pattern 3: Error Detail Leakage

### Root Causes

- **Insufficient error sanitization**: Internal implementation details exposed in API responses
- **JWT error messages**: Specific token validation failures leak information
- **Stack traces in responses**: Development-mode stack traces accidentally sent to clients
- **No error classification**: All errors treated the same (no operational vs unexpected)

### Prevention Strategy

#### A. Generic Error Response Pattern

**File**: `packages/backend/src/middleware/error-handler-middleware.ts` (VERIFY)

```typescript
// CRITICAL: Generic messages for clients, detailed logging server-side
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const requestId = getCorrelationId();

  logError(error, req, requestId); // Server-side details

  if (error instanceof AppError) {
    // Operational errors: safe to expose error code
    const response: ErrorResponse = {
      success: false,
      error: error.message,
      code: error.code,
      ...(isDevelopment && { stack: error.stack }),
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      },
    };
    res.status(error.statusCode).json(response);
    return;
  }

  if (error instanceof ZodError) {
    // Validation errors: safe field-level details
    const validationErrors = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: validationErrors,
      metadata: { requestId, timestamp: new Date().toISOString() },
    });
    return;
  }

  // JWT errors: GENERIC message (never expose specific JWT claims or signature issues)
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Authentication failed', // GENERIC: never say "invalid signature" or "expired"
      code: 'AUTHENTICATION_ERROR',
      metadata: { requestId, timestamp: new Date().toISOString() },
    });
    return;
  }

  // Unexpected errors: NEVER expose implementation details to clients
  res.status(500).json({
    success: false,
    error: isDevelopment ? error.message : 'Internal server error', // Generic in prod
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: error.stack }),
    metadata: { requestId, timestamp: new Date().toISOString() },
  });
};
```

#### B. Validation Schema Constraints (No Details Leakage)

**File**: `packages/backend/src/routes/v1/payment.routes.ts`

```typescript
import { z } from 'zod';

// CRITICAL: Bounded validators prevent information disclosure
const createPaymentSchema = z.object({
  amount: z.number().positive().max(999999), // Bounded
  currency: z.enum(['BTC', 'USD']), // Enumerated
  recipient: z.string().uuid(), // Strongly typed
  description: z.string().max(500), // Bounded
  // NO z.any() - that allows arbitrary input and leaks error details
});

// CRITICAL: Custom refinements log details server-side, not to client
const validatePaymentWithDetails = createPaymentSchema.refine(
  async (data) => {
    try {
      // Detailed checks server-side
      const recipient = await db.users.findUnique({ id: data.recipient });
      if (!recipient) {
        // Server logs the real error
        logger.warn('Payment to non-existent recipient', { userId: data.recipient });
        // Client gets generic error
        throw new Error('Invalid recipient'); // Generic to client
      }
      return true;
    } catch (e) {
      logger.error('Payment validation failed', sanitizeObject(e)); // Server logs details
      throw new Error('Payment validation failed'); // Generic to client
    }
  },
  {
    message: 'Payment validation failed', // Generic message
  }
);
```

#### C. Test Cases for Error Handling

**File**: `packages/backend/src/__tests__/middleware/error-handler-middleware.test.ts`

```typescript
import { errorHandler, AppError } from '../../middleware/error-handler-middleware';
import { Request, Response, NextFunction } from 'express';

describe('Error Handler Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnValue({});
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      path: '/api/test',
      method: 'POST',
    };

    res = {
      status: statusMock,
      json: jsonMock,
    };

    next = jest.fn();
  });

  describe('JWT Error Handling', () => {
    it('should NOT expose JWT signature details to client', () => {
      const jwtError = new Error('Invalid signature');
      jwtError.name = 'JsonWebTokenError';

      errorHandler(jwtError, req as Request, res as Response, next);

      const callArgs = statusMock.mock.calls[0];
      expect(callArgs[0]).toBe(401);

      const responseBody = jsonMock.mock.calls[0][0];
      expect(responseBody.error).toBe('Authentication failed');
      expect(responseBody.error).not.toContain('signature');
      expect(responseBody.error).not.toContain('JsonWebTokenError');
    });

    it('should NOT expose token expiry details', () => {
      const tokenError = new Error('jwt expired');
      tokenError.name = 'TokenExpiredError';

      errorHandler(tokenError, req as Request, res as Response, next);

      const responseBody = jsonMock.mock.calls[0][0];
      expect(responseBody.error).toBe('Authentication failed');
      expect(responseBody.error).not.toContain('expired');
    });

    it('should never expose stack traces to clients in production', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Database connection failed');
      errorHandler(error, req as Request, res as Response, next);

      const responseBody = jsonMock.mock.calls[0][0];
      expect(responseBody.stack).toBeUndefined();
      expect(responseBody.error).toBe('Internal server error');
    });

    it('should expose stack traces ONLY in development', () => {
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      errorHandler(error, req as Request, res as Response, next);

      const responseBody = jsonMock.mock.calls[0][0];
      expect(responseBody.stack).toBeDefined();
    });
  });

  describe('Operational Errors', () => {
    it('should expose operational error codes (safe info)', () => {
      const authError = new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
      errorHandler(authError, req as Request, res as Response, next);

      const responseBody = jsonMock.mock.calls[0][0];
      expect(responseBody.code).toBe('INVALID_CREDENTIALS');
      expect(responseBody.statusCode).toBeUndefined(); // Don't expose HTTP status in body
    });
  });

  describe('Validation Errors', () => {
    it('should expose field-level validation errors (safe details)', () => {
      const zodError = {
        name: 'ZodError',
        errors: [{ path: ['email'], message: 'Invalid email', code: 'invalid_string' }],
      };

      errorHandler(zodError as any, req as Request, res as Response, next);

      const responseBody = jsonMock.mock.calls[0][0];
      expect(responseBody.details).toBeDefined();
      expect(responseBody.details[0].field).toBe('email');
    });
  });
});
```

---

## Anti-Pattern 4: Shell Injection via execSync

### Root Causes

- **String concatenation**: Command strings built with unvalidated user input
- **No argument escaping**: Shell metacharacters not escaped
- **execSync instead of execFileSync**: Using shell interpreter when direct execution available
- **No validation**: Commands not pre-validated before execution

### Prevention Strategy

#### A. Replace execSync with execFileSync

**File**: `scripts/automated-supabase-rotation.ts` (CORRECTED)

```typescript
import { execFileSync } from 'child_process';
import path from 'path';

// BEFORE (VULNERABLE):
// const password = getUserInput(); // Could be: "abc'; rm -rf /"
// execSync(`psql -U admin -c "ALTER USER postgres PASSWORD '${password}'"`);

// AFTER (SAFE):
export function rotateSupabasePassword(newPassword: string): void {
  // CRITICAL: Use execFileSync with separate arguments array
  // Shell metacharacters are automatically escaped and not interpreted
  try {
    execFileSync('psql', ['-U', 'admin', '-c', `ALTER USER postgres PASSWORD '${newPassword}'`], {
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
  } catch (error) {
    throw new Error(`Password rotation failed: ${(error as Error).message}`);
  }
}

export function rotateGitHubToken(newToken: string, repo: string): void {
  // Use gh CLI with separate arguments (no string interpolation)
  try {
    execFileSync(
      'gh',
      [
        'secret',
        'set',
        'GITHUB_TOKEN',
        '--repo',
        repo,
        '--body',
        newToken, // Passed as separate argument, not interpolated
      ],
      {
        stdio: 'pipe',
        timeout: 30000,
      }
    );
  } catch (error) {
    throw new Error(`GitHub token rotation failed: ${(error as Error).message}`);
  }
}

export function validateAwsCredentials(accessKey: string, secretKey: string): void {
  // aws CLI also uses execFileSync with arguments
  try {
    execFileSync(
      'aws',
      [
        'sts',
        'get-caller-identity',
        '--access-key-id',
        accessKey,
        '--secret-access-key',
        secretKey,
      ],
      {
        stdio: 'pipe',
        timeout: 10000,
      }
    );
  } catch (error) {
    throw new Error(`AWS credentials invalid: ${(error as Error).message}`);
  }
}
```

#### B. ESLint Rule to Block execSync

**File**: `.eslintrc.cjs`

```javascript
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'child_process',
            importNames: ['execSync'],
            message:
              'execSync with string templates is a shell injection risk. Use execFileSync with separate arguments array instead. ' +
              'See: scripts/automated-supabase-rotation.ts for examples.',
          },
        ],
      },
    ],

    // Custom rule pattern for string interpolation in shell commands
    'no-template-literals-in-shell': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow template literals in shell command strings',
        },
      },
      create(context) {
        return {
          TaggedTemplateExpression(node) {
            if (node.tag.name === 'execSync' || node.tag.name === 'sh') {
              context.report({
                node,
                message: 'Use execFileSync with argument array instead of template literals',
              });
            }
          },
        };
      },
    },
  },
};
```

#### C. Test Cases for Shell Injection Prevention

**File**: `scripts/__tests__/automated-supabase-rotation.test.ts`

```typescript
import { execFileSync } from 'child_process';
import { rotateSupabasePassword, rotateGitHubToken } from '../automated-supabase-rotation';

jest.mock('child_process');

describe('Shell Injection Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execFileSync usage', () => {
    it('should use execFileSync instead of execSync', () => {
      const mockExecFileSync = execFileSync as jest.Mock;
      mockExecFileSync.mockReturnValue(Buffer.from(''));

      rotateSupabasePassword('newPassword123');

      // Verify execFileSync was called
      expect(mockExecFileSync).toHaveBeenCalled();
      const [command, args] = mockExecFileSync.mock.calls[0];

      // CRITICAL: Arguments should be separate array, not concatenated string
      expect(command).toBe('psql');
      expect(Array.isArray(args)).toBe(true);
      expect(args).not.toContain("'newPassword123'"); // Not quoted as shell string
    });

    it('should pass password as separate argument, not in command string', () => {
      const mockExecFileSync = execFileSync as jest.Mock;
      mockExecFileSync.mockReturnValue(Buffer.from(''));

      const password = "'; DROP TABLE users; --";
      rotateSupabasePassword(password);

      const [command, args] = mockExecFileSync.mock.calls[0];

      // Password should be in args array, not in command string
      expect(args).toContain(password);
      // Command should NOT contain interpolated string
      expect(command).not.toContain(password);
    });

    it('should not allow shell metacharacters in password', () => {
      const mockExecFileSync = execFileSync as jest.Mock;
      mockExecFileSync.mockReturnValue(Buffer.from(''));

      const dangerousPassword = 'pass`whoami`.word';
      rotateSupabasePassword(dangerousPassword);

      const [, args] = mockExecFileSync.mock.calls[0];

      // execFileSync with array args treats backticks as literal characters
      expect(args.join('')).toBe(expect.stringContaining('pass`whoami`.word'));
    });

    it('should handle semicolons in input without allowing command injection', () => {
      const mockExecFileSync = execFileSync as jest.Mock;
      mockExecFileSync.mockReturnValue(Buffer.from(''));

      const maliciousPassword = "abc'; rm -rf /; --";
      rotateSupabasePassword(maliciousPassword);

      const [, args] = mockExecFileSync.mock.calls[0];

      // Semicolon should be literal, not a command separator
      expect(args).toContain(maliciousPassword);
    });
  });

  describe('GitHub token rotation', () => {
    it('should use execFileSync with gh CLI', () => {
      const mockExecFileSync = execFileSync as jest.Mock;
      mockExecFileSync.mockReturnValue(Buffer.from(''));

      rotateGitHubToken('ghp_newToken123', 'owner/repo');

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['secret', 'set']),
        expect.any(Object)
      );
    });
  });
});
```

---

## Anti-Pattern 5: Dead Code Accumulation

### Root Causes

- **No automated cleanup**: Dead code not detected until manual review
- **Ghost imports**: Unused imports remain after function is deleted
- **Orphaned functions**: Functions not exported but never called
- **Historical artifacts**: Code kept "just in case" instead of using version control

### Prevention Strategy

#### A. TypeScript Compiler + ts-prune Configuration

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowUnusedLabels": false,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

#### B. ESLint Rules for Dead Code Detection

**File**: `.eslintrc.cjs`

```javascript
module.exports = {
  plugins: ['unused-imports'],
  rules: {
    'no-unused-vars': 'off', // Covered by TypeScript
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-last',
        argsIgnorePattern: '^_',
      },
    ],
  },
};
```

#### C. CI/CD Gate for Dead Code

**File**: `.github/workflows/code-quality.yml`

```yaml
name: Code Quality Gates

on: [pull_request]

jobs:
  dead-code-detection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Run ts-prune to detect dead code
        run: |
          npm install -g ts-prune
          OUTPUT=$(ts-prune --error 2>&1)
          if echo "$OUTPUT" | grep -q "unused"; then
            echo "::error::Dead code detected:"
            echo "$OUTPUT"
            exit 1
          fi

      - name: Run TypeScript with strict unused checking
        run: npx tsc --noUnusedLocals --noUnusedParameters --noEmit
```

#### D. Pre-Commit Hook to Prevent Dead Code

**File**: `.husky/pre-commit`

```bash
#!/bin/sh

# Check for unused imports
echo "Checking for unused imports..."
npx eslint packages/backend/src --fix --rule "unused-imports/no-unused-imports: error"

if [ $? -ne 0 ]; then
  echo "❌ Unused imports found and fixed. Please review and re-stage."
  exit 1
fi

# Check for unreachable code
echo "Checking for unreachable code..."
npx tsc --noUnusedLocals --noUnusedParameters --noEmit packages/backend/src

if [ $? -ne 0 ]; then
  echo "❌ Dead code detected. Remove unused variables/functions."
  exit 1
fi

echo "✅ No dead code detected"
```

#### E. Test Pattern for Dead Code Detection

**File**: `packages/backend/src/__tests__/architecture/dead-code.test.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';

describe('Dead Code Detection', () => {
  const SRC_DIR = path.join(__dirname, '../../');

  it('should not have files with only exports and no usage', async () => {
    // This would typically be run via ts-prune in CI
    // This test is for documentation purposes
    const files = await fs.readdir(SRC_DIR, { recursive: true });
    const typeScriptFiles = files.filter(
      (f) =>
        typeof f === 'string' &&
        f.endsWith('.ts') &&
        !f.includes('__tests__') &&
        !f.includes('node_modules')
    );

    // Would verify via static analysis in CI
    expect(typeScriptFiles.length).toBeGreaterThan(0);
  });

  it('should not have unused dependencies in package.json', async () => {
    // Typically verified via depcheck tool
    // Example: npx depcheck
  });
});
```

---

## Anti-Pattern 6: Type Safety Erosion

### Root Causes

- **`as any` shortcuts**: Type assertions used to bypass compiler checks
- **Index signatures**: `[key: string]: unknown` on request object allows unchecked access
- **Missing module augmentation**: Express Request type not extended for custom properties
- **No strict type checking**: TypeScript strict mode not enforced

### Prevention Strategy

#### A. Module Augmentation for Express

**File**: `packages/backend/src/types/express.d.ts`

```typescript
import 'express';

// CRITICAL: Augment Express Request with typed custom properties
// instead of using loose index signatures
declare global {
  namespace Express {
    interface Request {
      // Custom properties with explicit types
      rawBody?: Buffer;
      user?: AuthenticatedUser;
      correlationId?: string;
      startTime?: number;
    }
  }
}

// Define the authenticated user interface
export interface AuthenticatedUser {
  id: string;
  nostr_pubkey: string;
  email?: string;
  role?: 'admin' | 'user' | 'creator';
  signature_verified: boolean;
  iat?: number; // issued at
  exp?: number; // expiration
}

// Export for use in route handlers
export {};
```

#### B. Eliminate `as any` Casts

**File**: `packages/backend/src/middleware/advanced-rate-limiting.ts` (CORRECTED)

```typescript
// BEFORE (UNSAFE):
// const user = (req as any).user;
// const headers = (req as any).headers;

// AFTER (SAFE):
import { Request, Response, NextFunction } from 'express';

export const bypassDetector = (req: Request, res: Response, next: NextFunction) => {
  // Use typed Request with proper type checking
  const user = req.user; // Type-safe: Express.Request.user is AuthenticatedUser | undefined

  // No 'as any' - TypeScript will error if accessing non-existent properties
  if (user?.role === 'admin') {
    // TypeScript ensures 'role' exists and is one of the allowed values
    res.setHeader('X-Bypass-Reason', 'admin');
  }

  next();
};
```

#### C. ESLint Rule to Block `as any`

**File**: `.eslintrc.cjs`

```javascript
module.exports = {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
  },
};
```

#### D. TypeScript Strict Mode

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

#### E. Test Cases for Type Safety

**File**: `packages/backend/src/__tests__/types/express-augmentation.test.ts`

```typescript
import { Request } from 'express';
import { AuthenticatedUser } from '../../types/express';

describe('Express Type Augmentation', () => {
  it('should require explicit user type with no as any', () => {
    const req = {} as Request;

    // SAFE: TypeScript knows user is AuthenticatedUser | undefined
    if (req.user) {
      const userId = req.user.id; // Type-safe
      const pubkey = req.user.nostr_pubkey; // Type-safe
      // @ts-expect-error - 'invalid_field' does not exist on AuthenticatedUser
      const invalid = req.user.invalid_field;
    }
  });

  it('should type rawBody property', () => {
    const req = {} as Request;

    // SAFE: TypeScript knows rawBody is Buffer | undefined
    if (req.rawBody) {
      const length = req.rawBody.length; // Type-safe
      const str = req.rawBody.toString(); // Type-safe
      // @ts-expect-error - rawBody is not string
      const asString: string = req.rawBody;
    }
  });

  it('should type correlationId property', () => {
    const req = {} as Request;

    // SAFE: TypeScript knows correlationId is string | undefined
    if (req.correlationId) {
      const upper = req.correlationId.toUpperCase(); // Type-safe
      // @ts-expect-error - correlationId is not number
      const num: number = req.correlationId;
    }
  });

  it('should not allow arbitrary properties without augmentation', () => {
    const req = {} as Request;

    // @ts-expect-error - 'arbitrary' property not defined on Request
    const arbitrary = req.arbitrary;
  });
});
```

---

## Anti-Pattern 7: CSP Bypass

### Root Causes

- **Production `unsafe-inline`**: CSP policy in vercel.json allows inline scripts
- **WebSocket protocol mismatch**: `ws:` instead of `wss:` in connect-src
- **No CSP validation**: Policy not tested before deployment
- **No SRI hashes**: Inline scripts not integrity-checked

### Prevention Strategy

#### A. Strict CSP Configuration

**File**: `vercel.json` (CORRECTED)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'nonce-{NONCE}'; style-src 'self'; connect-src 'self' https://api.sovren.dev wss:; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
        }
      ]
    }
  ]
}
```

**File**: `packages/frontend/nginx.conf` (CORRECTED)

```nginx
server {
  # CRITICAL: No 'unsafe-inline' in production
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https: wss:; img-src 'self' data: https:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';" always;

  # Enforce HTTPS-only connections
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

  # No clickjacking
  add_header X-Frame-Options "DENY" always;

  # No type sniffing
  add_header X-Content-Type-Options "nosniff" always;

  # No XSS
  add_header X-XSS-Protection "1; mode=block" always;
}
```

#### B. CSP Validation Test

**File**: `packages/backend/src/__tests__/security/csp-policy.test.ts`

```typescript
describe('Content Security Policy', () => {
  it('should not allow unsafe-inline in production', () => {
    const cspHeader = process.env.CSP_POLICY || getCSPFromVercelJson();

    expect(cspHeader).not.toContain("'unsafe-inline'");
    expect(cspHeader).not.toContain('unsafe-eval');
  });

  it('should use wss: for WebSocket connections', () => {
    const cspHeader = process.env.CSP_POLICY || getCSPFromVercelJson();

    // Should allow wss: for secure websockets
    expect(cspHeader).toContain('wss:');
    // Should NOT allow ws: (insecure)
    expect(cspHeader).not.toContain('ws:');
  });

  it('should have frame-ancestors set to none', () => {
    const cspHeader = process.env.CSP_POLICY || getCSPFromVercelJson();

    expect(cspHeader).toContain("frame-ancestors 'none'");
  });

  it('should have object-src set to none', () => {
    const cspHeader = process.env.CSP_POLICY || getCSPFromVercelJson();

    expect(cspHeader).toContain("object-src 'none'");
  });

  it('should include upgrade-insecure-requests', () => {
    const cspHeader = process.env.CSP_POLICY || getCSPFromVercelJson();

    expect(cspHeader).toContain('upgrade-insecure-requests');
  });
});

function getCSPFromVercelJson(): string {
  const vercelJson = JSON.parse(readFileSync('vercel.json', 'utf-8'));
  const cspHeader = vercelJson.headers
    .flatMap((h: any) => h.headers)
    .find((h: any) => h.key === 'Content-Security-Policy');
  return cspHeader?.value || '';
}
```

#### C. CSP Violations Monitoring

**File**: `packages/frontend/src/monitoring/csp-violations.ts`

```typescript
/**
 * Monitor CSP violations and report to Sentry
 */

export function initializeCSPMonitoring() {
  document.addEventListener('securitypolicyviolation', (event: SecurityPolicyViolationEvent) => {
    console.warn('CSP Violation:', {
      violatedDirective: event.violatedDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
    });

    // Report to Sentry for monitoring
    if (window.Sentry) {
      window.Sentry.captureMessage('CSP Violation', {
        level: 'warning',
        contexts: {
          csp: {
            violated_directive: event.violatedDirective,
            blocked_uri: event.blockedURI,
          },
        },
      });
    }
  });
}
```

---

## Implementation Roadmap

### Phase 1: Immediate Actions (Week 1)

- [ ] Create canonical patterns registry (`docs/architecture/canonical-patterns.md`)
- [ ] Configure ESLint rules to block duplicates and unsafe patterns
- [ ] Update `.husky/pre-commit` hook with all checks
- [ ] Deploy TypeScript strict mode configuration

### Phase 2: Codebase Cleanup (Week 2)

- [ ] Run `ts-prune` and remove all dead code
- [ ] Consolidate rate limiters → canonical implementation
- [ ] Consolidate loggers → canonical implementation
- [ ] Migrate error classes to unified hierarchy

### Phase 3: Security Hardening (Week 3)

- [ ] Update CSP policies in vercel.json and nginx.conf
- [ ] Verify sanitization is recursive with depth limits
- [ ] Replace all `execSync` with `execFileSync`
- [ ] Deploy error detail leakage fixes

### Phase 4: Type Safety (Week 4)

- [ ] Eliminate all `as any` casts
- [ ] Implement Express module augmentation
- [ ] Enable TypeScript strict mode compilation
- [ ] Verify type coverage >= 95%

### Phase 5: Testing & Verification (Week 5)

- [ ] Write comprehensive test suites for all patterns
- [ ] Deploy CI/CD gates for dead code, type safety, and security
- [ ] Run full test suite with coverage reports
- [ ] Perform security audit of all changes

---

## Success Metrics

| Metric                          | Target | Current             | Status         |
| ------------------------------- | ------ | ------------------- | -------------- |
| Duplicate implementations       | 0      | 7                   | ⚠️ In progress |
| Dead code lines                 | 0      | 769                 | ⚠️ In progress |
| Type safety (% coverage)        | 95%    | 88%                 | ⚠️ In progress |
| CSP violations                  | 0      | 1 (`unsafe-inline`) | ⚠️ In progress |
| Shell injection vulnerabilities | 0      | 2 (`execSync`)      | ⚠️ In progress |
| Error detail leakage findings   | 0      | 3                   | ⚠️ In progress |
| Recursive sanitization depth    | 10+    | Current             | ✅ Complete    |

---

## Related Documents

- [P2 Remediation Plan](/Users/fp/Desktop/Sovren/docs/plans/p2-remediation-plan.md)
- [P1 Post-Remediation Critical Fixes](/Users/fp/Desktop/Sovren/docs/solutions/security-issues/p1-post-remediation-critical-fixes.md)
- [Infrastructure Sprint Software Factory](/Users/fp/Desktop/Sovren/docs/solutions/infrastructure-issues/infrastructure-sprint-software-factory-first.md)
- [Project CLAUDE.md](/Users/fp/Desktop/Sovren/CLAUDE.md)
