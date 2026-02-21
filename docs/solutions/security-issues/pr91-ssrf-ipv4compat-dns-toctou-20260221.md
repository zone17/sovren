---
title: "PR #91 — SSRF IPv4-Compatible Bypass + DNS TOCTOU Pinning"
date: '2026-02-21'
category: security
pr: 91
findings: ['#423', '#424']
severity: P1
files_changed: ['packages/backend/src/utils/ssrf.ts', 'packages/backend/src/utils/__tests__/ssrf.test.ts']
lines: '+270/-6'
sprint_type: solo
---

# PR #91: Fixing 2 P1 SSRF Bypass Vectors

## Summary

Two P1 SSRF vulnerabilities in `validateSsrfUrl()` fixed in a solo sprint. Both were discovered by the spec-based OWASP test rewrite in PR #89's R6 sprint (todo #423 found by tests-agent, #424 identified during architectural review of the validation flow).

**Net result:** 78/78 SSRF tests pass. Both fixes are non-breaking for existing callers.

---

## Finding #423: IPv4-Compatible IPv6 Address Bypass

### Problem

`isPrivateIPv6()` handled two forms of IPv4-in-IPv6:
- IPv4-mapped `::ffff:x.x.x.x` (dotted-decimal)
- IPv4-mapped `::ffff:HHHH:HHHH` (hex, after URL parser normalization)

But it did NOT handle **IPv4-compatible** addresses (deprecated RFC 4291 section 2.5.5.1):
- `::x.x.x.x` (dotted-decimal form)
- `::HHHH:HHHH` (hex form, without the `ffff:` prefix)

**Critical insight: URL parser normalization.** Node.js `new URL('https://[::127.0.0.1]')` normalizes the hostname to `[::7f00:1]` (hex form without dots). So the input `::127.0.0.1` never appears as-is after parsing — you get `::7f00:1` instead. The dotted-decimal regex `::(\d+\.\d+\.\d+\.\d+)` would never match the normalized form.

### Attack Vector

```
Input URL:     https://[::127.0.0.1]/admin/secrets
After parsing: hostname = "::7f00:1"  (brackets stripped by URL parser)
Old code:      isPrivateIPv6("::7f00:1") → false (no match)
Result:        SSRF to localhost succeeds
```

### Fix

Added two new regex checks to `isPrivateIPv6()`:

```typescript
// IPv4-compatible: ::x.x.x.x (deprecated RFC 4291 §2.5.5.1 but still parseable)
const compat = normalized.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
if (compat) return isPrivateIPv4(compat[1]);

// IPv4-compatible hex form: ::HHHH:HHHH (as normalized by URL parser)
// Node.js URL parser normalizes ::x.x.x.x to this form.
const hexCompat = normalized.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
if (hexCompat) {
  const hi = parseInt(hexCompat[1], 16);
  const lo = parseInt(hexCompat[2], 16);
  const a = (hi >> 8) & 0xff;
  const b = hi & 0xff;
  const c = (lo >> 8) & 0xff;
  const d = lo & 0xff;
  return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
}
```

### Tests Added

```typescript
describe('IPv4-compatible IPv6 addresses (deprecated ::x.x.x.x)', () => {
  it('rejects [::127.0.0.1] (IPv4-compatible loopback)');
  it('rejects [::10.0.0.1] (IPv4-compatible Class A private)');
  it('rejects [::192.168.1.1] (IPv4-compatible Class C private)');
  it('rejects [::169.254.169.254] (IPv4-compatible metadata endpoint)');
});
```

---

## Finding #424: DNS TOCTOU Race Condition

### Problem

`validateSsrfUrl()` resolved DNS and verified all IPs were public, but returned `void`. The resolved IPs were discarded. Between the validation call and the caller's subsequent `fetch()`, DNS could change (TTL=0 rebinding attack):

```
Time 0:  validateSsrfUrl("https://evil.com")  →  DNS resolves to 93.184.216.34 (public) → passes
Time 1:  DNS TTL expires, attacker rebinds evil.com → 127.0.0.1
Time 2:  fetch("https://evil.com")  →  DNS resolves to 127.0.0.1  →  SSRF to localhost
```

### Fix

Two changes, both non-breaking:

**1. Return resolved IPs from validation:**

```typescript
export interface SsrfValidationResult {
  resolvedIps: Array<{ address: string; family: 4 | 6 }>;
}

export async function validateSsrfUrl(url: string): Promise<SsrfValidationResult> {
  // ... validation logic ...
  const results = await lookup(hostname, { all: true });
  const resolvedIps: SsrfValidationResult['resolvedIps'] = [];
  for (const result of results) {
    // ... IP checks ...
    resolvedIps.push({ address: result.address, family: result.family as 4 | 6 });
  }
  return { resolvedIps };
}
```

**2. Export DNS-pinning agent factory:**

```typescript
export function createSsrfSafeAgent(
  resolvedIps: SsrfValidationResult['resolvedIps']
): https.Agent {
  let callIndex = 0;
  return new https.Agent({
    lookup: (_hostname, _options, callback) => {
      const ip = resolvedIps[callIndex % resolvedIps.length];
      callIndex++;
      callback(null, ip.address, ip.family);
    },
  });
}
```

**Usage pattern:**

```typescript
const { resolvedIps } = await validateSsrfUrl(url);
const agent = createSsrfSafeAgent(resolvedIps);
const response = await fetch(url, { agent });
```

### Non-Breaking Guarantee

Changing the return type from `Promise<void>` to `Promise<SsrfValidationResult>` is safe because:
- All existing callers use `await validateSsrfUrl(url)` without destructuring
- Awaiting a Promise that resolves to an object (vs void) is valid — the object is simply ignored
- No caller checks `=== undefined` on the return value
- `InboxPollingService.fetchPlatformMessages()` is a stub behind feature flag — no actual fetching today

### Tests Added

```typescript
describe('return value — resolved IPs for DNS pinning', () => {
  it('returns resolved IPs on successful validation');
  it('returns multiple resolved IPs');
});

describe('createSsrfSafeAgent', () => {
  it('creates an HTTPS agent that pins to validated IPs');
  it('pinned lookup returns the validated IP');
});
```

---

## Patterns Extracted

### Pattern 1: URL Parser Normalization Awareness (P1-class, refines critical-patterns.md #6)

**Rule:** Always test SSRF validation with `new URL(input).hostname`, not the raw input string. URL parsers normalize IP representations in ways that bypass string-based regex checks.

Known normalizations in Node.js:
| Input | `new URL().hostname` | Bypass Risk |
|-------|---------------------|-------------|
| `0177.0.0.1` (octal) | `127.0.0.1` | Caught by decimal checks |
| `0x7f000001` (hex) | `127.0.0.1` | Caught by decimal checks |
| `2130706433` (decimal int) | `127.0.0.1` | Caught by decimal checks |
| `::ffff:127.0.0.1` | `::ffff:7f00:1` | **Hex form without dots** |
| `::127.0.0.1` | `::7f00:1` | **Hex form, no ffff prefix** |

The last two are the dangerous ones — dotted-decimal regexes miss the hex normalization.

### Pattern 2: Return-Value DNS Pinning (P1-class, new)

**Rule:** SSRF validation functions must return resolved IPs so callers can pin DNS. Returning `void` creates an inherent TOCTOU gap.

```typescript
// WRONG — TOCTOU gap between validate and fetch
await validateSsrfUrl(url);     // DNS resolves to 93.x (public)
await fetch(url);                // DNS may now resolve to 127.x (rebinding)

// RIGHT — pin resolved IPs
const { resolvedIps } = await validateSsrfUrl(url);
const agent = createSsrfSafeAgent(resolvedIps);
await fetch(url, { agent });     // Uses pre-validated IPs, no re-resolution
```

**Non-breaking migration:** Changing `void` to object return is safe when callers `await` without destructuring. Ship the return type change first, update callers to use pinning in follow-up PRs.

### Pattern 3: Spec-Based Security Testing Payoff

This PR validates the spec-based testing pattern from R6 sprint. The OWASP-organized test suite (70 tests covering 15 bypass categories) is what discovered finding #423. Gap-based tests written against known bypasses would not have caught IPv4-compatible addresses because they were not in the existing bypass list.

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Add IPv4-compatible checks despite RFC deprecation | Deprecated != unsupported. Node.js URL parser still normalizes these. Defense-in-depth. |
| Return-value approach vs. callback approach | Non-breaking for existing callers. Callback would require all callers to change signature. |
| `https.Agent` with custom `lookup` | Standard Node.js API. No external dependencies. Works with `fetch`, `axios`, `http.get`. |
| Round-robin IP selection in agent | Simple, handles multi-record DNS. Production callers can override with affinity if needed. |
| Not changing InboxPollingService now | It's a stub behind feature flag. Document the pattern; apply when platform adapters land. |

---

## Metrics

| Metric | Value |
|--------|-------|
| Files changed | 2 |
| Lines added | +270 |
| Lines removed | -6 |
| Tests | 78/78 pass |
| Sprint type | Solo |
| Time | ~30 min |
| Review findings generated | 0 (targeted fix for known P1s) |
