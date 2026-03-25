---
status: pending
priority: p1
issue_id: '184'
tags: [code-review, pr-85, security]
---

# SSRF via User-Controlled Mastodon Instance URL

## Problem Statement

SSRF via user-controlled Mastodon instance_url passed to server-side fetch without IP/protocol validation. An attacker can supply a Mastodon instance URL pointing to internal services (e.g., `http://169.254.169.254/latest/meta-data/` on AWS, or `http://127.0.0.1:5432/` to probe internal Postgres), causing the server to make requests to internal infrastructure on the attacker's behalf.

## Findings

- **File**: `packages/backend/src/services/distribution/adapters/MastodonAdapter.ts`
- The adapter accepts a user-supplied `instance_url` and passes it directly to server-side `fetch()` calls without any validation
- No protocol restriction (allows `http://`, `file://`, `gopher://`, etc.)
- No IP range blocking (private ranges, link-local, loopback all reachable)
- No domain allowlist/blocklist mechanism

## Proposed Solutions

### Solution 1: URL Validation Utility with IP Blocklist (Recommended)

Create a `validateExternalUrl()` utility that:

1. Parses the URL and validates protocol is `https://` only
2. Resolves the hostname to IP via DNS
3. Blocks private IP ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `::1`, `169.254.0.0/16`, `0.0.0.0`
4. Blocks non-standard ports
5. Call this utility before every fetch in MastodonAdapter

**Pros**: Comprehensive protection, reusable across all adapters
**Cons**: DNS resolution adds latency; DNS rebinding still possible without pinned resolution

### Solution 2: Domain Allowlist

Maintain a list of known legitimate Mastodon instances and only allow connections to those.

**Pros**: Strongest protection, no SSRF possible
**Cons**: Breaks for self-hosted instances, requires ongoing maintenance, defeats federation purpose

## Acceptance Criteria

- [ ] All fetch calls in MastodonAdapter pass through URL validation before execution
- [ ] Protocol is restricted to `https://` only
- [ ] Private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1) are blocked after DNS resolution
- [ ] Unit tests cover SSRF bypass attempts (decimal IP, hex IP, DNS rebinding, IPv6 mapped IPv4)
- [ ] Validation utility is reusable for other adapters that accept user-supplied URLs
