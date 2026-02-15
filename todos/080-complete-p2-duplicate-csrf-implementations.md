---
status: pending
priority: p2
issue_id: 080
tags: [code-review, patterns, duplication, security]
dependencies: []
---

# Duplicate CSRF Implementations

## Problem Statement

Two CSRF middleware implementations exist in the codebase with different approaches. This creates confusion about which is active and potential for one to be bypassed.

## Findings

- **Pattern Recognition P1-02**: Two competing CSRF implementations.
- **Code Simplicity P1-006**: Overlapping CSRF logic across files.
- Overlaps with existing todo 055 (CSRF cookie config) but this finding is about the duplication itself.

## Proposed Solutions

### Option A: Consolidate to single CSRF middleware (Recommended)

Keep the better implementation, delete the other.
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Single CSRF middleware file
- [ ] All routes use the consolidated CSRF protection
- [ ] No duplicate CSRF implementations
