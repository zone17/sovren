---
status: pending
priority: p3
issue_id: "169"
tags: [code-review, pr-82, phase-7, typescript, type-safety, di-container]
dependencies: []
---

# 16 `as any` Casts in Phase 7 DI Bindings

## Problem Statement
`phase7.bindings.ts` uses 16 `as any` casts to register services in the DI container, defeating TypeScript's type safety for the entire Phase 7 service layer.

## Findings
- `packages/backend/src/container/bindings/phase7.bindings.ts` — 16 `as any` assertions
- Each cast suppresses type errors that could reveal real interface mismatches
- Related to todo 074 (97x ServiceToken&lt;any&gt; in container/types.ts)
- Flagged by: kieran-typescript-reviewer, code-simplicity-reviewer

## Proposed Solutions
### Option 1: Type DI Registrations Properly
**Approach:** Define proper interfaces for each service and use typed `container.register<IWellnessService>(TYPES.WellnessService, factory)` calls.
**Pros:** Type-safe DI, catches interface mismatches at compile time
**Cons:** Requires interface definitions for each service
**Effort:** 2-3 hours
**Risk:** Low

## Technical Details
- `packages/backend/src/container/bindings/phase7.bindings.ts`
- `packages/backend/src/container/types.ts`

## Acceptance Criteria
- [ ] Zero `as any` casts in phase7.bindings.ts
- [ ] All service registrations type-safe
- [ ] Interfaces defined for all Phase 7 services

## Resources
- **PR:** #82
- **Related:** todo 074 (ServiceToken&lt;any&gt;)
- **Agents:** kieran-typescript-reviewer, code-simplicity-reviewer

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: typescript, type-safety, di-container
