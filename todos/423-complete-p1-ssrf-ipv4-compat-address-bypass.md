---
id: 423
severity: P1
status: complete
title: 'SSRF: IPv4-compatible IPv6 addresses (::x.x.x.x) not blocked'
file: packages/backend/src/utils/ssrf.ts
found_in: PR #89
reviewer: review-security
---

# SSRF: IPv4-compatible IPv6 addresses bypass validation

## Problem

The `isPrivateIPv6` function handles IPv4-**mapped** addresses (`::ffff:x.x.x.x` and `::ffff:HHHH:HHHH`) but does **not** handle IPv4-**compatible** addresses (`::x.x.x.x`). These are a deprecated but still parseable IPv6 notation that some HTTP clients resolve.

Example bypass:

```
https://[::127.0.0.1]   -> not caught by isPrivateIPv6
https://[::10.0.0.1]    -> not caught by isPrivateIPv6
```

The URL parser may or may not normalize these to `::ffff:` form depending on the Node.js version and platform. If it does NOT normalize, the SSRF check is bypassed.

## Location

```
packages/backend/src/utils/ssrf.ts  lines 45-68 (isPrivateIPv6)
```

## Fix

Add a check for IPv4-compatible addresses (`::x.x.x.x` without the `ffff:` prefix):

```typescript
// IPv4-compatible: ::x.x.x.x (deprecated but parseable)
const compat = normalized.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
if (compat) return isPrivateIPv4(compat[1]);
```

Also add corresponding test cases to `ssrf.test.ts`:

```typescript
it('rejects [::127.0.0.1] (IPv4-compatible loopback)', async () => {
  await expect(validateSsrfUrl('https://[::127.0.0.1]')).rejects.toThrow();
});

it('rejects [::10.0.0.1] (IPv4-compatible Class A private)', async () => {
  await expect(validateSsrfUrl('https://[::10.0.0.1]')).rejects.toThrow();
});
```

## Severity Justification

P1: SSRF bypass vectors are security-critical. Even if Node.js currently normalizes these, different environments or future Node.js versions might not.

## Verification

Run `npx vitest run packages/backend/src/utils/__tests__/ssrf.test.ts` after fix.
