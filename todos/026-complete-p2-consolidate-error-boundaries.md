---
status: pending
priority: p2
issue_id: '026'
tags: [code-review, architecture, react, duplication]
dependencies: []
---

# Consolidate 5 Error Boundary Implementations into 1

## Problem Statement

Five separate React ErrorBoundary components exist with ~65% code duplication:

1. `monitoring/ErrorBoundary.tsx` (257 lines) - ACTIVE, used in main.tsx
2. `components/GlobalErrorBoundary.tsx` (288 lines) - NEW, unused
3. `components/FeatureErrorBoundary.tsx` (349 lines) - NEW, unused
4. `components/nostr/errors/ErrorBoundary.tsx` (364 lines) - NOSTR-specific
5. `components/ui/error-boundary.tsx` (42 lines) - minimal bare-bones

Shared patterns duplicated: `getDerivedStateFromError`, `componentDidCatch`, error ID generation, auto-retry with exponential backoff, timer cleanup, Sentry capture.

The Nostr boundary uses `(window as any).Sentry` instead of the module import (anti-pattern).

## Findings

- **architecture-strategist**: CRITICAL - three competing implementations
- **pattern-recognition-specialist**: HIGH - 5 duplicate ErrorBoundary implementations
- **kieran-typescript-reviewer**: Identified unused boundaries and anti-patterns

## Proposed Solutions

### Option A: Consolidate into single configurable boundary (Recommended)

Create one `ErrorBoundary` with level/feature options. Re-export through barrel files.

- **Effort**: Medium | **Risk**: Low

### Option B: Keep active one, delete unused

Keep `monitoring/ErrorBoundary.tsx`, delete the other 4.

- **Effort**: Small | **Risk**: Loses Sentry integration from newer ones

## Acceptance Criteria

- [ ] Single ErrorBoundary component with configurable levels
- [ ] No `(window as any).Sentry` access
- [ ] `main.tsx` uses the consolidated boundary
- [ ] Auto-retry defaults to `false` (render bugs don't benefit from retry)
