---
title: 'Production Readiness Audit + Remediation: 43 Todos Fixed by 10 Domain Agents'
date: 2026-03-07
commit: pending
pr: pending
category: code-quality
tags:
  [
    production-readiness,
    audit,
    remediation,
    multi-agent,
    domain-grouped,
    RLS,
    security,
    dead-code,
    migrations,
    triage,
    team-builder,
    compound,
  ]
module: full-stack
severity: mixed (P1-P3)
symptoms:
  - 40+ financial tables missing RLS policies
  - PostgREST filter injection in 4 services
  - HMAC comparison vulnerable to timing attack
  - Subscription cancel IDOR (no ownership check)
  - JWT tokens not revoked on logout
  - Redis KEYS command blocking production
  - InMemoryPaymentRepository in production bootstrap
  - 138 @ts-nocheck files suppressing type errors
  - 25K+ LOC dead/duplicate services
  - Missing updated_at triggers on 38 tables
root_causes:
  - RLS never enabled on tables created before security patterns established
  - User input passed directly to PostgREST .or() without escaping
  - String comparison used for HMAC instead of crypto.timingSafeEqual
  - Route handlers trust auth middleware without ownership verification
  - JWT stateless design with no revocation mechanism
  - Redis KEYS command used for pattern matching (O(N) blocking)
  - Bootstrap registers placeholder services without production guard
  - @ts-nocheck added during rapid prototyping, never removed
  - Services duplicated across feature sprints without consolidation
  - Tables created without updated_at trigger convention
---

# Production Readiness Audit + Remediation — Compound Doc

**Branch**: `fix/squad-b/todo-remediation-batch` | **Date**: 2026-03-07
**Scope**: 179 files, +1,812/-38,221 lines, 43 todos fixed, 5 deferred
**CE Loop**: Full codebase audit (8 agents) → Triage (101 stale + 5 deferred) → Batch 1 (5 agents, 15 todos) → Batch 2 (5 agents, 28 todos) → Compound

## What Was Done

Two sequential batch remediation sprints fixed every actionable finding from a full production readiness audit:

### Audit Phase

- 8 parallel review agents audited the entire codebase
- Produced 33 new findings (#757-#789): 13 P1, 10 P2, 5 P3, 5 deferred
- Also validated 119 pre-existing pending todos: 101 marked complete (85% stale), 4 WONT_FIX, 15 still needed

### Batch 1: Pre-Existing Todos (15 items, 5 agents)

| Agent              | Items | Key Changes                                                                         |
| ------------------ | ----- | ----------------------------------------------------------------------------------- |
| db-migration       | 2     | Reply count trigger DELETE+bidirectional (#627), comments RLS creator SELECT (#631) |
| community-services | 3     | ValidationError→ServiceError, EventBus emit()→publish(), @deprecated annotations    |
| backend-routes     | 2     | Discovery service extraction, circles CRUD endpoints                                |
| frontend           | 5     | Query key factories, focus traps, loading indicators, discovery hooks               |
| testing-features   | 3     | E2E mock exception comments, pagination type consolidation                          |

### Batch 2: Audit Findings (28 items, 5 agents)

| Agent        | Items | Key Changes                                                                                                                               |
| ------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| security     | 7     | PostgREST escape, HMAC timing-safe, IDOR fix, Zod validation, RLS INSERT, rate limits, HSTS                                               |
| db           | 6     | RLS on 10 financial tables, revenue split constraint, CASCADE→RESTRICT, status sync, updated_at triggers                                  |
| backend      | 5     | JWT revocation, production guards (InMemory/JsonFile), KEYS→SCAN, paginated queries, bootstrap guards                                     |
| architecture | 4     | asyncHandler migration, DI bypass TODOs, N+1 batch fix, EventBus timer leak                                                               |
| typescript   | 6     | @ts-nocheck removal (3 critical), UserRole consolidation, API envelope validation, dead code/Redux deletion, IDatabase/ILogger tightening |

### Deferred (5 items — new features, not fixes)

- #776: OpenAPI spec generation
- #777: API key authentication
- #782: SSE streaming
- #783: GDPR data handling
- #787: Cursor-based pagination

---

## Key P1 Fixes

### 1. RLS Missing on Financial Tables (#757)

**Symptom**: 40+ tables (payments, invoices, revenue entries, etc.) had no Row Level Security.

**Root Cause**: Tables created before RLS conventions were established. No migration review checklist existed.

**Fix**: Migration `20260307000004` enables RLS on top 10 critical financial tables with:

- `service_role` bypass policy for backend operations
- Owner-only SELECT using `auth.uid()` (with `::text` cast for TEXT FK columns)

```sql
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON payments FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "owner_select" ON payments FOR SELECT
  USING (payer_id = auth.uid());
```

**Detection**: `grep -rn "ENABLE ROW LEVEL SECURITY" supabase/migrations/ | wc -l` vs table count.
**Prevention**: Every new table migration must include RLS + policies. Add to migration template.

### 2. PostgREST Filter Injection (#758)

**Symptom**: User input passed directly to `.or()` filters in 4 services.

**Root Cause**: PostgREST metacharacters (%, \_, \, :, ") not escaped before filter construction.

**Fix**: Applied `escapePostgrestFilter()` (from critical-patterns.md #11) to all `.or()` calls:

- content-management-service.ts (3 locations)
- content-discovery-service.ts (1 + regex validation for categories)
- CreatorCircleService.ts (1)
- recommendation-service.ts (1)

**Detection**: `grep -rn "\.or(" packages/backend/src/services/`
**Prevention**: Reinforces critical-patterns.md #11. All `.or()` calls must use `escapePostgrestFilter()`.

### 3. HMAC Timing Attack + Empty Secret (#759)

**Symptom**: Webhook HMAC verification used `===` (vulnerable to timing attack) and accepted empty secrets.

**Fix**: `crypto.timingSafeEqual()` + startup throw for empty `WEBHOOK_SECRET`:

```typescript
const expected = crypto.createHmac('sha256', secret).update(body).digest();
const actual = Buffer.from(signature, 'hex');
if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
  throw new AuthorizationError('Invalid webhook signature');
}
```

### 4. Redis KEYS Command in Production (#767)

**Symptom**: `CacheService.ts` used `this.client.keys(pattern)` — O(N) blocking command.

**Fix**: Replaced with SCAN cursor loop (COUNT 100):

```typescript
let cursor = '0';
const keys: string[] = [];
do {
  const [nextCursor, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
  cursor = nextCursor;
  keys.push(...batch);
} while (cursor !== '0');
```

**Detection**: `grep -rn "\.keys(" packages/backend/src/`
**Prevention**: New pattern for common-solutions.md: never use KEYS in production, always SCAN.

### 5. Bootstrap Placeholder Mocks in Production (#769)

**Symptom**: 8 placeholder service registrations (throwing `new Error('Not implemented')`) would execute in production if resolved.

**Fix**: All 8 wrapped in `NODE_ENV !== 'production'` guard with fail-fast throws:

```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('Placeholder services must not be registered in production');
}
```

---

## Key P2 Fixes

### asyncHandler Migration (#773)

Top 5 routes (auth, users, nip05, sessions, content-discovery) migrated from inline try/catch to `asyncHandler` wrapper. Eliminates 15+ duplicate catch blocks, routes errors through middleware.

### N+1 Content Recommendations (#781)

`ContentRecommendationService` fetched related content in a loop. Fixed with batch `.in('id', contentIds)` query + LIMIT on candidate set.

### EventBus Timer Leak (#789)

`executeHandler()` created timeouts without tracking. Added `activeTimers` Set with cleanup in `dispose()`. Event store `getEvents()` now paginated instead of returning unbounded `.slice()`.

### Dead Code Deletion (#775, #784)

- Grep-verified 4 dead backend services deleted
- 5 root stale files deleted (app.js.OLD, package-lock 6.json, etc.)
- 2 dead Redux slices (navigation, layout) + their tests removed
- Net: -36,409 lines

### @ts-nocheck Phase 1 (#770)

Removed from 3 critical middleware files (error-handler, rate-limit, app-error). Fixed all resulting TS errors. 135 remaining files tracked for future sprints.

### IDatabase/ILogger Type Tightening (#788)

Removed `any` from 10 interface definitions across 6 files:

- `any[]` → `unknown[]` for query params
- `any` → `Record<string, unknown>` for logger metadata

---

## New Migrations Created

| #   | File                                                 | Purpose                                     |
| --- | ---------------------------------------------------- | ------------------------------------------- |
| 1   | `20260307000001_fix_reply_count_trigger.sql`         | DELETE handler + bidirectional status       |
| 2   | `20260307000002_fix_comments_rls_creator_select.sql` | Creator can see all comments for moderation |
| 3   | `20260307000003_fix_payments_insert_policy.sql`      | Restrict INSERT to payer + service_role     |
| 4   | `20260307000004_rls_financial_tables_phase1.sql`     | RLS on 10 financial tables                  |
| 5   | `20260307000005_revenue_split_constraint.sql`        | SUM(bps) <= 10000 per content               |
| 6   | `20260307000006_content_delete_restrict.sql`         | CASCADE → RESTRICT on creator FK            |
| 7   | `20260307000007_payments_consolidate_status.sql`     | Bidirectional status/state sync             |
| 8   | `20260307000008_add_updated_at_triggers.sql`         | Triggers on 38 tables                       |

---

## Process Learnings

### 1. Stale Todo Rate Confirms Triage-First

85% of pre-existing todos (101/119) were already fixed or no longer applicable. This is the 4th data point validating common-solutions.md #25 (stale rates: 40%, 71%, 76%, 85%). **Always triage before assigning to agents.**

### 2. 5 Domain Agents = Zero Conflicts

Both batches used 5 non-overlapping domain agents. Zero merge conflicts across either batch. This extends the domain-grouped zero-conflict streak to 10 consecutive sprints.

### 3. Scoping Large Items Prevents Agent Paralysis

Several P1s were scoped down from full-codebase to tractable chunks:

- RLS: 40+ tables → top 10 financial
- @ts-nocheck: 138 files → 3 critical middleware
- Dead code: 25K LOC → grep-verified zero-consumer only
- Unbounded queries: 63 → top 2 offenders

**Pattern**: For audit findings, fix the highest-risk subset first. Create follow-up todos for the remainder.

### 4. Audit Agent Sweet Spot

8 parallel review agents produced 33 findings with ~80% actionable rate (28/33 after deferring 5 features). This validates the review methodology — enough coverage without drowning in noise.

### 5. Two-Batch Approach for Mixed-Origin Todos

Separating pre-existing (stale-checked) from audit (fresh) todos into two batches prevents scope confusion. Each batch had clean ownership: batch 1 = historical debt, batch 2 = audit-discovered gaps.

---

## Prevention Checklist

### Database Migrations

- [ ] All new tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policies
- [ ] INSERT policies: restrict to `auth.uid()` or `service_role` where appropriate
- [ ] Counter triggers: use `column + 1` pattern, never `COALESCE + 1`
- [ ] Trigger functions: `SECURITY DEFINER SET search_path = public`
- [ ] All tables with `updated_at`: add `update_updated_at()` trigger
- [ ] CASCADE deletes: verify appropriate (usually RESTRICT for user-facing data)
- [ ] Revenue/financial splits: add CHECK constraint on sum

### Security

- [ ] PostgREST `.or()` calls: always use `escapePostgrestFilter()`
- [ ] HMAC verification: `crypto.timingSafeEqual()`, never `===`
- [ ] Route params: Zod UUID `safeParse` on every `:id`
- [ ] Ownership checks: verify `resource.user_id === req.user.id` in service layer
- [ ] Redis: SCAN instead of KEYS, always
- [ ] Rate limiting: apply to all public-facing endpoints
- [ ] HSTS: `max-age=31536000; includeSubDomains; preload`

### Backend Architecture

- [ ] Routes: use `asyncHandler()` wrapper, never inline try/catch
- [ ] Bootstrap: production guards on all placeholder/stub registrations
- [ ] JWT: implement revocation (in-memory Set with TTL cleanup)
- [ ] In-memory stores: production guards that throw if not test/dev
- [ ] Unbounded queries: always `.limit()`, prefer paginated accumulation

### TypeScript

- [ ] New files: never add `@ts-nocheck` — fix types upfront
- [ ] Enums: single source of truth in domain types file
- [ ] Interfaces: no `any` — use `unknown`, `Record<string, unknown>`, or specific types
- [ ] Dead code: grep-verify before deleting, check barrel exports

---

## Cross-References

| Document                                                                                           | Relevance                                     |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `docs/solutions/patterns/critical-patterns.md` #11, #16, #17                                       | PostgREST escape, RLS INSERT, trigger atomics |
| `docs/solutions/patterns/common-solutions.md` #25                                                  | Stale todo triage methodology                 |
| `docs/solutions/security-issues/discovery-mvp-r2-postgrest-view-security-20260227.md`              | PostgREST filter escape precedent             |
| `docs/solutions/process-issues/wave2-p2p3-domain-grouped-remediation-20260219.md`                  | Domain-grouped agent methodology              |
| `docs/solutions/feature-implementation/slice-8-creator-network-notifications-compound-20260307.md` | RLS + trigger patterns from Slice 8           |
| `docs/solutions/code-quality/p3-sprint1-cleanup-dead-code-architecture.md`                         | Dead code deletion verification methodology   |

---

## CE Loop Retrospective

| Phase    | Effort  | Outcome                                                  |
| -------- | ------- | -------------------------------------------------------- |
| Audit    | ~1 hr   | 8 agents, 33 findings (#757-#789)                        |
| Triage   | ~30 min | 101 stale (85%), 4 WONT_FIX, 15 still needed, 5 deferred |
| Batch 1  | ~30 min | 5 agents, 15 pre-existing todos fixed                    |
| Batch 2  | ~1 hr   | 5 agents, 28 audit todos fixed                           |
| Cleanup  | ~15 min | Todo renames, team shutdown                              |
| Compound | ~20 min | This document                                            |

**Key insight**: Triage saved ~60% of remediation effort. Without it, 101 already-fixed items would have been assigned to agents, burning tokens and creating merge conflicts on unchanged code.
