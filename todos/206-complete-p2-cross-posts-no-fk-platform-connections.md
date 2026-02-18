---
status: pending
priority: p2
issue_id: "206"
tags: [code-review, pr-85, database]
---

# cross_posts Table Missing FK to platform_connections

## Problem Statement
cross_posts table has no FK to platform_connections. Allows creating cross-posts for platforms the creator never connected. CrossPublishProcessor will fail with a confusing "No connection found" error.

## Findings
- **File**: `supabase/migrations/20260216200100_epic009_cross_posts.sql`
- The `cross_posts` table stores `creator_id` and `platform` columns but has no foreign key constraint referencing `platform_connections(creator_id, platform)`
- Without the FK, the database allows inserting cross_posts rows for platform/creator combinations that don't exist in platform_connections
- When `CrossPublishProcessor` attempts to publish, it looks up the connection and fails with a runtime error ("No connection found") instead of a clean constraint violation at insert time
- If a platform connection is deleted, orphaned cross_posts rows remain with no cascade cleanup
- This violates referential integrity and makes debugging harder

## Proposed Solutions
1. Add a composite foreign key: `FOREIGN KEY (creator_id, platform) REFERENCES platform_connections(creator_id, platform) ON DELETE CASCADE`. This requires a unique constraint on `platform_connections(creator_id, platform)` if one doesn't already exist.
2. Add an application-level check in CrossPostService.publish() that verifies all target platforms have active connections before inserting cross_posts rows (defense in depth, but FK is still preferred).

## Acceptance Criteria
- [ ] cross_posts table has a FK constraint referencing platform_connections(creator_id, platform)
- [ ] Attempting to create a cross-post for an unconnected platform fails with a constraint violation (not a runtime error)
- [ ] Deleting a platform connection cascades to remove associated cross_posts rows
- [ ] Existing cross_posts data (if any) is validated before adding the constraint
