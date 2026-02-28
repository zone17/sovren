---
status: complete
priority: p2
issue_id: 597
tags: [code-review, testing, security]
dependencies: []
---

# Fix auth.uid() Stub to Return NULL Instead of Nil UUID

## Problem Statement

The Supabase `auth.uid()` stub in testcontainers setup returns a nil UUID (`00000000-0000-0000-0000-000000000000`) when no JWT claim is set. Real Supabase returns `NULL`. This means RLS policies using `user_id = auth.uid()` behave differently in tests vs production — `NULL = anything` is `FALSE` in SQL, but nil UUID could accidentally match a test row.

**Why it matters:** Integration tests for RLS or authorization could give false confidence.

## Findings

- **security-sentinel** flagged as LOW (test fidelity issue)

## Proposed Solutions

### Solution A: Return NULL (Recommended)

```sql
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT current_setting('request.jwt.claim.sub', true)::uuid;
$$ LANGUAGE sql STABLE;
```

Tests needing authenticated context set `request.jwt.claim.sub` via `SET LOCAL`.

- **Effort:** Small (1 line change)
- **Risk:** Low — may break tests that accidentally depend on nil UUID

## Technical Details

- **Affected file:** `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts` (lines 40-44)

## Acceptance Criteria

- [ ] `auth.uid()` returns NULL when no JWT claim set
- [ ] Integration tests still pass
- [ ] COALESCE removed from the function body

## Work Log

| Date       | Action                      | Learnings                                         |
| ---------- | --------------------------- | ------------------------------------------------- |
| 2026-02-28 | Created from PR #110 review | Test stubs must match production behavior exactly |

## Resources

- PR: #110
