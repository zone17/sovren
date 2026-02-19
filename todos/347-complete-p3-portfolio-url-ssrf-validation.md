---
status: pending
priority: p3
issue_id: 347
tags: [code-review, security]
---

# Portfolio URL SSRF validation not using `validateSsrfUrl`

## Problem Statement

Portfolio URL validation uses basic URL parsing but does not route through the dedicated `validateSsrfUrl()` utility, potentially allowing SSRF attacks via portfolio URLs that resolve to internal network addresses.

## Findings

- Portfolio URL validation exists but only checks URL format (valid URL structure)
- The `validateSsrfUrl()` utility exists in the codebase and checks for internal IPs, DNS rebinding, IPv6 loopback, etc.
- Portfolio URLs are user-supplied and could point to internal services if not SSRF-validated

## Proposed Solutions

1. Route all portfolio URL validation through `validateSsrfUrl()` before accepting or fetching the URL
2. Apply the same validation at both write time (when user sets URL) and fetch time (when system retrieves content)

## Acceptance Criteria

- [ ] Portfolio URL validation calls `validateSsrfUrl()` before accepting the URL
- [ ] Internal/loopback URLs are rejected with appropriate error message
- [ ] Existing URL format validation remains as a pre-check
