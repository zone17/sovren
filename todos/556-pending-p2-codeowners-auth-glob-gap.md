---
status: pending
priority: p2
issue_id: '556'
tags: [code-review, security, pr-104]
---

# CODEOWNERS auth\* pattern won't match auth/ subdirectories

## Problem Statement

Line 33 of `.github/CODEOWNERS` uses `auth*` which matches flat files (`auth.ts`, `auth-middleware.ts`) but NOT files in subdirectories (`auth/strategies/jwt.ts`). If auth middleware is refactored into a directory, the security override silently stops matching. Also missing: crypto/encryption utilities, wallet service, subscription service.

## Findings

- **2/2 agents flagged** (security-sentinel, architecture-strategist)

## Proposed Solutions

Add additional patterns:

```
/packages/backend/src/middleware/auth*       @zone17/tech-leads
/packages/backend/src/middleware/auth/**     @zone17/tech-leads
/packages/backend/src/utils/crypto*          @zone17/tech-leads
/packages/backend/src/utils/encrypt*         @zone17/tech-leads
/packages/backend/src/services/wallet/       @zone17/tech-leads
/packages/backend/src/services/subscription/ @zone17/tech-leads
```

## Acceptance Criteria

- [ ] Auth glob covers both flat files and subdirectories
- [ ] Crypto/encryption utilities require tech-lead review
