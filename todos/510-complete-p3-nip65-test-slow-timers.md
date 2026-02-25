---
status: pending
priority: p3
issue_id: 510
tags: [code-review, tests, performance]
dependencies: []
---

# P3: NIP65Service tests take 120s real time

## Problem Statement

NIP65Service test suite takes ~120 seconds to run because it uses real timers for relay connection delays, retry backoffs, and timeouts. Each test waits ~10s of real wall time.

## Findings

**File:** `packages/frontend/src/services/nostr/__tests__/NIP65Service.test.ts`

Tests use `await new Promise(resolve => setTimeout(resolve, ...))` with real delays instead of `vi.useFakeTimers()` + `vi.advanceTimersByTime()`.

## Proposed Solutions

### Option A: Use fake timers (Recommended)
- Add `vi.useFakeTimers()` in beforeEach, `vi.useRealTimers()` in afterEach
- Replace real waits with `vi.advanceTimersByTime()`
- Pros: Tests run in <5s instead of 120s
- Cons: Requires careful timer management
- Effort: Medium
- Risk: Low

## Technical Details

- **Affected files:** `packages/frontend/src/services/nostr/__tests__/NIP65Service.test.ts`

## Acceptance Criteria

- [ ] Test suite completes in <10s
- [ ] All tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Identified during manual PR #98 review | |

## Resources

- PR #98: fix/backend-startup
