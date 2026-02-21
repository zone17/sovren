---
status: pending
priority: p2
issue_id: 336
tags: [code-review, security]
---

# OAuth callback open redirect risk

## Problem Statement

The OAuth callback handler in platforms routes does not validate the redirect URL against an allowlist of approved domains. An attacker could craft an OAuth flow that redirects the user to a malicious site after authentication, potentially stealing tokens or performing phishing attacks.

## Findings

- `packages/backend/src/routes/v2/platforms.routes.ts:94-115` — OAuth callback handler redirects user without validating the redirect URL
- No allowlist check against configured domains
- Attacker could manipulate the redirect parameter to point to a malicious domain

## Proposed Solutions

1. Define an allowlist of approved redirect domains in configuration (env vars or config file)
2. Validate the redirect URL against the allowlist before performing the redirect
3. If the URL is not in the allowlist, redirect to a safe default (e.g., the app's home page)
4. Log rejected redirect attempts for security monitoring

## Technical Details

- **Affected Files**: packages/backend/src/routes/v2/platforms.routes.ts

## Acceptance Criteria

- [ ] Redirect URL validated against configured allowlist of approved domains
- [ ] Invalid redirect URLs fall back to a safe default page
- [ ] Rejected redirect attempts are logged
- [ ] Open redirect attack vector is closed
- [ ] Existing OAuth flow works correctly with valid redirect URLs
