---
status: pending
priority: p3
issue_id: '134'
tags:
  - code-review
  - reliability
  - payment
dependencies: []
---

# 134: Unhandled Async in LightningPaymentService Constructor

## Problem Statement

`LightningPaymentService` constructor (lines 134, 141-151) calls async `initializeService()` but constructors can't await. Initialization errors (loading wallet providers, setting up monitoring) result in unhandled promise rejections. The `throw error` on line 150 goes nowhere.

## Findings

- Constructor calls async `initializeService()` on lines 134, 141-151
- Constructors cannot await promises
- Initialization errors from wallet provider loading are not caught
- Monitoring setup failures are not handled
- `throw error` on line 150 results in unhandled promise rejection
- Service may appear constructed but be in broken state

## Proposed Solutions

**Option A: Factory Pattern**

- Use factory pattern: `static async create()`
- Effort: Small
- Risk: Low
- Benefit: Idiomatic async initialization, errors properly caught

**Option B: Explicit Initialize Method**

- Add explicit `initialize()` method that must be awaited
- Effort: Small
- Risk: Low
- Benefit: Minimal refactoring, clear initialization contract

## Acceptance Criteria

- [ ] Service initialization errors are caught and handled
- [ ] No unhandled promise rejections from constructor
- [ ] Initialization failures prevent service from being used
- [ ] Clear error messages for initialization failures

## Work Log

| Date       | Action                                      | Learnings                                                                                               |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Async constructor calls result in unhandled rejections; need factory pattern or explicit initialization |
