---
status: pending
priority: p3
issue_id: "172"
tags: [code-review, pr-82, phase-7, architecture, srp, god-object, refactoring]
dependencies: []
---

# WellnessService God Object — Consider Decomposition

## Problem Statement
WellnessService handles wellness snapshots, benchmarks, pulse check-ins, work patterns, data deletion, and resource library — too many responsibilities for one class.

## Findings
- 400+ lines handling 6+ distinct concerns
- Violates Single Responsibility Principle
- Already has sibling services (BurnoutScoringService, ScheduleService, BoundaryService) but wellness core is monolithic
- Flagged by: architecture-strategist, code-simplicity-reviewer

## Proposed Solutions
### Option 1: Extract Sub-Services
**Approach:** Split into WellnessSnapshotService, PulseCheckInService, WorkPatternService. Keep WellnessService as thin orchestrator.
**Effort:** 3-4 hours | **Risk:** Medium (refactoring)

### Option 2: Keep as-is with TODO
**Approach:** Accept for MVP, decompose when adding features.
**Effort:** 0 | **Risk:** Low (technical debt accepted)

## Technical Details
- `packages/backend/src/services/wellness/WellnessService.ts`

## Acceptance Criteria
- [ ] If decomposed: Each service has single responsibility
- [ ] If deferred: TODO comment added with decomposition plan

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: architecture, srp, god-object, refactoring
