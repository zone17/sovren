---
status: complete
priority: p2
issue_id: '525'
tags: [code-review, typescript, regression, content]
dependencies: []
---

# SimpleContentEditor: 5 undefined action creator references

## Problem Statement

`SimpleContentEditor.tsx` had its tempStubs imports removed but 5 action creator call sites remain. These identifiers (`uploadMedia`, `addContentBlock`, `updateContentBlock`, `deleteContentBlock`, `updateCurrentContent`) are now undefined, producing TS2304 errors. This is a regression — the imports WERE valid no-ops in tempStubs.

**Consensus:** 8/8 review agents flagged this.

## Findings

- `packages/frontend/src/features/content/components/SimpleContentEditor.tsx`
  - Line 109: `dispatch(uploadMedia({ file })).unwrap()`
  - Line 270: `dispatch(updateCurrentContent({...}))`
  - Line 284: `dispatch(addContentBlock(...))`
  - Line 305: `dispatch(updateContentBlock(...))`
  - Lines 326, 341, 350, 355: additional dispatch calls

## Proposed Solutions

### Option A: Remove dispatch calls, add TODO stubs (Recommended)

- Match the pattern used in MediaEmbedder and PremiumContentPaywall
- Replace each dispatch call with a TODO comment
- Remove `useAppDispatch` if no longer needed
- **Effort:** Small (15 min)
- **Risk:** Low

### Option B: Revert the import removal for this file only

- Add back the tempStubs import for these 5 symbols
- But tempStubs.ts is deleted — would need to restore it or create local stubs
- **Effort:** Small
- **Risk:** Low but leaves dead code

## Acceptance Criteria

- [x] Zero TS2304 errors from undefined action creators in SimpleContentEditor
- [x] Component renders without ReferenceError
- [x] TODO comments mark each removed dispatch for future React Query migration

## Work Log

| Date       | Action                                      | Learnings                                                      |
| ---------- | ------------------------------------------- | -------------------------------------------------------------- |
| 2026-02-26 | Created from 8-agent review (8/8 consensus) | Pre-existing no-op behavior but import removal is a regression |
