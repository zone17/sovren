---
status: complete
priority: p2
issue_id: 598
tags: [code-review, ci, testing]
dependencies: []
---

# Add Tracking for continue-on-error Removal Timeline

## Problem Statement

The integration test CI job uses `continue-on-error: true` for advisory mode during stabilization. Without a tracking mechanism (issue link, date, or concrete condition), advisory mode tends to persist indefinitely, silently masking failures including security-relevant tests.

**Why it matters:** 5/7 review agents flagged this — strongest consensus finding in the review.

## Findings

- **5/7 agents flagged** (pattern-recognition P2, architecture Info, security MEDIUM, agent-native Should, performance P2)

## Proposed Solutions

### Solution A: Add TODO Comment with Concrete Condition (Recommended)

```yaml
# TODO: Remove continue-on-error after 5 consecutive green integration runs on main
continue-on-error: true
```

- **Effort:** Small (1 line)
- **Risk:** None

### Solution B: Create GitHub Issue

Create a tracking issue and reference it in the CI comment.

## Technical Details

- **Affected file:** `.github/workflows/ci.yml` (line 255)

## Acceptance Criteria

- [ ] `continue-on-error: true` has a concrete removal condition in a comment
- [ ] Condition is measurable (not "when stable")

## Work Log

| Date       | Action                      | Learnings                              |
| ---------- | --------------------------- | -------------------------------------- |
| 2026-02-28 | Created from PR #110 review | Advisory CI modes need sunset tracking |

## Resources

- PR: #110
