---
status: complete
priority: p3
issue_id: 600
tags: [code-review, performance, testing]
dependencies: []
---

# Add PostgreSQL Memory and WAL Tuning for Test Containers

## Problem Statement

The testcontainers PostgreSQL uses default memory settings (128MB shared_buffers, 4MB work_mem). Adding `wal_level=minimal` + `max_wal_senders=0` reduces WAL generation by 30-50% for write-heavy tests. Memory tuning improves query plan selection.

## Proposed Solutions

Add flags to `.withCommand()`:

```typescript
.withCommand([
  'postgres',
  '-c', 'fsync=off',
  '-c', 'synchronous_commit=off',
  '-c', 'shared_buffers=256MB',
  '-c', 'work_mem=64MB',
  '-c', 'wal_level=minimal',
  '-c', 'max_wal_senders=0',
  '-c', 'random_page_cost=1.1',
])
```

- **Effort:** Small (8 lines)
- **File:** `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts`

## Resources

- PR: #110
