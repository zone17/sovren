---
status: complete
priority: p1
issue_id: 659
tags: [code-review, performance, p1]
dependencies: []
---

## Problem Statement

`exportTaxReport()` in TaxService makes 18+ database queries due to redundant expense fetching and uncached BTC/USD rate lookups. It calls `getQuarterlySummary()` 4 times (Q1-Q4), each performing 2 paginated loops (revenue + expenses), then calls `getExpensesForExport()` once more for the CSV. Expenses are fetched 5 times total. Each quarterly summary independently calls `getBtcUsdRate()` — if the rate cache expires mid-export, different quarters use different exchange rates, producing inconsistent USD amounts in the same report.

## Findings

**Consensus**: 2/8 agents (performance-oracle, data-integrity-guardian)

**File**: `packages/backend/src/services/finance/TaxService.ts:285-311`

1. **5x expense fetch** — Expenses are fetched once in each of the 4 `getQuarterlySummary()` calls (paginated, filtered by quarter) plus once in `getExpensesForExport()` (full year). This is 5 separate paginated fetch sequences, each potentially making multiple page requests.

2. **18+ queries minimum** — Each `getQuarterlySummary()` does at least 2 queries (1 revenue page + 1 expense page, assuming data fits in one page). With 4 quarters: 8 minimum. Plus `getExpensesForExport()` (1+ queries). Plus 4 `getBtcUsdRate()` calls. Total: 13-18+ queries depending on data volume and pagination.

3. **Inconsistent exchange rate** — `getBtcUsdRate()` is called independently per quarterly summary. If the rate cache (likely a TTLCache) expires between Q1 and Q4 processing, the rate changes mid-report. A tax report showing Q1 at $45,000/BTC and Q4 at $45,100/BTC (due to cache refresh) is misleading.

4. **Performance under load** — For a creator with many expenses, each paginated loop may make 5-10 page requests. A single export could trigger 50+ queries, taking several seconds.

## Proposed Solutions

### Option A: Pre-Fetch + In-Memory Computation (Recommended)

Fetch all expenses and revenue for the year once, fetch BTC/USD rate once, then compute quarterly summaries from the in-memory data.

```typescript
async exportTaxReport(creatorId: string, year: number): Promise<TaxExportData> {
  // 1. Single BTC/USD rate fetch — consistent across all quarters
  const btcUsdRate = await this.getBtcUsdRate();

  // 2. Fetch all expenses for the year (one paginated sequence)
  const allExpenses = await this.getExpensesForExport(creatorId, year);

  // 3. Fetch all revenue for the year (one paginated sequence)
  const allRevenue = await this.getRevenueForYear(creatorId, year);

  // 4. Compute quarterly summaries from in-memory data
  const quarterlySummaries = [1, 2, 3, 4].map(quarter => {
    const quarterExpenses = allExpenses.filter(e => getQuarter(e.date) === quarter);
    const quarterRevenue = allRevenue.filter(r => getQuarter(r.date) === quarter);
    return computeQuarterlySummary(quarterExpenses, quarterRevenue, btcUsdRate);
  });

  return { quarterlySummaries, expenses: allExpenses, btcUsdRate };
}
```

- **Pros**: Reduces queries from 18+ to 3 (expenses + revenue + rate). Guarantees consistent exchange rate. Simpler logic. Faster execution.
- **Cons**: Loads all year's data into memory at once. For most creators this is fine (hundreds of rows), but for extremely active creators it could be significant.
- **Effort**: Medium (2-3 hours) — requires extracting `getRevenueForYear()` and `computeQuarterlySummary()` helpers.
- **Risk**: Low — the data was already being fetched, just redundantly. Memory usage should be similar or lower.

### Option B: Cache Rate + Deduplicate Expense Fetch Only

Keep the per-quarter structure but pass a pre-fetched rate and pre-fetched expenses to `getQuarterlySummary()`.

```typescript
async exportTaxReport(creatorId: string, year: number): Promise<TaxExportData> {
  const btcUsdRate = await this.getBtcUsdRate();
  const allExpenses = await this.getExpensesForExport(creatorId, year);

  const summaries = await Promise.all([1, 2, 3, 4].map(q =>
    this.getQuarterlySummary(creatorId, year, q, { btcUsdRate, expenses: allExpenses })
  ));

  return { summaries, expenses: allExpenses, btcUsdRate };
}
```

- **Pros**: Less refactoring — `getQuarterlySummary()` still handles revenue fetching. Rate is consistent. Expenses fetched once.
- **Cons**: Still 4 revenue fetch sequences (one per quarter). Only reduces from 18+ to ~8 queries. `getQuarterlySummary()` signature becomes complex with optional overrides.
- **Effort**: Small (1-2 hours)
- **Risk**: Low

### Option C: Database-Level Aggregation (RPC)

Create a Supabase RPC function that computes the full annual summary server-side in a single query with quarterly grouping.

```sql
CREATE FUNCTION get_annual_tax_summary(p_creator_id uuid, p_year int)
RETURNS TABLE(quarter int, total_revenue bigint, total_expenses bigint, ...)
AS $$ ... $$ LANGUAGE sql STABLE;
```

- **Pros**: Single query. Most efficient. Database handles aggregation natively.
- **Cons**: Significant effort. Business logic in SQL is harder to test and maintain. BTC/USD conversion still needs application-side logic.
- **Effort**: Large (4-6 hours)
- **Risk**: Medium — moves logic to a layer with less test coverage.

## Recommended Action

<!-- To be filled by tech lead -->

## Technical Details

- **Current query count breakdown**:
  - `getQuarterlySummary(Q1)`: 1+ revenue pages + 1+ expense pages + 1 getBtcUsdRate = ~3 queries
  - `getQuarterlySummary(Q2)`: same = ~3 queries
  - `getQuarterlySummary(Q3)`: same = ~3 queries
  - `getQuarterlySummary(Q4)`: same = ~3 queries
  - `getExpensesForExport()`: 1+ pages = ~1 query
  - **Total**: ~13 queries minimum, 18+ with pagination
- **getBtcUsdRate cache**: Check if it uses TTLCache (common-solutions.md pattern). If TTL is short (e.g., 60s), a large export could easily span a cache refresh.
- **getQuarter helper**: Will need a utility function to compute quarter from a date: `Math.ceil((date.getMonth() + 1) / 3)`.
- **Related todo #280** (deferred): "Duplicate getBtcUsdRate in revenue/tax" — this fix addresses the same root cause in the export context.

## Acceptance Criteria

- [ ] Expenses fetched at most once per export (not 5 times)
- [ ] BTC/USD rate fetched once per export and reused for all quarters
- [ ] All quarterly summaries in a single export use the same exchange rate
- [ ] Query count reduced from 18+ to ≤5
- [ ] Export produces identical output for the same input data
- [ ] Performance test: export for a creator with 1000+ expenses completes in <2 seconds
- [ ] Tests cover: single-page data, multi-page pagination, rate consistency across quarters

## Work Log

<!-- Append entries as work progresses -->

## Resources

- todo #280 (deferred) — related duplicate getBtcUsdRate issue
- todo #365 (complete) — tax unbounded queries OOM (related pagination issue)
- common-solutions.md #11 (OOM prevention with pagination)
- [Supabase pagination](https://supabase.com/docs/reference/javascript/range)
