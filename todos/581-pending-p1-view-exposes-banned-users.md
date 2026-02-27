---
status: pending
priority: p1
issue_id: '581'
tags: [code-review, pr-108, security, data-integrity, database]
---

# VIEW exposes suspended/banned/admin users to anonymous callers

## Problem Statement

The `discovery_creators` VIEW joins `users` without filtering by status. Users with `status = 'suspended'`, `'banned'`, or `role = 'admin'` appear in anonymous search results. The VIEW bypasses RLS on the `users` table (which has `users_select_public_or_own` policy). No `security_barrier` attribute is set.

**Flagged by: Security Sentinel, Data Integrity Guardian, Architecture Strategist**

## Findings

- `20260227000000_add_discovery_creators_view.sql`: No WHERE clause on user status
- `users` table has RLS enabled with `users_select_public_or_own` policy — VIEW bypasses it
- `GRANT SELECT ... TO anon` means direct PostgREST access (bypassing Express middleware) is possible
- No `security_barrier` attribute to prevent predicate pushdown side-channels

## Proposed Solutions

```sql
CREATE OR REPLACE VIEW discovery_creators
WITH (security_barrier = true) AS
SELECT
  cp.id, cp.bio, cp.categories, cp.created_at,
  u.id AS user_id, u.display_name, u.username, u.avatar_url, u.nip05_verified,
  COALESCE(c.follower_count, 0) AS follower_count,
  COALESCE(c.content_count, 0) AS content_count,
  COALESCE(c.tags, ARRAY[]::text[]) AS tags,
  COALESCE(c.verified, false) AS verified
FROM creator_profiles cp
INNER JOIN users u ON cp.creator_id = u.id
LEFT JOIN creators c ON c.user_id = u.id
WHERE u.status = 'active' AND u.role != 'admin';
```

Add security decision comment block documenting that all VIEW columns are intentionally public.

## Acceptance Criteria

- [ ] VIEW filters to active, non-admin users only
- [ ] `security_barrier = true` added to VIEW
- [ ] Security decision documented in migration comment
