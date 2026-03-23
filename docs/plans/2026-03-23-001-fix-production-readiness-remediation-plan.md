---
title: 'Production Readiness Remediation — Waves 1+2'
type: fix
status: active
date: 2026-03-23
origin: docs/audits/production-readiness-2026-03-23.md
---

# Production Readiness Remediation — Waves 1+2

## Overview

Remediate all 7 P0 launch blockers and 36 P1 must-fix findings from the 2026-03-23 production readiness audit. The audit covered 12 domains with 157 total findings; this plan scopes to the 43 items (P0+P1) that must be resolved before Sovren can accept production traffic.

**Estimated effort:** 25-35 engineering days across 5 phases
**Approach:** Sequential phases with strict dependency ordering — credential rotation before encryption, schema audit before RLS, test fixes before thresholds

## Problem Statement

The production readiness audit revealed Sovren has strong architectural foundations but critical enforcement gaps:

- **Security:** Webhook timing oracle, IDOR on 8+ endpoints, credentials on disk
- **Data integrity:** ~55 tables missing RLS, ~19 missing foreign keys, CASCADE deleting payment records
- **Testing:** 0.6% frontend coverage, zero tests on PaymentProcessingService/InvoiceService, auth middleware untested
- **CI/CD:** Demo mode baked into prod, no rollback automation, no migration in deploy
- **Compliance:** No GDPR deletion/export, NOSTR private keys server-side, no consent management
- **Operations:** No incident response playbook, no DR plan, v2 API undocumented

The core theme: "strict by config, permissive in practice." TypeScript strict mode is on but 157 files use `@ts-nocheck`. Coverage thresholds are documented but never enforced. Tests exist but are `continue-on-error: true`.

## Proposed Solution

Five sequential phases, ordered by dependency chain (see SpecFlow analysis in origin audit):

1. **Emergency Triage** (Day 1) — Credential rotation, quick security fixes, CI emergency patches
2. **Security Hardening** (Days 2-5) — IDOR fixes, RLS on critical tables, webhook hardening
3. **Infrastructure & CI/CD** (Days 6-10) — Object storage migration, deploy pipeline, rollback automation
4. **Testing & Quality Gates** (Days 11-18) — Payment tests, coverage enforcement, @ts-nocheck triage
5. **Compliance & Documentation** (Days 19-30) — GDPR rights, incident response, API docs

## Technical Approach

### Critical Dependency Chain

```
INFRA-001 (rotate creds)
  └→ COMP-002 (encrypt NOSTR keys with NEW key)
  └→ All other security work (built on non-compromised foundation)

DB ownership column audit
  └→ DB-001 (RLS migration — needs anchor columns identified)
  └→ TEST-012 (re-enable rls-security.test.ts)

TEST-005 (re-enable excluded tests)
  └→ TEST-001 (measure real coverage)
  └→ TEST-006 (set thresholds at measured baseline, then ratchet)

INFRA-002 backfill existing files
  └→ INFRA-002 code change (switch to object storage)
  └→ Deploy (existing content URLs must resolve)
```

### Branching Strategy

Each phase gets its own feature branch per established convention:

- `fix/squad-a/SOV-PRA-phase1-emergency-triage`
- `fix/squad-a/SOV-PRA-phase2-security-hardening`
- `fix/squad-a/SOV-PRA-phase3-infrastructure-cicd`
- `fix/squad-a/SOV-PRA-phase4-testing-quality`
- `fix/squad-a/SOV-PRA-phase5-compliance-docs`

Squash merge each phase to main before starting the next (trunk-based, 1-3 day branches per BRANCHING_STRATEGY.md).

---

## Phase 1: Emergency Triage (Day 1)

_Goal: Eliminate all XS-effort blockers and rotate compromised credentials._

### 1.1 Credential Rotation (INFRA-001) — FIRST ACTION

**Decision required:** JWT secret rotation will force-logout all active users. Accept forced logout during low-traffic window.

Steps:

1. Add `packages/backend/.env` and `packages/backend/.env.development` to root `.gitignore`
2. Rotate at Supabase dashboard: anon key, service role key
3. Generate new JWT secret (64+ chars): `openssl rand -base64 64`
4. Update GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`
5. Verify `git log --all --full-history -- packages/backend/.env` — if committed to remote, consider the old keys fully compromised
6. Add INFRA-003 fix: add `**/.env.development`, `**/.env.test`, `**/.env.production` to `.gitignore`

**Files:** `.gitignore`, GitHub repo secrets (dashboard)
**Effort:** XS (30 min)
**Gotcha (from SpecFlow):** Anon key and service key are separate rotation paths. Service key rotation invalidates active backend connections. Coordinate: rotate service key → restart backend → rotate JWT → accept session invalidation.

### 1.2 Webhook Security (SEC-001, SEC-002)

```typescript
// packages/backend/src/routes/webhooks.ts:46 — require secret
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('WEBHOOK_SECRET is required in production');
}

// packages/backend/src/routes/webhooks.ts:107 — timing-safe comparison
const primarySig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
if (
  primarySig.length === signature.length &&
  crypto.timingSafeEqual(Buffer.from(primarySig), Buffer.from(signature))
) {
  return true;
}
```

**Gotcha (from SpecFlow):** `webhooks.ts` has `@ts-nocheck` on line 1. Remove it and fix type errors in this file as part of this fix — do not leave a security-critical file type-unchecked.
**Gotcha (from SpecFlow):** Existing unsigned webhook integrations will break immediately. Add `X-Webhook-Signature-Required: true` header to responses for 30-day warning period if external integrations exist. If internal-only, hard cutoff is acceptable.

**Files:** `packages/backend/src/routes/webhooks.ts`
**Effort:** XS (1 hour)

### 1.3 JWT Fallback Removal (SEC-003)

Remove hardcoded fallback in `app.ts:297` and `UserAuthenticationService.ts:60-61`. All environments must set `JWT_SECRET` explicitly.

**Files:** `packages/backend/src/app.ts`, `packages/backend/src/services/user/UserAuthenticationService.ts`
**Effort:** XS (30 min)

### 1.4 Health Endpoint Auth (SEC-005)

Add `authenticate` + `authorize(['admin'])` middleware to `/health/detailed` only. Keep `/health`, `/ready`, `/live` unauthenticated for load balancer probes.

**Files:** `packages/backend/src/routes/health.ts:142`
**Effort:** XS (30 min)

### 1.5 CI Emergency Fixes (CICD-003, CICD-004, CICD-005)

1. **CICD-003:** Remove `VITE_DEMO_MODE: 'true'` from `ci.yml` line 336 build job. This is a BUILD-TIME variable baked into the JS bundle — runtime config will not override it.
2. **CICD-004:** Pin both to `actions/upload-artifact@v4` and `actions/download-artifact@v4` (stable pair).
3. **CICD-005:** Add feature branch triggers: `push: branches: ['feat/**', 'fix/**', 'chore/**', 'refactor/**']`

**Files:** `.github/workflows/ci.yml`
**Effort:** XS (30 min)

### 1.6 Coverage Config (TEST-006)

Add to `vitest.config.ts` coverage section — but set thresholds LOW initially (will ratchet in Phase 4):

```typescript
thresholds: {
  global: { lines: 10, branches: 5 }, // Baseline — ratchet after TEST-001/005
},
all: true, // Include uncovered files in report
```

**Files:** `vitest.config.ts`
**Effort:** XS (15 min)

### 1.7 Error Capture (ERR-001)

Add `Sentry.captureException(error)` to both `uncaughtException` and `unhandledRejection` handlers in `server.ts:334-349` before `process.exit()`.

**Files:** `packages/backend/src/server.ts`
**Effort:** XS (15 min)

### 1.8 Compression Middleware (PERF-007)

```bash
npm install compression @types/compression --workspace=packages/backend
```

Add `app.use(compression())` before route registration in `app.ts`.

**Files:** `packages/backend/src/app.ts`, `packages/backend/package.json`
**Effort:** XS (30 min)

**Phase 1 Acceptance Criteria:**

- [ ] `packages/backend/.env` in `.gitignore`; old credentials rotated
- [ ] Webhook uses `crypto.timingSafeEqual`; empty secret throws in production
- [ ] JWT fallback removed from `app.ts` and `UserAuthenticationService.ts`
- [ ] `/health/detailed` requires admin auth
- [ ] `VITE_DEMO_MODE` removed from CI build; artifact versions pinned; feature branch CI enabled
- [ ] Coverage `all: true` and baseline thresholds in vitest config
- [ ] Sentry captures process-level errors
- [ ] Response compression enabled

---

## Phase 2: Security Hardening (Days 2-5)

_Goal: Fix IDOR vulnerabilities, add RLS to critical tables, harden auth._

### 2.1 IDOR Fixes — User Endpoints (SEC-004)

Add ownership verification to all user routes that accept `:id` param. Per critical-patterns.md #2, ownership is enforced at the service layer (no `requireOwnership` middleware exists).

Routes to fix in `packages/backend/src/routes/v1/user.routes.ts`:

- `PUT /api/v1/users/profile/:id` — verify `req.user.nostr_pubkey === id`
- `PUT /api/v1/users/preferences/:id`
- `GET /api/v1/users/activity/:id`
- `GET /api/v1/users/analytics/:id`
- `GET /api/v1/users/:id/blocked`
- `PUT /api/v1/users/:id/privacy-settings`
- `POST /api/v1/users/:id/follows/import`
- `GET /api/v1/users/:id/relationships/export`

Pattern: Early return with 403 if `req.user.nostr_pubkey !== req.params.id`.

**Files:** `packages/backend/src/routes/v1/user.routes.ts`
**Effort:** S (2-4 hours)

### 2.2 IDOR Fixes — Payment Endpoints (SEC-006)

Audit all controllers in `packages/backend/src/routes/v1/payment.routes.ts`. Verify `PaymentController` methods filter by `req.user.nostr_pubkey`. Fix if not:

- `GET /invoices/:id` — owner or recipient only
- `GET /subscriptions/:id` — subscriber only
- `POST /invoices/:id/retry` — owner only
- `GET /balance` — verify scoped to authenticated user
- `GET /transactions` — verify scoped to authenticated user

**Files:** `packages/backend/src/routes/v1/payment.routes.ts`, payment controllers
**Effort:** S (2-4 hours)

### 2.3 RLS Migration — Critical Tables (DB-001, partial)

**Pre-step (from SpecFlow Gap 2):** Audit table ownership columns BEFORE writing policies:

```sql
-- Run against Supabase to identify tables missing ownership anchor
SELECT t.table_name,
  EXISTS(SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = t.table_name
    AND c.column_name IN ('user_id', 'creator_id', 'owner_id', 'author_id')) as has_owner_column
FROM information_schema.tables t
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE';
```

Phase 2 covers **critical financial/auth tables only** (remainder in Wave 3):

- `payment_events`, `payment_retry_attempts`, `payment_lock_events`
- `unified_sessions`, `unified_session_activities`
- `lightning_invoices`, `lightning_payments`, `lightning_addresses`
- `subscriptions`, `recurring_payments`, `transactions`
- `business_invoices`, `contracts`, `expenses`, `revenue_entries`

Migration format per convention (`supabase/migrations/`):

```sql
-- Header with ticket reference
-- Idempotent: DROP POLICY IF EXISTS before CREATE POLICY
-- service_role: FOR ALL USING (true) WITH CHECK (true)
-- authenticated: USING (creator_id = (SELECT nostr_pubkey FROM users WHERE id = auth.uid()))
```

**Gotcha (from learnings):** RLS `uuid = text` type mismatch causes silent policy failures (pattern #130). Verify column types match before writing policies.
**Gotcha (from SpecFlow):** Apply this migration MANUALLY to production before adding migration automation to deploy pipeline (Phase 3). Large schema changes should not auto-run.

**Files:** `supabase/migrations/20260323000000_rls_critical_financial_tables.sql`
**Effort:** M (2 days)

### 2.4 Foreign Key Constraints (DB-002)

Add `REFERENCES users(id)` to ~19 UUID columns missing FK constraints. Use idempotent DDL:

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reply_templates_creator') THEN
    ALTER TABLE reply_templates ADD CONSTRAINT fk_reply_templates_creator
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;
```

**Decision:** `ON DELETE RESTRICT` for financial tables (contracts, invoices, revenue), `ON DELETE CASCADE` for user-owned content (circles, posts).

**Files:** `supabase/migrations/20260323000001_add_missing_foreign_keys.sql`
**Effort:** M (1 day)

### 2.5 Fix CASCADE on Payments (DB-005)

Change `payments.recipient_id` from `ON DELETE CASCADE` to `ON DELETE RESTRICT`. Financial records must never be silently deleted.

**Files:** `supabase/migrations/20260323000002_fix_payment_cascade.sql`
**Effort:** XS (30 min)

### 2.6 Creator ID Type Consistency (DB-003)

Migrate 5 Epic-009 tables from `creator_id TEXT` to `creator_id UUID` with FK to `users(id)`. Requires data migration: look up `users.id` from `users.nostr_pubkey` for existing rows.

**Files:** `supabase/migrations/20260323000003_fix_creator_id_type.sql`
**Effort:** M (1 day)

**Phase 2 Acceptance Criteria:**

- [ ] All 8 user routes verify ownership before processing
- [ ] Payment endpoints filter by authenticated user's pubkey
- [ ] RLS enabled on all financial/auth tables with tested policies
- [ ] FK constraints on all 19 UUID columns
- [ ] `ON DELETE RESTRICT` on payment.recipient_id
- [ ] Creator ID columns are UUID type with FK
- [ ] `rls-security.test.ts` re-enabled in vitest config and passing

---

## Phase 3: Infrastructure & CI/CD (Days 6-10)

### 3.1 Object Storage Migration (INFRA-002)

**Pre-step (from SpecFlow Gap 3):** Write and execute backfill script BEFORE merging code changes:

1. Enumerate all file paths stored in DB (`content.media_url`, `receipts.file_path`)
2. Upload each to Supabase Storage (or S3/R2)
3. Update DB records with new URLs
4. Verify all files accessible via new URLs

Then modify:

- `ContentCreationService.ts` — replace `fs.writeFile` with Supabase Storage upload
- `receipt-service.ts` — replace local PDF write with storage upload
- `env-validation.ts` — remove `UPLOAD_DIR`, add `STORAGE_BUCKET`

**Files:** `packages/backend/src/services/content/ContentCreationService.ts`, `packages/backend/src/services/lightning/receipt-service.ts`, `packages/backend/src/config/env-validation.ts`
**Effort:** L (3 days including backfill)

### 3.2 Deploy Pipeline — Migration Step (CICD-001)

Add `migrate` job between build and deploy-staging in `ci.yml`:

```yaml
migrate:
  needs: [build, test-gate]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: supabase/setup-cli@v1
    - run: supabase db push --linked
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

**Gotcha (from SpecFlow Gap 12):** DB-001 RLS migration must be applied manually FIRST. Automation runs only after the large schema change is already in production.

**Files:** `.github/workflows/ci.yml`
**Effort:** S (4 hours)

### 3.3 Rollback Automation (CICD-002)

Add rollback step with `if: failure()` after health check:

```yaml
- name: Rollback on failure
  if: failure()
  run: npx vercel rollback --token ${{ secrets.VERCEL_TOKEN }} --yes
```

For backend Docker: emit previous image digest as step output, re-apply on failure.

**Files:** `.github/workflows/ci.yml`
**Effort:** S (4 hours)

### 3.4 Staging/Production Separation (CICD-007)

- Gate `deploy-production` with `environment: production` (GitHub required reviewers)
- Add backend health check: probe `https://api-staging.sovren.dev/health` not just frontend URL

**Files:** `.github/workflows/ci.yml`
**Effort:** M (1 day)

### 3.5 Circuit Breakers (INFRA-004)

Install `opossum` and wrap Supabase client factory and LNBits HTTP client:

```typescript
import CircuitBreaker from 'opossum';
const supabaseBreaker = new CircuitBreaker(supabaseQuery, {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});
```

**Files:** `packages/backend/src/config/database.ts`, `packages/backend/src/services/lightning-service.ts`
**Effort:** M (2 days)

### 3.6 Network Segmentation (INFRA-005)

Replicate `docker-compose.yml` multi-network pattern into `docker-compose.prod.yml`:

- `internal-network`: backend + redis
- `gateway-network`: nginx + frontend
- `monitoring-network`: prometheus + grafana + fluentd

**Gotcha (from SpecFlow):** Verify health checks still work post-segmentation — backend must reach Redis, Supabase, and Lightning on internal network.

**Files:** `docker-compose.prod.yml`
**Effort:** S (4 hours)

### 3.7 Env File Cleanup (INFRA-003)

Already covered in Phase 1.1. Verify `**/.env.development` and `**/.env.test` are gitignored.

**Phase 3 Acceptance Criteria:**

- [ ] Existing local files backfilled to object storage; new uploads use storage API
- [ ] `supabase db push` runs in CI before deploy
- [ ] Vercel rollback fires automatically on failed health check
- [ ] Production deploy requires manual approval
- [ ] Circuit breakers on Supabase and LNBits calls
- [ ] Prod compose uses segmented networks
- [ ] All `.env.*` variants gitignored

---

## Phase 4: Testing & Quality Gates (Days 11-18)

### 4.1 Auth Middleware Tests (TEST-003)

Create `packages/backend/src/middleware/__tests__/auth.test.ts` covering:

- Valid JWT → 200
- Expired JWT → 401
- Missing auth header → 401
- Invalid NOSTR signature → 401
- Insufficient role → 403
- `requireAdmin`, `requireCreator`, `requireNostrSignature` guards

Fix `test:security-critical` script path in `package.json`.

**Files:** `packages/backend/src/middleware/__tests__/auth.test.ts`, `package.json`
**Effort:** M (1 day)

### 4.2 Payment Service Tests (TEST-002)

Create using `PaymentTestHarness` pattern (per `RefundService.test.ts` convention):

- `PaymentProcessingService.test.ts` — `processPayment()` happy path, error paths, state machine transitions
- `InvoiceService.test.ts` — create, expire, retry, status transitions

Target 90%+ coverage on both files. Use `beforeEach`/`afterEach` with `harness.dispose()`.

**Gotcha (from learnings):** `dispose()` must cover ALL services with timers. Grep for `setInterval`/`setTimeout` in constructors.

**Files:** `packages/backend/src/services/payment/__tests__/PaymentProcessingService.test.ts`, `packages/backend/src/services/payment/__tests__/InvoiceService.test.ts`
**Effort:** L (3 days)

### 4.3 Re-enable Excluded Frontend Tests (TEST-005)

Triage each of 14 excluded files individually (from SpecFlow Gap 10 — each may expose real bugs):

| Priority | Test File                           | Likely Issue        |
| -------- | ----------------------------------- | ------------------- |
| 1        | `Login.test.tsx`                    | Auth flow component |
| 2        | `NOSTRKeyManagementService.test.ts` | NOSTR key handling  |
| 3        | `UserSubscriptionManager.test.tsx`  | Payment UI          |
| 4        | `PaymentHistory.test.tsx`           | Financial display   |
| 5-14     | Remaining 10 files                  | Lower priority      |

For each: remove from vitest exclude list, run, diagnose failure (import path? missing mock? real bug?), fix.

**Files:** `vitest.config.ts` (exclude list), 14 test files
**Effort:** M (3-4 days)

### 4.4 Coverage Threshold Ratcheting (TEST-006 completion)

After TEST-005 is substantially resolved:

1. Run `npm run test:coverage` to measure actual levels
2. Set thresholds 5% below current measured values (ratchet floor)
3. Add per-file thresholds for payment services at 90%:

```typescript
thresholds: {
  global: { lines: XX, branches: XX }, // Set to measured - 5%
  'packages/backend/src/services/payment/**': { lines: 90 },
  'packages/backend/src/middleware/auth.ts': { lines: 85 },
}
```

**Gotcha (from SpecFlow Gap 13):** Do NOT set final thresholds before tests are fixed — it will block all PRs.

**Files:** `vitest.config.ts`
**Effort:** S (2 hours after tests are fixed)

### 4.5 Promote CI Test Jobs to Blocking (TEST-004)

Remove `continue-on-error: true` from:

- `ci.yml` line 262 (integration tests)
- `ci.yml` line 372 (E2E tests)

Prerequisite: Both test suites must be green for 5 consecutive runs on main.

**Files:** `.github/workflows/ci.yml`
**Effort:** XS (once tests are stable)

### 4.6 NOSTR Signature Crypto Test (TEST-007)

Add to `packages/backend/src/services/__tests__/nostr-auth.test.ts`:

```typescript
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
it('should verify real Schnorr signature', async () => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const event = finalizeEvent(
    { kind: 1, content: 'test', tags: [], created_at: Math.floor(Date.now() / 1000) },
    sk
  );
  const result = await nostrAuth.verifySignature(event.id, event.sig, pk);
  expect(result).toBe(true);
});
```

**Files:** `packages/backend/src/services/__tests__/nostr-auth.test.ts`
**Effort:** S (2 hours)

### 4.7 ESLint Config Consolidation (QUAL-003)

Delete `eslint.config.js` (inactive flat config). Harden `.eslintrc.json`:

- Set `@typescript-eslint/no-explicit-any: "warn"` (already there, but CI must enforce)
- Set `no-console: "warn"`
- Add `--max-warnings 0` to CI lint command

**Files:** `eslint.config.js` (delete), `.eslintrc.json`, `.github/workflows/ci.yml`
**Effort:** S (4 hours)

### 4.8 @ts-nocheck Triage (QUAL-001, partial)

Run `tsc --noEmit` with `@ts-nocheck` removed on security-critical files first:

- `packages/backend/src/routes/webhooks.ts` (already fixed in Phase 1)
- `packages/backend/src/services/nostr-auth.ts`
- `packages/backend/src/routes/v1/payment.routes.ts`
- `packages/backend/src/middleware/rate-limit-middleware.ts`

Fix type errors surfaced. Track remaining 153 files as tech debt backlog.

**Gotcha (from SpecFlow):** Removing `@ts-nocheck` from payment files may expose suppressed logic bugs. Treat each as a separate investigation.

**Files:** 4 security-critical files initially; remaining 153 tracked separately
**Effort:** M (2 days for first 4 files)

**Phase 4 Acceptance Criteria:**

- [ ] Auth middleware has comprehensive test suite
- [ ] PaymentProcessingService and InvoiceService have 90%+ test coverage
- [ ] At least 10 of 14 excluded frontend tests re-enabled and passing
- [ ] Coverage thresholds enforced in CI at measured baseline
- [ ] Integration + E2E tests promoted to blocking in CI
- [ ] Real NOSTR key cryptographic test passing
- [ ] Single ESLint config with `--max-warnings 0` in CI
- [ ] `@ts-nocheck` removed from 4 security-critical files

---

## Phase 5: Compliance & Documentation (Days 19-30)

### 5.1 Payment Idempotency (API-003)

Add `Idempotency-Key` header validation to v1 payment mutations:

- `POST /api/v1/payments/invoices`
- `POST /api/v1/payments/subscriptions`
- `POST /api/v1/payments/refunds`

Pattern: Store key→response mapping in Redis with 24h TTL. Return cached response on duplicate key. Standardize on header-based keys (matching existing payout route pattern).

**Gotcha (from learnings):** Non-atomic subscription creation (4 sequential DB ops without transaction) must be addressed simultaneously — wrap in Supabase RPC per critical-patterns.md #4.

**Files:** `packages/backend/src/routes/v1/payment.routes.ts`, `packages/backend/src/middleware/idempotency.ts` (new)
**Effort:** M (3 days)

### 5.2 GDPR User Deletion (COMP-001)

Create `DELETE /api/v1/users/account` endpoint:

1. Soft-delete user record (30-day grace period)
2. Anonymize payment records (retain for financial compliance, strip PII)
3. Delete: sessions, preferences, activity logs, analytics, social connections
4. Best-effort NIP-09 deletion events to NOSTR relays in user's relay list
5. After 30 days: hard-delete user record and remaining data

**Decision (from SpecFlow Gap 11):** NOSTR relay data is outside platform control. Document in privacy policy: "We send deletion requests to known relays but cannot guarantee removal from all relays."

Uses service role Supabase client (not user-scoped) per COMP-009 — no RLS DELETE policy needed.

**Files:** `packages/backend/src/routes/v1/user.routes.ts`, `packages/backend/src/services/user/UserDeletionService.ts` (new)
**Effort:** L (3 days)

### 5.3 GDPR Data Export (COMP-003)

Create `POST /api/v1/users/data-export` endpoint:

1. Queue export job via BullMQ (large exports are async)
2. Aggregate: profile, content metadata, payments, subscriptions, activity, preferences, social connections
3. Generate ZIP with JSON files per domain
4. Notify user when ready (download link with 24h expiry)

**Files:** `packages/backend/src/routes/v1/user.routes.ts`, `packages/backend/src/services/user/UserDataExportService.ts` (new), `packages/backend/src/jobs/data-export.job.ts` (new)
**Effort:** L (3 days)

### 5.4 Consent Management (COMP-004)

Create `user_consents` table:

```sql
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL, -- terms, privacy, marketing, analytics
  version VARCHAR(20) NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

API endpoints: `POST /consent/grant`, `POST /consent/withdraw`, `GET /consent/status`.

**Files:** `supabase/migrations/20260323100000_consent_management.sql`, `packages/backend/src/routes/v1/consent.routes.ts` (new), `packages/backend/src/services/ConsentService.ts` (new)
**Effort:** M (2 days)

### 5.5 NOSTR Key Encryption (COMP-002, partial)

**Phase 5 scope:** Run `encrypt-nostr-keys-migration.ts` against production using the NEW encryption key (rotated in Phase 1). Full client-side signing migration (XL effort) is Wave 3+.

**Gotcha (from SpecFlow Gap 4):** The encryption key MUST come from the newly rotated secrets, NOT the compromised `.env`. Verify the key source before running.

**Files:** `packages/backend/src/scripts/encrypt-nostr-keys-migration.ts`
**Effort:** S (2 hours including verification)

### 5.6 Incident Response Playbook (DOC-003)

Create `docs/incident-response/INCIDENT_PLAYBOOK.md`:

- Severity classification (P0/P1/P2)
- Declaration process and communication channels
- Command structure (IC, comms lead)
- Timeline expectations per severity
- Tools: Grafana, Sentry, Supabase dashboard
- Blameless post-mortem template

**Files:** `docs/incident-response/INCIDENT_PLAYBOOK.md` (new)
**Effort:** S (4 hours)

### 5.7 On-Call Policy (DOC-004)

Create `docs/incident-response/ON_CALL_POLICY.md`:

- Rotation schedule template
- Escalation matrix by domain (backend, payments, infra, security)
- Paging procedures and tools

**Files:** `docs/incident-response/ON_CALL_POLICY.md` (new)
**Effort:** S (2 hours)

### 5.8 Disaster Recovery Plan (DOC-005)

Create `docs/deployment/DISASTER_RECOVERY.md`:

- RTO/RPO targets per tier
- Supabase snapshot restore procedure
- Redis persistence recovery
- Post-recovery validation checklist

**Files:** `docs/deployment/DISASTER_RECOVERY.md` (new)
**Effort:** M (4 hours)

### 5.9 Root README Rewrite (DOC-001)

Replace frontend-only README with monorepo-level README covering:

- What Sovren is
- Architecture diagram
- Monorepo structure
- Quick start (full stack)
- Links to per-package READMEs and setup guide

**Files:** `README.md`
**Effort:** S (2 hours)

### 5.10 API Documentation (DOC-002, API-002)

Install `swagger-jsdoc` + `swagger-ui-express`. Wire to collect existing `@openapi` annotations. Mount at `/api/docs`. Document all v2 routes.

**Files:** `packages/backend/src/app.ts`, `packages/backend/package.json`, `docs/api/openapi.yaml`
**Effort:** L (2 days)

### 5.11 Response Envelope Consistency (API-001)

Migrate legacy routes (`auth.ts`, `users.ts`, `sessions.ts`) to use `createApiResponse()` from `utils/api-response.ts`. Replace inline `res.status().json()` calls.

**Files:** `packages/backend/src/routes/auth.ts`, `packages/backend/src/routes/users.ts`, `packages/backend/src/routes/sessions.ts`
**Effort:** M (1 day)

**Phase 5 Acceptance Criteria:**

- [ ] Payment mutations enforce idempotency keys
- [ ] `DELETE /api/v1/users/account` implements soft-delete with 30-day cascade
- [ ] `POST /api/v1/users/data-export` queues async export job
- [ ] `user_consents` table with grant/withdraw/status API
- [ ] NOSTR private keys encrypted with new key in production
- [ ] Incident response playbook, on-call policy, and DR plan written
- [ ] Root README covers full monorepo
- [ ] `/api/docs` serves live OpenAPI spec
- [ ] Legacy routes use consistent response envelope

---

## System-Wide Impact

### Interaction Graph

- **Credential rotation** → all backend services restart → active sessions invalidated → users must re-login
- **RLS migration** → Supabase PostgREST layer enforces policies → any query without proper auth context returns empty → service-role operations unaffected
- **Object storage migration** → content URLs change format → frontend must handle both old and new URL patterns during transition
- **Coverage thresholds** → every PR must meet bar → may slow velocity temporarily

### Error Propagation

- RLS silent failures (empty results, not errors) are the highest-risk regression from DB-001. Mitigate with `rls-security.test.ts` re-enabled.
- JWT rotation causes 401 for all active sessions — no retry will help. Users must re-authenticate.
- Idempotency key storage (Redis) adds a new failure mode — if Redis is down, payment dedup fails. Circuit breaker (Phase 3) mitigates.

### State Lifecycle Risks

- **Soft-delete grace period** (COMP-001): 30-day window where user data exists but is "deleted." Must not appear in search, analytics, or discovery during this period.
- **File backfill** (INFRA-002): If backfill fails partway, some files are in storage, others on disk. Need idempotent re-runnable backfill script.
- **RLS + FK migration** ordering: FK constraints must be added AFTER verifying no orphaned rows exist in production.

---

## Risk Analysis & Mitigation

| Risk                                           | Likelihood | Impact | Mitigation                                                 |
| ---------------------------------------------- | ---------- | ------ | ---------------------------------------------------------- |
| RLS migration returns empty rows               | High       | P0     | Audit ownership columns first; test with real data         |
| File backfill incomplete                       | Medium     | P0     | Idempotent script; verify all URLs before switching code   |
| JWT rotation causes user complaints            | High       | P1     | Schedule during low traffic; communicate via in-app notice |
| @ts-nocheck removal reveals logic bugs         | Medium     | P1     | Triage per-file; don't batch-remove                        |
| Test re-enablement reveals real component bugs | High       | P2     | Budget 50% extra time for bug fixes                        |
| Coverage thresholds block unrelated PRs        | Medium     | P2     | Set at measured baseline - 5%, ratchet monthly             |

---

## Success Metrics

- P0 count: 7 → 0
- P1 count: 36 → 0
- Overall readiness: RED → YELLOW (GREEN requires Wave 3 P2 remediation)
- Frontend coverage: 0.6% → 40%+ (realistic target after test recovery)
- Backend payment coverage: 0% → 90%+ on critical services
- CI tests blocking: 2 of 4 → 4 of 4
- RLS coverage: ~20 tables → ~75+ tables

---

## Sources & References

### Origin

- **Audit report:** [docs/audits/production-readiness-2026-03-23.md](docs/audits/production-readiness-2026-03-23.md) — 157 findings across 12 domains

### Internal References

- Critical patterns: `docs/solutions/patterns/critical-patterns.md` (patterns #1-15)
- Payment test harness: `docs/solutions/testing/payment-test-harness-mock-elimination-20260226.md`
- CI hardening learnings: `docs/solutions/infrastructure-issues/pr117-cicd-hardening-pipeline-consolidation-20260301.md`
- Branching strategy: `docs/development/BRANCHING_STRATEGY.md`
- RLS migration template: `supabase/migrations/20260303000000_add_rls_provenance_records.sql`
- API response helper: `packages/backend/src/utils/api-response.ts`
- Auth middleware: `packages/backend/src/middleware/auth.ts`
- Payment test template: `packages/backend/src/services/payment/__tests__/RefundService.test.ts`

### Prior Remediation Plans

- `docs/plans/p1-remediation-plan.md`, `p1-remediation-plan-round2.md` — earlier P1 security fixes
- `docs/plans/2026-02-20-refactor-quality-pipeline-100-percent-plan.md` — CI quality gates
- `docs/plans/2026-02-28-refactor-integration-test-infrastructure-overhaul-plan.md` — testcontainers setup
