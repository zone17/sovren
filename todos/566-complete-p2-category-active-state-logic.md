---
status: pending
priority: p2
issue_id: '566'
tags: [code-review, pr-108, frontend, readability]
---

# Simplify category active-state logic in DiscoveryPage

## Problem Statement

The className conditional for highlighting the active category is a tangled boolean expression that works by accident. Two separate inline expressions must stay in sync for `className` and `aria-pressed`.

**Consensus: 3/9 agents (Kieran TS, Simplicity, Pattern Recognition)**

## Findings

- `DiscoveryPage.tsx`, lines ~44-51
- Current: `(filters.category ?? 'All') === (category === 'All' ? undefined : category) || (!filters.category && category === 'All')`
- Works correctly but is hard to read and error-prone

## Proposed Solutions

Extract a helper variable:

```typescript
const isActive = category === 'All' ? !filters.category : filters.category === category;
```

Use `isActive` for both className and aria-pressed.

## Acceptance Criteria

- [ ] Category highlighting logic extracted to single readable variable
- [ ] Both className and aria-pressed use the same variable
- [ ] Active state behavior unchanged
