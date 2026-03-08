---
status: pending
priority: p3
issue_id: 787
tags: [code-review, agent-native, pagination, api]
dependencies: []
---

# No Cursor-Based Pagination

## Problem Statement

All list endpoints use offset-based pagination (page + limit). For large datasets this causes performance degradation and inconsistent results under concurrent writes.

## Findings

- **Agent-Native Agent**: P2

## Proposed Solutions

Add cursor-based pagination as alternative for high-volume endpoints.

## Acceptance Criteria

- [ ] Cursor pagination available on content feed and transaction history
