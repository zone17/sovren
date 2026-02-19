---
status: complete
priority: p2
issue_id: '284'
tags: [code-review, architecture, barrel-exports]
dependencies: []
---

# Shared Types Barrel Missing community.ts/finance.ts Exports

## Problem Statement

packages/shared/src/types/index.ts barrel file does not re-export the new community and finance type modules. Frontend imports must use deep paths instead of the barrel, breaking the established pattern.

## Findings

- `packages/shared/src/types/index.ts` — missing export \* from './community' and './finance'
- `packages/shared/src/types/community.ts` — exists but not exported
- `packages/shared/src/types/finance.ts` — exists but not exported

## Proposed Solutions

### Option 1: Add barrel re-exports

**Approach:** Add `export * from './community'` and `export * from './finance'` to the barrel file.
**Effort:** 15min **Risk:** Low

## Acceptance Criteria

- [ ] Barrel re-exports community types
- [ ] Barrel re-exports finance types
- [ ] Frontend imports work via barrel path

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
