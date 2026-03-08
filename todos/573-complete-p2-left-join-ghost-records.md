---
status: pending
priority: p2
issue_id: '573'
tags: [code-review, pr-108, data-integrity]
---

# Filter out ghost records from LEFT JOIN and add null guards

## Problem Statement

Supabase nested selects use LEFT JOIN. A `creator_profiles` row with no matching `users` row returns `users: null`, producing a ghost `CreatorSearchResult` with empty displayName, empty username, and 0 followers. The `createdAt` field also lacks a null guard unlike every other mapped field.

**Flagged by: Data Integrity Guardian**

## Findings

- Row mapping: `const user = row.users ?? {};` — produces empty object for null users
- `createdAt: row.created_at` — no null fallback (every other field has `?? default`)
- CreatorCard would render with `@` and empty avatar for ghost records

## Proposed Solutions

```typescript
// Filter nulls
.filter((row: any) => row.users != null)
// Add null guard
createdAt: row.created_at ?? new Date().toISOString(),
```

Or use `!inner` join syntax for INNER JOIN behavior.

## Acceptance Criteria

- [ ] Ghost records filtered out before mapping
- [ ] createdAt has null fallback
