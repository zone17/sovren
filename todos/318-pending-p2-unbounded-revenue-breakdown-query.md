---
status: pending
priority: p2
issue_id: 318
tags: [code-review, performance]
---

# Unbounded `RevenueService.getRevenueBreakdown` — fetches ALL revenue_entries

## Problem Statement

The `getRevenueBreakdown` method has no `.limit()` on its query. A creator with thousands of revenue entries will fetch them all in a single response, causing memory pressure, slow responses, and potential timeouts.

## Findings

- `packages/backend/src/services/finance/RevenueService.ts` lines 41-53: query has no `.limit()` clause
- No pagination parameters accepted by the method
- A creator with 10,000+ entries would trigger a massive data transfer
- Could cause request timeouts and excessive memory usage on the server

## Proposed Solutions

1. Add a reasonable limit to the query:

```typescript
const { data, error } = await supabase
  .from('revenue_entries')
  .select('*')
  .eq('creator_id', creatorId)
  .order('created_at', { ascending: false })
  .limit(1000);
```

2. Better approach — use a Supabase RPC with server-side aggregation:

```sql
CREATE OR REPLACE FUNCTION get_revenue_breakdown(
  p_creator_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(source TEXT, total_amount NUMERIC, entry_count BIGINT)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT source, SUM(amount) as total_amount, COUNT(*) as entry_count
  FROM public.revenue_entries
  WHERE creator_id = p_creator_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
  GROUP BY source;
$$;
```

## Technical Details

- **Affected Files**: `packages/backend/src/services/finance/RevenueService.ts`
- **Components**: RevenueService, revenue breakdown endpoint

## Acceptance Criteria

- [ ] Query has a reasonable limit (e.g., 1000 rows) or uses server-side aggregation
- [ ] Response size is bounded regardless of how many entries a creator has
