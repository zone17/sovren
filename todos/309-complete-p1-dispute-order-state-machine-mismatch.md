---
status: complete
priority: p1
issue_id: 309
tags: [code-review, database, business-logic]
---

# `disputeOrder` state machine mismatch — service allows `escrow_funded` -> `disputed` but DB blocks it

## Problem Statement

The MarketplaceService's `disputeOrder` method attempts to transition orders from `escrow_funded` to `disputed`, but the DB state machine trigger only allows `in_progress` -> `disputed`. The update silently succeeds with 0 rows affected, leaving the order in the wrong state.

## Findings

- `packages/backend/src/services/community/MarketplaceService.ts`: `disputeOrder` method updates status from `escrow_funded` to `disputed`
- `supabase/migrations/20260220100400_epic010_security_hardening.sql`: state machine trigger only allows `in_progress` -> `disputed`
- The update will silently fail (0 rows updated) because the WHERE clause won't match
- Users will believe their dispute was filed but no state change occurs

## Proposed Solutions

1. **Option A** — Update DB trigger to also allow `escrow_funded` -> `disputed`:

```sql
ELSIF NEW.status = 'disputed' THEN
  IF OLD.status NOT IN ('in_progress', 'escrow_funded') THEN
    RAISE EXCEPTION 'Can only dispute in_progress or escrow_funded orders';
  END IF;
```

2. **Option B** — Change service to only allow disputes on `in_progress` orders (align with DB):

```typescript
const { data } = await supabase
  .from('marketplace_orders')
  .update({ status: 'disputed' })
  .eq('id', orderId)
  .eq('status', 'in_progress') // changed from escrow_funded
  .select();
```

Choose based on business requirements — can a buyer dispute before work starts (escrow_funded) or only after (in_progress)?

## Technical Details

- **Affected Files**:
  - `packages/backend/src/services/community/MarketplaceService.ts`
  - `supabase/migrations/20260220100400_epic010_security_hardening.sql`
- **Components**: Marketplace order dispute flow, state machine trigger

## Acceptance Criteria

- [ ] Service and DB agree on allowed dispute transitions
- [ ] Dispute operation either succeeds with correct state change or returns a meaningful error
