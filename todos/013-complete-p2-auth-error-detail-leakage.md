---
status: pending
priority: p2
issue_id: 013
tags: [code-review, security]
dependencies: []
---

# Auth Error Detail Leakage and Validation Issues

## Problem Statement

Auth middleware exposes JWT verification error details, internal error messages, and required role names in 403/401 responses. Credential backup files written as plaintext. z.any() allows unbounded metadata in payment validators.

## Findings

Security-sentinel found error detail leakage at auth.ts lines 49, 68, 92, 283. Plaintext credential backups at rotate-database-credentials.ts line 167. Unbounded z.record(z.any()) in payment validators at 5 locations. OWASP A05:2021.

## Proposed Solutions

### Option A: Generic Error Messages and Bounded Validation

**Pros:** Prevents information disclosure, constrains attack surface, encrypts sensitive backups
**Cons:** May make debugging slightly harder (mitigated by server-side logging)
**Effort:** Small
**Risk:** Low

## Technical Details

**Affected Files:**

- packages/backend/src/middleware/auth.ts (lines 49, 68, 92, 283)
- packages/backend/src/validators/payment/index.ts (lines 44, 93, 95, 127, 150)
- scripts/rotate-database-credentials.ts (line 167)

## Acceptance Criteria

- [ ] No internal error details exposed in client responses
- [ ] Generic error messages returned for auth failures
- [ ] Detailed errors logged server-side for debugging
- [ ] Payment metadata validated with bounded types instead of z.any()
- [ ] z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])) replaces z.any()
- [ ] Backup files encrypted with appropriate key management
- [ ] Backup file permissions restricted to owner-only (0600)
- [ ] Tests verify generic error messages in responses
- [ ] Tests verify bounded validation rejects oversized payloads

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
