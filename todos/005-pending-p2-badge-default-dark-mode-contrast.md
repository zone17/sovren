---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, design-system, dark-mode, accessibility]
dependencies: []
---

# P2: Badge Default States May Blend with Card Background in Dark Mode

## Problem Statement

Multiple badge/status components map `bg-gray-100 text-gray-800` to `bg-muted text-foreground`. In dark mode, `--muted` (240 15% 18%) and `--card` (240 18% 12%) are visually close, causing "default"/"expired"/"unknown" badges to blend into their card container backgrounds.

**Agent consensus: 1/7** (architecture-strategist)

## Findings

Affected components:
- `NIP05Manager.tsx` — expired/default badges
- `SessionManager.tsx` — default device type
- `PaymentHistory.tsx` — pending/unknown statuses

The original `bg-gray-100` had clear contrast against `bg-white` containers. The token `bg-muted` against `bg-card` in dark mode has much less visual separation.

## Proposed Solutions

### Option A: Use `bg-secondary text-secondary-foreground` for badges
- **Pros**: Better visual separation; semantically correct for "neutral" badges
- **Effort**: Small (find-replace in ~5 files)
- **Risk**: Low

### Option B: Keep `bg-muted` but verify visually
- **Pros**: No code change if contrast is acceptable
- **Effort**: Small (visual check)

## Acceptance Criteria

- [ ] Default/neutral badges are visually distinct from card backgrounds in dark mode
- [ ] Badge text readable against badge background in both themes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from PR #159 review | Dark mode contrast concern |

## Resources

- PR: #159
