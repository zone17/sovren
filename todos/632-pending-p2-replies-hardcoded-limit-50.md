---
status: pending
priority: p2
issue_id: '632'
tags: [code-review, performance, backend, pagination]
dependencies: []
---

# Replies hardcoded to limit:50 with no pagination

## Problem Statement

`useReplies` in `packages/frontend/src/features/comments/hooks/useComments.ts` line 46 hardcodes `limit: 50` with no pagination mechanism. Popular comments with 50+ replies will silently truncate.

## Findings

- Performance Oracle flagged as CRITICAL-3
- No "Load more replies" button exists in CommentItem
- Backend listReplies supports pagination params but frontend ignores them

## Proposed Solutions

### Option A: Accept as-is for MVP, add TODO comment

50 replies covers 99%+ of use cases at launch. Add pagination later.

- Effort: Trivial

### Option B: Add "Show more replies" pagination

Mirror the top-level "Load more" pattern for replies.

- Effort: Medium

## Acceptance Criteria

- [ ] Decision documented (accept or implement pagination)
- [ ] If accepted: TODO comment added with rationale
