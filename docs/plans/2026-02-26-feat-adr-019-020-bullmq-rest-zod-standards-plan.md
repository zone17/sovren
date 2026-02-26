---
title: 'ADR-019 (BullMQ Job Queue Standard) & ADR-020 (REST+Zod API Contract Standard)'
type: feat
date: 2026-02-26
brainstorm: docs/brainstorms/2026-02-26-adr-019-020-bullmq-rest-zod-brainstorm.md
---

# ADR-019 & ADR-020: BullMQ + REST+Zod Standards

## Overview

Write two Architecture Decision Records that codify existing backend patterns and extend them with prescriptive conventions for all new v2.0 work. These are Sprint 0 Day 1 prerequisites — every subsequent backend story for both squads depends on them.

**Not new decisions** — BullMQ and REST+Zod are already in production with mature implementations. The ADRs formalize conventions so both squads build consistently across 5 sprints.

## Problem Statement

40+ backend endpoints and 3 queue workloads exist, but:

- No formal naming convention for queues (existing: `cross-publish`, `relay-scan`, `inbox-polling`)
- No DLQ pattern — failed jobs accumulate in BullMQ's `failed` set with no alerting path
- Two validation patterns coexist: `validate()` middleware and inline `safeParse()`, producing different error response shapes
- Pagination is inconsistent: `page/limit` (paginationSchema) vs `offset/limit` (circles, marketplace)
- Error codes are implemented but not documented as a registry for frontend consumption
- No versioning policy (v1 and v2 coexist, unversioned routes also exist)
- New developers have no single reference for "how to add a route" or "how to add a queue"

## Proposed Solution

Two prescriptive ADRs following the established format (front-matter → Context → Decision → Consequences → Alternatives → Implementation Notes → Related Docs → Revision History).

---

## Technical Approach

### Phase 1: Resolve Open Questions (30 min)

Before writing, make these decisions (defaults from SpecFlow analysis):

| #   | Question                                     | Decision                                                                                                                                                                                                                     |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Existing queue names retroactive?            | **Forward-only.** Existing names (`cross-publish`, `relay-scan`, `inbox-polling`) are grandfathered. New queues follow `{domain}-{action}` convention.                                                                       |
| Q2  | DLQ mechanism?                               | **BullMQ native failed set via Bull Board.** No separate DLQ queue in v2.0. If a domain needs explicit DLQ routing, the processor's `onFailed` writes terminal status to DB (existing pattern from `CrossPublishProcessor`). |
| Q3  | Which validation pattern is canonical?       | **`validate()` middleware is canonical.** Inline `safeParse()` in circles/marketplace/inbox routes is legacy and should be migrated when those routes are touched in Sprint 3.                                               |
| Q4  | `createApiResponse` snakeToCamel documented? | **Yes, explicitly.** Document default transformation + when to use `{ raw: true }`.                                                                                                                                          |
| Q5  | Bull Board auth mechanism?                   | **JWT with admin role** via existing `authenticate` + `authorize(['admin'])` middleware (already mounted in `app.ts`).                                                                                                       |
| Q6  | Pagination: page vs offset?                  | **`paginationSchema` (page/limit) is standard.** Existing offset-based routes are migrated when touched. No standalone migration task.                                                                                       |
| Q7  | Complete error code registry?                | **8 codes total:** the existing 6 + `RATE_LIMIT_EXCEEDED` (429) + `INTERNAL_SERVER_ERROR` (500 catch-all).                                                                                                                   |
| Q9  | Retry config location?                       | **On the queue's `defaultJobOptions`** (set in `createQueue()`). Processors do not define retry config. Call-site overrides require a code comment explaining why.                                                           |

### Phase 2: Write ADR-019 — BullMQ Job Queue Standard (45 min)

**File:** `docs/decisions/ADR-019-bullmq-job-queue-standard.md`

**Sections:**

#### Front-matter

```markdown
# ADR-019: BullMQ Job Queue Standard

**Date**: 2026-02-26
**Status**: Accepted
**Epic**: v2.0 Production Roadmap
**Related ADRs**: [ADR-003 (Caching)](./ADR-003-multi-layer-caching.md), [ADR-013 (Redis)](./ADR-013-redis-caching.md), [ADR-015 (Idempotency)](./ADR-015-idempotency-keys.md)
```

#### Context

- BullMQ is already in production with `QueueService`, `IJobProcessor`, 3 queues, Bull Board
- 5+ services depend on `QueueService` via DI
- v2.0 adds 4 new queue workloads across both squads
- No formal standard exists — conventions are implicit from `CrossPostService`

#### Decision — Key Subsections

**1. Queue Naming Convention**

- Format: `{domain}-{action}` lowercase kebab-case
- Defined as `const QUEUE_NAME = '...'` at module scope in the owning service
- Existing queues grandfathered: `cross-publish`, `relay-scan`, `inbox-polling`
- New v2.0 queues: `payment-verification`, `comment-moderation`, `notification-delivery`, `burnout-scoring`

**2. Retry Policy Standard**

- Default: 3 attempts, exponential backoff starting at 5000ms
- Configured via `createQueue()` `defaultJobOptions`, not per-job
- Override at `addJob()` requires a code comment with rationale
- Code example: existing `CrossPostService.ts:47-53` pattern

**3. Failed Job Handling (No Separate DLQ)**

- BullMQ native `failed` set is the DLQ — visible in Bull Board
- Retention: `removeOnFail: { count: 5000 }` (default, configurable per queue)
- Processors with side-effect failures MUST implement `onFailed()` to write terminal status to DB
- Code example: existing `CrossPublishProcessor.onFailed()` pattern
- Payment-related queues: `removeOnFail: false` (retain all failures for audit)

**4. Concurrency**
| Queue | Concurrency | Rationale |
|-------|-------------|-----------|
| `payment-verification` | 1 | Prevents double-settlement; aligns with ADR-015 idempotency |
| `comment-moderation` | 10 | I/O bound (DOMPurify), no ordering requirement |
| `notification-delivery` | 5 | Fan-out, matches existing cross-publish pattern |
| `burnout-scoring` | 3 | CPU-bound scoring, matches relay-scan pattern |

**5. Job Data Rules**

- Plain JSON objects only (serialized via `JSON.stringify`)
- Never include secrets, tokens, or PII — store IDs, resolve at execution time (Security M-7)
- Type safety via `IJobProcessor<T>` generic — no runtime Zod validation on job data in v2.0

**6. Processor Registration**

- Register in domain-specific `*.bindings.ts` or at service constructor time
- Call `queueService.registerProcessor()` which auto-creates queue if missing
- Workers created with `closeAll()` in graceful shutdown (no custom timeout in v2.0)

**7. Compensating Transaction Pattern**

- Reference critical-patterns.md #4c with inline code snippet
- Track per-iteration success IDs, log before compensating, check compensation errors, always rethrow

**8. Monitoring**

- All queues auto-visible in Bull Board at `/admin/queues`
- Auth: `authenticate` + `authorize(['admin'])` (existing mount in `app.ts`)
- Health: `queueService.isHealthy()` included in `/health` endpoint

#### Consequences

- **Positive**: Consistent queue patterns across both squads. Bull Board provides operational visibility. Failed job retention enables debugging.
- **Negative**: No real-time alerting on queue failures (Bull Board is pull-only). Mitigated by: DB-level terminal status writes trigger existing monitoring. Real-time alerting deferred to v2.1.

#### Alternatives Considered

1. **Separate DLQ queue per workload** — Rejected: adds complexity with no v2.0 benefit. BullMQ failed set + Bull Board is sufficient.
2. **Retry config on IJobProcessor interface** — Rejected: creates N override points. Queue-level defaults are simpler.
3. **Zod validation on job data at runtime** — Rejected: adds overhead. Compile-time generics sufficient for internal producer/consumer.

#### Implementation Notes

- New queue example: full code showing `createQueue` + `IJobProcessor` implementation + DI binding
- Reference `packages/backend/src/test-utils/queue-mock.ts` for test pattern

#### Related Documentation

- `docs/solutions/patterns/critical-patterns.md` — Pattern #4c (queue compensation)
- `packages/backend/src/services/queue/QueueService.ts` — Implementation
- `packages/backend/src/interfaces/queue/IQueueService.ts` — Interface
- `packages/backend/src/services/distribution/CrossPublishProcessor.ts` — Canonical processor example

#### Revision History

- 2026-02-26: Initial version (v2.0 Sprint 0)

---

### Phase 3: Write ADR-020 — REST+Zod API Contract Standard (45 min)

**File:** `docs/decisions/ADR-020-rest-zod-api-contract-standard.md`

**Sections:**

#### Front-matter

```markdown
# ADR-020: REST+Zod API Contract Standard

**Date**: 2026-02-26
**Status**: Accepted
**Epic**: v2.0 Production Roadmap
**Related ADRs**: [ADR-009 (Zod)](./ADR-009-zod-validation.md), [ADR-010 (Express)](./ADR-010-expressjs-api-server.md), [ADR-016 (CSRF)](./ADR-016-csrf-double-submit-cookie.md)
```

#### Context

- 14 v2 route files follow an implicit middleware pattern
- No documented standard — patterns are learned by reading `wellness.routes.ts`
- v2.0 adds 4+ new route domains across both squads
- Two validation patterns coexist with different response shapes
- Pagination, error codes, and versioning are inconsistent

#### Decision — Key Subsections

**1. Canonical Route Middleware Stack**

```
authenticate → requireRole* → rateLimiter → validate(Zod) → asyncHandler → createApiResponse
```

\*`requireCreator` may be omitted with a code comment explaining why (e.g., anonymous aggregate data). `requireRole` is always second if present.

- `asyncHandler`: wraps async functions to forward errors to Express `next()`. Required because Express 4 does not handle async errors natively. Import from `utils/asyncHandler`.
- Code example: canonical POST and GET patterns from `wellness.routes.ts`

**2. Validation Standard**

- **Canonical**: `validate({ body?, query?, params? })` middleware from `validation-middleware.ts`
- **Deprecated**: Inline `Schema.safeParse()` in route handlers. Migrate when route is touched.
- Validator files: `packages/backend/src/validators/{domain}.ts` exporting `{Domain}Validators` namespace + named schemas + `z.infer<>` types
- Reusable schemas: import `paginationSchema`, `uuidParamSchema`, `timeRangeSchema`, `nostrPubkeyValidator`, `satoshiAmountValidator`, `bolt11Validator`, `secureUrlValidator` from `validation-middleware.ts`

**3. Response Format**

- **Success**: Always `createApiResponse(req, data)` — returns `{ success: true, data, metadata: { requestId, timestamp, processingTime } }`
- **Default behavior**: `snakeToCamel()` transformation on `data`. DB rows with `snake_case` fields are auto-converted to `camelCase`.
- **When to use `{ raw: true }`**: Pass when data is already camelCase (e.g., from TypeScript objects, aggregated results). Without `raw: true`, camelCase data gets double-transformed (e.g., `creatorId` → `creatorid`).
- **HTTP status codes**: `200` (default), `201` (resource creation), `202` (async/queued work), `204` (no content)
- **Never**: `res.json({...})` without `createApiResponse`, `res.status(500).json({...})`

**4. Error Code Registry**

| Code                    | HTTP | Error Class          | When                                                 |
| ----------------------- | ---- | -------------------- | ---------------------------------------------------- |
| `VALIDATION_ERROR`      | 400  | `ValidationError`    | Invalid input, malformed request                     |
| `AUTHENTICATION_ERROR`  | 401  | `UnauthorizedError`  | Missing or invalid JWT                               |
| `AUTHORIZATION_ERROR`   | 403  | `AuthorizationError` | Valid auth but no permission (ownership check fails) |
| `NOT_FOUND`             | 404  | `NotFoundError`      | Resource doesn't exist                               |
| `CONFLICT`              | 409  | `ConflictError`      | TOCTOU, duplicate, capacity exceeded                 |
| `RATE_LIMIT_EXCEEDED`   | 429  | `RateLimitError`     | Too many requests                                    |
| `SERVICE_ERROR`         | 500  | `ServiceError`       | Internal error (explicit)                            |
| `INTERNAL_SERVER_ERROR` | 500  | (catch-all)          | Unhandled exception                                  |

Frontend switches on `response.code`, never `response.error` message string. Error classes from `utils/errors.ts`, middleware from `error-handler-middleware.ts`.

**Key rule**: Ownership/permission failures use `AuthorizationError` (403), not `ValidationError` (400). Affects security monitoring and audit logs.

**5. Pagination Contract**

- All `GET /collection` list endpoints MUST use `paginationSchema` from `validation-middleware.ts`
- Query params: `?page=1&limit=20&sort=created_at&order=desc`
- Response includes: `{ data: T[], pagination: { page, limit, total, totalPages } }`
- Existing `offset`-based routes (circles, marketplace) migrated when touched — not a standalone task
- Never: ad-hoc `parseInt(req.query.offset)` or custom pagination logic

**6. Shared Type Ownership**

| Layer              | Location                                      | Purpose                               | Convention                                                               |
| ------------------ | --------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| Shared types       | `packages/shared/src/types/{domain}.ts`       | Consumed by both frontend and backend | One domain = one file. Never cross-domain imports.                       |
| Backend validators | `packages/backend/src/validators/{domain}.ts` | Zod schemas for route validation      | Mirrors shared types but adds validation rules (regex, min/max, coerce). |

New domain checklist:

1. Create `packages/shared/src/types/{domain}.ts` — interfaces and enums
2. Create `packages/backend/src/validators/{domain}.ts` — Zod schemas + `{Domain}Validators` export
3. Create `packages/backend/src/routes/v2/{domain}.routes.ts` — routes
4. Register in `packages/backend/src/routes/v2/index.ts` — `router.use('/{domain}', domainRoutes)`

**7. Rate Limiting Tiers**

| Tier                   | Scope        | Config                         | Use When                                                      |
| ---------------------- | ------------ | ------------------------------ | ------------------------------------------------------------- |
| `readOnlyRateLimiter`  | Router-level | IP-based, generous             | All GET endpoints (applied via `router.use()`)                |
| `mutationRateLimiter`  | Per-route    | User-based, 20/min             | Standard POST/PUT/DELETE                                      |
| `expensiveRateLimiter` | Per-route    | User-based, 5/min              | Financial operations, bulk actions                            |
| Custom inline          | Per-route    | `createUserRateLimiter({...})` | Domain-specific limits with code comment explaining rationale |

Named tier required when used by 2+ route domains. Domain-specific tiers defined locally in route file.

**8. Versioning Strategy**

- All new routes: `/api/v2/{domain}`
- No v3 in v2.0
- v1 routes: deprecated, not sunset. No new features on v1. Do not apply v2 middleware standards to v1.
- Unversioned routes (`/api/auth`, `/api/lightning`, etc.): legacy, treat as v1
- Breaking change to existing v2 endpoint: add new sub-path (e.g., `/api/v2/discovery/search-v2`), don't create v3 router

**9. Service Resolution**

- Lazy singleton pattern at module scope: `let _service: IService | null = null; function getService(): IService`
- Avoids circular import at module init time
- Resolves from DI container on first call

#### Consequences

- **Positive**: Single reference for all new route work. Consistent error handling for frontend. Type-safe request/response chain.
- **Negative**: Existing routes (circles, marketplace, inbox) have legacy validation patterns. Mitigated by: migrate-on-touch policy, not a blocking refactor.

#### Alternatives Considered

1. **tRPC or GraphQL** — Rejected: 40+ REST endpoints already exist. Migration cost >> benefit for v2.0.
2. **Inline Zod validation as standard** — Rejected: produces different error response shape from `validate()` middleware. Standardizing on middleware ensures consistent client experience.
3. **Offset-based pagination as standard** — Rejected: `page/limit` is more intuitive for frontend consumers and is already implemented in `paginationSchema`.

#### Implementation Notes

- New route file example: full code showing file structure, imports, middleware stack, handler
- Reference `packages/backend/src/routes/v2/wellness.routes.ts` as canonical example
- New validator file example: schema + type + namespace export pattern

#### Related Documentation

- `docs/solutions/patterns/critical-patterns.md` — Patterns #2 (service-layer auth), #7 (status guards)
- `docs/solutions/patterns/common-solutions.md` — Patterns #4 (createApiResponse), #5 (case transform), #24 (error class selection)
- `packages/backend/src/middleware/validation-middleware.ts` — validate() + reusable schemas
- `packages/backend/src/utils/errors.ts` — Error classes
- `packages/backend/src/utils/api-response.ts` — createApiResponse

#### Revision History

- 2026-02-26: Initial version (v2.0 Sprint 0)

---

### Phase 4: Update ADR Index + CHANGELOG (15 min)

**File:** `docs/decisions/README.md`

Add new category and entries:

```markdown
### API & Queue Infrastructure

| ADR                                                    | Title                          | Status   | Epic |
| ------------------------------------------------------ | ------------------------------ | -------- | ---- |
| [ADR-019](./ADR-019-bullmq-job-queue-standard.md)      | BullMQ Job Queue Standard      | Accepted | v2.0 |
| [ADR-020](./ADR-020-rest-zod-api-contract-standard.md) | REST+Zod API Contract Standard | Accepted | v2.0 |
```

**File:** `CHANGELOG.md`

```markdown
## [Unreleased]

### docs

- ADR-019: BullMQ Job Queue Standard — naming, retry, DLQ, compensation, monitoring
- ADR-020: REST+Zod API Contract Standard — middleware stack, validation, pagination, error codes, versioning
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] ADR-019 written to `docs/decisions/ADR-019-bullmq-job-queue-standard.md`
- [ ] ADR-020 written to `docs/decisions/ADR-020-rest-zod-api-contract-standard.md`
- [ ] Both follow the extended ADR template (front-matter, 7 sections, code examples)
- [ ] Queue naming convention documented with grandfathering clause for existing names
- [ ] Error code registry is exhaustive (8 codes with HTTP mapping)
- [ ] Pagination contract specifies `paginationSchema` as mandatory for list endpoints
- [ ] `createApiResponse` default `snakeToCamel` behavior documented with `raw: true` guidance
- [ ] Versioning strategy documents v1 deprecation and no-v3 policy
- [ ] ADR index (`docs/decisions/README.md`) updated with both entries
- [ ] CHANGELOG.md updated

### Quality Gates

- [ ] No code changes — documentation only
- [ ] Both ADRs reference existing code paths with file:line citations
- [ ] Both ADRs reference relevant critical-patterns.md and common-solutions.md entries
- [ ] SpecFlow gaps Q1-Q9 all addressed with explicit decisions

## Dependencies & Risks

**Dependencies:**

- None — this is Day 1 work with no blockers

**Risks:**

- Pagination migration (page vs offset) may surface in Sprint 3 when circles/marketplace routes are touched. Mitigated by: migrate-on-touch policy documented in ADR.
- Inline `safeParse()` migration in circles/marketplace/inbox routes. Same mitigation.

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-26-adr-019-020-bullmq-rest-zod-brainstorm.md`
- Story map: `docs/planning/story-map-v2-production-roadmap.md` (Sprint 0 P1: ADR Decisions)
- QueueService: `packages/backend/src/services/queue/QueueService.ts`
- IJobProcessor: `packages/backend/src/interfaces/queue/IJobProcessor.ts`
- CrossPublishProcessor: `packages/backend/src/services/distribution/CrossPublishProcessor.ts`
- validate() middleware: `packages/backend/src/middleware/validation-middleware.ts`
- Error classes: `packages/backend/src/utils/errors.ts`
- createApiResponse: `packages/backend/src/utils/api-response.ts`
- Canonical v2 route: `packages/backend/src/routes/v2/wellness.routes.ts`
- Canonical validator: `packages/backend/src/validators/distribution.ts`
- ADR template: `docs/decisions/README.md`
- Critical patterns: `docs/solutions/patterns/critical-patterns.md` (#2, #4c, #7)
- Common solutions: `docs/solutions/patterns/common-solutions.md` (#4, #5, #24)
