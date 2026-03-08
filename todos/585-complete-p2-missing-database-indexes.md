---
status: pending
priority: p2
issue_id: '585'
tags: [code-review, pr-108, database, performance]
---

# Missing database indexes for discovery search, sort, and category filter

## Problem Statement

ILIKE searches do full sequential scans. Sort by follower_count/created_at requires in-memory sort. Category `@>` array containment has no GIN index. At 10K+ creators, queries will exceed 200ms.

**Flagged by: Performance Oracle, Data Integrity Guardian (2/10 agents)**

## Proposed Solutions

Add a new migration file:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Text search: GIN trigram indexes for ILIKE %...% patterns
CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm
  ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_bio_trgm
  ON creator_profiles USING gin (bio gin_trgm_ops);

-- Sort indexes
CREATE INDEX IF NOT EXISTS idx_creators_follower_count_desc
  ON creators (follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_created_at_desc
  ON creator_profiles (created_at DESC);

-- Category filter: GIN for @> operator
CREATE INDEX IF NOT EXISTS idx_creator_profiles_categories_gin
  ON creator_profiles USING gin (categories);
```

## Acceptance Criteria

- [ ] pg_trgm extension enabled
- [ ] Trigram indexes on display_name, username, bio
- [ ] B-tree indexes on follower_count DESC and created_at DESC
- [ ] GIN index on creator_profiles.categories
