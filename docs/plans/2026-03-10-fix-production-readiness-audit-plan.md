---
title: 'Production Readiness Audit — Full Remediation Plan'
type: fix
date: 2026-03-10
priority: P0
scope: entire-codebase
estimated_effort: 4-6 weeks
---

# Production Readiness Audit — Full Remediation Plan

## Overview

Full codebase audit with 12 parallel specialized agents identified **~120 unique findings** across security, payments, infrastructure, frontend, NOSTR, testing, and architecture. This plan organizes all findings into 6 remediation phases with clear ownership boundaries.

**Audit Lenses:**

1. Enterprise-grade security (financial platform handling real money)
2. Real features only — zero mocks/stubs/demo data in production
3. Elite UI/UX quality

**Findings Summary:**

- **P1 (Critical):** ~38 findings — blocks production release
- **P2 (Important):** ~45 findings — should fix before release
- **P3 (Nice-to-have):** ~40 findings — post-release improvements

---

## Phase 0: Stop the Bleeding (Day 1-2)

> Immediate security and correctness fixes. No architectural changes.

### P1-SEC-001: Hardcoded JWT Secret Fallback

- **File:** `packages/backend/src/app.ts:306`
- **Issue:** `const JWT_SECRET = process.env.JWT_SECRET || 'development-only-secret-key'`
- **Fix:** Remove fallback. Throw on missing env var at startup.

### P1-SEC-002: VITE_DEMO_MODE=true in Production CI Build

- **File:** `.github/workflows/ci.yml:352`
- **Issue:** Production build uses `VITE_DEMO_MODE: 'true'`, causing `demoAuthService` instead of `realAuthService`
- **Fix:** Set `VITE_DEMO_MODE: 'false'` (or remove entirely) from production build step.

### P1-SEC-003: Mock Analytics Service in Production

- **File:** `packages/frontend/src/features/analytics/services/mockAnalyticsService.ts`
- **Issue:** CreatorDashboard imports mock analytics as the production analytics service.
- **Fix:** Create real analytics service connecting to backend API. Remove mock import.

### P1-SEC-004: Unauthenticated Session Cleanup Endpoint

- **File:** `packages/backend/src/routes/unified-sessions.ts:689`
- **Issue:** Session cleanup endpoint has no auth middleware (TODO comment acknowledges).
- **Fix:** Add `requireAuth` middleware.

### P1-SEC-005: CORS Domain Mismatch

- **File:** Backend CORS config
- **Issue:** CORS allows domains that don't match production frontend domain.
- **Fix:** Restrict CORS to exact production origins.

### P1-INFRA-001: Production Docker Missing Config Files

- **File:** `docker-compose.prod.yml`
- **Issue:** References 4 non-existent files: `nginx-lb.conf`, `prometheus.yml`, `redis-prod.conf`, `fluentd.conf`
- **Fix:** Create all 4 config files or remove references.

### P1-INFRA-002: Webhook Route Creates Own Supabase Client

- **File:** `packages/backend/src/routes/webhooks.ts:38-41`
- **Issue:** Uses wrong env var `SUPABASE_SERVICE_KEY` (should be `SUPABASE_SERVICE_ROLE_KEY`)
- **Fix:** Use DI-injected Supabase client instead of manual creation.

---

## Phase 1: Financial Safety (Week 1-2)

> Payment system consolidation, database security, atomic operations.

### Payment System Consolidation

**Context:** THREE conflicting payment implementations exist:

1. Lightning/LNbits via `lightning-service.ts` (JSON file persistence)
2. DI-based `PaymentProcessingService` (stub `executePayment()`)
3. Stripe via Vercel serverless functions

**Decision Required:** Choose ONE primary payment system and deprecate others.

### P1-PAY-001: Stub executePayment() Returns Fake Success

- **File:** `packages/backend/src/services/payment/PaymentProcessingService.ts:1010-1027`
- **Issue:** Always returns success with random preimage. No actual payment execution.
- **Fix:** Implement real Lightning payment execution via LNbits/LND API.

### P1-PAY-002: JsonFilePaymentStore in Production

- **File:** `packages/backend/src/services/lightning-service.ts:201-209`
- **Issue:** Production guard throws — no `SupabasePaymentStore` exists.
- **Fix:** Implement `SupabasePaymentStore` with proper transaction support.

### P1-PAY-003: Non-Atomic Webhook Payment Updates

- **File:** `packages/backend/src/routes/webhooks.ts:290-294`
- **Issue:** Preimage write and state transition are separate operations. Crash between = lost payment proof.
- **Fix:** Wrap in database transaction (Supabase RPC function).

### P1-PAY-004: Frontend Hits Wrong Payment Endpoints

- **Issue:** Frontend payment components reference endpoints that don't match backend routes.
- **Fix:** Audit all frontend→backend payment endpoint calls and align.

### P1-PAY-005: No Atomic Payment+Access Grant

- **Issue:** Payment confirmation and content access grant are separate operations.
- **Fix:** Use insert-then-verify or atomic RPC (critical-patterns.md #1, #4).

### Database Security

### P1-DB-001: 30+ Tables Missing Row Level Security

- **Issue:** Financial audit tables, user data tables, content tables lack RLS policies.
- **Fix:** Implement RLS policies for ALL tables. Use `service_role` for admin operations only.

### P1-DB-002: CASCADE on Financial Audit Foreign Keys

- **Issue:** Deleting a parent record cascades deletion to audit trail — destroys compliance records.
- **Fix:** Change to `RESTRICT` or `SET NULL` on all financial audit FKs.

### P1-DB-003: Payment RPC Functions Missing from Active Migrations

- **Issue:** Payment RPCs referenced in code don't exist in migration files.
- **Fix:** Create proper migrations for all payment RPC functions.

### P1-DB-004: SECURITY DEFINER Function Without Auth Check

- **File:** `supabase/migrations/20260215000001_add_delete_all_wellness_data_function.sql`
- **Issue:** Runs as DB owner with no authorization check — any user can delete all wellness data.
- **Fix:** Add `auth.uid()` check inside function body.

### P1-DB-005: Missing CHECK Constraints on Financial Columns

- **Issue:** Amount, price, and fee columns lack CHECK constraints (can be negative).
- **Fix:** Add `CHECK (amount >= 0)` etc. to all financial columns.

---

## Phase 2: Mock Elimination (Week 2-3)

> Replace ALL mock/stub/demo data with real implementations.

### P1-MOCK-001: Entire Supporter Experience is Fake

- **File:** `packages/frontend/src/features/supporter/services/supporterExperienceService.ts:128-304`
- **Issue:** Service generates mock data for all supporter features.
- **Fix:** Connect to real backend API endpoints.

### P1-MOCK-002: NOSTR Feed Generates Fake Events

- **File:** `packages/frontend/src/features/nostr/feed/hooks/useFeedSubscription.ts:14-75`
- **Issue:** Generates 20 fake NOSTR events instead of subscribing to relays.
- **Fix:** Implement real NOSTR relay subscription using nostr-tools SimplePool.

### P1-MOCK-003: Content Library Hardcoded

- **File:** `packages/frontend/src/features/content/components/ContentLibrary.tsx:160-185`
- **Issue:** 2-item `MOCK_CONTENT` array rendered as real content.
- **Fix:** Fetch from backend content API.

### P1-MOCK-004: Subscription Manager is Fake

- **Issue:** Subscription management UI shows hardcoded data.
- **Fix:** Connect to real subscription backend.

### P1-MOCK-005: AI Predictions Use 'user123'

- **Issue:** AI analytics features use hardcoded user ID.
- **Fix:** Use authenticated user's actual ID.

### P1-MOCK-006: BTC Rate Hardcoded at $30k

- **Issue:** Bitcoin exchange rate is a constant, not fetched from API.
- **Fix:** Fetch from CoinGecko/Kraken API with TTL cache.

### P1-MOCK-007: Revenue Dashboard Shows Mock Data

- **Issue:** Revenue/earnings pages display fabricated numbers.
- **Fix:** Connect to real analytics/payment aggregation endpoints.

### P2-MOCK-008: Premium Content Paywall Throws Error

- **File:** `packages/frontend/src/features/content/components/PremiumContentPaywall.tsx:60-63`
- **Issue:** Throws "Lightning integration coming soon" instead of processing payment.
- **Fix:** Implement Lightning invoice generation and payment flow.

### P2-MOCK-009: Media Upload Throws Error

- **File:** `packages/frontend/src/features/content/components/SimpleContentEditor.tsx:111-113`
- **Issue:** Media upload throws "not yet implemented".
- **Fix:** Implement Supabase Storage upload or S3 integration.

### P2-MOCK-010: Notification Service is Stub

- **File:** `packages/backend/src/services/notification-stub.ts`
- **Issue:** Logging-only stub used by payout and subscription services.
- **Fix:** Implement real notification delivery (email/push/in-app).

---

## Phase 3: Security Hardening (Week 3)

> Deep security fixes beyond Phase 0 quick fixes.

### P1-SEC-006: NOSTR Private Keys Server-Side with Plaintext Fallback

- **Issue:** Server stores NOSTR private keys with plaintext fallback when encryption unavailable.
- **Fix:** Evaluate NIP-46 (remote signing) or require encrypted storage. Never store plaintext keys.

### P1-SEC-007: Auth Middleware Has ZERO Tests

- **File:** `packages/backend/src/middleware/auth.ts`
- **Issue:** 250 lines of security-critical auth code with no test coverage.
- **Fix:** Write comprehensive auth middleware tests (happy path, expired JWT, malformed token, missing header, role-based access).

### P1-SEC-008: Payment Routes Have ZERO Tests

- **Issue:** All payment-related routes lack test coverage.
- **Fix:** Write tests for every payment endpoint.

### P2-SEC-009: 132 Files with @ts-nocheck

- **Issue:** 16% of codebase has type checking disabled, including payment services, DI bootstrap, auth files.
- **Fix:** Prioritize removing @ts-nocheck from security-critical files (auth, payment, DI). Budget: ~10 files/sprint.

### P2-SEC-010: 927 `any` Type Instances

- **Issue:** Widespread `any` usage undermines TypeScript's safety guarantees.
- **Fix:** Address in security-critical files first. Use `unknown` + type guards.

### P2-SEC-011: Redis-Backed Token Revocation Missing

- **Issue:** No mechanism to revoke JWT tokens before expiry.
- **Fix:** Implement token blacklist in Redis with TTL matching JWT expiry.

### P2-SEC-012: Wrong Payment Policy Migration

- **File:** `supabase/migrations/20260307000003_fix_payments_insert_policy.sql`
- **Issue:** Drops wrong policy name (residual from copy-paste).
- **Fix:** Verify and correct the migration.

---

## Phase 4: Production Infrastructure (Week 3-4)

> CI/CD, deployment, monitoring, observability.

### P1-INFRA-003: No DB Migration Step in CI

- **Issue:** Database migrations not run as part of CI pipeline.
- **Fix:** Add migration validation/dry-run step to CI.

### P1-INFRA-004: Backend Deployment Not Automated

- **Issue:** No automated backend deployment pipeline (only frontend via Vercel).
- **Fix:** Implement Docker-based deploy to staging/production.

### P1-INFRA-005: No Alerting Rules

- **Issue:** Prometheus config exists but no alerting rules defined.
- **Fix:** Create alerts for: error rate, latency P99, payment failures, auth failures, disk usage.

### P2-INFRA-006: Integration + E2E Tests Advisory-Only

- **Issue:** `continue-on-error: true` on integration and E2E test jobs.
- **Fix:** Graduate to blocking after stabilizing test suite.

### P2-INFRA-007: 8 Duplicate Supabase Clients

- **Issue:** Multiple files create their own Supabase clients instead of using DI.
- **Fix:** Centralize to DI-injected client. Remove ad-hoc instantiations.

### P2-INFRA-008: Unbounded Map Caches (OOM Risk)

- **File:** `packages/backend/src/services/payout-management-service.ts:91,326-329,834-840`
- **Issue:** 7+ `Map` caches with no size limit or TTL. Will OOM under load.
- **Fix:** Replace with TTLCache (already exists in codebase per common-solutions.md #8).

### P2-INFRA-009: N+1 Query in Payout Processing

- **File:** `packages/backend/src/services/payout-management-service.ts`
- **Issue:** Sequential unbounded queries in `calculateCreatorEarnings`.
- **Fix:** Batch queries with proper pagination (PAGE_SIZE=500 pattern).

---

## Phase 5: UI/UX Polish (Week 4)

> Frontend quality, accessibility, user experience.

### P1-UX-001: window.confirm() for Destructive Actions

- **Issue:** Browser-native `confirm()` used for delete operations. Not styled, not accessible.
- **Fix:** Replace with custom Dialog/Modal component with proper ARIA.

### P1-UX-002: Silent Error Swallowing in 23+ Components

- **Issue:** `catch(err) {}` with no user feedback. Users see nothing on failure.
- **Fix:** Add toast/notification system. Show meaningful error messages.

### P1-UX-003: No 404 Route

- **Issue:** Invalid URLs render blank page or broken state.
- **Fix:** Add catch-all 404 route with helpful navigation.

### P2-UX-004: Dark Mode Breakage

- **Issue:** Multiple components have broken dark mode styles.
- **Fix:** Audit and fix all Tailwind dark: variants.

### P2-UX-005: ~340KB Dead Weight in Client Bundle

- **Issue:** Unused code, mock services, dead imports bloat the bundle.
- **Fix:** Tree-shake, remove dead code, lazy-load heavy features.

### P2-UX-006: No Loading States on Data-Fetching Pages

- **Issue:** Pages flash empty then populate. No skeleton/spinner.
- **Fix:** Add Suspense boundaries and skeleton components.

### P3-UX-007: Missing Keyboard Navigation

- **Issue:** Custom components not keyboard-accessible.
- **Fix:** Add proper focus management, arrow key navigation, Escape to close.

---

## Phase 6: Documentation & Agent-Native (Ongoing)

### P2-DOC-001: OpenAPI Spec Covers 23% of Endpoints

- **Issue:** Only ~22 of 97+ endpoints documented.
- **Fix:** Generate OpenAPI spec from route definitions.

### P2-DOC-002: No Live API Docs

- **Issue:** No Swagger UI or Redoc served from the backend.
- **Fix:** Add `/api/docs` endpoint with Swagger UI.

### P2-DOC-003: No Outbound Webhooks

- **Issue:** External integrations can't subscribe to platform events.
- **Fix:** Implement webhook system for payment, content, subscription events.

### P3-DOC-004: 506 Generic Error Throws

- **Issue:** `throw new Error('...')` instead of typed error classes.
- **Fix:** Use domain-specific error classes (existing pattern from common-solutions.md #24).

---

## Agent Ownership Boundaries

| Agent Role             | Owns                                         | Does NOT Own               |
| ---------------------- | -------------------------------------------- | -------------------------- |
| Security Agent         | Phases 0 + 3 (all SEC-\* findings)           | Payment business logic     |
| Payment Agent          | Phase 1 (all PAY-\* findings)                | Database schema design     |
| Database Agent         | Phase 1 DB-\* + Phase 3 migration fixes      | Application code           |
| Mock Elimination Agent | Phase 2 (all MOCK-\* findings)               | Backend API implementation |
| Backend API Agent      | Backend endpoints needed by Mock Elimination | Frontend components        |
| Infrastructure Agent   | Phase 4 (all INFRA-\* findings)              | Application code           |
| Frontend/UX Agent      | Phase 5 (all UX-\* findings)                 | Backend services           |

## Success Criteria

- Zero P1 findings remaining
- All payment flows execute real transactions (testnet/signet)
- Zero mock data visible in production UI
- RLS enabled on ALL database tables
- Auth middleware has ≥90% test coverage
- Payment routes have ≥90% test coverage
- CI pipeline blocks on security + integration test failures
- Production Docker stack starts successfully
- All NOSTR features connect to real relays
