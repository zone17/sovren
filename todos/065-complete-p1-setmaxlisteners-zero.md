---
status: pending
priority: p1
issue_id: 065
tags: [code-review, performance, reliability]
dependencies: []
---

# process.setMaxListeners(0) Masks EventEmitter Leaks

## Problem Statement

`packages/backend/src/server.ts` line 24 calls `process.setMaxListeners(0)` which disables Node.js's built-in EventEmitter leak detection. This masks real listener leaks (like the WebSocket leak in health checks) and prevents early warning of memory issues.

## Findings

- **Performance Oracle P1-003**: Disabling leak detection hides genuine leaks; the health check WS leak was masked by this.
- **Architecture Strategist P3**: Global mutation of process settings is an anti-pattern.

## Proposed Solutions

### Option A: Remove and fix underlying leaks (Recommended)

Remove `setMaxListeners(0)`, identify what triggers the MaxListenersExceeded warning, fix those leaks.
**Pros:** Restores leak detection, fixes root cause
**Cons:** May surface multiple warnings that need fixing
**Effort:** Medium
**Risk:** Low

### Option B: Set reasonable limit instead of 0

Use `process.setMaxListeners(25)` or similar reasonable bound.
**Pros:** Quick, still provides some leak detection
**Cons:** Doesn't fix underlying issues
**Effort:** Small
**Risk:** Low

## Technical Details

- **Affected files:** `packages/backend/src/server.ts:24`
- **Components:** Server initialization
- **Runtime impact:** Masks memory leaks, prevents early detection

## Acceptance Criteria

- [ ] `process.setMaxListeners(0)` removed
- [ ] No MaxListenersExceeded warnings in normal operation
- [ ] Any underlying listener leaks identified and fixed

## Work Log

| Date       | Action                          | Learnings                 |
| ---------- | ------------------------------- | ------------------------- |
| 2026-02-13 | Created from full PR #73 review | Performance Oracle P1-003 |

## Resources

- PR #73 full review
