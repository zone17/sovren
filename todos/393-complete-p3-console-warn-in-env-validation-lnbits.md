---
status: pending
priority: p3
issue_id: '410'
tags: [code-review, quality, infra, pr-87]
dependencies: []
---

# LNBits env validation uses console.warn instead of logger

## Problem Statement

The new LNBits configuration warning in `env-validation.ts:248` uses `console.warn()`. While this file is excluded from the anti-pattern scanner's check 1b, it's inconsistent with the project's logger service pattern. The `env-validation.ts` module is loaded early in the startup sequence, so logger may not be available -- but this should be documented.

## Findings

- `env-validation.ts:248`: `console.warn(...)` for missing LNBITS_API_URL / LNBITS_ADMIN_KEY
- Pre-existing: there are already 3 other `console.warn` calls in this file (lines 288, 361, 383)
- The anti-pattern scanner explicitly excludes `env-validation.ts` from check 1b
- This is a pre-existing pattern, not a new violation introduced by this PR

## Proposed Solutions

### Option 1: Accept as-is (recommended)

**Approach:** The env-validation module runs before the logger service is initialized. `console.warn` is the correct choice here.

**Effort:** 0 minutes

**Risk:** None

## Recommended Action

Accept as-is. This is a legitimate use of console.warn in a bootstrap module.

## Technical Details

**Affected files:**

- `packages/backend/src/utils/env-validation.ts:248`

## Acceptance Criteria

- [ ] Decision documented: accepted as-is

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
