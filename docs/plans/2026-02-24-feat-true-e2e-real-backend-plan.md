---
title: 'feat: True E2E Testing with Real Running Backend'
type: feat
date: 2026-02-24
---

# True E2E Testing with Real Running Backend

## Overview

Expand the Playwright E2E suite to exercise the **full stack**: browser → frontend → backend API → Supabase database. Zero mocks, zero demo auth, zero omitted pages. Prove the pattern with ONE spec (wellness dashboard) before expanding.

Currently, all 17 E2E tests use demo auth (client-side localStorage) and only test public pages + navigation. Dashboard pages (Wellness, Shield, Analytics) are tested for navigation-to only, not for real content rendering, because they require a running backend with data.

## Problem Statement

### Current State

- **Demo auth**: `enableBackendIntegration: false` hardcoded in `feature-flags.ts:14`. All auth is client-side localStorage — no JWT, no backend involvement.
- **No backend in E2E**: `playwright.config.ts` only starts the frontend (`npm run dev` on port 3000). The backend on port 3001 is never started.
- **Navigation-only dashboard tests**: `navigation.spec.ts` clicks nav links to `/wellness`, `/shield`, `/dashboard` but doesn't verify any content renders.
- **Random test keys**: `test-users.ts` uses `generateSecretKey()` — keys are random per import, making SQL seed data impossible.
- **Token state disconnect**: `realAuthService` stores JWT in `localStorage['auth_token']`, but `apiClient` reads from an in-memory `this.token` field that's set once at module load.
- **Missing timestamp**: `realAuthService.authenticateNostr()` omits `timestamp` from the request body, but backend Zod schema requires it.

### What "True E2E" Means

```
Browser → Playwright
  → Frontend (Vite, port 3000)
    → /api proxy (Vite, already configured)
      → Backend (Express, port 3001)
        → Supabase (local, port 54321)
          → PostgreSQL
```

Every test exercises this full chain. No `page.route()`. No demo auth. No omitted pages.

## Critical Prerequisites (Must Fix Before E2E Works)

### P0-1: NOSTR Signature Verification Bug

**File**: `packages/backend/src/services/nostr-auth.ts:166-177`

The backend creates a NOSTR event with `id: ''` and calls `verifyEvent()`. But nostr-tools v2 `verifyEvent()` computes the event hash and compares it to `event.id` — since `'' !== hash`, it **always returns false**.

```typescript
// ❌ BROKEN (nostr-auth.ts:172)
const event: NostrEvent = {
  kind: 1,
  pubkey,
  created_at: Math.floor(timestamp / 1000),
  tags: [],
  content: messageHash,
  id: '', // ← verifyEvent() will compare hash to '' and return false
  sig: signature,
};
const isValidSignature = verifyEvent(event);

// ✅ FIX: Compute event ID before verification
import { getEventHash } from 'nostr-tools/pure';
import type { UnsignedEvent } from 'nostr-tools/pure';

const eventData: UnsignedEvent = {
  kind: 1,
  pubkey,
  created_at: Math.floor(timestamp / 1000),
  tags: [],
  content: messageHash,
};
const event: NostrEvent = {
  ...eventData,
  id: getEventHash(eventData),
  sig: signature,
};
const isValidSignature = verifyEvent(event);
```

**Validation**: Write a standalone Node.js script that generates a challenge, signs it with `finalizeEvent()`, and calls `verifyEvent()` to confirm the fix works before integrating into E2E.

### P0-2: CSRF Exclusion for Auth Bootstrap

**File**: `packages/backend/src/middleware/csrf.ts:47-54`

`POST /api/auth/challenge` is the first request in the auth flow. It has no Bearer token, so CSRF middleware blocks it with 403 `CSRF_TOKEN_MISSING`. Auth endpoints must be excluded since they bootstrap authentication (and are rate-limited independently).

```typescript
// csrf.ts — add to excludePaths
excludePaths: [
  '/api/security/csp-report',
  '/api/v1/payments/webhooks',
  '/api/auth/challenge',       // ← ADD: bootstraps auth, rate-limited
  '/api/auth/authenticate',    // ← ADD: bootstraps auth, rate-limited
  '/health',
  '/ready',
  '/live',
  '/metrics',
],
```

### P0-3: Token State Bridge (Lazy Accessor)

**File**: `packages/frontend/src/services/api/apiClient.ts:34-48`

`apiClient` stores token in `this.token` (in-memory) set once at construction. `realAuthService` stores in `localStorage['auth_token']`. Since the singleton is created at module load, tokens set after init are missed.

**Fix**: Lazy accessor that checks localStorage on every request, not just at construction:

```typescript
class ApiClient {
  private baseUrl: string;
  private _token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Lazy accessor — checks localStorage on every call
  private getEffectiveToken(): string | null {
    if (this._token) return this._token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  setToken(token: string | null): void {
    this._token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  // Use getEffectiveToken() in request methods instead of this._token
}
```

### P0-4: Feature Flag → Environment Variable

**File**: `packages/frontend/src/shared/types/feature-flags.ts:12-15`

```typescript
// ❌ Hardcoded
export const featureFlags: FeatureFlags = {
  enableBackendIntegration: false,
};

// ✅ Environment-driven
export const featureFlags: FeatureFlags = {
  enableBackendIntegration: import.meta.env.VITE_ENABLE_BACKEND === 'true',
};
```

E2E tests set `VITE_ENABLE_BACKEND=true`. Production continues to use `false` until backend is production-ready.

### P0-5: Vite Proxy Port Fix

**File**: `packages/frontend/vite.config.ts:148-154`

Vite proxy **already exists** for `/api` routes but targets port 4000. The backend runs on port 3001. One-line fix:

```typescript
// ❌ Current (vite.config.ts:150)
target: env.VITE_API_URL || 'http://localhost:4000',

// ✅ Fix
target: env.VITE_API_URL || 'http://localhost:3001',
```

### P0-6: realAuthService Missing Timestamp

**File**: `packages/frontend/src/features/auth/services/realAuthService.ts:247-252`

`authenticateNostr()` omits `timestamp` from request body, but backend's `AuthenticateRequestSchema` requires `timestamp: z.number()`:

```typescript
// ❌ BROKEN — missing timestamp
body: JSON.stringify({
  nostr_pubkey: signature.pubkey,
  challenge: signature.challenge,
  signature: signature.signature,
  role: 'supporter',
}),

// ✅ FIX — add timestamp
body: JSON.stringify({
  nostr_pubkey: signature.pubkey,
  challenge: signature.challenge,
  timestamp: signature.timestamp,  // ← ADD
  signature: signature.signature,
  role: 'supporter',
}),
```

Also verify `NostrSignature` type includes `timestamp` field. If not, add it.

### P0-7: Deterministic Test User Keys

**File**: `packages/frontend/e2e/fixtures/test-users.ts`

`generateSecretKey()` produces random keys on every import — can't match SQL seed data. Fix by using hardcoded hex strings:

```typescript
// ❌ Random (current)
const privateKey = generateSecretKey();

// ✅ Deterministic
const TEST_PRIVATE_KEYS: Record<string, string> = {
  alice: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  bob: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
  charlie: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
  dave: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
  eve: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
};

function createTestUser(id: string, profile: { ... }): TestUserProfile {
  const privateKeyHex = TEST_PRIVATE_KEYS[id];
  const privateKey = Uint8Array.from(
    privateKeyHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const publicKey = getPublicKey(privateKey);
  // ... rest unchanged
}
```

Run once with `console.log()` to capture the derived public keys for SQL seed data.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Playwright Test Runner                                       │
│                                                              │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ globalSetup │  │ auth.setup  │  │ test specs           │ │
│  │ • verify    │  │ • NOSTR auth│  │ • home, auth, nav    │ │
│  │   supabase  │  │ • API-based │  │ • wellness           │ │
│  │ • seed data │  │ • save state│  │                      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────────────┘ │
│         │                │                 │                  │
│  ┌──────▼────────────────▼─────────────────▼──────────────┐  │
│  │                   webServer (array)                     │  │
│  │  ┌─────────────┐    ┌──────────────────┐               │  │
│  │  │ Frontend    │    │ Backend          │               │  │
│  │  │ Vite :3000  │───▶│ Express :3001    │               │  │
│  │  │ /api proxy  │    │ NOSTR auth       │               │  │
│  │  └─────────────┘    │ v1/v2 routes     │               │  │
│  │                     └────────┬─────────┘               │  │
│  │                              │                          │  │
│  │                     ┌────────▼─────────┐               │  │
│  │                     │ Supabase Local   │               │  │
│  │                     │ :54321 (API)     │               │  │
│  │                     │ :54322 (DB)      │               │  │
│  │                     │ PostgreSQL       │               │  │
│  │                     └──────────────────┘               │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Implementation Phases (3 Phases — Collapsed per Review)

#### Phase 1: Fix All Prerequisites (7 P0 bugs)

Fix the 7 P0 blockers that prevent backend integration from working. These are independent of E2E — they're bugs that exist today.

**Files to modify:**

| #    | File                                                              | Change                                                                          |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P0-1 | `packages/backend/src/services/nostr-auth.ts`                     | Fix event ID computation with `getEventHash()`, proper `UnsignedEvent` type     |
| P0-2 | `packages/backend/src/middleware/csrf.ts`                         | Add `/api/auth/challenge` and `/api/auth/authenticate` to `excludePaths`        |
| P0-3 | `packages/frontend/src/services/api/apiClient.ts`                 | Lazy token accessor `getEffectiveToken()` checking localStorage on each request |
| P0-4 | `packages/frontend/src/shared/types/feature-flags.ts`             | `import.meta.env.VITE_ENABLE_BACKEND === 'true'`                                |
| P0-5 | `packages/frontend/vite.config.ts`                                | Change proxy target port from 4000 to 3001                                      |
| P0-6 | `packages/frontend/src/features/auth/services/realAuthService.ts` | Add `timestamp` to `authenticateNostr()` request body                           |
| P0-7 | `packages/frontend/e2e/fixtures/test-users.ts`                    | Replace `generateSecretKey()` with hardcoded hex strings                        |

**Success criteria:**

- [ ] Standalone NOSTR auth script succeeds: challenge → sign → authenticate → JWT
- [ ] Backend starts, health check passes, NOSTR auth returns JWT
- [ ] Frontend with `VITE_ENABLE_BACKEND=true` can log in via NOSTR and load profile
- [ ] Test user public keys are deterministic across runs

#### Phase 2: Seed Data + Auth Helper + Playwright Config

Set up local Supabase with seed data, create the NOSTR auth helper, and update Playwright config.

**Create:**

| File                                          | Purpose                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/backend/src/database/seed.sql`      | Test users (matching deterministic test-users.ts pubkeys) + wellness data |
| `packages/frontend/e2e/helpers/nostr-auth.ts` | NOSTR challenge-response signing helper for API-based auth                |

**Modify:**

| File                                     | Change                                                      |
| ---------------------------------------- | ----------------------------------------------------------- |
| `packages/frontend/playwright.config.ts` | Multiple webServers (frontend + backend), new project tiers |
| `packages/frontend/e2e/global-setup.ts`  | Verify Supabase is running, seed data, create auth dir      |
| `packages/frontend/e2e/auth.setup.ts`    | Use NOSTR auth via API instead of demo email login          |

**NOSTR auth helper** (`e2e/helpers/nostr-auth.ts`):

```typescript
import { finalizeEvent } from 'nostr-tools/pure';
import { createHash } from 'crypto';
import type { APIRequestContext } from '@playwright/test';

export async function authenticateWithNostr(
  request: APIRequestContext,
  privateKey: Uint8Array,
  publicKey: string,
  role: 'creator' | 'supporter' = 'creator',
  baseUrl = 'http://localhost:3001'
): Promise<string> {
  // 1. Get challenge
  const challengeRes = await request.post(`${baseUrl}/api/auth/challenge`);
  const { data } = await challengeRes.json();
  const { challenge, timestamp } = data;

  // 2. Create signature message (must match backend's createSignatureMessage)
  const message = `Sovren Authentication\nChallenge: ${challenge}\nTimestamp: ${timestamp}`;
  const messageHash = createHash('sha256').update(message).digest('hex');

  // 3. Create and sign NOSTR event
  const event = finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(timestamp / 1000),
      tags: [],
      content: messageHash,
    },
    privateKey
  );

  // 4. Authenticate
  const authRes = await request.post(`${baseUrl}/api/auth/authenticate`, {
    data: {
      nostr_pubkey: publicKey,
      challenge,
      timestamp,
      signature: event.sig,
      role,
    },
  });
  const authData = await authRes.json();
  return authData.data.token;
}
```

**Auth setup rewrite** (`e2e/auth.setup.ts`):

```typescript
import { test as setup, expect } from '@playwright/test';
import { TEST_USERS } from './fixtures/test-users';
import { authenticateWithNostr } from './helpers/nostr-auth';

const authFile = 'test-results/.auth/creator.json';

setup('authenticate as creator via NOSTR', async ({ page, request }) => {
  // API-based auth — 10x faster than UI login
  const token = await authenticateWithNostr(
    request,
    TEST_USERS.alice.privateKey,
    TEST_USERS.alice.publicKey,
    'creator'
  );

  // Inject token into browser context
  await page.goto('/');
  await page.evaluate(
    ({ jwt, pubkey }) => {
      localStorage.setItem('auth_token', jwt);
      localStorage.setItem(
        'demo_user',
        JSON.stringify({
          id: 'alice-test',
          nostr_pubkey: pubkey,
          role: 'creator',
        })
      );
    },
    { jwt: token, pubkey: TEST_USERS.alice.publicKey }
  );

  // Navigate to profile to verify auth works
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/profile/);

  // Save storage state
  await page.context().storageState({ path: authFile });
});
```

**Playwright config** (`playwright.config.ts`):

```typescript
export default defineConfig({
  // ...existing config...
  webServer: [
    {
      command: 'npm run dev',
      cwd: path.join(__dirname, '../backend'), // ← correct relative path
      url: 'http://localhost:3001/health',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        PORT: '3001',
        SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
        JWT_SECRET: 'e2e-test-secret-at-least-32-characters-long',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_ENABLE_BACKEND: 'true',
      },
    },
  ],
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium-authenticated',
      testMatch: /navigation\.spec\.ts|wellness\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: authFile },
    },
    {
      name: 'chromium-public',
      testMatch: /home\.spec\.ts|auth\.spec\.ts/,
    },
  ],
});
```

**Seed data** (`seed.sql`) — Keyed to deterministic pubkeys from `test-users.ts`:

```sql
-- Test users (pubkeys derived from hardcoded hex in test-users.ts)
-- Run test-users.ts once to capture actual pubkeys for these INSERT statements
INSERT INTO users (nostr_pubkey, role, name, created_at) VALUES
  ('<alice-pubkey>', 'creator', 'Alice Test', NOW()),
  ('<bob-pubkey>', 'supporter', 'Bob Test', NOW()),
  ('<charlie-pubkey>', 'creator', 'Charlie Test', NOW());

-- Wellness data for Alice (creator)
INSERT INTO work_patterns (user_pubkey, pattern_type, score, recorded_at) VALUES
  ('<alice-pubkey>', 'daily', 75, NOW() - INTERVAL '1 day'),
  ('<alice-pubkey>', 'daily', 82, NOW() - INTERVAL '2 days'),
  ('<alice-pubkey>', 'weekly', 78, NOW() - INTERVAL '7 days');
```

Note: Exact pubkeys will be captured during Phase 1 when test-users.ts is made deterministic.

**Success criteria:**

- [ ] `authenticateWithNostr()` returns a valid JWT from the real backend
- [ ] Auth setup project completes successfully using NOSTR keys
- [ ] Storage state file contains valid JWT and user data
- [ ] Seed data visible in Supabase Studio (localhost:54323)
- [ ] Backend connects to local Supabase and serves API responses with seed data

#### Phase 3: One Wellness Spec (Prove the Pattern)

Create ONE Page Object + ONE spec that exercises the full stack with real data. This proves the E2E pattern works before expanding to more pages.

**Create:**

| File                         | Purpose                                  |
| ---------------------------- | ---------------------------------------- |
| `e2e/pages/wellness.page.ts` | POM for Wellness Dashboard               |
| `e2e/wellness.spec.ts`       | Wellness dashboard E2E tests (3-4 tests) |

**POM locators MUST be verified against actual component source** (`src/features/wellness/components/WellnessDashboard.tsx`) during implementation. Placeholder:

```typescript
export class WellnessPage {
  readonly page: Page;
  // Locators TBD — read WellnessDashboard.tsx source during implementation

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/wellness');
  }
}
```

**Wellness spec** (`e2e/wellness.spec.ts`):

```typescript
import { test, expect } from '@playwright/test';
import { WellnessPage } from './pages/wellness.page';

test.describe('Wellness Dashboard (real backend)', () => {
  test('displays wellness data from backend', async ({ page }) => {
    const wellnessPage = new WellnessPage(page);
    await wellnessPage.goto();

    // Verify real data from /api/v2/wellness/* renders
    // Exact assertions TBD based on actual component source
    await expect(page.getByText('Loading...')).not.toBeVisible();
    await expect(page.getByText('Error')).not.toBeVisible();
  });
});
```

**Success criteria:**

- [ ] Wellness page loads and renders real data from backend API
- [ ] Zero `page.route()` calls
- [ ] Zero `waitForTimeout` calls
- [ ] All locators are role-based
- [ ] Full suite passes: existing 17 tests + new wellness tests

### Deferred to Follow-Up PRs

| Item                                  | Why Deferred                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| CI pipeline updates (Supabase in GHA) | Prove locally first. CI `supabase start` needs 5-10 min first-run Docker pull + caching strategy. |
| Shield spec + POM                     | Prove pattern with wellness first, then expand                                                    |
| Creator Dashboard spec + POM          | `CreatorDashboard.tsx` may have no backend API calls — verify before writing spec                 |
| Analytics spec + POM                  | Depends on analytics backend routes being functional                                              |
| auth.spec.ts NOSTR login flow tests   | Current demo auth tests still pass; NOSTR UI login tests need separate UX work                    |

## Acceptance Criteria

### Functional Requirements

- [ ] Backend starts on port 3001 with real Supabase connection before tests run
- [ ] Auth setup authenticates via real NOSTR challenge-response (no demo auth)
- [ ] JWT stored in browser localStorage enables authenticated API calls
- [ ] Wellness page loads and renders real data from `/api/v2/wellness/*`
- [ ] All existing 17 tests continue to pass
- [ ] Navigation between all protected pages works with stored auth state

### Non-Functional Requirements

- [ ] Zero `page.route()` calls in any new spec file
- [ ] Zero `waitForTimeout` calls
- [ ] All locators are role-based (`getByRole`, `getByLabel`, `getByText`)
- [ ] Page Object Model used for every tested page

### Quality Gates

- [ ] `npx playwright test --list` shows all tests across 3 projects
- [ ] `npx playwright test` — all pass, 0 failed, 0 skipped
- [ ] No pre-existing test regressions (home, auth, nav tests still pass)

## Dependencies & Prerequisites

| Dependency            | Type    | Status                 | Notes                                                |
| --------------------- | ------- | ---------------------- | ---------------------------------------------------- |
| Supabase CLI          | Tool    | Check if installed     | `supabase start` for local instance                  |
| nostr-tools@2.23.0    | Library | Installed              | Both frontend + backend use same version             |
| Supabase migrations   | Schema  | Exists as `schema.sql` | Need to verify it loads cleanly in local Supabase    |
| Test keypairs         | Fixture | **NEEDS FIX**          | Currently random — must be made deterministic (P0-7) |
| Backend `npm run dev` | Service | Works                  | `tsx watch src/server.ts` on port 3001               |
| Vite proxy            | Config  | **EXISTS** (port 4000) | Just change port to 3001 (P0-5)                      |
| `seed.sql`            | Data    | Missing                | Must create after P0-7 (need deterministic pubkeys)  |

## Risk Analysis & Mitigation

| Risk                                                  | Impact              | Likelihood  | Mitigation                                                                      |
| ----------------------------------------------------- | ------------------- | ----------- | ------------------------------------------------------------------------------- |
| NOSTR signature verification is fundamentally broken  | Blocks all auth     | High (P0-1) | Fix event ID computation first, validate with standalone script                 |
| nostr-tools ESM/CJS incompatibility in globalSetup    | Setup fails         | Medium      | globalSetup runs in Node — may need `nostr-tools/pure` import or dynamic import |
| Backend DI container fails without all services       | Backend won't start | Medium      | Ensure graceful fallback for optional services (Redis, Lightning, Queues)       |
| Wellness component doesn't actually call backend APIs | Wasted POM effort   | Medium      | Read component source before writing POM; may find hardcoded data               |
| Test data isolation between runs                      | Flaky tests         | Low         | Deterministic keys + `DELETE FROM` in teardown                                  |
| Rate limiting blocks repeated test runs               | Tests fail on retry | Low         | Backend runs with `NODE_ENV=test` which skips rate limiting                     |

## File Change Summary

### Phase 1 — Fix Prerequisites (7 files modified)

| File                                                              | Action                          | Lines Est. |
| ----------------------------------------------------------------- | ------------------------------- | ---------- |
| `packages/backend/src/services/nostr-auth.ts`                     | Fix event ID computation        | ~10        |
| `packages/backend/src/middleware/csrf.ts`                         | Add auth routes to excludePaths | ~2         |
| `packages/frontend/src/services/api/apiClient.ts`                 | Lazy token accessor             | ~20        |
| `packages/frontend/src/shared/types/feature-flags.ts`             | Read from import.meta.env       | ~3         |
| `packages/frontend/vite.config.ts`                                | Change proxy port 4000→3001     | ~1         |
| `packages/frontend/src/features/auth/services/realAuthService.ts` | Add timestamp to request        | ~2         |
| `packages/frontend/e2e/fixtures/test-users.ts`                    | Hardcoded hex keys              | ~20        |

### Phase 2 — Seed + Auth + Config (2 created, 3 modified)

| File                                          | Action                            | Lines Est. |
| --------------------------------------------- | --------------------------------- | ---------- |
| `packages/backend/src/database/seed.sql`      | Create test data SQL              | ~40        |
| `packages/frontend/e2e/helpers/nostr-auth.ts` | Create NOSTR auth helper          | ~50        |
| `packages/frontend/playwright.config.ts`      | Multiple webServers, new projects | ~30        |
| `packages/frontend/e2e/global-setup.ts`       | Verify Supabase, seed data        | ~20        |
| `packages/frontend/e2e/auth.setup.ts`         | Rewrite with NOSTR auth           | ~25        |

### Phase 3 — One Wellness Spec (2 created)

| File                         | Action                     | Lines Est. |
| ---------------------------- | -------------------------- | ---------- |
| `e2e/pages/wellness.page.ts` | Wellness POM               | ~30        |
| `e2e/wellness.spec.ts`       | Wellness specs (3-4 tests) | ~50        |

**Total: ~11 files, estimated ~300 lines (vs original 20 files / 780 lines)**

## References & Research

### Internal References

- Previous E2E rewrite: `docs/solutions/test-failures/e2e-mock-elimination-pom-rewrite-20260224.md`
- CI integration gaps: `docs/solutions/workflow-issues/e2e-ci-agent-integration-gaps-20260224.md`
- Critical patterns: `docs/solutions/patterns/critical-patterns.md`
- Test users fixture: `packages/frontend/e2e/fixtures/test-users.ts`
- Backend auth routes: `packages/backend/src/routes/auth.ts` — NOSTR challenge/authenticate
- NOSTR auth service: `packages/backend/src/services/nostr-auth.ts` — signature verification
- CSRF middleware: `packages/backend/src/middleware/csrf.ts` — excludePaths config
- API client: `packages/frontend/src/services/api/apiClient.ts` — token management gap
- Feature flags: `packages/frontend/src/shared/types/feature-flags.ts` — hardcoded switch
- Vite config: `packages/frontend/vite.config.ts:148-154` — existing /api proxy at port 4000
- realAuthService: `packages/frontend/src/features/auth/services/realAuthService.ts:247` — missing timestamp

### External References

- Playwright multiple webServers: https://playwright.dev/docs/test-webserver
- Playwright storage state auth: https://playwright.dev/docs/auth
- Playwright project dependencies: https://playwright.dev/docs/test-global-setup-teardown
- Supabase local development: https://supabase.com/docs/guides/local-development
- nostr-tools v2 verification: https://github.com/nbd-wtf/nostr-tools

### Review Feedback Incorporated

Three reviewers (DHH, Kieran TypeScript, Code Simplicity) reviewed the original 6-phase plan. Key changes made:

1. **Collapsed 6 phases → 3** (all 3 reviewers)
2. **Deferred CI** to follow-up PR (all 3 reviewers)
3. **Prove with ONE spec** (wellness) instead of three (all 3 reviewers)
4. **Deleted `supabase-seed.ts`** — seed.sql is sufficient (DHH, Simplicity)
5. **Deleted `.env.e2e`** — pass env vars through Playwright config instead (DHH, Simplicity)
6. **Fixed `cwd` path** — `../backend` not `../../packages/backend` (Kieran)
7. **Fixed `arguments[1]` bug** — use `({ jwt, pubkey })` destructured param (Kieran)
8. **Fixed `as any` cast** — use `UnsignedEvent` type (Kieran)
9. **Added P0-6** — realAuthService missing `timestamp` (Kieran)
10. **Token bridge lazy accessor** — `getEffectiveToken()` not constructor-only (Kieran)
11. **Vite proxy is port change only** — already exists at 4000, change to 3001 (all 3)
12. **Test users use random keys** — need hardcoded hex (all 3 — confirmed by reading source)
