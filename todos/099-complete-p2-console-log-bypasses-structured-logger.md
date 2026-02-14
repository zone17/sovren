---
status: pending
priority: p2
issue_id: '099'
tags: [code-review, observability, logging]
dependencies: []
---

# 30+ console.log Calls Bypass Structured Logger

## Problem Statement

Over 30 `console.log`, `console.error`, and `console.warn` calls in production code bypass the structured Winston logger (`lib/logger.ts`) which provides correlation IDs, JSON formatting, log levels, sensitive-field sanitization, and integration with log aggregation systems. Direct console calls lack context, are not searchable in production, and don't respect log level configuration.

## Findings

**Affected Files (30+ occurrences):**

- `bootstrap.ts` - 20+ console.log/error calls during startup
- `deployment-monitoring.ts` - 5 console.log calls for deployment events
- `auth.ts` - 2 console.warn calls for auth failures
- `nostr-auth.ts` - 7 console.log/error calls
- `validation-middleware.ts` - 3 console.error calls
- `redis.ts` - console.error for connection errors
- `sentry.ts` - console.log for Sentry init
- `app.ts` - console.log during middleware setup
- Additional files (server.ts, various services)

**Problems with console.log:**

1. **No correlation IDs:** Can't trace logs across request lifecycle
2. **No structured fields:** Plain text, not JSON, hard to parse in log aggregators
3. **No log levels:** Can't filter production logs (debug vs error)
4. **No sanitization:** May leak sensitive data (API keys, tokens, PII)
5. **No Sentry integration:** Errors not reported to error tracking
6. **Not searchable:** Log aggregators (Datadog, Splunk, etc.) can't index unstructured text
7. **No timestamp control:** Console uses OS timezone, not UTC
8. **No context:** Missing user ID, request ID, service name, etc.

**Example of Missing Context:**

```typescript
// Current (bad)
console.log('Payment received'); // Which payment? Which user? When?

// Structured (good)
logger.info('Payment received', {
  paymentId: payment.id,
  userId: req.user.id,
  amount: payment.amount,
  correlationId: req.correlationId,
});
```

## Proposed Solutions

### Option 1: Replace All console._ with logger._

**Pros:**

- Immediate fix: find-replace across codebase
- Full structured logging benefits
- Consistent with existing logger infrastructure
- Enables production log filtering (log level)

**Cons:**

- Requires passing logger instance to all functions
- May need to add context objects to each log call
- ~30+ callsites to update

**Effort:** Medium (4 hours)
**Risk:** Low

### Option 2: Global console.\* Monkey-Patch

**Pros:**

- Zero code changes at callsites
- console.log automatically routed to Winston
- Quick win

**Cons:**

- Loses context (can't add correlation IDs retroactively)
- Doesn't encourage structured logging practices
- Hard to add metadata to existing console calls
- Breaks debugging (console.log in REPL uses logger)

**Effort:** Low (1 hour)
**Risk:** Medium

### Option 3: ESLint Rule + Gradual Migration

**Pros:**

- Prevents new console.\* calls
- Allows gradual migration of existing calls
- Team learns structured logging best practices
- No big-bang change

**Cons:**

- Takes longer to complete
- Requires discipline to finish migration
- Mixed logging approaches during transition

**Effort:** Medium (6 hours over multiple sprints)
**Risk:** Low

## Recommended Action

**Option 1: Replace All console._ with logger._**

Direct replacement provides immediate value and full observability benefits. The codebase already has a well-configured Winston logger—this task is just migration, not infrastructure work.

Implementation:

1. **Automated find-replace:**

   ```bash
   # Find all console.* calls
   grep -r "console\." src/ --include="*.ts" -n

   # Replacements (manual review each)
   console.log → logger.info (or logger.debug for verbose output)
   console.error → logger.error
   console.warn → logger.warn
   console.debug → logger.debug
   ```

2. **Add context objects:**

   - Include correlation IDs from `req.correlationId`
   - Add user IDs, payment IDs, resource IDs
   - Include relevant business context (amount, status, etc.)

3. **Update imports:**

   - Add `import { logger } from '@/lib/logger';` to affected files
   - Pass logger instance if needed (or use singleton)

4. **Add ESLint rule to prevent regression:**

   ```json
   // .eslintrc.json
   {
     "rules": {
       "no-console": ["error", { "allow": [] }]
     }
   }
   ```

5. **Document logging standards:**
   - Create `docs/development/logging-standards.md`
   - Examples of good vs bad log calls
   - When to use each log level

## Technical Details

**Affected Files (minimum 30+ calls):**

- `src/bootstrap.ts`
- `src/monitoring/deployment-monitoring.ts`
- `src/middleware/auth.ts`
- `src/middleware/nostr-auth.ts`
- `src/middleware/validation-middleware.ts`
- `src/lib/redis.ts`
- `src/lib/sentry.ts`
- `src/app.ts`
- `src/server.ts`
- Various service files

**Logger API (lib/logger.ts):**

```typescript
import { logger } from '@/lib/logger';

// Levels (in order of severity)
logger.debug('message', { context }); // Development only
logger.info('message', { context }); // Normal operations
logger.warn('message', { context }); // Warning, needs attention
logger.error('message', { context }); // Error, requires investigation
```

**Migration Examples:**

**Before:**

```typescript
// bootstrap.ts
console.log('Starting application...');
console.error('Failed to connect to database:', error);

// auth.ts
console.warn('Invalid token signature');

// redis.ts
console.error('Redis connection error:', err.message);
```

**After:**

```typescript
// bootstrap.ts
import { logger } from '@/lib/logger';

logger.info('Starting application', {
  environment: process.env.NODE_ENV,
  version: process.env.APP_VERSION,
});
logger.error('Failed to connect to database', {
  error: error.message,
  stack: error.stack,
  host: config.db.host,
});

// auth.ts
logger.warn('Invalid token signature', {
  userId: req.headers['x-user-id'],
  correlationId: req.correlationId,
  ipAddress: req.ip,
});

// redis.ts
logger.error('Redis connection error', {
  error: err.message,
  host: config.redis.host,
  port: config.redis.port,
});
```

**ESLint Configuration:**

```json
{
  "rules": {
    "no-console": ["error", { "allow": [] }]
  }
}
```

**Finding All Occurrences:**

```bash
# Count console.* calls
grep -r "console\." src/ --include="*.ts" | wc -l

# List all files with console calls
grep -r "console\." src/ --include="*.ts" -l

# Show context for each call
grep -r "console\." src/ --include="*.ts" -B 2 -A 2
```

## Acceptance Criteria

- [ ] All `console.log` calls replaced with `logger.info` or `logger.debug`
- [ ] All `console.error` calls replaced with `logger.error`
- [ ] All `console.warn` calls replaced with `logger.warn`
- [ ] All log calls include context objects with relevant metadata
- [ ] Correlation IDs included in request-scoped logs
- [ ] ESLint `no-console` rule enabled and passing
- [ ] No console.\* calls remain in `src/` directory (except tests if needed)
- [ ] Logging standards documented in `docs/development/logging-standards.md`
- [ ] Production logs verified to be JSON-formatted and searchable
- [ ] Log aggregator (Datadog, Splunk, etc.) can parse new structured logs
- [ ] Sentry integration captures logger.error calls
- [ ] Team trained on structured logging best practices

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Counted 30+ console.\* calls across 10+ files
- Confirmed Winston logger is already configured and available
- Proposed find-replace migration with context enrichment

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- Winston logger: https://github.com/winstonjs/winston
- ESLint no-console rule: https://eslint.org/docs/latest/rules/no-console
- Structured logging best practices: https://www.thoughtworks.com/insights/blog/microservices/structured-logging-microservices
- Related: Correlation ID middleware, Sentry integration
