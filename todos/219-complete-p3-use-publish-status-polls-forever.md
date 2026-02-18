---
status: pending
priority: p3
issue_id: "219"
tags: [code-review, pr-85, performance]
---

# usePublishStatus Hook Polls Forever

## Problem Statement
usePublishStatus hook uses refetchInterval: 10_000 with no stop condition. Continues polling even after all posts reach terminal state (published/failed).

## Findings
- File: `packages/frontend/src/features/multi-platform/hooks/useCrossPost.ts`
- `useQuery` is configured with `refetchInterval: 10_000` (every 10 seconds)
- No `enabled` condition checks whether all posts have reached a terminal state (published or failed)
- After all posts complete, the hook continues polling indefinitely, wasting network bandwidth and server resources
- If a user leaves the tab open, polling never stops

## Proposed Solutions
1. Add `enabled: !allTerminal` condition to the `useQuery` options, where `allTerminal` is computed from the current data (all posts are in 'published' or 'failed' state)
2. Additionally, add a maximum polling duration (e.g., 10 minutes) as a safety net to stop polling even if some posts never reach terminal state

## Acceptance Criteria
- [ ] Polling stops automatically when all posts reach terminal state (published/failed)
- [ ] A maximum polling duration prevents indefinite polling in edge cases
- [ ] Polling resumes if a new publish action is triggered
- [ ] No unnecessary network requests are made after all posts complete
