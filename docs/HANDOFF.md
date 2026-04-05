# Sovren Project Handoff

Last updated: 2026-04-01

## 1. TL;DR

Sovren is a decentralized creator monetization platform built on NOSTR + Bitcoin Lightning. It is a TypeScript monorepo (React 18 frontend, Node.js/Express backend, Supabase/PostgreSQL). The frontend runs in **demo mode** by default (`VITE_DEMO_MODE=true`) which uses localStorage auth and mock data -- the real backend is not required to browse the UI. The #1 thing to know: most of the product's 40+ pages render, but many buttons and features are wired to API endpoints that return 404 or have no backend implementation. The codebase has zero `@ts-nocheck` files, all CI gates pass, and the architecture is solid -- the gap is backend completion and end-to-end integration testing.

## 2. Current State -- Honest

### What works in the browser

- **Homepage**: Hero, comparison table ("Why Sovren" vs Patreon/YouTube/Substack), feature cards, CTA buttons
- **Discovery page**: Shows 8 hardcoded demo creators (fallback when API is down)
- **Auth flows**: NOSTR login (requires browser extension like nos2x/Alby), email signup/login (demo mode only -- Supabase email auth is stubbed)
- **Onboarding**: 5-step creator onboarding wizard (Lightning wallet setup is optional/skippable)
- **Legal pages**: `/terms`, `/privacy`, `/help`, `/content-policy` -- production-grade with DMCA, CSAM, COPPA, CCPA, GDPR statute citations
- **Settings page**: Profile editing (local state only in demo mode)
- **Skip navigation + page titles**: Accessibility basics are in place

### What does NOT work

- **Backend API**: `localhost:3001` is not running by default. Starting it requires valid Supabase credentials and a properly configured `.env`.
- **26+ dead buttons**: UI elements that call API endpoints returning 404 or not implemented (payments, subscriptions, analytics dashboards)
- **6 missing analytics endpoints**: Cross-platform analytics routes exist but return mock/empty data
- **Lightning payments**: Requires LNbits server configuration -- no sandbox/testnet mode
- **Email verification**: Supabase email auth is not wired (signup returns `requiresConfirmation: true` but no email is sent)
- **Real-time features**: WebSocket/SSE endpoints are stubbed

### The demo mode problem

The frontend ships with `VITE_DEMO_MODE=true` as the practical default (set in `.env.local` on dev machines, checked in `.env.example`). In demo mode, `AuthContext.tsx` swaps `realAuthService` for `demoAuthService`, which stores users in localStorage with fake permissions. This means you can click through the entire UI without a backend, but nothing persists, no real data flows, and auth tokens are meaningless. Flipping to real mode (`VITE_DEMO_MODE=false`) requires a running backend with valid JWT signing.

## 3. Getting It Running

### Frontend only (demo mode)

```bash
cd packages/frontend
cp .env.example .env.local
# Ensure VITE_DEMO_MODE=true is set (or add it)
npm run dev
# Open http://localhost:3000
```

### Full stack (real backend)

```bash
# 1. Fix JWT_SECRET (the default has angle brackets + UUID -- both invalid)
cd packages/backend
cp .env.example.new .env
# Edit .env and set:
#   JWT_SECRET=$(openssl rand -base64 48)
#   SUPABASE_URL=https://pgxpjiarfmsammhwesfx.supabase.co
#   SUPABASE_ANON_KEY=<from Supabase dashboard>
#   SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
#   SESSION_SECRET=$(openssl rand -base64 32)

# 2. Start backend
npm run dev
# Backend listens on http://localhost:3001

# 3. Flip frontend to real mode
cd ../frontend
# In .env.local, set:
#   VITE_DEMO_MODE=false
#   VITE_API_URL=http://localhost:3001
npm run dev

# 4. Verify
curl http://localhost:3001/health
# Should return { "status": "ok", ... }
```

### Common startup issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `JWT_SECRET appears malformed` | `.env` has `<uuid>` placeholder | `openssl rand -base64 48` and replace |
| `SUPABASE_SERVICE_ROLE_KEY is not set` | `.env` uses old name `SUPABASE_SERVICE_KEY` | Rename to `SUPABASE_SERVICE_ROLE_KEY` |
| `Cannot find module 'swagger-ui-express'` | Missing dev dependency | `npm install` from monorepo root |
| Redis warning at startup | Redis not running locally | Non-fatal -- backend continues without Redis (caching disabled) |
| DI container warning | Missing optional services | Non-fatal -- backend continues with degraded functionality |

## 4. Architecture

### Monorepo layout

```
sovren/
  packages/
    frontend/    # React 18 + Vite + TailwindCSS + React Router
    backend/     # Node.js + Express + TypeScript
    shared/      # Shared types, utils, config validation
    testing/     # Test utilities and fixtures
  supabase/
    migrations/  # 41 SQL migrations (PostgreSQL)
    functions/   # Deno edge functions (auth, notifications, monitoring)
    config.toml  # Local Supabase CLI config
  .github/
    workflows/ci.yml  # Single consolidated CI pipeline
  docs/
    plans/       # Implementation plans (completed)
    solutions/   # Compound Engineering knowledge base
    legal/       # Compliance checklist
```

### Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS, React Router, TanStack Query |
| Backend | Node.js, Express, TypeScript, Inversify (DI), BullMQ (job queues) |
| Database | Supabase (PostgreSQL), RLS policies, 41 migrations |
| Auth | NOSTR (NIP-07 browser extension), JWT in HttpOnly cookies (SameSite=Strict) |
| Payments | Bitcoin Lightning via LNbits API |
| Edge functions | Deno (Supabase Functions) for auth validation, notifications, monitoring |
| CI/CD | GitHub Actions, single `ci.yml` with path-based change detection |
| Monitoring | Sentry (error tracking), Prometheus metrics endpoint, structured logging |

### Auth flow

1. Frontend calls `generateNostrChallenge()` -> backend returns a challenge string + timestamp
2. User signs the challenge with their NOSTR browser extension (NIP-07)
3. Frontend sends signed event (kind 22242) to `authenticateNostr()`
4. Backend verifies the signature, creates/fetches user, returns JWT in an HttpOnly cookie
5. Subsequent requests include the cookie automatically; 401 triggers `auth:session-expired` event

In demo mode, steps 1-4 are faked with localStorage.

### Frontend -> Backend integration

- `apiClient` (`packages/frontend/src/services/api/apiClient.ts`) wraps `fetch` with auth headers, token refresh, and 401 handling
- API base URL: `VITE_API_URL` (default `http://localhost:3001`)
- All API calls go through `/api/v1/*` or `/api/v2/*`
- v1 routes return a `Deprecation: true` header

## 5. Codebase Map -- 20 Key Files

| # | File | What it does |
|---|------|-------------|
| 1 | `packages/backend/src/server.ts` | Entry point -- startup, shutdown, env validation |
| 2 | `packages/backend/src/app.ts` | Express app factory -- middleware stack, route mounting, AppConfig |
| 3 | `packages/backend/src/routes/index.ts` | Route aggregator -- mounts v1 and v2 |
| 4 | `packages/backend/src/routes/v1/index.ts` | v1 routes: content, users, payments, metrics |
| 5 | `packages/backend/src/routes/v2/index.ts` | v2 routes: wellness, shield, discovery, platforms, business, +12 more |
| 6 | `packages/backend/src/routes/auth.ts` | NOSTR auth endpoints (challenge, verify, logout) |
| 7 | `packages/backend/src/middleware/auth.ts` | JWT verification, `authenticate` and `authorize` middleware |
| 8 | `packages/backend/src/container/index.ts` | Inversify DI container setup |
| 9 | `packages/backend/src/lib/logger.ts` | Structured logger (pino or winston) |
| 10 | `packages/frontend/src/features/auth/services/AuthContext.tsx` | Auth provider -- demo/real service switch |
| 11 | `packages/frontend/src/features/auth/services/realAuthService.ts` | Real auth service -- API calls to backend |
| 12 | `packages/frontend/src/services/api/apiClient.ts` | HTTP client with auth, retry, 401 handling |
| 13 | `packages/frontend/src/seed/demo-creators.ts` | 8 hardcoded demo creator profiles |
| 14 | `packages/shared/src/config/environment-validator.ts` | Env var validation schemas (Zod) |
| 15 | `packages/shared/src/config/environment-configs.ts` | Per-environment required var lists |
| 16 | `supabase/config.toml` | Local Supabase CLI configuration |
| 17 | `supabase/migrations/20240101000000_baseline_schema.sql` | Base database schema |
| 18 | `packages/backend/src/database/seed.sql` | E2E test seed data (3 test users + wellness data) |
| 19 | `.github/workflows/ci.yml` | CI pipeline -- lint, security, test, build, deploy |
| 20 | `CLAUDE.md` | Project rules, architecture, CE workflow commands |

## 6. API Reference

### v1 (deprecated -- returns `Deprecation: true` header)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/content` | CRUD | Content management |
| `/api/v1/users` | CRUD | User profiles |
| `/api/v1/payments` | CRUD | Lightning payment operations |
| `/api/v1/metrics` | GET | Platform metrics |

### v2 (current)

| Route | Purpose |
|-------|---------|
| `/api/v2/wellness` | Creator wellness tracking (burnout risk, work patterns) |
| `/api/v2/shield` | Content moderation / safety |
| `/api/v2/discovery` | Creator discovery and recommendations |
| `/api/v2/platforms` | Multi-platform account linking |
| `/api/v2/distribute` | Cross-platform content distribution |
| `/api/v2/inbox` | Unified inbox across platforms |
| `/api/v2/analytics/cross-platform` | Cross-platform analytics aggregation |
| `/api/v2/comments` | Comments CRUD |
| `/api/v2/network/users/:userId/follow` | Follow/unfollow |
| `/api/v2/notifications` | Notification management |
| `/api/v2/circles` | Creator circles/groups |
| `/api/v2/mentorship` | Mentorship matching |
| `/api/v2/content` | Collaboration features |
| `/api/v2/marketplace` | Creator marketplace |
| `/api/v2/business/contracts` | Business contract management |
| `/api/v2/business/invoices` | Invoice generation |
| `/api/v2/business/revenue` | Revenue tracking |
| `/api/v2/business/tax` | Tax reporting |

### Other routes (mounted directly, not versioned)

| Route | Purpose |
|-------|---------|
| `/auth/*` | NOSTR auth (challenge, verify, logout, refresh) |
| `/lightning/*` | Lightning invoice creation, payment webhooks |
| `/lightning-receipts/*` | Payment receipt generation and retrieval |
| `/health` | Health check endpoint |
| `/api/docs` | Swagger UI (requires `swagger-ui-express`) |
| `/metrics` | Prometheus metrics |
| `/admin/queues` | BullMQ admin dashboard (Bull Board) |

## 7. Database

### Key tables (from baseline migration + subsequent)

- `users` -- NOSTR pubkey as primary identifier, roles (creator/supporter/admin)
- `content` -- Creator posts, articles, media
- `payments` / `invoices` -- Lightning payment records
- `subscriptions` / `subscription_tiers` -- Creator tier management
- `comments` -- Threaded comments with reply counts
- `follows` -- User follow relationships with count triggers
- `notifications` -- In-app notification system
- `creator_work_patterns` -- Wellness tracking (hours, post counts)
- `wellness_snapshots` -- Periodic wellness scores and burnout risk
- `consent_records` -- GDPR/CCPA consent management

### Migrations

41 migrations in `supabase/migrations/`, from `20240101000000_baseline_schema.sql` to `20260331000001_fix_creator_id_migration_rls.sql`. Includes RLS policies, indexes, triggers, and edge function permissions.

### Seed data

`packages/backend/src/database/seed.sql` creates 3 test users (Alice/creator, Bob/supporter, Charlie/creator) with NOSTR pubkeys and wellness data. This is for E2E testing only -- there is no production seed data.

**Gap**: No seed data for content, payments, subscriptions, or other tables. The frontend demo creators (`packages/frontend/src/seed/demo-creators.ts`) are hardcoded in the frontend and not backed by database rows.

## 8. CI/CD

### Pipeline (`.github/workflows/ci.yml`)

Single consolidated pipeline with path-based change detection:

```
changes -> lint -> security -> test-backend -> test-frontend -> build -> deploy-staging -> deploy-production
```

- **Path detection**: Only runs backend/frontend jobs when relevant files change
- **Lint**: ESLint on changed files only (incremental)
- **Security**: `npm audit`, Trivy container scan
- **Tests**: Vitest for unit/integration, Playwright for E2E (currently limited)
- **Build**: TypeScript compilation, Vite build
- **Deploy**: Vercel (frontend), Docker/GHCR (backend) -- currently paused

### What gates exist

- ESLint with `--max-warnings` threshold
- TypeScript type-check per package
- `npm audit --audit-level=high`
- Unit test pass rate
- Trivy vulnerability scan on Docker image

### What gates do NOT exist

- No browser smoke tests in CI (this was identified as a critical gap -- see "Lessons Learned")
- No E2E integration tests that verify frontend+backend together
- No database migration validation in CI
- No Lighthouse/performance budget enforcement

## 9. Known Issues

### Dead UI elements

~26 buttons and interactive elements across the UI that either call unimplemented endpoints or navigate to stub pages. These are scattered across the creator dashboard, analytics views, payment management, and settings pages. No comprehensive inventory exists yet.

### Missing backend implementations

6 analytics endpoints in v2 return empty/mock data. Several v2 route files have service layers that are stubs (methods exist but return hardcoded responses).

### Remaining quality debt

- ~97 P2+P3 findings from the production readiness audit (tracked in `docs/solutions/`)
- TypeScript: root `tsc --noEmit` shows errors due to `@shared/types/` path alias resolution across packages. Per-package type-check passes.
- Some snapshot tests may be stale from recent UI changes

### Environment variable naming

The codebase standardized on `SUPABASE_SERVICE_ROLE_KEY` (Supabase's official name), but older `.env.example` files and documentation may still reference `SUPABASE_SERVICE_KEY`. If your `.env` uses the old name, the backend will log a warning at startup.

## 10. Development Workflow

### Compound Engineering (CE) loop

This project follows a strict development workflow:

```
Plan -> Work -> Review -> Compound
```

- **Plan** (`/ce:plan`): Research, spec, structured plan before coding (~40% of effort)
- **Work** (`/ce:work`): Execute the plan following existing patterns (~20% of effort)
- **Review** (`/ce:review`): 13+ parallel review agents analyze changes (~40% of effort)
- **Compound** (`/ce:compound`): Document learnings into `docs/solutions/`

CE Review is enforced by a git hook -- `gh pr merge` is blocked unless `/ce:review` has run on the branch.

### Branch naming

```
{type}/{squad}/{ticket}-{slug}
```

Examples: `feat/squad-a/FRE-27-backend-handoff`, `fix/squad-b/FRE-42-auth-redirect`

### Key lesson: Browser-test every change

The most expensive lesson from this project: multiple sprints shipped code that passed all CI gates but had broken UI flows visible only in a browser. Static analysis (TypeScript, ESLint, unit tests) catches syntax but not behavior. Before considering any PR done, open the app in a browser and click through the affected flows.

## 11. What To Read Next

Read in this order:

1. **This file** -- you are here
2. `CLAUDE.md` -- project rules, architecture overview, CE workflow commands
3. `packages/backend/src/app.ts` -- Express app factory, middleware stack, AppConfig
4. `packages/backend/src/server.ts` -- startup sequence, env validation
5. `packages/frontend/src/features/auth/services/AuthContext.tsx` -- auth flow, demo mode switch
6. `packages/backend/src/routes/v2/index.ts` -- full v2 API surface
7. `docs/solutions/patterns/critical-patterns.md` -- 26 P1-class patterns (mandatory if making changes)
8. `supabase/migrations/20240101000000_baseline_schema.sql` -- database schema
9. `.github/workflows/ci.yml` -- CI pipeline structure
10. `docs/solutions/workflow-issues/mvp-quality-remediation-zero-tsnocheck-20260401.md` -- most recent sprint learnings

## 12. Priority Backlog

### P1 -- Unlocks Alpha

1. **Start the backend** -- Fix `.env` (JWT_SECRET placeholder, SUPABASE_SERVICE_ROLE_KEY), verify health endpoint
2. **Wire frontend to real backend** -- Flip `VITE_DEMO_MODE=false`, test NOSTR auth end-to-end
3. **Configure email routing** -- `dmca@sovren.app`, `privacy@sovren.app`, `abuse@sovren.app` (referenced in legal pages)

### P2 -- Quality

4. **Browser smoke tests in CI** -- Add Playwright tests that verify login, discovery page load, creator profile view
5. **Fix root `tsc --noEmit`** -- Resolve `@shared/types/` path aliases in root tsconfig
6. **Audit dead buttons** -- Create inventory of non-functional UI elements, prioritize by user journey
7. **Seed data for demo** -- Create database seed script that populates content, payments, subscriptions for a realistic demo

### P3 -- Growth Features

8. **Email signup** -- Wire Supabase email auth (verification flow, password reset)
9. **Fiat on-ramp** -- Strike/River API for credit card to Lightning conversion
10. **Creator migration tool** -- Import from Patreon/Substack/Medium
11. **Analytics implementation** -- Wire the 6 stub analytics endpoints to real data
12. **Real-time features** -- WebSocket/SSE for live notifications and payment updates

## 13. Lessons Learned

These are distilled from 40+ sprints of development. Full details in `docs/solutions/`.

1. **Browser testing is non-negotiable.** Multiple sprints shipped "green CI" code with broken UI. Static analysis catches syntax, not behavior. Always open the app and click through.

2. **@ts-nocheck removal must be file-by-file.** Bulk removal causes cascading errors. When N files share K root interface mismatches, fix the roots first, then clean files individually.

3. **Post-remediation re-audit always.** Every bulk fix sprint introduced new P1s in the fixes themselves. CE Review caught a P0 NOSTR content hash mismatch that would have broken all signups.

4. **Demo mode is a trap.** It makes the app feel "done" when it is not. The gap between demo mode and real backend integration is where most bugs hide.

5. **SUPABASE_SERVICE_ROLE_KEY, not SUPABASE_SERVICE_KEY.** This naming mismatch caused silent failures in StorageService and session management. Always use Supabase's standard env var names.

6. **JWT_SECRET must not be a UUID.** UUIDs have only 122 bits of entropy and a predictable format. Use `openssl rand -base64 48` for signing keys.

7. **Domain-grouped parallel agents with non-overlapping file ownership = zero merge conflicts.** This pattern has held for 8+ consecutive sprints.

8. **Enforcement hooks beat documentation.** Rules in CLAUDE.md don't survive LLM context compaction. Git hooks that hard-block bad actions are the only reliable enforcement.
