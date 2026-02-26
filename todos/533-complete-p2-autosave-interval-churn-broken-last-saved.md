---
status: complete
priority: p2
issue_id: '533'
tags: [code-review, performance, bug, pr-100]
dependencies: []
---

# P2: Autosave interval churn + broken last_saved guard

## Problem Statement

Two related issues in content editor autosave logic:

1. **MarkdownEditor**: `markdown` is in the useEffect dependency array for the autosave interval. Every keystroke tears down and recreates the interval, defeating the purpose of debounced saving.

2. **SimpleContentEditor**: The autosave guard `if (last_saved === null)` means autosave only fires ONCE (when `last_saved` is null on first mount). After the first save sets `last_saved` to a timestamp, the guard is never true again and autosave stops working.

**Agent consensus**: 2/8 (Performance Oracle flagged both; Data Integrity Guardian flagged the broken save)

## Findings

### Performance Oracle

- MarkdownEditor (~lines 103-112): `markdown` in autosave deps causes interval teardown/recreation per keystroke
- SimpleContentEditor (~lines 257-268): autosave only fires when `last_saved === null` — broken after first save
- RichTextEditor has similar `editorContent` churn pattern (P3)

### Data Integrity Guardian

- `localBlocks` data loss risk on unmount — `onSave` callback can't reliably read latest local state because of the autosave guard bug

## Proposed Solutions

### Option A: Fix both issues (Recommended)

1. MarkdownEditor: Remove `markdown` from autosave deps; read current value via ref inside interval callback
2. SimpleContentEditor: Change guard from `last_saved === null` to a dirty flag or timestamp comparison

**Pros**: Fixes real bugs, minimal changes
**Cons**: None
**Effort**: Small (20 min)
**Risk**: Low

### Option B: Defer — editors are stubs

Both editors are stub components with "not implemented" error states. Autosave on stubs is meaningless.

**Pros**: Zero effort
**Cons**: Bugs persist; if editors become real in v2.0, these are P1s
**Effort**: None
**Risk**: Medium

## Recommended Action

Option A if editors are being activated in v2.0; Option B if they remain stubs.

## Technical Details

**Affected files:**

- `packages/frontend/src/features/content/components/MarkdownEditor.tsx` (~lines 103-112)
- `packages/frontend/src/features/content/components/SimpleContentEditor.tsx` (~lines 257-268)
- `packages/frontend/src/features/content/components/RichTextEditor.tsx` (~lines 102-113, P3 severity)

## Acceptance Criteria

- [ ] Autosave interval is NOT recreated on every keystroke
- [ ] Autosave fires on schedule after the first save (not just once)
- [ ] Content is reliably saved before unmount

## Work Log

| Date       | Action                                | Learnings                                  |
| ---------- | ------------------------------------- | ------------------------------------------ |
| 2026-02-26 | Created from PR #100 review (8-agent) | 2/8 consensus: Performance + DataIntegrity |

## Resources

- PR #100: https://github.com/zone17/sovren/pull/100
