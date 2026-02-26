---
status: complete
priority: p2
issue_id: '536'
tags: [code-review, security, xss, pr-100]
dependencies: []
---

# P2: XSS via paste handler in RichTextEditor

## Problem Statement

In `RichTextEditor.tsx`, the paste handler gets `text/plain` data but then inserts it as HTML via `insertHTML`, converting newlines to `<br>` tags without escaping angle brackets:

```typescript
e.preventDefault();
const text = e.clipboardData.getData('text/plain');
const cleanText = text.replace(/[\r\n]/g, '<br>');
document.execCommand('insertHTML', false, cleanText);
```

If a user pastes text containing angle brackets (e.g., `<script>alert(1)</script>` or `<img onerror=alert(1)>`), the unescaped HTML is inserted directly into the DOM.

**Pre-existing**: This code existed before PR #100. The PR modified other parts of RichTextEditor but not this handler.

**Agent consensus**: 1/8 (Security Sentinel) — but security-class findings don't require consensus

## Findings

### Security Sentinel

- XSS vulnerability via clipboard paste (lines ~247-251)
- `getData('text/plain')` returns raw text but `insertHTML` interprets it as HTML
- Missing HTML entity escaping for `<`, `>`, `&`, `"`, `'`

## Proposed Solutions

### Option A: HTML-escape before insertHTML (Recommended)

Add a simple escape function: `text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')` before the newline-to-br replacement.

**Pros**: One-line fix, completely prevents XSS
**Cons**: None
**Effort**: Small (5 min)
**Risk**: None

### Option B: Use insertText instead of insertHTML

Switch from `document.execCommand('insertHTML')` to `document.execCommand('insertText')` which doesn't interpret HTML.

**Pros**: Eliminates entire class of injection
**Cons**: Loses `<br>` newline preservation (text would be flat)
**Effort**: Small (5 min)
**Risk**: Low (newlines rendered differently)

### Option C: Defer — editor is a stub

RichTextEditor is a stub component. The paste handler is part of stub infrastructure that will be replaced.

**Pros**: Zero effort
**Cons**: XSS vulnerability exists in shipped code even if feature is "not implemented"
**Effort**: None
**Risk**: Medium (security debt)

## Recommended Action

Option A — trivial fix, eliminates real XSS vector.

## Technical Details

**Affected files:**

- `packages/frontend/src/features/content/components/RichTextEditor.tsx` (~lines 247-251)

## Acceptance Criteria

- [ ] Pasting `<script>alert(1)</script>` renders as visible text, not executable HTML
- [ ] Newline preservation still works (newlines become line breaks)
- [ ] No XSS possible via clipboard paste

## Work Log

| Date       | Action                                | Learnings                            |
| ---------- | ------------------------------------- | ------------------------------------ |
| 2026-02-26 | Created from PR #100 review (8-agent) | Pre-existing, 1/8 but security-class |

## Resources

- PR #100: https://github.com/zone17/sovren/pull/100
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Scripting_Prevention_Cheat_Sheet.html
