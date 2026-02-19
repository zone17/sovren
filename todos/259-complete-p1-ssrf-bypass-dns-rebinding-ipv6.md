---
status: complete
priority: p1
issue_id: '259'
tags: [code-review, security]
dependencies: []
---

# SSRF Bypass via DNS Rebinding, IPv6, Octal/Hex Encoding

## Problem Statement

The SSRF validator in ssrf.ts can be bypassed via DNS rebinding, IPv6 mapped addresses, octal/hex IP notation, and URLs with credentials. The validator doesn't resolve DNS before checking.

## Findings

- `packages/backend/src/utils/ssrf.ts` — hostname check is string-based, no DNS resolution
- DNS rebinding: domain resolves to public IP then rebinds to 127.0.0.1
- IPv6 mapped: `::ffff:127.0.0.1` bypasses IPv4 checks
- Octal/hex: `0x7f000001`, `0177.0.0.1` bypass decimal checks
- URL credentials: `user:pass@internal-host` not checked

## Proposed Solutions

### Option 1: DNS resolution + comprehensive checks

**Approach:** Use Node.js dns.resolve() to check actual IP after resolution. Add octal/hex IP detection, URL credential blocking, IPv6 mapped address checks. Consider ssrf-req-filter library.
**Effort:** 2-4 hours
**Risk:** High (security vulnerability)

## Technical Details

**Affected files:**

- `packages/backend/src/utils/ssrf.ts`

## Acceptance Criteria

- [ ] DNS rebinding attack blocked
- [ ] IPv6 mapped addresses blocked
- [ ] Octal/hex IP notation blocked
- [ ] URL credentials rejected
- [ ] Tests cover all bypass vectors

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
**Actions:** Identified by Security Sentinel agent
