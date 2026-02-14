---
status: pending
priority: p1
issue_id: '020'
tags: [code-review, security, csp, xss]
dependencies: []
---

# Production CSP Allows unsafe-inline and unsafe-eval

## Problem Statement

Both `vercel.json` and `nginx.conf` serve CSP headers that allow `'unsafe-inline'` and `'unsafe-eval'` in `script-src`, completely negating XSS protection. The backend `security-headers.ts` correctly removes these for production, but these deployment configs override that protection at the edge.

## Findings

- **security-sentinel**: CRITICAL-04 - CSP in vercel.json (line 53) and nginx.conf (line 55) both allow unsafe-inline/eval
- **architecture-strategist**: CSP directives in security-headers.ts diverge from Helmet config in app.ts

**Affected Files:**

- `vercel.json:53`
- `packages/frontend/nginx.conf:55`

## Proposed Solutions

### Option A: Remove unsafe-inline/eval, use nonces (Recommended)

- Remove `'unsafe-inline'` and `'unsafe-eval'` from both files
- Use nonce-based CSP for any inline scripts needed by Vite
- **Effort**: Medium | **Risk**: May break inline styles; needs testing

### Option B: Use hash-based CSP allowlist

- Compute hashes of known inline scripts and add to CSP
- **Effort**: Medium | **Risk**: Hashes must be updated when scripts change

## Acceptance Criteria

- [ ] `vercel.json` CSP does not contain `unsafe-inline` or `unsafe-eval` in `script-src`
- [ ] `nginx.conf` CSP does not contain `unsafe-inline` or `unsafe-eval` in `script-src`
- [ ] Frontend renders correctly with updated CSP
- [ ] No XSS protection bypasses in deployment edge configs
