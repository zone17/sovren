---
status: pending
priority: p3
issue_id: 085
tags: [code-review, security]
dependencies: []
---

# Weak UUID Generation Using Math.random

## Problem Statement

Some UUID generation uses `Math.random()` instead of `crypto.randomUUID()`. Math.random is not cryptographically secure and produces predictable IDs.

## Findings

- **Security Sentinel P3-01**: Weak UUID generation could lead to predictable identifiers.

## Proposed Solutions

Replace `Math.random()`-based UUID generation with `crypto.randomUUID()` (Node 19+) or `uuid` package v4.
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] All UUID generation uses cryptographically secure source
