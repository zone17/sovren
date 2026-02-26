---
status: complete
priority: p3
issue_id: '538'
tags: [code-review, agent-native, quality, pr-100]
dependencies: []
---

# P3: Agent-native improvements + code quality bundle

## Problem Statement

A collection of lower-severity findings from the 8-agent review that individually don't warrant dedicated todos:

### Agent-Native (Agent-Native Reviewer)

1. Content editing has zero programmatic API surface — no agent can create/edit content
2. `ApiClient` class not exported, only singleton instance — limits testing and agent usage
3. `ApiError.toJSON()` missing — agents can't easily parse error responses
4. No `contentApi.ts` service file — content operations not exposed as API functions

### Code Quality (TypeScript Reviewer + Simplicity)

5. `as unknown as ReturnType<typeof cmsReducer>` double assertion in test-providers.tsx (line 260)
6. Synthetic event fabrication in SimpleContentEditor `formatText` (lines ~366-368) — fake event object
7. `useCallback` with empty deps array is premature optimization (Simplicity)
8. `body?: unknown` on public HTTP methods — could be narrowed to `Record<string, unknown> | unknown[]`

### Stale References (Git History Analyzer)

9. `dependency-optimization-report.json` has stale reference
10. Duplicate commit message subjects (commits 1 and 2)
11. ADR commits on refactor branch (one-epic-per-branch violation)

### Pre-existing (Multiple agents)

12. `DEFAULT_BASE_URL` hardcoded HTTP (Security)
13. Auth token in localStorage (Security)
14. Content-Type: application/json on GET requests (Data Integrity)
15. MediaEmbedder is 474 lines with broken upload path (Simplicity)

## Proposed Solutions

### For items 1-4 (Agent-Native)

Defer to a dedicated "agent-native content API" story when content editing goes live. Not actionable while editors are stubs.

### For items 5-8 (Code Quality)

Fix opportunistically when touching these files. None are blocking.

### For items 9-11 (Stale References)

- Item 10-11: Cosmetic, already committed. No action.
- Item 9: Delete stale report if it has zero importers.

### For items 12-15 (Pre-existing)

No action — these predate PR #100 and are not regressions.

## Recommended Action

Defer all. Fix items 5-8 opportunistically during next sprint.

## Technical Details

**Affected files:**

- `packages/frontend/src/services/api/apiClient.ts` (items 2, 3, 8, 12, 13, 14)
- `packages/frontend/src/test-utils/test-providers.tsx` (item 5)
- `packages/frontend/src/features/content/components/SimpleContentEditor.tsx` (items 6, 7)
- `packages/frontend/src/features/content/components/MediaEmbedder.tsx` (item 15)

## Acceptance Criteria

- [ ] Items tracked for opportunistic fix
- [ ] No regression from deferral

## Work Log

| Date       | Action                                | Learnings                     |
| ---------- | ------------------------------------- | ----------------------------- |
| 2026-02-26 | Created from PR #100 review (8-agent) | Bundled 15 low-severity items |

## Resources

- PR #100: https://github.com/zone17/sovren/pull/100
