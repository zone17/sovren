---
status: pending
priority: p1
issue_id: '580'
tags: [code-review, pr-108, security, backend]
---

# escapePostgrestFilter missing %, \_, \, :, " characters

## Problem Statement

The `escapePostgrestFilter()` function escapes `,`, `.`, `*`, `(`, `)` but misses SQL ILIKE wildcards (`%`, `_`), the escape character itself (`\`), PostgREST operator delimiter (`:`), and double-quote (`"`). A user searching for `100%` or `_admin` gets unintended wildcard matches. A `\,` input produces `\\,` which may leave the comma unescaped.

**Flagged by: Kieran TS, Security Sentinel, Data Integrity Guardian, Performance Oracle**

## Findings

- `discovery.routes.ts:29`: `return input.replace(/[,.*()]/g, '\\$&');`
- `%` and `_` are SQL LIKE wildcards — enables enumeration attacks
- `\` is the escape char — must be escaped first to prevent double-escape breakage
- `:` is PostgREST operator delimiter — `test::text` could inject type cast
- `"` wraps values in PostgREST — could terminate quoted context

## Proposed Solutions

```typescript
function escapePostgrestFilter(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // escape \ first
    .replace(/[,.:*()"\\%_]/g, '\\$&'); // then all other metacharacters
}
```

Add test cases for `%`, `_`, `\`, `:`, `"`.

## Acceptance Criteria

- [ ] `%`, `_`, `\`, `:`, `"` are escaped in escapePostgrestFilter
- [ ] Backslash escaped before other chars to prevent double-escape
- [ ] Test cases added for all new escaped characters
