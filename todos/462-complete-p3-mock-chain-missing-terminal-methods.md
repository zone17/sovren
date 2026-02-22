---
status: pending
priority: p3
issue_id: 462
tags: [code-review, testing]
dependencies: [459]
---

# P3: createMockChain missing range, maybeSingle terminal methods

## Problem Statement

The `createMockChain()` in `supabase-mock.ts` only provides `single()` as a terminal method. Other commonly used Supabase terminals (`range()`, `maybeSingle()`) are missing, which limits reuse and forces per-test overrides.

## Findings

- Only `single()` terminal method provided
- `range()` is important for paginated accumulation pattern (critical-patterns.md #3)
- `maybeSingle()` used in several services for optional record lookups
- CrossPostService.test.ts already overrides `insert` manually to work around this

Source: Architecture strategist, Pattern recognition (PR #93)

## Proposed Solutions

### Option A: Add missing terminal methods

Add `maybeSingle()`, `range()`, and accept an options object `{ data, error }` for error path testing.

- Effort: Small
- Risk: Low

## Technical Details

- **Affected files**: `packages/backend/src/test-utils/supabase-mock.ts`

## Acceptance Criteria

- [ ] `maybeSingle()` and `range()` added as terminal methods
- [ ] Error path configurable via options object

## Work Log

| Date       | Action                     | Learnings |
| ---------- | -------------------------- | --------- |
| 2026-02-21 | Created from PR #93 review |           |
