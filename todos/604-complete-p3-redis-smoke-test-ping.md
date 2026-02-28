---
status: complete
priority: p3
issue_id: 604
tags: [code-review, testing]
dependencies: []
---

# Use Redis PING Instead of Raw TCP in Smoke Test

## Problem Statement

The Redis smoke test creates a raw TCP socket to verify connectivity. TCP connection only proves port is open, not that Redis is accepting commands. Use `redis.ping()` for a meaningful check.

## Proposed Solutions

Replace raw TCP check with redis client PING command.

- **Effort:** Small
- **File:** `packages/backend/src/__tests__/integration/smoke.integration.test.ts`

## Resources

- PR: #110
