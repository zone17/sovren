---
status: complete
priority: p3
issue_id: 679
tags: [code-review, slice-7, finance, consistency, btc-usd, tax]
dependencies: []
---

## Problem Statement

The `exportTaxReport` method calls `getBtcUsdRate` independently for each quarter. If the rate cache expires mid-export, different quarters use different BTC/USD rates, producing inconsistent USD totals within the same annual report.

## Findings

- **File**: `packages/backend/src/services/finance/TaxService.ts:285-311`
- `exportTaxReport` iterates over quarters (Q1-Q4) and calls `getBtcUsdRate()` within each iteration
- `getBtcUsdRate()` uses a TTL cache; if the cache expires between quarter computations, a fresh rate is fetched
- This means Q1 and Q2 might use rate $95,000 while Q3 and Q4 use rate $95,500, creating internal inconsistency in the same export
- The annual summary row (sum of quarterly USD values) will not match what any single rate would produce
- This was previously identified as a known limitation (todo #280/#321 — `duplicate-getbtcusdrate-revenue-tax`) but the consistency angle for exports is distinct

## Proposed Solutions

1. **Preferred**: Fetch the BTC/USD rate once at the start of `exportTaxReport` and pass it to all quarterly computations:
   ```typescript
   async exportTaxReport(creatorId: string, year: number) {
     const btcUsdRate = await this.getBtcUsdRate();
     const quarters = await Promise.all(
       [1, 2, 3, 4].map(q => this.computeQuarter(creatorId, year, q, btcUsdRate))
     );
     // ...
   }
   ```
2. Add a JSDoc comment documenting the rate-pinning behavior so consumers understand the export uses a point-in-time rate
3. Consider adding the pinned rate to the export metadata (e.g., a header row or footer noting "BTC/USD rate used: $X at timestamp Y")

## Recommended Action

## Technical Details

- The TTL cache for BTC/USD rate is typically 5-15 minutes; an export processing 4 quarters sequentially could span seconds, making cache expiry during export unlikely but possible under load
- The fix is low-risk: fetching once and passing the rate as a parameter is a mechanical refactor
- The `computeQuarter` (or equivalent) method signature needs to accept an optional `btcUsdRate` parameter
- If `getBtcUsdRate` is called elsewhere in the same flow (e.g., for individual transaction conversion), those calls should also use the pinned rate
- Related: todo #280 (deferred P2 — duplicate getBtcUsdRate calls in revenue/tax), todo #321 (complete P2 — same issue)

## Acceptance Criteria

- [ ] `exportTaxReport` fetches BTC/USD rate once and passes it to all quarterly computations
- [ ] All USD calculations within a single export use the same rate
- [ ] Rate is documented in export output (comment, metadata, or header)
- [ ] No regression in individual quarter queries that don't go through `exportTaxReport`
- [ ] Unit test verifies that `getBtcUsdRate` is called exactly once per export

## Work Log

## Resources

- `packages/backend/src/services/finance/TaxService.ts:285-311`
- Todo #280 (deferred P2 — duplicate getBtcUsdRate)
- Todo #321 (complete P2 — duplicate getBtcUsdRate revenue/tax)
- TTLCache implementation in the codebase
