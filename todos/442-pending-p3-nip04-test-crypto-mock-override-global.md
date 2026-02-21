---
id: 442
severity: P3
status: pending
title: "NIP04Service test: overrides globalThis.crypto which may leak to other test files"
file: packages/frontend/src/services/nostr/__tests__/NIP04Service.test.ts
found_in: PR #89
reviewer: review-testing
---

# NIP04Service test overrides globalThis.crypto without guaranteed cleanup

## Problem

The NIP04Service test at line 74 replaces `globalThis.crypto` with a mock:

```typescript
Object.defineProperty(globalThis, "crypto", {
  value: mockCrypto as any,
  writable: true,
  configurable: true
});
```

While `afterEach` calls `vi.restoreAllMocks()`, `Object.defineProperty` is NOT restored by Vitest's mock restoration. This means:

1. If this test file runs before other tests that depend on real `crypto`, those tests will see the mock
2. Vitest's test isolation depends on module-level `vi.mock()` (which is properly hoisted), not on `Object.defineProperty` side effects
3. The `vitest-frontend-setup.ts` also sets `crypto` but uses `configurable: true` — both are fighting over the same global

## Location

```
packages/frontend/src/services/nostr/__tests__/NIP04Service.test.ts  line 74
```

## Fix

Add explicit cleanup in `afterEach`:

```typescript
const originalCrypto = globalThis.crypto;

beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: mockCrypto as any,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    writable: true,
    configurable: true,
  });
});
```

Or use `vi.stubGlobal('crypto', mockCrypto)` which Vitest properly restores.

## Severity Justification

P3: Test isolation. Could cause flaky tests in other files depending on execution order.
