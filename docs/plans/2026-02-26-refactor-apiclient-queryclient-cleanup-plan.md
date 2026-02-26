---
title: 'refactor: apiClient + queryClient + Redux Cleanup (Sprint 0 P0)'
type: refactor
date: 2026-02-26
source_brainstorm: docs/brainstorms/2026-02-25-production-roadmap-brainstorm.md
squad: shared (both squads depend on this)
sprint: 0
priority: P0 — blocks all vertical slices
---

# refactor: apiClient + queryClient + Redux Cleanup

## Overview

Sprint 0 Day 1 prerequisite. Expose typed HTTP methods on `apiClient.ts`, delete dead `queryClient.ts`, and audit Redux slices. Both Squad A and Squad B are blocked until the apiClient has public `get()`/`post()`/`put()`/`delete()` methods — every domain API file uses a bracket-notation hack to bypass the private `request()` method.

## Problem Statement

Three independent issues compound to create a fragile foundation:

1. **apiClient.ts** has no public HTTP methods. 89 call sites across 13 domain API files use `apiClient['request']()` — TypeScript bracket notation that bypasses `private` access control. This defeats type safety, confuses new contributors, and will cause problems when any domain API file is modified during vertical slices.

2. **queryClient.ts** is 274 lines of dead code with zero importers. The real QueryClient is created inline in `main.tsx:22-37` with different configuration. The dead file contains `any` types, global scope pollution (`window.queryClient`), a `setInterval` side-effect, and stale React Query v4 patterns. It creates confusion about which config is active.

3. **Redux store** has zombie slices: `tempStubs.ts` (112 lines of no-op reducers imported by 11 files — 7 production, 4 test) and `unifiedCmsSlice.ts` (660 lines of server-state async thunks NOT wired into the store). The `userSlice` duplicates auth state that `AuthContext` already manages.

## Proposed Solution

Three sequential workstreams, each independently shippable:

### Workstream 1: apiClient Type Safety + Public Methods + Migration (HIGH PRIORITY)

Add `HttpMethod` union type, `QueryParams` type alias, explicit `as Promise<T>` cast, 4 public methods to `ApiClient` class, then migrate all 89 bracket-notation call sites.

### Workstream 2: Delete Dead queryClient.ts (TRIVIAL)

Delete the file. No extraction — CACHE_TIMES lived in dead code and has zero importers.

### Workstream 3: Redux Slice Audit + Cleanup (CONTAINED)

Delete `tempStubs.ts` and update its 11 consumers (7 production + 4 test). Leave `unifiedCmsSlice.ts` and `userSlice.ts` alone — either delete them in a future sprint or don't, but no TODO comments (code goes to die in TODO comments).

## Technical Approach

### Workstream 1: apiClient Type Safety + Public Methods

**File**: `packages/frontend/src/services/api/apiClient.ts`

**Step 0**: Run `npm run type-check` to establish baseline error count before any changes.

**Step 1**: Add type aliases at the top of the file (after imports, before class):

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type QueryParams = Record<string, string | number | boolean | undefined>;
```

**Step 2**: Constrain `request()` method signature — change `method: string` to `method: HttpMethod`. Replace all `Record<string, string | number | boolean | undefined>` occurrences with `QueryParams`.

**Step 3**: Fix trust boundary — change `return response.json()` to `return response.json() as Promise<T>` (makes the `any` from `.json()` explicit rather than silently propagating).

**Step 4**: Add 4 public methods after the private `request()` method:

```typescript
public get<T>(path: string, params?: QueryParams): Promise<T> {
  return this.request<T>('GET', path, undefined, params);
}

public post<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
  return this.request<T>('POST', path, body, params);
}

public put<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
  return this.request<T>('PUT', path, body, params);
}

public delete<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
  return this.request<T>('DELETE', path, body, params);
}
```

**Design decisions:**

- `get()` has NO body parameter — body is meaningless for GET requests. The `undefined` is passed internally.
- `delete()` accepts an optional body — `cancelSubscription()` at line 237 passes a body to DELETE. Using `delete` as a method name is valid on objects (only reserved as a standalone operator).
- No `patch()` — zero call sites use PATCH today. Add it when needed (3 lines, 30 seconds).
- `HttpMethod` union type replaces `method: string` — catches typos at compile time.
- `QueryParams` type alias eliminates 6 repetitions of `Record<string, string | number | boolean | undefined>`.
- `as Promise<T>` makes the trust boundary with `response.json()` explicit — `any` no longer silently propagates.
- Generic `<T>` is unconstrained — matches existing `request<T>()` signature.
- Existing domain-specific methods (lines 115-256: `generateChallenge()`, `getUserProfile()`, etc.) are NOT refactored — they use `this.request()` which is clean internal access.

**Migration pattern for 89 call sites across 13 files:**

| Before                                                 | After                                |
| ------------------------------------------------------ | ------------------------------------ |
| `apiClient['request']('GET', path)`                    | `apiClient.get(path)`                |
| `apiClient['request']('GET', path, undefined, params)` | `apiClient.get(path, params)`        |
| `apiClient['request']('POST', path, body)`             | `apiClient.post(path, body)`         |
| `apiClient['request']('POST', path, body, params)`     | `apiClient.post(path, body, params)` |
| `apiClient['request']('PUT', path, body)`              | `apiClient.put(path, body)`          |
| `apiClient['request']('DELETE', path)`                 | `apiClient.delete(path)`             |

**The dangerous case**: GET calls that pass `undefined` as body to reach the params argument:

```typescript
// BEFORE: body is undefined, params is { period }
apiClient['request']('GET', `${BASE}/patterns`, undefined, { period });

// AFTER: get() has no body param, params is first optional arg
apiClient.get(`${BASE}/patterns`, { period });
```

**Files to migrate (89 call sites):**

| #   | File                                                    | Calls | Methods                |
| --- | ------------------------------------------------------- | ----- | ---------------------- |
| 1   | `features/multi-platform/services/distributionApi.ts`   | 14    | GET, POST, PUT, DELETE |
| 2   | `features/wellness/services/wellnessApi.ts`             | 11    | GET, POST, PUT, DELETE |
| 3   | `features/multi-platform/services/inboxApi.ts`          | 10    | GET, POST, PUT, DELETE |
| 4   | `features/creator-network/services/circlesApi.ts`       | 7     | GET, POST, PUT, DELETE |
| 5   | `features/creator-network/services/marketplaceApi.ts`   | 7     | GET, POST, PUT, DELETE |
| 6   | `features/business/services/taxApi.ts`                  | 6     | GET, POST, DELETE      |
| 7   | `features/business/services/contractsApi.ts`            | 6     | GET, POST, PUT, DELETE |
| 8   | `features/content-shield/services/shieldApi.ts`         | 6     | GET, POST, PUT         |
| 9   | `features/business/services/invoicesApi.ts`             | 5     | GET, POST, PUT, DELETE |
| 10  | `features/business/services/revenueApi.ts`              | 5     | GET, POST, PUT         |
| 11  | `features/creator-network/services/mentorshipApi.ts`    | 5     | GET, POST, PUT         |
| 12  | `features/creator-network/services/collaborationApi.ts` | 4     | GET, POST, PUT         |
| 13  | `features/multi-platform/services/analyticsApi.ts`      | 3     | GET                    |

**Tests**: The 89 migrated call sites across 13 files ARE the integration test. If delegation is broken, they all fail. No new unit tests needed for thin wrappers — if a future method gets logic, test it then.

### Workstream 2: Delete queryClient.ts

**Step 1**: Delete `packages/frontend/src/queries/queryClient.ts` (274 lines of dead code, zero importers).

**Step 2**: Delete `packages/frontend/src/queries/` directory if empty after deletion.

**Verification**: `grep -r "queries/queryClient" packages/frontend/src/` returns zero matches (already confirmed).

No CACHE_TIMES extraction — those constants lived in dead code with zero importers. Extracting them into a new file is YAGNI. If a vertical slice needs cache presets, the developer creates them at that point with actual usage context.

### Workstream 3: Redux Slice Audit

**Decision**: Delete `tempStubs.ts`. Defer `unifiedCmsSlice.ts` and `userSlice.ts` to future sprint.

**Rationale**: `tempStubs.ts` exports no-op reducers — every dispatch is silently discarded. The 7 production components importing from it have dead dispatch calls. Deleting it and cleaning consumers is safe and mechanical. `unifiedCmsSlice.ts` is more complex (660 lines, 2 production consumers that read `state.unifiedCms` which is always `undefined` because the reducer is not wired into the store) — migrating it to React Query is a feature, not cleanup. `userSlice` duplicates AuthContext but is harmless. Neither gets TODO comments — either delete them in a future sprint or don't.

**Delete**: `packages/frontend/src/store/slices/tempStubs.ts`

**Update 7 production components** — remove dead dispatch imports:

| File                                                       | Current Import                                  | Action                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `features/content/components/RichTextEditor.tsx`           | `updateCurrentContent` from tempStubs           | Remove import + dispatch call                                                           |
| `features/content/components/PremiumContentPaywall.tsx`    | `supportContent` from tempStubs                 | Remove import + dispatch call                                                           |
| `features/content/components/MarkdownEditor.tsx`           | `updateCurrentContent` from tempStubs           | Remove import + dispatch call                                                           |
| `features/content/components/MediaEmbedder.tsx`            | `addContentBlock`, `uploadMedia` from tempStubs | Remove imports + dispatch calls                                                         |
| `features/content/components/ContentCollectionManager.tsx` | tempStubs imports                               | Remove imports + dispatch calls                                                         |
| `features/content/components/SimpleContentEditor.tsx`      | tempStubs imports                               | Remove imports + dispatch calls                                                         |
| `features/content/components/ContentSeriesBuilder.tsx`     | tempStubs imports                               | Remove imports + dispatch calls (may import symbols that don't even exist in tempStubs) |

**Update 4 test files** — align with real store:

| File                                                | Current Usage                                         | Action                                                         |
| --------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `test-utils/test-providers.tsx`                     | Imports `cmsReducer`, `paymentReducer`, `postReducer` | Remove tempStubs imports; use `reducers` from `store/index.ts` |
| `App.test.tsx`                                      | Imports `paymentReducer`, `postReducer`               | Remove tempStubs imports; use real store                       |
| `pages/Post.test.tsx`                               | Imports `paymentReducer`, `postReducer`               | Remove tempStubs imports; use real store                       |
| `components/__tests__/SimpleContentEditor.test.tsx` | Imports `cmsReducer`                                  | Remove tempStubs import; use real store                        |

**Deferred (no code changes, no TODO comments):**

| File                              | Lines | Issue                                                                                              | Decision                                                    |
| --------------------------------- | ----- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `store/slices/unifiedCmsSlice.ts` | 660   | Server state in Redux (11 async thunks). Not wired into store. 2 consumers read `undefined` state. | Defer — migrating to React Query is a feature, not cleanup  |
| `store/slices/userSlice.ts`       | 33    | Duplicates AuthContext. Rarely used (AuthContext is primary).                                      | Defer — harmless, verify 0 active consumers before deletion |

## Acceptance Criteria

### Workstream 1: apiClient

- [ ] `HttpMethod` union type constrains `request()` method parameter
- [ ] `QueryParams` type alias replaces all `Record<string, ...>` repetitions
- [ ] `response.json() as Promise<T>` makes trust boundary explicit
- [ ] `ApiClient` class has public `get()`, `post()`, `put()`, `delete()` methods
- [ ] Zero bracket-notation call sites remain: `grep -r "apiClient\['request'\]" packages/frontend/src/` returns 0
- [ ] All existing apiClient tests pass
- [ ] TypeScript compilation succeeds with zero new errors vs baseline

### Workstream 2: queryClient.ts

- [ ] `queries/queryClient.ts` deleted
- [ ] `queries/` directory deleted if empty
- [ ] Build succeeds, no runtime errors

### Workstream 3: Redux audit

- [ ] `store/slices/tempStubs.ts` deleted
- [ ] 7 production components updated (dead dispatch calls removed)
- [ ] 4 test files updated (use real store reducers)
- [ ] Build succeeds, existing tests pass

### Cross-cutting

- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] All pre-existing passing tests still pass

## Implementation Phases

### Phase 0: Baseline (5 min)

1. Run `npm run type-check` and record error count — this is the baseline
2. Run test suite and record pass/fail count — this is the baseline

### Phase 1: apiClient Type Safety + Methods + Migration

1. Add `HttpMethod` type, `QueryParams` type alias, fix `as Promise<T>` cast
2. Constrain `request()` method: `method: string` → `method: HttpMethod`
3. Replace all `Record<string, string | number | boolean | undefined>` with `QueryParams`
4. Add 4 public methods (`get`, `post`, `put`, `delete`)
5. Migrate 13 domain API files (one at a time, alphabetically)
6. Run `npm run type-check` after each file
7. Final verification: `grep -r "apiClient\['request'\]" packages/frontend/src/`

### Phase 2: queryClient.ts Deletion

1. Delete `queries/queryClient.ts`
2. Delete `queries/` directory if empty
3. Verify build

### Phase 3: Redux tempStubs Deletion

1. Remove dead dispatch imports from 7 production components
2. Update 4 test files to use real store
3. Delete `tempStubs.ts`
4. Run full test suite, compare to baseline

## Dependencies & Risks

| Risk                                                     | Likelihood | Impact                    | Mitigation                                                       |
| -------------------------------------------------------- | ---------- | ------------------------- | ---------------------------------------------------------------- |
| Argument position mismatch in migration (body vs params) | Medium     | High — wrong API calls    | Migrate per-file, not bulk replace. Review GET vs POST patterns. |
| Test files break after tempStubs deletion                | Certain    | Medium — test suite fails | Update 4 test files in same commit as deletion                   |
| unifiedCmsSlice consumers break if touched               | N/A        | Avoided                   | Explicitly deferred — no changes to unifiedCmsSlice              |
| Hidden dynamic import of queryClient.ts                  | Very Low   | Medium                    | grep confirmed zero; check for `import()` patterns               |
| Pre-existing test failures mask new regressions          | Medium     | Medium                    | Run test suite before AND after changes; compare counts          |

## References

- **Brainstorm**: `docs/brainstorms/2026-02-25-production-roadmap-brainstorm.md` (Sprint 0 Prerequisites table)
- **Story Map**: `docs/planning/story-map-v2-production-roadmap.md` (P0 section)
- **Dead code pattern**: `docs/solutions/infrastructure-issues/dependency-update-pr99-patterns.md` (Section 4: queryClient.ts is dead code)
- **Verified dead**: `docs/solutions/code-quality/p3-dead-code-pom-cleanup-review-sprint-20260224.md` (dead code verification checklist)
- **Query key factories**: `docs/solutions/patterns/common-solutions.md` (#18: TanStack Query key factories)
- **Utility extraction**: `docs/solutions/patterns/common-solutions.md` (#14: shared utility extraction at 3+ copies)

## Files Modified

### New Files

None.

### Modified Files

- `packages/frontend/src/services/api/apiClient.ts` (HttpMethod type, QueryParams type, as Promise<T>, 4 public methods)
- 13 domain API files (bracket notation → public methods)
- 7 production components (remove dead tempStubs imports)
- 4 test files (align with real store)

### Deleted Files

- `packages/frontend/src/queries/queryClient.ts` (274 lines, dead code)
- `packages/frontend/src/store/slices/tempStubs.ts` (112 lines, no-op stubs)
