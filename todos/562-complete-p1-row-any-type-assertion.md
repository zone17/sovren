---
status: pending
priority: p1
issue_id: '562'
tags: [code-review, pr-108, type-safety]
---

# Replace `row: any` with typed interface in discovery route mapping

## Problem Statement

The row mapping uses `(row: any)` which completely defeats TypeScript's type safety. The project standard is zero `any` types with 94%+ type coverage. If the Supabase query shape changes (column rename, table restructure), this will fail at runtime with no compile-time warning.

**Consensus: 5/9 agents flagged this (Kieran TS, Architecture, Git History, Pattern Recognition, Simplicity)**

## Findings

- **File**: `packages/backend/src/routes/v2/discovery.routes.ts`, line ~100
- **Code**: `(rows ?? []).map((row: any) => { ... })`
- **CLAUDE.md**: "Eliminate all `any` types"
- **Risk**: Future schema changes (column rename, nullable change) won't be caught at compile time

## Proposed Solutions

**Option A: Define local row interface (Recommended)**

```typescript
interface CreatorProfileRow {
  id: string;
  bio: string | null;
  categories: string[] | null;
  created_at: string;
  users: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    nip05_verified: boolean | null;
  } | null;
  creators: {
    follower_count: number | null;
    content_count: number | null;
    tags: string[] | null;
    verified: boolean | null;
  } | null;
}
```

**Option B: Supabase generated types**
Use Supabase CLI `supabase gen types typescript` to auto-generate types from the schema.

## Acceptance Criteria

- [ ] `any` type removed from row mapping
- [ ] Typed interface covers all accessed properties with correct nullability
- [ ] TypeScript compiler catches missing/renamed properties
