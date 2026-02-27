---
status: pending
priority: p2
issue_id: '582'
tags: [code-review, pr-108, backend, patterns]
---

# Duplicate DISCOVERY_CATEGORIES constant in backend route

## Problem Statement

`DISCOVERY_CATEGORIES` is defined identically in `discovery.routes.ts` (lines 49-58) and `@shared/types/discovery.ts` (lines 10-19). The backend should import from shared. If categories drift, backend Zod validation will accept/reject different values than frontend displays.

**Flagged by: Kieran TS, Architecture, Pattern Recognition, Simplicity, Security (5/10 agents)**

## Proposed Solutions

```typescript
// discovery.routes.ts — replace local const with import
import { DISCOVERY_CATEGORIES } from '@shared/types/discovery';
```

Delete lines 49-58 in the route file.

## Acceptance Criteria

- [ ] Backend imports DISCOVERY_CATEGORIES from @shared/types/discovery
- [ ] Local duplicate deleted from discovery.routes.ts
