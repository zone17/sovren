---
id: 434
severity: P2
status: complete
title: 'formatSats: NaN guard uses !Number.isFinite which also catches Infinity but not -0'
file: packages/frontend/src/shared/utils/formatSats.ts
found_in: PR #89
reviewer: review-frontend
---

# formatSats NaN guard behavior analysis

## Problem

The NaN guard added in this PR:

```typescript
if (!Number.isFinite(sats) || sats < 0) {
  return suffix ? '0 sats' : '0';
}
```

This correctly handles:

- NaN -> returns "0 sats"
- Infinity -> returns "0 sats"
- -Infinity -> returns "0 sats"
- Negative numbers -> returns "0 sats"

However:

1. **`-0` passes the check** (`Number.isFinite(-0)` is `true` and `-0 < 0` is `false`). It proceeds to `(-0).toLocaleString()` which returns "0" — acceptable but inconsistent with the guard intent.

2. **Non-integer values are formatted with decimals**: `formatSats(1.5)` returns "1.5 sats" but satoshis are always integers. Should `1.5` be rounded or rejected?

3. **Very large numbers**: `formatSats(Number.MAX_SAFE_INTEGER + 1)` may produce incorrect results due to floating-point precision loss. Consider adding a `Number.isSafeInteger` check for non-abbreviated mode.

## Location

```
packages/frontend/src/shared/utils/formatSats.ts  lines 27-29
```

## Fix

```typescript
if (!Number.isFinite(sats) || sats < 0) {
  return suffix ? '0 sats' : '0';
}

// Satoshis are always integers
const safeSats = Math.round(sats);
```

## Severity Justification

P2: Display correctness. Non-integer sats or precision-lost large numbers will show incorrect amounts in financial UI.
