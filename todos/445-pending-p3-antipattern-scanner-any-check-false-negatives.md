---
id: 445
severity: P3
status: pending
title: "Anti-pattern scanner: 'as any' regex misses some patterns"
file: scripts/check-antipatterns.sh
found_in: PR #89
reviewer: review-infra
---

# Anti-pattern scanner any-type check has regex gaps

## Problem

Check 1a uses this regex:

```bash
grep -HnE '(\bas\s+any\b|:\s*any\b|<any>|<any\[)'
```

This catches `as any`, `: any`, `<any>`, `<any[` but misses:
1. `any[]` (array of any without angle brackets) — e.g., `param: any[]`
2. `Promise<any>` — the `<any>` pattern matches but `Promise<any[]>` may not depending on how grep handles the brackets
3. `Record<string, any>` — uses `any` inside generic but not at the boundaries matched by the regex
4. `(...args: any)` — rest parameters with any

Also, the comment exclusion `grep -v '^\s*//'` only catches lines that START with a comment. Inline comments (`const x = foo; // as any`) could false-positive, but that's the correct behavior since `as any` in code (not just comments) should be flagged.

## Location

```
scripts/check-antipatterns.sh  lines 20-21
```

## Fix

Expand the regex:

```bash
grep -HnE '(\bas\s+any\b|:\s*any\b|<any[>\[\],)]|any\[\])'
```

Or use a more comprehensive pattern:
```bash
grep -HnE '\bany\b' | grep -v '^\s*//' | grep -v 'import type'
```

And then filter known exceptions (like `CustomType<any>` in DI registrations that are intentionally generic).

## Severity Justification

P3: Scanner effectiveness. Missing patterns reduce the value of the pre-commit check but don't introduce security issues.
