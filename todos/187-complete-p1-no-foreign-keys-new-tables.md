---
status: pending
priority: p1
issue_id: "187"
tags: [code-review, pr-85, database]
---

# No Foreign Key Constraints on New Supabase Migration Tables

## Problem Statement
All 5 new Supabase migration tables (platform_connections, cross_posts, repurposed_content, inbox_messages, platform_metrics_history) have zero FK constraints. `creator_id TEXT NOT NULL` has no reference to the users table. `content_id` has no reference to the content table. Orphan data is guaranteed on user or content deletion, leading to data integrity issues, phantom references, and potential security concerns (deleted user's data persists).

## Findings
- **Files**: `supabase/migrations/20260216200000-200400_epic009_*.sql` (5 migration files)
- `platform_connections` table: `creator_id TEXT NOT NULL` — no FK to users
- `cross_posts` table: `creator_id TEXT NOT NULL`, `content_id TEXT` — no FK to users or content
- `repurposed_content` table: `creator_id TEXT NOT NULL`, `original_content_id TEXT` — no FK constraints
- `inbox_messages` table: `creator_id TEXT NOT NULL` — no FK to users
- `platform_metrics_history` table: `creator_id TEXT NOT NULL`, `content_id TEXT` — no FK constraints
- None of the tables define `ON DELETE CASCADE` or `ON DELETE SET NULL` behavior
- `creator_id` stores NOSTR pubkeys (64-char hex) rather than UUID, which complicates FK to a UUID-based users table

## Proposed Solutions

### Solution 1: Add FK Constraints + CASCADE Rules (Recommended)
1. Add `REFERENCES content(id) ON DELETE CASCADE` for all `content_id` columns
2. For `creator_id`: Since NOSTR pubkeys are used instead of UUIDs, add `CHECK(LENGTH(creator_id) = 64)` constraint and document the design decision
3. If a `creators` or `profiles` table keyed by pubkey exists, add FK to that
4. Add `ON DELETE CASCADE` for content references so content deletion cleans up cross-posts, repurposed content, and metrics
5. Create a new migration file (do not modify existing applied migrations)

**Pros**: Guarantees referential integrity, automatic cascade cleanup, database enforces invariants
**Cons**: Requires understanding the NOSTR pubkey vs UUID design; CASCADE on creator deletion needs careful consideration

### Solution 2: Application-Level Cleanup
Add deletion hooks/triggers in the service layer to clean up related records when users or content are deleted.

**Pros**: More flexible, can add logging/audit trail
**Cons**: Easy to miss cleanup paths, not enforced at DB level, race conditions possible

## Acceptance Criteria
- [ ] All `content_id` columns have FK constraints referencing the content table
- [ ] `creator_id` has either FK constraint to a creators/profiles table or CHECK constraint on format
- [ ] CASCADE behavior is defined for all FK relationships (CASCADE, SET NULL, or RESTRICT with documented rationale)
- [ ] A new migration file is created (existing applied migrations are not modified)
- [ ] Design decision for NOSTR pubkey as creator_id is documented (ADR or inline comment)
- [ ] Existing data is validated against new constraints before migration runs (or migration handles violations)
