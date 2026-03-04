---
status: pending
priority: p2
issue_id: '651'
tags: [code-review, frontend, ux, business-manager]
dependencies: []
---

# No Double-Click Guard on Tax Export

## Problem Statement

`handleExport` in `TaxSummary.tsx` is an async function with no mutex. Rapid clicks before the first microtask resolves could fire concurrent export requests. The `exporting` state is set synchronously but React batches state updates, so there's a small window for duplicate requests.

**Consensus**: 2/8 review agents flagged this.

## Findings

- `packages/frontend/src/features/business/components/TaxSummary.tsx` — `handleExport` sets `setExporting(true)` but button `disabled={exporting}` may not update fast enough for rapid clicks

## Proposed Solutions

### Solution A: useRef mutex (Recommended)

```typescript
const exportingRef = useRef(false);
const handleExport = async (format: 'csv' | 'json') => {
  if (exportingRef.current) return;
  exportingRef.current = true;
  // ... existing logic
  finally { exportingRef.current = false; }
};
```

- **Pros**: Synchronous check, no race window. Established pattern (critical-patterns.md)
- **Cons**: Extra ref alongside state
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Rapid double-click cannot trigger concurrent export requests
- [ ] Button still shows disabled state during export
- [ ] No regression in export flow

## Work Log

| Date       | Action                                            | Learnings                                                       |
| ---------- | ------------------------------------------------- | --------------------------------------------------------------- |
| 2026-03-04 | Created from PR #136 review (2/8 agent consensus) | useRef+disabled double-submit pattern from critical-patterns.md |
