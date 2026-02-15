---
status: pending
priority: p1
issue_id: 004
tags: [code-review, security]
dependencies: []
---

# XSS Vulnerability in Markdown and Rich Text Editors

## Problem Statement

XSS via unsanitized markdown rendering in MarkdownEditor.tsx (dangerouslySetInnerHTML with regex-based conversion, no HTML sanitization) and RichTextEditor.tsx (innerHTML assignment without sanitization).

## Findings

Security-sentinel found convertMarkdownToHTML() performs regex markdown conversion without sanitization, rendered via dangerouslySetInnerHTML at line 540. Links allow javascript: URLs, images allow onerror handlers, no HTML stripping. RichTextEditor.tsx line 88 directly assigns content to innerHTML. OWASP A03:2021 Injection (XSS).

## Proposed Solutions

### Option A: Add DOMPurify Sanitization

Add DOMPurify sanitization before dangerouslySetInnerHTML and innerHTML.

**Pros:** Minimal code changes, proven library, immediate protection, configurable
**Cons:** Still relies on custom markdown parser, sanitization overhead
**Effort:** Small
**Risk:** Low

### Option B: Replace with Battle-Tested Libraries

Replace custom regex parser with battle-tested library (marked + DOMPurify).

**Pros:** Industry-standard markdown parsing, better edge case handling, maintained by community
**Cons:** Larger dependency, potential behavior changes, migration effort
**Effort:** Medium
**Risk:** Low

## Technical Details

**Affected Files:**

- packages/frontend/src/features/content/components/MarkdownEditor.tsx (lines 303-353, 540)
- packages/frontend/src/features/content/components/RichTextEditor.tsx (line 88)

## Acceptance Criteria

- [ ] All user content passes through DOMPurify before DOM insertion
- [ ] No javascript: URLs in rendered output
- [ ] XSS test payloads are neutralized
- [ ] Image onerror handlers are stripped
- [ ] All HTML attributes are sanitized

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
