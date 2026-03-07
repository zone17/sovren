---
status: pending
priority: p2
issue_id: '483'
tags:
  - code-review
  - msw
  - test-infrastructure
  - phase-9
dependencies:
  - '479'
---

# onUnhandledRequest: 'bypass' hides handler mismatches

## Problem Statement

`server.listen({ onUnhandledRequest: 'bypass' })` silently passes through any unhandled HTTP request. During migration this means handler path mismatches (like `/api/` vs `/api/v1/`) go undetected. Should be `'warn'` to log mismatches without failing tests.

**Consensus: 3/7 review agents flagged this.**

## Proposed Solutions

### Option A: Change to 'warn' (Recommended)

**Effort:** Trivial (1-line change)
**Risk:** Low — may produce noise from non-API requests (static assets, etc.) but that's useful signal during migration

## Technical Details

**Affected file:** `test-utils/vitest-frontend-setup.ts` — `server.listen()` call

## Acceptance Criteria

- [ ] `onUnhandledRequest` changed from `'bypass'` to `'warn'`
- [ ] Test baseline unchanged (warnings don't fail tests)

## Work Log

| Date       | Action                          | Learnings                                                                    |
| ---------- | ------------------------------- | ---------------------------------------------------------------------------- |
| 2026-02-24 | Created from Phase 9 MSW review | 'bypass' is appropriate for stable suites; 'warn' is better during migration |
