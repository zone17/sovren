# Remaining Test Failures After Vitest Migration

**Date:** 2026-02-20
**Context:** Quality pipeline remediation — Vitest migration complete, 121/263 suites still failing
**These are pre-existing bugs, NOT migration issues.**

## Summary

| Project | Suites Pass | Suites Fail | Tests Pass | Tests Fail | Pass Rate |
|---------|------------|------------|-----------|-----------|-----------|
| shared | 10 | 1 | 379 | 4 | 99.0% |
| backend | 75 | 54 | 2,032 | 562 | 78.3% |
| frontend | 57 | 66 | 1,523 | 1,025 | 59.8% |
| **TOTAL** | **142** | **121** | **3,934** | **1,591** | **71.2%** |

## Backend Failures (54 suites, ~562 tests)

### Priority 1: Supabase Mock Chain Incomplete (~43 tests across 20+ suites)

**Root cause:** Mock Supabase client doesn't support full chaining: `.from().select().eq().order()`, `.from().insert().select()`, `.from().update().eq().eq()`, etc.

**Fix:** Create a chainable Supabase mock helper in `test-utils/supabase-mock.ts` that returns `this` for all chain methods.

**Affected files:**
- `packages/backend/src/services/wellness/__tests__/WellnessService.test.ts`
- `packages/backend/src/services/content/__tests__/ContentVersioningService.test.ts`
- `packages/backend/src/__tests__/content-management-service.test.ts`
- `packages/backend/src/__tests__/nip05-verification-service.test.ts`
- `packages/backend/src/__tests__/session-service.test.ts`
- `packages/backend/src/__tests__/unified-session-service.test.ts`
- `packages/backend/src/repositories/__tests__/user-repository.test.ts`
- `packages/backend/src/services/user/__tests__/UserActivityService.test.ts`
- `packages/backend/src/services/user/__tests__/UserAnalyticsService.test.ts`
- `packages/backend/src/services/user/__tests__/UserAuthenticationService.test.ts`
- `packages/backend/src/services/user/__tests__/UserPreferencesService.test.ts`
- `packages/backend/src/services/user/__tests__/UserProfileService.test.ts`
- `packages/backend/src/services/user/__tests__/UserRelationshipService.test.ts`
- `packages/backend/src/services/payment/__tests__/InvoiceService.test.ts`
- `packages/backend/src/services/payment/__tests__/PaymentAnalyticsService.test.ts`

### Priority 2: Subscription Plan Mock Missing (35 tests, ~5 suites)

**Root cause:** `SubscriptionService.test.ts` creates plans with fixed IDs but `createPlan()` generates random UUIDs. Test expects `plan_creator` but gets random UUID.

**Fix:** Mock `createPlan` to return deterministic IDs, or use the actual returned ID in assertions.

**Affected files:**
- `packages/backend/src/services/payment/__tests__/SubscriptionService.test.ts` (90 tests, largest single failure source)

### Priority 3: ZodError in Receipt Generation (32 tests)

**Root cause:** Mock data for lightning receipts doesn't match updated Zod schemas. Likely updated schemas without updating test fixtures.

**Fix:** Update receipt test fixtures to match current Zod schemas.

**Affected files:**
- `packages/backend/src/__tests__/services/lightning-receipt-service.test.ts`
- `packages/backend/src/__tests__/services/lightning-receipt-simple.test.ts`

### Priority 4: Express Mock Missing `req.get()` (24 tests)

**Root cause:** Mock Express Request objects don't have `.get()` method. Routes call `req.get('host')` or `req.get('Content-Type')`.

**Fix:** Add `.get()` to the mock Request factory.

**Affected files:**
- `packages/backend/src/__tests__/routes/content.routes.test.ts`
- `packages/backend/src/__tests__/routes/v1-api-routes.test.ts`
- `packages/backend/src/routes/__tests__/auth.test.ts`
- `packages/backend/src/__tests__/routes/health.test.ts`
- `packages/backend/src/__tests__/routes/lightning.test.ts`
- `packages/backend/src/__tests__/middleware/p1-041-cors-headers.test.ts`

### Priority 5: Redis Client Not Initialized (11 tests)

**Root cause:** Tests don't call `connectRedis()` before using Redis-dependent services.

**Fix:** Add Redis mock initialization to backend test setup or individual test `beforeAll`.

**Affected files:**
- `packages/backend/src/__tests__/lib/redis.test.ts`
- `packages/backend/src/__tests__/integration/cache-layer.integration.test.ts`

### Priority 6: Missing Module `deployment-monitoring` (7 tests)

**Root cause:** `require('../middleware/deployment-monitoring')` can't resolve through Vitest module system.

**Fix:** Convert to ESM import or mock the module.

**Affected files:**
- `packages/backend/src/__tests__/deployment-smoke-tests.test.ts`

### Priority 7: `pathRegexp` Not a Function (4 tests)

**Root cause:** Express `path-to-regexp` CJS/ESM compatibility issue with the version override.

**Fix:** Check `path-to-regexp` version compatibility or mock it.

**Affected files:**
- `packages/backend/src/__tests__/integration/webhook-signature-verification.test.ts`
- `packages/backend/src/__tests__/nip05-routes.test.ts`

### Priority 8: `mockResolvedValue` Not a Function (12 tests)

**Root cause:** Mock objects created without `vi.fn()` — plain objects instead of mock functions.

**Fix:** Ensure all mocked methods use `vi.fn()`.

**Affected files:**
- `packages/backend/src/services/__tests__/DatabaseSessionManager.test.ts`
- `packages/backend/src/__tests__/middleware/correlation-id.test.ts`
- `packages/backend/src/services/__tests__/creator-recommendation-service.test.ts`

### Priority 9: Test Timeouts (8 tests)

**Root cause:** Tests with real async operations (EventBus, Supabase realtime) that don't clean up.

**Fix:** Add proper `afterEach` cleanup and `vi.useFakeTimers()` where appropriate.

**Affected files:**
- `packages/backend/src/services/__tests__/EventBusService.test.ts`
- `packages/backend/src/__tests__/supabase-realtime-service.test.ts`
- `packages/backend/src/__tests__/performance/database-performance.test.ts`

### Other Backend Issues
- `EmailService.ts` uses `createTransporter` (wrong API — should be `createTransport`) — 24 tests
- `supabaseKey is required` — env var not set in test setup — 3 tests
- `router.use is not a function` — Express Router mock incomplete — 2 tests

---

## Frontend Failures (66 suites, ~1,025 tests)

### Priority 1: Store Mock Missing Slices (~120 tests, 15+ suites)

**Root cause:** Redux store mock doesn't include all slices. Components reading `state.nostr.globalFeed`, `state.notifications.getUnreadCount`, etc. get undefined.

**Fix:** Create comprehensive store mock in `test-utils/mock-store.ts` with all required slices.

**Affected patterns:**
- `Cannot read properties of undefined (reading 'globalFeed')` — 80 hits
- `Cannot read properties of undefined (reading 'getUnreadCount')` — 44 hits
- `Cannot read properties of null (reading 'enableOfflineCapabilities')` — 42 hits

**Affected files:**
- `packages/frontend/src/pages/Home.test.tsx`
- `packages/frontend/src/pages/Post.test.tsx`
- `packages/frontend/src/pages/Profile.test.tsx`
- `packages/frontend/src/pages/Login.test.tsx`
- `packages/frontend/src/features/content/__tests__/ContentManagementHub.test.tsx`
- `packages/frontend/src/features/discovery/components/__tests__/CreatorCard.test.tsx`
- `packages/frontend/src/components/nostr/__tests__/NostrMonitoringDashboard.test.tsx`

### Priority 2: BrowserRouter Mock Missing Export (52 tests)

**Root cause:** `vi.mock('react-router-dom')` doesn't return `BrowserRouter` export. Vitest auto-mocking doesn't preserve all named exports like Jest did.

**Fix:** Add explicit `BrowserRouter` to react-router-dom mock factory in frontend setup.

**Affected files:** All component tests that render inside a Router.

### Priority 3: MockAutonomousUserManagementService Undefined (49 tests)

**Root cause:** Class declaration in vi.mock factory gets hoisted differently than in Jest. The class isn't defined when the mock runs.

**Fix:** Define the mock class outside the `vi.mock()` call, or use `vi.hoisted()`.

### Priority 4: `vi.useFakeTimers()` Required (41 tests)

**Root cause:** Tests call `vi.advanceTimersByTime()` or `vi.runAllTimers()` without first calling `vi.useFakeTimers()`. Jest had `jest.useFakeTimers()` in setup; Vitest doesn't.

**Fix:** Add `vi.useFakeTimers()` in `beforeEach` for affected suites, or add to frontend setup.

### Priority 5: IntersectionObserver Mock (28 tests)

**Root cause:** `observer.observe is not a function` — jsdom doesn't have IntersectionObserver. The setup mock exists but `clearAllMocks()` wipes it between tests.

**Fix:** Move IntersectionObserver mock to `beforeEach` instead of one-time setup, or use `vi.stubGlobal`.

### Priority 6: Missing Module Imports (18 tests)

**Root cause:** `Cannot find module '../../services/mockAnalyticsService'` and `useFeedSubscription` — relative paths changed or modules renamed.

**Fix:** Update import paths or create the missing mock modules.

### Priority 7: `crypto` Getter-Only Property (3 tests still)

**Root cause:** Some tests still try `global.crypto = mockCrypto` which fails because `crypto` is getter-only in jsdom. Most were fixed but a few remain.

**Fix:** Use `Object.defineProperty(globalThis, 'crypto', { value: ..., configurable: true })`.

### Priority 8: Test Timeouts (39 tests)

**Root cause:** RelayPoolManager tests, CachePersistenceService, and others with real WebSocket/network operations timing out at 30s.

**Fix:** Mock WebSocket connections, add `vi.useFakeTimers()`, reduce timeout-dependent logic.

**Affected files:**
- `packages/frontend/src/services/nostr/__tests__/RelayPoolManager.test.ts`
- `packages/frontend/src/services/nostr/__tests__/CachePersistenceService.test.ts`
- `packages/frontend/src/services/nostr/__tests__/SubscriptionManagerService.test.ts`

### Priority 9: `Should not already be working` React Error (23 tests)

**Root cause:** React concurrent mode internal error. Multiple `render()` calls without cleanup between them.

**Fix:** Add `cleanup()` from `@testing-library/react` in `afterEach` for affected suites.

### Other Frontend Issues
- `Cannot read properties of undefined (reading 'bind')` — 33 tests (service mock incomplete)
- `Cannot read properties of undefined (reading 'sign')` — 15 tests (crypto mock)
- `Cannot read properties of undefined (reading 'pointerEvents')` — 16 tests (CSSOM mock)
- `Cannot read properties of undefined (reading 'getPropertyValue')` — 19 tests (computed style mock)
- Storybook test failures — 1 suite (Button.stories.test.tsx)

---

## Shared Failures (1 suite, 4 tests)

**Root cause:** Environment validator test expects different config shape after Zod migration.

**Fix:** Update test to match current Zod schema shape.

**Affected file:**
- `packages/shared/src/__tests__/environment-validator.test.ts`

---

## Recommended Fix Order (Maximum Impact)

| Order | Fix | Tests Recovered | Effort |
|-------|-----|----------------|--------|
| 1 | Chainable Supabase mock helper | ~100 | Medium |
| 2 | Comprehensive Redux store mock | ~120 | Medium |
| 3 | BrowserRouter mock export + Router context | ~52 | Small |
| 4 | MockAutonomousUserManagementService hoisting | ~49 | Small |
| 5 | `vi.useFakeTimers()` in setup or affected suites | ~41 | Small |
| 6 | SubscriptionService plan ID fix | ~35 | Small |
| 7 | Receipt fixture Zod update | ~32 | Small |
| 8 | IntersectionObserver mock in beforeEach | ~28 | Small |
| 9 | Express `req.get()` mock | ~24 | Small |
| 10 | React cleanup in afterEach | ~23 | Small |

**Fixing items 1-10 would recover ~500+ tests, bringing pass rate from 71% to ~80-85%.**

The remaining ~90 failures are spread across many individual test-specific issues (missing modules, stale fixtures, incomplete mocks) that need per-file attention.
