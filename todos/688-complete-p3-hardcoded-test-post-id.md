---
status: pending
priority: p3
issue_id: 688
tags: [code-review, e2e, conventions]
dependencies: []
---

# Hardcoded 'test-post-id' string in post.auth.spec.ts

## Problem Statement

`post.auth.spec.ts:11` uses `await post.goto('test-post-id')` — a hardcoded string. CLAUDE.md says "Import credentials from `e2e/fixtures/test-credentials.ts` — never hardcode."

## Recommended Action

Extract to `const NONEXISTENT_POST_ID = 'test-post-id'` in test-credentials.ts.

## Work Log

| Date       | Action                                    | Learnings            |
| ---------- | ----------------------------------------- | -------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | Minor convention fix |
