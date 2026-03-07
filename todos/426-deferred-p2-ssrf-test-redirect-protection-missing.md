---
id: 426
severity: P2
status: deferred
title: 'SSRF test suite: redirect chain protection only documented, not tested'
file: packages/backend/src/utils/__tests__/ssrf.test.ts
found_in: PR #89
reviewer: review-security
---

# SSRF test suite has placeholder test for redirect protection

## Problem

Section 13 ("Redirect chain handling") of the SSRF test suite contains a single test with `expect(true).toBe(true)` and a comment saying redirect protection is "an HTTP client concern." While architecturally correct, this means:

1. There is NO test verifying that the HTTP client (wherever outbound fetches happen) actually re-validates redirect targets
2. There is no test verifying redirect depth limits
3. The "test" gives false confidence in the test suite (70 tests advertised, but one is a no-op)

## Location

```
packages/backend/src/utils/__tests__/ssrf.test.ts  lines 443-454
```

## Fix

1. Either add an integration test that validates the HTTP fetch layer re-validates redirects, or
2. Remove the no-op test and document the gap in a TODO, or
3. Add a test that verifies `validateSsrfUrl` is called on redirect URLs in the HTTP client wrapper

At minimum, create a wrapper around `fetch` or `axios` that:

- Disables auto-redirect
- Manually follows redirects up to 5 hops
- Calls `validateSsrfUrl()` on each redirect target

```typescript
async function safeFetch(url: string, opts?: RequestInit): Promise<Response> {
  await validateSsrfUrl(url);
  const response = await fetch(url, { ...opts, redirect: 'manual' });
  if ([301, 302, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect without Location header');
    await validateSsrfUrl(location); // Re-validate
    return safeFetch(location, opts); // Recurse (add depth counter)
  }
  return response;
}
```

## Severity Justification

P2: No known server-side outbound fetch in current PR, but the gap should be documented before any fetch-based feature is added.
