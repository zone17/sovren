---
status: pending
priority: p2
issue_id: 599
tags: [code-review, performance, testing]
dependencies: []
---

# Parallelize Container Teardown with Immediate Kill

## Problem Statement

Container teardown is sequential and uses default graceful shutdown (10s timeout per container). For ephemeral test containers, graceful shutdown provides no value and adds 1-5 seconds.

## Findings

- **performance-oracle** flagged as P1 quick win

## Proposed Solutions

### Solution A: Parallel Stop with timeout: 0 (Recommended)

```typescript
export async function teardown(): Promise<void> {
  await Promise.all([_pgContainer?.stop({ timeout: 0 }), _redisContainer?.stop({ timeout: 0 })]);
  _pgContainer = null;
  _redisContainer = null;
}
```

- **Effort:** Small (3 lines)
- **Risk:** None — test containers don't need graceful shutdown

## Technical Details

- **Affected file:** `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts` (lines 83-88)

## Acceptance Criteria

- [ ] Teardown uses `Promise.all` with `{ timeout: 0 }`
- [ ] Integration tests still pass and clean up properly

## Work Log

| Date       | Action                      | Learnings                                           |
| ---------- | --------------------------- | --------------------------------------------------- |
| 2026-02-28 | Created from PR #110 review | Test containers: immediate kill > graceful shutdown |

## Resources

- PR: #110
