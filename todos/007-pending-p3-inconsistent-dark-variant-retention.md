---
status: pending
priority: p3
issue_id: "007"
tags: [code-review, design-system, consistency]
dependencies: []
---

# P3: Inconsistent `dark:` Variant Retention on Semantic Colors

## Problem Statement

Some files mix token-based colors with `dark:` prefix variants for semantic colors (blue, red, green). For example, a button has `text-blue-600 dark:text-blue-400` alongside `disabled:text-muted-foreground/60` — the disabled state uses tokens but the base state uses hardcoded `dark:` variants.

**Agent consensus: 2/7** (frontend-races-reviewer, code-simplicity-reviewer)

## Findings

~5 files affected, primarily in:
- `RelayErrorDashboard.tsx` — retry buttons mix `dark:text-blue-400` with token disabled states
- `DMInbox.tsx` — surviving `dark:text-blue-400`

The semantic colors (blue, red, green) were intentionally left as hardcoded values (correct — they represent status, not theme). But some files have `dark:` variants on these colors while the rest of the file uses tokens for neutral colors. This creates maintenance confusion.

## Proposed Solutions

### Option A: Document semantic color exception consistently
- List all intentional `dark:` retained colors in a design system doc comment
- **Effort**: Small
- **Risk**: None

### Option B: Create `--info`/`--success`/`--warning` tokens for semantic colors
- **Effort**: Medium (new tokens + migration)
- Deferred to future design system iteration

## Acceptance Criteria

- [ ] Decision documented (keep `dark:` for semantic colors OR tokenize)
- [ ] Consistent within each file

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from PR #159 review | 2/7 agent consensus |

## Resources

- PR: #159
