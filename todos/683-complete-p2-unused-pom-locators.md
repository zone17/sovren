---
status: pending
priority: p2
issue_id: 683
tags: [code-review, e2e, playwright, yagni]
dependencies: []
---

# 50+ unused POM locators — YAGNI violation

## Problem Statement

8 new POM files define 50+ locators that are never referenced by any spec. These are speculative locators for future tests that don't exist. Unused locators become stale against DOM changes with no test to catch breakage.

**Consensus: 3/8 agents flagged (Code Simplicity, E2E Testing, Pattern Recognition).**

## Findings

| POM file                     | Unused locators | Total defined |
| ---------------------------- | --------------- | ------------- |
| analytics.page.ts            | 9               | 10            |
| revenue.page.ts              | 9               | 10            |
| subscriptions.page.ts        | 9               | 10            |
| profile-dashboard.page.ts    | 9               | 10            |
| onboarding.page.ts           | 4               | 6             |
| post.page.ts                 | 3               | 4             |
| lightning-onboarding.page.ts | 4               | 6             |
| nostr-onboarding.page.ts     | 3               | 5             |

Prior sprint (02-24) deleted 4 unused POM locators as P2. Same class of issue.

## Proposed Solutions

### Option A: Strip unused locators now

Remove all locators not referenced by current specs. Add them back when tests are written.

- Pros: Clean POMs, no stale locators
- Cons: Re-work when expanding test coverage
- Effort: Small
- Risk: None

## Acceptance Criteria

- [ ] Every POM locator is referenced by at least one spec assertion or action
- [ ] ~60 lines removed across 8 files

## Work Log

| Date       | Action                                    | Learnings                       |
| ---------- | ----------------------------------------- | ------------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | Reinforces common-solutions #30 |
