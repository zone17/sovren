---
status: pending
priority: p2
issue_id: 468
tags: [code-review, security, defense-in-depth]
dependencies: []
---

# Extract shared portfolio URL validation in MarketplaceService

## Problem Statement

`createListing` validates portfolio URLs in 3 steps (string check, `new URL()` parse, SSRF check) but `updateListing` only performs 2 steps (missing the `new URL()` parse). This defense-in-depth gap is pre-existing but was highlighted when PR #94 added dedup to both paths. The duplicated validation logic (~25 lines each) should be extracted to a shared private method.

## Findings

- Source: Security sentinel, Architecture strategist, Pattern recognition (PR #94 review)
- `createListing` lines 128-143: typeof + startsWith + new URL() + validateSsrfUrl
- `updateListing` lines 246-251: typeof + startsWith + validateSsrfUrl (missing new URL())
- `validateSsrfUrl()` does its own `new URL()` internally, so the gap is not exploitable today
- Also: Zod validator uses `max(10)` but service uses `MAX_PORTFOLIO_URLS = 20` (pattern agent finding)

## Proposed Solutions

### Option A: Extract private validatePortfolioUrls method

```typescript
private async validatePortfolioUrls(urls?: string[]): Promise<string[]> {
  const unique = urls ? [...new Set(urls)] : [];
  if (unique.length > MAX_PORTFOLIO_URLS) throw ...;
  await Promise.all(unique.map(async (url) => { /* full 3-step validation */ }));
  return unique;
}
```

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Single validation method used by both createListing and updateListing
- [ ] All 3 validation steps applied consistently
- [ ] Zod validator max aligned with service constant
- [ ] Existing tests still pass

## Work Log

| Date       | Action                     | Learnings                                    |
| ---------- | -------------------------- | -------------------------------------------- |
| 2026-02-22 | Created from PR #94 review | Pre-existing asymmetry; extract to eliminate |
