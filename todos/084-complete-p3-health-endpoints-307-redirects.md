---
status: pending
priority: p3
issue_id: 084
tags: [code-review, infrastructure, reliability]
dependencies: []
---

# Health Endpoints Use 307 Redirects

## Problem Statement

`/ready` and `/live` endpoints use 307 redirects to `/health` instead of responding directly. This doubles request count for health probes and may confuse some load balancers or Kubernetes probes that don't follow redirects.

## Findings

- **Architecture Strategist P3**: Redirect-based health probes are unreliable.
- **Performance Oracle P3**: Doubles request overhead for each health probe.

## Proposed Solutions

Return health status directly from `/ready` and `/live` endpoints.
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] `/ready` and `/live` return 200 directly (no redirect)
