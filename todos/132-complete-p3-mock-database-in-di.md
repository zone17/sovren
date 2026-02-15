---
status: pending
priority: p3
issue_id: '132'
tags:
  - code-review
  - architecture
  - dependency-injection
dependencies: []
---

# 132: Mock Database Binding in DI Container Returns Empty Results

## Problem Statement

`bootstrap.ts` (lines 231-237) registers `TYPES.Database` as a mock that returns `{ rows: [], rowCount: 0 }` for any query and silently succeeds transactions. If any service resolves this through DI and calls `db.query`, it gets empty results with no error — very hard to diagnose.

## Findings

- Lines 231-237 of `bootstrap.ts` register mock database binding
- Mock returns empty result set for all queries without errors
- Transactions silently succeed without performing any operations
- Services using this binding get no feedback that they're using a mock
- Debugging accidental mock usage becomes extremely difficult

## Proposed Solutions

**Option A: Throw NotImplementedError**

- Throw NotImplementedError from mock database methods so accidental use is caught immediately
- Effort: Trivial
- Risk: Minimal
- Benefit: Fail-fast behavior, immediate detection of misconfiguration

**Option B: Remove Mock Binding**

- Remove the mock and let resolution fail loudly
- Effort: Trivial
- Risk: Minimal
- Benefit: Forces explicit database configuration, no silent failures

## Acceptance Criteria

- [ ] Mock database throws on query instead of returning empty results
- [ ] Or mock database binding replaced with real database binding
- [ ] Accidental use of mock is immediately detectable
- [ ] No silent failures from empty result sets

## Work Log

| Date       | Action                                      | Learnings                                                              |
| ---------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Silent mock failures make debugging difficult; need fail-fast behavior |
