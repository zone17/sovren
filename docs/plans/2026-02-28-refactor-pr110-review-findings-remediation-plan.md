---
title: 'refactor: Resolve PR #110 Review Findings'
type: refactor
date: 2026-02-28
pr: 110
branch: refactor/kill-mock-tests-real-infra
---

# Resolve PR #110 Review Findings

7-agent parallel review of PR #110 (Integration Test Infrastructure Overhaul) produced 13 findings: 0 P1, 6 P2, 7 P3. All are small, well-defined fixes. No merge blockers — PR is safe as-is, but these improve quality.

## Findings Summary

| Priority        | Count | Blocking?                    |
| --------------- | ----- | ---------------------------- |
| P1 Critical     | 0     | No                           |
| P2 Important    | 6     | No — should fix before merge |
| P3 Nice-to-have | 7     | No — can defer               |

## Phase 1: P2 Fixes (Should Fix Before Merge)

All P2 items are < 5 min each. Solo execution, sequential.

### 1.1 Delete Dead Route Files (#594)

- [x] Delete `packages/backend/src/routes/creator-recommendations.ts` (591 lines)
- [x] Delete `packages/backend/src/routes/creator-recommendations-simple.ts` (495 lines)
- [x] Verify zero imports: `grep -r "creator-recommendations" packages/backend/src/`
- [x] Run tests to confirm no breakage

### 1.2 Add Docker Prerequisite Docs (#595)

- [x] Update `CLAUDE.md` Testing section: add Docker prereq note to `test:integration` command
- [x] Add Prerequisites subsection mentioning Docker, testcontainers image pulls

### 1.3 Add Migration Directory Guard (#596)

- [x] Add `existsSync` check before `readdirSync` in `testcontainers-global-setup.ts:62`
- [x] Error message includes resolved path for debugging
- [x] Run integration tests to verify

### 1.4 Fix auth.uid() Stub (#597)

- [x] Remove `COALESCE` wrapper — return `NULL` when no JWT claim set (matches real Supabase)
- [x] Change: `SELECT current_setting('request.jwt.claim.sub', true)::uuid;`
- [x] Run integration tests to verify smoke test still passes

### 1.5 Add continue-on-error Tracking (#598)

- [x] Add TODO comment with concrete removal condition in `.github/workflows/ci.yml:255`
- [x] Condition: "Remove after 5 consecutive green integration runs on main"

### 1.6 Parallelize Teardown (#599)

- [x] Change sequential `await stop()` to `Promise.all([...stop({ timeout: 0 })])`
- [x] Run integration tests to verify clean teardown

### Phase 1 Commit

- [ ] Stage all P2 changes
- [ ] Commit: `fix: resolve 6 P2 review findings from PR #110`
- [ ] Push to `refactor/kill-mock-tests-real-infra`

## Phase 2: P3 Fixes (Nice-to-Have)

All P3 items are trivial. Can be done in a single pass.

### 2.1 PG Memory/WAL Tuning (#600)

- [x] Add `wal_level=minimal`, `max_wal_senders=0`, `shared_buffers=256MB`, `work_mem=64MB`, `random_page_cost=1.1` to `.withCommand()` in `testcontainers-global-setup.ts`

### 2.2 Docker Image Caching (#601)

- [x] Add pre-pull step to CI: `docker pull postgres:16-alpine & docker pull redis:7-alpine & wait`

### 2.3 Tighten testTimeout (#602)

- [x] Change `testTimeout: 60000` to `testTimeout: 15000` in `vitest.integration.config.ts`

### 2.4 Align PostgreSQL Versions (#603)

- [x] Update CI service container from `postgres:15-alpine` to `postgres:16-alpine`
- [x] Update `docker-compose.yml` and `docker-compose.dev.yml` to `postgres:16-alpine`

### 2.5 Redis Smoke PING (#604)

- [x] Replace raw TCP socket check with Redis RESP `PING` command in `smoke.integration.test.ts`

### 2.6 Remove Duplicate Ryuk Disable (#605)

- [x] Remove `TESTCONTAINERS_RYUK_DISABLED: 'true'` from CI env (keep in code)

### 2.7 Fix Node Version README (#606)

- [x] Change "Node.js 18+" to "Node.js 20+" in `packages/backend/README.md`

### Phase 2 Commit

- [ ] Stage all P3 changes
- [ ] Commit: `chore: resolve 7 P3 review findings from PR #110`
- [ ] Push to `refactor/kill-mock-tests-real-infra`

## Acceptance Criteria

- [x] All 13 todo files resolved (594-606)
- [x] Integration tests pass (`npm run test:integration`)
- [ ] Unit tests pass (`npm test`)
- [ ] No new files created (only edits and deletions)
- [ ] PR #110 updated with remediation commits

## Pre-Existing Issues (Not In Scope)

These were flagged by reviewers but are pre-existing — not introduced by PR #110:

- Fire-and-forget `initialize()` in `subscription-tiers.ts` (5/7 agents flagged)
- Lazy singletons bypass DI container (architecture tech debt)
- Response envelope inconsistency (`meta` vs `metadata`)
- `error: any` type annotations across route files
- Duplicate user ID resolution pattern (`req.user?.id || req.user?.nostr_pubkey`)
- `SECURITY DEFINER` test helper in shared migrations

These should be tracked separately for future sprints.

## References

- PR: https://github.com/zone17/sovren/pull/110
- Review todos: `todos/594-606`
- Plan: `docs/plans/2026-02-28-refactor-integration-test-infrastructure-overhaul-plan.md`
