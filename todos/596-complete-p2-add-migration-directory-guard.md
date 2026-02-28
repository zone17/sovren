---
status: complete
priority: p2
issue_id: 596
tags: [code-review, robustness, testing]
dependencies: []
---

# Add existsSync Guard on Migration Directory Path

## Problem Statement

The testcontainers global setup uses a 5-level relative path (`../../../../../supabase/migrations`) to find migrations. If the file moves or runs from a worktree, the path breaks silently — `readdirSync` returns an empty array and zero migrations are applied, leading to misleading test results.

**Why it matters:** Silent failure in test infrastructure gives false confidence that tests pass against a proper schema.

## Findings

- **2/7 agents flagged** (architecture P3, agent-native Must)
- Path: `join(__dirname, '../../../../../supabase/migrations')` — fragile
- No guard against missing directory

## Proposed Solutions

### Solution A: Add existsSync Guard (Recommended)

```typescript
import { existsSync } from 'fs';

if (!existsSync(migrationsDir)) {
  throw new Error(
    `Migration directory not found at ${migrationsDir}. ` +
      `Expected relative to testcontainers-global-setup.ts: supabase/migrations/`
  );
}
```

- **Effort:** Small (3 lines)
- **Risk:** None

## Technical Details

- **Affected file:** `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts` (line 62)

## Acceptance Criteria

- [ ] `existsSync` guard added before `readdirSync`
- [ ] Error message includes the resolved path for debugging
- [ ] Integration tests still pass

## Work Log

| Date       | Action                      | Learnings                                                  |
| ---------- | --------------------------- | ---------------------------------------------------------- |
| 2026-02-28 | Created from PR #110 review | Silent failures in test infra are worse than loud failures |

## Resources

- PR: #110
