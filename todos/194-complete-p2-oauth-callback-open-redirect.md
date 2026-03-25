---
status: pending
priority: p2
issue_id: '194'
tags: [code-review, pr-85, security]
---

# OAuth Callback Open Redirect

## Problem Statement

OAuth callback redirects to hardcoded `http://localhost:3000` without FRONTEND_URL env var validation. In production, redirect URL should be https and validated.

## Findings

- **File**: `packages/backend/src/routes/v2/platforms.routes.ts` (callback handler)
- The OAuth callback handler redirects users to a hardcoded `http://localhost:3000` URL after authentication completes
- No validation of the redirect target protocol or domain
- In production, this means redirects go to an insecure HTTP URL on localhost instead of the actual frontend domain
- Missing `process.env.FRONTEND_URL` usage for environment-aware redirect

## Proposed Solutions

1. Use `process.env.FRONTEND_URL` with protocol validation (must be `https://` in production), defaulting to `https` in non-development environments
2. Add an allowlist of valid redirect domains and validate against it before redirecting

## Acceptance Criteria

- [ ] OAuth callback redirects to `process.env.FRONTEND_URL` instead of hardcoded localhost
- [ ] Redirect URL is validated to use HTTPS in production (NODE_ENV=production)
- [ ] Application fails to start if FRONTEND_URL is not set in production
- [ ] No open redirect vulnerability (URL must match configured frontend domain)
