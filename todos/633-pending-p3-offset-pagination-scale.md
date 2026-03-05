---
status: pending
priority: p3
issue_id: '633'
tags: [code-review, performance, backend, pagination]
dependencies: []
---

# Offset pagination O(n) at scale + count:exact full scan

## Problem Statement

`listComments` uses offset-based pagination with `count: 'exact'`, which performs a full table scan on every request. At scale (10K+ comments per content), this becomes O(n).

## Findings

- Performance Oracle flagged CRITICAL-1 and CRITICAL-2
- Acceptable for MVP launch (unlikely to hit 10K comments per item initially)
- cursor-based pagination would be the fix at scale

## Proposed Solutions

Accept as P3 for now. Revisit if content items regularly exceed 1000 comments.

## Acceptance Criteria

- [ ] Acknowledged as known limitation for MVP
