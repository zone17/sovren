---
status: pending
priority: p1
issue_id: 370
tags:
  - code-review
  - deployment
  - security
  - env-config
dependencies: []
---

# BYOK_ENCRYPTION_KEY Missing from .env.example Files

## Problem Statement

BYOK_ENCRYPTION_KEY environment variable is not listed in any .env.example file. BYOK (Bring Your Own Key) endpoints will fail in production without this secret. The key must be a 32-byte hex string and must differ from PLATFORM_TOKEN_ENCRYPTION_KEY (security requirement C-5). Missing this during deployment will cause runtime failures for all BYOK-related features.

## Findings

**Source agents:** deployment-review, security-audit

**Evidence:**

- File: `.env.example`
- Issue: BYOK_ENCRYPTION_KEY is not listed, meaning developers and deployment pipelines have no documentation that this variable is required
- File: `packages/backend/.env.example`
- Issue: Same omission at the package level — BYOK_ENCRYPTION_KEY not documented
- Requirement: Security requirement C-5 mandates that BYOK_ENCRYPTION_KEY must differ from PLATFORM_TOKEN_ENCRYPTION_KEY. No startup validation enforces this.

## Proposed Solutions

### Option A: Add to .env.example with startup validation

- **Approach:** Add BYOK_ENCRYPTION_KEY to both .env.example files with generation instructions (`openssl rand -hex 32`). Add a startup check in the config/env validation layer that: (1) verifies the key exists, (2) validates it's a 32-byte hex string, (3) verifies it differs from PLATFORM_TOKEN_ENCRYPTION_KEY.
- **Effort:** Small
- **Risk:** Low

### Option B: Add to .env.example only

- **Approach:** Add the variable to .env.example files with clear comments. Rely on runtime errors to catch misconfiguration. Simpler but less safe.
- **Effort:** Small
- **Risk:** Medium

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `.env.example`
- `packages/backend/.env.example`

## Acceptance Criteria

- [ ] BYOK_ENCRYPTION_KEY is documented in all .env.example files with generation instructions
- [ ] Application fails to start if BYOK_ENCRYPTION_KEY is missing
- [ ] Application fails to start if BYOK_ENCRYPTION_KEY equals PLATFORM_TOKEN_ENCRYPTION_KEY
- [ ] Application fails to start if BYOK_ENCRYPTION_KEY is not a valid 32-byte hex string
- [ ] Startup error messages are clear and actionable
- [ ] Deployment documentation references the new required variable

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
