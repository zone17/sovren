---
status: pending
priority: p2
issue_id: 771
tags: [code-review, typescript, types, shared]
dependencies: []
---

# Duplicate UserRole Enum with Incompatible Members

## Problem Statement

Two UserRole enums exist: `user.ts` has {CREATOR, SUPPORTER, ADMIN} and `api-handlers.ts` has {ADMIN, CREATOR, USER, GUEST}. The barrel export re-exports from user.ts, so consumers get different enums depending on import path. Runtime role checks may fail silently.

## Findings

- **TypeScript Agent**: P1-2 — `shared/src/types/user.ts` line 4 vs `api-handlers.ts` line 53

## Proposed Solutions

Consolidate to a single UserRole definition. If API layer needs USER/GUEST, extend the domain enum.

## Acceptance Criteria

- [ ] Single canonical UserRole definition
- [ ] All imports reference the same enum
- [ ] No runtime role check mismatches
