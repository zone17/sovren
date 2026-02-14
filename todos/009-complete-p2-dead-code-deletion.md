---
status: pending
priority: p2
issue_id: 009
tags: [code-review, quality]
dependencies: []
---

# Dead Code Deletion

## Problem Statement

~8,500+ lines of dead code identified: pool.ts (502 lines, never imported), SecretsService.ts (473 lines, never imported), secrets.config.ts (252 lines), database-pool.config.ts (352 lines), vault-client.ts (420 lines with runtime bugs), rotate-database-credentials.ts (512 lines, incomplete).

## Findings

Code-simplicity-reviewer confirmed via Grep that pool.ts has zero imports from any application file (Supabase client used instead). SecretsService.ts has zero imports (process.env used directly). Architecture-strategist confirmed SecretsService not registered in DI container. vault-client.ts has variable shadowing bug at line 302 and hardcoded encryption key.

## Proposed Solutions

### Option A: Delete All Confirmed Dead Code Files

**Pros:** Immediate cleanup, reduced maintenance burden, clearer codebase
**Cons:** Permanent deletion requires confidence in analysis
**Effort:** Small
**Risk:** Low (verified no imports)

### Option B: Move to deprecated/ Directory First

**Pros:** Safety net for 1 sprint before permanent deletion, allows easy restoration if needed
**Cons:** Delays final cleanup
**Effort:** Small
**Risk:** Very Low

## Technical Details

**Affected Files:**

- packages/backend/src/database/pool.ts (502 lines)
- packages/backend/src/services/SecretsService.ts (473 lines)
- packages/backend/src/config/secrets.config.ts (252 lines)
- packages/backend/src/config/database-pool.config.ts (352 lines)
- scripts/lib/vault-client.ts (420 lines)
- scripts/rotate-database-credentials.ts (512 lines)

## Acceptance Criteria

- [ ] All confirmed dead code files removed or moved to deprecated/
- [ ] No import errors after deletion
- [ ] Build passes successfully
- [ ] All tests pass
- [ ] Git history preserves deleted code for reference

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
