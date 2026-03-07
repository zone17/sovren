---
title: 'fix: Slice 8 Review Remediation'
type: fix
date: 2026-03-07
---

# fix: Slice 8 Creator Network Review Remediation

## Overview

Fix 13 confirmed findings from 8-agent `/workflows:review` of Slice 8 (Creator Network + Notifications). Original synthesis: 17 todos → counter-argued to 4 P1, 5 P2, 6 P3, 2 deleted (false positives).

**Branch:** `feat/squad-b/slice-8-creator-network-notifications`

## DoD Cross-Reference

From `docs/planning/story-map-v2-production-roadmap.md` lines 251-263:

> **Definition of done**: Creator Circles (create/join/browse). Follow/unfollow persisted. Mentorship directory (browse + request only). Notification center wired to real events.

| DoD Item                                                       | Status                                                                      | Blocker |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- | ------- |
| Shared types (`community.ts`, `events.ts`, `notifications.ts`) | Done                                                                        | —       |
| `networkApi.ts` — circles, follow, mentors                     | Done but follow API has wrong URLs (#683)                                   | P1      |
| `notificationsApi.ts`                                          | Done but missing `getUnreadCount()` + `delete()`, wrong `markRead()` (#683) | P1      |
| Creator Circles create/join/browse                             | Done but `getCircles()` ignores filter (#692)                               | P2      |
| Follow/Unfollow POST/DELETE persisted                          | **Broken** — wrong table name (#681), wrong ID type (#682)                  | P1      |
| Button state persists                                          | Done (optimistic update in `useFollow.ts`)                                  | —       |
| Mentorship browse + request                                    | Done                                                                        | —       |
| Notifications wired to real events via Supabase Realtime       | Done but entityId null (#685), unread count broken (#687)                   | P1/P2   |
| E2E: `network.auth.spec.ts`                                    | Done                                                                        | —       |
| DB migrations                                                  | Done but trigger not idempotent (#686)                                      | P3      |
| Backend tests                                                  | Done (37 + 42 test cases) but need updates after fixes                      | —       |

**Verdict:** Follow and Notification subsystems are non-functional at runtime due to P1s. All other DoD items satisfied.

## 1-Point Task Breakdown

### Domain Expert Legend

| Code   | Expert            | Scope                                                 | Model  |
| ------ | ----------------- | ----------------------------------------------------- | ------ |
| **BE** | Backend Services  | Services, routes, interfaces, DI bindings, migrations | sonnet |
| **FE** | Frontend Features | API services, hooks, components, query keys           | sonnet |
| **TS** | TypeScript/Types  | Shared types, type safety, `@ts-nocheck` removal      | sonnet |
| **QA** | Test Engineer     | Backend tests, E2E tests, type-check verification     | sonnet |

---

### Phase 1: P1 Critical Fixes (blocks merge)

#### Task 1 — Fix table name `follows` → `followers` in FollowService

- **Expert:** BE
- **Todo:** #681
- **File:** `packages/backend/src/services/community/FollowService.ts`
- **Work:** Replace `.from<FollowRow>('follows')` → `.from<FollowRow>('followers')` at 7 locations (lines 47, 95, 110, 132, 162, 187, 191)
- **Verify:** `grep -n "from.*'follows'" FollowService.ts` returns 0 matches

#### Task 2 — Add `getUserIdByPubkey()` + TTLCache to FollowService

- **Expert:** BE
- **Todo:** #682
- **Depends on:** Task 1
- **File:** `packages/backend/src/services/community/FollowService.ts`
- **Pattern:** Copy from `CommentsService.ts:80-97`
- **Work:**
  - Import `TTLCache` from `../../utils/cache` (or wherever CommentsService imports it)
  - Add `private userIdCache = new TTLCache<string, string>(60_000)`
  - Add `private async getUserIdByPubkey(pubkey: string): Promise<string>` method (query `users` table, cache result)
  - In each public method (`follow`, `unfollow`, `isFollowing`, `getFollowers`, `getFollowing`, `getFollowCounts`): resolve the pubkey parameter to UUID via `getUserIdByPubkey()` before passing to DB queries
- **Verify:** Each method's first line resolves pubkey; DB queries use UUID

#### Task 3 — Add `getUserIdByPubkey()` + TTLCache to NotificationPersistenceService

- **Expert:** BE
- **Todo:** #682
- **Depends on:** Task 1
- **File:** `packages/backend/src/services/community/NotificationPersistenceService.ts`
- **Work:**
  - Same TTLCache pattern as Task 2
  - Add resolution in: `list()`, `getUnreadCount()`, `markRead()`, `markAllRead()`, `delete()`
  - **DO NOT** resolve IDs in `handleCommunityEvent()` — event payloads already contain UUIDs from the DB
- **Verify:** Route-facing methods resolve pubkey; event handler left unchanged

#### Task 4 — Fix `entityId` for follow notifications

- **Expert:** BE
- **Todo:** #685
- **File:** `packages/backend/src/services/community/NotificationPersistenceService.ts`
- **Line:** 118
- **Work:** Change `entityId: payload.followId as string | undefined` → `entityId: (event as any).aggregateId ?? undefined`
  - Better: update `handleCommunityEvent` signature to receive full event object with `aggregateId` field, then use `event.aggregateId`
- **Verify:** Follow notification created with non-null `entity_id`

#### Task 5 — Add missing `GET /follow-counts` route

- **Expert:** BE
- **Todo:** #683
- **File:** `packages/backend/src/routes/v2/follow.routes.ts`
- **Work:** Add route between `/follow-status` and `/followers`:
  ```
  router.get('/follow-counts', authenticate, requireAuth, asyncHandler(async (req, res) => {
    const targetIdResult = UuidParamSchema.safeParse(req.params.userId);
    if (!targetIdResult.success) throw new ValidationError('Invalid user ID format');
    const data = await getFollowService().getFollowCounts(getAuthUser(req).nostr_pubkey);
    res.json(createApiResponse(req, data));
  }));
  ```
- **Verify:** `curl GET /api/v2/network/users/:id/follow-counts` returns `{ followers, following }`

#### Task 6 — Fix `followApi.isFollowing()` URL

- **Expert:** FE
- **Todo:** #683
- **File:** `packages/frontend/src/features/creator-network/services/followApi.ts`
- **Line:** 23
- **Work:** Change `apiClient.get(\`${BASE}/${userId}/follow\`)`→`apiClient.get(\`${BASE}/${userId}/follow-status\`)`
- **Verify:** `isFollowing` calls correct backend route

#### Task 7 — Fix `notificationsApi.markRead()` method + URL

- **Expert:** FE
- **Todo:** #683
- **File:** `packages/frontend/src/features/notifications/services/notificationsApi.ts`
- **Line:** 19
- **Work:** Change `apiClient.put(\`${BASE}/${notificationId}/read\`)`→`apiClient.patch(\`${BASE}/${notificationId}\`, { read: true })`
- **Verify:** markRead sends PATCH with body `{ read: true }`

#### Task 8 — Add missing `getUnreadCount()` and `delete()` to notificationsApi

- **Expert:** FE
- **Todo:** #683
- **File:** `packages/frontend/src/features/notifications/services/notificationsApi.ts`
- **Work:** Add two methods:
  ```typescript
  getUnreadCount(): Promise<{ count: number }> {
    return apiClient.get(`${BASE}/unread-count`);
  },
  delete(notificationId: string): Promise<void> {
    return apiClient.delete(`${BASE}/${notificationId}`);
  },
  ```
- **Verify:** Both methods exist and match backend route contracts

#### Task 9 — Remove `@ts-nocheck` from FollowService

- **Expert:** TS
- **Todo:** #684
- **Depends on:** Tasks 1, 2
- **File:** `packages/backend/src/services/community/FollowService.ts`
- **Work:** Delete line 1 (`// @ts-nocheck`)
- **Verify:** `npx tsc --noEmit -p packages/backend/tsconfig.json` shows 0 new errors from this file

#### Task 10 — Remove `@ts-nocheck` from NotificationPersistenceService

- **Expert:** TS
- **Todo:** #684
- **Depends on:** Tasks 3, 4
- **File:** `packages/backend/src/services/community/NotificationPersistenceService.ts`
- **Work:** Delete line 1 (`// @ts-nocheck`)
- **Verify:** `npx tsc --noEmit -p packages/backend/tsconfig.json` shows 0 new errors from this file

---

### Phase 2: P2 Fixes (should fix before merge)

#### Task 11 — Fix `useUnreadNotificationCount` to use dedicated endpoint

- **Expert:** FE
- **Todo:** #687
- **Depends on:** Task 8 (needs `getUnreadCount()` API method)
- **File:** `packages/frontend/src/features/notifications/hooks/useNotifications.ts`
- **Lines:** 28-34
- **Work:** Replace `queryFn: () => notificationsApi.list(...)` + `select: filter` with:
  ```typescript
  queryFn: () => notificationsApi.getUnreadCount(),
  select: (res) => res.count,
  ```
- **Verify:** Hook returns actual unread count (not 0-or-1)

#### Task 12 — Fix `groupByDate` UTC midnight → local midnight

- **Expert:** FE
- **Todo:** #690
- **File:** `packages/frontend/src/features/notifications/components/ServerNotificationCenter.tsx`
- **Work:** Replace `now - (now % DAY)` with:
  ```typescript
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  ```
- **Verify:** "Today" section uses local midnight boundary

#### Task 13 — Fix `getCircles()` to filter by creator membership

- **Expert:** BE
- **Todo:** #692
- **File:** `packages/backend/src/services/community/CreatorCircleService.ts`
- **Lines:** 106-120
- **Work:** Add filter: query `circle_members` for circles the creator belongs to, OR `.eq('created_by', creatorId)` for owned circles. Two-query approach (owned + member) with dedup is simplest.
- **Verify:** `getCircles(creatorId)` returns only circles the user created or joined, not all circles

#### Task 14 — Replace `console.error` with `toast.error` in `useMarketplace.ts`

- **Expert:** FE
- **Todo:** #694
- **File:** `packages/frontend/src/features/creator-network/hooks/useMarketplace.ts`
- **Work:** At 6 `onError` handlers (lines ~23, 38, 52, 66, 81, 103): replace `console.error('...', error)` with `toast.error(error instanceof Error ? error.message : 'Operation failed')`. Add `import { toast } from 'react-hot-toast'`.
- **Verify:** `grep -c console.error useMarketplace.ts` returns 0

#### Task 15 — Replace `console.error` with `toast.error` in `useCollaboration.ts`

- **Expert:** FE
- **Todo:** #694
- **File:** `packages/frontend/src/features/creator-network/hooks/useCollaboration.ts`
- **Work:** At 4 `onError` handlers (lines ~37, 55, 75, 92): same pattern as Task 14. Add toast import.
- **Verify:** `grep -c console.error useCollaboration.ts` returns 0

#### Task 16 — Replace `console.error` with `toast.error` in `useMentorship.ts`

- **Expert:** FE
- **Todo:** #694
- **File:** `packages/frontend/src/features/creator-network/hooks/useMentorship.ts`
- **Work:** Check for `console.error` in onError handlers, replace with toast. Add toast import if needed.
- **Verify:** `grep -c console.error useMentorship.ts` returns 0

---

### Phase 3: P3 Cleanup (defer to post-merge or Slice 9)

#### Task 17 — Add `DROP TRIGGER IF EXISTS` for idempotent migration

- **Expert:** BE
- **Todo:** #686
- **File:** `supabase/migrations/20260306000001_follow_count_trigger.sql`
- **Line:** 27
- **Work:** Add `DROP TRIGGER IF EXISTS trg_update_follow_counts ON followers;` before `CREATE TRIGGER`

#### Task 18 — Type event handler payload as discriminated union

- **Expert:** TS
- **Todo:** #693
- **File:** `packages/backend/src/services/community/NotificationPersistenceService.ts`
- **Lines:** 99-103
- **Work:** Change param type from `Record<string, unknown>` to `DomainEvent<CommunityEventPayload>`. Remove inline `as` casts in switch branches.

#### Task 19 — Add Supabase env var runtime guard

- **Expert:** FE
- **Todo:** #693
- **File:** `packages/frontend/src/services/supabase.ts`
- **Work:** Add `if (!supabaseUrl || !supabaseAnonKey) throw new Error(...)` before `createClient()`

#### Task 20 — Chunk `createBatch()` at CHUNK_SIZE=500

- **Expert:** BE
- **Todo:** #695
- **File:** `packages/backend/src/services/community/NotificationPersistenceService.ts`
- **Lines:** 277-301
- **Work:** Loop with `for (let i = 0; i < rows.length; i += 500)` and insert sliced batches

#### Task 21 — Insert-then-verify for mentorship capacity (TOCTOU fix)

- **Expert:** BE
- **Todo:** #695
- **File:** `packages/backend/src/services/community/MentorshipService.ts`
- **Work:** Per `critical-patterns.md #1a`: INSERT first, count active mentorships after, rollback if over capacity

#### Task 22 — Move `circleKeys` to `query-keys.ts`

- **Expert:** FE
- **Todo:** #696
- **File:** `packages/frontend/src/features/creator-network/hooks/useCircles.ts` → `packages/frontend/src/hooks/query-keys.ts`
- **Work:** Move `circleKeys` factory, update imports in `useCircles.ts`

#### Task 23 — Replace inline string arrays in `useMentorship.ts` with key factory

- **Expert:** FE
- **Todo:** #696
- **File:** `packages/frontend/src/features/creator-network/hooks/useMentorship.ts`
- **Work:** Create `mentorshipKeys` factory in `query-keys.ts`, replace inline `['mentorship', ...]` arrays

#### Task 24 — Remove unused hooks (YAGNI)

- **Expert:** FE
- **Todo:** #696
- **Work:** Remove `useRespondToCollaboration` if unused, remove `useCircle(circleId)` if unused. Verify with grep before deleting.

#### Task 25 — Remove empty `CHANNEL_ERROR`/`TIMED_OUT` branch

- **Expert:** FE
- **Todo:** #696
- **File:** `packages/frontend/src/features/notifications/hooks/useNotifications.ts`
- **Lines:** 107-109
- **Work:** Remove empty branch or add a `logger.warn()` — currently a no-op with only a comment

#### Task 26 — Add JSDoc to `followApi.ts` methods

- **Expert:** FE
- **Todo:** #697
- **File:** `packages/frontend/src/features/creator-network/services/followApi.ts`
- **Work:** Add JSDoc matching `commentsApi.ts` pattern (params, return types, endpoint URL)

#### Task 27 — Miscellaneous code quality cleanup

- **Expert:** TS
- **Todo:** #697
- **Work:**
  - Remove `React` namespace import from `FollowButton.tsx` (automatic JSX transform)
  - Combine duplicate import lines in `INotificationPersistenceService.ts:9-10`
  - Remove unnecessary `queryClientRef` in `useNotificationRealtime` (queryClient is stable per React Query docs)
  - Update `types.ts` header comment (stale service count)
  - Add vitest import directive to new test files

#### Task 28 — Add `leaveCircle` membership check + console.error cleanup

- **Expert:** BE
- **Todo:** #694
- **File:** `packages/backend/src/services/community/CreatorCircleService.ts`
- **Lines:** 198-227
- **Work:** Before DELETE, query `circle_members` to verify membership exists. If not found, log warning and return (idempotent). This prevents silent success on non-member leave.

---

### Phase 4: Verification (after all phases)

#### Task 29 — Update FollowService tests for table name + pubkey resolution

- **Expert:** QA
- **Depends on:** Tasks 1, 2, 9
- **File:** `packages/backend/src/services/community/__tests__/FollowService.test.ts`
- **Work:** Update mock setup to handle `getUserIdByPubkey()` call (mock `users` table query). Verify all 37 tests still pass with updated service.

#### Task 30 — Update NotificationPersistenceService tests for pubkey resolution

- **Expert:** QA
- **Depends on:** Tasks 3, 4, 10
- **File:** `packages/backend/src/services/community/__tests__/NotificationPersistenceService.test.ts`
- **Work:** Update mock setup for pubkey resolution. Verify all 42 tests pass. Add test for entityId on follow notification.

#### Task 31 — Run full type-check + backend tests

- **Expert:** QA
- **Depends on:** All Phase 1 + 2 tasks
- **Work:**
  - `npx tsc --noEmit -p packages/backend/tsconfig.json` — 0 errors
  - `npx tsc --noEmit -p packages/shared/tsconfig.json` — 0 errors
  - `npm run test:unit` — all pass
  - `npm run test:e2e` — all pass

---

## Task Summary

| Phase                 | Tasks  | Points | Expert Distribution              |
| --------------------- | ------ | ------ | -------------------------------- |
| Phase 1: P1 Fixes     | 1-10   | 10     | BE: 5, FE: 3, TS: 2              |
| Phase 2: P2 Fixes     | 11-16  | 6      | FE: 5, BE: 1                     |
| Phase 3: P3 Cleanup   | 17-28  | 12     | FE: 6, BE: 4, TS: 2              |
| Phase 4: Verification | 29-31  | 3      | QA: 3                            |
| **Total**             | **31** | **31** | **BE: 10, FE: 14, TS: 4, QA: 3** |

## Dependency Graph

```
Phase 1 (P1 — sequential within, parallel across domains):
  Task 1 (table name) ──┬──→ Task 2 (pubkey FollowService) ──→ Task 9 (@ts-nocheck FS)
                        │
                        └──→ Task 3 (pubkey NPS) ──→ Task 10 (@ts-nocheck NPS)
                                   │
  Task 4 (entityId) ──────────────┘
  Task 5 (follow-counts route) ── standalone
  Task 6 (isFollowing URL) ── standalone
  Task 7 (markRead method) ── standalone
  Task 8 (getUnreadCount + delete API) ── standalone

Phase 2 (P2 — mostly parallel):
  Task 8 ──→ Task 11 (unread count hook)
  Task 12 (UTC midnight) ── standalone
  Task 13 (getCircles filter) ── standalone
  Tasks 14-16 (toast errors) ── parallel, standalone

Phase 3 (P3 — all standalone, fully parallel)

Phase 4 (Verification — after all):
  Tasks 1,2,9 ──→ Task 29 (FollowService tests)
  Tasks 3,4,10 ──→ Task 30 (NPS tests)
  All ──→ Task 31 (full verification)
```

## Team Composition Recommendation

Given the dependency graph, **3 parallel agents** is optimal:

| Agent              | Expert  | Tasks                                           | Scope                                     |
| ------------------ | ------- | ----------------------------------------------- | ----------------------------------------- |
| **backend-fixer**  | BE      | 1→2→3→4→5, 13, 17, 20, 21, 28                   | Backend services + routes                 |
| **frontend-fixer** | FE      | 6→7→8→11, 12, 14→15→16, 19, 22→23→24→25→26      | Frontend API + hooks + components         |
| **types-and-qa**   | TS + QA | 9→10 (after BE signals ready), 18, 27, 29→30→31 | Type safety + test updates + verification |

**Parallelism:** backend-fixer and frontend-fixer can run fully in parallel (zero file overlap). types-and-qa starts on Task 18/27 immediately, then picks up Tasks 9/10 once backend-fixer completes Tasks 1-4, then runs verification Tasks 29-31 last.

**Why not solo:** The counter-argument recommended solo due to coupling, but the 1-point breakdown reveals clear domain boundaries. Backend and frontend tasks have **zero file overlap**. The only coupling is Task 9/10 depending on Tasks 1-4 (wait for backend to fix before removing @ts-nocheck), which the types-and-qa agent can handle with a simple dependency wait.

## References

- CommentsService pubkey→UUID pattern: `packages/backend/src/services/community/CommentsService.ts:80-97`
- Baseline schema (table name): `supabase/migrations/20240101000000_baseline_schema.sql:126`
- Follow trigger migration: `supabase/migrations/20260306000001_follow_count_trigger.sql:28`
- Critical patterns: `docs/solutions/patterns/critical-patterns.md`
- Common solutions: `docs/solutions/patterns/common-solutions.md`
- Story map DoD: `docs/planning/story-map-v2-production-roadmap.md:251-263`
- Todo files: `todos/681-697`
