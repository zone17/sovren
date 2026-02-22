---
id: 435
severity: P3
status: complete
title: 'vitest-frontend-setup: getBoundingClientRect __mocked flag check is fragile'
file: test-utils/vitest-frontend-setup.ts
found_in: PR #89
reviewer: review-testing
---

# getBoundingClientRect mock uses undeclared \_\_mocked flag

## Problem

The mock checks `Element.prototype.getBoundingClientRect.__mocked` to avoid re-patching, but:

1. TypeScript doesn't know about `__mocked` property — this requires `(... as any).__mocked`
2. If `vi.clearAllMocks()` or `vi.restoreAllMocks()` resets the prototype, the flag persists but the mock function doesn't, causing inconsistent state
3. The pattern `if (!fn.__mocked)` is not idempotent with Vitest's test isolation

```typescript
// Line 61 - fragile check
if (!Element.prototype.getBoundingClientRect.__mocked) {
  // ... patch ...
  (Element.prototype.getBoundingClientRect as any).__mocked = true;
}
```

## Location

```
test-utils/vitest-frontend-setup.ts  lines 61-72
```

## Fix

Use a `WeakSet` or module-level boolean instead:

```typescript
let boundingRectPatched = false;

if (!boundingRectPatched) {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const rect = original.call(this);
    if (rect.width === 0 && rect.height === 0) {
      return { ...rect, width: 500, height: 300, top: 0, left: 0, bottom: 300, right: 500 };
    }
    return rect;
  };
  boundingRectPatched = true;
}
```

## Severity Justification

P3: Test infrastructure fragility. Won't cause production issues but could cause intermittent test failures if Vitest's module caching changes.
