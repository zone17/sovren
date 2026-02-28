# Excluded Tests Backlog

> **Created**: 2026-02-28
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

## Backend (38 files, 261 failing tests)

Excluded in `vitest.config.ts` under the `backend` project.

### Integration tests (need live Supabase/Redis)

| File                                                             | Failure Reason                    |
| ---------------------------------------------------------------- | --------------------------------- |
| `database-integration.test.ts`                                   | Needs live Supabase               |
| `integration/api-endpoints.integration.test.ts`                  | Needs live Supabase + full server |
| `integration/database-transactions.integration.test.ts`          | Needs live Supabase               |
| `integration/event-bus.integration.test.ts`                      | Needs live Redis                  |
| `integration/lightning-receipt-integration.test.ts`              | Needs live services               |
| `integration/payment-flow-integration.test.ts`                   | Needs live services               |
| `integration/service-orchestration.integration.test.ts`          | Needs live services               |
| `container/__tests__/ServiceContainer.integration.test.ts`       | DI container integration          |
| `payment/__tests__/integration/payment-flow.integration.test.ts` | Needs live services               |

### Route tests (need server context / broken mocks)

| File                                      | Failure Reason              |
| ----------------------------------------- | --------------------------- |
| `nip05-routes.test.ts`                    | Route handler mock issues   |
| `routes/content.routes.test.ts`           | Route handler mock issues   |
| `routes/v1-api-routes.test.ts`            | Route handler mock issues   |
| `routes/webhooks-race-conditions.test.ts` | Race condition mock issues  |
| `routes/__tests__/auth.test.ts`           | Auth middleware mock issues |

### Performance tests (benchmarking, not unit tests)

| File                                       | Failure Reason                       |
| ------------------------------------------ | ------------------------------------ |
| `performance/api-performance.test.ts`      | Benchmark test, needs running server |
| `performance/database-performance.test.ts` | Benchmark test, needs live DB        |
| `performance/payment-performance.test.ts`  | Benchmark test, needs live services  |

### Service tests (broken mocks / missing dependencies)

| File                                                           | Failure Reason              |
| -------------------------------------------------------------- | --------------------------- |
| `services/__tests__/ai-recommendation-service.test.ts`         | Missing mock setup          |
| `services/__tests__/EmailService.test.ts`                      | Missing email service mock  |
| `services/__tests__/lightning-service.test.ts`                 | Lightning mock issues       |
| `services/__tests__/payment-persistence-atomic.test.ts`        | Atomic write mock issues    |
| `services/__tests__/SecretsService.test.ts`                    | Secrets mock issues         |
| `services/__tests__/user-service.test.ts`                      | User service mock issues    |
| `content/__tests__/ContentAnalyticsService.test.ts`            | Content service mock issues |
| `content/__tests__/ContentCreationService.test.ts`             | Content service mock issues |
| `content/__tests__/ContentModerationService.test.ts`           | Content service mock issues |
| `content/__tests__/ContentPublishingService.test.ts`           | Content service mock issues |
| `distribution/__tests__/CrossPlatformAnalyticsService.test.ts` | Distribution mock issues    |
| `distribution/__tests__/crypto.test.ts`                        | Crypto mock issues          |
| `distribution/__tests__/InboxPollingService.test.ts`           | Polling mock issues         |
| `distribution/__tests__/NostrReplyAdapter.test.ts`             | NOSTR adapter mock issues   |
| `payment/__tests__/InvoiceService.test.ts`                     | Invoice mock issues         |
| `user/__tests__/UserActivityService.test.ts`                   | User activity mock issues   |

### Other

| File                                | Failure Reason                           |
| ----------------------------------- | ---------------------------------------- |
| `middleware/__tests__/auth.test.ts` | Auth middleware mock issues              |
| `unified-session-service.test.ts`   | Session service mock issues              |
| `production-docker.test.ts`         | Docker-specific, needs running container |
| `rls-security.test.ts`              | Needs live Supabase with RLS policies    |
| `smoke-tests.test.ts`               | Needs running server                     |

## Shared (1 file, 4 failing tests)

Excluded in `vitest.config.ts` under the `shared` project.

| File                            | Failure Reason                                   |
| ------------------------------- | ------------------------------------------------ |
| `environment-validator.test.ts` | Test env vars don't match validator expectations |

## Integration Test Job (CI)

The `test-integration` job in `.github/workflows/ci.yml` is skipped (`if: false`).
These tests require a live Supabase instance started via `supabase start` and a Redis container.
Re-enable when the integration test suite is stabilized.

## How to Re-enable

1. Fix the test file
2. Remove its glob pattern from the appropriate `exclude` array in `vitest.config.ts`
3. Run `npx vitest run --project <project>` to verify it passes
4. Remove the entry from this document
5. For integration tests: also update `ci.yml` to re-enable the `test-integration` job
