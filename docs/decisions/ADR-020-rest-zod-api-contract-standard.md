# ADR-020: REST+Zod API Contract Standard

**Date**: 2026-02-26
**Status**: Accepted
**Epic**: v2.0 Production Roadmap
**Related ADRs**: [ADR-009 (Zod)](./ADR-009-zod-validation.md), [ADR-010 (Express)](./ADR-010-expressjs-api-server.md), [ADR-014 (Circuit Breaker)](./ADR-014-circuit-breaker-pattern.md), [ADR-016 (CSRF)](./ADR-016-csrf-double-submit-cookie.md)

## Context

The REST+Zod pattern is already in production with a mature implementation:

- 14 v2 route files follow an implicit middleware pattern
- `validate()` middleware validates `body`, `query`, and `params` via Zod schemas
- `createApiResponse()` wraps all success responses with `snakeToCamel` transformation
- 6 error classes in `utils/errors.ts` map to HTTP status codes
- `paginationSchema`, `uuidParamSchema`, and domain-specific validators exist
- Rate limiting uses Redis-backed `express-rate-limit` with user-based and IP-based strategies
- Shared types live in `packages/shared/src/types/` organized by domain

v2.0 adds 4+ new route domains across both squads. Without a formal standard, each team will invent its own conventions for validation patterns, error responses, pagination, and rate limiting — leading to inconsistent client behavior and harder frontend integration.

This ADR codifies the existing patterns and extends them with prescriptive guidance for all new API work.

## Decision

All REST API endpoints in Sovren use **Express + Zod** via the conventions below. These are mandatory for all new routes.

### 1. Canonical Route Middleware Stack

Every route handler follows this exact middleware order:

```
authenticate → requireRole* → rateLimiter → validate(Zod) → asyncHandler → createApiResponse
```

`requireCreator` may be omitted **only with a code comment explaining why** (e.g., anonymous aggregate data).

```typescript
// packages/backend/src/routes/v2/wellness.routes.ts (canonical example)
router.post(
  '/patterns',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: WellnessValidators.recordWorkPattern }),
  asyncHandler(async (req, res) => {
    const data = await getWellnessService().recordWorkPattern(
      getAuthUser(req).nostr_pubkey,
      req.body
    );
    res.status(201).json(createApiResponse(req, data));
  })
);
```

```typescript
// requireCreator intentionally omitted: benchmarks return anonymous aggregate
// community data accessible to all authenticated users, not creator-specific content
router.get(
  '/benchmark',
  authenticate,
  expensiveRateLimiter,
  asyncHandler(async (req, res) => {
    const data = await getWellnessService().getBenchmark();
    res.json(createApiResponse(req, data));
  })
);
```

**`asyncHandler`** wraps async functions to forward errors to Express `next()`. Required because Express 4 does not handle async errors natively. Import from `utils/asyncHandler`.

### 2. Validation Standard

**Canonical**: `validate({ body?, query?, params? })` middleware from `validation-middleware.ts`. Validates via Zod `parseAsync`, mutates `req.body`/`req.query`/`req.params` with parsed values, and returns `400` with structured errors on failure.

**Deprecated**: Inline `Schema.safeParse()` in route handlers. Existing routes using this pattern (circles, marketplace, inbox) are migrated when touched — not a standalone task.

**Validator file convention**:

```typescript
// packages/backend/src/validators/wellness.ts (canonical example)
import { z } from 'zod';

export const RecordWorkPatternSchema = z.object({
  type: z.enum(['content_creation', 'engagement', 'management']),
  duration_mins: z.number().int().positive().max(1440),
  timestamp: z.string().datetime(),
  metadata: z
    .record(z.string(), z.string())
    .refine((obj) => JSON.stringify(obj).length <= 10000, {
      message: 'Metadata must be less than 10KB',
    })
    .optional(),
});

// Aggregated namespace export for route use
export const WellnessValidators = {
  recordWorkPattern: RecordWorkPatternSchema,
  getWorkPatterns: GetWorkPatternsQuerySchema,
  // ...
};
```

**Pattern**: One file per domain at `packages/backend/src/validators/{domain}.ts`. Export individual schemas (for direct import) and a `{Domain}Validators` namespace object (for route use).

**Reusable schemas** — import from `validation-middleware.ts`, never re-implement:

| Schema                   | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `paginationSchema`       | `page`, `limit`, `sort`, `order` with defaults |
| `uuidParamSchema`        | UUID `id` path param validation                |
| `timeRangeSchema`        | `start`/`end` datetime range                   |
| `nostrPubkeyValidator`   | 64 hex character NOSTR pubkey                  |
| `npubValidator`          | `npub` format string                           |
| `bolt11Validator`        | Lightning invoice (BOLT11) format              |
| `satoshiAmountValidator` | Integer satoshi amount (1 to 21M BTC)          |
| `secureUrlValidator`     | HTTPS/WSS URL only                             |

### 3. Response Format

**Success responses** always use `createApiResponse(req, data)`:

```typescript
// packages/backend/src/utils/api-response.ts
{
  success: true,
  data: T,             // The response payload
  metadata: {
    requestId: string, // Correlation ID from request context
    timestamp: string, // ISO 8601
    processingTime?: number // ms, when startTime provided
  }
}
```

**Default behavior**: `snakeToCamel()` transformation on `data`. Database rows with `snake_case` fields (e.g., `created_at`, `nostr_pubkey`) are auto-converted to `camelCase` (e.g., `createdAt`, `nostrPubkey`).

**When to use `{ raw: true }`**: Pass when data is already camelCase (e.g., TypeScript objects, aggregated results). Without `raw: true`, camelCase data gets double-transformed (e.g., `creatorId` becomes `creatorid`).

```typescript
// DB row → auto-converts snake_case to camelCase (default)
res.json(createApiResponse(req, dbRow));

// Already camelCase → skip transformation
res.json(createApiResponse(req, { totalCount: 42, averageScore: 7.5 }, { raw: true }));
```

**HTTP status codes**:

| Code  | Usage            | Example                        |
| ----- | ---------------- | ------------------------------ |
| `200` | Default success  | GET, PUT, DELETE responses     |
| `201` | Resource created | POST that creates a new record |
| `204` | No content       | DELETE with no response body   |

**Never**: `res.json({...})` without `createApiResponse`, or `res.status(500).json({...})` directly.

### 4. Error Code Registry

All errors extend `AppError` from `lib/app-error.ts`. The `code` field is the frontend's switch target — never switch on `error` message strings.

| Code                    | HTTP | Error Class          | When                                                 |
| ----------------------- | ---- | -------------------- | ---------------------------------------------------- |
| `VALIDATION_ERROR`      | 400  | `ValidationError`    | Invalid input, malformed request body/query/params   |
| `AUTHENTICATION_ERROR`  | 401  | `UnauthorizedError`  | Missing or invalid JWT, expired token                |
| `AUTHORIZATION_ERROR`   | 403  | `AuthorizationError` | Valid auth but no permission — ownership check fails |
| `NOT_FOUND`             | 404  | `NotFoundError`      | Resource doesn't exist or was deleted                |
| `CONFLICT`              | 409  | `ConflictError`      | Duplicate entry, TOCTOU race, capacity exceeded      |
| `RATE_LIMIT_EXCEEDED`   | 429  | `RateLimitError`     | Too many requests (from rate-limit middleware)       |
| `SERVICE_ERROR`         | 500  | `ServiceError`       | Internal error (explicit, logged)                    |
| `INTERNAL_SERVER_ERROR` | 500  | _(catch-all)_        | Unhandled exception (error-handler-middleware)       |

**Key rule**: Ownership and permission failures MUST use `AuthorizationError` (403), not `ValidationError` (400). This affects security monitoring, audit logs, and client error handling. (See critical-patterns.md #2 and common-solutions.md #24.)

**Error response shape** (from `error-handler-middleware.ts`):

```json
{
  "success": false,
  "error": "Human-readable message",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "body.email", "message": "Invalid email", "code": "invalid_string" }],
  "metadata": {
    "timestamp": "2026-02-26T12:00:00.000Z",
    "requestId": "abc-123"
  }
}
```

### 5. Pagination Contract

All `GET /collection` list endpoints MUST use `paginationSchema` from `validation-middleware.ts`.

**Query parameters**:

```
GET /api/v2/discovery/creators?page=1&limit=20&sort=created_at&order=desc
```

| Param   | Type            | Default  | Constraints               |
| ------- | --------------- | -------- | ------------------------- |
| `page`  | integer         | `1`      | min 1                     |
| `limit` | integer         | `20`     | min 1, max 100            |
| `sort`  | string          | _(none)_ | Optional, domain-specific |
| `order` | `asc` \| `desc` | `desc`   |                           |

**Response shape**:

```typescript
{
  success: true,
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
  },
  metadata: { requestId, timestamp }
}
```

**Route example**:

```typescript
router.get(
  '/creators',
  authenticate,
  validate({
    query: paginationSchema.extend({
      sort: z.enum(['created_at', 'follower_count', 'relevance']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, limit, sort, order } = req.query;
    const result = await getDiscoveryService().listCreators({ page, limit, sort, order });
    res.json({
      ...createApiResponse(req, result.data),
      pagination: result.pagination,
    });
  })
);
```

**Existing offset-based routes** (circles, marketplace) are migrated to `page/limit` when touched — not a standalone migration task.

**Never**: Ad-hoc `parseInt(req.query.offset)` or custom pagination logic.

### 6. Shared Type Ownership

| Layer              | Location                                      | Purpose                               | Convention                                                               |
| ------------------ | --------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| Shared types       | `packages/shared/src/types/{domain}.ts`       | Consumed by both frontend and backend | One domain = one file. Never cross-domain imports.                       |
| Backend validators | `packages/backend/src/validators/{domain}.ts` | Zod schemas for route validation      | Mirrors shared types but adds validation rules (regex, min/max, coerce). |

Existing shared type files: `wellness.ts`, `community.ts`, `distribution.ts`, `finance.ts`, `user.ts`, `provenance.ts`, `nip05.ts`.

**New domain checklist**:

1. Create `packages/shared/src/types/{domain}.ts` — interfaces and enums
2. Export from `packages/shared/src/types/index.ts`
3. Create `packages/backend/src/validators/{domain}.ts` — Zod schemas + `{Domain}Validators` export
4. Create `packages/backend/src/routes/v2/{domain}.routes.ts` — routes following this ADR
5. Register in `packages/backend/src/routes/v2/index.ts` — `router.use('/{domain}', domainRoutes)`

**Cross-domain rule**: Shared type files import from Zod and their own domain only. Never `import { UserProfile } from './user'` inside `wellness.ts`. If a type is needed across domains, extract to a shared primitives file.

### 7. Rate Limiting Tiers

Rate limiting is mandatory on all routes. Redis-backed in production (shared across instances), in-memory fallback in dev/test.

| Tier                   | Scope        | Config                         | Use When                                                            |
| ---------------------- | ------------ | ------------------------------ | ------------------------------------------------------------------- |
| `readOnlyRateLimiter`  | Router-level | IP-based, 100/min              | All GET endpoints — applied via `router.use()` at top of route file |
| `mutationRateLimiter`  | Per-route    | User-based, 20/min             | Standard POST/PUT/DELETE (via `createUserRateLimiter`)              |
| `expensiveRateLimiter` | Per-route    | User-based, 5/min              | Financial operations, analytics, bulk actions                       |
| `authRateLimiter`      | Per-route    | IP-based, 10/15min             | Authentication endpoints, skips successful requests                 |
| Custom                 | Per-route    | `createUserRateLimiter({...})` | Domain-specific limits with code comment explaining rationale       |

```typescript
// At top of route file — standard pattern from wellness.routes.ts
router.use(readOnlyRateLimiter);

const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });
const expensiveRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 5 });
```

### 8. Versioning Strategy

- **All new routes**: `/api/v2/{domain}` — registered in `packages/backend/src/routes/v2/index.ts`
- **No v3 in v2.0**: If a v2 endpoint needs a breaking change, add a new sub-path (e.g., `/api/v2/discovery/search-v2`). Do not create a v3 router.
- **v1 routes**: Deprecated, not sunset. No new features on v1. Do not apply v2 middleware standards to v1 routes.
- **Unversioned routes** (`/api/auth`, `/api/lightning`, etc.): Legacy, treat as v1. Leave as-is unless part of a sprint story.

### 9. Service Resolution

Lazy singleton pattern at module scope prevents circular imports at module initialization time:

```typescript
// packages/backend/src/routes/v2/wellness.routes.ts (canonical pattern)
let _wellnessService: IWellnessService | null = null;

function getWellnessService(): IWellnessService {
  if (!_wellnessService) _wellnessService = container.resolve(TYPES.WellnessService);
  return _wellnessService;
}
```

Every route file follows this pattern. Service is resolved from the DI container on first call and cached for subsequent requests. One `let`/`function` pair per service dependency.

## Consequences

### Positive

1. **Single reference for all new route work** — developers read this ADR + `wellness.routes.ts` as the canonical example, not guessing from 14 different files
2. **Consistent error handling for frontend** — 8 error codes with explicit HTTP mappings; frontend switches on `code`, never message strings
3. **Type-safe request/response chain** — Zod validates at the boundary, TypeScript types flow through, `createApiResponse` transforms at output
4. **Predictable pagination** — every list endpoint returns the same `pagination` shape

### Negative

1. **Existing routes have legacy validation patterns** — circles, marketplace, and inbox routes use inline `safeParse()`. **Mitigation:** Migrate-on-touch policy. No standalone refactor task. When a sprint story touches these routes, migrate to `validate()` middleware.
2. **`snakeToCamel` default can surprise** — developers passing already-camelCase data get double-transformation. **Mitigation:** Documented `{ raw: true }` option. Lint rule for `createApiResponse` without explicit `raw` option is a v2.1 consideration.
3. **No runtime schema for responses** — request validation is Zod-enforced, but response shapes are not validated. **Mitigation:** TypeScript generics enforce response types at compile time. Response validation adds runtime overhead with minimal benefit for internal APIs.

## Alternatives Considered

### 1. tRPC or GraphQL

**Pros:** End-to-end type safety (tRPC), flexible querying (GraphQL).

**Cons:** 40+ REST endpoints already exist. Migration cost exceeds benefit for v2.0. tRPC requires React Query integration changes across the frontend.

**Why Rejected:** REST+Zod already provides the validation and type-safety benefits. Full migration is v2.1+ scope if evaluated.

### 2. Inline Zod Validation as Standard

**Pros:** No middleware wrapper. Direct control in handler.

**Cons:** Produces different error response shape from `validate()` middleware. Each handler must manually format Zod errors. Inconsistent client experience.

**Why Rejected:** `validate()` middleware provides a single error format across all routes. Inline `safeParse()` is legacy.

### 3. Offset-Based Pagination as Standard

**Pros:** Simpler mental model for some use cases. Already used in 3 routes.

**Cons:** `page/limit` is more intuitive for frontend consumers building "Page 1 of N" UIs. `paginationSchema` already implements `page/limit` with defaults and validation.

**Why Rejected:** `page/limit` is the established pattern with a ready-made schema. Offset-based routes are migrated when touched.

### 4. Separate Error Response Module per Domain

**Pros:** Domain-specific error codes (e.g., `PAYMENT_INSUFFICIENT_FUNDS`).

**Cons:** Fragments error handling. Frontend must import N error registries. 8 canonical codes cover all current cases.

**Why Rejected:** Domain-specific sub-codes can be added via the `details` field without fragmenting the top-level `code` registry. Revisit in v2.1 if needed.

## Implementation Notes

**New route file template** — follow this structure for every new domain:

```typescript
// packages/backend/src/routes/v2/{domain}.routes.ts
import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
import { validate, paginationSchema } from '../../middleware/validation-middleware';
import { readOnlyRateLimiter, createUserRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { DomainValidators } from '../../validators/{domain}';
import type { IDomainService } from '../../interfaces/{domain}/IDomainService';

const router = Router();

// Rate limiting
router.use(readOnlyRateLimiter);
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });

// Lazy service resolution
let _service: IDomainService | null = null;
function getService(): IDomainService {
  if (!_service) _service = container.resolve(TYPES.DomainService);
  return _service;
}

// Routes follow: authenticate → requireRole → rateLimiter → validate → asyncHandler
router.get(
  '/',
  authenticate,
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const result = await getService().list(getAuthUser(req).nostr_pubkey, req.query);
    res.json({ ...createApiResponse(req, result.data), pagination: result.pagination });
  })
);

router.post(
  '/',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: DomainValidators.create }),
  asyncHandler(async (req, res) => {
    const data = await getService().create(getAuthUser(req).nostr_pubkey, req.body);
    res.status(201).json(createApiResponse(req, data));
  })
);

export default router;
```

**New validator file template**:

```typescript
// packages/backend/src/validators/{domain}.ts
import { z } from 'zod';

export const CreateDomainSchema = z.object({
  title: z.string().min(1).max(200),
  // ... domain-specific fields
});

export type CreateDomainInput = z.infer<typeof CreateDomainSchema>;

export const DomainValidators = {
  create: CreateDomainSchema,
};
```

**Test mock** — use `validate()` middleware in integration tests. For unit tests of route handlers, mock the service layer only — Zod validation is tested via integration tests that hit the full middleware stack.

## Related Documentation

- `packages/backend/src/routes/v2/wellness.routes.ts` — Canonical v2 route file
- `packages/backend/src/validators/wellness.ts` — Canonical validator file
- `packages/backend/src/middleware/validation-middleware.ts` — `validate()` + reusable schemas
- `packages/backend/src/utils/api-response.ts` — `createApiResponse`
- `packages/backend/src/utils/errors.ts` — Error classes
- `packages/backend/src/utils/asyncHandler.ts` — Async error forwarding
- `packages/backend/src/middleware/rate-limit-middleware.ts` — Rate limiting
- `packages/backend/src/routes/v2/index.ts` — Route registration
- `packages/shared/src/types/` — Shared type files (wellness.ts, community.ts, etc.)
- `docs/solutions/patterns/critical-patterns.md` — Pattern #2 (service-layer auth), #7 (status guards)
- `docs/solutions/patterns/common-solutions.md` — Pattern #4 (createApiResponse), #5 (case transform), #24 (error class selection)

## Revision History

- **2026-02-26**: Initial version for v2.0 Sprint 0
