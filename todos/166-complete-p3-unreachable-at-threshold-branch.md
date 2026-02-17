---
status: pending
priority: p3
issue_id: "166"
tags: [code-review, pr-82, phase-7, dead-code, simplicity]
dependencies: []
---

# Unreachable at_threshold Branch in ScheduleService

## Problem Statement
`ScheduleService.ts` (lines 142-147) has a `case 'at_threshold'` branch in the schedule recommendation logic that can never execute because the scoring algorithm only produces `below`, `above`, or `critical`.

## Findings
- ScheduleService lines 142-147: `case 'at_threshold': ...`
- BurnoutScoringService only returns: 'low', 'medium', 'high', 'critical'
- 'at_threshold' never appears in any scoring output
- Dead code that adds confusion
- Flagged by: code-simplicity-reviewer, pattern-recognition-specialist, architecture-strategist

## Proposed Solutions
### Option 1: Remove Dead Branch
**Approach:** Remove the `at_threshold` case.
**Effort:** 5 minutes | **Risk:** Low

## Technical Details
- `packages/backend/src/services/wellness/ScheduleService.ts` lines 142-147

## Acceptance Criteria
- [ ] Dead branch removed
- [ ] No references to 'at_threshold' in codebase

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: dead-code, simplicity
