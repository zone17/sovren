---
status: pending
priority: p2
issue_id: 342
tags: [code-review, security, dead-code]
---

# `validateSsrfUrlSync` exported but never called — dead unsafe variant

## Problem Statement

The `validateSsrfUrlSync` function is exported from the SSRF utility module but is never called anywhere in the codebase. The sync variant cannot perform DNS resolution (which is inherently async), making it fundamentally less safe than the async version. Its mere existence as an export invites future misuse by developers who might prefer the simpler sync API without understanding its limitations.

## Findings

- `packages/backend/src/utils/ssrf.ts` — exports `validateSsrfUrlSync` (~41 lines)
- No call sites found anywhere in the codebase
- The sync variant cannot do DNS resolution, making it unable to detect DNS rebinding attacks
- The async `validateSsrfUrl` is the correct and used variant

## Proposed Solutions

1. Delete the `validateSsrfUrlSync` function and its export (~41 LOC removal)
2. Verify no imports reference it (already confirmed: zero call sites)

## Technical Details

- **Affected Files**: packages/backend/src/utils/ssrf.ts

## Acceptance Criteria

- [ ] `validateSsrfUrlSync` function deleted
- [ ] Export removed from module
- [ ] No remaining references to the function
- [ ] Async `validateSsrfUrl` remains unaffected
- [ ] Net reduction of ~41 lines of code
