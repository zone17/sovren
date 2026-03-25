---
status: pending
priority: p2
issue_id: '631'
tags: [code-review, database, security, rls]
dependencies: []
---

# RLS SELECT/UPDATE policies inconsistent with content-creator moderation

## Problem Statement

The RLS policies in the supplementary migration allow content creators to UPDATE comment status (moderation), but the SELECT policy may not expose those comments to the creator for moderation. The UPDATE policy grants creator access via content ownership, but SELECT may filter by user_id only.

## Findings

- Data Integrity Guardian flagged as P2
- Content creators need to SEE all comments on their content to moderate them
- Current RLS policies may restrict visibility to own comments only

## Proposed Solutions

### Option A: Verify and fix SELECT policy for content creators

Ensure SELECT policy includes OR condition for content owner to see all comments on their content.

- Effort: Small

## Acceptance Criteria

- [ ] Content creators can SELECT all comments on their content
- [ ] SELECT and UPDATE policies are consistent for creator moderation
