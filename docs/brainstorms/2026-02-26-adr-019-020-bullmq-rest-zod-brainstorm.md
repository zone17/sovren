# ADR-019 (BullMQ Job Queue Standard) & ADR-020 (REST+Zod API Contract Standard)

**Date**: 2026-02-26
**Status**: Brainstorm — next: `/workflows:plan` to write the ADRs
**Squads**: Both (shared Day 1 prerequisite)
**Timebox**: 2 hours for both ADRs combined

---

## What We're Building

Two Architecture Decision Records that codify existing patterns and extend them with prescriptive guidance for all new backend work across v2.0's 5 sprints.

- **ADR-019**: BullMQ Job Queue Standard — naming, retry policies, DLQ, processor registration, new queue workloads
- **ADR-020**: REST+Zod API Contract Standard — shared type ownership, pagination contract, error code registry, versioning strategy

These are NOT new decisions — BullMQ and REST+Zod are already in production. The ADRs codify conventions so both squads build consistently.

---

## Why This Approach

1. **BullMQ is already fully wired** — `QueueService`, `IJobProcessor`, `CrossPostService`/`CrossPublishProcessor` are real, tested code. 5+ services depend on `QueueService` via DI. Bull Board admin UI exists. The ADR documents what's there and adds conventions for new queues.

2. **REST+Zod v2 pattern is established** — `authenticate → requireCreator → rateLimiter → validate(Zod) → asyncHandler → createApiResponse` is used across 14 v2 route files. The ADR standardizes the gaps: pagination, error codes, type ownership, versioning.

3. **Prescriptive depth (Approach B)** — Document existing + extend with conventions. Not minimal (leaves gaps), not exhaustive (templates go stale). Just enough to prevent 5 sprints of ad-hoc decisions.

---

## Key Decisions

### ADR-019: BullMQ Job Queue Standard

| Decision                | Value                                                                                                      | Rationale                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Queue naming            | `{domain}-{action}` (e.g., `payment-verification`, `comment-moderation`, `notification-delivery`)          | Matches existing `cross-publish` pattern. Domain prefix enables Bull Board filtering.                 |
| Retry policy default    | 3 attempts, exponential backoff starting at 5s                                                             | Matches `CrossPostService` existing config. Sufficient for transient failures.                        |
| Dead Letter Queue (DLQ) | Failed jobs after max retries → `{queue-name}-dlq` queue with `removeOnFail: false`                        | Currently no DLQ pattern exists. Critical for payment verification where failures need manual review. |
| Concurrency default     | 5 per queue, overridable per processor                                                                     | Matches `CrossPublishProcessor.concurrency = 5`. Prevents Redis connection exhaustion.                |
| Redis connection        | One dedicated connection per queue/worker (BullMQ requirement: `maxRetriesPerRequest: null`)               | Already implemented in `QueueService.createBullMQConnection()`. Codify as mandatory.                  |
| Job data serialization  | Plain JSON objects only. No class instances, functions, or circular refs.                                  | BullMQ serializes via `JSON.stringify`.                                                               |
| Processor registration  | Via DI — register in domain-specific `*.bindings.ts`, call `queueService.registerProcessor()` at bootstrap | Matches existing `queue.bindings.ts` pattern.                                                         |
| Compensation pattern    | Track per-iteration success IDs. Log before compensating. Always rethrow original error.                   | Codified from critical-patterns.md #4c.                                                               |
| Monitoring              | All queues auto-appear in Bull Board at `/admin/queues`. Health check via `queueService.isHealthy()`.      | Already exists.                                                                                       |

#### New Queue Workloads (v2.0 Sprints)

| Queue                   | Sprint | Squad | Purpose                                                      |
| ----------------------- | ------ | ----- | ------------------------------------------------------------ |
| `payment-verification`  | S1     | B     | Poll LND for invoice settlement. Replace `setTimeout` mock.  |
| `comment-moderation`    | S2     | B     | Async XSS sanitization + spam scoring before visibility.     |
| `notification-delivery` | S3     | B     | Fan-out: new follow, comment, payment → notification center. |
| `burnout-scoring`       | S3     | A     | Daily batch burnout score refresh for all active creators.   |

### ADR-020: REST+Zod API Contract Standard

| Decision               | Value                                                                                                                                                                                                                   | Rationale                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Route middleware stack | `authenticate → requireRole → rateLimiter → validate(Zod) → asyncHandler` (exact order)                                                                                                                                 | Already standard across 14 v2 routes. Codify as mandatory.                                                     |
| Shared type ownership  | One domain = one type file in `packages/shared/src/types/`. Never import types cross-domain.                                                                                                                            | Prevents merge conflicts between squads. Already practiced (wellness.ts, community.ts, etc.).                  |
| Validator file pattern | `packages/backend/src/validators/{domain}.ts` exporting `{Domain}Validators` namespace + named schemas + inferred types                                                                                                 | Matches existing wellness.ts, distribution.ts, etc.                                                            |
| Pagination contract    | All list endpoints accept `?page=&limit=&sort=&order=`. Use `paginationSchema` from validation-middleware.ts. Response wraps in `{ data: T[], pagination: { page, limit, total, totalPages } }`.                        | `paginationSchema` exists but is inconsistently applied. Codify as mandatory for all `GET /collection` routes. |
| Error code registry    | 6 canonical codes: `VALIDATION_ERROR` (400), `AUTHENTICATION_ERROR` (401), `AUTHORIZATION_ERROR` (403), `NOT_FOUND` (404), `CONFLICT` (409), `SERVICE_ERROR` (500). Frontend switches on `code`, never `error` message. | Already implemented in `utils/errors.ts`. Codify so frontend can build typed error handlers.                   |
| Success response       | Always `createApiResponse(req, data)`. Auto snake→camel conversion. Includes `metadata.requestId` and `metadata.processingTime`.                                                                                        | Already exists. Codify as mandatory (no raw `res.json()`).                                                     |
| Versioning strategy    | All new routes go under `/api/v2/`. No v3 in v2.0. If a v2 endpoint needs breaking change, add new sub-path (e.g., `/api/v2/discovery/search-v2`), don't create v3 router.                                              | Keeps router simple. v3 is a v2.1+ concern.                                                                    |
| Service resolution     | Lazy singleton pattern: module-level `let _service = null; function getService()`                                                                                                                                       | Avoids circular import at module init time. Already used in all v2 routes.                                     |
| Rate limiting          | Read endpoints: `readOnlyRateLimiter`. Mutation endpoints: `createUserRateLimiter({ windowMs: 60000, max: 20 })`. Financial endpoints: `createUserRateLimiter({ windowMs: 60000, max: 5 })`.                            | Existing pattern. Financial endpoints get stricter limits.                                                     |

---

## Open Questions

| #   | Question                                                                           | Default                                                                          |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Should DLQ jobs auto-alert via Slack/email?                                        | No for v2.0. Bull Board provides visibility. Add alerting in v2.1.               |
| 2   | Should we add a `validate()` wrapper that auto-generates OpenAPI from Zod schemas? | Defer to v2.1. `zod-to-openapi` exists but adds build complexity.                |
| 3   | Max payload size for queue jobs?                                                   | 512KB (Redis default safe limit). Document in ADR.                               |
| 4   | Should error codes be an enum in shared types?                                     | Yes — create `packages/shared/src/types/api-errors.ts` with `ApiErrorCode` enum. |

---

## What This Brainstorm Does NOT Cover

- Implementation of any queue or route (that's Sprint 0+ work)
- BullMQ cluster mode or horizontal scaling (v2.1)
- GraphQL or tRPC (decided: REST+Zod only)
- API gateway / reverse proxy (stays as-is: Express direct)

---

## Companion Documents

- **Existing ADR-003**: Multi-Layer Caching (related: cache invalidation on queue job completion)
- **Existing ADR-005**: Lightning Network Payments (related: payment-verification queue replaces polling)
- **Critical Patterns**: `docs/solutions/patterns/critical-patterns.md` #4c (queue compensation)
- **Story Map**: `docs/planning/story-map-v2-production-roadmap.md` (Sprint 0 P1: ADR Decisions)

---

## Next Steps

1. `/workflows:plan` to outline the two ADR documents
2. Both architects write ADR-019 and ADR-020 (2-hour timebox)
3. ADRs committed to `docs/decisions/` before Sprint 0 slices begin
