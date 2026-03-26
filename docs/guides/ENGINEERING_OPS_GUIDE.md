# Engineering & Agent Operations Guide

> Audience: Engineers and AI agents who own, operate, and maintain the Sovren platform.
> This guide is the fastest path from zero to productive on the platform. Read it top to bottom once,
> then use section links as a reference.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Environment Setup](#2-environment-setup)
3. [Architecture Deep Dive](#3-architecture-deep-dive)
4. [Deployment Pipeline](#4-deployment-pipeline)
5. [Monitoring & Observability](#5-monitoring--observability)
6. [Security Operations](#6-security-operations)
7. [Maintenance Procedures](#7-maintenance-procedures)
8. [Ways of Working](#8-ways-of-working)
9. [Troubleshooting](#9-troubleshooting)
10. [Agent-Specific Guidance](#10-agent-specific-guidance)

---

## 1. Platform Overview

### What Sovren Is

Sovren is a decentralized creator monetization platform built on the NOSTR protocol and Bitcoin Lightning Network. It gives creators true ownership of their content, audience relationships, and revenue streams — no intermediaries, no platform lock-in. Creators publish content via NOSTR events signed with their cryptographic keypair, gate premium content behind Lightning Network micropayments, and manage their business (subscriptions, invoicing, analytics) through a feature-rich web application backed by a Supabase-hosted PostgreSQL database and a Node.js Express API.

### Architecture Diagram

```
Browser (React 18 / Vite / TailwindCSS)
  │
  ├── Redux Toolkit (global state)
  ├── TanStack Query (server state / caching)
  ├── Feature modules (auth, content, payments, subscriptions, …)
  │
  │  HTTPS / REST
  ▼
Express API (Node.js / TypeScript)
  │
  ├── Middleware layer  (auth, rate-limit, CSRF, validation, correlation-id)
  ├── Route layer       (auth, users, content, lightning, webhooks, health, …)
  ├── Service layer     (business logic — finance, payment, nostr-auth, cache, …)
  ├── Repository layer  (Supabase queries — paginated, RLS-scoped)
  │
  │  Supabase client (service_role key — server only)
  ▼
Supabase (PostgreSQL 16 + Auth + Realtime + Storage)
  │
  ├── 59 RLS-protected tables
  ├── Point-in-Time Recovery (PITR — 7 day window)
  └── Realtime subscriptions (WebSocket → browser)

  ┌─────────────────────────────────────┐
  │  External Protocols / Services      │
  ├─────────────────────────────────────┤
  │ NOSTR relays   (nostr-tools)        │  ← event signing, relay pool, NIP-05
  │ Lightning Node (BOLT11 / WebLN)     │  ← invoice generation, payment verify
  │ LNBits (optional self-hosted)       │  ← wallet API
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │  Infrastructure                     │
  ├─────────────────────────────────────┤
  │ Vercel       → frontend hosting     │
  │ Docker/GHCR  → backend containers   │
  │ Redis        → sessions, rate-limit │
  │ GitHub Actions → CI/CD pipeline     │
  └─────────────────────────────────────┘
```

### Tech Stack Table

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 18.3.1 |
| Frontend language | TypeScript | 5.3 |
| Frontend build | Vite | latest |
| Frontend styling | TailwindCSS | latest |
| State (global) | Redux Toolkit | latest |
| State (server) | TanStack Query | latest |
| Backend runtime | Node.js | 20 LTS |
| Backend framework | Express | latest |
| Backend language | TypeScript | 5.3 |
| Database | PostgreSQL (via Supabase) | 16 |
| Auth | Supabase Auth + NOSTR challenge-response | — |
| Realtime | Supabase Realtime | — |
| Protocol | NOSTR (nostr-tools) | latest |
| Protocol | Lightning Network (BOLT11, WebLN) | — |
| Testing | Vitest + React Testing Library | latest |
| E2E Testing | Playwright | latest |
| Containerisation | Docker (multi-stage, amd64 + arm64) | latest |
| CI/CD | GitHub Actions | — |
| Frontend hosting | Vercel | — |
| Backend hosting | Docker → production host | — |
| Image registry | GHCR | — |
| Caching | Redis 7 | 7-alpine |
| Monorepo tooling | npm workspaces | — |

### Monorepo Structure

```
/                              ← repo root
├── packages/
│   ├── frontend/              ← React app
│   │   ├── src/
│   │   │   ├── features/      ← domain feature modules
│   │   │   ├── pages/         ← route-level components
│   │   │   ├── components/ui/ ← shared UI primitives
│   │   │   ├── hooks/         ← shared React hooks
│   │   │   ├── services/      ← API clients
│   │   │   ├── store/         ← Redux slices
│   │   │   └── types/         ← frontend-scoped types
│   │   ├── e2e/               ← Playwright E2E tests
│   │   └── playwright.config.ts
│   ├── backend/               ← Node.js Express API
│   │   └── src/
│   │       ├── routes/        ← Express routers
│   │       ├── services/      ← business logic
│   │       ├── repositories/  ← Supabase data access
│   │       ├── middleware/    ← auth, rate-limit, CSRF, …
│   │       └── utils/         ← backend utilities
│   ├── shared/                ← shared types and utilities
│   │   └── src/types/         ← community, finance, nostr, payment-state, …
│   └── testing/               ← shared testing utilities
├── supabase/
│   └── migrations/            ← SQL migration files (baseline + incremental)
├── .github/workflows/ci.yml   ← CI/CD pipeline
├── docker-compose.dev.yml     ← local dev + monitoring stack
├── docker-compose.prod.yml    ← production compose
├── monitoring/                ← Prometheus + Grafana provisioning
└── scripts/
    ├── ce-metrics/            ← CE metrics hooks + install scripts
    └── validate-deployment-secrets.sh
```

---

## 2. Environment Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20 LTS | `nvm install 20` or https://nodejs.org |
| npm | 10+ | bundled with Node 20 |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop |
| Supabase CLI | latest | `npm install -g supabase` |
| GitHub CLI (gh) | latest | `brew install gh` or https://cli.github.com |
| Git | 2.x | system package manager |

Docker must be running before executing any integration tests or local backend commands.

### Clone and Install

```bash
git clone https://github.com/zone17/sovren.git
cd sovren
npm install          # installs all workspace deps in a single pass
```

npm workspaces links `packages/shared` and `packages/testing` automatically. No manual `cd` into each package is needed.

### Local Development

```bash
# Frontend dev server — hot reload, available at http://localhost:3000
npm run dev

# Backend (Docker compose — includes Redis and monitoring)
docker compose -f docker-compose.dev.yml up -d

# Optional: start monitoring stack (Grafana :3002, Prometheus :9090)
docker compose -f docker-compose.dev.yml --profile monitoring up -d
```

The frontend defaults to demo mode (mock auth redirect) when `USE_BACKEND` is not set. To run against a real backend:

```bash
USE_BACKEND=1 npm run dev
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only (backend + frontend + shared, no Docker needed)
npm run test:unit

# Integration tests (requires Docker — uses testcontainers for postgres:16-alpine + redis:7-alpine)
npm run test:integration

# E2E tests (Playwright against production build)
npm run test:e2e

# E2E with Playwright UI
npm run test:e2e:ui

# Security tests
npm run test:security

# Accessibility tests
npm run test:a11y

# Coverage report
npm run test:coverage

# Single file
npx vitest run packages/backend/src/services/payment/PaymentService.test.ts
```

Integration test notes:
- First run downloads ~150 MB of container images (postgres:16-alpine, redis:7-alpine).
- If testcontainers fails to connect to Docker, set `TESTCONTAINERS_RYUK_DISABLED=true`.
- Integration tests use real Postgres and Redis — never vi.fn() stubs. See common-solutions.md #50.

Coverage targets: 95% for services, repositories, and Redux store; 85% globally.

### Docker Operations (Backend)

```bash
# Start backend stack (from repo root)
docker compose -f docker-compose.dev.yml up -d

# Stop
docker compose -f docker-compose.dev.yml down

# View logs
docker compose -f docker-compose.dev.yml logs -f backend

# Rebuild after Dockerfile changes
docker compose -f docker-compose.dev.yml build backend

# From packages/frontend (convenience scripts)
cd packages/frontend
npm run docker:build
npm run docker:start
npm run docker:stop
npm run docker:logs
npm run docker:status
```

### Environment Variables

Copy `.env.example` at the repo root and in `packages/frontend/` and `packages/backend/`:

```bash
cp .env.example .env
cp packages/frontend/.env.example packages/frontend/.env
cp packages/backend/.env.example packages/backend/.env
```

All environment variables are validated with Zod at startup. Missing required vars cause a hard crash on boot — intentional by design (common-solutions.md #3). Check the Zod schema in `packages/backend/src/config/env.ts` for the full required variable list.

Key variable groups:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase connection
- `JWT_SECRET` — JWT signing key (min 32 chars)
- `WEBHOOK_SECRET` — HMAC-SHA256 webhook signature verification
- `REDIS_URL` — Redis connection string
- `LNBITS_*` — Lightning node credentials (optional for dev)
- `SENTRY_DSN` — error tracking (optional for dev)

Never commit `.env` files. They are in `.gitignore`.

---

## 3. Architecture Deep Dive

### Request Flow

Every API request follows this path:

```
HTTP Request
  │
  ▼
Express Router (packages/backend/src/routes/index.ts)
  │  Route registration and ordering. All routes wrapped with asyncHandler (common-solutions.md #121).
  ▼
Middleware Chain
  │  1. correlation-id   → injects X-Request-ID on every request
  │  2. auth.ts          → validates JWT (Supabase) or NOSTR challenge-response
  │  3. rate-limit       → per-IP and per-user tiered limits
  │  4. csrf             → CSRF token validation on state-mutating methods
  │  5. validation       → Zod schema validation on request body/params
  ▼
Route Handler (packages/backend/src/routes/*.ts)
  │  Thin layer — parse params, call service, return response.
  │  Route files must NOT create DB clients directly (common-solutions.md #122).
  ▼
Service Layer (packages/backend/src/services/)
  │  All business logic lives here. Every service method checks ownership/authorization
  │  before accessing data (critical-patterns.md #2 — service-layer authorization).
  │  Services: finance/, payment/, lightning/, community/, content/, distribution/,
  │            nostr-auth.ts, CacheService.ts, EventBusService.ts, AuditLogService.ts
  ▼
Repository Layer (packages/backend/src/repositories/)
  │  Data access only — Supabase queries, paginated accumulation (PAGE_SIZE=500, critical #3).
  │  No business logic. Returns typed domain objects.
  ▼
Supabase (PostgreSQL + RLS)
  │  All reads are RLS-scoped. Service-role key used for service-inserted tables
  │  (RLS INSERT policy: auth.role() = 'service_role', critical #16).
  └──▶ Response assembled → JSON → client
```

Error responses always use `createApiResponse` (common-solutions.md #4) for consistent shape:
```json
{ "success": false, "error": "Human-readable message", "code": "MACHINE_CODE" }
```

### Feature-Based Frontend Architecture

The frontend uses a domain-driven feature module pattern. Each feature is a self-contained directory:

```
packages/frontend/src/features/{feature}/
├── components/      ← UI components scoped to this feature
├── services/        ← API calls, hooks, context
├── types/           ← TypeScript types for this feature
└── index.ts         ← barrel export (public API of the feature)
```

Current features: `auth`, `content`, `payments`, `subscriptions`, `analytics`, `dashboard`, `discovery`, `wellness`, `nostr`, `multi-platform`, `creator-network`, `ai`, `supporter`, `business`.

Import rule: consumers import from the barrel only — `import { Component } from '@/features/payments'` — never from internal paths.

Path aliases (configured in `packages/frontend/vite.config.ts` and `tsconfig.json`):

| Alias | Resolves to |
|---|---|
| `@/` | `packages/frontend/src/` |
| `@components/` | `src/components/` |
| `@pages/` | `src/pages/` |
| `@hooks/` | `src/hooks/` |
| `@services/` | `src/services/` |
| `@types/` | `src/types/` |
| `@utils/` | `src/utils/` |
| `@store/` | `src/store/` |

Cross-package types are imported as `import { Type } from '@shared/types/module'`.

### NOSTR Protocol Integration

NOSTR (Notes and Other Stuff Transmitted by Relays) is the decentralized identity and messaging protocol.

Key concepts for this codebase:

- **Keys**: Users have a secp256k1 keypair. Private key stays in the browser (via Alby or nos2x extension) — never touches the server.
- **Pubkey**: The user's identifier on NOSTR. Stored in the `users` table as `nostr_pubkey`.
- **Events**: Signed JSON objects. Kind 1 = text note. Kind 0 = profile metadata. Kind 4 = encrypted DM.
- **Relays**: WebSocket servers that store and forward events. Configured in `packages/shared/src/`.
- **NIP-05**: DNS-based identity verification (username@domain format). Endpoint: `/api/nip05`.

Authentication flow (NOSTR challenge-response):
1. Client requests a challenge nonce from `POST /api/auth/nostr/challenge`.
2. Client signs the challenge with their private key using `signEvent` from nostr-tools.
3. Client submits the signed event to `POST /api/auth/nostr/verify`.
4. Backend calls `packages/backend/src/services/nostr-auth.ts` which calls `getEventHash(UnsignedEvent)` before `verifyEvent` (critical-patterns.md #9 — always hash first).
5. On success, backend issues a JWT (Supabase session or custom JWT).

Event creation pattern:
```typescript
import { SimplePool, Event, getPublicKey, getEventHash, signEvent } from 'nostr-tools';

const event: Event = {
  kind: 1,
  pubkey: userPublicKey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'Message content',
};
// Always getEventHash before signEvent or verifyEvent
event.id = getEventHash(event);
```

### Lightning Network Integration

Lightning enables direct creator monetization with sub-second settlement and near-zero fees.

Key concepts:
- **BOLT11 invoices**: Standard Lightning payment request format. Generated by the backend via `packages/backend/src/services/lightning/`.
- **WebLN**: Browser API for wallet integration (Alby extension). Frontend uses WebLN to send payments without exposing private keys.
- **LNBits**: Optional self-hosted Lightning wallet backend. Configured via `LNBITS_*` env vars.
- **Payment verification**: Backend polls or receives a webhook callback to confirm payment. Payment is persisted atomically before content is unlocked (critical-patterns.md #5 — payment persistence).

Payment flow:
1. Client requests invoice: `POST /api/lightning/invoice`.
2. Backend generates BOLT11 invoice via Lightning node/LNBits.
3. Client pays via WebLN (`window.webln.sendPayment(paymentRequest)`).
4. Backend receives settlement webhook: `POST /api/webhooks/lightning`.
5. Webhook handler verifies HMAC-SHA256 signature using `crypto.timingSafeEqual` (critical #19).
6. Payment record written atomically. Content unlocked.

### Authentication: Supabase Auth + NOSTR + JWT

Two supported auth paths:

| Method | Flow | Use Case |
|---|---|---|
| Supabase email/password | Standard Supabase Auth, issues Supabase JWT | Web users who prefer email login |
| NOSTR challenge-response | Sign challenge with NOSTR key → backend issues JWT | Power users with NOSTR keys (Alby, nos2x) |

JWT lifecycle:
- Access token: short-lived (configurable, default 1 hour).
- Refresh token: rotated on each use, stored in HttpOnly cookie.
- Middleware (`packages/backend/src/middleware/auth.ts`) validates the JWT on every request. Expired tokens return 401.
- Service layer re-checks ownership on every data access — route-level auth alone is insufficient (critical #2).

### Real-time: Supabase Realtime Subscriptions

Live features (notification bell, feed updates, payment confirmations) use Supabase Realtime:

```typescript
const channel = supabase
  .channel('notifications')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
    (payload) => dispatch(addNotification(payload.new))
  )
  .subscribe();
```

Realtime channels are torn down in component cleanup (`useEffect` return function) to avoid memory leaks.

---

## 4. Deployment Pipeline

### CI/CD Overview

Pipeline defined in `.github/workflows/ci.yml`. Triggered on push to `main`, `feat/**`, `fix/**`, `chore/**`, `refactor/**`, and on PRs targeting `main`.

Stages run in dependency order:

| Stage | Jobs | Runs on |
|---|---|---|
| Path Detection | `changes` — detects which packages changed | All pushes |
| Code Quality | `lint` (ESLint + Prettier), `typecheck` (per-package tsc) | All branches |
| Security Scan | `npm-audit`, `trivy-fs` | All branches |
| Build & Test | `test-unit`, `test-integration`, `test-coverage` | Path-gated |
| E2E Tests | `playwright` | Path-gated |
| Test Gate | `test-gate` — fan-in aggregator (common-solutions.md #69) | All branches |
| Build Image | `docker-build`, `ghcr-push` | main, develop only |
| Image Scan | `trivy-container` — CVE scan of built image | main, develop only |
| Deploy Staging | `deploy-staging`, `smoke-tests` | main (auto) |
| Deploy Production | `deploy-production` (blue-green), `health-check`, `rollback-guard` | main (manual approval) |

Required status checks for branch protection: `CI / Test Gate`, `CI / Lint`, `CI / Type Check`. Individual test jobs are path-gated and may be skipped — the aggregator handles this correctly.

### Staging vs Production Environments

| | Staging | Production |
|---|---|---|
| Branch | `main` (auto-deploy on merge) | `main` (manual approval gate) |
| Backend URL | `https://api-staging.sovren.dev` | `https://api.sovren.dev` |
| Frontend URL | Vercel preview | `https://sovren.dev` |
| Auto-fix allowed | Yes | Never — notify only |
| Deployment model | Single container swap | Blue-green |
| Rollback time | < 2 minutes | < 2 minutes |

### Database Migrations

Migrations live in `supabase/migrations/`. Each migration file is a timestamped SQL file.

```bash
# Apply pending migrations to linked Supabase project
supabase db push --linked

# Or with explicit project ref
supabase db push --project-ref <project-ref>

# List migration status
supabase migration list --project-ref <project-ref>

# Create a new migration
supabase migration new <migration-name>
```

Rules for safe migrations:
- Every `CREATE TABLE` must include RLS policies in the same migration file (critical #18).
- RLS policy column types must match the table column types — verify with `\d+ table_name` before writing (common-solutions.md #130).
- Never run migrations during a PITR restore operation.
- Breaking schema changes require an ADR in `docs/decisions/` before the PR.
- Shared package type changes ship in a separate PR before consumer changes (see `docs/development/SHARED_PACKAGE_PROTOCOL.md`).

### Frontend: Vercel Auto-Deploy

The frontend auto-deploys to Vercel on every merge to `main`. No manual steps.

- Build command: `npm run vercel-build` (runs inside `packages/frontend/`)
- Output directory: `packages/frontend/dist`
- Environment variables: configured in Vercel project dashboard (not in `.env` files in CI)
- Preview deployments: every PR gets a unique Vercel preview URL

Vite production build features:
- 14 manual chunks for optimal caching
- esbuild minification + tree shaking
- Gzip + Brotli compression
- Bundle limits: JS chunks < 250 KB, CSS < 50 KB

### Backend: Docker → GHCR → Production

```
CI builds multi-arch image (amd64 + arm64)
  → Signs with Cosign
  → Pushes to ghcr.io/<org>/sovren-backend:<git-sha>
  → Tagged :latest on main
  → SBOM and SLSA provenance attached
  → trivy-container CVE scan
  → (staging) automatic deploy
  → (production) manual approval → blue-green swap
```

Image size target: < 150 MB (multi-stage build — builder stage discarded).

To pull and run a specific image tag locally:
```bash
docker pull ghcr.io/<org>/sovren-backend:<sha>
docker run -p 4000:4000 --env-file packages/backend/.env ghcr.io/<org>/sovren-backend:<sha>
```

### Rollback Procedures

**Frontend rollback (Vercel — < 60 seconds):**
```bash
# Via CLI
npx vercel ls --limit 10                          # find previous deployment URL
npx vercel promote <deployment-url> --scope <team>

# Or via Vercel dashboard: Deployments → previous "Ready" deploy → ... → Promote to Production
```

**Backend rollback (Docker image):**
```bash
# 1. Find previous image tag
gh api /orgs/<org>/packages/container/sovren-backend/versions \
  --jq '.[0:5] | .[] | {tags: .metadata.container.tags, created: .created_at}'

# 2. Update docker-compose.prod.yml to reference the previous tag
# 3. Pull and redeploy
docker pull ghcr.io/<org>/sovren-backend:<previous-tag>
docker compose -f docker-compose.prod.yml up -d backend

# 4. Verify
curl -f https://api.sovren.dev/health
docker compose -f docker-compose.prod.yml logs --tail=50 backend
```

Full rollback procedures with post-recovery validation checklist: `docs/deployment/DISASTER_RECOVERY.md`.

### Initial Production Setup

```bash
# Validate all required secrets are present before first deploy
./scripts/validate-deployment-secrets.sh production

# Initial deploy and setup
npm run production:setup

# Verify
curl https://api.sovren.dev/health
curl https://api.sovren.dev/ready
```

---

## 5. Monitoring & Observability

### Health Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | None | Basic liveness. Returns `{"status":"ok"}`. |
| `GET /live` | None | Kubernetes-compatible liveness probe. |
| `GET /ready` | None | Readiness probe — includes DB + Redis connectivity. Returns `{"status":"ok","database":"connected","redis":"connected"}`. |
| `GET /health/detailed` | Admin JWT | Full subsystem status (DB, Redis, Lightning, queue workers). |

Use `/ready` for load balancer health checks. Use `/live` for container restart triggers. Use `/health/detailed` during incident investigation (admin token required).

Local dev:
```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

Production:
```bash
curl -f https://api.sovren.dev/health
curl -f https://api.sovren.dev/ready
```

### Prometheus Metrics

Metrics exported at `GET /metrics` (prom-client, standard Prometheus text format).

**RED Metrics (Rate, Errors, Duration):**

| Metric | Type | Labels |
|---|---|---|
| `sovren_http_requests_total` | Counter | `method`, `route`, `status_code` |
| `sovren_http_request_errors_total` | Counter | `method`, `route`, `status_code` |
| `sovren_http_request_duration_seconds` | Histogram | `method`, `route` |

**Business Metrics:**

| Metric | Type | Description |
|---|---|---|
| `sovren_payments_total` | Counter | Lightning payment completions |
| `sovren_subscriptions_active` | Gauge | Active subscription count |
| `sovren_content_published_total` | Counter | Content events published |
| `sovren_nostr_events_total` | Counter | NOSTR events processed |
| `sovren_queue_jobs_total` | Counter | BullMQ job completions by queue + status |

**SLOs** (defined in `docs/observability/slos.md`):

| SLO | Target |
|---|---|
| API error rate | < 1% over 5 minutes |
| API uptime | > 99.5% |
| P99 latency | < 500 ms |
| P95 latency | < 250 ms |
| P50 latency | < 100 ms |

Error budget: 0.5% = ~3.6 hours/month.

### Grafana Dashboards

Start the monitoring stack:
```bash
docker compose -f docker-compose.dev.yml --profile monitoring up -d
```

| URL | Dashboard |
|---|---|
| `http://localhost:3002` | Grafana (default credentials: admin/admin) |
| `http://localhost:9090` | Prometheus UI |
| `http://localhost:9091` | Pushgateway |

Provisioning configs: `monitoring/` — Prometheus scrape configs, Grafana datasource and dashboard provisioning.

CE Metrics (Compound Engineering tracking):
```bash
bash scripts/ce-metrics/install-hooks.sh      # one-time install
bash scripts/ce-metrics/test-hooks.sh         # verify (expect Passed: 25, Failed: 0)
bash scripts/ce-metrics/seed-test-data.sh     # push synthetic data for dashboard check
touch ~/.claude/metrics/.disabled             # disable collection
rm ~/.claude/metrics/.disabled                # re-enable
```

See `docs/development/CE_METRICS_DASHBOARD.md` for the full CE metrics pipeline.

### Sentry Error Tracking

Sentry captures unhandled exceptions and explicit `Sentry.captureException` calls from both backend and frontend. Configuration: `SENTRY_DSN` env var.

During incident investigation:
1. Open Sentry → filter by environment and time window matching the incident.
2. Check "Affected Users" count for blast radius assessment.
3. Examine stack traces for root cause.
4. Use release tracking to correlate errors with deployments.

### Structured Logging (Winston)

Backend logs use Winston with JSON format. Every log line includes:

| Field | Description |
|---|---|
| `timestamp` | ISO 8601 UTC |
| `level` | `error`, `warn`, `info`, `debug` |
| `requestId` | Correlation ID from `X-Request-ID` header (set by correlation-id middleware) |
| `userId` | Authenticated user ID (when available) |
| `service` | Service name (e.g., `payment-service`) |
| `message` | Human-readable message |

Correlation IDs flow through the entire request lifecycle. When debugging a specific user's issue, filter by `requestId` to trace the full request path across all log lines.

Log levels by environment: `debug` in development, `info` in staging and production.

### Runbooks

Runbooks for common alert conditions are in `docs/observability/runbooks/`:

| Runbook | Alert condition |
|---|---|
| `docs/observability/runbooks/high-error-rate.md` | `SLOHighErrorRate` — error rate > 1% for 5 min |
| `docs/observability/runbooks/high-latency.md` | `SLOHighLatencyP99` / `SLOHighLatencyP95` |
| `docs/observability/runbooks/lightning-node-unreachable.md` | Lightning node connectivity lost |
| `docs/observability/runbooks/nodejs-high-heap.md` | Node.js heap usage high |
| `docs/observability/runbooks/prometheus-target-down.md` | Prometheus scrape target down |
| `docs/observability/runbooks/queue-job-failures.md` | BullMQ job failure rate elevated |

---

## 6. Security Operations

### Row Level Security (RLS)

Every table in Supabase has RLS enabled. 59 tables with policies.

Key policy patterns (from critical-patterns.md):

- **Public-facing VIEWs**: Must use `security_barrier` attribute to prevent predicate pushdown leaking private rows (critical #12).
- **Service-inserted tables**: RLS INSERT policy must be `WITH CHECK (auth.role() = 'service_role')` — never allow anon or authenticated role to insert directly (critical #16).
- **Every new table**: RLS + policies in the same migration file, never a separate migration (critical #18).
- **Counter triggers**: Use `count + 1` not `COALESCE(count, 0) + 1` in trigger functions, and always add `SECURITY DEFINER` (critical #17).

RLS policy column types must match the actual column type — a `uuid` column in a policy filter applied to a `text` column causes a silent policy bypass (common-solutions.md #130). Always run `\d+ table_name` before writing a policy.

### Rate Limiting Tiers

Rate limiting is applied per-IP and per-user-ID. Tiers are defined in `packages/backend/src/middleware/rate-limit.ts`.

| Tier | Applies to | Limit |
|---|---|---|
| Public unauthenticated | `/api/auth/*`, public content endpoints | Strict (low) |
| Authenticated standard | Most authenticated API calls | Moderate |
| Authenticated premium | Creator dashboard, analytics, bulk ops | Higher |
| Webhook | `/api/webhooks/*` | Source-IP allowlist |

Rate limit state is stored in Redis. A Redis failure resets all counters — monitor error rates for the 30 minutes after a Redis restart.

### JWT Lifecycle

- Issued on successful authentication (Supabase or NOSTR flow).
- Access token lifetime: 1 hour (configurable via `JWT_EXPIRY` env var).
- Refresh token: stored in HttpOnly, SameSite=Strict cookie. Rotated on every refresh.
- Revocation: no active revocation list — tokens are stateless. For security incidents, rotate `JWT_SECRET` to invalidate all outstanding tokens globally.
- The middleware validates issuer, expiry, and signature on every request. A 401 means the token is expired, revoked via secret rotation, or tampered.

### Webhook Signature Verification

All inbound webhooks (Lightning payment callbacks, third-party integrations) are verified using HMAC-SHA256.

Implementation in `packages/backend/src/routes/webhooks.ts` and `packages/backend/src/utils/webhook-verify.ts`:

```typescript
import { timingSafeEqual, createHmac } from 'crypto';

function verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean {
  if (!secret) throw new Error('Webhook secret not configured');   // no empty-secret fallback
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const signatureBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);               // never use ===
}
```

Critical rule: Never use `===` for signature comparison — timing-safe comparison is mandatory (critical-patterns.md #19). Never allow an empty `WEBHOOK_SECRET` to pass through as a valid comparison.

### Secret Rotation

Rotation schedule: every 90 days (or immediately after a suspected compromise).

```bash
# Validate current secret configuration
./scripts/validate-deployment-secrets.sh production

# Rotate secrets (updates GitHub Secrets and triggers a re-deploy)
npm run production:rotate
```

Manual rotation steps if `production:rotate` is unavailable:
1. Generate new secret value (use `openssl rand -hex 32` for key-length secrets).
2. Update the secret in GitHub repository Settings → Secrets and variables → Actions.
3. Update in Supabase dashboard (if a Supabase-managed secret).
4. Trigger a new deployment to pick up the new value.
5. Verify health endpoints after deploy.

For JWT secret rotation (invalidates all active sessions — users must re-login):
1. Rotate `JWT_SECRET` in GitHub Secrets.
2. Deploy. All outstanding JWTs become invalid immediately.
3. Monitor Sentry for a spike in 401 errors (expected — users re-authenticate within minutes).

See `docs/deployment/SECRETS_MANAGEMENT.md` for the full secret inventory and rotation procedures.

### Incident Response

Full playbook: `docs/incident-response/INCIDENT_PLAYBOOK.md`

Quick reference:
```
Severity triage:
  P0 — complete outage, data loss, security breach, payment halt → page immediately
  P1 — major feature broken for >20% users, revenue impact possible
  P2 — non-critical degradation, workaround available

Response SLAs:
  P0: 15 min acknowledge, 30 min first update, 60 min cadence, 4 hr resolution target
  P1: 1 hr acknowledge, 2 hr first update, 4 hr cadence, 24 hr resolution target
  P2: 4 hr acknowledge, 8 hr first update, daily updates, 72 hr resolution target

Declaration: post in #incidents Slack
  INCIDENT DECLARED — [P0/P1/P2]
  Summary: <one sentence>
  Affected: <what / who>
  IC: <incident commander>

Mitigation order: rollback > feature flag > hotfix
Escalation: primary on-call → secondary → eng lead → CTO

Post-mortem: within 48 hours for P0, 1 week for P1
Template: docs/incident-response/post-mortems/YYYY-MM-DD-short-title.md
```

Investigation tool order during P0:
1. Sentry — error surface and user impact count
2. Grafana — correlate with system metrics
3. Supabase Dashboard — if error points to persistence layer
4. GitHub Actions / Vercel — if incident followed a recent deployment

---

## 7. Maintenance Procedures

### Dependency Updates

```bash
# Check for vulnerabilities
npm audit

# Auto-fix low and medium severity vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated --workspaces

# Update a specific package across all workspaces
npm update <package-name> --workspaces
```

Dependabot is configured to open PRs for dependency updates automatically. Dependabot branch names (`dependabot/**`) are exempt from the branch naming convention enforced by CI. Review and merge Dependabot PRs within the sprint they are opened — stale dependency PRs accumulate conflicts.

Auto-fix rules for CI dependency failures:
- Low/medium `npm audit` → safe to auto-fix
- HIGH or CRITICAL CVEs → manual review required, never auto-fix
- Container scan failures (`trivy-container`) → require security review before fix

### Database Maintenance

**Point-in-Time Recovery verification** (`docs/deployment/PITR_VERIFICATION.md`):
- PITR must be enabled before an incident occurs. Verify monthly.
- Supabase Dashboard → Project → Settings → Backups → confirm PITR is enabled.
- PITR retention window: 7 days (Pro plan).

**Retention policies:**
- Payment event records: indefinite (financial audit requirement).
- Session records (`unified_sessions`): 90 days rolling TTL (enforced by scheduled DB job).
- Notification records: 30 days rolling TTL.
- Audit log records (`audit_log` table via `AuditLogService`): 1 year.

**Checking for orphaned records** (run after large data operations):
```sql
-- Orphaned content records
SELECT COUNT(*) FROM content c
LEFT JOIN auth.users u ON c.user_id = u.id
WHERE u.id IS NULL;

-- Orphaned payment records
SELECT COUNT(*) FROM payments p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE u.id IS NULL;
```

**Query optimization:**
- All production Supabase queries use paginated accumulation with `PAGE_SIZE = 500` (critical #3). Never issue an unbounded `SELECT *`.
- Slow query identification: Supabase Dashboard → Advisors → Performance.
- Add indexes for columns used in `.eq()` filters on high-traffic queries.
- Use `EXPLAIN ANALYZE` via Supabase SQL editor for query plan inspection.

**Redis key management:**
- Never use `KEYS *` in production — use `SCAN` with cursor iteration (common-solutions.md #120).
- TTLCache (in-memory) for services that cache frequently-read, infrequently-changed data (common-solutions.md #2).

### Log Rotation and Retention

Winston logs are written to stdout and captured by Docker's log driver. Configure the production Docker log driver to ship to a log aggregation service.

```bash
# View live backend logs (production)
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend

# View specific time range
docker compose -f docker-compose.prod.yml logs --since="2026-01-01T00:00:00" backend
```

Log retention: retain 30 days in the log aggregation system. Archive cold logs to object storage (S3 or equivalent) for the 1-year audit period.

### Performance Monitoring

Core Web Vitals targets (frontend):
- LCP (Largest Contentful Paint): < 2.5 s
- FID (First Input Delay): < 100 ms
- CLS (Cumulative Layout Shift): < 0.1

Monitor via Vercel Analytics (automatically collected) and synthetic Lighthouse runs in CI.

Backend latency budget: P99 < 500 ms, P95 < 250 ms, P50 < 100 ms. Alert: `SLOHighLatencyP99` in Grafana.

Runbook for latency spikes: `docs/observability/runbooks/high-latency.md`.

---

## 8. Ways of Working

### Branch Discipline

Full rules: `docs/development/BRANCHING_STRATEGY.md`

Branch naming:
```
{type}/{squad}/{ticket}-{slug}
```

| Segment | Allowed values |
|---|---|
| `type` | `feat`, `fix`, `hotfix`, `chore`, `refactor`, `docs` |
| `squad` | `squad-a` (backend), `squad-b` (frontend), omit for solo/infra |
| `ticket` | Uppercase ticket ID, e.g. `SOV-123` |
| `slug` | Lowercase kebab-case description |

Examples:
- `feat/squad-a/SOV-123-payment-webhooks`
- `fix/squad-b/SOV-456-feed-scroll-position`
- `hotfix/SOV-999-auth-bypass`
- `chore/SOV-100-update-dependencies`

Rules:
- One branch per epic. Multi-epic branches produce 3x more review findings.
- Branch lifetime: 1–3 days max. Break larger features into stacked PRs.
- Never push directly to `main`. All merges go through the merge queue.
- Verify branch with `git branch --show-current` as the **first action** of every session.

### Commit Conventions

Conventional Commits are mandatory. CI validates the format.

```
<type>: <description>

[optional body]

[optional footer — include ticket reference]
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

Every commit must:
- Include a `CHANGELOG.md` update
- Include documentation updates if adding/changing user-facing behavior
- Pass pre-commit hooks: lint, format, type-check, unit tests
- Reference the ticket in the footer: `Refs: SOV-123`

CI fix commits (auto-repaired by Claude Code):
```
fix(ci): resolve ESLint no-unused-vars in UserService

Auto-repaired by Claude Code
Run: https://github.com/org/repo/actions/runs/12345
Error: 'token' is assigned a value but never used (line 142)
```

### PR Process

1. Push branch and open PR targeting `main`:
   ```bash
   gh pr create --title "feat(SOV-123): Payment webhook processing" --body "..."
   ```
2. CI runs automatically (lint → security → test → build).
3. CODEOWNERS auto-assigns reviewer from the relevant squad.
4. 1 approving review required (CODEOWNERS-compliant).
5. Developer clicks "Merge when ready" (or `gh pr merge --auto --squash`).
6. Merge queue re-runs CI against `main` + queued PRs.
7. All checks pass → squash merge to `main`. Head branch auto-deleted.

AI-authored PRs (Claude Code):
- Always require a human reviewer from the relevant squad (CODEOWNERS enforced).
- `require_last_push_approval: true` — no self-approval.

### Code Review: Multi-Agent Analysis

For substantive changes, run the Compound Engineering review workflow:

```
/workflows:review
```

This spawns 13+ parallel review agents covering: security, correctness, performance, TypeScript, testing coverage, accessibility, RLS policies, payment safety, and more. Findings are written to `todos/` as a triage list.

Review findings are classified P1 (blocker), P2 (should-fix), P3 (nice-to-have). Fix all P1s before merge. P2s should be resolved within the sprint. P3s can be deferred to backlog.

Review consensus rule: if 6 or more review agents independently flag the same issue, it is a confirmed true positive regardless of how subtle it appears.

### Compound Engineering Loop

All non-trivial work follows the CE loop:

```
Plan → Work → Review → Compound
  ↑                        ↓
  └── knowledge feeds back ─┘
```

| Phase | Command | Effort |
|---|---|---|
| Plan | `/workflows:plan` | ~40% — research, spec, structured plan → `docs/plans/` |
| Work | `/workflows:work` | ~20% — execute the plan, follow patterns |
| Review | `/workflows:review` | ~40% — 13+ parallel agents, findings → `todos/` |
| Compound | `/workflows:compound` | Quick — document solution → `docs/solutions/`, cross-reference patterns |

Simple tasks (< 10 lines, 1 file): lightweight loop — plan in head → implement → quick review.

### Pattern Files

The two canonical pattern files are the single source of truth for this codebase. Read the relevant section before writing any service, route, or financial code.

| File | Contents | When to read |
|---|---|---|
| `docs/solutions/patterns/critical-patterns.md` | 22 P1-class patterns (TOCTOU, auth, pagination, atomic writes, SSRF, etc.) | Before writing services, routes, or financial code |
| `docs/solutions/patterns/common-solutions.md` | 133+ P2/P3 patterns indexed by number | Reference specific sections by number as needed |

After completing a sprint and running `/workflows:compound`, cross-reference the new compound doc against the pattern files and update them if new or refined patterns were discovered.

---

## 9. Troubleshooting

### Common Issues

**Tests fail with "Cannot find module '@shared/types/…'"**
- Run `npm install` from the repo root. npm workspaces symlinks are not set up.
- Verify `packages/shared/` has been built: `npm run build --workspace=packages/shared`.

**Integration tests fail on first run**
- Docker must be running. Start Docker Desktop.
- If Ryuk connectivity error: `export TESTCONTAINERS_RYUK_DISABLED=true`.
- First run downloads ~150 MB of images — allow time.

**`supabase db push` fails with "relation already exists"**
- A migration was applied manually and is now out of sync with the migration history table.
- Run `supabase migration list` to see the discrepancy. Add a repair entry or squash the conflicting migration.

**401 errors on all API calls after a deploy**
- `JWT_SECRET` may have been rotated. Users need to re-authenticate. Verify in Sentry — if all 401s started at the same deploy timestamp, it is the secret rotation.

**NOSTR event verification fails ("invalid signature")**
- Ensure `getEventHash(UnsignedEvent)` is called before `verifyEvent`. Missing the hash step is the most common NOSTR bug (critical #9).

**Payment webhook returns 401**
- Verify `WEBHOOK_SECRET` is set and matches the Lightning node's configured secret.
- Check that the raw request body (before JSON parsing) is used for HMAC computation — `express.raw()` middleware must be applied to webhook routes before `express.json()`.

**E2E tests fail with "strict mode violation" (Playwright)**
- A locator matches multiple elements. Add `.first()` in the POM constructor for the offending locator.

**Build fails with "chunk too large" warning treated as error**
- A dependency was added that exceeds the 250 KB bundle limit for a chunk. Audit with `npm run build -- --reporter=verbose` and add the heavy dependency to a manual chunk split in `vite.config.ts`.

### How to Read CI Failures

```bash
# List recent runs with status
gh run list --limit 10 --json databaseId,displayTitle,status,conclusion,workflowName,headBranch

# Watch a run live
gh run watch <run-id> --exit-status

# View only failed step logs (fastest diagnosis)
gh run view <run-id> --log-failed

# Re-run only failed jobs (preserves passing jobs)
gh run rerun <run-id> --failed
```

Failure format emitted by CLAUDE.md CI monitoring protocol:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Pipeline Failed — CI on feat/squad-a/SOV-123-foo
   Run: #12345 | Duration: 4m12s | Triggered by: fp
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Failed Job:  test-integration
Failed Step: Run integration tests
Error:       Cannot connect to Docker daemon
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Diagnosis:   testcontainers cannot reach Docker — runner has no Docker daemon
Suggested:   Add `services: docker` to the integration test job in ci.yml
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

CI auto-fix rules (from CLAUDE.md):
- Safe to auto-fix: ESLint, Prettier, `npm audit` low/medium, missing chmod +x, import paths.
- Fix and notify: failing unit tests (fix source), coverage failures (add real tests).
- Never auto-fix: production deployment failures, HIGH/CRITICAL CVEs, DB migration failures, trivy container scan failures.

### How to Debug Production Issues

1. **Check health endpoints first:**
   ```bash
   curl -f https://api.sovren.dev/health
   curl -f https://api.sovren.dev/ready
   ```

2. **Correlate deployment timeline:** Check GitHub Actions for recent deployments. If the incident started within 10 minutes of a deploy, rollback is the first mitigation.

3. **Sentry:** Filter by environment=production, time window matching the incident. Note the error count and affected users.

4. **Grafana:** Open the API error rate panel. Look for a step-change in error rate. Drill into the route label to identify which endpoint is failing.

5. **Backend logs:** Filter by `requestId` for a specific user's failed request. Correlation IDs thread through all log lines for a given request.
   ```bash
   docker compose -f docker-compose.prod.yml logs backend | grep '"requestId":"<id>"'
   ```

6. **Supabase Dashboard:** Check connection pool usage, slow queries, and row-level logs if the error is in the persistence layer.

7. **Payment-specific debugging:** See `docs/troubleshooting/PAYMENT_DEBUGGING_COMMANDS.md` and `docs/troubleshooting/PAYMENT_FAQ.md`.

### Escalation Paths

```
Detection
  ↓
On-Call Engineer (Primary)
  ↓ (not acknowledged in SLA, or IC requests resources)
Secondary On-Call
  ↓ (P0 approaching 2hr without mitigation)
Engineering Lead
  ↓ (data breach, legal exposure, or P0 at 4hr)
CTO / Founders
```

Post-mortems: P0 within 48 hours, P1 within 1 week. Template: `docs/incident-response/post-mortems/YYYY-MM-DD-short-title.md`.

Additional troubleshooting guides:
- `docs/troubleshooting/PAYMENT_TROUBLESHOOTING_GUIDE.md` — Lightning and webhook issues
- `docs/troubleshooting/PAYMENT_FAQ.md` — common payment questions
- `docs/troubleshooting/integration-issues-resolved.md` — previously resolved integration issues
- `docs/deployment/DEPLOYMENT_TROUBLESHOOTING.md` — CI/CD and deploy issues
- `docs/deployment/DATABASE_POOLING.md` — Supabase connection pool tuning
- `docs/deployment/secrets-troubleshooting.md` — secret configuration issues

---

## 10. Agent-Specific Guidance

### Onboarding Sequence

Read these files in order before writing any code:

| Priority | File | Tokens | When |
|---|---|---|---|
| P0 | `docs/PROJECT_CONTEXT.md` | ~2,500 | Always — first file, every session |
| P1 | `docs/solutions/patterns/critical-patterns.md` | ~7,000 | Before writing services, routes, or financial code |
| P2 | `docs/solutions/patterns/common-solutions.md` | ~30,000 | Reference specific sections by number only |
| P3 | `CLAUDE.md` | ~8,750 | Full onboarding or unfamiliar areas |

Do NOT load `common-solutions.md` in full. Use the index table at the end of the file to identify the section number for your task, then read only that section.

### First Action Every Session

```bash
git branch --show-current
```

This is the mandatory first action. Verify the output matches the task's expected branch. If you are on the wrong branch, `git checkout {correct-branch}` before reading a single file. Never start reading code for a new task while still on the previous task's branch.

### Required Reading Before Starting Work

For any task involving services, routes, repositories, or financial code, read:
- `docs/solutions/patterns/critical-patterns.md` — full file (~7,000 tokens)

For frontend tasks:
- Common-solutions.md sections: #1 (double-submit), #81 (blob download), #82 (loading state), #85 (optimistic delete), #88 (ARIA)

For backend tasks:
- Common-solutions.md sections: #2 (TTLCache), #4 (error format), #13 (Promise.allSettled), #121 (asyncHandler), #122 (route DB clients)

For CI/infrastructure tasks:
- Common-solutions.md sections: #68 (env indirection), #69 (fan-in aggregator), #129 (CI bootstrap parity)

For testing tasks:
- Common-solutions.md sections: #7 (Supabase mock chain), #26 (E2E no mocks), #50 (real services), #113 (POM locators), #114 (auth E2E assertions)

### Branch Discipline for Agents

- Always verify branch before starting: `git branch --show-current`
- Create new branch from `main` if none exists: `git checkout -b {type}/{squad}/{ticket}-{slug} main`
- Never commit to `main` directly — hooks hard-block this.
- Never use `--admin` bypass except for hotfixes (see `docs/development/HOTFIX_PROCEDURE.md`).
- Merge via: `gh pr merge --auto --squash` (enters merge queue — never force merge).
- After `git push` or `gh pr create`: `/watch-ci` is mandatory before any further Bash commands (enforced by `security-gate-bash.sh` hook).

### Stale Todo Detection

Before implementing any todo from `todos/`, verify it against the current source. Todo descriptions go stale across sprints. The rule: triage before implementing. 40% of findings in `todos/` are typically resolved without writing code (common-solutions.md #25).

Check whether the described issue still exists in the current code before writing a fix. If the fix is already in place, mark the todo as resolved with a note.

### Severity Triage Before Remediation

When assigned a batch of review findings, reclassify inflated P1s to P2 before assigning work. A P1 finding in a test file is not a production P1. Check the file path, the blast radius, and whether a compensating control already exists.

### Domain-Grouped Parallel Agents (Zero Merge Conflicts)

When spawning a team for multi-file work, group agents by non-overlapping file ownership:

- Agent A owns `packages/backend/` — never touches `packages/frontend/`
- Agent B owns `packages/frontend/` — never touches `packages/backend/`
- Shared types (`packages/shared/`) ship in a separate PR first (Interface-First PR pattern)

This pattern has produced zero merge conflicts across 8+ consecutive sprints (common-solutions.md #125).

### Tools Available to Agents

| Tool | Purpose | How to invoke |
|---|---|---|
| Supabase MCP | Execute SQL, inspect schema, apply migrations | MCP server `mcp__claude_ai_Supabase__*` |
| Vercel MCP | Check deployment status, view logs | MCP server `mcp__claude_ai_Vercel__*` |
| GitHub CLI | PR management, CI monitoring, secret updates | `gh` in Bash tool |
| Playwright | E2E test verification | `npm run test:e2e` via Bash tool |
| Vitest | Unit and integration tests | `npm test` or `npx vitest run path/to/file.ts` |

### CE Workflow Commands

| Command | When to use |
|---|---|
| `/workflows:plan` | Before writing any non-trivial code — research, spec, create plan in `docs/plans/` |
| `/workflows:work` | Execute an existing plan in `docs/plans/` — follow patterns, do not redesign |
| `/workflows:review` | After implementation — spawns 13+ parallel review agents |
| `/workflows:compound` | After sprint completion — documents learnings into `docs/solutions/` |
| `/team-builder minimal` | Small features, single-domain, prototypes |
| `/team-builder standard` | Multi-domain features, new endpoints + frontend |
| `/team-builder enterprise` | Auth, payments, user data, DB schema, production deploys |

### What Not to Do

These are the top 10 patterns that produce P1 review findings on every sprint. Do not do them:

| Anti-pattern | Correct alternative | Critical pattern ref |
|---|---|---|
| Read-then-write without atomic guard | Insert-then-verify or `UPDATE WHERE` | Critical #1 |
| Trust route-level auth alone | Add service-layer ownership check on every data access | Critical #2 |
| `SELECT *` without LIMIT or pagination | Paginated accumulation, PAGE_SIZE=500 | Critical #3 |
| Two inserts without a transaction | Supabase RPC or compensating transaction | Critical #4 |
| Fetch user-supplied URL without SSRF check | `validateSsrfUrl()` + DNS pinning | Critical #6 |
| `DELETE` without status guard | Assert status first + check returned count | Critical #7 |
| `id: ''` in NOSTR events | `getEventHash(UnsignedEvent)` first | Critical #9 |
| Duplicate string across packages | Extract to `@shared/` | Critical #10 |
| `page.route()` in E2E tests | Use real API; mock only in Vitest unit tests | Common #26 |
| `|| true` after test commands in hooks | Let errors propagate; fix the root cause | Common #18 |

---

## Quick Reference

```bash
# Start dev
npm install && npm run dev

# Run all tests
npm test

# Quality check
npm run quality:check

# Watch CI
gh run list --limit 5 --workflow=ci.yml
gh run watch <id> --exit-status
gh run view <id> --log-failed

# Merge
gh pr merge --auto --squash

# Health check
curl https://api.sovren.dev/health
curl https://api.sovren.dev/ready

# Monitoring stack
docker compose -f docker-compose.dev.yml --profile monitoring up -d
# Grafana: http://localhost:3002

# DB migrations
supabase db push --linked

# Rollback frontend
npx vercel promote <deployment-url> --scope <team>

# Rollback backend
docker compose -f docker-compose.prod.yml up -d backend  # after updating image tag in compose file
```

---

*Last updated: 2026-03-26. Maintained by the Sovren engineering team. If you find a gap, open a PR against this file following the standard PR process.*
