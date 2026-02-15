---
status: pending
priority: p3
issue_id: 106
tags: [code-review, frontend, duplication]
dependencies: []
---

# Identical Error Boundaries Across Features

## Problem Statement

5 of 6 feature error boundaries are **identical 16-line files** differing only in the `featureName` prop passed to `FeatureErrorBoundary`:

- AI
- Dashboard
- NOSTR
- Content
- Subscriptions

Only `AuthErrorBoundary` has a custom fallback UI.

**Issues**:

1. **Code duplication**: 80 lines of identical boilerplate across 5 files
2. **No domain-specific recovery**: Generic error message for all features (e.g., NOSTR could offer "reconnect to relay", Content could offer "retry load")
3. **Maintenance burden**: Bug fixes or improvements require updating 5 identical files

**Files**:

- `packages/frontend/src/features/ai/ErrorBoundary.tsx`
- `packages/frontend/src/features/dashboard/ErrorBoundary.tsx`
- `packages/frontend/src/features/nostr/ErrorBoundary.tsx`
- `packages/frontend/src/features/content/ErrorBoundary.tsx`
- `packages/frontend/src/features/subscriptions/ErrorBoundary.tsx`
- `packages/frontend/src/features/auth/ErrorBoundary.tsx` (custom, good reference)

## Findings

- **Current pattern**: Each feature exports a component that renders `<FeatureErrorBoundary featureName="FeatureName">`
- **AuthErrorBoundary difference**: Custom fallback with login redirect, shows this pattern CAN support customization
- **No feature-specific recovery**: All features use generic fallback, missing opportunities for contextual error handling
- **Examples of missed recovery**:
  - NOSTR: "Reconnect to relay" button
  - Content: "Retry loading content" button
  - AI: "Try a different model" fallback
  - Subscriptions: "View cached subscription data"

## Proposed Solutions

### Option 1: Factory Function Pattern

**Description**: Create a factory function that generates error boundaries with optional custom fallback:

```typescript
// packages/frontend/src/components/ErrorBoundary/createFeatureErrorBoundary.tsx
export const createFeatureErrorBoundary = (
  featureName: string,
  customFallback?: (error: Error, reset: () => void) => ReactNode
) => {
  return ({ children }: { children: ReactNode }) => (
    <FeatureErrorBoundary
      featureName={featureName}
      fallback={customFallback}
    >
      {children}
    </FeatureErrorBoundary>
  );
};

// Usage
export const NostrErrorBoundary = createFeatureErrorBoundary('NOSTR');
export const AIErrorBoundary = createFeatureErrorBoundary('AI');
```

**Pros**:

- Eliminates all duplication (5 files → 5 one-liners)
- Easy to add custom fallbacks later per feature
- Single source of truth for error boundary logic
- Type-safe feature names

**Cons**:

- Adds indirection (factory pattern may be unfamiliar)
- Requires updating all 5 files at once
- Custom fallbacks still require per-feature implementation

**Effort**: Low (2 hours)
**Risk**: Low (pure refactor, behavior unchanged)

### Option 2: Single Configurable Component

**Description**: Create a single component with feature-specific configuration object:

```typescript
// packages/frontend/src/components/ErrorBoundary/config.ts
const errorBoundaryConfig = {
  NOSTR: {
    fallback: (error, reset) => <NostrErrorFallback error={error} onReset={reset} />,
    recovery: 'reconnect',
  },
  AI: {
    fallback: (error, reset) => <AIErrorFallback error={error} onReset={reset} />,
    recovery: 'retry',
  },
  // ...
};

// packages/frontend/src/components/ErrorBoundary/FeatureErrorBoundary.tsx
export const FeatureErrorBoundary = ({ feature, children }) => {
  const config = errorBoundaryConfig[feature];
  // Use config.fallback or default
};
```

**Pros**:

- Centralized configuration for all features
- Easy to see all error handling strategies in one place
- Encourages domain-specific recovery flows

**Cons**:

- More upfront work to build config system
- Tighter coupling between features and error boundary
- May be over-engineering for current needs

**Effort**: Medium (4 hours)
**Risk**: Low (can implement incrementally)

## Recommended Action

**Option 1** - Factory function pattern.

**Rationale**: Immediate duplication elimination with minimal risk. The factory pattern is well-understood in React (similar to HOCs), and it preserves the ability to add custom fallbacks per feature later. Option 2's centralized config is premature optimization - we don't have enough feature-specific error handling yet to justify it.

**Implementation approach**:

1. Create `packages/frontend/src/components/ErrorBoundary/createFeatureErrorBoundary.tsx`:

   ```typescript
   export const createFeatureErrorBoundary = (
     featureName: string,
     customFallback?: (error: Error, reset: () => void) => ReactNode
   ) => {
     const Boundary = ({ children }: { children: ReactNode }) => (
       <FeatureErrorBoundary
         featureName={featureName}
         fallback={customFallback}
       >
         {children}
       </FeatureErrorBoundary>
     );
     Boundary.displayName = `${featureName}ErrorBoundary`;
     return Boundary;
   };
   ```

2. Update each feature's ErrorBoundary.tsx to one-liner:

   ```typescript
   export const NostrErrorBoundary = createFeatureErrorBoundary('NOSTR');
   ```

3. Keep AuthErrorBoundary as-is (custom implementation, good reference)

4. Add JSDoc explaining how to add custom fallback:

   ```typescript
   // Example: Custom fallback for NOSTR
   export const NostrErrorBoundary = createFeatureErrorBoundary(
     'NOSTR',
     (error, reset) => (
       <NostrErrorFallback error={error} onReconnect={reset} />
     )
   );
   ```

5. Test each feature's error boundary renders correctly

## Technical Details

**Current duplication** (example from NOSTR):

```typescript
// packages/frontend/src/features/nostr/ErrorBoundary.tsx (16 lines)
import React from 'react';
import { FeatureErrorBoundary } from '@/components/ErrorBoundary';

export const NostrErrorBoundary: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <FeatureErrorBoundary featureName="NOSTR">
      {children}
    </FeatureErrorBoundary>
  );
};
```

**Identical in**: AI, Dashboard, Content, Subscriptions (only `featureName` changes)

**Proposed factory pattern**:

```typescript
// packages/frontend/src/components/ErrorBoundary/createFeatureErrorBoundary.tsx
import React, { ReactNode } from 'react';
import { FeatureErrorBoundary } from './FeatureErrorBoundary';

type CustomFallback = (error: Error, reset: () => void) => ReactNode;

export const createFeatureErrorBoundary = (
  featureName: string,
  customFallback?: CustomFallback
) => {
  const Boundary: React.FC<{ children: ReactNode }> = ({ children }) => (
    <FeatureErrorBoundary
      featureName={featureName}
      fallback={customFallback}
    >
      {children}
    </FeatureErrorBoundary>
  );

  Boundary.displayName = `${featureName}ErrorBoundary`;
  return Boundary;
};
```

**Updated feature files** (5 lines each):

```typescript
// packages/frontend/src/features/nostr/ErrorBoundary.tsx
import { createFeatureErrorBoundary } from '@/components/ErrorBoundary';

export const NostrErrorBoundary = createFeatureErrorBoundary('NOSTR');
```

**Line count reduction**: 80 lines → ~30 lines (factory + 5 feature files)

**Future enhancement example** (domain-specific recovery):

```typescript
// packages/frontend/src/features/nostr/ErrorBoundary.tsx
import { createFeatureErrorBoundary } from '@/components/ErrorBoundary';
import { NostrErrorFallback } from './NostrErrorFallback';

export const NostrErrorBoundary = createFeatureErrorBoundary(
  'NOSTR',
  (error, reset) => <NostrErrorFallback error={error} onReconnect={reset} />
);
```

## Acceptance Criteria

- [ ] `createFeatureErrorBoundary` factory function created
- [ ] All 5 identical error boundaries refactored to use factory
- [ ] Each feature's error boundary is 5 lines or less
- [ ] `displayName` set correctly for React DevTools
- [ ] All feature error boundaries render correctly (test in browser)
- [ ] AuthErrorBoundary remains custom (reference example)
- [ ] JSDoc added explaining custom fallback pattern
- [ ] No visual or functional changes to error handling

## Work Log

### 2026-02-14

- Identified in PR #73 full code review

## Resources

- PR #73: https://github.com/zone17/sovren/pull/73
- Files to refactor:
  - `packages/frontend/src/features/ai/ErrorBoundary.tsx`
  - `packages/frontend/src/features/dashboard/ErrorBoundary.tsx`
  - `packages/frontend/src/features/nostr/ErrorBoundary.tsx`
  - `packages/frontend/src/features/content/ErrorBoundary.tsx`
  - `packages/frontend/src/features/subscriptions/ErrorBoundary.tsx`
- Reference: `packages/frontend/src/features/auth/ErrorBoundary.tsx` (custom implementation)
