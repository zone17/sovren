---
status: pending
priority: p3
issue_id: "210"
tags: [code-review, pr-85, dead-code]
---

# recoverStaleJobs() Dead Code

## Problem Statement
CrossPublishProcessor.recoverStaleJobs() is a static method never called anywhere. Dead code.

## Findings
- File: `packages/backend/src/services/distribution/CrossPublishProcessor.ts:130-150`
- `recoverStaleJobs()` is defined as a static method but has zero call sites in the codebase
- No scheduled job, route, or other code path invokes this method

## Proposed Solutions
1. Remove the method entirely if stale job recovery is not a current requirement
2. Wire it into a scheduled BullMQ repeatable job that runs periodically (e.g., every 5 minutes) to recover stuck jobs

## Acceptance Criteria
- [ ] Method is either removed or wired into an active code path (scheduled job or admin route)
- [ ] If wired in, a test verifies the recovery logic executes correctly
- [ ] No dead code remains
