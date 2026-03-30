---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, design-system, consistency]
dependencies: []
---

# P2: `text-gray-400` Mapped Inconsistently — 38 Missing `/60` Opacity

## Problem Statement

The token mapping spec defines `text-gray-400 -> text-muted-foreground/60`. However, 38 instances were mapped to plain `text-muted-foreground` (without `/60`), while 55 instances correctly use `text-muted-foreground/60`. This makes previously faint text (placeholders, timestamps, helper text) more prominent than intended.

**Agent consensus: 1/7** (pattern-recognition-specialist)

## Findings

- 55 instances: `text-gray-400` -> `text-muted-foreground/60` (correct per spec)
- 38 instances: `text-gray-400` -> `text-muted-foreground` (deviates from spec)
- 1 instance: `text-gray-400` -> `text-muted-foreground/40` (one-off)

The 38 deviating cases render secondary text at the same weight as `text-gray-500`/`text-gray-600` mappings, collapsing a visual hierarchy tier.

## Proposed Solutions

### Option A: Apply `/60` to all 38 instances (Recommended)
- **Pros**: Matches spec; preserves text hierarchy
- **Effort**: Medium (38 find-and-verify edits)
- **Risk**: Low

### Option B: Update spec to allow `text-muted-foreground` for gray-400
- **Pros**: Simpler token surface (fewer opacity tiers)
- **Cons**: Loses text hierarchy distinction
- **Effort**: Small (doc change only)

## Acceptance Criteria

- [ ] All `text-gray-400` mappings follow the same pattern
- [ ] Decision documented in spec/comments

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from PR #159 review | Spec compliance issue |

## Resources

- PR: #159
