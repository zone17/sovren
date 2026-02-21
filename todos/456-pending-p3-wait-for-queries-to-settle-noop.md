---
id: 456
severity: P3
status: pending
title: "waitForQueriesToSettle is a no-op — forEach returns undefined, promises never awaited"
file: packages/frontend/src/test-utils/react-query-test-utils.tsx
found_in: PR #92
reviewer: review-frontend-races
---

# waitForQueriesToSettle does nothing — pre-existing bug

## Problem

`Array.prototype.forEach()` returns `undefined`, so `await undefined` resolves immediately. The `return query.promise` inside the forEach callback returns from the callback, not the outer function. Promises are never collected or awaited.

```typescript
export const waitForQueriesToSettle = async (queryClient: QueryClient) => {
  await queryClient
    .getQueryCache()
    .findAll()
    .forEach((query) => {        // forEach returns undefined!
      if (query.state.fetchStatus === 'fetching') {
        return query.promise;    // returns from callback, not from function
      }
    });
};
```

## Location

```
packages/frontend/src/test-utils/react-query-test-utils.tsx  lines 74-83
```

## Fix

```typescript
export const waitForQueriesToSettle = async (queryClient: QueryClient) => {
  const pendingPromises = queryClient
    .getQueryCache()
    .findAll()
    .filter((query) => query.state.fetchStatus === 'fetching')
    .map((query) => query.promise);
  await Promise.allSettled(pendingPromises);
};
```

Use `Promise.allSettled` (not `Promise.all`) so one query error doesn't abort waiting for the rest.

## Severity Justification

P3: Test reliability. Pre-existing bug not introduced by this PR, but discovered during review. Tests pass by coincidence of microtask ordering, not because queries actually settled.
