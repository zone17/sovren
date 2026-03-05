---
status: pending
priority: p2
issue_id: '628'
tags: [code-review, security, frontend, xss]
dependencies: []
---

# Avatar URL rendered without sanitization

## Problem Statement

In `packages/frontend/src/features/comments/components/CommentItem.tsx` lines 94-96, the `avatarUrl` from comment author data is rendered directly in an `<img src>` attribute without protocol validation. A malicious `javascript:` or `data:` URI could be injected.

## Findings

- Security Sentinel flagged as P2
- React's JSX prevents XSS in text content but does NOT sanitize URL attributes
- The avatarUrl comes from the database (users table) which is populated during registration

## Proposed Solutions

### Option A: Add URL protocol whitelist (Recommended)

Only render img if URL starts with `https://` or `http://`.

- Pros: Simple, effective
- Cons: None
- Effort: Small

## Acceptance Criteria

- [ ] Avatar img only renders for http/https URLs
- [ ] Non-http URLs show fallback initial instead
