---
title: 'fix: PR #108 Discovery MVP Remediation'
type: fix
date: 2026-02-27
pr: 108
branch: feat/squad-b/SOV-107-discovery-mvp
findings: 21
---

# fix: PR #108 Discovery MVP Remediation

## Overview

Triage and fix all 21 findings (#559–#579) from the 10-agent code review of PR #108 (Discovery MVP). The findings span security (PostgREST injection), data integrity (broken cross-table joins), architecture (missing service layer, error handling), frontend UX (pagination bug), and test coverage gaps.

## Triage

Based on prior remediation sprint patterns (76% stale rate on old todos, triage-first saves 40% effort), classify each finding before coding:

| #   | Todo                                  | Severity | Verdict      | Rationale                                                        |
| --- | ------------------------------------- | -------- | ------------ | ---------------------------------------------------------------- |
| 559 | PostgREST filter injection            | P1       | **DO**       | 9/9 consensus, public endpoint, OWASP injection                  |
| 560 | Cross-table `.or()` + FK hints + sort | P1       | **DO**       | Likely broken at runtime — needs DB view                         |
| 561 | Manual error response                 | P1       | **DO**       | Quick fix, 4/9 consensus, consistency                            |
| 562 | `row: any` type assertion             | P1       | **DO**       | 5/9 consensus, zero-any standard                                 |
| 563 | Load More replaces results            | P2       | **DO**       | 6/9 consensus, UX bug — rename to "Next Page" for Sprint 0       |
| 564 | Wrong rate limiter                    | P2       | **DO**       | 1-line fix, security defense-in-depth                            |
| 565 | Category not validated as enum        | P2       | **DO**       | Quick Zod enum, prevents enumeration                             |
| 566 | Category active-state logic           | P2       | **DO**       | Extract `isActive` variable, 3 agents                            |
| 567 | Relevance sort = followers            | P2       | **DO**       | Collapse to if/else, document                                    |
| 568 | No service layer                      | P2       | **DEFERRED** | Acceptable for Sprint 0 per plan AD; extract in Sprint 1         |
| 569 | Pagination missing hasNext/hasPrev    | P2       | **DO**       | Consistency with canonical Pagination type                       |
| 570 | Query key factory + unstable ref      | P2       | **DO**       | Create factory, useMemo for effectiveFilters                     |
| 571 | Missing backend route tests           | P2       | **DO**       | 0% coverage on new route                                         |
| 572 | Missing debounce + hook tests         | P2       | **DO**       | 0% coverage on new shared hook                                   |
| 573 | LEFT JOIN ghost records               | P2       | **DO**       | Filter nulls, add createdAt guard                                |
| 574 | sortBy/sort naming mismatch           | P2       | **DO**       | Rename Zod field to `sortBy` to match shared type                |
| 575 | Accessibility gaps                    | P3       | **DO**       | Quick: role="status" on fetching, remove redundant aria-disabled |
| 576 | E2E test gaps                         | P3       | **DEFERRED** | E2E locators depend on #560 (DB view may change rendered data)   |
| 577 | Avatar lazy loading                   | P3       | **DO**       | 1-line `loading="lazy"` + width/height                           |
| 578 | BrowserRouter wrapper in tests        | P3       | **DO**       | Dead test infra cleanup                                          |
| 579 | Misleading comment + cleanup          | P3       | **DO**       | Fix comment, document creator ID                                 |

**Summary: 18 DO, 2 DEFERRED, 1 tracked issue (service layer)**

## Technical Approach

### Architecture Decision: Database View for Discovery

Finding #560 reveals the root structural issue — the 3-table nested select with two-hop joins doesn't work reliably in PostgREST. The fix is a **`discovery_creators` database view** that pre-joins `creator_profiles`, `users`, and `creators`. This resolves:

- Cross-table `.or()` filter (columns become top-level)
- FK hint path issue (no nested select needed)
- Sort by embedded resource (columns are top-level)
- Ghost records (#573 — use INNER JOIN in the view)

This is the first database view in the project. Migration: `20260227000000_add_discovery_creators_view.sql`

### Implementation Phases

Work is grouped by **domain** to minimize merge conflicts (validated across 8 consecutive sprints):

#### Phase 1a: Database Migration + Structural Rewrite (P1s)

_Structural changes — migration, query rewrite, error handling, injection fix_

- [x] **Create migration** `supabase/migrations/20260227000000_add_discovery_creators_view.sql`

  ```sql
  CREATE OR REPLACE VIEW discovery_creators AS
  SELECT
    cp.id,
    cp.bio,
    cp.categories,
    cp.created_at,
    u.id AS user_id,
    u.display_name,
    u.username,
    u.avatar_url,
    u.nip05_verified,
    COALESCE(c.follower_count, 0) AS follower_count,
    COALESCE(c.content_count, 0) AS content_count,
    COALESCE(c.tags, ARRAY[]::text[]) AS tags,
    COALESCE(c.verified, false) AS verified
  FROM creator_profiles cp
  INNER JOIN users u ON cp.creator_id = u.id
  LEFT JOIN creators c ON c.user_id = u.id;

  -- CRITICAL: Views don't inherit RLS. Grant access for PostgREST roles.
  GRANT SELECT ON discovery_creators TO anon, authenticated;
  ```

- [x] **Rewrite `discovery.routes.ts`** — structural changes:
  - **#559**: Inline `escapePostgrestFilter()` — replace `,`, `.`, `(`, `)`, `*` with escaped equivalents via `.replace(/[,.*()]/g, '\\$&')`. Add Zod `.min(2).max(100)` on `q`
  - **#560**: Query `discovery_creators` instead of nested select — flat columns, no FK hints
  - **#561**: Replace manual error JSON with `throw new ServiceError('Discovery search failed')`
  - **#562**: Define `DiscoveryCreatorRow` interface matching view columns (post-COALESCE types — no nulls on follower_count, content_count, tags, verified):
    ```typescript
    interface DiscoveryCreatorRow {
      id: string;
      bio: string;
      categories: string[];
      created_at: string;
      user_id: string;
      display_name: string;
      username: string;
      avatar_url: string | null;
      nip05_verified: boolean;
      follower_count: number;
      content_count: number;
      tags: string[];
      verified: boolean;
    }
    ```
  - **#573**: INNER JOIN in view eliminates ghost records; add `createdAt` null guard

#### Phase 1b: Behavioral Fixes in Backend Route (P2s)

_Behavioral changes on top of the rewritten route_

- [x] **Continue `discovery.routes.ts`** — behavioral fixes:
  - **#564**: Switch to `expensiveOperationRateLimiter`
  - **#565**: Change `category` to `z.enum(['Art','Writing','Music','Podcast','Education','Photography','Development','Bitcoin'])` — 8 real categories, NO "All" (that's UI-only)
  - **#567**: Collapse sort switch to `if (sortBy === 'newest') ... else ...`
  - **#569**: Add `hasNext` and `hasPrev` to pagination response (reuse canonical pattern: `hasNext: page < totalPages, hasPrev: page > 1`)
  - **#574**: Rename Zod field from `sort` to `sortBy` to match shared type
  - **#579**: Fix misleading comment about createApiResponse

- [x] **Update shared types** `packages/shared/src/types/discovery.ts`:
  - Add `hasNext: boolean` and `hasPrev: boolean` to pagination (reuse canonical `Pagination` type from `@shared/types/index.ts` if compatible, otherwise extend inline)
  - Add `DISCOVERY_CATEGORIES` array to shared package (8 real categories, without "All")

**Files touched (Phase 1a + 1b):**

- `supabase/migrations/20260227000000_add_discovery_creators_view.sql` (new)
- `packages/backend/src/routes/v2/discovery.routes.ts`
- `packages/shared/src/types/discovery.ts`

#### Phase 2: Frontend Fixes (P2s + P3s)

_Independent of backend — no conflict risk_

- [x] **#563**: Rename "Load More" to "Next Page", add "Previous Page" button
  - Simple pagination UI: `setPage(page - 1)` / `setPage(page + 1)`
  - Show page indicator: "Page {page} of {totalPages}"
  - "Previous Page" disabled/hidden on page 1; "Next Page" disabled when `!hasNext`
  - `DiscoveryPage.tsx`

- [x] **#566**: Extract `isActive` variable for category highlighting

  ```typescript
  const isActive = category === 'All' ? !filters.category : filters.category === category;
  ```

  - `DiscoveryPage.tsx`, lines 54-61

- [x] **#570**: Wrap `effectiveFilters` in `useMemo` to stabilize React Query key reference

  ```typescript
  const effectiveFilters = useMemo(
    () => ({ ...filters, query: debouncedQuery || undefined, page }),
    [filters, debouncedQuery, page]
  );
  ```

  - `useDiscovery.ts` (query key factory deferred — useMemo is sufficient for Sprint 0)

- [x] **#575**: Add `role="status"` to fetching indicator; remove redundant `aria-disabled`
  - `DiscoveryPage.tsx`, line 126 (fetching div)
  - `CreatorCard.tsx`, line 88 (remove `aria-disabled="true"`)

- [x] **#577**: Add `loading="lazy"` and `width={56} height={56}` to avatar `<img>`
  - `CreatorCard.tsx`, lines 19-23

- [x] **Update `useDiscovery.ts` API param**: Change `sort: effectiveFilters.sortBy` to `sortBy: effectiveFilters.sortBy` to match renamed Zod field from #574

- [x] **Update frontend `types/index.ts`**: Import `DISCOVERY_CATEGORIES` from shared, prepend "All" locally:
  ```typescript
  import { DISCOVERY_CATEGORIES } from '@shared/types/discovery';
  export const CATEGORIES = ['All', ...DISCOVERY_CATEGORIES] as const;
  ```

**Files touched:**

- `packages/frontend/src/features/discovery/components/DiscoveryPage.tsx`
- `packages/frontend/src/features/discovery/components/CreatorCard.tsx`
- `packages/frontend/src/features/discovery/hooks/useDiscovery.ts`
- `packages/frontend/src/features/discovery/types/index.ts`

#### Phase 3: Test Coverage (P2s + P3s)

_Depends on Phase 1 + 2 being complete_

- [x] **#571**: Create `packages/backend/src/routes/v2/__tests__/discovery.routes.test.ts`
  - Test valid search returns correct response shape
  - Test Zod validation rejects invalid params (bad category, q too long, "All" rejected)
  - Test `escapePostgrestFilter()` escapes `,`, `.`, `(`, `)`, `*` metacharacters
  - Test empty results return pagination with `hasNext: false`
  - Test error handling throws ServiceError
  - Test sort + category filter behavior
  - Mock `getDatabase().client` with table-aware routing (common-solutions #7)

- [x] **#572**: Create `packages/frontend/src/hooks/__tests__/useDebouncedValue.test.ts`
  - Test debounce delays value update
  - Test cleanup on unmount clears timeout
  - Test immediate value when delay is 0
  - Add to `useDiscovery.test.tsx`: 1-char query doesn't trigger fetch
  - Add `staleTime: 0` to test QueryClient

- [x] **#578**: Clean up `CreatorCard.test.tsx`
  - Remove `vi.mock('react-router-dom')` and `mockNavigate`
  - Remove `renderWithRouter` — use plain `render()`
  - Remove "navigates to creator profile" test (button removed)
  - Remove "does not render View Profile button" test (dead assertion)
  - Update remaining tests to not use router wrapper

- [x] **Update `DiscoveryPage.test.tsx`**: Update for "Next Page" / "Previous Page" button names

**Files touched:**

- `packages/backend/src/routes/v2/__tests__/discovery.routes.test.ts` (new)
- `packages/frontend/src/hooks/__tests__/useDebouncedValue.test.ts` (new)
- `packages/frontend/src/features/discovery/hooks/__tests__/useDiscovery.test.tsx`
- `packages/frontend/src/features/discovery/components/__tests__/CreatorCard.test.tsx`
- `packages/frontend/src/features/discovery/components/__tests__/DiscoveryPage.test.tsx`

### Deferred Items

| Todo | Reason                                                               | Track    |
| ---- | -------------------------------------------------------------------- | -------- |
| #568 | Service layer extraction — acceptable Sprint 0 tech debt per plan AD | Sprint 1 |
| #576 | E2E POM locators depend on final DB-driven rendering                 | Sprint 1 |

## Reference Patterns

| Pattern                                                         | Source                                                                 | Applies to |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| `throw new ServiceError(...)`                                   | `packages/backend/src/utils/errors.ts:23`                              | #561       |
| `expensiveOperationRateLimiter`                                 | `packages/backend/src/middleware/rate-limit-middleware.ts:118`         | #564       |
| `hasNext: page < totalPages`                                    | `packages/backend/src/services/distribution/UnifiedInboxService.ts:91` | #569       |
| Zod enum validation                                             | `packages/backend/src/routes/v2/circles.routes.ts`                     | #565       |
| Query key factory                                               | `packages/frontend/src/services/nostr/hooks/useEventCache.ts`          | #570       |
| Table-aware mock routing                                        | common-solutions.md #7                                                 | #571       |
| `staleTime: 0` in test QueryClient                              | common-solutions.md #34                                                | #572       |
| `escapePostgrestFilter()` inline `.replace(/[,.*()]/g, '\\$&')` | PostgREST docs: filter syntax                                          | #559       |

## Acceptance Criteria

### Functional

- [ ] Discovery endpoint returns creators from `discovery_creators` view
- [ ] Text search works across bio, display_name, and username (flat columns)
- [ ] Sort by follower_count and created_at works on top-level columns
- [ ] Pagination includes `hasNext` and `hasPrev`
- [ ] Category validated against enum allowlist
- [ ] Rate limiter set to expensiveOperationRateLimiter
- [ ] "Next Page" / "Previous Page" replaces "Load More"
- [ ] Avatar images lazy-loaded with explicit dimensions

### Security

- [ ] `q` parameter sanitized — PostgREST metacharacters escaped
- [ ] `q` length constrained to 2–100 characters
- [ ] No `any` types in row mapping
- [ ] Error responses use centralized middleware with requestId

### Testing

- [ ] Backend route tests: ≥5 test cases covering validation, search, pagination, errors
- [ ] `useDebouncedValue` tests: ≥3 test cases
- [ ] `useDiscovery` debounce/enabled guard tested
- [ ] CreatorCard tests cleaned up (no dead router mocks)
- [ ] All existing tests pass

### Quality Gates

- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] All tests pass (`npm test`)
- [ ] Zero `any` types in changed files

## Risk Analysis

| Risk                                            | Severity | Mitigation                                          |
| ----------------------------------------------- | -------- | --------------------------------------------------- |
| DB view migration fails on real Supabase        | Medium   | Test with `supabase db reset` locally first         |
| Cross-table search needs RLS policy for anon    | Medium   | Verify view inherits RLS or add explicit policy     |
| Phase 3 tests break due to Phase 1 API changes  | Low      | Tests written after route rewrite                   |
| CATEGORIES enum breaks if DB has unknown values | Low      | Backend returns 400 on invalid; frontend unaffected |
