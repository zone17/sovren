---
status: pending
priority: p2
issue_id: '626'
tags: [code-review, security, backend, data-integrity]
dependencies: []
---

# Parent comment cross-content reference not validated

## Problem Statement

In `packages/backend/src/services/community/CommentsService.ts` lines 241-255, when creating a reply, the service checks that the parent comment exists and is active, but does NOT verify that the parent comment belongs to the same `contentId`. A user could create a reply to a comment on a different content item.

## Findings

- Security Sentinel and Data Integrity Guardian both flagged
- The INSERT at line 260 uses the route's `contentId`, but the parent check at line 243 only queries by `parentCommentId` without filtering by `content_id`
- This allows cross-content threading, which is semantically wrong

## Proposed Solutions

### Option A: Add content_id check on parent query (Recommended)

Add `.eq('content_id', contentId)` to the parent comment query at line 243.

- Pros: Simple, prevents cross-content references
- Cons: None
- Effort: Small

## Acceptance Criteria

- [ ] Parent comment query includes `content_id` filter
- [ ] Test verifies rejection of cross-content parent reference
