---
status: pending
priority: p2
issue_id: 069
tags: [code-review, security, authentication]
dependencies: []
---

# JWT Secret Falls Back to Hardcoded Default

## Problem Statement

The JWT signing logic falls back to a hardcoded default secret when `JWT_SECRET` environment variable is not set. This means a missing env var in production silently uses a known, weak secret instead of failing fast.

## Findings

- **Security Sentinel P2-01**: JWT secret fallback to hardcoded string allows token forgery if env var is missing.

## Proposed Solutions

### Option A: Fail fast on missing JWT_SECRET (Recommended)

Throw on startup if `JWT_SECRET` is not set in production.
**Pros:** Prevents silent insecure operation
**Cons:** Slightly harder local dev setup
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Server refuses to start in production without JWT_SECRET
- [ ] Development mode may use a default with a warning log
- [ ] No hardcoded secret in production code path
