---
status: pending
priority: p1
issue_id: '024'
tags: [code-review, security, csrf]
dependencies: []
---

# CSRF Exclude Paths Use Prefix Matching (Path Traversal Risk)

## Problem Statement

`csrf.ts:106-109` uses `startsWith` to check excluded paths:

```typescript
if (opts.excludePaths.some((p) => requestPath.startsWith(p))) {
```

This means `/healthcheck-admin` bypasses CSRF because it starts with `/health`. An attacker could craft `/api/v1/payments/webhooks-evil` to bypass CSRF.

## Findings

- **security-sentinel**: MEDIUM-01

## Proposed Solutions

Use exact path matching or ensure the path ends with `/` or matches exactly:

```typescript
if (opts.excludePaths.some((p) => requestPath === p || requestPath.startsWith(p + '/'))) {
```

**Effort**: Small | **Risk**: Low

## Acceptance Criteria

- [ ] `/healthcheck-admin` does NOT bypass CSRF
- [ ] `/health` and `/health/detailed` still bypass correctly
