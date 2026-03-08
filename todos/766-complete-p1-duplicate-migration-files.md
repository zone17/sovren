---
status: pending
priority: p1
issue_id: 766
tags: [code-review, data-integrity, database, migrations]
dependencies: []
---

# Duplicate Migration Files Will Cause Deployment Failures

## Problem Statement

8 duplicate migration files with macOS copy suffixes (` 2.sql`, ` 3.sql`) exist in supabase/migrations/. Also `comments 2.ts` in shared types. Fresh deployments may fail or produce non-deterministic schema state.

## Findings

- **Data Integrity Agent**: P1-5
- **TypeScript Agent**: P1-6 (comments 2.ts)

### Files to Delete

- `20260306000000_notifications 2.sql`, `notifications 3.sql`
- `20260306000001_follow_count_trigger 2.sql`
- `20260307000000_slice8_review_fixes 2.sql`, `slice8_review_fixes 3.sql`
- `packages/shared/src/types/comments 2.ts`

## Acceptance Criteria

- [ ] All duplicate files deleted
- [ ] Fresh migration run succeeds without errors
