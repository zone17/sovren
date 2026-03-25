---
status: pending
priority: p2
issue_id: 682
tags: [code-review, e2e, playwright, testing]
dependencies: []
---

# Auth specs accept login redirect as pass — zero behavioral coverage

## Problem Statement

5 auth specs (`analytics`, `revenue`, `subscriptions`, `post`, and partially `profile-dashboard`) only assert URL patterns like `/(route|login)`. They run in `chromium-authenticated` project with stored auth state, but accept a redirect to `/login` as a passing result. This means:

1. If auth state fails, the test still passes
2. No page content is ever verified — the test passes even if the component throws during render

**Consensus: 5/8 agents flagged. E2E Testing Specialist rated P1; reclassified P2 since demo auth mode is the root cause.**

## Findings

- `packages/frontend/e2e/analytics.auth.spec.ts:12-16`
- `packages/frontend/e2e/revenue.auth.spec.ts:12-16`
- `packages/frontend/e2e/subscriptions.auth.spec.ts:12-16`
- `packages/frontend/e2e/post.auth.spec.ts:10-15`
- `packages/frontend/e2e/profile-dashboard.public.spec.ts:12-14` (URL-only check)
- Compare with `creator-network.auth.spec.ts` which properly asserts heading visibility

## Proposed Solutions

### Option A: Add content assertions after URL check

After confirming the URL, assert a heading or key element is visible for routes that load.

- Pros: Actual E2E coverage
- Cons: Some routes redirect in demo mode — need conditional handling
- Effort: Small
- Risk: Low

### Option B: Skip URL-only specs, rely on navigation spec

Remove these thin specs; the existing `navigation.auth.spec.ts` already covers route existence.

- Pros: Less maintenance, no false confidence
- Cons: Loses per-route smoke coverage
- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Auth specs assert visible content, not just URLs
- [ ] Or thin specs removed if navigation spec covers the routes

## Work Log

| Date       | Action                                    | Learnings                                   |
| ---------- | ----------------------------------------- | ------------------------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | URL-only E2E tests provide false confidence |
