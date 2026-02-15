---
status: pending
priority: p2
issue_id: '052'
tags: [code-review, frontend, error-handling]
dependencies: []
---

# ErrorBoundary Root Duplication and Broken Export

## Problem Statement

Three issues exist in frontend error boundary implementation: (1) main.tsx wraps with `ErrorBoundary level="page"` while App.tsx wraps with `ErrorBoundary level="global"`, inverting expected semantics and making the outer boundary unreachable; (2) `QueryErrorBoundary` is a completely independent class not delegating to consolidated ErrorBoundary; (3) `components/nostr/errors/index.ts` exports ErrorBoundary from a file that doesn't exist, causing a broken import.

## Findings

**Location**:

- `main.tsx:55`
- `App.tsx:97`
- `queries/errorHandling.tsx:165`
- `components/nostr/errors/index.ts:17`

**Issue 1: Inverted Boundary Semantics**:

```tsx
// main.tsx - root of React tree
<ErrorBoundary level="page">  {/* Should be "global" */}
  <App />
</ErrorBoundary>

// App.tsx - inside application
<ErrorBoundary level="global">  {/* Should be "page" */}
  <Routes />
</ErrorBoundary>
```

- "Global" should be outermost (catch all errors)
- "Page" should be inner (catch page-specific errors)
- Current setup: outer boundary unreachable (App errors caught by inner first)
- Semantic confusion

**Issue 2: Duplicate QueryErrorBoundary**:

- `QueryErrorBoundary` in queries/errorHandling.tsx (165+)
- Separate implementation from consolidated ErrorBoundary
- No delegation or composition
- Different error handling logic
- Inconsistent user experience

**Issue 3: Broken Export**:

```typescript
// components/nostr/errors/index.ts:17
export { ErrorBoundary } from './ErrorBoundary';
// File ./ErrorBoundary does not exist
```

- Import will fail at runtime
- Suggests incomplete refactoring
- Dead export path

## Proposed Solutions

1. **Fix Boundary Levels** (Recommended):

   ```tsx
   // main.tsx - outermost catch-all
   <ErrorBoundary level="global">
     <App />
   </ErrorBoundary>

   // App.tsx - page-level recovery
   <ErrorBoundary level="page">
     <Routes />
   </ErrorBoundary>
   ```

2. **Consolidate QueryErrorBoundary**:

   - Make QueryErrorBoundary wrapper around ErrorBoundary
   - Delegate error handling to consolidated implementation
   - Add React Query specific error mapping
   - Remove duplicate logic

3. **Fix Broken Export**:
   - Option A: Create missing ErrorBoundary.tsx in components/nostr/errors/
   - Option B: Re-export from actual location
   - Option C: Remove export if unused
   - Verify actual usage before deciding

## Technical Details

**Error Boundary Hierarchy**:

```
main.tsx (global) - Fallback UI, error reporting to Sentry
  └─ App.tsx (page) - Per-page recovery, retry button
      └─ Routes - Page components
          └─ QueryErrorBoundary? - React Query errors
```

**QueryErrorBoundary Consolidation**:

```tsx
// Before - duplicate implementation
class QueryErrorBoundary extends Component { ... }

// After - delegating wrapper
const QueryErrorBoundary = ({ children }) => (
  <ErrorBoundary
    level="query"
    onError={(error) => {
      // React Query specific handling
      if (error instanceof QueryError) {
        // Custom logic
      }
    }}
  >
    {children}
  </ErrorBoundary>
);
```

**Files Requiring Changes**:

- `main.tsx` - Fix level prop
- `App.tsx` - Fix level prop
- `queries/errorHandling.tsx` - Refactor QueryErrorBoundary
- `components/nostr/errors/index.ts` - Fix or remove export
- Tests for all affected boundaries

## Acceptance Criteria

- [ ] main.tsx has `level="global"` ErrorBoundary
- [ ] App.tsx has `level="page"` ErrorBoundary
- [ ] Global boundary catches app-wide errors
- [ ] Page boundary catches route-specific errors
- [ ] QueryErrorBoundary delegates to ErrorBoundary
- [ ] No duplicate error handling logic
- [ ] Broken export fixed or removed
- [ ] All imports resolve correctly
- [ ] Unit tests for each boundary level
- [ ] Integration tests verify error catching hierarchy
- [ ] Error reporting to Sentry works at all levels
- [ ] User sees appropriate error UI for each error type
- [ ] Documentation updated with error boundary hierarchy

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- React Error Boundaries documentation
- React Query error handling documentation
