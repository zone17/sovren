---
status: pending
priority: p2
issue_id: 071
tags: [code-review, security, observability]
dependencies: []
---

# Metrics Endpoint Exposed Without Authentication

## Problem Statement

The Prometheus `/metrics` endpoint is publicly accessible without authentication. This exposes internal application metrics, route patterns, error rates, and infrastructure details that aid reconnaissance.

## Findings

- **Security Sentinel P2-03**: Metrics endpoint leaks internal operational data.
- **Architecture Strategist**: Metrics should be behind internal network or auth.

## Proposed Solutions

### Option A: Add basic auth or IP allowlist (Recommended)

Protect `/metrics` with a shared secret or restrict to internal IPs (e.g., Prometheus scraper IP).
**Pros:** Quick, standard practice
**Cons:** Need to configure Prometheus scraper auth
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] `/metrics` requires authentication or IP restriction
- [ ] Prometheus scraper can still access metrics
- [ ] No internal data exposed to public internet
