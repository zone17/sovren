---
id: 446
severity: P3
status: complete
title: 'test-providers: renderWithProviders creates store twice'
file: packages/frontend/src/test-utils/test-providers.tsx
found_in: PR #89
reviewer: review-testing
---

# renderWithProviders creates two separate store instances

## Problem

The `renderWithProviders` function creates the store twice — once inside the `Wrapper` component (via `AllProviders` which calls `createTestStore`) and once in the return value:

```typescript
export function renderWithProviders(ui, options = {}) {
  const { providerOptions = {}, ...renderOptions } = options;

  function Wrapper({ children }) {
    return <AllProviders {...providerOptions}>{children}</AllProviders>;
    //       ^^^^ creates store #1 internally
  }

  return {
    store: createTestStore(providerOptions),  // creates store #2
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
```

The `store` returned to the test is NOT the same store used by the rendered component. Any assertions like `expect(store.getState().user)` will check the wrong store instance.

## Location

```
packages/frontend/src/test-utils/test-providers.tsx  lines 332-348
```

## Fix

Create the store once and pass it through:

```typescript
export function renderWithProviders(ui, options = {}) {
  const { providerOptions = {}, ...renderOptions } = options;
  const store = createTestStore(providerOptions);

  function Wrapper({ children }) {
    return (
      <Provider store={store}>
        <TestRouter {...providerOptions}>{children}</TestRouter>
      </Provider>
    );
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
```

## Severity Justification

P3: Test correctness. Tests that inspect the returned `store` object may get incorrect results because they're looking at a different store than the one the components use.
