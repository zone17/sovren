---
status: pending
priority: p3
issue_id: 345
tags: [code-review, testing]
---

# SSRF test suite uses sync assertions on async function

## Problem Statement

The SSRF test suite uses synchronous assertion patterns on async functions, causing tests to always pass because async rejections go uncaught by the test runner.

## Findings

- File: `packages/backend/src/utils/__tests__/ssrf.test.ts`
- Tests that should verify SSRF rejection always pass regardless of actual behavior
- Async rejections are not awaited, so the test completes before the assertion evaluates
- This means the SSRF validation could be completely broken and tests would still be green

## Proposed Solutions

1. Replace sync `expect(...).toThrow()` with `await expect(...).rejects.toThrow()` for all async SSRF validation tests
2. Add a sanity test that confirms a known-bad URL is actually rejected (canary test)

## Acceptance Criteria

- [ ] All async SSRF test assertions use `await expect(...).rejects.toThrow()`
- [ ] Tests actually fail when SSRF validation logic is temporarily disabled (manual verification)
- [ ] No uncaught promise rejections in test output
