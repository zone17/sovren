---
status: pending
priority: p1
issue_id: 790
tags: [e2e, playwright, infrastructure, agent-native]
dependencies: []
---

# Add API Project to Playwright Config

## Problem Statement
`playwright.config.ts` has 3 projects (setup, chromium-authenticated, chromium-public) but NO project for `*.api.spec.ts` files. Agent-native API tests cannot run without a 4th project.

## Findings
- Config at `packages/frontend/playwright.config.ts`
- Need `api` project matching `*.api.spec.ts` with `dependencies: ['setup']`
- API tests use Playwright `request` context (no browser)
- Must set baseURL to backend URL (port 3001)
- API tests require `USE_BACKEND=1` — demo tokens won't pass JWT validation

## Proposed Solutions

### Option A: Add api project to existing config (Recommended)
Add a 4th project entry:
```typescript
{
  name: 'api',
  testMatch: /\.api\.spec\.ts$/,
  dependencies: ['setup'],
  use: {
    baseURL: process.env.E2E_API_URL || 'http://localhost:3001',
  },
}
```
- Pros: Minimal change, convention-consistent
- Cons: None
- Effort: Small
- Risk: Low

## Acceptance Criteria
- [ ] `playwright.config.ts` has 4th project for `*.api.spec.ts`
- [ ] API project depends on setup project for auth token
- [ ] `npm run test:e2e` discovers and runs `*.api.spec.ts` files

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Blocking all Phase 3 (agent-native) tests |
