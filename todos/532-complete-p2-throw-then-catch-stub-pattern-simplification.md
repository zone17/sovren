---
status: complete
priority: p2
issue_id: '532'
tags: [code-review, simplicity, quality, pr-100]
dependencies: []
---

# P2: Throw-then-catch stub pattern adds unnecessary complexity

## Problem Statement

Four content components use a throw-then-catch anti-pattern for stub functionality:

```typescript
try {
  throw new Error('Not implemented');
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
}
```

This is equivalent to `setError('Not implemented')` — the try/catch adds 5 lines of noise per occurrence with zero benefit.

**Agent consensus**: 2/8 (Simplicity Reviewer, Security Sentinel)

## Findings

### Simplicity Reviewer

- 4 occurrences across content components: SimpleContentEditor, PremiumContentPaywall, MediaEmbedder, RichTextEditor
- Each adds ~5 lines of unnecessary control flow
- The `instanceof Error` check is always true since we just threw an `Error`

### Security Sentinel

- Stub error messages expose implementation details ("Feature not implemented: Lightning integration")
- Should use structured error codes (e.g., `NOT_IMPLEMENTED`) instead of descriptive strings

## Proposed Solutions

### Option A: Direct setError call (Recommended)

Replace throw-then-catch with direct `setError('Not implemented')` or `setError('Feature coming soon')`.

**Pros**: Simplest, removes 20+ lines of noise across 4 files
**Cons**: None
**Effort**: Small (10 min)
**Risk**: None

### Option B: Structured NOT_IMPLEMENTED error

Use `ApiError` with code `NOT_IMPLEMENTED` for machine-parseable stub errors.

**Pros**: Agent-native friendly, consistent error codes
**Cons**: Overkill for UI-only stubs that never hit the API
**Effort**: Small (15 min)
**Risk**: None

### Option C: Defer — stubs will be replaced

These components are stubs. When real features are built, the throw-then-catch will be replaced entirely.

**Pros**: Zero effort now
**Cons**: Pattern may be copied into new components
**Effort**: None
**Risk**: Low

## Recommended Action

Option A — direct simplification.

## Technical Details

**Affected files:**

- `packages/frontend/src/features/content/components/SimpleContentEditor.tsx` (~lines 111-118)
- `packages/frontend/src/features/content/components/PremiumContentPaywall.tsx` (~lines 58-67)
- `packages/frontend/src/features/content/components/MediaEmbedder.tsx` (~lines 110-118)
- `packages/frontend/src/features/content/components/RichTextEditor.tsx` (similar pattern)

## Acceptance Criteria

- [ ] No try/catch blocks wrapping intentional `throw new Error()` calls
- [ ] Stub actions use direct `setError()` calls
- [ ] All existing tests pass

## Work Log

| Date       | Action                                | Learnings                            |
| ---------- | ------------------------------------- | ------------------------------------ |
| 2026-02-26 | Created from PR #100 review (8-agent) | 2/8 consensus: Simplicity + Security |

## Resources

- PR #100: https://github.com/zone17/sovren/pull/100
