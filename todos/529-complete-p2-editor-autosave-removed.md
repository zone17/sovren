---
status: complete
priority: p2
issue_id: '529'
tags: [code-review, content, data-integrity]
dependencies: []
---

# RichTextEditor + MarkdownEditor: auto-save dispatch removed

## Problem Statement

Both editors removed `dispatch(updateCurrentContent({...}))` from their auto-save timers. The auto-save now only calls `onSave?.()`, which is an optional prop. If parent components don't provide `onSave`, content changes are silently lost on unmount.

**Note:** The old `updateCurrentContent` dispatch was a no-op stub, so content was already not being persisted. This is a pre-existing gap, not a regression.

**Consensus:** 2/8 agents flagged (data integrity + agent-native).

## Findings

- `RichTextEditor.tsx:94-104` — auto-save calls `onSave?.()` only
- `MarkdownEditor.tsx:94-103` — same pattern
- `onSave` prop is optional (`onSave?: () => void`)

## Proposed Solutions

### Option A: Add console warning when autoSave lacks onSave

- `if (autoSave && !onSave) console.warn(...)`
- **Effort:** Trivial (5 min)
- **Risk:** None

### Option B: Defer — address during React Query migration

- When content service is implemented, `onSave` will be wired to mutation
- **Effort:** None
- **Risk:** Low

## Acceptance Criteria

- [x] Console.warn added when autoSave=true but onSave not provided

## Work Log

| Date       | Action                      | Learnings                          |
| ---------- | --------------------------- | ---------------------------------- |
| 2026-02-26 | Created from 8-agent review | Pre-existing no-op, not regression |
