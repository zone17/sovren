---
status: pending
priority: p2
issue_id: '629'
tags: [code-review, frontend, accessibility, a11y]
dependencies: []
---

# Hardcoded delete-dialog-title ID causes DOM collision

## Problem Statement

In `packages/frontend/src/features/comments/components/CommentItem.tsx` lines 229 and 236, `id="delete-dialog-title"` is hardcoded. When multiple CommentItem components render, duplicate IDs violate HTML spec and confuse screen readers.

## Findings

- Security Sentinel, Architecture Strategist, and Pattern-Recognition agents all flagged (3/8 consensus)

## Proposed Solutions

### Option A: Use comment.id in the ID (Recommended)

Change to `id={\`delete-dialog-title-${comment.id}\`}`and update`aria-labelledby` to match.

- Effort: Small

## Acceptance Criteria

- [ ] Dialog title ID is unique per comment instance
- [ ] aria-labelledby references the correct unique ID
