---
status: pending
priority: p2
issue_id: "200"
tags: [code-review, pr-85, performance]
---

# N+1 Poll Messages Individual Upserts

## Problem Statement
UnifiedInboxService.pollMessages() does individual upserts per message. With 4 platforms x ~50 messages each = 200+ DB operations per poll cycle.

## Findings
- **File**: `packages/backend/src/services/distribution/UnifiedInboxService.ts:189-209`
- `pollMessages()` fetches messages from each connected platform and then upserts them one at a time into the database
- Each upsert is a separate DB round-trip (INSERT ... ON CONFLICT UPDATE)
- With 4 platforms returning ~50 messages each, this results in 200+ individual DB operations per poll cycle
- Poll cycles likely run on a schedule (e.g., every few minutes), creating sustained DB load
- This is a classic N+1 pattern that degrades linearly with message volume

## Proposed Solutions
1. Batch upsert all messages in one query per platform using PostgreSQL's multi-row INSERT ... ON CONFLICT syntax (e.g., `INSERT INTO messages (id, ...) VALUES ($1, ...), ($2, ...) ON CONFLICT (external_id) DO UPDATE SET ...`)
2. Use Supabase's `.upsert()` method with an array of records, which generates a single bulk upsert query

## Acceptance Criteria
- [ ] Messages from each platform are upserted in a single batch query (not individual queries)
- [ ] DB operations per poll cycle reduced from O(n) to O(platforms) (e.g., 4 queries instead of 200)
- [ ] Duplicate messages are still handled correctly via ON CONFLICT / upsert logic
- [ ] Poll cycle duration is measurably reduced under load
