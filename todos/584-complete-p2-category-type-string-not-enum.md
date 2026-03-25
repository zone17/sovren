---
status: pending
priority: p2
issue_id: '584'
tags: [code-review, pr-108, shared, types]
---

# DiscoveryFilters.category typed as string instead of DiscoveryCategory

## Problem Statement

`DiscoveryFilters.category` is `string` but backend Zod constrains to `z.enum(DISCOVERY_CATEGORIES)`. The shared type should reflect this for compile-time safety. Also `CreatorSearchResult.categories` is `string[]` but should be `DiscoveryCategory[]`.

**Flagged by: Kieran TS, Architecture (2/10 agents)**

## Proposed Solutions

```typescript
export interface DiscoveryFilters {
  category?: DiscoveryCategory; // was: string
  // ...
}

export interface CreatorSearchResult {
  categories: DiscoveryCategory[]; // was: string[]
  // ...
}
```

## Acceptance Criteria

- [ ] DiscoveryFilters.category typed as DiscoveryCategory
- [ ] CreatorSearchResult.categories typed as DiscoveryCategory[]
