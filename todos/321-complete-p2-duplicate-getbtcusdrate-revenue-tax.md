---
status: pending
priority: p2
issue_id: 321
tags: [code-review, duplication]
---

# Duplicate `getBtcUsdRate()` in RevenueService and TaxService

## Problem Statement

Identical 28-line `getBtcUsdRate()` implementations exist in both RevenueService and TaxService. Both use the same API URL, cache key, stale fallback logic, and hardcoded $50,000 fallback value. This duplication increases maintenance burden and risk of divergence.

## Findings

- `packages/backend/src/services/finance/RevenueService.ts:209-236` — full `getBtcUsdRate()` implementation
- `packages/backend/src/services/finance/TaxService.ts:251-280` — identical 28-line copy

Both implementations:

- Hit the same BTC price API endpoint
- Use the same cache key
- Fall back to stale cache on failure
- Hardcode `$50,000` as ultimate fallback

## Proposed Solutions

1. Extract shared implementation to `packages/backend/src/utils/btc-rate.ts` with a single `getBtcUsdRate()` function
2. Import and call from both RevenueService and TaxService
3. Consolidate cache key and fallback value as named constants

## Technical Details

- **Affected Files**: packages/backend/src/services/finance/RevenueService.ts, packages/backend/src/services/finance/TaxService.ts, packages/backend/src/utils/btc-rate.ts (new)

## Acceptance Criteria

- [ ] Shared `getBtcUsdRate()` extracted to `packages/backend/src/utils/btc-rate.ts`
- [ ] RevenueService and TaxService both import and use the shared function
- [ ] No duplicate implementation remains
- [ ] Existing tests pass without modification
- [ ] Hardcoded fallback value is a named constant
