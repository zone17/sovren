---
status: pending
priority: p2
issue_id: "161"
tags: [code-review, pr-82, phase-7, typescript, type-safety, logging]
dependencies: []
---

# Logger Typed as Function Instead of ILogger Interface

## Problem Statement
Multiple Phase 7 services accept `logger` typed as `Function` instead of a proper `ILogger` interface. This defeats TypeScript's type safety — any function can be passed as a logger, and method calls like `logger.error()` are not type-checked.

## Findings
- Multiple service constructors: `constructor(private logger: Function)`
- Should be: `constructor(private logger: ILogger)` where ILogger defines `info()`, `warn()`, `error()`, `debug()`
- Calling `logger.error(msg)` on a `Function` type is unchecked — no compile-time guarantee the method exists
- Flagged by: kieran-typescript-reviewer

## Proposed Solutions
### Option 1: Use ILogger Interface (Recommended)
**Approach:** Create or reuse `ILogger` interface and type all logger parameters correctly.
**Pros:** Type-safe, self-documenting, catches errors at compile time
**Cons:** None
**Effort:** 30 minutes
**Risk:** Low

## Technical Details
- All Phase 7 service files in `packages/backend/src/services/wellness/` and `packages/backend/src/services/provenance/`
- `packages/backend/src/interfaces/` (ILogger may already exist)

## Acceptance Criteria
- [ ] Logger parameter typed as ILogger (not Function)
- [ ] ILogger interface defines info, warn, error, debug methods
- [ ] All Phase 7 services use the typed logger

## Resources
- **PR:** #82
- **Agents:** kieran-typescript-reviewer

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: typescript, type-safety, logging
