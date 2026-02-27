---
status: pending
priority: p2
issue_id: '567'
tags: [code-review, pr-108, backend, ux]
---

# Fix relevance sort to differ from followers sort

## Problem Statement

The `relevance` and `followers` sort options both map to `follower_count DESC`. The switch statement has 3 branches but only 2 distinct behaviors. The `relevance` sort should incorporate engagement or content signals, or be removed.

**Consensus: 4/9 agents (Performance Oracle, Agent-Native, Git History, Simplicity)**

## Findings

- `discovery.routes.ts`, lines 77-85: switch with 3 cases, 2 identical
- Default branch (relevance) duplicates the `followers` case
- The plan doc acknowledges this as "follower_count as proxy for relevance"

## Proposed Solutions

**Option A: Collapse to if/else + document (Recommended for Sprint 0)**

```typescript
if (sort === 'newest') {
  query = query.order('created_at', { ascending: false });
} else {
  // Both 'relevance' and 'followers' use follower_count (no engagement score yet)
  query = query.order('follower_count', { ascending: false });
}
```

**Option B: Remove 'relevance' option until real implementation exists**

## Acceptance Criteria

- [ ] Sort logic simplified to 2 actual branches
- [ ] Comment documents that relevance = followers for Sprint 0
