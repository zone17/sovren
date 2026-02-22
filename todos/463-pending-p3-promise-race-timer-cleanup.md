---
status: pending
priority: p3
issue_id: 463
tags: [code-review, performance]
dependencies: []
---

# P3: Promise.race timer not cleaned up in env-validation.ts

## Problem Statement

The `setTimeout` in the `Promise.race` timeout pattern in `env-validation.ts` is not cleared when `validateConnectivity` resolves first. The timer continues running for up to 5 seconds. Technically harmless (reject on settled promise is a no-op) but wastes a timer handle and is a bad pattern to copy.

## Findings

- Line ~424 in env-validation.ts
- Startup-only function, runs once — impact is negligible
- But sets a copyable anti-pattern

Source: Performance oracle, Pattern recognition (PR #93)

## Proposed Solutions

### Option A: Add timer.unref() or AbortSignal.timeout
Use `AbortSignal.timeout(5000)` on the underlying fetch call, or clear the timer on resolution.
- Effort: Small
- Risk: Low

## Technical Details

- **Affected files**: `packages/backend/src/utils/env-validation.ts`

## Acceptance Criteria

- [ ] Timer properly cleaned up on early resolution
- [ ] OR use AbortSignal.timeout instead of Promise.race

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from PR #93 review | |
