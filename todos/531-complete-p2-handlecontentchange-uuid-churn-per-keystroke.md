---
status: complete
priority: p2
issue_id: '531'
tags: [code-review, performance, data-integrity, pr-100]
dependencies: []
---

# P2: handleContentChange generates new UUIDs on every keystroke

## Problem Statement

In `SimpleContentEditor.tsx`, the `handleContentChange` function calls `crypto.randomUUID()` for every paragraph on every keystroke. This means all block IDs are regenerated every time the user types a character, causing:

1. **Performance**: O(p) UUID generation per keystroke where p = number of paragraphs
2. **Data integrity**: Block IDs are unstable — any feature relying on block identity (collaborative editing, undo/redo, analytics) would break
3. **React reconciliation**: Unstable keys force full re-renders of block lists

**Agent consensus**: 2/8 (Performance Oracle, Data Integrity Guardian)

## Findings

### Performance Oracle

- `crypto.randomUUID()` called per paragraph per keystroke in `handleContentChange` (lines ~284-296)
- O(p) crypto calls per keystroke is wasteful

### Data Integrity Guardian

- Block IDs destabilize on every keystroke — `localBlocks` state churns constantly
- Any `onSave` callback receiving blocks gets different IDs each time even if content hasn't changed

## Proposed Solutions

### Option A: Stable ID generation from content hash (Recommended)

Generate deterministic IDs from paragraph index + content hash. Blocks only get new IDs when content actually changes.

**Pros**: Stable IDs, zero unnecessary UUID generation, React reconciliation works optimally
**Cons**: Hash collisions theoretically possible (extremely unlikely with index prefix)
**Effort**: Small (15 min)
**Risk**: Low

### Option B: Initialize IDs once, update on structural changes only

Keep block state with persistent IDs. Only generate new UUIDs when paragraphs are added (not on every change).

**Pros**: True stable identities, works for collaborative editing
**Cons**: More complex state management (need to diff paragraphs)
**Effort**: Medium (45 min)
**Risk**: Low

### Option C: Defer — component is a stub

The content editors are stub components that throw "not implemented" errors. UUID churn is harmless in dead code.

**Pros**: Zero effort
**Cons**: Tech debt accumulates; when editors become real, this will be a P1
**Effort**: None
**Risk**: Medium (forgotten when editors go live)

## Recommended Action

Option A or C depending on whether content editors are being activated in v2.0 sprints.

## Technical Details

**Affected files:**

- `packages/frontend/src/features/content/components/SimpleContentEditor.tsx` (~lines 284-296)

## Acceptance Criteria

- [ ] Block IDs are stable across keystrokes when content structure doesn't change
- [ ] New blocks get unique IDs when paragraphs are added
- [ ] No `crypto.randomUUID()` calls in the per-keystroke hot path

## Work Log

| Date       | Action                                | Learnings                                  |
| ---------- | ------------------------------------- | ------------------------------------------ |
| 2026-02-26 | Created from PR #100 review (8-agent) | 2/8 consensus: Performance + DataIntegrity |

## Resources

- PR #100: https://github.com/zone17/sovren/pull/100
- File: `packages/frontend/src/features/content/components/SimpleContentEditor.tsx`
