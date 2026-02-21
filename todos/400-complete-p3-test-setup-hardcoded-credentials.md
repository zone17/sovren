---
status: complete
priority: p3
issue_id: "417"
tags: [code-review, testing, quality, pr-87]
dependencies: []
---

# Test setup files add hardcoded test credentials

## Problem Statement

The `vitest-backend-setup.ts` file adds several new environment variables with hardcoded test values (SMTP_PASS, SUPABASE_SERVICE_ROLE_KEY, etc.). While these are test-only values, the anti-pattern scanner's new check 1d (hardcoded secrets) could flag them since the scanner operates on staged TS source files.

## Findings

- `vitest-backend-setup.ts:21`: `SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'`
- `vitest-backend-setup.ts:25`: `SMTP_PASS = 'test-password'`
- These files are in `test-utils/` at the repo root, not in `packages/backend/src/`
- The scanner's `STAGED_TS_SRC` excludes `__tests__` and `.test.ts` but NOT `test-utils/`
- These would be false positives from check 1d

## Proposed Solutions

### Option 1: Add test-utils exclusion to scanner

**Approach:** Exclude `test-utils/` from check 1d pattern: `| grep -v 'test-utils'`

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

Add `test-utils/` exclusion to scanner check 1d. These are intentional test fixtures.

## Technical Details

**Affected files:**
- `test-utils/vitest-backend-setup.ts`
- `scripts/check-antipatterns.sh` (check 1d)

## Acceptance Criteria

- [ ] Scanner does not false-positive on test-utils credentials

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
