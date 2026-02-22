---
id: 441
severity: P3
status: complete
title: 'vitest-frontend-setup: globalThis.fetch mock missing headers and other Response properties'
file: test-utils/vitest-frontend-setup.ts
found_in: PR #89
reviewer: review-testing
---

# Frontend test setup fetch mock returns incomplete Response object

## Problem

The `globalThis.fetch` mock at line 244 returns a minimal response:

```typescript
globalThis.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    status: 200,
  })
);
```

This is missing:

- `headers` (a `Headers` instance) — code that reads `response.headers.get('content-type')` will throw
- `blob()`, `arrayBuffer()`, `formData()` methods
- `statusText`, `type`, `url`, `redirected`, `body`, `bodyUsed` properties
- `clone()` method

Any test that accesses these properties will get `undefined`, causing silent test failures or misleading pass results.

## Location

```
test-utils/vitest-frontend-setup.ts  lines 244-249
```

## Fix

Use a more complete mock:

```typescript
globalThis.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    clone: function () {
      return this;
    },
    redirected: false,
    type: 'basic',
    url: '',
    body: null,
    bodyUsed: false,
  })
);
```

Or use a library like `msw` for more realistic HTTP mocking.

## Severity Justification

P3: Test accuracy. Incomplete mock allows tests to pass when production code would fail on missing Response properties.
