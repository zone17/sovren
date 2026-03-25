---
status: pending
priority: p2
issue_id: 730
tags: [code-review, slice-8, performance, database, indexes, migrations]
dependencies: []
---

# #730 - Missing Database Indexes on Community Tables

## Problem Statement

Multiple community tables introduced in Slice 8 are missing indexes on their foreign-key and frequently-queried columns. Every JOIN and WHERE query against these tables currently performs a sequential scan, which will degrade to unacceptable latency as data grows.

## Findings

2 agent consensus during Slice 8 Creator Network review.

Missing indexes identified:

| Table             | Column      | Query Pattern                             |
| ----------------- | ----------- | ----------------------------------------- |
| `circle_members`  | `circle_id` | JOIN/WHERE in all circle member queries   |
| `circle_members`  | `user_id`   | WHERE in "circles for user" queries       |
| `circle_posts`    | `circle_id` | WHERE in all post listing queries         |
| `mentorships`     | `mentor_id` | WHERE in "mentorships for mentor" queries |
| `mentorships`     | `mentee_id` | WHERE in "mentorships for mentee" queries |
| `mentor_profiles` | `user_id`   | WHERE/JOIN in all mentor lookup queries   |

All of these columns are used in JOIN or WHERE clauses in the corresponding service methods but lack `CREATE INDEX` statements in the migration files.

## Proposed Solutions

Add a new migration file with the missing indexes:

```sql
-- migration: 20260307000001_community_indexes.sql

CREATE INDEX IF NOT EXISTS idx_circle_members_circle_id
  ON circle_members (circle_id);

CREATE INDEX IF NOT EXISTS idx_circle_members_user_id
  ON circle_members (user_id);

CREATE INDEX IF NOT EXISTS idx_circle_posts_circle_id
  ON circle_posts (circle_id);

CREATE INDEX IF NOT EXISTS idx_mentorships_mentor_id
  ON mentorships (mentor_id);

CREATE INDEX IF NOT EXISTS idx_mentorships_mentee_id
  ON mentorships (mentee_id);

CREATE INDEX IF NOT EXISTS idx_mentor_profiles_user_id
  ON mentor_profiles (user_id);
```

## Technical Details

- **Location**: New migration file in `supabase/migrations/`
- **Pattern**: `IF NOT EXISTS` prevents failures on re-run
- **Impact**: All service methods in `CreatorCircleService.ts`, `MentorshipService.ts`, and `FollowService.ts` that query these tables will benefit
- **Note**: Foreign key constraints do NOT automatically create indexes in PostgreSQL — explicit `CREATE INDEX` is required

## Acceptance Criteria

- [ ] New migration file created with all 6 indexes
- [ ] Migration uses `IF NOT EXISTS` on each index
- [ ] Migration applies cleanly against current schema (`supabase db reset` or equivalent)
- [ ] EXPLAIN output on affected queries shows Index Scan instead of Seq Scan after migration
