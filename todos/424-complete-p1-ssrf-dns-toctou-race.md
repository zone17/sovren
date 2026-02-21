---
id: 424
severity: P1
status: complete
title: 'SSRF: DNS TOCTOU race between validation and actual fetch'
file: packages/backend/src/utils/ssrf.ts
found_in: PR #89
reviewer: review-security
---

# SSRF: DNS TOCTOU race between validation and actual HTTP fetch

## Problem

`validateSsrfUrl()` resolves DNS and checks the IPs are public. But between this validation call and when the actual HTTP request is made by the caller, the DNS resolution can change (DNS rebinding attack with TTL=0). The validated IP is not passed to the HTTP client.

The typical attack:

1. Attacker's DNS returns public IP for first resolution (our validation)
2. DNS TTL expires immediately (TTL=0)
3. When `fetch()` actually resolves the hostname, DNS now returns 127.0.0.1

## Location

```
packages/backend/src/utils/ssrf.ts  lines 92-161 (validateSsrfUrl)
```

## Current Mitigation

The code does DNS resolution and checks all IPs. However, the caller (`MarketplaceService.createListing`, etc.) calls `validateSsrfUrl(url)` and then the URL is stored — no fetch happens server-side at validation time. The actual vulnerability depends on how the stored URL is later used.

## Fix Options

**Option A (Recommended):** Return the resolved IPs from `validateSsrfUrl` and force the HTTP client to connect to those specific IPs:

```typescript
export async function validateSsrfUrl(url: string): Promise<{ resolvedIps: string[] }> {
  // ... existing validation ...
  return { resolvedIps: results.map((r) => r.address) };
}
```

**Option B:** Pin DNS resolution in the HTTP client using custom `lookup` option in `http.Agent`:

```typescript
const agent = new https.Agent({
  lookup: (hostname, options, callback) => {
    // Use pre-validated IPs only
    callback(null, validatedIp, 4);
  },
});
```

**Option C (Minimum):** Document in JSDoc that callers must re-validate or pin DNS. Current doc says "validates a URL is safe" which implies the URL can be used safely afterward — this is misleading.

## Severity Justification

P1: DNS rebinding is the #1 SSRF bypass technique. The fix in this PR handles the easy cases (static IPs, hex notation) but the fundamental TOCTOU on DNS remains. However, since the current usage only stores URLs (not fetches them server-side), the practical impact is reduced. Downgrade to P2 if URLs are never fetched server-side.

## Verification

1. Confirm all callers of `validateSsrfUrl` — check if any fetch the URL after validation
2. If yes, implement Option A or B
3. If no (URL is only stored for display), implement Option C and downgrade to P2
