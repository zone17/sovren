---
status: pending
priority: p3
issue_id: '653'
tags: [code-review, cleanup, business-manager]
dependencies: []
---

# Miscellaneous P3 Cleanup Items (Business Manager)

## Problem Statement

Collection of minor cleanup items identified during PR #136 review that don't block merge but improve code quality.

## Findings

1. **`new Intl.NumberFormat()` per call** — `formatUsd()` in `TaxSummary.tsx` creates a new formatter on every invocation. Hoist to module scope.
2. **Noop `onViewInvoice` callback** — `InvoiceDashboard` passes a noop callback; make the prop optional.
3. **Dead `BusinessPagination` type** — Wrong shape, never used. Delete.
4. **Year parameter no bounds validation** — `useTaxSummary(year)` accepts any number. Add 2000-2100 guard.
5. **`@types/qrcode` in dependencies** — Should be in devDependencies since only used in source (bundled away).
6. **Named export inconsistency** — `BusinessManagerDashboard` is a named export; all other business components use default exports. Standardize.
7. **Duplicate Suspense boundary** — `/business` route in App.tsx has Suspense inside ErrorBoundary, which is already present in the ProtectedRoute wrapper (architecture review).

## Proposed Solutions

Each item is a small, independent fix. Address individually or in a single cleanup commit.

- **Effort**: Small (all items combined)
- **Risk**: Low

## Acceptance Criteria

- [ ] Intl.NumberFormat hoisted to module scope
- [ ] onViewInvoice prop made optional
- [ ] Dead BusinessPagination type removed
- [ ] @types/qrcode moved to devDependencies
- [ ] Export style standardized

## Work Log

| Date       | Action                                       | Learnings                  |
| ---------- | -------------------------------------------- | -------------------------- |
| 2026-03-04 | Created from PR #136 review (various agents) | Batched P3s for efficiency |
