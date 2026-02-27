---
status: pending
priority: p2
issue_id: '565'
tags: [code-review, pr-108, backend, validation]
---

# Validate category parameter as enum in Zod schema

## Problem Statement

The `category` parameter is `z.string().optional()` with no validation against the known category list. The frontend hardcodes 9 valid categories. Any arbitrary string passes through to `.contains('categories', [category])`, allowing category enumeration and wasted DB queries.

**Consensus: 3/9 agents (Security, Agent-Native, Pattern Recognition)**

## Findings

- `discovery.routes.ts`, line 23: `category: z.string().optional()`
- Frontend `CATEGORIES`: `['All', 'Art', 'Writing', 'Music', 'Podcast', 'Education', 'Photography', 'Development', 'Bitcoin']`
- No shared category enum between frontend and backend

## Proposed Solutions

**Option A: Zod enum (Recommended)**

```typescript
category: z.enum(['Art', 'Writing', 'Music', 'Podcast', 'Education', 'Photography', 'Development', 'Bitcoin']).optional(),
```

**Option B: Move CATEGORIES to shared package**
Define in `packages/shared/src/types/discovery.ts` and use in both Zod schema and frontend.

## Acceptance Criteria

- [ ] Backend rejects invalid category values
- [ ] Category values match between frontend and backend
