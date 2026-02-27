---
status: pending
priority: p3
issue_id: '591'
tags: [code-review, pr-108, testing, frontend]
---

# useDiscovery test uses real setTimeout instead of fake timers

## Problem Statement

`useDiscovery.test.tsx:140` uses `await new Promise((r) => setTimeout(r, 400))` — a real 400ms wait. The `useDebouncedValue` tests correctly use `vi.useFakeTimers()`. Inconsistent and makes tests slower/flakier.

**Flagged by: Kieran TS, Pattern Recognition (2/10 agents)**

## Proposed Solutions

Switch to fake timers in useDiscovery.test.tsx for the debounce assertion.

## Acceptance Criteria

- [ ] useDiscovery test uses vi.useFakeTimers() for debounce tests
- [ ] No real setTimeout waits in test files
