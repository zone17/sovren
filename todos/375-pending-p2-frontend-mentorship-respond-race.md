---
status: pending
priority: p2
issue_id: 375
tags:
  - code-review
  - frontend
  - race-condition
dependencies: []
---

# Frontend Mentorship Accept/Decline Race Condition

## Problem Statement

Accept/decline buttons for mentorship requests don't disable while the response mutation is pending. Users can trigger duplicate responses by clicking rapidly, causing confusing error states.

## Findings

**Source agents:** frontend-agent, race-condition-agent, code-review-agent

**Evidence:**

- File: `packages/frontend/src/features/creator-network/components/MentorshipCard.tsx` or similar
- Issue: Accept and decline buttons remain clickable while the respond mutation is in-flight, allowing duplicate responses.

## Proposed Solutions

### Option A: Disable buttons during pending mutation

- **Approach:** Add `disabled={respondMutation.isPending}` to both accept and decline buttons. Show loading indicator on the clicked button.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/frontend/src/features/creator-network/components/MentorshipCard.tsx` or similar

## Acceptance Criteria

- [ ] Both accept and decline buttons are disabled while the mutation is pending
- [ ] Visual feedback indicates which action is in progress
- [ ] Rapid clicks do not produce duplicate accept/decline requests

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
