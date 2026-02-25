---
status: complete
priority: p3
issue_id: '497'
tags:
  - code-review
  - playwright
  - e2e-testing
  - pom-consistency
dependencies: []
---

# sovrenLogo `.first()` Disambiguation Leaked to Call Site

## Problem Statement

`LayoutPage.sovrenLogo` is defined without `.first()`, but the call site in `navigation.spec.ts:37` must append `.first()` to avoid a strict mode violation:

```typescript
// POM definition
this.sovrenLogo = page.getByRole('link', { name: /Sovren/ });

// Call site — .first() required
await layout.sovrenLogo.first().click();
```

The `.first()` disambiguation should be absorbed into the POM definition so call sites don't need to know the selector is ambiguous.

## Findings

**Agent consensus: 1/4** (pattern-recognition-specialist)

## Proposed Solutions

### Option A: Move `.first()` into POM (Recommended)

```typescript
this.sovrenLogo = page.getByRole('link', { name: /Sovren/ }).first();
```

- Pros: Encapsulates disambiguation, prevents future callers from forgetting
- Cons: None
- Effort: Small (1 line)
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/pages/layout.page.ts` (line 14)
- `packages/frontend/e2e/navigation.spec.ts` (line 37 — remove `.first()`)

## Acceptance Criteria

- [ ] `.first()` in POM definition, not call site
- [ ] All 20 tests still pass

## Work Log

| Date       | Action                                            | Outcome                  |
| ---------- | ------------------------------------------------- | ------------------------ |
| 2026-02-24 | Identified by pattern-recognition-specialist      | P3 — POM encapsulation   |
| 2026-02-24 | Moved `.first()` into POM, removed from call site | Fixed — 20/20 tests pass |
