---
status: complete
priority: p1
issue_id: 317
tags: [code-review, database, data-integrity]
---

# Non-atomic multi-row `updateRevenueSplit` — partial write risk

## Problem Statement

The `updateRevenueSplit` method updates each collaborator's split individually in a loop. If the 3rd update fails, the first 2 are already committed, leaving splits that no longer sum to 10000 bps. This violates the documented two-layer validation invariant for revenue splits.

## Findings

- `packages/backend/src/services/community/CollaborativeContentService.ts` lines 245-257: loop updates each collaborator's split individually
- No transaction wrapping — each update is a separate Supabase call
- If any update fails mid-loop, previously committed updates remain
- Revenue splits can end up in an inconsistent state (not summing to 10000 bps)
- Violates the documented two-layer validation invariant

## Proposed Solutions

1. Create an atomic RPC function that performs all updates in a single transaction:

```sql
CREATE OR REPLACE FUNCTION update_revenue_splits_atomic(
  p_content_id UUID,
  p_splits JSONB  -- [{ "collaborator_id": "...", "bps": 2500 }, ...]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  total_bps INTEGER;
  split JSONB;
BEGIN
  -- Validate total = 10000
  SELECT SUM((s->>'bps')::INTEGER) INTO total_bps
  FROM jsonb_array_elements(p_splits) AS s;

  IF total_bps != 10000 THEN
    RAISE EXCEPTION 'Revenue splits must sum to 10000 bps, got %', total_bps;
  END IF;

  -- Update all splits atomically
  FOR split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    UPDATE revenue_splits
    SET revenue_split_bps = (split->>'bps')::INTEGER
    WHERE content_id = p_content_id
      AND collaborator_id = (split->>'collaborator_id')::UUID;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION update_revenue_splits_atomic(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_revenue_splits_atomic(UUID, JSONB) TO authenticated;
```

## Technical Details

- **Affected Files**:
  - `packages/backend/src/services/community/CollaborativeContentService.ts`
  - New migration for `update_revenue_splits_atomic` RPC
- **Components**: CollaborativeContentService, revenue split management

## Acceptance Criteria

- [ ] Revenue split updates are atomic — all succeed or all fail
- [ ] Splits are validated to sum to 10000 bps within the transaction
- [ ] Partial writes cannot leave splits in an inconsistent state
