# Sovren — Project Context (Distilled)

> **Purpose**: Fastest path to expertise for new agents/engineers. ~2,500 tokens vs ~51,250 for full docs.
> **Not a replacement** for CLAUDE.md or pattern files — this is a prioritized index with pointers.

---

## 1. Project Identity

**Sovren** is a decentralized creator monetization platform on NOSTR + Bitcoin Lightning Network.
Creators own their content, audience, and revenue. No intermediaries.

| Layer     | Stack                                                    |
| --------- | -------------------------------------------------------- |
| Frontend  | React 18 + TypeScript 5.3 + Vite + TailwindCSS           |
| Backend   | Node.js + Express + TypeScript                           |
| State     | Redux Toolkit + React Query (TanStack Query)             |
| Database  | Supabase (PostgreSQL + Auth + Realtime)                  |
| Protocols | NOSTR (nostr-tools), Lightning Network (BOLT11, WebLN)   |
| Testing   | Vitest + React Testing Library + Playwright              |
| Deploy    | Vercel (frontend), Docker (backend), GitHub Actions (CI) |
| Monorepo  | npm workspaces                                           |

---

## 2. Before You Write Code

### Branch Discipline (MANDATORY)

1. `git branch --show-current` — **first action every session**
2. Check squad assignments in `~/.claude/projects/-Users-fp/memory/MEMORY.md`
3. Branch naming: `{type}/{squad}/{ticket}-{slug}` (e.g., `feat/squad-a/SOV-123-payment-webhooks`)
4. Merge: `gh pr merge --auto --squash` — never push directly to main
5. Full rules: `docs/development/BRANCHING_STRATEGY.md`

### Required Reading (by priority)

| Priority | File                                           | Tokens  | When                                               |
| -------- | ---------------------------------------------- | ------- | -------------------------------------------------- |
| P0       | This file                                      | ~2,500  | Always                                             |
| P1       | `docs/solutions/patterns/critical-patterns.md` | ~7,000  | Before writing services, routes, or financial code |
| P2       | `docs/solutions/patterns/common-solutions.md`  | ~30,000 | Reference specific sections by number as needed    |
| P3       | `CLAUDE.md`                                    | ~8,750  | Full onboarding or unfamiliar areas                |

**Tip**: For common-solutions.md, read only the section relevant to your task (use the index table at the end of the file).

---

## 3. Architecture Quick Reference

### Monorepo Layout

```
packages/
├── frontend/          # React app (feature-based architecture)
├── backend/           # Node.js Express API server
├── shared/            # Shared types, utilities, configs
└── testing/           # Shared testing utilities
```

### Backend: `packages/backend/src/`

```
routes/       → API endpoints (Express routers)
  auth.ts, users.ts, content-discovery.ts, lightning.ts, webhooks.ts,
  subscription-tiers.ts, nip05.ts, health.ts, sessions.ts, admin/
services/     → Business logic
  finance/, payment/, lightning/, community/, content/, distribution/,
  nostr-auth.ts, CacheService.ts, EventBusService.ts, AuditLogService.ts
repositories/ → Data access layer (Supabase queries)
middleware/   → auth.ts, rate-limit, csrf, validation, error-handler, correlation-id
```

**Flow**: Route → Middleware → Service → Repository → Supabase

### Frontend: `packages/frontend/src/`

```
pages/        → Route-level components (Home, Login, Signup, Profile, Post, CreatorDashboard)
features/     → Domain modules (self-contained with components/services/types)
  auth, content, payments, subscriptions, analytics, dashboard, discovery,
  wellness, nostr, multi-platform, creator-network, ai, supporter, business
components/ui → Generic reusable UI components
hooks/        → Shared React hooks
services/     → API clients, external integrations
store/        → Redux store (slices by feature)
```

**Path aliases**: `@/` → `src/`, `@components/`, `@pages/`, `@hooks/`, `@services/`, `@types/`, `@utils/`, `@store/`

### Shared: `packages/shared/src/types/`

```
community.ts, discovery.ts, distribution.ts, finance.ts, user.ts,
wellness.ts, nostr.ts, nostr/, payment-state.ts, provenance.ts,
quality-metrics.ts, api-handlers.ts
```

Import as: `import { Type } from '@shared/types/module'`

### Database (Supabase)

**Core tables**: users, content, payments, followers, comments, content_analytics
**Financial**: payment_events, payment_retry_attempts, payment_lock_events, webhook_events
**Creator**: creator_circles, circle_members, mentor_profiles, service_listings, service_orders
**Business**: business_invoices, expenses, revenue_entries, contracts, diversification_goals
**Platform**: unified_sessions, platform_connections, cross_posts, repurposed_content

Migrations: `supabase/migrations/` (baseline + incremental)

---

## 4. Critical Patterns Index

**Full details**: `docs/solutions/patterns/critical-patterns.md`

| #   | Pattern                        | When to Use                                            | HTTP |
| --- | ------------------------------ | ------------------------------------------------------ | ---- |
| 1   | TOCTOU Race Conditions         | Aggregate caps, status transitions, scarce resources   | 409  |
| 1a  | Insert-then-verify             | Enforcing member/slot counts                           | 409  |
| 1b  | Accept-then-verify-or-revert   | Status change + capacity check                         | 409  |
| 1c  | Atomic claim (UPDATE WHERE)    | Tickets, slots, listings                               | 409  |
| 2   | Service-layer authorization    | Every data access method                               | 403  |
| 3   | Paginated accumulation         | Any unbounded SELECT (PAGE_SIZE=500)                   | —    |
| 4   | Non-atomic multi-table writes  | 2+ table writes → RPC or compensating tx               | 500  |
| 4c  | DB + Queue compensation        | Enqueue fails mid-loop → mark failed rows              | 500  |
| 5   | Payment persistence            | Atomic write, write mutex, persist-then-mutate         | —    |
| 6   | SSRF validation                | User-supplied URLs → DNS resolve + IP check + pin      | 400  |
| 7   | Status guards                  | DELETE/void/cancel → assert status first + check count | 409  |
| 8   | Test infra integration         | New test type → CI gate + brief + CLAUDE.md            | —    |
| 9   | NOSTR verifyEvent              | Always `getEventHash(UnsignedEvent)` first             | —    |
| 10  | Cross-pkg string dedup         | Same string in 3+ files → extract to `@shared/`        | —    |
| 11  | PostgREST filter escape        | User text in `.or()` → escape `\` first, then metachar | 400  |
| 12  | VIEW security_barrier          | Public-facing PostgreSQL VIEWs                         | —    |
| 13  | Route boundary UUID validation | Every `:id` route param → Zod `safeParse` first        | 400  |
| 14  | Avatar/image URL whitelist     | User-supplied URLs in `<img src>` → `https?` only      | —    |
| 15  | Cross-content parent guard     | Threaded data parent lookup → scope to content context | 404  |

### Top Common Solutions (by recurrence)

**Full details**: `docs/solutions/patterns/common-solutions.md` — reference by number.

| #   | Pattern                                            | Category   |
| --- | -------------------------------------------------- | ---------- |
| 1   | Double-submit prevention (useRef + disabled)       | Frontend   |
| 2   | TTLCache for in-memory Maps                        | Backend    |
| 3   | Environment variable validation (Zod)              | Infra      |
| 4   | Error response format (createApiResponse)          | Backend    |
| 7   | Supabase mock chain pattern                        | Testing    |
| 13  | Promise.allSettled for batch operations            | Backend    |
| 15  | Task hooks must NOT run full quality gates         | DevOps     |
| 16  | Security-critical file mapping                     | Testing    |
| 17  | Hook migration checklist                           | DevOps     |
| 25  | Stale todo detection — triage before implementing  | Process    |
| 26  | E2E tests must not mock API calls                  | Testing    |
| 50  | Real services > vi.fn() for integration tests      | Testing    |
| 62  | Per-package tsc in monorepos                       | TypeScript |
| 68  | env: indirection for ${{ }} injection prevention   | CI/CD      |
| 69  | Fan-in aggregator job for branch protection        | CI/CD      |
| 81  | Blob download via apiClient (never relative fetch) | Frontend   |
| 82  | Loading state must not hide structural UI          | Frontend   |
| 85  | Optimistic delete multi-page cache snapshot        | Frontend   |
| 86  | Soft-delete enum — only written values             | Backend    |
| 87  | DOMPurify no-op in Node.js without jsdom           | Security   |
| 88  | Dialog aria-labelledby per-instance IDs            | A11y       |

---

## 5. Commands Cheatsheet

```bash
# Dev
npm install                        # Install all workspace deps
npm run dev                        # Frontend dev server (port 3000)
npm run build                      # Production build

# Test
npm test                           # All tests
npm run test:unit                  # Unit tests (backend + frontend + shared)
npm run test:integration           # Integration (requires Docker)
npm run test:e2e                   # Playwright E2E
npm run test:security              # Security tests
npx vitest run path/to/file.ts     # Single file

# Quality
npm run lint                       # ESLint
npm run lint:fix                   # ESLint auto-fix
npm run format                     # Prettier
npm run type-check                 # TypeScript
npm run quality:check              # All quality checks

# CI/CD
gh run list --workflow=ci.yml --limit 5   # CI status
gh run watch <id> --exit-status           # Watch run live
gh run view <id> --log-failed             # Failed step logs
gh pr merge --auto --squash               # Merge via auto-merge
```

---

## 6. Domain Guides Index

### Backend Development

| File                                          | What it covers                       |
| --------------------------------------------- | ------------------------------------ |
| `packages/backend/src/routes/index.ts`        | Route registration and ordering      |
| `packages/backend/src/middleware/auth.ts`     | Auth middleware (NOSTR + Supabase)   |
| `packages/backend/src/services/nostr-auth.ts` | NOSTR event verification             |
| `packages/backend/src/services/finance/`      | Payment, invoicing, revenue services |
| `packages/backend/src/services/payment/`      | Payment processing pipeline          |

### Frontend Development

| File                                     | What it covers                             |
| ---------------------------------------- | ------------------------------------------ |
| `packages/frontend/src/features/`        | Feature module pattern (barrel exports)    |
| `packages/frontend/src/store/`           | Redux slices by feature                    |
| `packages/frontend/src/services/`        | API client layer                           |
| `packages/frontend/e2e/`                 | Playwright E2E (POM pattern)               |
| `packages/frontend/playwright.config.ts` | 3-tier test config (setup → auth → public) |

### DevOps / Infrastructure

| File                                     | What it covers                               |
| ---------------------------------------- | -------------------------------------------- |
| `.github/workflows/ci.yml`               | CI pipeline (lint, test, build, E2E, deploy) |
| `docker-compose.dev.yml`                 | Local backend development                    |
| `docs/development/BRANCHING_STRATEGY.md` | Branch naming, merge queue, squads           |
| `docs/deployment/DEPLOYMENT_GUIDE.md`    | Full deployment procedures                   |
| `supabase/migrations/`                   | Database schema evolution                    |

---

## 7. Conventions

### Git

- **Commits**: Conventional Commits — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`
- **Branches**: `{type}/{squad}/{ticket}-{slug}` — one epic per branch, 1-3 day max
- **PRs**: Squash merge only, 1 reviewer required, auto-delete head branches
- **Shared packages**: Separate PR before consumer changes

### TypeScript

- `strict: true` — eliminate all `any` types
- Prefer interfaces over types for object shapes
- Barrel exports (`index.ts`) for feature modules
- Import path: `@shared/types/module` for cross-package types
- `import { Enum }` not `import type { Enum }` for runtime enum values (esbuild strips `import type`)

### Testing (Vitest — NOT Jest)

- **Framework**: Vitest with `vi.fn()`, `vi.mock()`, `vi.spyOn()` (not `jest.*`)
- **Coverage**: 95% for services/repositories/store, 85% global
- **E2E**: Playwright with Page Object Model, zero `page.route()` mocks
- **E2E naming**: `*.auth.spec.ts` (needs auth), `*.public.spec.ts` (no auth)
- **Workers**: Cap `maxForks: 2` to prevent OOM on <32GB machines
- **Mock factories**: Use `vi.hoisted()` for class declarations; `vi.importActual()` returns Promise

### E2E Testing

- Page Objects in `e2e/pages/{page}.page.ts`
- Role-based locators, never CSS selectors
- `.first()` on locators matching multiple elements
- Credentials from `e2e/fixtures/test-credentials.ts` — never hardcode
- Auth via storage state (3-tier config: setup → authenticated → public)

---

## 8. Anti-Patterns (Top 10 P1 Producers)

| #   | Don't                                      | Instead                                | Pattern Ref                        |
| --- | ------------------------------------------ | -------------------------------------- | ---------------------------------- | ---------------------------------------- | ---------- |
| 1   | Read-then-write without atomic guard       | Insert-then-verify or UPDATE WHERE     | Critical #1                        |
| 2   | Trust route-level auth alone               | Add service-layer ownership check      | Critical #2                        |
| 3   | SELECT \* without LIMIT/pagination         | Paginated accumulation (PAGE_SIZE=500) | Critical #3                        |
| 4   | Two inserts without transaction            | Supabase RPC or compensating tx        | Critical #4                        |
| 5   | Fetch user-supplied URL without SSRF check | validateSsrfUrl() + DNS pinning        | Critical #6                        |
| 6   | DELETE without status guard                | Assert status + check returned count   | Critical #7                        |
| 7   | `id: ''` in NOSTR events                   | `getEventHash(UnsignedEvent)`          | Critical #9                        |
| 8   | Copy string across packages                | Extract to `@shared/`                  | Critical #10                       |
| 9   | `page.route()` in E2E tests                | Use real API; mock only in Vitest      | Common #26                         |
| 10  | `                                          |                                        | true` after test commands in hooks | Let errors propagate; fix the root cause | Common #18 |
