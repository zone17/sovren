---
status: pending
priority: p2
issue_id: '547'
tags: [code-review, security, infrastructure, pr-103]
dependencies: []
---

# Add bearer_token comment to Prometheus scrape config for production readiness

## Problem Statement

The new `sovren-api` scrape job in `docker/prometheus/prometheus.yml` does not include authentication configuration. The backend's `/metrics` endpoint requires `METRICS_AUTH_TOKEN` in production. Without a comment or placeholder, someone deploying to production will get silent 403 failures from Prometheus scrapes.

**Why it matters:** 5/7 review agents flagged this. In dev, metrics are open (no token configured). In production, Prometheus will silently fail to scrape, and the lack of metrics will go unnoticed until an incident.

## Findings

- `docker/prometheus/prometheus.yml:59-63` — new scrape job, no auth directives
- `packages/backend/src/app.ts:172-202` — `/metrics` endpoint implements 3-tier auth: bearer token → IP allowlist → open (non-production only)
- In Docker dev, Prometheus runs in its own container with Docker bridge IP (not 127.0.0.1), so IP allowlist won't match
- Plan document (line 63-67) acknowledges the gap but defers resolution

## Proposed Solutions

### Option 1: Add commented bearer_token_file placeholder (Recommended)

**Approach:** Add a YAML comment with a ready-to-use `bearer_token_file` directive.

```yaml
- job_name: 'sovren-api'
  scrape_interval: 15s
  static_configs:
    - targets: ['backend:3001']
  metrics_path: '/metrics'
  # Production: uncomment and set token matching METRICS_AUTH_TOKEN
  # bearer_token_file: /etc/prometheus/secrets/metrics-token
```

**Pros:**

- Zero runtime impact
- Makes production requirement discoverable
- 1-minute fix

**Cons:**

- Still requires manual uncommenting for production

**Effort:** Small (1 min) | **Risk:** None

### Option 2: Add scrape_timeout for consistency

**Approach:** Also add `scrape_timeout: 10s` to match other application-tier jobs.

**Effort:** Small (1 min) | **Risk:** None

## Acceptance Criteria

- [ ] Prometheus config includes a comment about production auth requirements
- [ ] Optional: `scrape_timeout` specified for consistency

## Work Log

| Date       | Action                      | Learnings                        |
| ---------- | --------------------------- | -------------------------------- |
| 2026-02-26 | Created from PR #103 review | 5/7 agents flagged independently |
