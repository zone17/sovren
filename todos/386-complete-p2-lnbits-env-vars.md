---
status: pending
priority: p2
issue_id: 386
tags:
  - code-review
  - deployment
  - env-config
dependencies: []
---

# LNBITS_URL and LNBITS_API_KEY Must Be Configured for Production

## Problem Statement

LNBITS_URL and LNBITS_API_KEY must be configured in production for invoice payment links and marketplace escrow. The fallback URL (`https://lnbits.sovren.dev`) may not be valid, and missing configuration will silently break invoicing and escrow functionality.

## Findings

**Source agents:** deployment-agent, env-config-agent, code-review-agent

**Evidence:**

- File: `.env.example`
- Issue: LNBits environment variables may not be documented
- File: `packages/backend/.env.example`
- Issue: No startup validation warns when LNBits vars are missing

## Proposed Solutions

### Option A: Add env vars to .env.example and add startup validation

- **Approach:** Add LNBITS_URL and LNBITS_API_KEY to `.env.example`. Add startup validation that logs a warning if missing (invoicing and escrow will be non-functional). Do not hard-fail since the app can run without these features.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `.env.example`
- `packages/backend/.env.example`

## Acceptance Criteria

- [ ] LNBITS_URL and LNBITS_API_KEY are documented in .env.example files
- [ ] Startup validation logs a warning if LNBits vars are missing
- [ ] Warning message clearly states which features will be non-functional
- [ ] Application still starts successfully without LNBits configuration

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
