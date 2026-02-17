---
status: pending
priority: p1
issue_id: "188"
tags: [code-review, pr-85, data-integrity]
---

# Platform Disconnect Does Not Cascade Cleanup to Related Records

## Problem Statement
`PlatformConnectionService.disconnect()` only deletes the `platform_connections` row. It does not cancel queued `cross_posts`, clean up `inbox_messages`, `repurposed_content`, or `platform_metrics_history`. This orphans data and causes an infinite retry loop when `CrossPublishProcessor` tries to fetch tokens for a deleted connection, as it retries forever on a connection that no longer exists.

## Findings
- **File**: `packages/backend/src/services/distribution/PlatformConnectionService.ts`, lines 168-197
  - `disconnect()` method performs a single DELETE on `platform_connections` table
  - No pre-deletion cleanup of dependent records
  - No cancellation of queued/scheduled cross_posts for the disconnected platform
  - No cleanup of inbox_messages associated with the connection
  - No cleanup of repurposed_content tied to the platform
  - No cleanup of platform_metrics_history
- When `CrossPublishProcessor.process()` runs for a queued cross_post, it attempts to load the platform connection to get OAuth tokens. The connection is gone, causing either a crash or infinite retry depending on error handling.

## Proposed Solutions

### Solution 1: Pre-Deletion Cleanup in disconnect() (Recommended)
Before deleting the platform_connections row:
1. Update `cross_posts` SET `status = 'cancelled'` WHERE `creator_id = X` AND `platform = Y` AND `status IN ('queued', 'scheduled')`
2. Optionally soft-delete or archive `inbox_messages` for that connection
3. Leave `platform_metrics_history` as historical data (read-only, no retry risk)
4. Leave `repurposed_content` as historical data
5. Wrap all operations in a transaction

**Pros**: Prevents retry loops, data remains for auditing where safe, transactional consistency
**Cons**: Slightly more complex disconnect flow

### Solution 2: Database-Level CASCADE
Add `ON DELETE CASCADE` FK from `cross_posts.connection_id` to `platform_connections.id`.

**Pros**: Automatic, impossible to forget
**Cons**: Hard-deletes cross_post records (no cancelled status for user to see), requires migration, may not suit all tables

## Acceptance Criteria
- [ ] `disconnect()` cancels all queued/scheduled cross_posts for the disconnected creator+platform before deleting connection
- [ ] `CrossPublishProcessor` no longer enters infinite retry loop after a platform disconnection
- [ ] Cleanup operations are wrapped in a database transaction with the connection deletion
- [ ] Historical data (metrics, completed cross_posts) is preserved for analytics
- [ ] Unit test verifies that disconnecting a platform cancels pending cross_posts
- [ ] Integration test verifies no orphaned retries after disconnect
