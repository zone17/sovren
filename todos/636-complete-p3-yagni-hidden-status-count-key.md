---
status: pending
priority: p3
issue_id: '636'
tags: [code-review, yagni, simplicity]
dependencies: []
---

# Unused 'hidden' status and unused count key factory (YAGNI)

## Problem Statement

1. `CommentStatus` in `packages/shared/src/types/comments.ts` includes `'hidden'` but nothing uses it
2. `commentKeys.count` in `query-keys.ts` is defined but never called

## Findings

- Simplicity agent flagged both as YAGNI violations

## Proposed Solutions

Remove both. Add back when features need them.

## Acceptance Criteria

- [ ] 'hidden' removed from CommentStatus union
- [ ] count key factory removed from commentKeys
