---
status: complete
priority: p1
issue_id: 308
tags: [code-review, database, types]
---

# `release_status` CHECK constraint + shared type union incomplete

## Problem Statement

The MarketplaceService writes `pending`, `completed`, and `permanently_failed` status values, but the DB CHECK constraint and TypeScript union only allow `idle`, `processing`, `released`, `failed`. Orders reaching these states will be rejected by the database or mishandled by the frontend.

## Findings

- `supabase/migrations/20260220100300_epic010_marketplace.sql`: CHECK constraint only allows `idle`, `processing`, `released`, `failed`
- `packages/shared/src/types/community.ts` line 105: TypeScript union only has `idle | processing | released | failed`
- `packages/backend/src/services/community/MarketplaceService.ts` line 260: writes `pending`
- `packages/backend/src/services/community/MarketplaceService.ts` line 408: writes `completed`
- `packages/backend/src/services/community/MarketplaceService.ts` line 438: writes `permanently_failed`
- Database will reject inserts/updates with these three values, causing runtime errors

## Proposed Solutions

1. Create a new migration to alter the CHECK constraint:

```sql
ALTER TABLE marketplace_orders
  DROP CONSTRAINT marketplace_orders_release_status_check;
ALTER TABLE marketplace_orders
  ADD CONSTRAINT marketplace_orders_release_status_check
  CHECK (release_status IN ('idle', 'processing', 'released', 'failed', 'pending', 'completed', 'permanently_failed'));
```

2. Update the TypeScript union:

```typescript
type ReleaseStatus =
  | 'idle'
  | 'processing'
  | 'released'
  | 'failed'
  | 'pending'
  | 'completed'
  | 'permanently_failed';
```

## Technical Details

- **Affected Files**:
  - `supabase/migrations/20260220100300_epic010_marketplace.sql`
  - `packages/shared/src/types/community.ts`
  - `packages/backend/src/services/community/MarketplaceService.ts`
- **Components**: Marketplace order release status state machine

## Acceptance Criteria

- [ ] CHECK constraint includes all 7 status values
- [ ] TypeScript union includes all 7 status values
- [ ] MarketplaceService can write `pending`, `completed`, and `permanently_failed` without DB errors
