---
status: pending
priority: p3
issue_id: '147'
tags:
  - code-review
  - round-7
  - architecture
  - circular-dependency
dependencies: []
---

# 147: Circular Dependency Chains in Backend Services

## Problem Statement

Multiple circular dependency chains exist in the backend:
- `error-handler-middleware.ts` re-exports from `utils/errors.ts` which imports `AppError` from middleware
- Services importing from barrel exports that re-export from sibling services
- DI container importing service types that import container types

**Why it matters**: Circular dependencies cause unpredictable module initialization order. In TypeScript with runtime decorators (inversify), this can cause `undefined` errors at startup.

## Findings

**Architecture Strategist (Round 7)**: Flagged as P1 — circular dependencies create fragile module loading.

**Note**: Per MEMORY.md, the error-handler-middleware re-export cycle was verified safe (function-level refs resolve at call time). However, other cycles may not be safe.

## Proposed Solutions

### Option A: Break Cycles with Interface Files
**Effort**: Medium | **Risk**: Low

Extract shared interfaces into separate files that don't import implementations.

## Acceptance Criteria

- [ ] `madge --circular` reports reduced cycle count (target: zero NEW cycles)
- [ ] Error-handler-middleware cycle explicitly documented as safe (function-level refs)
- [ ] DI container circular imports broken via interface extraction
- [ ] Test: all services importable independently without runtime errors

**Scope note**: Focus on verified-unsafe cycles (DI container, barrel export cycles). Skip error-handler cycle (verified safe per prior analysis — function-level refs resolve at call time, not module init).

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 architecture review | Some circular deps are safe (function refs), others are not |
