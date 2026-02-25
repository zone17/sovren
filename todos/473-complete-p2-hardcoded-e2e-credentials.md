---
status: complete
priority: p2
issue_id: '473'
tags:
  - code-review
  - playwright
  - e2e-testing
  - maintainability
dependencies: []
---

# Hardcoded E2E Test Credentials With No Single Source of Truth

## Problem Statement

Three different email/password pairs are hardcoded across 2 files with no centralized fixture or env var fallback:

| File                       | Email                    | Password          |
| -------------------------- | ------------------------ | ----------------- |
| `auth.setup.ts:15-16`      | `e2e-creator@sovren.app` | `testpassword123` |
| `auth.spec.ts:18`          | `test@sovren.app`        | `password123`     |
| `auth.spec.ts:29` (signup) | `newuser@sovren.app`     | `password123`     |

The existing `test-users.ts` fixture defines NOSTR key-based users but no email/password credentials. Demo auth accepts any input so this works today, but credential changes require grepping multiple files.

## Findings

**Agent consensus: 5/7** (kieran-typescript, architecture, pattern-recognition, agent-native, performance)

- No env var fallback prevents multi-environment testing without source edits
- `test-users.ts` fixture exists but is disconnected from actual test execution
- When real Supabase auth is enabled, all tests break simultaneously

## Proposed Solutions

### Option A: Create test-credentials.ts fixture (Recommended)

```typescript
// e2e/fixtures/test-credentials.ts
export const CREATOR_CREDENTIALS = {
  email: process.env.E2E_CREATOR_EMAIL || 'e2e-creator@sovren.app',
  password: process.env.E2E_CREATOR_PASSWORD || 'testpassword123',
};

export const TEST_CREDENTIALS = {
  email: process.env.E2E_TEST_EMAIL || 'test@sovren.app',
  password: process.env.E2E_TEST_PASSWORD || 'password123',
};

export const SIGNUP_CREDENTIALS = {
  name: 'Test Creator',
  email: 'newuser@sovren.app',
  password: 'password123',
};
```

- Pros: Single source of truth, env var fallback, type-safe
- Cons: New file
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/auth.setup.ts` (lines 15-16)
- `packages/frontend/e2e/auth.spec.ts` (lines 18, 29, 46)
- New: `packages/frontend/e2e/fixtures/test-credentials.ts`

## Acceptance Criteria

- [ ] All credentials sourced from single fixture file
- [ ] Environment variable fallbacks for multi-env testing
- [ ] All 17 tests still pass
- [ ] No hardcoded credentials in spec/setup files

## Work Log

| Date       | Action                          | Outcome                                                         |
| ---------- | ------------------------------- | --------------------------------------------------------------- |
| 2026-02-24 | Identified by 5/7 review agents | Confirmed P2 - maintainability risk                             |
| 2026-02-24 | Verified against source         | ALREADY FIXED — auth.spec.ts:5 imports from test-credentials.ts |
