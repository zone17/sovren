---
status: complete
priority: p2
issue_id: 516
tags: [code-review, testing, vitest, configuration]
dependencies: []
---

# Verify Vitest 3 Worker Pool Config (maxForks/maxWorkers)

## Problem Statement

Backend vitest bumped from `^2.1.8` to `^3.2.4`. Vitest 3 changed default pool from `forks` to `threads` and renamed `maxForks` to `maxWorkers`. The monorepo previously had `maxForks: 2` as OOM prevention (documented in MEMORY.md from Quality Pipeline Remediation sprint 02-20).

If the OOM protection config is not updated for Vitest 3's API, CI runners may OOM on large test suites.

## Findings

**Performance Oracle (P2):** Vitest 3 uses `node:worker_threads` by default. The `maxForks` option from v2 may be silently ignored in v3's thread pool mode. Equivalent config: `pool: 'forks'` + `poolOptions.forks.maxForks: 2`, or `pool: 'threads'` + `poolOptions.threads.maxThreads: 2`.

## Proposed Solutions

### Option A: Verify and update vitest.config.ts (Recommended)

- Check current `vitest.config.ts` for `maxForks` setting
- Update to Vitest 3 syntax if needed
- **Effort:** Small (check + possibly one-line fix)
- **Risk:** Low

## Technical Details

**Files to check:**

- `vitest.config.ts` (root)
- `packages/backend/vitest.config.ts` (if exists)

## Acceptance Criteria

- [ ] Vitest worker pool config uses v3-compatible syntax
- [ ] Tests don't OOM on CI (24GB machine)
- [ ] `npm run test` passes

## Work Log

| Date       | Action                       | Learnings                                                                                         |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-02-25 | Created during PR #98 review | Performance oracle flagged; documented in MEMORY.md common-solutions #11                          |
| 2026-02-25 | Verified: already correct    | `vitest.config.ts` uses `pool: 'forks'` + `poolOptions.forks.maxForks: 2` — valid Vitest 3 syntax |

## Resources

- PR #98: fix/backend-startup
- MEMORY.md: OOM prevention with maxForks:2
- common-solutions.md #11: Vitest OOM prevention
