---
title: 'Comments CRUD with Threading and Moderation — Slice 6'
date: '2026-03-04'
category: feature-implementation
tags:
  [
    comments,
    threading,
    soft-delete,
    uuid-validation,
    xss,
    optimistic-ui,
    react-query,
    supabase,
    squad-b,
  ]
module: Comments / Community
symptom: 'New feature build — no prior symptoms'
root_cause: 'N/A — greenfield build with 17 review findings'
sprint: 'Squad B Sprint 2'
pr: '#137'
review_agents: 8
findings: 17
fixed: 11
deferred: 7
---

# Comments CRUD with Threading and Moderation — Slice 6

## Summary

Full comments system built from scratch for the Sovren platform. 33 files changed, +6,465/-1,020 lines. Backend CRUD routes, server-side XSS sanitization, two-level threading enforcement, creator moderation, frontend optimistic UI with React Query, and E2E specs. 8-agent parallel review produced 17 findings (4 P1, 7 P2, 6 P3); 11 fixed before merge, 7 deferred.

## Key Technical Decisions

| #   | Decision                                                      | Rationale                                                                                 |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| D1  | NOSTR pubkey → UUID via TTLCache                              | All v2 services resolve auth JWT pubkey to internal UUID. 60s TTL, maxSize 1000.          |
| D2  | DELETE route uses commentId only                              | Comment UUIDs are globally unique; avoids double-URL-param design.                        |
| D3  | Soft-delete with status enum (`active`/`deleted`/`moderated`) | No physical DELETE. Preserves audit trail. RLS filters `WHERE status='active'`.           |
| D4  | Two-level threading (service + DB trigger)                    | Service validates parent has `parent_comment_id IS NULL`. DB trigger is defense-in-depth. |
| D5  | Control-char stripping instead of DOMPurify                   | DOMPurify is a no-op in Node.js without jsdom — returns input unchanged silently.         |
| D6  | Optimistic insert via UI state; optimistic delete via cache   | Create: `isPending` + `variables`. Delete: `onMutate` snapshot/restore.                   |
| D7  | Atomic status guard on delete                                 | `UPDATE WHERE status='active'` → ConflictError if 0 rows matched.                         |
| D8  | Reply count via PostgreSQL BEFORE INSERT trigger              | Atomic, no TOCTOU. Trigger is the canonical count source.                                 |

## Review Findings

### P1 Fixes (4)

**#622: UUID route param validation missing**
Route params passed directly to service without format validation. Non-UUID strings could reach Supabase and leak internal error messages. **Fix:** `z.string().uuid()` safeParse at route boundary → `ValidationError` before service call.

**#623: Avatar URL protocol whitelist missing**
`<img src={avatarUrl}>` rendered without protocol check. `javascript:` and `data:` URIs could execute. **Fix:** `/^https?:\/\//i.test(url)` guard before `<img>` render; fallback to initials avatar.

**#624: Phantom `hidden` status in enum**
`CommentStatus` included `hidden` which no code path ever wrote. **Fix:** Removed. Final: `'active' | 'deleted' | 'moderated'`.

**#625: Cross-content parent reference**
Parent comment lookup used only `.eq('id', parentId)` — allowed referencing a comment from a different content item. **Fix:** Added `.eq('content_id', contentId)` to parent query.

### P2 Fixes (4)

| #    | Finding                                         | Fix                                                          |
| ---- | ----------------------------------------------- | ------------------------------------------------------------ |
| #626 | Dead `callerPubkey` param in `listComments`     | Removed from service signature, interface, and route         |
| #628 | Optimistic delete only snapshotted current page | Changed to `getQueriesData`/`setQueriesData` with prefix key |
| #629 | Dead `count` factory in query keys              | Removed; final keys: `all`, `byContent`, `list`, `replies`   |
| #630 | Delete dialog `aria-labelledby` static ID       | Made unique per comment: `delete-dialog-title-${comment.id}` |

### P3 Fixes (3)

| #    | Finding                                   | Fix                                             |
| ---- | ----------------------------------------- | ----------------------------------------------- |
| #635 | Empty `aria-live` region never written to | Removed element                                 |
| #636 | Unused `hidden` import                    | Removed                                         |
| —    | Pattern renumbering during rebase         | Common-solutions.md #81→#84 after main diverged |

### Deferred (7)

| #    | Sev | Description                                | Reason                                                 |
| ---- | --- | ------------------------------------------ | ------------------------------------------------------ |
| #627 | P2  | Reply count trigger missing DELETE handler | Requires separate AFTER UPDATE trigger                 |
| #631 | P2  | RLS SELECT/UPDATE inconsistent             | Service-layer auth is primary; RLS is defense-in-depth |
| #632 | P2  | `listReplies` hardcoded limit:50           | Comments with >50 replies are rare                     |
| #633 | P3  | Offset pagination doesn't scale >10K       | Keyset pagination requires schema change               |
| #634 | P3  | Delete dialog no focus trap                | Needs focus trap utility; `aria-modal` interim         |
| #637 | P3  | E2E spec uses `page.route()` mocks         | Violates common-solutions.md #26                       |
| #638 | P3  | No `isFetching` pagination indicator       | UX polish deferred                                     |

## New Patterns Discovered

### P1-class: Route Boundary UUID Validation (→ critical-patterns.md #13)

Every route handler receiving an ID param must validate UUID format before service call.

```typescript
const UuidParamSchema = z.string().uuid();
const result = UuidParamSchema.safeParse(req.params.contentId);
if (!result.success) throw new ValidationError('Invalid content ID format');
```

**Detection:** Any `req.params.*` reaching a service without `safeParse` = P1.

### P1-class: Avatar/Image URL Protocol Whitelist (→ critical-patterns.md #14)

User-supplied URLs rendered as `<img src>` must be checked against `http(s)` allowlist.

```tsx
{
  url && /^https?:\/\//i.test(url) ? <img src={url} /> : <Fallback />;
}
```

**Detection:** Any `<img src={userValue}>` without protocol check = P1.

### P1-class: Cross-Content Parent Reference Guard (→ critical-patterns.md #15)

Parent lookups in threaded data must scope to the same content context.

```typescript
.eq('id', parentId).eq('content_id', contentId)  // both constraints required
```

**Detection:** Parent lookup with only `.eq('id', parentId)` = P1.

### P2-class: Optimistic Delete Multi-Page Snapshot (→ common-solutions.md #85)

Use `getQueriesData`/`setQueriesData` with prefix key for paginated lists.

### P2-class: Soft-Delete Enum — Only Written Values (→ common-solutions.md #86)

Status enums must contain only values that application code actually writes.

### P2-class: DOMPurify No-Op in Node.js (→ common-solutions.md #87)

DOMPurify without jsdom returns input unchanged silently. Use control-char stripping + React text escaping.

### P3-class: Dialog aria-labelledby Per-Instance IDs (→ common-solutions.md #88)

In lists, scope dialog heading IDs to `item.id` to avoid duplicate IDs.

## Test Strategy

| File                      | Tests | Pattern                                                    |
| ------------------------- | ----- | ---------------------------------------------------------- |
| `comments.routes.test.ts` | 23    | Router mock capture (same as shield.routes.test.ts)        |
| `CommentsService.test.ts` | 31    | Table-aware Supabase mock with stateful `afterUpdate` flag |
| `CommentList.test.tsx`    | 10    | React Testing Library with mocked `useComments` hook       |

**Total: 64 tests, all passing.**

## Cross-References

- critical-patterns.md #2 (service-layer auth) — ownership check in deleteComment
- critical-patterns.md #6 (SSRF validation) — same principle for avatar URL whitelisting
- critical-patterns.md #7 (status guards) — atomic `UPDATE WHERE status='active'`
- critical-patterns.md #11 (PostgREST filter escape) — UUID validation prevents similar injection
- common-solutions.md #7 (table-aware Supabase mocks) — used in service tests
- common-solutions.md #9 (Express route ordering) — replies route before `/:contentId`
- common-solutions.md #24 (error class selection) — ValidationError for format, AuthorizationError for ownership
- common-solutions.md #58 (keepPreviousData gate) — reinforced with multi-page snapshot

## Observations for Future Sprints

1. **Router mock capture pattern** now exists in 2 route test files → extract to `packages/testing/` shared utility
2. **Table-aware Supabase mock with `afterUpdate` flag** should be codified as `makeSupabaseChain()` factory
3. **Cross-content reference bugs are invisible to unit tests** that mock the DB — review step found #625 via code reasoning
4. **41% deferral rate** matches 6+ sprint average (~40%) — validates triage-first approach
5. **Deferred items cluster** into 3 themes: DB trigger completeness, RLS hardening, pagination scale → group into single "comments hardening" slice
