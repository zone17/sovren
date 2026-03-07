---
status: pending
priority: p3
issue_id: '418'
tags: [code-review, testing, quality, pr-87]
dependencies: []
---

# Frontend test setup uses undeclared \_\_mocked property on getBoundingClientRect

## Problem Statement

The `vitest-frontend-setup.ts` adds a monkey-patched `getBoundingClientRect` with a guard using `Element.prototype.getBoundingClientRect.__mocked`, which is an undeclared property. TypeScript won't type-check this without `as any`, and it's a fragile pattern that could break if jsdom or vitest changes prototype handling.

## Findings

- `vitest-frontend-setup.ts:89`: `if (!Element.prototype.getBoundingClientRect.__mocked)` -- accesses undeclared property
- `vitest-frontend-setup.ts:99`: `(Element.prototype.getBoundingClientRect as any).__mocked = true` -- sets undeclared property via `as any`
- The `vi.fn()` mocks were replaced with real classes (MockResizeObserver, MockIntersectionObserver) to survive `vi.clearAllMocks()` -- this is a good pattern
- The `getBoundingClientRect` override is needed for recharts `ResponsiveContainer` in jsdom

## Proposed Solutions

### Option 1: Use a module-level boolean flag

**Approach:** Replace `__mocked` property with a file-scoped `let isBoundingRectPatched = false` flag.

**Effort:** 5 minutes

**Risk:** Low

---

### Option 2: Accept as-is

**Approach:** The `__mocked` pattern works and is isolated to test setup.

**Effort:** 0 minutes

## Recommended Action

Low priority. Accept as-is since it's test infrastructure.

## Technical Details

**Affected files:**

- `test-utils/vitest-frontend-setup.ts:89-100`

## Acceptance Criteria

- [ ] Decision documented

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
