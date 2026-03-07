---
title: 'Slice 8: Creator Network + Notifications — Review Remediation'
category: feature-implementation
tags:
  [
    creator-network,
    notifications,
    review,
    remediation,
    token-efficiency,
    supabase,
    rls,
    triggers,
    react-query,
    duplication,
    slice-8,
  ]
module: Community
symptom: '23 review findings (5 P1, 12 P2, 6 P3) after 3-agent implementation'
root_cause: "Agents didn't test their own code; utility extraction deferred; SQL security patterns not in briefs"
date: 2026-03-07
sprint: Slice 8
pr: pending
---

# Slice 8: Creator Network + Notifications — Review Remediation

## Problem Statement

After implementing Slice 8 (Creator Network: circles, mentorship, follow system, notifications) with a 3-agent team, a 9-agent review found 23 findings. 5 were P1 (blocks merge), including broken functionality and security vulnerabilities. The implementation also had ~25-30% token waste identified by a dedicated efficiency audit agent.

## Investigation & Root Cause

### P1 Root Causes (5 findings)

| #   | Finding                                                | Root Cause                                                                 | Agent Consensus |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------- | --------------- |
| 698 | Notifications RLS `WITH CHECK (TRUE)`                  | Agent copied boilerplate INSERT policy without restricting to service_role | 5/9             |
| 699 | Trigger `COALESCE(x,0)+1` race + no SECURITY DEFINER   | Non-atomic read-modify-write pattern; default INVOKER mode                 | 3/9             |
| 700 | `isFollowing` vs `following` response key mismatch     | Backend/frontend agents used different key names, no integration test      | 2/9             |
| 701 | `/follow-counts` ignores `:userId` param               | Handler used `req.user.id` instead of `req.params.userId`                  | 4/9             |
| 702 | `subscribeToEvents()` only runs on first DI resolution | Lazy singleton means notifications silently fail if service never resolved | 1/9             |

### Duplication Root Cause (P2, 7/9 consensus)

Three utilities were independently implemented in 3-5 services each:

- `getUserIdByPubkey()` + TTLCache (~30 LOC x3)
- `stripControlChars()` (~8 LOC x2)
- `emitEvent()` fire-and-forget pattern (~20 LOC x4)

Root cause: Agent briefs said "implement service X" without "check for existing utilities first."

### Token Efficiency Root Cause (scored 6.2/10)

| Waste Category                   | ~Tokens | Cause                                                               |
| -------------------------------- | ------- | ------------------------------------------------------------------- |
| Over-engineered remediation plan | 12-15K  | 383-line plan file for 13 findings; todos already had all info      |
| Underutilized 3rd agent          | 6-8K    | types-and-qa had only 7 tasks; 2 agents sufficient for <20 findings |
| Lint fix commit                  | 6-8K    | Agents didn't run lint before declaring complete                    |
| Todo content duplicated in plan  | 4-6K    | Plan re-described what todos already specified                      |

## Working Solution

### Fix Stats

- **Agents**: 2 (backend-fixer: 77K tokens/1137s, frontend-fixer: 74K tokens/310s)
- **Files**: 28 changed, +335/-615 lines (net -280 LOC)
- **Tests**: 4907 passed, 0 failures
- **Lint**: 0 errors

### P1 Fixes

**#698 — RLS policy restricted to service_role:**

```sql
-- BEFORE (any authenticated user could insert)
CREATE POLICY notifications_insert_service ON notifications
  FOR INSERT WITH CHECK (TRUE);

-- AFTER (only backend service role)
CREATE POLICY notifications_insert_service ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

**#699 — Atomic trigger + SECURITY DEFINER:**

```sql
-- BEFORE (non-atomic, no security definer)
CREATE OR REPLACE FUNCTION update_follow_counts() RETURNS trigger AS $$
BEGIN
  UPDATE creators SET follower_count = COALESCE(follower_count, 0) + 1 ...

-- AFTER (atomic increment, security definer)
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE creators SET follower_count = follower_count + 1 ...
```

**#700 — Response key aligned:**

```typescript
// Backend changed from { isFollowing } to { following: isFollowing }
// Frontend already read res.following — no change needed
```

**#701 — Route param used correctly:**

```typescript
// BEFORE: const userId = req.user.id;
// AFTER:  const userId = UuidParamSchema.safeParse(req.params.userId);
```

**#702 — Eager initialization at startup:**

```typescript
// In server.ts startServer():
container.resolve(TYPES.NotificationPersistenceService);
// Forces singleton creation + subscribeToEvents() call
```

### P2 Utility Extraction (biggest impact: -140 LOC)

Created 3 shared utilities:

- `packages/backend/src/utils/getUserIdByPubkey.ts` — shared TTLCache singleton
- `packages/backend/src/utils/stripControlChars.ts` — single source of truth
- `packages/backend/src/utils/emitDomainEvent.ts` — fire-and-forget helper

All 5 services now import from these instead of maintaining local copies.

### Other P2/P3 Highlights

- **getFollowCounts**: Reads trigger-maintained columns first, COUNT fallback only if null
- **N+1 in getCircles**: 3 queries → 2 (using `.or()` PostgREST filter)
- **getSuggestedCircles**: Sequential → `Promise.all` parallel queries
- **Pagination**: Removed `.slice()` in JS, pushed to DB `.range()`
- **PostgREST errors**: 7 `error.message` interpolations → generic messages
- **Compensation DELETEs**: Now destructure and log errors (critical-patterns #4c)
- **inFlightRef removed**: 3 files simplified (TanStack Query isPending suffices)
- **NotificationBadge.tsx**: Deleted unused component (41 LOC)
- **events.ts**: Deleted unused CommunityEventPayload (33 LOC)
- **Supabase client**: Lazy-init via Proxy (no more module-load crash)
- **Unused POM locators**: 6 removed from E2E page objects

## New Patterns Discovered

### Critical Pattern #16: RLS INSERT Policies Must Restrict to Service Role

```sql
-- WRONG: Any authenticated user can insert
CREATE POLICY insert_policy ON table FOR INSERT WITH CHECK (TRUE);

-- CORRECT: Only backend service role
CREATE POLICY insert_policy ON table FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

**When to use**: Every table where rows are created by backend services on behalf of users (notifications, audit logs, system events). User-created rows (posts, comments) use `auth.uid()` check instead.

**Detection**: Grep for `WITH CHECK (TRUE)` or `WITH CHECK (true)` in migration files.

### Critical Pattern #17: PostgreSQL Trigger Atomic Increments

```sql
-- WRONG: Read-modify-write (race under concurrent load)
UPDATE t SET count = COALESCE(count, 0) + 1;

-- CORRECT: Atomic (PostgreSQL handles concurrency)
UPDATE t SET count = count + 1;

-- For decrements, floor at 0:
UPDATE t SET count = GREATEST(count - 1, 0);
```

**When to use**: Any trigger or function that increments/decrements counters. The `COALESCE` pattern creates a TOCTOU window where concurrent transactions read the same value.

**Also**: Always add `SECURITY DEFINER` + `SET search_path = public` to trigger functions that modify tables the invoking user may not have direct UPDATE permission on.

### Common Solution #111: Response Key Alignment Checklist

Backend/frontend response shape mismatches are invisible to unit tests (each side mocks its own). Prevention:

1. Define response types in `@shared/types/` (single source of truth)
2. Backend route handler returns the shared type
3. Frontend API function types the response with the shared type
4. Add one integration test or E2E test that exercises the full round-trip

### Common Solution #112: DI Lazy Singleton Eager Init

When a DI singleton has side effects in its constructor or initialization (event subscriptions, timers, connection pooling), lazy resolution means those effects never fire if nothing requests the service.

```typescript
// In server startup, AFTER container configuration:
container.resolve(TYPES.NotificationPersistenceService); // eager init
```

**Detection**: Search for `subscribeToEvents`, `setInterval`, `connect()`, or similar in singleton constructors/factories.

### Common Solution #113: Token Efficiency for Review Remediation

| Team Size | Optimal For                         | Reason                                    |
| --------- | ----------------------------------- | ----------------------------------------- |
| 1 (solo)  | <8 findings, single domain          | Overhead of agent briefing > savings      |
| 2 agents  | 8-20 findings, backend + frontend   | Sweet spot: zero conflicts, domain-scoped |
| 3+ agents | 20+ findings or 3+ distinct domains | Diminishing returns below this threshold  |

Additional efficiency rules:

- Skip remediation plan file — annotate todos directly
- Mandate `npm run lint` in agent briefs (saves follow-up commit)
- Require agents test their own code before declaring complete
- Use 9 review agents but only 2 fix agents (review is embarrassingly parallel; fixing has dependencies)

### Common Solution #114: Utility Extraction Threshold (Refined)

Existing pattern #14 said "3+ copies = extract." Refined with data from this sprint:

| Copies | Action              | Example                                                              |
| ------ | ------------------- | -------------------------------------------------------------------- |
| 2      | Extract if >10 LOC  | stripControlChars (8 LOC x2 = borderline, but extracted for clarity) |
| 3+     | Always extract      | getUserIdByPubkey (30 LOC x3 = clear win)                            |
| 4+     | Extract + add to DI | emitDomainEvent (20 LOC x4 = shared utility with injected deps)      |

The key signal is **LOC x copies**: if total duplicated LOC > 40, extract.

## Prevention Strategies

### For Future Agent Briefs

Add to all implementation agent briefs:

```
BEFORE IMPLEMENTING:
1. Search src/utils/ for existing utilities that do what you need
2. If you write a function that could exist in another service, extract to src/utils/
3. Run `npm run lint` before declaring any task complete
4. For SQL migrations: use `auth.role() = 'service_role'` for service-inserted tables,
   `SECURITY DEFINER SET search_path = public` for all trigger functions
5. For API responses: define types in @shared/types, import on both sides
```

### For Reviews

The 9-agent parallel review caught issues the implementation agents missed. Key insight: **review is more valuable than implementation** — 5 P1s that would have shipped to production were caught. Never skip the review step, even for "simple" remediation commits.

### CI Gate Additions (Future)

- Grep for `WITH CHECK (TRUE)` in SQL migrations → fail if found without exemption comment
- Grep for `COALESCE.*+ 1` in trigger functions → suggest atomic pattern
- Response type coverage: shared types used in both backend routes and frontend API calls

## Cross-References

- [critical-patterns.md #4c](../patterns/critical-patterns.md) — Compensation error checking (reinforced by #714)
- [common-solutions.md #7](../patterns/common-solutions.md) — Table-aware Supabase mocks (test fixes required mock updates)
- [common-solutions.md #14](../patterns/common-solutions.md) — Utility extraction threshold (refined to LOC x copies > 40)
- [common-solutions.md #29](../patterns/common-solutions.md) — Silent fallback must log (reinforced by #716)
- Prior P1 TOCTOU class: critical-patterns.md #1a — insert-then-verify pattern (reinforced by #699 trigger race)

## Metrics

| Metric                 | Value                                       |
| ---------------------- | ------------------------------------------- |
| Review agents          | 9 parallel                                  |
| Review agent tokens    | ~1.1M total                                 |
| Fix agents             | 2 parallel                                  |
| Fix agent tokens       | ~152K total                                 |
| Findings               | 23 (5 P1, 12 P2, 6 P3)                      |
| Fixed                  | 21/23                                       |
| Deferred               | 2 (P3: @ts-nocheck, missing endpoints)      |
| Test suite             | 4907 pass, 0 fail                           |
| Net LOC change         | -280 (code got simpler)                     |
| Token efficiency score | 6.2/10 → recommendations applied this round |
