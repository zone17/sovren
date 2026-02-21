---
status: deferred
priority: p2
issue_id: '280'
tags: [code-review, architecture, duplication]
dependencies: []
---

# Duplicate getBtcUsdRate() in Revenue and Tax Services

## Problem Statement

Both RevenueTrackingService and TaxPreparationService implement their own getBtcUsdRate() method with identical logic. If one is updated (e.g., different API, caching), the other diverges silently.

## Findings

- `packages/backend/src/services/finance/RevenueTrackingService.ts` — getBtcUsdRate()
- `packages/backend/src/services/finance/TaxPreparationService.ts` — getBtcUsdRate()

## Proposed Solutions

### Option 1: Extract to shared utility

**Approach:** Create a BtcPriceService or utility function in shared, inject via DI container.
**Effort:** 1h **Risk:** Low

## Acceptance Criteria

- [ ] Single getBtcUsdRate() implementation
- [ ] Both services use the shared version
- [ ] Rate caching in one place

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
