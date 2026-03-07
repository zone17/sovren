---
title: 'Slice 8: Creator Network + Notifications — Full CE Loop Compound'
date: 2026-03-07
commit: d4822a6
pr: '147'
category: feature-implementation
tags:
  [
    creator-network,
    notifications,
    circles,
    mentorship,
    follow,
    RLS,
    trigger-atomicity,
    SECURITY_DEFINER,
    api-contract,
    DI-coupling,
    rebase-conflict,
    ci-ratchet,
    compound,
  ]
module: community
severity: mixed (P1-P3)
symptoms:
  - RLS policy allows any user to insert notifications
  - Follower counts incorrect under concurrent load
  - Frontend destructuring fails on API response
  - Follow-counts endpoint returns wrong user data
  - Notification persistence timers never start
  - Rebase conflicts on pattern numbering
  - CI ratchet false positive from JSDoc comment
root_causes:
  - WITH CHECK (TRUE) missing service_role restriction
  - COALESCE+1 non-atomic read-modify-write in trigger
  - Backend response key differs from frontend expectation
  - Route handler reads req.user.id instead of req.params.userId
  - Lazy DI resolution skips constructor side effects
  - Parallel PRs add overlapping pattern numbers
  - grep-based ratchet matches prose, not just directives
---

# Slice 8: Creator Network + Notifications — Compound Doc

**PR**: #147 | **Merged**: 2026-03-07 | **Commit**: `d4822a6`
**Scope**: 100 files, +7,579/-346 lines, 4,907 tests passing
**CE Loop**: Plan -> Work (solo) -> Review R1 (23 findings) -> Fix -> Review R2 (19 findings) -> Fix -> Rebase -> CI fix -> Merge -> Compound

## What Was Built

Slice 8 implements the Creator Network layer:

- **Creator Circles**: Browse, create, join, leave circles with capacity limits
- **Mentorship**: Request/respond to mentorship with TOCTOU-safe capacity checks
- **Follow System**: Follow/unfollow with trigger-maintained counts
- **Notifications**: Real-time notification center with activity/nostr tabs, mark-all-read, persistence

## Review Statistics

| Metric                  | Value                                |
| ----------------------- | ------------------------------------ |
| Review rounds           | 2                                    |
| Total findings          | 42 (4 P1, 17 P2, 21 P3)              |
| Fixed                   | 42 (100%)                            |
| Review agents per round | 9-10 parallel                        |
| New patterns discovered | 6 (critical #16-17, common #116-119) |

---

## P1 Findings and Solutions

### 1. RLS INSERT Policy Too Permissive

**Symptom**: Any authenticated user could insert notification records for any other user.

**Root Cause**: `WITH CHECK (TRUE)` on notifications table INSERT policy — no role restriction.

**Fix**: Restrict to `service_role` only:

```sql
-- BEFORE
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (TRUE);

-- AFTER
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

**Detection**: `grep -n "WITH CHECK (TRUE)" supabase/migrations/`
**Prevention**: Every service-inserted table must have `auth.role() = 'service_role'` in INSERT policy. Add to migration review checklist.
**Pattern**: critical-patterns.md #16

---

### 2. Trigger Race Condition (COALESCE+1)

**Symptom**: Follower counts skip or duplicate under concurrent follows.

**Root Cause**: `COALESCE(count, 0) + 1` reads stale value — two concurrent transactions both read N, both write N+1, losing one increment.

**Fix**: Atomic `count + 1` (PostgreSQL handles atomically) + `SECURITY DEFINER`:

```sql
-- BEFORE
UPDATE follow_stats SET count = COALESCE(count, 0) + 1 WHERE user_id = NEW.user_id;

-- AFTER
CREATE OR REPLACE FUNCTION increment_follow_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE follow_stats SET count = count + 1 WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Detection**: `grep -n "COALESCE.*+ 1" supabase/migrations/`
**Prevention**: All counter triggers must use `column + 1` pattern. Never COALESCE in trigger increments.
**Pattern**: critical-patterns.md #17

---

### 3. Response Key Mismatch (Backend <-> Frontend)

**Symptom**: Frontend `const { following } = response` fails when backend returns `{ data: result }`.

**Root Cause**: No contract verification between backend response shape and frontend destructuring.

**Fix**: Alignment checklist — verify response key names match at every endpoint:

```typescript
// Backend: return consistent shape
res.json(createApiResponse({ following: result }));

// Frontend: destructure matching key
const { following } = response.data;
```

**Detection**: Grep backend response keys and frontend destructuring for each endpoint.
**Prevention**: Shared response types in `@shared/types/api-handlers.ts`. TypeScript catches mismatches at compile time.
**Pattern**: common-solutions.md #116

---

### 4. Route Parameter Ignored

**Symptom**: `/follow-counts/:userId` returns logged-in user's counts, not the requested user's.

**Root Cause**: Handler uses `req.user.id` instead of `req.params.userId`.

**Fix**: Read from `req.params.userId` with UUID validation:

```typescript
const { userId } = req.params;
const parsed = z.string().uuid().safeParse(userId);
if (!parsed.success) return res.status(400).json(createApiResponse(null, 'Invalid user ID'));
const counts = await followService.getFollowCounts(parsed.data);
```

**Detection**: Code review — every route with `:param` must use `req.params`.
**Prevention**: Route boundary UUID validation (critical-patterns.md #13).
**Pattern**: Reinforces critical-patterns.md #13

---

### 5. DI Temporal Coupling (Lazy Singleton)

**Symptom**: NotificationPersistenceService timers never start — notifications accumulate but never flush.

**Root Cause**: Service has constructor side effects (timer setup, event subscriptions) but is lazily resolved. Nothing triggers first resolution before events arrive.

**Fix**: Eager init at container startup:

```typescript
// In server.ts bootstrap
const notificationPersistence = container.resolve(NotificationPersistenceService);
// Timers now running before any requests arrive
```

**Detection**: Grep for `setInterval`, `setTimeout`, `subscribe` in service constructors. If present, verify eager resolution.
**Prevention**: Services with constructor side effects must document `@eager` in JSDoc and be resolved at startup.
**Pattern**: common-solutions.md #117

---

## Key P2 Fixes

### Shared Utility Extraction (-140 LOC)

Three duplicated functions extracted to shared packages:

- `getUserIdByPubkey` — 5 copies consolidated
- `stripControlChars` — 3 copies consolidated
- `emitDomainEvent` — 4 copies consolidated

**Threshold**: Extract when `LOC x copies > 40` (common-solutions.md #119).

### N+1 Query in getCircles

3 queries -> 2 via PostgREST `.or()` filter instead of loop-per-circle detail fetch.

### Pagination Pushed to DB

Removed JS `.slice()` on full result sets. Pagination now happens at DB level with LIMIT/OFFSET.

### PostgREST Error Sanitization

7 interpolations of raw Supabase error messages into API responses replaced with generic error messages. Prevents information leakage.

### inFlightRef Removal

Removed `useRef` mutex from 3 components — TanStack Query's `isPending` already prevents double-fetches.

---

## Rebase and CI Learnings

### Pattern Number Conflicts During Rebase

**Problem**: PR #146 (Slice 9) and PR #147 (Slice 8) both added patterns starting at #111. Rebase produced conflicts in `common-solutions.md` and `PROJECT_CONTEXT.md`.

**Resolution**: Keep HEAD's numbers (#111-#115 from PR #146), renumber feature branch entries to #116-#119. Update all internal cross-references.

**Prevention**: Pattern files are high-contention. When multiple PRs are in flight:

1. Check current max pattern number before adding entries
2. Use descriptive IDs in draft (`## #NEW-rls-insert:`) and assign numbers at merge time
3. Coordinate via MEMORY.md squad table

### CI @ts-nocheck Ratchet False Positive

**Problem**: `grep -rn '@ts-nocheck'` counted a JSDoc comment mentioning `@ts-nocheck` as a directive. Count went from 169 to 170, failing the ratchet.

**Resolution**: Changed JSDoc from "God Interface with @ts-nocheck" to "God Interface with type suppression".

**Prevention**: Avoid literal `@ts-nocheck` in prose/comments. CI ratchets using grep are text-matching, not AST-aware. Consider ESLint rule `@typescript-eslint/ban-ts-comment` for AST-based counting.

### Post-Merge Infrastructure Failures

Two pre-existing infra issues surfaced on main after merge:

1. **Docker Build**: `npm ci` fails — `package-lock.json` not in Docker build context
2. **Integration Tests**: `supabase_realtime` publication doesn't exist in testcontainers PostgreSQL

These are not caused by Slice 8 code but were exposed by the merge. Need separate fixes.

---

## New Patterns Added

| #   | Pattern                                             | File                 | Type |
| --- | --------------------------------------------------- | -------------------- | ---- |
| 16  | RLS INSERT service_role restriction                 | critical-patterns.md | P1   |
| 17  | Trigger atomic increments + SECURITY DEFINER        | critical-patterns.md | P1   |
| 116 | Response key alignment (backend <-> frontend)       | common-solutions.md  | P2   |
| 117 | DI lazy singleton eager init for side-effects       | common-solutions.md  | P2   |
| 118 | Remediation team sizing (2 agents for <20 findings) | common-solutions.md  | P2   |
| 119 | Utility extraction threshold (LOC x copies > 40)    | common-solutions.md  | P2   |

---

## Prevention Checklist (for future slices)

### Database Migrations

- [ ] All INSERT policies restrict to `service_role` where rows are service-created
- [ ] Counter triggers use `column + 1`, never `COALESCE(column, 0) + 1`
- [ ] Trigger functions have `SECURITY DEFINER SET search_path = public`
- [ ] VIEWs have `security_barrier = true` if public-facing

### API Endpoints

- [ ] Response key names match frontend destructuring
- [ ] Route handlers use `req.params.*` for path variables (not `req.user.*`)
- [ ] Every `:id` param validated with Zod UUID safeParse
- [ ] Error messages don't leak PostgREST/Supabase internals

### Services

- [ ] Services with constructor side effects (timers, subscriptions) are eagerly resolved
- [ ] Shared utilities extracted when `LOC x copies > 40`
- [ ] Pagination at DB level, not JS `.slice()`

### CI/CD

- [ ] No literal `@ts-nocheck` in JSDoc/comments (ratchet false positive)
- [ ] Pattern numbers checked against current max before adding

---

## Cross-References

| Document                                                                                | Relevance                                                      |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `docs/solutions/patterns/critical-patterns.md` #16-17                                   | Canonical RLS + trigger patterns                               |
| `docs/solutions/patterns/common-solutions.md` #116-119                                  | Response alignment, DI init, team sizing, extraction threshold |
| `docs/solutions/feature-implementation/slice-8-creator-network-notifications-review.md` | Detailed review findings (pre-compound)                        |
| `docs/solutions/security-issues/discovery-mvp-r2-postgrest-view-security-20260227.md`   | PostgREST filter escape, VIEW security barrier                 |
| `docs/solutions/architecture-issues/p2-deferred-fixes-type-safety-di-api-coverage.md`   | DI temporal coupling precedent                                 |
| `docs/solutions/code-quality/p2-remediation-review-sprint-dedup-redis-seed-20260224.md` | Utility extraction patterns                                    |

---

## CE Loop Retrospective

| Phase       | Effort  | Outcome                                                            |
| ----------- | ------- | ------------------------------------------------------------------ |
| Plan        | ~30 min | `docs/plans/2026-03-06-feat-creator-network-notifications-plan.md` |
| Work        | ~2 hrs  | 101 files, solo implementation                                     |
| Review R1   | ~1 hr   | 23 findings (5 P1, 12 P2, 6 P3)                                    |
| Fix R1      | ~1 hr   | All 23 fixed                                                       |
| Review R2   | ~1 hr   | 19 findings (0 P1, 6 P2, 13 P3)                                    |
| Fix R2      | ~30 min | All 19 fixed                                                       |
| Rebase + CI | ~30 min | Pattern renumbering, ratchet fix                                   |
| Merge       | ~5 min  | Squash merge via `gh pr merge --squash`                            |
| Compound    | ~20 min | This document                                                      |

**Key insight**: Two review rounds caught 42 total findings. The second round (R2) found 19 new issues that R1 missed — second round is never redundant. Zero P1s in R2 confirms R1 caught the critical issues.
