# Phase 7 P2/P3 Remediation Sprint — Requirements & DoD

**Sprint**: PR #82 Code Review Findings Remediation
**Branch**: feature/phase-7-creator-safety-net
**Epics**: EPIC-007 Creator Wellness + EPIC-008 Content Shield
**Total Items**: 17 (10 P2 + 7 P3)
**Date**: 2026-02-16

---

## Sprint Overview

17 findings from the PR #82 code review need remediation across security (4), data/persistence (2), performance (4), TypeScript quality (3), frontend gaps (2), code quality (1), and edge cases (1).

### Sprint Success Metrics

| Metric                           | Target     | How to Measure                           |
| -------------------------------- | ---------- | ---------------------------------------- |
| All 17 fixes implemented         | 17/17 PASS | Each fix DoD below passes                |
| Zero P2 security items remaining | 0 open     | Todos 152, 156, 162, 168 all PASS        |
| Type safety maintained           | 94%+       | `npm run type-check` passes              |
| Tests still pass                 | 100%       | `npm test` all green                     |
| No new regressions               | 0          | Review round on completed PR             |
| Net lines removed                | > 300      | Type dedup (157, 158) removes ~400 lines |

---

## P2 Security Fixes

### Todo 152 — No Rate Limiting on V2 Endpoints

**Priority**: P2 | **Effort**: 1-2 hours | **Domain**: Backend/Security

| Criterion                                                                                 | Status | Evidence                                                                 |
| ----------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| All 24 v2 endpoints have rate limiting middleware                                         |        | Rate limit middleware applied in wellness.routes.ts and shield.routes.ts |
| Tiered limits: standard reads (100/min), mutations (20/min), expensive ops (5/min)        |        | Limits configurable per route group                                      |
| Rate limit headers returned (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset) |        | curl response headers show rate limit info                               |
| 429 Too Many Requests returned when limit exceeded                                        |        | Test with repeated requests exceeding limit                              |
| Fingerprint compare and benchmark endpoints have strictest limits                         |        | These expensive operations get 5/min tier                                |

**Edge Cases:**

- Burst traffic: 100 requests in 1 second vs spread over 1 minute — both should be limited
- Concurrent requests from same user across different endpoints — each endpoint has its own counter
- Rate limit bypass via missing auth — unauthenticated requests should also be limited (by IP)
- Rate limit reset: limits should reset after the window expires, not accumulate
- Multiple deployments/instances: rate limit state should be consistent (in-memory is acceptable for MVP, note Redis needed for multi-instance)

**Missing Acceptance Criteria Added:**

- Rate limiting works for unauthenticated requests (by IP)
- Rate limit configuration is centralized, not scattered per route file

---

### Todo 156 — RLS Policy Exposes Creator Boundaries

**Priority**: P2 | **Effort**: 30 min | **Domain**: Database/Security

| Criterion                                                                                 | Status | Evidence                                 |
| ----------------------------------------------------------------------------------------- | ------ | ---------------------------------------- |
| RLS policy changed from `SELECT USING (TRUE)` to `SELECT USING (creator_id = auth.uid())` |        | Migration script applied                 |
| Other users cannot read another creator's boundary settings                               |        | Test: User A cannot SELECT user B's rows |
| Creator can still read their own boundaries                                               |        | Test: User A can SELECT their own rows   |
| INSERT policy still allows creators to create their own boundaries                        |        | Existing insert behavior preserved       |
| UPDATE policy restricts to owner only                                                     |        | Creator can only update their own rows   |
| DELETE policy restricts to owner only (if exists)                                         |        | Creator can only delete their own rows   |

**Edge Cases:**

- Service-role bypass: service role should still access all rows (for admin/system operations)
- Public boundary display: if a future feature needs public boundary info, a database VIEW with limited columns should be created, not a permissive RLS
- Null creator_id: rows with null creator_id should not be accessible to any user
- RLS policy on all operations (SELECT, INSERT, UPDATE, DELETE) — not just SELECT

**Missing Acceptance Criteria Added:**

- All RLS operations (SELECT, INSERT, UPDATE, DELETE) verified to restrict to owner
- Migration is backward-compatible (no data loss)

---

### Todo 162 — Provenance Immutability Gap

**Priority**: P2 | **Effort**: 1 hour | **Domain**: Database/Security

| Criterion                                                       | Status | Evidence                                                                       |
| --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Provenance records cannot be UPDATEd after creation             |        | Postgres trigger rejects UPDATE                                                |
| Provenance records cannot be DELETEd                            |        | Postgres trigger rejects DELETE                                                |
| Immutability enforced at database level (not just application)  |        | Trigger exists in migration, test with raw SQL                                 |
| INSERT still works normally                                     |        | New provenance records can be created                                          |
| Soft-revocation mechanism available (status column, not delete) |        | If revocation needed, status can be set to 'revoked' via a controlled function |
| ProvenanceService code does not expose update/delete methods    |        | Code review of service API                                                     |

**Edge Cases:**

- Service-role attempting UPDATE/DELETE: trigger must block even service-role
- Migration on existing data: trigger should not affect existing rows' read behavior
- Batch operations: trigger must block bulk UPDATE/DELETE, not just single-row
- Schema evolution: if new columns are added to provenance_records, the trigger must still prevent UPDATE on all columns
- Exception for status column: if soft-revocation is implemented, only the `status` column should be updatable via a dedicated Postgres function, not a blanket UPDATE

**Missing Acceptance Criteria Added:**

- Database trigger blocks UPDATE/DELETE even for service-role clients
- Existing provenance data remains readable and unaffected

---

### Todo 168 — XSS in auto_response_template

**Priority**: P3 (reclassified from P2 in brief, but security-relevant) | **Effort**: 30 min | **Domain**: Backend+Frontend/Security

| Criterion                                                             | Status | Evidence                                                                           |
| --------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| HTML tags stripped from auto_response_template on input (server-side) |        | Zod validator strips or rejects `<script>`, `<img onerror>`, etc.                  |
| Output rendered as text, not HTML                                     |        | Frontend uses textContent or React's default escaping, not dangerouslySetInnerHTML |
| Existing data sanitized (migration or on-read sanitization)           |        | Query to check existing data for HTML tags                                         |
| Validation error returned for input containing HTML                   |        | API returns 400 with clear message                                                 |

**Edge Cases:**

- Encoded entities: `&lt;script&gt;` should also be handled (double-encoding attack)
- Template variables: if `{{name}}` syntax is supported, ensure template injection is not possible
- Unicode tricks: homoglyph characters or zero-width joiners used to bypass filters
- Multi-byte characters: sanitization must handle UTF-8 correctly
- Long strings: sanitization should not break on strings at the max length boundary
- Event handlers in non-script tags: `<div onmouseover="alert(1)">` must be caught

**Missing Acceptance Criteria Added:**

- Encoded HTML entities are handled (no double-encoding bypass)
- Sanitization preserves legitimate text content (no data loss for normal messages)

---

## P2 Data/Persistence Fixes

### Todo 153 — In-Memory Map for Sensitivity Settings

**Priority**: P2 | **Effort**: 2-3 hours | **Domain**: Backend/Data

| Criterion                                           | Status | Evidence                                             |
| --------------------------------------------------- | ------ | ---------------------------------------------------- |
| Sensitivity settings persist across server restarts |        | Settings survive process restart                     |
| Settings load from database on first access         |        | Lazy-load with cache on read                         |
| Default sensitivity used when no setting exists     |        | New creator gets default without error               |
| Cache invalidated or refreshed appropriately        |        | TTL-based refresh or explicit invalidation           |
| In-memory Map removed from BurnoutScoringService    |        | No raw `Map<string, SensitivityLevel>` as sole store |

**Business Rules:**

- Default sensitivity level: `medium` (must be documented in code)
- Sensitivity levels: `low`, `medium`, `high` — no other values accepted
- Creator can change sensitivity at any time; change takes effect on next scoring cycle
- Sensitivity setting is per-creator, not global
- If database is unreachable, last-cached value should be used (graceful degradation)

**Missing Acceptance Criteria Added:**

- Default value is documented and consistent across backend
- Graceful degradation when database is unreachable (use cached or default)

---

### Todo 154 — getBenchmark() Full Table Scan and Data Leak

**Priority**: P2 | **Effort**: 1-2 hours | **Domain**: Backend/Data+Security

| Criterion                                                            | Status | Evidence                                              |
| -------------------------------------------------------------------- | ------ | ----------------------------------------------------- |
| Benchmark query does NOT return individual creator data              |        | Query uses aggregate functions only                   |
| Query performance is O(1) or bounded                                 |        | Explain plan shows index scan or materialized view    |
| RLS still enforced on underlying wellness data                       |        | Individual data not accessible via benchmark endpoint |
| Benchmark values are anonymized aggregates only (avg, stddev, count) |        | Response schema has no individual identifiers         |

**Business Rules:**

- Benchmarks are community-level aggregates, never individual
- Minimum anonymity threshold: benchmarks should not be computed if fewer than 5 creators have data (to prevent deduction)
- Stale benchmarks are acceptable (up to 1 hour old for materialized approach)
- Benchmark response shape: `{ average: number, stddev: number, count: number, percentile: number }`

**Missing Acceptance Criteria Added:**

- Minimum anonymity threshold: benchmark not returned if fewer than 5 data points
- Response schema does not include any creator identifiers

---

## P2 Performance Fix

### Todo 155 — FingerprintService.compare() O(n) Scan

**Priority**: P2 | **Effort**: 1-3 hours | **Domain**: Backend/Performance

| Criterion                                        | Status | Evidence                                        |
| ------------------------------------------------ | ------ | ----------------------------------------------- |
| Comparison does not scan ALL fingerprints        |        | Query has WHERE clause or index-based prefilter |
| Performance is sublinear or bounded              |        | Bounded by time window, limit, or index         |
| Similarity threshold still configurable          |        | Threshold parameter still accepted              |
| Results are equivalent for matching fingerprints |        | Same matches found as before for test data      |

**Missing Acceptance Criteria Added:**

- Existing fingerprint comparison accuracy is preserved (no false negatives introduced)
- Performance improvement is measurable (before/after with 1000+ test fingerprints)

---

## P2 TypeScript Quality Fixes

### Todo 157 — 8x Duplicated SupabaseClient Interface

**Priority**: P2 | **Effort**: 30 min | **Domain**: Backend/TypeScript

| Criterion                                                    | Status | Evidence                                             |
| ------------------------------------------------------------ | ------ | ---------------------------------------------------- |
| Single SupabaseClient interface definition exists            |        | `ISupabaseClient.ts` in shared interfaces directory  |
| All 8 services import from shared location                   |        | Grep shows 8 imports, 0 local definitions            |
| No duplicate interface definitions remain                    |        | Grep for `interface SupabaseClient` returns 1 result |
| Interface is equivalent to the original (no behavior change) |        | Same method signatures: `from()`, `rpc()`            |

**Missing Acceptance Criteria Added:**

- Interface file location follows existing project conventions (`packages/backend/src/interfaces/`)
- Barrel export updated if applicable

---

### Todo 158 — Frontend Type Duplication (~339 Lines)

**Priority**: P2 | **Effort**: 1 hour | **Domain**: Frontend/TypeScript

| Criterion                                                         | Status | Evidence                                              |
| ----------------------------------------------------------------- | ------ | ----------------------------------------------------- |
| Frontend wellness types import from `@sovren/shared`              |        | `import { ... } from '@sovren/shared/types'`          |
| Frontend shield types import from `@sovren/shared`                |        | Same pattern for content-shield                       |
| No duplicate type definitions remain (~339 lines removed)         |        | Diff shows net removal                                |
| Frontend-only types (UI state, component props) properly extended |        | UI-specific types added as extensions, not duplicates |
| All frontend components still compile                             |        | `npm run type-check` passes                           |

**Missing Acceptance Criteria Added:**

- Shared types are a superset or exact match of frontend types (no missing fields)
- Any frontend-only type extensions are clearly marked with comments

---

### Todo 161 — Logger Typed as Function

**Priority**: P2 | **Effort**: 30 min | **Domain**: Backend/TypeScript

| Criterion                                                  | Status | Evidence                                    |
| ---------------------------------------------------------- | ------ | ------------------------------------------- |
| Logger parameter typed as ILogger (not Function)           |        | Service constructors show `logger: ILogger` |
| ILogger interface defines info, warn, error, debug methods |        | Interface file has 4 method signatures      |
| All Phase 7 services use the typed logger                  |        | Grep shows all services use ILogger         |
| Existing logger implementations satisfy ILogger            |        | No runtime errors on startup                |

**Missing Acceptance Criteria Added:**

- ILogger interface reuses existing logger interface if one exists in the project
- All logger call sites are type-safe (no `as any` casts on logger)

---

## P2 Frontend Fixes

### Todo 159 — Missing Frontend API Methods

**Priority**: P2 | **Effort**: 1-2 hours | **Domain**: Frontend

| Criterion                                                       | Status | Evidence                                          |
| --------------------------------------------------------------- | ------ | ------------------------------------------------- |
| `getBenchmarks()` method added to wellness API client           |        | Method exists in wellnessApi.ts                   |
| `getResourceLibrary()` method added to wellness API client      |        | Method exists in wellnessApi.ts                   |
| `getPulseHistory()` method added to wellness API client         |        | Method exists in wellnessApi.ts                   |
| `getDmcaReports()` method added to shield API client            |        | Method exists in shieldApi.ts                     |
| `getProvenanceVerification()` method added to shield API client |        | Method exists in shieldApi.ts                     |
| TanStack Query hooks created for each method                    |        | `useGetBenchmarks`, `useGetResourceLibrary`, etc. |
| Methods match backend endpoint contracts                        |        | Request/response types align with backend routes  |

**Missing Acceptance Criteria Added:**

- Error handling follows existing API client patterns (loading, error, data states)
- API methods use correct HTTP verbs and URL paths matching backend routes

---

### Todo 160 — Hardcoded PLACEHOLDER_CREATOR_ID

**Priority**: P2 | **Effort**: 30 min | **Domain**: Frontend

| Criterion                                      | Status | Evidence                                     |
| ---------------------------------------------- | ------ | -------------------------------------------- |
| Creator ID comes from auth context             |        | `useAuth()` hook used to get real creator ID |
| `PLACEHOLDER_CREATOR_ID` constant removed      |        | Grep returns 0 results                       |
| Shield dashboard API calls use real creator ID |        | All API calls pass authenticated user's ID   |
| Unauthenticated state handled gracefully       |        | Loading/redirect shown when no auth          |

**Missing Acceptance Criteria Added:**

- Component renders nothing or redirects when user is not authenticated
- No other hardcoded creator IDs exist in Phase 7 frontend code

---

## P3 Performance Fixes

### Todo 163 — Sequential DB Queries in Wellness Dashboard

**Priority**: P3 | **Effort**: 30 min | **Domain**: Backend/Performance

| Criterion                                               | Status | Evidence                                            |
| ------------------------------------------------------- | ------ | --------------------------------------------------- |
| Independent queries run in parallel via `Promise.all()` |        | Code shows Promise.all wrapping independent queries |
| Dashboard load time reduced                             |        | Before/after timing comparison                      |
| Error handling preserves individual query failures      |        | One query failure doesn't crash the whole dashboard |

**Missing Acceptance Criteria Added:**

- Error handling: if one parallel query fails, others' results are still usable (Promise.allSettled or try/catch per query)
- No data dependency between parallelized queries (validated by code review)

---

### Todo 164 — Missing useMemo in WellnessTrend

**Priority**: P3 | **Effort**: 15 min | **Domain**: Frontend/Performance

| Criterion                                             | Status | Evidence                                 |
| ----------------------------------------------------- | ------ | ---------------------------------------- |
| Data transformation wrapped in `useMemo`              |        | Code shows `useMemo(() => ..., [deps])`  |
| Dependency array is correct and minimal               |        | Only data-dependent values in deps array |
| Component doesn't recalculate on unrelated re-renders |        | React DevTools profiler confirms         |

**Missing Acceptance Criteria Added:**

- Dependency array includes all values used in the transformation (no stale closures)

---

### Todo 165 — Unbounded Pulse History Query

**Priority**: P3 | **Effort**: 30 min | **Domain**: Backend/Performance

| Criterion                                          | Status | Evidence                                   |
| -------------------------------------------------- | ------ | ------------------------------------------ |
| Default limit of 50 records applied                |        | Query has `.limit(50)` or equivalent       |
| `limit` and `offset` query parameters supported    |        | API accepts `?limit=20&offset=0`           |
| Total count returned in response for UI pagination |        | Response includes `total` or `count` field |
| Maximum limit enforced (e.g., 200)                 |        | Requests for limit=10000 are capped        |

**Missing Acceptance Criteria Added:**

- Maximum limit cap prevents abuse (e.g., `limit=999999`)
- Backward compatibility: existing callers without pagination params get default behavior

---

## P3 Code Quality Fix

### Todo 166 — Unreachable at_threshold Branch

**Priority**: P3 | **Effort**: 5 min | **Domain**: Backend/Code Quality

| Criterion                                                 | Status | Evidence                                        |
| --------------------------------------------------------- | ------ | ----------------------------------------------- |
| `case 'at_threshold'` branch removed from ScheduleService |        | Code diff shows removal                         |
| No references to 'at_threshold' string in codebase        |        | Grep returns 0 results                          |
| Switch statement still handles all valid cases            |        | All BurnoutScoringService output values handled |

**Missing Acceptance Criteria Added:**

- Default case in switch handles unexpected values gracefully (defensive coding)

---

## P3 Edge Case Fix

### Todo 167 — Division by Zero in BoundarySettings

**Priority**: P3 | **Effort**: 5 min | **Domain**: Frontend/Edge Case

| Criterion                             | Status | Evidence                                          |
| ------------------------------------- | ------ | ------------------------------------------------- |
| Division by zero prevented            |        | Zero-guard: `max > 0 ? (current / max) * 100 : 0` |
| Renders 0% when max is 0 or undefined |        | Visual check in UI                                |
| No NaN or Infinity displayed to user  |        | Edge case test with max=0                         |

**Missing Acceptance Criteria Added:**

- Handles `undefined` and `null` max values (not just 0)
- Percentage is clamped to 0-100 range (no >100% display)

---

## Cross-Cutting Requirements

### Security Fixes Must:

1. Include database migration scripts where applicable (156, 162)
2. Be tested with both authenticated and unauthenticated requests (152, 168)
3. Not introduce new attack vectors
4. Follow OWASP Top 10 guidelines

### Data Fixes Must:

1. Preserve existing data (no data loss during migration)
2. Handle graceful degradation (cached/default values when DB unavailable)
3. Document default values in code

### TypeScript Fixes Must:

1. Not use `any` type (maintaining 94%+ type safety)
2. Follow existing project interface patterns
3. Not break existing imports

### Frontend Fixes Must:

1. Follow existing React patterns (hooks, context)
2. Handle loading and error states
3. Be compatible with existing component tree

---

## Summary: Missing Acceptance Criteria Added

| Todo      | Criteria Added | Key Addition                                               |
| --------- | -------------- | ---------------------------------------------------------- |
| 152       | 2              | Unauthenticated rate limiting, centralized config          |
| 153       | 2              | Default value documented, graceful degradation             |
| 154       | 2              | Anonymity threshold, no creator IDs in response            |
| 155       | 2              | Accuracy preserved, measurable improvement                 |
| 156       | 2              | All RLS operations verified, backward-compatible migration |
| 157       | 2              | Convention-following location, barrel export               |
| 158       | 2              | Shared types superset check, UI extensions marked          |
| 159       | 2              | Error handling patterns, correct HTTP verbs                |
| 160       | 2              | Unauthenticated redirect, no other hardcoded IDs           |
| 161       | 2              | Reuse existing interface, no as-any casts                  |
| 162       | 2              | Service-role blocked by trigger, existing data safe        |
| 163       | 2              | Error handling per query, no data dependencies             |
| 164       | 1              | Complete dependency array                                  |
| 165       | 2              | Max limit cap, backward compatibility                      |
| 166       | 1              | Default case handles unexpected values                     |
| 167       | 2              | Handles undefined/null, clamped to 0-100                   |
| 168       | 2              | Double-encoding handled, no data loss on sanitize          |
| **Total** | **30**         | **30 new testable criteria across 17 fixes**               |
