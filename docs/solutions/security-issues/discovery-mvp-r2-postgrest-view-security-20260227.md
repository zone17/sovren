---
title: Discovery MVP R2 Remediation — PostgREST Filter Injection & VIEW Security
date: '2026-02-27'
category: security-issues
tags:
  - code-review
  - security
  - postgrest
  - postgresql
  - react-query
  - accessibility
  - type-safety
  - discovery
module: discovery
symptoms:
  - PostgREST filter injection via unescaped metacharacters
  - Admin/inactive users exposed in discovery VIEW
  - Stale search results when switching filters
  - Runtime null crashes on missing displayName/bio
severity: P1
sprint: discovery-mvp-r2
pr: 108
commit: 9fc2f5d
---

# Discovery MVP R2 Remediation — PostgREST Filter & VIEW Security

## Problem Statement

PR #108 (Discovery MVP) passed round-1 review (18 findings fixed) but round-2 review by 10+ parallel agents found 14 additional findings: 2 P1 (security), 7 P2 (type safety, performance, UX), 5 P3 (accessibility, cleanup). The two P1s were filter injection and VIEW information disclosure — both exploitable in production.

## Findings Summary

| Severity | Count | Findings                                                                                      |
| -------- | ----- | --------------------------------------------------------------------------------------------- |
| P1       | 2     | #580 (PostgREST filter escape), #581 (VIEW security_barrier)                                  |
| P2       | 7     | #582-#588 (duplicate types, shared imports, indexes, COALESCE, keepPreviousData, error cause) |
| P3       | 5     | #589-#593 (pagination UX, aria-live, fake timers, displayName fallback, React imports)        |

## Root Causes

### P1 #580: PostgREST Filter Injection

`escapePostgrestFilter()` only escaped `,.*()` but missed 5 metacharacters:

- `%` and `_` — SQL LIKE wildcards (attacker can broaden searches)
- `\` — escape character itself (double-escaping bug)
- `:` and `"` — PostgREST operator delimiters (attacker can inject operators)

**Order matters**: backslash must be escaped first, otherwise `\,` becomes `\\,` then `\\\\,`.

### P1 #581: VIEW Without Security Barrier

`discovery_creators` VIEW had no `security_barrier` and no `WHERE` clause — exposed admin accounts and inactive/banned users. Views bypass RLS, so `security_barrier = true` is required to prevent the query planner from pushing user-supplied predicates past the WHERE clause.

### P2 #587: keepPreviousData Stale Results

`keepPreviousData` applied unconditionally showed stale results when switching category/search filters. It's a UX optimization only for pagination (show page N-1 while page N loads), not for filter changes where users expect fresh results.

## Working Solutions

### 1. PostgREST Filter Escape — Complete Metacharacter Coverage

```typescript
// packages/backend/src/routes/v2/discovery.routes.ts
export function escapePostgrestFilter(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // backslash FIRST
    .replace(/[,.*():%"_]/g, '\\$&'); // then all metacharacters
}
```

**Test payloads** added: `100%` → `100\%`, `a_b` → `a\_b`, `a\\b` → `a\\\\b`, `a:b` → `a\:b`, `a"b` → `a\"b`, `bio.ilike.%test%,other` → fully escaped.

### 2. VIEW Security Barrier + Active User Filter + COALESCE

```sql
-- supabase/migrations/20260227000000_add_discovery_creators_view.sql
CREATE OR REPLACE VIEW discovery_creators WITH (security_barrier = true) AS
SELECT
  cp.id,
  COALESCE(cp.bio, '') AS bio,
  COALESCE(cp.categories, ARRAY[]::text[]) AS categories,
  cp.created_at,
  u.id AS user_id,
  COALESCE(u.display_name, u.username, 'Anonymous') AS display_name,
  COALESCE(u.username, '') AS username,
  u.avatar_url,
  COALESCE(u.nip05_verified, false) AS nip05_verified,
  COALESCE(c.follower_count, 0) AS follower_count,
  COALESCE(c.content_count, 0) AS content_count,
  COALESCE(c.tags, ARRAY[]::text[]) AS tags,
  COALESCE(c.verified, false) AS verified
FROM creator_profiles cp
INNER JOIN users u ON cp.creator_id = u.id
LEFT JOIN creators c ON c.user_id = u.id
WHERE u.status = 'active'
  AND u.role != 'admin';

GRANT SELECT ON discovery_creators TO anon, authenticated;
```

### 3. keepPreviousData Gate — Pagination Only

```typescript
// packages/frontend/src/features/discovery/hooks/useDiscovery.ts
const prevPageRef = useRef(page);
const isPageChange = prevPageRef.current !== page;
prevPageRef.current = page;

const { data } = useQuery({
  queryKey: ['discovery', 'creators', effectiveFilters],
  queryFn: () => apiClient.get<ApiResponse<DiscoveryResponse>>(...),
  placeholderData: isPageChange ? keepPreviousData : undefined,
  staleTime: 60_000,
  enabled: !debouncedQuery || debouncedQuery.length >= 2,
});
```

### 4. pg_trgm Indexes for Text Search

```sql
-- supabase/migrations/20260227000001_add_discovery_indexes.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_bio_trgm ON creator_profiles USING gin (bio gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_creators_follower_count_desc ON creators (follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_created_at_desc ON creator_profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_categories_gin ON creator_profiles USING gin (categories);
```

### 5. Error Cause Sanitization

```typescript
// Before (leaks internals):
throw new ServiceError('Discovery search failed', { cause: error });

// After (log internally, throw clean):
logger.error('Discovery search failed', { error: String(error) });
throw new ServiceError('Discovery search failed');
```

### 6. Shared Type Reuse

```typescript
// packages/shared/src/types/discovery.ts
import type { Pagination } from './provenance';

export interface CreatorSearchResult {
  categories: DiscoveryCategory[]; // was string[]
  // ...
}

export interface DiscoveryFilters {
  category?: DiscoveryCategory; // was string
  // ...
}

export interface DiscoveryResponse {
  creators: CreatorSearchResult[];
  pagination: Pagination; // was inline duplicate
}
```

## Prevention Strategies

### PostgREST Security Checklist

- [ ] `escapePostgrestFilter()` escapes ALL metacharacters: `\ , . * ( ) : % " _`
- [ ] Backslash escaped FIRST (before other characters)
- [ ] Test payloads include: `%`, `_`, `\`, `:`, `"`, combined `bio.ilike.%test%,other`
- [ ] No user input passed directly to `.or()`, `.filter()`, or `.contains()` without escaping

### VIEW Security Checklist

- [ ] `WITH (security_barrier = true)` on every public-facing VIEW
- [ ] `WHERE status = 'active'` (or equivalent) to exclude deactivated accounts
- [ ] `AND role != 'admin'` to exclude privileged accounts from public discovery
- [ ] COALESCE all nullable columns with sensible defaults
- [ ] GRANT only SELECT to `anon, authenticated` (not INSERT/UPDATE/DELETE)
- [ ] Comment explaining security rationale

### Discovery Feature Checklist

- [ ] Text search columns have pg_trgm GIN indexes
- [ ] Sort columns have B-tree indexes (DESC for most-recent-first)
- [ ] Array filter columns have GIN indexes
- [ ] keepPreviousData gated by useRef (pagination only, not filters)
- [ ] Debounced search with minimum length check (enabled condition)
- [ ] aria-live region announces result count changes
- [ ] Pagination wrapped in `<nav aria-label="Pagination">`
- [ ] Pagination buttons disabled during isFetching
- [ ] All display fields have null/empty fallbacks

## Impact

- **9 files changed**, +106/-51 lines
- **62 tests pass** (20 backend + 37 frontend + 5 debounce)
- **2 security vulnerabilities closed** (filter injection + information disclosure)
- **0 runtime null crashes** (COALESCE + frontend fallbacks)

## Cross-References

- PR #108: https://github.com/zone17/sovren/pull/108
- Related: critical-patterns.md #6 (SSRF validation — similar input sanitization class)
- Related: critical-patterns.md #2 (Authorization — VIEW bypasses RLS like missing auth checks)
- Related: common-solutions.md #7 (Table-aware Supabase mocks)
- Related: common-solutions.md #24 (Error class selection — bare Error vs ServiceError)
- Related: common-solutions.md #34 (React effects with fake timers)
- Related: docs/solutions/security-issues/pr91-ssrf-ipv4compat-dns-toctou-20260221.md (input sanitization patterns)
- Plan: docs/plans/2026-02-26-feat-discovery-mvp-squad-b-sprint-0-plan.md

## Key Insights

1. **Escape the escape character first** — backslash before all other metacharacters prevents double-escaping.
2. **Views bypass RLS** — `security_barrier = true` is the Postgres mechanism to prevent predicate pushdown past your WHERE clause.
3. **Fix nullability at the data layer** — one COALESCE in SQL prevents N null checks in TypeScript.
4. **keepPreviousData is a pagination optimization, not a universal default** — gate it on the change type.
5. **Two review rounds caught 32 total findings** (18 R1 + 14 R2) — the second round is never redundant.
6. **Error objects are not safe to serialize** — always log full errors internally, throw sanitized messages to consumers.
