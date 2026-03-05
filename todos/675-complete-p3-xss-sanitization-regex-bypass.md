---
status: complete
priority: p3
issue_id: 675
tags: [code-review, slice-7, security, xss, sanitization]
dependencies: []
---

## Problem Statement

The hand-rolled HTML tag stripping regex `/<[^>]*>/g` in the wellness validator is bypassable with malformed or nested tag constructs. Additionally, there is no post-transform `.max(500)` length check, allowing sanitized input to exceed expected bounds.

## Findings

- **File**: `packages/backend/src/validators/wellness.ts:76-95`
- The regex `/<[^>]*>/g` is used to strip HTML tags from user input
- Nested/malformed constructs like `<scr<script>ipt>` survive the strip because the inner `<script>` is removed, leaving `<script>` intact
- Other bypass vectors include unclosed tags (`<script`), attribute injection (`<img src=x onerror=alert(1)`), and encoded entities
- No `.max()` length validation is applied after the sanitization transform, so a string that was under the limit before stripping could theoretically be replaced with content that exceeds limits (or vice versa, the pre-strip string could be arbitrarily long)
- Server-side context: DOMPurify is a silent no-op in Node.js without jsdom (see common-solutions.md #87)

## Proposed Solutions

1. **Preferred**: Replace the hand-rolled regex with `sanitize-html` library configured with a strict allowlist:

   ```typescript
   import sanitizeHtml from 'sanitize-html';

   const sanitized = sanitizeHtml(input, {
     allowedTags: [], // strip all HTML
     allowedAttributes: {},
   });
   ```

2. **Minimal**: If adding a dependency is not desired, apply the regex in a loop until stable (no further changes) and add a post-transform `.max(500)` check:
   ```typescript
   z.string()
     .transform((val) => {
       let prev = val;
       let current = val.replace(/<[^>]*>/g, '');
       while (current !== prev) {
         prev = current;
         current = current.replace(/<[^>]*>/g, '');
       }
       return current;
     })
     .pipe(z.string().max(500));
   ```
3. Add post-transform `.max()` check regardless of which sanitization approach is used

## Recommended Action

## Technical Details

- The regex `/<[^>]*>/g` matches from `<` to the nearest `>`, which means `<scr<script>ipt>` becomes `<script>` after one pass (the inner `<script>` part is matched and removed, but the outer `<scr` + `ipt>` reassembles into a valid tag)
- `sanitize-html` is a well-maintained library specifically designed for this use case and handles edge cases including nested tags, unclosed tags, and attribute-based XSS
- DOMPurify should NOT be used server-side without jsdom — it returns input unchanged with no warning (critical-patterns.md, common-solutions.md #87)
- Post-transform length validation is important because Zod `.max()` before `.transform()` validates the pre-transform string, not the result

## Acceptance Criteria

- [ ] HTML tag stripping handles nested/malformed constructs (e.g., `<scr<script>ipt>` is fully removed)
- [ ] Post-transform `.max()` length check is applied
- [ ] No regression in valid input handling (plain text passes through unchanged)
- [ ] Test cases cover: nested tags, unclosed tags, attribute-based XSS attempts, post-strip length overflow

## Work Log

## Resources

- `packages/backend/src/validators/wellness.ts:76-95`
- `sanitize-html` npm package: https://www.npmjs.com/package/sanitize-html
- common-solutions.md #87 (DOMPurify silent no-op in Node.js)
- OWASP XSS Prevention Cheat Sheet
