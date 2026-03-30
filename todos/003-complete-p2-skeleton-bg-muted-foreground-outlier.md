---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, design-system, consistency]
dependencies: []
---

# P2: Skeleton Uses `bg-muted-foreground/20` Instead of `bg-muted`

## Problem Statement

One skeleton loading element uses `bg-muted-foreground/20` while all other skeletons (~20+) use `bg-muted`. This inconsistency causes one skeleton to render differently.

**Agent consensus: 1/7** (pattern-recognition-specialist)

## Findings

```
- className="animate-pulse bg-gray-200 rounded"
+ className="animate-pulse bg-muted-foreground/20 rounded"
```

Every other `bg-gray-200 animate-pulse` consistently becomes `bg-muted animate-pulse`. This is a one-off deviation.

## Proposed Solutions

### Option A: Change to `bg-muted` (Recommended)
- **Effort**: Small (1-line fix)
- **Risk**: None

## Acceptance Criteria

- [ ] All skeleton/loading elements use `bg-muted` consistently
- [ ] No `bg-muted-foreground/20` used for skeletons

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from PR #159 review | Single outlier |

## Resources

- PR: #159
