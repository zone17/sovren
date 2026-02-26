---
title: 'ADR-019 & ADR-020: BullMQ + REST+Zod Standards for v2.0'
date: 2026-02-26
category: architecture-issues
tags: [adr, bullmq, rest-api, zod, validation, queue, standards, sprint-0]
module: backend
severity: N/A
symptoms:
  - No formal queue naming convention across squads
  - Two validation patterns (validate() vs safeParse()) with different error shapes
  - Inconsistent pagination (page/limit vs offset/limit)
  - Error codes undocumented for frontend consumption
  - No versioning policy (v1 and v2 coexist)
root_cause: Implicit conventions learned from reading one canonical file, not documented as standards
resolution: Two prescriptive ADRs codifying existing patterns + extending with mandatory conventions
effort: 2 hours (brainstorm + plan + write)
reusable: true
---

# ADR-019 & ADR-020: BullMQ + REST+Zod Standards for v2.0

## Problem

v2.0 Production Roadmap adds 4 new queue workloads and 4+ new API domains across 2 squads over 5 sprints. The existing BullMQ and REST+Zod patterns are mature (3 queues, 14 v2 route files) but undocumented — conventions are learned by reading `CrossPostService` or `wellness.routes.ts`. Without formal standards, each squad invents ad-hoc patterns for naming, retry, error codes, and pagination.

## Approach: Document-Existing + Prescriptive-Extension

**Key insight**: These are NOT new technology decisions. BullMQ and REST+Zod are already in production. The ADRs formalize what exists and fill gaps.

### Workflow

1. **Brainstorm** (30 min) — Clarified scope, chose prescriptive depth (Approach B), resolved key questions (DLQ strategy, pagination standard, error code count)
2. **Plan** (20 min) — SpecFlow analysis surfaced 9 open questions; all resolved with defaults before writing
3. **Write** (90 min) — Read 15+ source files for accurate code examples, wrote both ADRs with real code references
4. **Update index** (10 min) — README.md categories, CHANGELOG.md

### Source File Reading Strategy

The critical step was reading actual source files before writing, not working from memory:

| Purpose               | Files Read                             | What Was Extracted                                                            |
| --------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| Queue interface       | `IJobProcessor.ts`, `IQueueService.ts` | Exact generic signatures, JobContext shape                                    |
| Queue implementation  | `QueueService.ts`                      | `createBullMQConnection()`, `maxRetriesPerRequest: null`, default job options |
| Canonical processor   | `CrossPublishProcessor.ts`             | `onFailed()` pattern, concurrency setting                                     |
| Validation middleware | `validation-middleware.ts`             | `validate()` factory, reusable schemas (8 validators)                         |
| Response helper       | `api-response.ts`                      | `createApiResponse()`, `snakeToCamel`, `{ raw: true }` option                 |
| Error classes         | `errors.ts`                            | 6 error classes with exact HTTP code mappings                                 |
| Canonical route       | `wellness.routes.ts`                   | Full middleware stack, lazy service resolution, rate limiter setup            |
| Canonical validator   | `validators/wellness.ts`               | Schema + namespace export pattern                                             |
| Rate limiting         | `rate-limit-middleware.ts`             | `readOnlyRateLimiter`, `createUserRateLimiter`, Redis-backed store            |
| Route registration    | `routes/v2/index.ts`                   | 14 domain routers mounted under `/api/v2/`                                    |
| Shared types          | `packages/shared/src/types/`           | 7 domain-specific type files                                                  |
| Existing ADRs         | `ADR-009`, `ADR-014`                   | Format template (front-matter, sections, code examples)                       |

## Key Decisions Documented

### ADR-019: BullMQ Job Queue Standard

| Decision                | Standard                                             | Rationale                                                        |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Queue naming            | `{domain}-{action}` kebab-case                       | Matches existing `cross-publish`; enables Bull Board filtering   |
| Retry default           | 3 attempts, exponential 5s, on `defaultJobOptions`   | Single enforcement point; call-site override requires comment    |
| DLQ strategy            | BullMQ native failed set (no separate queue)         | Bull Board provides visibility; separate DLQ doubles queue count |
| Failed job side effects | `onFailed()` writes terminal status to DB            | Existing `CrossPublishProcessor` pattern                         |
| Compensation            | Track IDs, check compensation errors, always rethrow | From critical-patterns.md #4c                                    |
| Concurrency             | Per-queue table (1 for payments, 10 for moderation)  | Prevents double-settlement for financial ops                     |
| Job data                | Plain JSON, no secrets, deterministic IDs            | Security M-7; BullMQ serializes via JSON.stringify               |

### ADR-020: REST+Zod API Contract Standard

| Decision         | Standard                                                                                               | Rationale                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Middleware stack | `authenticate → requireRole → rateLimiter → validate → asyncHandler → createApiResponse`               | Fixed order from 14 v2 routes              |
| Validation       | `validate()` canonical; `safeParse()` deprecated (migrate-on-touch)                                    | Consistent error format                    |
| Response         | `createApiResponse(req, data)` always; `{ raw: true }` for camelCase data                              | snakeToCamel default documented            |
| Error codes      | 8 codes: VALIDATION, AUTHENTICATION, AUTHORIZATION, NOT_FOUND, CONFLICT, RATE_LIMIT, SERVICE, INTERNAL | Frontend switches on `code`, never message |
| Pagination       | `paginationSchema` mandatory for list endpoints; `page/limit` not `offset/limit`                       | Ready-made schema with validation          |
| Type ownership   | One domain = one file in `packages/shared/src/types/`                                                  | Prevents cross-squad merge conflicts       |
| Versioning       | All v2, no v3 in v2.0; breaking changes get sub-path                                                   | Keeps router simple                        |
| Rate limiting    | 4 tiers: readOnly (100/min), mutation (20/min), expensive (5/min), auth (10/15min)                     | Redis-backed, user-keyed for mutations     |

## Patterns Reinforced

These ADRs explicitly reference and reinforce existing patterns:

- **critical-patterns.md #2**: Service-layer auth — ADR-020 §1 middleware stack makes `requireCreator` mandatory (omission requires code comment)
- **critical-patterns.md #4c**: Compensation pattern — ADR-019 §3 includes full compensation code with error checking
- **critical-patterns.md #7**: Status guards — ADR-019 §4 shows TOCTOU-safe conditional update in processor
- **common-solutions.md #4**: createApiResponse — ADR-020 §3 documents `snakeToCamel` default + `{ raw: true }`
- **common-solutions.md #24**: Error class selection — ADR-020 §4 documents `AuthorizationError` (403) for ownership, not `ValidationError` (400)

## Prevention: What This Enables

1. **New developers** read ADR-019 + ADR-020 + canonical examples instead of reverse-engineering from 14 files
2. **Code review** can cite specific ADR sections when rejecting non-conforming patterns
3. **Both squads** share identical conventions — no merge conflicts from divergent patterns
4. **Sprint stories** reference ADR sections for acceptance criteria (e.g., "follows ADR-020 §5 pagination contract")

## Lessons Learned

### 1. Read Source Before Writing Standards

ADRs written from memory produce inaccurate code examples. Reading the actual `QueueService.ts` revealed that `createBullMQConnection()` handles the `maxRetriesPerRequest: null` requirement — a detail easy to miss. Reading `validation-middleware.ts` revealed 8 reusable validators that should be in the standard.

### 2. Grandfathering Clause Prevents Disruption

Existing queue names (`cross-publish`, `relay-scan`, `inbox-polling`) predate the naming convention. Renaming would orphan in-flight jobs in Redis. The ADR explicitly grandfathers them and applies conventions to new queues only. Same approach for `safeParse()` routes — migrate-on-touch, not standalone refactor.

### 3. SpecFlow Analysis Surfaces Hidden Gaps

The plan's SpecFlow step identified 9 questions that weren't obvious from the brainstorm:

- Q1: Retroactive queue naming? → Forward-only
- Q3: Which validation pattern canonical? → `validate()` (not `safeParse()`)
- Q6: page vs offset? → page (with migrate-on-touch for offset routes)
- Q7: Error code count? → 8 (added RATE_LIMIT_EXCEEDED and INTERNAL_SERVER_ERROR)

Without SpecFlow, these would have been discovered during squad implementation — causing inconsistency.

### 4. Prescriptive Depth > Minimal or Exhaustive

Three approaches were evaluated:

- **Minimal**: Documents what exists, leaves gaps → squads fill differently
- **Prescriptive** (chosen): Documents existing + extends with conventions → sufficient for 5 sprints
- **Exhaustive**: Includes templates, generators, auto-validation → goes stale

Prescriptive depth gives enough guidance without creating maintenance burden.

## Cross-References

- **ADR-019**: `docs/decisions/ADR-019-bullmq-job-queue-standard.md`
- **ADR-020**: `docs/decisions/ADR-020-rest-zod-api-contract-standard.md`
- **Brainstorm**: `docs/brainstorms/2026-02-26-adr-019-020-bullmq-rest-zod-brainstorm.md`
- **Plan**: `docs/plans/2026-02-26-feat-adr-019-020-bullmq-rest-zod-standards-plan.md`
- **Related ADR-022**: `docs/adr/ADR-022-job-queue-selection.md` (BullMQ technology selection rationale)
- **Infrastructure prereqs**: `docs/solutions/infrastructure-issues/infrastructure-prereqs-e0-nostr-bullmq-adrs-20260216.md`
- **Critical patterns**: `docs/solutions/patterns/critical-patterns.md` (#2, #4c, #7)
- **Common solutions**: `docs/solutions/patterns/common-solutions.md` (#4, #5, #24)
