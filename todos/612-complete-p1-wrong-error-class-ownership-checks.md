---
status: pending
priority: p1
issue_id: '612'
tags: [code-review, security, backend, content-shield]
dependencies: []
---

# P1: getCertificate/revokeProvenance Use NotFoundError for Ownership Checks

## Problem Statement

`getCertificate` (line 81-83) and `revokeProvenance` (line 208-209) throw `NotFoundError` when the `creatorId` doesn't match the record owner. Per critical-patterns.md and common-solutions.md #24, ownership checks MUST use `AuthorizationError` (403). The same file's `signContent` correctly uses `AuthorizationError` — inconsistency within the same service.

Throwing 404 instead of 403: (a) misleads callers, (b) bypasses security monitoring keying on 403, (c) leaks existence vs permission info.

## Findings

- **Kieran TS (P1-1)**: "Per the project's own critical-patterns.md — ownership failures MUST use AuthorizationError (403), not NotFoundError (404)"
- **Consensus**: 1/5 agents (Kieran), but aligns with established pattern from PR #92

## Proposed Solutions

### Option A: Replace NotFoundError with AuthorizationError (Recommended)

Trivial fix — `AuthorizationError` is already imported on line 20.

- Effort: Small (<5 min)
- Risk: None

## Technical Details

**Affected files:**

- `packages/backend/src/services/provenance/ProvenanceService.ts` (lines 81-83, 208-209)

## Acceptance Criteria

- [ ] `getCertificate` throws `AuthorizationError` for ownership mismatch
- [ ] `revokeProvenance` throws `AuthorizationError` for ownership mismatch
- [ ] Unit tests updated to expect AuthorizationError

## Work Log

| Date       | Action                      | Learnings                      |
| ---------- | --------------------------- | ------------------------------ |
| 2026-03-03 | Created from PR #132 review | Same pattern as PR #92 finding |

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
- common-solutions.md #24: Error class selection matrix
