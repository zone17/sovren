---
status: pending
priority: p1
issue_id: '560'
tags: [code-review, pr-108, data-integrity]
---

# Fix cross-table `.or()` filter and FK hint paths in discovery route

## Problem Statement

The discovery route has two related structural issues with the Supabase/PostgREST query:

1. **Cross-table `.or()` may not work**: The `.or()` filter references `users.display_name` and `users.username`, but PostgREST's `.or()` operates on the primary table (`creator_profiles`). Cross-table column references in `.or()` are not reliably supported.

2. **FK hint path for `creators` table is indirect**: `creator_profiles` has no direct FK to `creators`. The join path is `creator_profiles.creator_id → users.id ← creators.user_id` (two hops through `users`). PostgREST only traverses direct FK relationships. The hint `creators!creators_user_id_fkey` may fail at runtime.

3. **Sort by embedded resource column**: `query.order('creators(follower_count)')` orders nested rows within each parent, NOT the parent rows by the embedded value.

**Flagged by: Architecture Strategist, Data Integrity Guardian, Performance Oracle**

## Findings

- **File**: `packages/backend/src/routes/v2/discovery.routes.ts`, lines 39-82
- **Schema**: `creator_profiles.creator_id → users.id` (direct FK), `creators.user_id → users.id` (direct FK), but NO direct FK between `creator_profiles` and `creators`
- **PostgREST limitation**: Cannot traverse two-hop joins in nested select
- **PostgREST limitation**: `order()` on embedded resources orders nested rows, not parent rows

## Proposed Solutions

**Option A: Database view (Recommended)**
Create a `discovery_creators` view that pre-joins all three tables:

```sql
CREATE VIEW discovery_creators AS
SELECT cp.id, cp.bio, cp.categories, cp.created_at,
  u.display_name, u.username, u.avatar_url, u.nip05_verified,
  COALESCE(c.follower_count, 0) AS follower_count,
  COALESCE(c.content_count, 0) AS content_count,
  c.tags, COALESCE(c.verified, false) AS verified
FROM creator_profiles cp
JOIN users u ON cp.creator_id = u.id
LEFT JOIN creators c ON c.user_id = u.id;
```

Pros: Fixes all 3 issues (cross-table filter, FK hints, sort). Clean query surface. Cons: Requires migration.

**Option B: Two separate queries**
Query `creator_profiles + users` first, then `creators` by user IDs, merge in application code.
Pros: No migration needed. Cons: N+1-ish pattern, more code.

**Option C: Supabase RPC function**
Create a PostgreSQL function that handles the join, filter, sort, and pagination server-side.
Pros: Most powerful, supports full-text search. Cons: Most effort.

## Acceptance Criteria

- [ ] Text search works across bio, display_name, and username
- [ ] `creators` table data (follower_count, tags, verified) is correctly joined
- [ ] Sort by `follower_count` actually sorts the top-level result set
- [ ] Sort by `created_at` works correctly
- [ ] Query tested against real Supabase instance or local Supabase
