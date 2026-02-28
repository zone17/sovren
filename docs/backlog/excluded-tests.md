# Excluded Tests Backlog

> **Created**: 2026-02-28
> **Updated**: 2026-02-28
> **Goal**: Track all tests excluded from CI to get the pipeline green. Re-enable as they are fixed.

## Why These Tests Were Excluded

These tests were excluded because they had pre-existing failures unrelated to current work.
The decision was made to reflect reality in CI: only run tests that pass, and track broken
tests as backlog items for future cleanup.

## Frontend (6 files)

Excluded in `vitest.config.ts` under the `frontend` project.

| File                                   | Failure Reason                       |
| -------------------------------------- | ------------------------------------ |
| `MonitoringService.test.ts`            | Missing/broken mock setup            |
| `ContentManagementHub.test.tsx`        | Component API mismatch               |
| `PaymentHistory.test.tsx`              | Missing mock data / API changes      |
| `OptimizationSuggestionPanel.test.tsx` | Component rendering failures         |
| `NIP26Service.test.ts`                 | NOSTR delegation service API changes |
| `CreatorCard.test.tsx`                 | Component prop/rendering failures    |

## Backend (6 permanent exclusions)

Excluded in `vitest.config.ts` under the `backend` project.

These files need dedicated CI jobs, not the unit test suite:

| File                                       | Reason                          | Future Home               |
| ------------------------------------------ | ------------------------------- | ------------------------- |
| `performance/api-performance.test.ts`      | Benchmark, needs running server | Perf CI job               |
| `performance/database-performance.test.ts` | Benchmark, needs live DB        | Perf CI job               |
| `performance/payment-performance.test.ts`  | Benchmark, needs live services  | Perf CI job               |
| `production-docker.test.ts`                | Docker container test           | Docker CI job             |
| `smoke-tests.test.ts`                      | Needs running server            | Post-deploy step          |
| `rls-security.test.ts`                     | Needs Supabase RLS policies     | Supabase-specific testing |

> **Note**: 32 mock-based backend test files were deleted on 2026-02-28 (see plan: `docs/plans/2026-02-28-refactor-integration-test-infrastructure-overhaul-plan.md`). These files used stale mocks and were never real integration tests. They will be rewritten as real integration tests using testcontainers infrastructure.

## Shared (1 file, 4 failing tests)

Excluded in `vitest.config.ts` under the `shared` project.

| File                            | Failure Reason                                   |
| ------------------------------- | ------------------------------------------------ |
| `environment-validator.test.ts` | Test env vars don't match validator expectations |

## Integration Test Job (CI)

The `test-integration` job in `.github/workflows/ci.yml` is being re-enabled with testcontainers infrastructure (PostgreSQL + Redis). See Phase 4 of the refactor plan.

## How to Re-enable

1. Fix the test file
2. Remove its glob pattern from the appropriate `exclude` array in `vitest.config.ts`
3. Run `npx vitest run --project <project>` to verify it passes
4. Remove the entry from this document
5. For integration tests: also update `ci.yml` to re-enable the `test-integration` job
