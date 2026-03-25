---
status: pending
priority: p3
issue_id: 785
tags: [code-review, security, headers]
dependencies: []
---

# HSTS Config + Deprecated X-XSS-Protection Header

## Problem Statement

HSTS maxAge is only 180 days (default). X-XSS-Protection header is deprecated and potentially harmful.

## Findings

- **Security Agent**: P2-09, P2-10

## Proposed Solutions

Set HSTS to 1 year with includeSubDomains + preload. Remove X-XSS-Protection.

## Acceptance Criteria

- [ ] HSTS maxAge: 31536000 with preload
- [ ] X-XSS-Protection header removed
