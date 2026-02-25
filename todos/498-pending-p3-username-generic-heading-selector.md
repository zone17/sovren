---
status: pending
priority: p3
issue_id: '498'
tags:
  - code-review
  - playwright
  - e2e-testing
  - locator-fragility
dependencies: []
---

# ProfilePage.userName Uses Generic Level-Only Heading Selector

## Problem Statement

```typescript
this.userName = page.getByRole('heading', { level: 1 });
```

This matches any `<h1>` on the page. If a future change adds a second `<h1>` (error boundary, modal, etc.), this locator will produce a strict mode violation. Every other heading locator across the POM suite includes a `name` constraint — this is the only level-only selector.

## Findings

**Agent consensus: 1/4** (pattern-recognition-specialist)

## Proposed Solutions

### Option A: Keep level-only but add `.first()` safety (Recommended)

```typescript
this.userName = page.getByRole('heading', { level: 1 }).first();
```

- Pros: Simple, no functional change, prevents strict mode violation
- Cons: Masks the real issue if a second h1 appears
- Effort: Small
- Risk: Low

### Option B: Add data-testid to Profile component

- Pros: Stable, explicit
- Cons: Adds test-id to production code
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/pages/profile.page.ts` (line 10)

## Acceptance Criteria

- [ ] ProfilePage.userName resilient to multiple h1 elements
- [ ] All 20 tests still pass

## Work Log

| Date       | Action                                       | Outcome             |
| ---------- | -------------------------------------------- | ------------------- |
| 2026-02-24 | Identified by pattern-recognition-specialist | P3 — fragility risk |
