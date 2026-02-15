---
status: pending
priority: p2
issue_id: '127'
tags:
  - code-review
  - architecture
  - dependency-injection
dependencies: []
---

# 127: Dual DI System — inversify Decorators on Custom ServiceContainer

## Problem Statement

Controllers use inversify `@injectable()` and `@inject(TYPES.X)` decorators (e.g., ContentController.ts, PaymentController.ts, UserController.ts), but the actual container is a custom `ServiceContainer`/`ServiceRegistry` that doesn't use inversify's Container class. The `@inject` decorators are metadata-only — the custom container ignores them. Constructor injection works by coincidence (lazy resolution via `getController()` in route files), not by DI framework design.

## Findings

Misleading architecture. Decorators suggest inversify DI but actual container is custom. Constructor injection works by accident, not design. This creates maintenance confusion.

## Proposed Solutions

1. **Option A**: Remove inversify decorators and use pure custom container. Effort: Medium, Risk: Low.
2. **Option B**: Migrate to inversify Container fully. Effort: Large, Risk: Medium.
3. **Option C**: Keep decorators as documentation but add comment explaining they're not functional. Effort: Small, Risk: Low.

## Acceptance Criteria

- [ ] Single DI system in use
- [ ] No misleading decorators
- [ ] Constructor injection works by design not accident
- [ ] ADR documenting DI architecture choice

## Work Log

| Date       | Action                                      | Learnings                                                                               |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Dual DI systems create confusion and technical debt — architectural clarity is critical |
