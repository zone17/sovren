---
title: 'feat: Discovery MVP — Wire Frontend to Real Backend'
type: feat
date: 2026-02-26
slice: 2
squad: B
sprint: 0
points: 5
---

# feat: Discovery MVP — Wire Frontend to Real Backend

## Overview

Replace hardcoded mock data in the Discovery page with real API calls. The backend has existing services (`content-discovery-service.ts`, `creator-recommendation-service.ts`) but neither serves the public browse use case — a new v2 route is needed that JOINs `users`, `creators`, and `creator_profiles` tables. Single developer, ~1.5 days.

## Problem Statement

`useDiscovery.ts` is 99 lines of hardcoded `MOCK_CREATORS` data with `useState`/`useEffect` and a fake 300ms `setTimeout`. The Discovery page at `/discover` shows static data. Users cannot search, filter, or discover real creators.

## Proposed Solution

1. **Shared types** — `packages/shared/src/types/discovery.ts`
2. **Backend v2 route** — `GET /api/v2/discovery/creators` (public, JOINs 3 tables)
3. **Hook rewrite** — `useDiscovery` from mock data to React Query with inline fetch + debounce

## Architectural Decisions

### AD-1: Backend data source — JOIN across 3 tables

**Decision**: Query `creator_profiles` JOIN `users` (for `display_name`, `username`, `avatar_url`, `nip05_verified`) JOIN `creators` (for `follower_count`, `tags`, `content_count`). Use `optionalAuth` middleware. Public endpoint, no auth required.

**Why**: `creator_profiles` only has `bio`, `categories`, `niche`. Display fields live on `users`, engagement metrics on `creators`. A 3-table JOIN in the route handler is the simplest path — no new service class needed.

### AD-2: CreatorSearchResult — fields from 3 tables

**Decision**: `CreatorSearchResult` maps across tables:

- From `users`: `displayName`, `username`, `avatarUrl`, `nip05Verified`
- From `creators`: `followerCount`, `contentCount`, `tags`, `verified`
- From `creator_profiles`: `bio`, `categories`
- Computed: `id` (creator_profiles.id), `createdAt`

**Why**: No `postCount` column exists — use `creators.content_count` as `contentCount`. No `subscription_tiers` or `featured_content_title` — too expensive for Sprint 0.

### AD-3: Categories — hardcoded for Sprint 0

Keep the current 9 hardcoded categories in the frontend. The `categories` column on `creator_profiles` stores the actual values.

### Other decisions (Sprint 0 scope)

- **Sort**: `relevance` (default), `followers`, `newest`. No `earnings` sort.
- **Pagination**: `useQuery` with page state + manual array accumulation for "Load More". Page size = 20.
- **View Profile**: Disabled button with "Coming Soon" text.
- **Debounce**: `useDebouncedValue(query, 300)` + `placeholderData: keepPreviousData`. `enabled: debouncedQuery.length === 0 || debouncedQuery.length >= 2` to avoid API spam.
- **URL state**: React state only. No `useSearchParams`.
- **Auth**: No differentiation. Anonymous and authenticated see same results.

## Technical Approach

### Phase 1: Shared Types + Backend Route

##### `packages/shared/src/types/discovery.ts`

```typescript
// Creator search result — JOINs users + creators + creator_profiles
export interface CreatorSearchResult {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
  nip05Verified: boolean;
  categories: string[];
  tags: string[];
  followerCount: number;
  contentCount: number;
  verified: boolean;
  createdAt: string;
}

export interface DiscoveryFilters {
  query?: string;
  category?: string;
  sortBy?: 'relevance' | 'followers' | 'newest';
  page?: number;
  limit?: number;
}

export interface DiscoveryResponse {
  creators: CreatorSearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

##### `packages/backend/src/routes/v2/discovery.routes.ts`

- `GET /api/v2/discovery/creators` — public, `optionalAuth`, `readOnlyRateLimiter`
- Query params: `q`, `category`, `sort` (relevance|followers|newest), `page`, `limit`
- Zod validation schema for query params
- **3-table JOIN** (this is the critical fix from review):
  ```sql
  SELECT cp.id, u.display_name, u.username, u.avatar_url, u.nip05_verified,
         cp.bio, cp.categories, c.tags, c.follower_count, c.content_count,
         c.verified, cp.created_at
  FROM creator_profiles cp
  JOIN users u ON u.id = cp.creator_id
  JOIN creators c ON c.user_id = cp.creator_id
  ```
- Text search on `u.display_name`, `u.username`, `cp.bio` (ilike)
- Category filter via `cp.categories` array overlap (`@>`)
- Sort mapping: `relevance` → `c.follower_count DESC` (no engagement_score column), `followers` → `c.follower_count DESC`, `newest` → `cp.created_at DESC`
- Response: `createApiResponse({ data: { creators, pagination } })`

**Register route** in `packages/backend/src/routes/v2/index.ts`.

**Reference**: `packages/backend/src/routes/v2/wellness.routes.ts` (DI, rate limiting, asyncHandler, createApiResponse)

**Success criteria:**

- [x] Shared types importable from both frontend and backend
- [x] `GET /api/v2/discovery/creators` returns paginated creator data from 3-table JOIN
- [x] Text search, category filter, and sort all work
- [x] Rate limited with `readOnlyRateLimiter`

### Phase 2: Frontend Hook Rewrite + Component Updates

##### Rewrite `packages/frontend/src/features/discovery/hooks/useDiscovery.ts`

Delete all mock data. Inline the fetch in `queryFn` (no separate `discoveryApi.ts` — one method doesn't warrant a file):

```typescript
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import apiClient from '@/services/api/apiClient';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { DiscoveryFilters, DiscoveryResponse } from '@shared/types/discovery';
import type { ApiResponse } from '@shared/types/api';

export function useDiscovery() {
  const [filters, setFilters] = useState<DiscoveryFilters>({ sortBy: 'relevance' });
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(filters.query ?? '', 300);

  const effectiveFilters = { ...filters, query: debouncedQuery || undefined, page };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['discovery', 'creators', effectiveFilters],
    queryFn: () =>
      apiClient.get<ApiResponse<DiscoveryResponse>>('/api/v2/discovery/creators', effectiveFilters),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: !debouncedQuery || debouncedQuery.length >= 2,
  });

  // Partial update: merge new filters with existing, reset page
  const updateFilters = (patch: Partial<DiscoveryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  return {
    creators: data?.data?.creators ?? [],
    pagination: data?.data?.pagination,
    filters,
    updateFilters,
    page,
    setPage,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
```

##### Create `packages/frontend/src/hooks/useDebouncedValue.ts` (if not exists)

```typescript
import { useState, useEffect } from 'react';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

##### Update `packages/frontend/src/features/discovery/types/index.ts`

```typescript
export type {
  CreatorSearchResult,
  DiscoveryFilters,
  DiscoveryResponse,
} from '@shared/types/discovery';

export const CATEGORIES = [
  'All',
  'Art',
  'Writing',
  'Music',
  'Podcast',
  'Education',
  'Photography',
  'Development',
  'Bitcoin',
] as const;
```

##### Update `DiscoveryPage.tsx`

- Use `CreatorSearchResult` instead of `DiscoveryCreator`
- Use `updateFilters` (partial merge) instead of `setFilters` (full replace)
- Add "Try Again" button in error state calling `refetch()`
- Add "Load More" button when `pagination.page < pagination.totalPages`
- Show subtle `isFetching` indicator (not full spinner) during subsequent queries

##### Update `CreatorCard.tsx`

- Props: `CreatorSearchResult` (drop `subscription_tiers`, use `contentCount` not `postCount`)
- "View Profile" button: `disabled`, text → "Coming Soon"
- Show `categories` tags instead of subscription pricing

**Success criteria:**

- [x] `useDiscovery` returns real data from API (zero mock data)
- [x] Search debounces at 300ms, `enabled` guard prevents <2 char queries
- [x] Previous results stay visible during loading (`keepPreviousData`)
- [x] `updateFilters` does partial merge + resets page
- [x] "Load More" button appears when more pages exist
- [x] "View Profile" button disabled with "Coming Soon"

### Phase 3: Tests

##### Hook unit tests: `useDiscovery.test.ts`

- MSW v2 handlers for `GET /api/v2/discovery/creators`
- Test QueryClient with `retry: false`, `retryDelay: 0`
- 4 tests: renders creators on mount, debounces search, handles error, handles empty results

**Reference**: `packages/frontend/src/features/wellness/hooks/__tests__/` (MSW v2 pattern)

##### Component tests updates

- `DiscoveryPage.test.tsx` — Mock `useDiscovery` returning real-shaped data
- `CreatorCard.test.tsx` — `CreatorSearchResult` props, disabled "Coming Soon" button

##### E2E: `packages/frontend/e2e/pages/discovery.page.ts`

```typescript
import type { Locator, Page } from '@playwright/test';

export class DiscoveryPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly creatorCard: Locator;
  readonly loadMoreButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /discover/i }).first();
    this.searchInput = page.getByPlaceholder(/search/i);
    this.creatorCard = page.getByRole('article').first();
    this.loadMoreButton = page.getByRole('button', { name: /load more/i });
  }

  async goto() {
    await this.page.goto('/discover');
  }
}
```

##### E2E spec: `packages/frontend/e2e/discovery.public.spec.ts`

3 tests: displays creator cards, search filters results, category filter works.

**Success criteria:**

- [x] Hook unit tests pass with MSW v2 handlers
- [x] Component tests updated for new types
- [x] E2E test passes — creator cards render with real data

## Acceptance Criteria

- [x] Discovery page at `/discover` shows real creators from 3-table JOIN
- [x] Search debounces at 300ms, `enabled` guard prevents <2 char queries
- [x] Category filter and sort dropdown work
- [x] "Load More" button loads next page
- [x] "View Profile" button disabled with "Coming Soon"
- [x] Error state with "Try Again", empty state with "No creators found"
- [x] Rate limited (`readOnlyRateLimiter`)
- [x] Zero `any` types, shared types used by both layers
- [x] Hook unit tests + component tests + E2E pass
- [x] CHANGELOG.md updated

## Dependencies & Risks

- **Prerequisite**: `apiClient.get()` must work with typed params (Sprint 0 P0)
- **Empty database**: Seed at least 10 test creators across all 3 tables
- **Schema**: Route uses 3-table JOIN (`creator_profiles` + `users` + `creators`). If any table lacks rows for a creator, that creator won't appear. Use LEFT JOINs for optional fields.
- **Sort**: `follower_count` index may be needed on `creators` table

## Files Summary

### Create

| File                                                 | Purpose                              |
| ---------------------------------------------------- | ------------------------------------ |
| `packages/shared/src/types/discovery.ts`             | Type contract                        |
| `packages/backend/src/routes/v2/discovery.routes.ts` | Public creator search (3-table JOIN) |
| `packages/frontend/src/hooks/useDebouncedValue.ts`   | Reusable debounce hook               |
| `packages/frontend/e2e/pages/discovery.page.ts`      | POM (4 locators)                     |
| `packages/frontend/e2e/discovery.public.spec.ts`     | E2E spec (3 tests)                   |

### Modify

| File                                                                    | Change                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------- |
| `packages/frontend/src/features/discovery/hooks/useDiscovery.ts`        | Full rewrite: mock → React Query with inline fetch |
| `packages/frontend/src/features/discovery/types/index.ts`               | Re-export shared types                             |
| `packages/frontend/src/features/discovery/components/DiscoveryPage.tsx` | New types, retry, load more, `updateFilters`       |
| `packages/frontend/src/features/discovery/components/CreatorCard.tsx`   | New types, disabled profile link                   |
| `packages/backend/src/routes/v2/index.ts`                               | Register discovery routes                          |
| Component test files                                                    | Update for new types + disabled button             |

## References

- Story map: `docs/planning/story-map-v2-production-roadmap.md` (Slice 2)
- V2 route pattern: `packages/backend/src/routes/v2/wellness.routes.ts`
- Wellness hook pattern: `packages/frontend/src/features/wellness/hooks/useWellnessPatterns.ts`
- E2E POM pattern: `packages/frontend/e2e/pages/wellness.page.ts`
- Critical patterns: `docs/solutions/patterns/critical-patterns.md`
- Common solutions: `docs/solutions/patterns/common-solutions.md`
- Schema: `supabase/migrations/20240201000000_additional_tables.sql` (creator_profiles line 1256, creators line 1236, users line 47)

### Key Learnings to Apply

- Test QueryClient needs `retryDelay: 0` for error-state tests
- E2E must not use `page.route()` — real API calls only (common-solutions #26)
- `placeholderData: keepPreviousData` for smooth debounce UX
- `enabled` guard to avoid API spam on short queries
- Import path: `@shared/types/discovery` NOT `@sovren/shared`
- `ApiResponse<T>` wrapper on all apiClient returns
