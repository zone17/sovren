---
status: complete
priority: p1
issue_id: '472'
tags:
  - code-review
  - playwright
  - e2e-testing
  - test-isolation
dependencies: []
---

# auth.spec.ts Assigned to Wrong Playwright Project

## Problem Statement

`auth.spec.ts` is matched by the `chromium-authenticated` project in `playwright.config.ts` (line 39), which depends on the `setup` project and injects `storageState: authFile`. However, `auth.spec.ts` immediately clears localStorage in `beforeEach` (line 12) and creates its own auth state per-test. The comment on line 6 explicitly states: "Auth tests create their own auth state per-test -- they do NOT use shared storage state."

This creates:

1. **Test isolation defect**: Pre-injected auth state (cookies, storage) may not be fully cleared by `localStorage.clear()` alone
2. **Unnecessary dependency**: auth.spec.ts blocks on setup completing, even though it discards the result (~1s wasted)
3. **Semantic contradiction**: Project name `chromium-authenticated` implies tests need auth; auth.spec.ts tests unauthenticated flows
4. **Cascading failure**: If setup fails, auth.spec.ts won't run despite not needing setup output

## Findings

**Agent consensus: 7/7** (security-sentinel, kieran-typescript-reviewer, architecture-strategist, performance-oracle, pattern-recognition-specialist, code-simplicity-reviewer, agent-native-reviewer)

- Security: Could mask auth bypass bugs if a new test forgets `localStorage.clear()`
- Performance: Blocks parallelism, adds ~1-1.5s unnecessary wait
- Architecture: Violates test isolation principle, semantic lie in project naming

## Proposed Solutions

### Option A: Move auth.spec.ts to chromium-public (Recommended)

Add `auth.spec.ts` to the public project regex:

```typescript
// playwright.config.ts
{
  name: 'chromium-authenticated',
  testMatch: /navigation\.spec\.ts/,  // Remove auth.spec.ts
  dependencies: ['setup'],
  use: { ...devices['Desktop Chrome'], storageState: authFile },
},
{
  name: 'chromium-public',
  testMatch: /home\.spec\.ts|auth\.spec\.ts/,  // Add auth.spec.ts
  use: { ...devices['Desktop Chrome'] },
},
```

- Pros: Simplest change, auth tests run in parallel with setup
- Cons: None
- Effort: Small (1 line change)
- Risk: Low

### Option B: Create a separate auth-tests project

```typescript
{
  name: 'chromium-auth-tests',
  testMatch: /auth\.spec\.ts/,
  use: { ...devices['Desktop Chrome'] },
},
```

- Pros: Clearest separation, explicit naming
- Cons: One more project in config
- Effort: Small (5 lines)
- Risk: Low

## Recommended Action

Option A — move to `chromium-public`. Simplest fix, matches the stated intent.

## Technical Details

**Affected files:**

- `packages/frontend/playwright.config.ts` (line 39 testMatch regex)

## Acceptance Criteria

- [ ] `auth.spec.ts` NOT matched by `chromium-authenticated` project
- [ ] `auth.spec.ts` runs without depending on setup project
- [ ] `auth.spec.ts` receives no pre-injected storageState
- [ ] All 17 tests still pass
- [ ] `auth.spec.ts` can run in parallel with setup project

## Work Log

| Date       | Action                          | Outcome                                                                           |
| ---------- | ------------------------------- | --------------------------------------------------------------------------------- |
| 2026-02-24 | Identified by 7/7 review agents | Confirmed P1 - test isolation defect                                              |
| 2026-02-24 | Verified against source         | ALREADY FIXED — auth.spec.ts already in chromium-public (playwright.config.ts:49) |

## Resources

- PR: E2E mock elimination commit `a2b3648`
- Playwright docs: [Test Projects](https://playwright.dev/docs/test-projects)
- Pattern: `docs/solutions/test-failures/e2e-mock-elimination-pom-rewrite-20260224.md`
