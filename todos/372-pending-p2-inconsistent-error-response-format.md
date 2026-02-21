---
status: pending
priority: p2
issue_id: 372
tags:
  - code-review
  - quality
  - agent-native
dependencies: []
---

# Inconsistent Error Response Format Across Endpoints

## Problem Statement

Error responses use 3 different formats across endpoints: `{ error: string }`, `{ message: string }`, `{ error: { code, message } }`. This makes client-side error handling fragile and agent-unfriendly, as consumers must handle multiple shapes for the same semantic concept.

## Findings

**Source agents:** quality-agent, agent-native-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/routes/v2/*.ts`
- Issue: Three distinct error response shapes used across route handlers. Some routes already use `createApiResponse()` but many do not.

## Proposed Solutions

### Option A: Standardize on createApiResponse() error format

- **Approach:** Extend `createApiResponse()` usage to all endpoints. This helper already exists and is used in some routes — apply it consistently across all v2 route files.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/routes/v2/*.ts`

## Acceptance Criteria

- [ ] All error responses use `createApiResponse()` format
- [ ] No raw `{ error: string }` or `{ message: string }` responses remain in v2 routes
- [ ] Frontend error handling works consistently with the standardized format

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
