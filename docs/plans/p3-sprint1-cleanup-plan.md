# P3 Sprint 1: Code Quality + Dead Code + Architecture Cleanup

## Executive Summary

**Sprint scope**: 11 of 15 P3 findings. 4 deferred.
**Estimated impact**: ~230,000+ lines removed, 18 `ServiceToken<any>` eliminated, 5 duplicate utility patterns consolidated.

### IN SCOPE (11 items, 4 batches)

| Batch | Items                   | Theme                                         | Risk       |
| ----- | ----------------------- | --------------------------------------------- | ---------- |
| 1     | 057, 014, 056           | Dead code deletion (safe, no behavior change) | Low        |
| 2     | 016, 036, 058, 034, 110 | Code quality + consolidation                  | Low        |
| 3     | 107, 108, 148           | Type safety + dead code cleanup               | Low-Medium |
| 4     | 017                     | Architecture: scoped service reclassification | Low        |

### DEFERRED (4 items)

| Item                                 | Reason                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **015** (779 any + 624 console.log)  | Too large for one sprint. The 18 `ServiceToken<any>` fixes (todo 108) are the highest-value subset. Remaining `any` types and `console.log` require per-file analysis. **Recommendation**: Create ESLint rules to prevent NEW violations, tackle existing ones incrementally. |
| **145** (5 god classes >500 lines)   | High risk. Decomposing subscription-management-service (1,114 lines) into 3 services requires extensive testing, touches payment flows, and needs its own sprint with dedicated QA. Same for lightning-service (900 lines), receipt-service (888 lines).                      |
| **147** (circular dependency chains) | The known error-handler cycle is verified safe (function-level refs). DI container cycles require `madge --circular` audit first. Needs investigation sprint, not cleanup sprint. The interface extraction in todo 108 may resolve some cycles as a side effect.              |
| **015 partial** (ESLint rules)       | ESLint rule additions (`no-explicit-any`, `no-console`) would flag hundreds of existing violations. Better to add as `warn` after the bulk fixes land.                                                                                                                        |

---

## Batch 1: Dead Code Deletion (No Behavior Change)

**Dependencies**: None. Can start immediately.
**Risk**: Low (deletion only, git recoverable).
**Estimated removals**: ~228,000 lines.

---

### 1.1 TODO-057: Delete monitoring/ directory (223K lines)

**Priority**: Highest value-to-effort ratio in the entire sprint.

**Verification (already confirmed)**:

- `monitoring/` has 11,398 files, ~223,696 lines
- NOT part of npm workspaces
- NOT imported by any backend/frontend code
- Contains `dashboard/` and exact duplicate `dashboard-backup/`
- Only reference: `jest.config.elite.ts` line 170

**Files to modify**:

- DELETE: `monitoring/` (entire directory)
- EDIT: `jest.config.elite.ts` line 170 (remove monitoring path reference)

**Before/After**:

```typescript
// jest.config.elite.ts — remove the monitoring path from modulePathIgnorePatterns or testPathIgnorePatterns
// BEFORE (line ~170):
'<rootDir>/monitoring/',
// AFTER: remove this line entirely
```

**Risk**: Low. Verify with: `grep -r "monitoring/" .github/workflows/ docker-compose*.yml`

---

### 1.2 TODO-014: Delete duplicate Finder files and root markdown clutter

**Verified state**:

- 64 files with " 2", " 3", " 4" in names (Finder copy artifacts)
- 142 non-standard root markdown files (status reports, completion summaries)

**Step 1 — Delete all "space N" duplicates**:

```bash
# Pattern: find and delete files with " 2", " 3", " 4" in names
find . -maxdepth 4 -name "* [0-9]*" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/monitoring/*" \
  -delete
```

**Step 2 — Delete root markdown clutter**:
Keep ONLY these root `.md` files:

- `README.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `CLAUDE.md`
- `SOVREN_PRD.md`
- `CODE_OF_CONDUCT.md` (if exists)
- `LICENSE.md` (if exists)

Delete all others (142 files like `LEGENDARY_STATUS_CONFIRMED.md`, `US-*-COMPLETE.md`, `EPIC_*_REPORT.md`, etc.)

```bash
# Delete root markdown files except standard ones
find . -maxdepth 1 -name "*.md" \
  -not -name "README.md" \
  -not -name "CHANGELOG.md" \
  -not -name "CONTRIBUTING.md" \
  -not -name "CLAUDE.md" \
  -not -name "SOVREN_PRD.md" \
  -not -name "CODE_OF_CONDUCT.md" \
  -not -name "LICENSE.md" \
  -delete
```

**Risk**: Low. Files are AI agent status reports with no code references. Git retains history.

---

### 1.3 TODO-056: Consolidate rotation scripts

**Verified state** (some scripts already deleted in prior sprints):

- `automated-supabase-rotation.ts` (820 lines) — KEEP (canonical Supabase script)
- `automated-github-token-rotation.ts` (695 lines) — KEEP (canonical GitHub script)
- `verify-credential-rotation.ts` (569 lines) — DELETE (redundant verification)
- `verify-rotation-setup.ts` (292 lines) — DELETE (redundant verification)
- `verify-token-rotation.sh` (237 lines) — DELETE (bash duplicate of TS verification)

The 4 scripts from the todo that no longer exist (`rotate-database-credentials.ts`, `supabase-credential-rotation.py`, `complete-immed-003-*.sh`, `complete-immed-004-*.sh`) were already cleaned up in prior sprints.

**Files to delete**:

- `scripts/verify-credential-rotation.ts`
- `scripts/verify-rotation-setup.ts`
- `scripts/verify-token-rotation.sh`

**Verification before deleting**: Check CI/CD references:

```bash
grep -r "verify-credential-rotation\|verify-rotation-setup\|verify-token-rotation" .github/workflows/
```

**Risk**: Low. Verification scripts are not part of production rotation workflow.
**Lines removed**: ~1,098

---

## Batch 2: Code Quality + Consolidation

**Dependencies**: None (independent of Batch 1).
**Risk**: Low. Import path changes require grep verification.

---

### 2.1 TODO-016: Standardize .resolve() and remove .get() proxy

**Verified state**:

- `container/index.ts` lines 66-75: `.get()` proxy trap
- `content.routes.ts:26`: `container.get(TYPES.ContentController)`
- `user.routes.ts:24`: `container.get(TYPES.UserController)`
- Dead `ServiceTokens` class in `IServiceRegistry.ts` lines 146-181

**Step 1 — Update route files**:

```typescript
// content.routes.ts:26
// BEFORE:
_contentController = container.get(TYPES.ContentController);
// AFTER:
_contentController = container.resolve(TYPES.ContentController);

// user.routes.ts:24
// BEFORE:
_userController = container.get(TYPES.UserController);
// AFTER:
_userController = container.resolve(TYPES.UserController);
```

**Step 2 — Remove .get() proxy trap from container/index.ts**:

```typescript
// BEFORE (lines 65-75):
// Support inversify-style container.get() that routes use
if (prop === 'get') {
  return (token: any) => {
    if (!_container) {
      throw new Error(
        `DI container not initialized. Call initializeContainer() before resolving services. Attempted to resolve: ${token?.name || token}`
      );
    }
    return _container.resolve(token);
  };
}
// AFTER: Delete these 11 lines entirely
```

**Step 3 — Delete dead ServiceTokens class from IServiceRegistry.ts**:

```typescript
// DELETE lines 146-181 (the entire ServiceTokens class)
// It uses different names than TYPES and has zero imports
```

**Files modified**: 4

- `packages/backend/src/routes/v1/content.routes.ts`
- `packages/backend/src/routes/v1/user.routes.ts`
- `packages/backend/src/container/index.ts`
- `packages/backend/src/interfaces/shared/IServiceRegistry.ts`

**Risk**: Low. Verify no other `.get()` calls: `grep -r "container\.get(" packages/backend/src`

---

### 2.2 TODO-036: Fix minor code quality issues

**9 individual fixes, all isolated**:

#### Fix 1: Replace deprecated `substr` with `substring`

```typescript
// packages/frontend/src/monitoring/GlobalErrorBoundary.tsx:63
// packages/frontend/src/monitoring/FeatureErrorBoundary.tsx:73,90
// BEFORE:
.substr(2, 9)
// AFTER:
.substring(2, 11)
```

**Verify files exist**: `find packages/frontend/src/monitoring -name "*ErrorBoundary*"`

#### Fix 2: Top-level import for crypto in security-headers.ts

```typescript
// packages/backend/src/middleware/security-headers.ts
// BEFORE (line ~210):
const crypto = require('crypto');
// AFTER (add at top of file):
import crypto from 'crypto';
// Then remove the inline require
```

#### Fix 3: Top-level import for os in health.ts

```typescript
// packages/backend/src/routes/health.ts
// BEFORE (line ~397):
const os = require('os');
// AFTER (add at top of file):
import os from 'os';
// Then remove the inline require
```

#### Fix 4: Remove default exports

```typescript
// packages/backend/src/middleware/csrf.ts — if it has default export, change to named
// packages/backend/src/middleware/rate-limit-middleware.ts — same
// packages/frontend/src/lib/sentry.ts — same (if exists)
```

#### Fix 5: Gate collectDefaultMetrics in deployment-monitoring.ts

```typescript
// packages/backend/src/monitoring/deployment-monitoring.ts:22-25
// BEFORE:
collectDefaultMetrics();
// AFTER:
let metricsInitialized = false;
export function initializeDefaultMetrics(): void {
  if (!metricsInitialized) {
    collectDefaultMetrics();
    metricsInitialized = true;
  }
}
```

#### Fix 6: Don't swallow error in deployment-monitoring.ts:207

```typescript
// BEFORE:
} catch (error) {
  // silently discarded
}
// AFTER:
} catch (error) {
  logger.warn('Metrics collection error', { error: error instanceof Error ? error.message : error });
}
```

#### Fix 7: Remove unused sentryErrorHandler export

```typescript
// packages/frontend/src/lib/sentry.ts:77-79 — delete export if unused
// Verify first: grep -r "sentryErrorHandler" packages/
```

#### Fix 8: Timing-safe rate limiter bypass check

```typescript
// packages/backend/src/middleware/rate-limit-middleware.ts:278-279
// BEFORE:
if (apiKey === process.env.RATE_LIMIT_BYPASS_KEY) {
// AFTER:
import { timingSafeEqual } from 'crypto';

// Helper function
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Usage:
if (apiKey && process.env.RATE_LIMIT_BYPASS_KEY && safeCompare(apiKey, process.env.RATE_LIMIT_BYPASS_KEY)) {
```

#### Fix 9: Console.log in security-headers.ts

Overlaps with todo 034 (logger consolidation). Handle in 2.4 below.

**Files modified**: ~8
**Risk**: Low per fix. Each is isolated.

---

### 2.3 TODO-058: Fix naming inconsistencies

**5 sub-items, handle in order**:

#### Sub-item 1: Rename requestId to correlationId in error response

```typescript
// packages/backend/src/middleware/error-handler-middleware.ts
// ErrorResponse interface (line 40-46):
// BEFORE:
metadata: {
    requestId: string;
    // ...
};
// AFTER:
metadata: {
    correlationId: string;
    // ...
};

// Also update all handler functions that set requestId in metadata
// Lines: 108, 126-130, 146-150, 168-172, 191-195
// BEFORE:
requestId,
// AFTER:
correlationId: requestId, // variable name stays, field name changes
```

**IMPORTANT**: Also update any frontend/test code that reads `metadata.requestId`. Search: `grep -r "requestId" packages/ --include="*.ts" --include="*.tsx"`

#### Sub-item 2: Standardize middleware file naming — DEFER

File renames (`error-handler-middleware.ts` -> `error-handler.ts`, `rateLimit.ts` -> `rate-limit.ts`) require updating every import across the codebase. Too many side effects for a cleanup sprint. **DEFER to dedicated refactor**.

#### Sub-item 3: Header type safety — already partially addressed

The `as string` casts on Express headers are a minor concern. Express's `req.get()` already returns `string | undefined` (not `string[]`). The `as string` casts are technically correct for `req.get()` but not for `req.headers[name]`. Check actual usage before changing.

#### Sub-item 4: Named exports for logger

```typescript
// packages/backend/src/lib/logger.ts:95
// BEFORE:
export default logger;
// AFTER:
export { logger };
// Also add: export default logger; // backward compat during migration
```

**CAUTION**: 17 files import from utils/logger (class wrapper). The lib/logger default import is used in error-handler-middleware.ts and utils/logger.ts. Keep backward compat by exporting both named and default during this sprint.

**ACTUALLY DEFER THIS** — changing logger exports ripples through many files. Not worth the risk for P3 naming consistency.

#### Sub-item 5: Remove unnecessary `as const` from SENSITIVE_FIELDS

```typescript
// packages/backend/src/lib/sensitive-fields.ts:6-20
// BEFORE:
export const SENSITIVE_FIELDS = [...] as const;
// AFTER:
export const SENSITIVE_FIELDS = [...];
```

**Net scope for 058**: Only sub-items 1 (correlationId rename) and 5 (remove `as const`) are worth doing in this sprint.

---

### 2.4 TODO-034: Consolidate sanitization and logger duplication

**Verified state** — logger issue is ALREADY FIXED:

- `utils/logger.ts` is a proper class wrapper around `lib/logger.ts` (Winston), NOT raw console
- It's marked `@deprecated` but provides a legitimate class-based API used by 17 services
- Both loggers route to Winston. No observability loss.

**Remaining work**: Sanitization consolidation only.

**Step 1 — Audit sensitive field lists**:

```bash
grep -n "SENSITIVE_FIELDS\|sensitive.*field\|password.*token.*secret" \
  packages/backend/src/lib/sentry.ts \
  packages/backend/src/lib/logger.ts \
  packages/backend/src/middleware/error-handler-middleware.ts \
  packages/backend/src/lib/sensitive-fields.ts
```

**Step 2 — Ensure single source of truth**:
`lib/sensitive-fields.ts` should be the canonical list. Verify sentry.ts and logger.ts import from it (or duplicate it). If they have hardcoded lists, update them to import from `sensitive-fields.ts`.

```typescript
// All files should use:
import { SENSITIVE_FIELDS } from '../lib/sensitive-fields';
// Instead of hardcoded field lists
```

**Files modified**: 2-3 (sentry.ts, logger.ts — if they have hardcoded lists)
**Risk**: Low.

---

### 2.5 TODO-110: Consolidate duplicate utility patterns

**5 patterns to consolidate**:

#### Pattern 1: asyncHandler (2 implementations)

- `error-handler-middleware.ts:255` (already exported, well-documented)
- `unified-sessions.ts:158` (local copy)

**Action**: Delete local copy in `unified-sessions.ts`, import from `error-handler-middleware`:

```typescript
// unified-sessions.ts
// BEFORE:
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
// AFTER:
import { asyncHandler } from '../middleware/error-handler-middleware';
```

#### Pattern 2: RateLimitConfig (3 definitions)

- `rate-limit-middleware.ts:19`
- `advanced-rate-limiting.ts:27`
- `currency.ts:130`

**Action**: Create merged interface, export from rate-limit-middleware:

```typescript
// packages/backend/src/middleware/rate-limit-middleware.ts
// Merge all fields:
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}
```

Update `advanced-rate-limiting.ts` and `currency.ts` to import from `rate-limit-middleware.ts`.

#### Pattern 3: getClientIP (4 implementations)

- `advanced-rate-limiting.ts` (2x)
- `unified-sessions.ts:147`
- `analytics-integration-service.ts:966`

**Action**: Choose most robust implementation, move to `packages/backend/src/utils/client-ip.ts`:

```typescript
// packages/backend/src/utils/client-ip.ts
import type { Request } from 'express';

export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip.trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
```

Delete all 4 local implementations, import from utils.

#### Pattern 4: Pagination schema (2 definitions)

- `validation-middleware.ts:142` (max=100, default=20)
- `app.ts:227` (max=50, default=10)

**Action**: Keep both — they intentionally have different limits for different contexts. Add a comment explaining why.

```typescript
// validation-middleware.ts — general API pagination (more permissive)
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20), // API default: 20, max: 100
});

// app.ts — specific endpoint pagination (stricter)
// Uses max=50, default=10 intentionally for this endpoint's data volume
```

#### Pattern 5: XSS sanitization (3 implementations)

- `content-sanitization.ts`
- `input-validation.ts`
- `validation-middleware.ts`

**Action**: Audit differences, then consolidate. The most comprehensive implementation should become canonical in `utils/content-sanitization.ts`. Others import from it.

**Files modified**: ~10-12
**Risk**: Low-Medium. Need to verify implementations are equivalent before replacing.

---

## Batch 3: Type Safety + Dead Code

**Dependencies**: Batch 2 should complete first (container changes in 016 affect 108).
**Risk**: Low-Medium.

---

### 3.1 TODO-107: Refactor AppError to options object pattern

**Verified state** — different from todo description:

- `AppError` constructor is at `lib/app-error.ts` (NOT error-handler-middleware.ts)
- Current signature: `(statusCode, code, message, details?, isOperational?, context?, cause?)` — 7 positional params
- BUT only 1 direct `new AppError()` call exists in production code (middleware/auth.ts:56)
- All other code uses subclasses (ValidationError, NotFoundError, etc.) which already use options objects via `ServiceErrorOptions`

**Revised action**: Refactor AppError to options object, but scope is small since only 1 call site + the subclass constructors need updating.

```typescript
// packages/backend/src/lib/app-error.ts
// BEFORE:
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown> | string,
    public isOperational: boolean = true,
    public readonly context?: Record<string, unknown>,
    public override readonly cause?: Error | unknown
  ) { ... }
}

// AFTER:
export interface AppErrorOptions {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown> | string;
  isOperational?: boolean;
  context?: Record<string, unknown>;
  cause?: Error | unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown> | string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public override readonly cause?: Error | unknown;
  public readonly timestamp: Date;

  constructor(options: AppErrorOptions);
  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown> | string, isOperational?: boolean, context?: Record<string, unknown>, cause?: Error | unknown);
  constructor(
    optionsOrStatusCode: AppErrorOptions | number,
    code?: string,
    message?: string,
    details?: Record<string, unknown> | string,
    isOperational: boolean = true,
    context?: Record<string, unknown>,
    cause?: Error | unknown
  ) {
    if (typeof optionsOrStatusCode === 'object') {
      super(optionsOrStatusCode.message);
      this.statusCode = optionsOrStatusCode.statusCode;
      this.code = optionsOrStatusCode.code;
      this.details = optionsOrStatusCode.details;
      this.isOperational = optionsOrStatusCode.isOperational ?? true;
      this.context = optionsOrStatusCode.context;
      this.cause = optionsOrStatusCode.cause;
    } else {
      super(message!);
      this.statusCode = optionsOrStatusCode;
      this.code = code!;
      this.details = details;
      this.isOperational = isOperational;
      this.context = context;
      this.cause = cause;
    }
    this.name = this.constructor.name;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}
```

**Backward compatibility**: Constructor overloads support both patterns. Existing subclasses (`ValidationError`, `NotFoundError`, etc.) continue to work because they call `super(statusCode, code, message, ...)`.

**Migrate the 1 direct call site**:

```typescript
// middleware/auth.ts:56
// BEFORE:
next(new AppError(500, 'AUTH_ERROR', 'Authentication failed'));
// AFTER:
next(new AppError({ statusCode: 500, code: 'AUTH_ERROR', message: 'Authentication failed' }));
```

**Files modified**: 2

- `packages/backend/src/lib/app-error.ts`
- `packages/backend/src/middleware/auth.ts`

**Risk**: Low-Medium. Constructor overloads ensure backward compat. All subclasses still work.

---

### 3.2 TODO-108: Type 18 remaining ServiceToken<any> in DI container

**Verified state**: 18 `ServiceToken<any>` remain (down from 32 — prior sprints typed 14).

**Tokens needing types** (and where to find interfaces):

| Token                     | Current | Needs Interface                                             |
| ------------------------- | ------- | ----------------------------------------------------------- |
| ServiceContainer          | `<any>` | `IServiceContainer` (already exists in IServiceRegistry.ts) |
| ServiceFactory            | `<any>` | Create `IServiceFactory` or use existing type               |
| RepositoryFactory         | `<any>` | Create `IRepositoryFactory` or use existing type            |
| MigrationService          | `<any>` | Create `IMigrationService` or use existing type             |
| DependencyAnalyzer        | `<any>` | Create `IDependencyAnalyzer` or use existing type           |
| Config                    | `<any>` | Create `IConfig` interface                                  |
| Database                  | `<any>` | Create `IDatabase` interface                                |
| Redis                     | `<any>` | Create `IRedis` interface                                   |
| UserRepository            | `<any>` | Create `IUserRepository` interface                          |
| ContentRepository         | `<any>` | Create `IContentRepository` interface                       |
| PaymentRepository         | `<any>` | Create `IPaymentRepository` interface                       |
| SubscriptionRepository    | `<any>` | Create `ISubscriptionRepository` interface                  |
| UserPreferencesRepository | `<any>` | Create `IUserPreferencesRepository` interface               |
| LightningService          | `<any>` | Create `ILightningService` interface                        |
| NostrService              | `<any>` | Create `INostrService` interface                            |
| ElasticsearchService      | `<any>` | Create `IElasticsearchService` interface                    |
| ValidationService         | `<any>` | Create `IValidationService` interface                       |
| RateLimitService          | `<any>` | Create `IRateLimitService` interface                        |

**REVISED SCOPE — Pragmatic approach**: Creating 18 new interface files is too large for this sprint. Instead:

**Option A (recommended for this sprint)**: Type the 6 infrastructure tokens that already have interfaces:

1. `ServiceContainer` -> `IServiceContainer` (exists)
2. `Config` -> use existing config type or `Record<string, unknown>`
3. `Database` -> use existing Supabase client type
4. `Redis` -> use existing Redis client type

And fix the 2 lazy controller resolution casts:

```typescript
// content.routes.ts — already changing in 2.1, add proper type
// user.routes.ts — already changing in 2.1, add proper type
```

**Option B (stretch goal)**: Create minimal interfaces for repositories and external services.

**Files modified**: 1-3 (types.ts + route files already being changed in 2.1)
**Risk**: Low.

---

### 3.3 TODO-148: Remove ~1,900 lines dead code

**Scoped items for this sprint** (safe, obviously dead):

1. **Dead `ServiceTokens` class** — already handled in 2.1 (todo 016), ~36 lines
2. **Dead `ServiceCollectionBuilder` class** in IServiceRegistry.ts lines 186-222 — verify zero imports:
   ```bash
   grep -r "ServiceCollectionBuilder" packages/backend/src
   ```
3. **Unused error classes** — verify which error classes in error-handler-middleware.ts are actually used
4. **Stub analytics service** — identify and remove if unused
5. **Duplicate NOSTR auth services** — todo says 3 implementations exist. Find and consolidate:
   ```bash
   find packages/backend/src -name "*nostr*auth*" -o -name "*auth*nostr*"
   ```

**Skip**: BrowserPool simplification (needs usage analysis), PaymentPersistence interface (actively used from P1 sprint).

**Estimated removal**: 500+ lines (conservative, safe subset).
**Files modified**: 3-5
**Risk**: Low.

---

## Batch 4: Architecture Cleanup

**Dependencies**: Should run after Batches 2-3 to avoid merge conflicts.

---

### 4.1 TODO-017: Reclassify scoped services as singletons

**Verified state**:

- `ServiceContainer.ts` supports `createScope()`
- NO middleware calls `createScope()` — confirmed via grep of `app.ts`
- All "scoped" services resolve from root container = behave as singletons
- `SERVICE_LIFETIMES.scoped` lists 18 services

**Recommended action**: Option B — reclassify as singletons (matches actual behavior).

```typescript
// packages/backend/src/container/types.ts
// BEFORE:
export const SERVICE_LIFETIMES = {
  singleton: [...],
  scoped: [
    'UserProfileService',
    'UserPreferencesService',
    'UserActivityService',
    // ... 18 services
  ],
  transient: [...],
};

// AFTER:
export const SERVICE_LIFETIMES = {
  singleton: [
    // Original singletons
    'ServiceContainer',
    'EventBusService',
    'CacheService',
    'Logger',
    'Config',
    'Database',
    'Redis',
    'LightningService',
    'NostrService',
    'ElasticsearchService',
    'SecretsService',
    // Reclassified from scoped (no per-request scope middleware exists)
    'UserProfileService',
    'UserPreferencesService',
    'UserActivityService',
    'UserRelationshipService',
    'UserAnalyticsService',
    'ContentPublishingService',
    'ContentModerationService',
    'ContentSearchService',
    'ContentRecommendationService',
    'ContentAnalyticsService',
    'ContentVersioningService',
    'ContentCreationService',
    'PaymentProcessingService',
    'SubscriptionService',
    'RefundService',
    'PaymentAnalyticsService',
    'WebhookService',
    'InvoiceService',
    'AuthenticationService',
  ],
  // scoped: removed — no per-request scoping middleware exists
  transient: [...],
};
```

**Also update** `getServiceLifetime()` to remove `scoped` check.

**Add TODO comment** for future:

```typescript
// TODO: If per-request scoping is needed in the future, implement
// createScope() middleware in app.ts and reintroduce 'scoped' lifetime.
```

**Files modified**: 1 (`container/types.ts`)
**Risk**: Low. Matches actual runtime behavior. No behavior change.

---

## Summary Statistics

| Metric         | Estimate                                                   |
| -------------- | ---------------------------------------------------------- |
| Files deleted  | ~11,500+ (monitoring dir + duplicates + scripts + root md) |
| Lines removed  | ~228,000+                                                  |
| Files modified | ~25-30                                                     |
| New files      | 1 (`utils/client-ip.ts`)                                   |
| Batches        | 4                                                          |
| Risk level     | Low overall (mostly deletions + consolidation)             |

## Batch Execution Order

```
Batch 1 (Dead Code Deletion)     ←── Start here, highest ROI
  ├── 1.1 monitoring/ deletion
  ├── 1.2 Finder duplicates + root md
  └── 1.3 Rotation scripts

Batch 2 (Code Quality)           ←── Parallel with Batch 1
  ├── 2.1 .resolve() standardization
  ├── 2.2 Minor quality fixes
  ├── 2.3 Naming (correlationId only)
  ├── 2.4 Sanitization consolidation
  └── 2.5 Utility dedup

Batch 3 (Type Safety)            ←── After Batch 2 (depends on container changes)
  ├── 3.1 AppError options pattern
  ├── 3.2 ServiceToken typing
  └── 3.3 Dead code removal

Batch 4 (Architecture)           ←── Last (fewest conflicts)
  └── 4.1 Scoped → singleton reclassification
```

## Test Strategy

After each batch:

1. `npm run build` — verify TypeScript compilation
2. `npm test` — verify all tests pass
3. `grep` verification for removed patterns (no lingering references)

After all batches:

1. Full `npm run quality:check`
2. Verify no new ESLint warnings
3. Manual review of import graph changes
