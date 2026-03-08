---
status: pending
priority: p3
issue_id: 756
tags: [code-review, slice-8, database, migration, performance]
dependencies: []
---

# P3: Unbatched backfill in follow count migration

## Problem Statement

The follow count migration backfills existing follow counts by processing all rows in a single query. On large tables (1M+ rows), this can exceed timeout limits or consume excessive memory. Batch processing in groups of 1000 would complete reliably and use predictable resources.

## Findings

- File: `supabase/migrations/20260306000001_follow_count_trigger.sql`
- Current behavior: Single UPDATE or SELECT loop without batching
- Risk: Timeout on large databases; memory consumption spikes
- Better approach: Batch in groups of 1000 using DO block with LOOP

## Proposed Solutions

Implement batched backfill using PL/pgSQL:

```sql
DO $$
DECLARE
  batch_size INTEGER := 1000;
  total_processed INTEGER := 0;
  rows_in_batch INTEGER;
BEGIN
  LOOP
    -- Update follow counts in batches
    WITH creator_batches AS (
      SELECT DISTINCT creator_id
      FROM follows
      ORDER BY creator_id
      LIMIT batch_size
      OFFSET total_processed
    )
    UPDATE creators c
    SET follow_count = (
      SELECT COUNT(*)
      FROM follows f
      WHERE f.creator_id = c.id
    )
    WHERE c.id IN (SELECT creator_id FROM creator_batches);

    GET DIAGNOSTICS rows_in_batch = ROW_COUNT;
    total_processed := total_processed + rows_in_batch;

    IF rows_in_batch = 0 THEN
      EXIT;
    END IF;

    RAISE NOTICE 'Processed % creators', total_processed;
  END LOOP;

  RAISE NOTICE 'Follow count backfill complete. Total: %', total_processed;
END $$;
```

## Technical Details

- Batches 1000 creator rows per iteration
- Tracks progress with RAISE NOTICE for monitoring
- Exits loop when no more rows found
- Uses explicit batch size constant for easy tuning
- Reduces lock contention compared to single large transaction

## Acceptance Criteria

- [ ] Migration uses batched backfill with batch_size = 1000
- [ ] Batching implemented via PL/pgSQL DO block with LOOP
- [ ] Progress tracking via RAISE NOTICE or logging
- [ ] Tested against staging database with realistic volume
- [ ] Execution time acceptable (<5 minutes for 1M+ rows)
- [ ] Database load/locks monitored during migration
- [ ] Final follow_count values verified for accuracy
