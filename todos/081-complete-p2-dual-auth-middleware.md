---
status: pending
priority: p2
issue_id: 081
tags: [code-review, patterns, duplication, authentication]
dependencies: []
---

# Dual Auth Middleware Files with Overlapping Purpose

## Problem Statement

Two auth middleware files exist: `auth.ts` and `nostr-auth.ts` (service). Both handle authentication but with different patterns — one uses Express middleware, the other is a service class. Dead exports in `auth.ts` include `authRateLimit`, `handleAuthError`, `isAdmin`, `isCreator`, `isAuthenticated` — none imported anywhere.

## Findings

- **Code Simplicity P1-005**: Two auth files with overlapping purpose.
- **Pattern Recognition P2**: Auth middleware sends JSON directly instead of throwing AppErrors.
- **TypeScript Quality P2-010**: `handleAuthError` uses `console.error` instead of logger.

## Proposed Solutions

### Option A: Clean up auth.ts dead exports, clarify responsibilities

Remove dead exports from `auth.ts`. Document that `auth.ts` = Express middleware, `nostr-auth.ts` = NOSTR-specific service.
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Dead exports removed from auth.ts
- [ ] Clear separation of responsibilities documented
- [ ] Auth errors thrown as AppErrors (not raw JSON responses)
