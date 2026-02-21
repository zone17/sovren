---
id: 440
severity: P3
status: pending
title: "MarketplaceService: SSRF validation in sequential loop for portfolio URLs"
file: packages/backend/src/services/community/MarketplaceService.ts
found_in: PR #89
reviewer: review-backend
---

# MarketplaceService validates portfolio URLs sequentially with DNS lookups

## Problem

In `createListing` and `updateListing`, portfolio URLs are validated one at a time in a `for...of` loop:

```typescript
for (const url of data.portfolioUrls) {
  // ... URL format check ...
  await validateSsrfUrl(url); // DNS resolution for each URL
}
```

Each `validateSsrfUrl` call does a DNS resolution (`lookup(hostname, { all: true })`). For a listing with 10 portfolio URLs, this is 10 sequential DNS lookups. In the worst case (slow DNS, timeout), this could take 10 * DNS_TIMEOUT seconds.

## Location

```
packages/backend/src/services/community/MarketplaceService.ts  lines 120-136 (createListing)
packages/backend/src/services/community/MarketplaceService.ts  lines 228-235 (updateListing)
```

## Fix

Validate URLs in parallel:

```typescript
if (data.portfolioUrls && data.portfolioUrls.length > 0) {
  await Promise.all(data.portfolioUrls.map(async (url) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      throw new Error(`Invalid portfolio URL: "${url}"`);
    }
    try { new URL(url); } catch { throw new Error(`Invalid URL: "${url}"`); }
    await validateSsrfUrl(url);
  }));
}
```

Also consider adding a cap on the number of portfolio URLs (currently unbounded).

## Severity Justification

P3: Performance issue. Sequential DNS lookups slow down listing creation linearly with URL count. Parallel validation would keep it constant time.
