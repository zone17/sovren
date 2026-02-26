---
status: complete
priority: p3
issue_id: '530'
tags: [code-review, cleanup, style]
dependencies: []
---

# P3 cleanup: whitespace, `any` types, stale comments, missing patch()

## Problem Statement

Minor style/quality issues flagged by multiple agents.

## Findings

1. **analyticsApi.ts whitespace** (5/8 consensus) — Lines 13, 17, 21 have extra space: `apiClient.get( \`...\`)`→ should be`apiClient.get(\`...\`)`

2. **`any` types in test stubs** (3/8 consensus) — 6 `any` occurrences in inline no-op reducers across Post.test.tsx, test-providers.tsx, SimpleContentEditor.test.tsx. Violates zero-any standard.

3. **Stale "tempStubs" comments** — SimpleContentEditor.test.tsx has 4 comments referencing "tempStubs reducer" which no longer exists.

4. **Import order in Post.test.tsx** — `import type { User }` and `import Post` appear after `const` declarations (ESLint import-order violation).

5. **Missing `patch()` method** — `HttpMethod` includes 'PATCH' but no public `patch()` convenience method. No current callers, so YAGNI, but type/API asymmetry.

## Proposed Solutions

Fix all in one commit (< 10 min total):

- Remove 3 whitespace characters in analyticsApi.ts
- Type the inline reducers or suppress with eslint-disable
- Update 4 stale comments
- Move imports above const declarations in Post.test.tsx
- Either add `patch()` or remove 'PATCH' from HttpMethod

## Acceptance Criteria

- [x] analyticsApi.ts formatting consistent with other API files
- [x] No stale tempStubs references in comments
- [x] `any` types replaced with typed interfaces in test stubs
- [x] Import order fixed in Post.test.tsx
- [x] Removed unused PATCH from HttpMethod (YAGNI)

## Work Log

| Date       | Action                      | Learnings                         |
| ---------- | --------------------------- | --------------------------------- |
| 2026-02-26 | Created from 8-agent review | Bundled 5 minor items into 1 todo |
