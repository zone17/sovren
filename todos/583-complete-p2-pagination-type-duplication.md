---
status: pending
priority: p2
issue_id: '583'
tags: [code-review, pr-108, shared, patterns]
---

# DiscoveryResponse.pagination duplicates shared Pagination type

## Problem Statement

`DiscoveryResponse` defines an inline pagination shape identical to the existing `Pagination` type at `packages/shared/src/types/index.ts:95-104`. Should reuse the shared type.

**Flagged by: Kieran TS, Architecture, Pattern Recognition (3/10 agents)**

## Proposed Solutions

```typescript
import type { Pagination } from './index';

export interface DiscoveryResponse {
  creators: CreatorSearchResult[];
  pagination: Pagination;
}
```

## Acceptance Criteria

- [ ] DiscoveryResponse uses shared Pagination type
- [ ] Inline pagination shape removed from discovery.ts
