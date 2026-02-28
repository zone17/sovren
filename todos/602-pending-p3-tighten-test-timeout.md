---
status: pending
priority: p3
issue_id: 602
tags: [code-review, testing, performance]
dependencies: []
---

# Tighten Integration Test testTimeout from 60s to 15s

## Problem Statement

Individual test timeout at 60s is overly permissive. DB operations should complete in under 5s. A test with a connection leak or deadlock silently consumes 59s before failing.

## Proposed Solutions

In `packages/backend/vitest.integration.config.ts`:

```typescript
testTimeout: 15000,      // Individual tests: 15s generous for DB ops
hookTimeout: 60000,      // Keep at 60s for container startup
teardownTimeout: 30000,  // Keep for container cleanup
```

- **Effort:** Small (1 line)

## Resources

- PR: #110
