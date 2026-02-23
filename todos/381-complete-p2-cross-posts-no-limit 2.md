---
status: pending
priority: p2
issue_id: 381
tags:
  - code-review
  - performance
  - security
dependencies: []
---

# Cross-Posting Endpoints Have No Target Limit

## Problem Statement

Cross-posting endpoints don't limit the number of target platforms/circles. A malicious request could cross-post to hundreds of targets, creating a DDoS-like load on the system and downstream services.

## Findings

**Source agents:** performance-agent, security-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/services/community/CollaborativeContentService.ts`
- Issue: No validation on the number of cross-post targets. An attacker could send a request with hundreds of target IDs.

## Proposed Solutions

### Option A: Add maximum cross-post target limit

- **Approach:** Add a maximum cross-post target limit (e.g., 10) and validate in the Zod schema. Reject requests exceeding the limit with a 400 error.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/community/CollaborativeContentService.ts`

## Acceptance Criteria

- [ ] Zod schema enforces a maximum number of cross-post targets (e.g., `.max(10)`)
- [ ] Requests exceeding the limit return a 400 error with a clear message
- [ ] Existing valid cross-post requests continue to work

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
