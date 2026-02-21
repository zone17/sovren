---
status: pending
priority: p2
issue_id: 374
tags:
  - code-review
  - frontend
  - race-condition
dependencies: []
---

# Frontend Circle Join Button Race Condition

## Problem Statement

Circle join button doesn't disable while mutation is pending. Rapid clicks can send multiple join requests before the first completes. The DB unique constraint catches the duplicate, but the user sees an ugly error instead of a smooth experience.

## Findings

**Source agents:** frontend-agent, race-condition-agent, code-review-agent

**Evidence:**

- File: `packages/frontend/src/features/creator-network/components/CircleCard.tsx` or similar
- Issue: Join button remains clickable while the join mutation is in-flight, allowing duplicate requests on rapid clicks.

## Proposed Solutions

### Option A: Disable button during pending mutation

- **Approach:** Add `disabled={joinMutation.isPending}` to the join button. Optionally show a spinner or "Joining..." text.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/frontend/src/features/creator-network/components/CircleCard.tsx` or similar

## Acceptance Criteria

- [ ] Join button is disabled while the mutation is pending
- [ ] Visual feedback (spinner or text change) indicates the join is in progress
- [ ] Rapid clicks do not produce duplicate join requests

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
