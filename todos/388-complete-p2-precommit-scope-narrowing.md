---
status: pending
priority: p2
issue_id: 388
tags:
  - code-review
  - testing
  - schema-drift
dependencies: []
---

# Pre-Commit Script Scope Narrowed During Remediation

## Problem Statement

The `test:pre-commit` script scope was narrowed during remediation. This may miss regressions in areas that were previously covered, reducing the safety net for future changes.

## Findings

**Source agents:** testing-agent, schema-drift-agent, code-review-agent

**Evidence:**

- File: `scripts/check-antipatterns.sh`
- Issue: Script scope may have been reduced during previous remediation sprints
- File: `.husky/pre-commit`
- Issue: Pre-commit hook may not run all critical checks

## Proposed Solutions

### Option A: Review and restore scope

- **Approach:** Review the scope change history (git log) and ensure critical checks (anti-pattern scanner, type checking) are still comprehensive. Restore any checks that were removed without justification.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `scripts/check-antipatterns.sh`
- `.husky/pre-commit`

## Acceptance Criteria

- [ ] Pre-commit script scope is reviewed against its original coverage
- [ ] Any unjustified scope reductions are restored
- [ ] Anti-pattern scanner covers all backend and frontend source files
- [ ] Type checking runs against the full project scope
- [ ] Documentation explains any intentional scope exclusions

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
