---
status: complete
priority: p2
issue_id: '495'
tags:
  - code-review
  - playwright
  - e2e-testing
  - test-isolation
dependencies: []
---

# SIGNUP_USER Email Hardcoded With No Env Override

## Problem Statement

`CREATOR_CREDENTIALS` and `TEST_USER` both have `process.env` fallbacks, but `SIGNUP_USER` does not:

```typescript
export const SIGNUP_USER = {
  name: 'Test Creator',
  email: 'newuser@sovren.app', // hardcoded
  password: 'password123', // hardcoded
};
```

When running against a real backend (`USE_BACKEND=1`), the signup test will fail on the second run because the email already exists in the database. Inconsistent with the env-override pattern used by the other credential exports.

## Findings

**Agent consensus: 2/4** (kieran-typescript-reviewer, agent-native-reviewer)

- Inconsistent with `CREATOR_CREDENTIALS` and `TEST_USER` env override pattern
- Creates collision risk when running against real database
- Affects agent-driven repeated test runs

## Proposed Solutions

### Option A: Add env overrides matching existing pattern (Recommended)

```typescript
export const SIGNUP_USER = {
  name: process.env.E2E_SIGNUP_NAME || 'Test Creator',
  email: process.env.E2E_SIGNUP_EMAIL || 'newuser@sovren.app',
  password: process.env.E2E_SIGNUP_PASSWORD || 'password123',
};
```

- Pros: Consistent with existing pattern, no CI changes needed
- Cons: Still collides if env var not set and run repeatedly against real DB
- Effort: Small
- Risk: Low

### Option B: Generate unique email per run

```typescript
email: process.env.E2E_SIGNUP_EMAIL || `newuser+${Date.now()}@sovren.app`,
```

- Pros: Zero collision risk without any config
- Cons: Creates new accounts each run (cleanup needed)
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/fixtures/test-credentials.ts` (line 21)

## Acceptance Criteria

- [ ] `SIGNUP_USER` has env var fallbacks matching `CREATOR_CREDENTIALS` pattern
- [ ] Signup test can run against real backend without collision on second run
- [ ] All 20 tests still pass

## Work Log

| Date       | Action                          | Outcome                                                      |
| ---------- | ------------------------------- | ------------------------------------------------------------ |
| 2026-02-24 | Identified by 2/4 review agents | P2 — test isolation risk                                     |
| 2026-02-24 | Fixed — added env overrides     | SIGNUP_USER now has E2E_SIGNUP_NAME/EMAIL/PASSWORD fallbacks |
