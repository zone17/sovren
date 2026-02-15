# Architecture Assessment: Sovren v2.0 Cutting-Edge Readiness

**Assessor**: Principal Architecture Analyst
**Date**: 2026-02-12
**Scope**: Full codebase assessment against 2025-2026 best practices, with v2.0 refactoring roadmap
**Codebase snapshot**: React 18.3.1, Vite 5.4, Jest 29, Redux Toolkit 2.1, Express 4.18, TypeScript 5.3, Supabase, npm workspaces

---

## 1. Current Architecture Scorecard

| Area | Score | Rating | Notes |
|------|-------|--------|-------|
| Frontend framework & rendering | 3/5 | Adequate | React 18.3.1 is one major behind (React 19 stable since Dec 2024) |
| Build tooling | 4/5 | Good | Vite 5.4 is solid; Vite 6 with Rolldown is the new target |
| State management | 3/5 | Adequate | Redux Toolkit + React Query is functional but heavy for the app's needs |
| API layer | 2/5 | Behind | REST with no shared type contract between frontend/backend in a TS monorepo |
| Backend architecture | 3.5/5 | Good- | Custom DI, Express, layered services -- works but showing age |
| Database & data layer | 3.5/5 | Good- | Supabase + RLS is solid; raw SQL migrations lack tooling |
| Real-time capabilities | 3/5 | Adequate | Supabase Realtime + ws available; no unified strategy |
| Job queue / background processing | 1/5 | Missing | No job queue installed despite ioredis being present |
| DI / service architecture | 3/5 | Adequate | Custom ServiceToken pattern works; 29 services need to grow to 50+ |
| Testing framework | 2.5/5 | Behind | Jest 29 with ts-jest; backend partially using Vitest for integration |
| Monorepo tooling | 2/5 | Behind | npm workspaces only; no task caching, no dependency graph awareness |
| Protocol integrations (NOSTR, Lightning) | 3.5/5 | Good- | nostr-tools 2.13 (latest 2.23); solid NIP coverage |
| CI/CD & deployment | 4/5 | Good | 100% automation, blue-green, rollback; mature pipeline |
| Security architecture | 3/5 | Adequate | RLS, helmet, rate-limiting; P1 issues identified in prior review |
| CSS/UI framework | 3/5 | Adequate | Tailwind 3.4 + Radix UI; Tailwind v4 is a ground-up rewrite available |
| Linting & code quality | 2.5/5 | Behind | ESLint 8 with legacy config; ESLint 9+ with flat config is the standard |

**Overall: 2.9/5 -- Adequate but aging.** The codebase is functional and well-structured but relies on several frameworks that are one major version behind the cutting edge. The biggest gaps are the missing job queue, lack of type-safe API layer, and outdated testing/linting tooling.

---

## 2. Upgrade Recommendations (Prioritized)

### 2.1 [P0] Job Queue Infrastructure -- BullMQ or Inngest

**Current state**: No job queue. ioredis is installed but unused for queuing. Scheduled/background work has no infrastructure.

**Recommended target**: BullMQ 5.x (pragmatic, Redis-based, proven) OR Inngest (event-driven, zero-infrastructure)

**Why BullMQ**: Already have ioredis, minimal new infrastructure, battle-tested for queuing semantics (retry, dead letter, scheduling, priorities). The entire v2.0 depends on this -- cross-platform publishing, content scanning, forecast batch jobs, overdue invoice notifications.

**Why consider Inngest instead**: Inngest eliminates the need to manage Redis queues and workers. It provides durable functions triggered by events, automatic retries, and a dashboard out of the box. For a team that values developer velocity over infrastructure control, Inngest is the modern choice. However, it adds an external dependency (SaaS or self-hosted).

**Migration effort**: 8-12 hours (BullMQ setup, worker process, Docker Compose integration, Bull Board monitoring)

**Risk**: Low (additive, no existing code changes)

**Timing**: BEFORE v2.0 -- blocks EPIC-008 (content scanning), EPIC-009 (cross-platform publishing), EPIC-012 (forecast batch jobs)

**Concrete steps**:
1. Install `bullmq` in `packages/backend`
2. Configure separate Redis DB or namespace for BullMQ (avoid collision with cache)
3. Create `packages/backend/src/jobs/` directory with worker setup
4. Add Bull Board at `/admin/queues` (behind auth)
5. Integrate worker lifecycle into Docker Compose (`docker-compose.dev.yml`)
6. Register `JobQueueService` in DI container
7. Add health check for queue worker process

---

### 2.2 [P0] Type-Safe API Layer -- tRPC or Shared Zod Contracts

**Current state**: REST endpoints with separate Zod schemas in backend, separate TypeScript types in frontend. No compile-time guarantee that frontend API calls match backend contracts. Changes to API shapes are caught at runtime, not build time.

**Recommended target**: tRPC v11 (end-to-end type safety, zero code generation)

**Why tRPC**: This is a TypeScript monorepo with shared packages -- the exact use case tRPC was built for. tRPC provides:
- Automatic type inference from backend procedures to frontend calls
- No API schema to maintain separately
- Works with existing Express via `@trpc/server/adapters/express`
- Integrates with TanStack Query (already installed)
- Can coexist with existing REST routes during migration

**Alternative**: If tRPC adoption is too disruptive, create a `@sovren/api-contracts` package in shared with Zod schemas that are imported by both frontend and backend. This gives compile-time safety without changing the API protocol.

**Migration effort**: 16-24 hours for tRPC adoption (new v2 routes only); 8-12 hours for shared Zod contracts approach

**Risk**: Medium (tRPC changes how APIs are consumed; gradual migration recommended)

**Timing**: BEFORE v2.0 -- all 6 new domains benefit from type-safe APIs from day one

**Concrete steps (tRPC)**:
1. Install `@trpc/server`, `@trpc/client`, `@trpc/react-query` in respective packages
2. Create `packages/backend/src/trpc/` with router setup, context, middleware
3. Mount tRPC adapter alongside existing Express routes at `/api/trpc`
4. Build v2 domain routers: `wellnessRouter`, `shieldRouter`, `distributionRouter`, etc.
5. Export router type from backend package
6. Create tRPC client in frontend using existing TanStack Query setup
7. Existing v1 REST routes remain untouched; new v2 routes use tRPC

**Concrete steps (shared contracts)**:
1. Create Zod schemas in `packages/shared/src/contracts/`
2. Export request/response types with `z.infer<>`
3. Import schemas in both backend (validation) and frontend (type safety)
4. Add build-time check that frontend API calls use correct contract types

---

### 2.3 [P0] ESLint 9+ with Flat Config

**Current state**: ESLint 8.56 with legacy `.eslintrc` configuration. `@typescript-eslint/eslint-plugin` v6.21 (root/frontend/shared) and v8.37 (backend -- inconsistent). ESLint 8 is deprecated; ESLint 10 RC is out and will remove `.eslintrc` support entirely.

**Recommended target**: ESLint 9.x with flat config (`eslint.config.js`), `typescript-eslint` v8 unified package

**Migration effort**: 6-8 hours

**Risk**: Low (tooling change, no code logic changes)

**Timing**: BEFORE v2.0 -- prevents accumulating config debt across 6 new feature domains

**Concrete steps**:
1. Run ESLint's migration tool: `npx @eslint/migrate-config .eslintrc.js`
2. Replace `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` with unified `typescript-eslint` v8
3. Convert to `eslint.config.js` with `defineConfig()` and `extends`
4. Consolidate root/frontend/backend/shared ESLint configs
5. Remove deprecated plugins (`eslint-plugin-prettier` -- use Prettier separately)
6. Verify CI/CD passes with new config

---

### 2.4 [P1] React 18 -> React 19

**Current state**: React 18.3.1 + React DOM 18.3.1. The project already uses TanStack Query for async data, React Router v6 for routing, and Redux Toolkit for state.

**Recommended target**: React 19 (stable since December 2024)

**Key benefits for Sovren v2.0**:
- **Actions**: First-class support for async mutations (form submissions, server mutations) with automatic pending/success/error states. Directly benefits Business Manager (invoices, contracts) and Creator Network (marketplace orders).
- **React Compiler**: Automatic memoization eliminates need for manual `useMemo`, `useCallback`, `memo`. Reduces boilerplate across 12+ feature modules.
- **`use()` hook**: Simplifies async data loading patterns.
- **Document metadata**: Native `<title>`, `<meta>`, `<link>` support without react-helmet.
- **Improved `ref` handling**: `forwardRef` no longer needed -- cleaner component APIs.

**Migration effort**: 8-12 hours

**Risk**: Low-Medium. React 19 maintains backward compatibility. Codemods handle `forwardRef` removal and Context API changes. The biggest risk is third-party library compatibility (check: Radix UI, Framer Motion, Recharts, TipTap, react-beautiful-dnd).

**Timing**: BEFORE v2.0 -- new feature modules should be written with React 19 patterns from the start

**Concrete steps**:
1. Upgrade to React 18.3 first (if not already) to surface deprecation warnings
2. Run React codemod: `npx codemod@latest react/19/migration-recipe`
3. Update `react`, `react-dom` to ^19.0.0
4. Update `@types/react`, `@types/react-dom` to ^19.0.0
5. Verify Radix UI, Framer Motion, TipTap, Recharts compatibility (all support React 19 as of early 2025)
6. Remove `react-beautiful-dnd` (unmaintained, replace with `@hello-pangea/dnd` or `dnd-kit`)
7. Remove manual `forwardRef` wrappers, simplify `memo` usage
8. Update testing library: `@testing-library/react` v16 already supports React 19

---

### 2.5 [P1] Vitest Migration (Replace Jest)

**Current state**: Jest 29 with ts-jest for all packages. Backend already has Vitest installed for integration tests (vitest 2.1.8 in devDependencies). This creates a split testing ecosystem -- Jest for unit tests, Vitest for integration tests.

**Recommended target**: Vitest 3.x across all packages

**Why migrate**:
- 30-70% faster test execution, up to 4x faster cold runs
- Native TypeScript/ESM support without ts-jest configuration
- Native Vite integration (frontend already uses Vite)
- Watch mode is 10-20x faster than Jest
- 30% lower memory usage (important for CI)
- Compatible with Jest API -- most tests need zero changes
- Workspace support designed for monorepos
- Backend already has Vitest partially installed

**Migration effort**: 12-16 hours (199 tests across 11 suites)

**Risk**: Low. Vitest is API-compatible with Jest. Most test files need only import changes. The main work is configuration (vitest.config.ts per package, workspace config at root).

**Timing**: DURING v2.0 (can happen alongside early epics) -- new test files should use Vitest from day one

**Concrete steps**:
1. Create `vitest.workspace.ts` at monorepo root
2. Create `vitest.config.ts` in each package (frontend with jsdom, backend with node)
3. Replace `ts-jest` transforms with Vitest's native TS support
4. Update test imports: `import { describe, it, expect } from 'vitest'`
5. Migrate jest.config files (most options map directly)
6. Update CI scripts: replace `jest` commands with `vitest`
7. Remove Jest dependencies: `jest`, `ts-jest`, `@types/jest`, `jest-environment-jsdom`
8. Keep `@testing-library/react` and `@testing-library/jest-dom` (both work with Vitest)

---

### 2.6 [P1] Vite 5 -> Vite 6

**Current state**: Vite 5.4 with React plugin, compression, PWA, and Rollup-based bundling.

**Recommended target**: Vite 6.x (stable, with Rolldown-powered builds on the horizon)

**Key benefits**:
- Full builds up to 5x faster
- New Environment API for better SSR/multi-environment support
- Improved module resolution
- Better Rolldown integration (Rust-based bundler replacing Rollup -- significantly faster production builds)

**Migration effort**: 4-6 hours

**Risk**: Low (Vite 6 is a smooth upgrade from 5.x; most config is compatible)

**Timing**: BEFORE v2.0 or early DURING v2.0

**Concrete steps**:
1. Update `vite` to ^6.0.0
2. Update `@vitejs/plugin-react` to latest compatible version
3. Review vite.config.ts for deprecated options
4. Test build output matches current (chunk sizes, compression)
5. Verify Rollup plugins compatibility (vite-plugin-compression, vite-plugin-pwa)

---

### 2.7 [P1] Tailwind CSS v3 -> v4

**Current state**: Tailwind CSS 3.4 with `tailwind.config.js`, PostCSS, and `tailwindcss-animate`.

**Recommended target**: Tailwind CSS v4 (ground-up rewrite, released January 2025)

**Key benefits**:
- Full builds up to 5x faster, incremental builds 100x faster
- CSS-first configuration (no more tailwind.config.js)
- Native container queries (critical for responsive dashboard components in v2.0)
- OKLCH color space with P3 wide-gamut support
- Built on Lightning CSS (replaces PostCSS for Tailwind processing)

**Migration effort**: 6-10 hours (automated migration tool + manual review)

**Risk**: Medium. Tailwind v4 renames several utilities (shadow -> shadow-sm, rounded -> rounded-sm, etc.). The automated migration tool handles most of this, but custom theme configurations and `@apply` usage need manual attention. Requires browser support check (Safari 16.4+, Chrome 111+, Firefox 128+).

**Timing**: BEFORE v2.0 -- v2.0 adds 6 new feature modules with extensive UI; better to start with v4's native container queries and faster builds.

**Concrete steps**:
1. Run `npx @tailwindcss/upgrade` automated migration tool
2. Replace `tailwind.config.js` with `@theme` directives in CSS
3. Update `@import` statements (replace `@tailwind` directives)
4. Review renamed utilities across all component files
5. Test `tailwindcss-animate` compatibility (may need `tw-animate-css` update)
6. Remove PostCSS Tailwind plugin (replaced by Lightning CSS)
7. Verify Radix UI component styling still correct

---

### 2.8 [P1] Monorepo Tooling -- Add Turborepo

**Current state**: npm workspaces only. No task caching, no dependency-aware task orchestration, no remote cache. Every CI run rebuilds everything from scratch.

**Recommended target**: Turborepo (lightweight, Vercel-backed, complements npm workspaces)

**Why Turborepo over Nx**: Sovren is a 4-package monorepo with a small team. Turborepo's minimal setup (3x faster on small projects), zero-config task caching, and npm workspace compatibility make it the right choice. Nx would be overkill until the team exceeds 10 developers or the repo exceeds 10+ packages.

**Key benefits**:
- Incremental builds: only rebuild packages that changed
- Task caching: local and remote (Vercel Remote Cache or self-hosted)
- Parallel task execution with dependency awareness
- CI time reduction estimated at 40-60% after cache warms

**Migration effort**: 4-6 hours

**Risk**: Low (additive, wraps existing npm workspace scripts)

**Timing**: BEFORE v2.0 -- CI savings compound across 6 epics of development

**Concrete steps**:
1. Install `turbo` as root devDependency
2. Create `turbo.json` with task pipeline (build -> test -> lint)
3. Configure task caching for `build`, `test`, `lint`, `type-check`
4. Add `turbo` prefix to CI scripts: `turbo run build test lint`
5. Enable remote cache (Vercel or self-hosted)
6. Add `.turbo` to `.gitignore`

---

### 2.9 [P1] nostr-tools Update

**Current state**: Root package uses nostr-tools 2.13.2, frontend uses 2.13.1, backend uses 2.1.4. Three different versions across the monorepo.

**Recommended target**: nostr-tools 2.23.0 (latest) -- unified across all packages

**Key benefits**:
- NIP-44 encryption support (XChaCha20-Poly1305 v2) -- required for Creator Circles encrypted messaging
- NIP-46 remote signing improvements -- better key management UX
- Bug fixes and performance improvements across 10 minor versions
- Consistent API surface across frontend/backend/shared

**Migration effort**: 2-4 hours

**Risk**: Low-Medium (NIP-44 replaces deprecated NIP-04; existing DM code may need updates)

**Timing**: BEFORE v2.0 -- NIP-44 encryption is required for Creator Circles (EPIC-010)

**Concrete steps**:
1. Update all three packages to `nostr-tools@^2.23.0`
2. Use npm workspace hoisting to ensure single version
3. Audit existing code for NIP-04 usage -- migrate to NIP-44
4. Test NOSTR event creation, signing, and relay communication
5. Update shared types if nostr-tools API surface changed

---

### 2.10 [P2] State Management Simplification

**Current state**: Redux Toolkit 2.1 + React Query 5.83. Redux slices: `cmsUiSlice`, `layoutSlice`, `navigationSlice`, `paginationSlice`, `uiSlice`, `unifiedCmsSlice`, `userSlice`. Most slices manage UI state (layout, navigation, pagination) rather than domain state.

**Recommended target**: Keep TanStack Query for server state. Evaluate replacing Redux Toolkit with Zustand for client state.

**Assessment**: The current Redux slices are primarily UI state (layout, navigation, pagination, CMS UI). TanStack Query already handles server-state (API data fetching, caching, mutations). This makes Redux Toolkit's ceremony (slices, actions, reducers, store configuration) excessive for what amounts to UI toggles and layout preferences.

Zustand would reduce boilerplate by ~60% for the existing use cases while providing:
- No provider wrapper needed
- Simpler TypeScript types (no slice/action ceremony)
- Smaller bundle (~1KB vs ~12KB for RTK)
- DevTools integration available via middleware

**However**: Redux Toolkit is not broken. The existing slices work. v2.0 adds 6 new feature modules that will use TanStack Query for all server state. The new modules don't need Redux at all if designed correctly.

**Migration effort**: 12-16 hours (to replace existing Redux slices)

**Risk**: Medium (touching working state management is risky; easy to introduce regressions)

**Timing**: AFTER v2.0 -- not worth the risk during active feature development. New v2.0 modules should use TanStack Query for server state and local React state / context for UI state, avoiding new Redux dependencies.

---

### 2.11 [P2] Backend Framework Evaluation

**Current state**: Express 4.18 with custom middleware chain, helmet, cors, rate-limiting.

**Assessment**: Express 4 is the most widely deployed Node.js framework. It works. However:
- Express 5 has been in development for years and is not production-ready
- Fastify offers 2-3x throughput improvement and native TypeScript support
- Hono is the new lightweight framework with edge-runtime compatibility

**Recommendation**: Stay on Express for v2.0. The custom middleware, DI integration, and route structure are deeply coupled to Express. Migration effort would be 40+ hours with high regression risk. Express 4 is not a bottleneck.

**When to revisit**: If Sovren needs edge deployment (Cloudflare Workers, Deno Deploy), or if throughput becomes a bottleneck at scale. At that point, evaluate Hono (for edge) or Fastify (for throughput).

**Timing**: AFTER v2.0 (no action needed now)

---

### 2.12 [P2] Inversify Integration Cleanup

**Current state**: Backend has `inversify@7.10.3` in dependencies AND a custom `ServiceContainer` with `ServiceToken` pattern. The custom container is actually used; inversify appears to be installed but potentially underutilized or from a previous iteration.

**Recommended target**: Pick one DI approach and remove the other

**Assessment**: The custom `ServiceContainer` (in `container/ServiceContainer.ts`) implements singleton/scoped/transient lifetimes, validation, dependency graph, and module registration. It is well-engineered for Sovren's needs. Inversify adds ~15KB and decorator-based metadata that isn't being leveraged.

**Options**:
1. **Keep custom container, remove inversify**: Saves bundle size, removes unused dependency, keeps the well-tested custom solution. The custom container needs to scale from 29 to 50+ services -- it can handle this.
2. **Migrate to inversify fully**: More feature-rich (interceptors, middleware, tagged bindings), better ecosystem support. But requires rewriting all service registration code.

**Recommendation**: Option 1. Remove inversify and `reflect-metadata` from backend dependencies. The custom container is sufficient and already deeply integrated.

**Migration effort**: 2-4 hours (verify inversify is unused, remove, test)

**Risk**: Low

**Timing**: DURING v2.0 (cleanup task)

---

## 3. v2.0-Specific Architecture Decisions

### 3.1 Feature Module Scaling (6 -> 12+ modules)

**Question**: Is feature-based module architecture scaling well for 12+ feature modules?

**Assessment**: The current feature-based architecture (`src/features/{auth,content,analytics,dashboard,...}`) is sound and scales well. Each module is self-contained with components, services, types, and barrel exports.

**Concerns at scale**:
- **Navigation bloat**: Adding 4 new top-level nav items (Distribute, Community, Business, Content Shield) to existing 6-7 items creates mobile UX problems. **Recommendation**: Implement grouped navigation with collapsible sections. This needs a dedicated story before v2.0 feature work begins.
- **Shared state coupling**: New modules (income, business, wellness) will need cross-module data (e.g., income forecasting needs subscription data from payments, wellness needs activity data from content). **Recommendation**: Use TanStack Query as the cross-module data layer. Modules share query keys and cache, but each module owns its own queries. Avoid Redux for cross-module state.
- **Bundle size**: 12+ feature modules need code-splitting discipline. **Recommendation**: Every new feature module should be a lazy-loaded route with `React.lazy()` and `Suspense`. The existing 14-chunk splitting strategy should be reviewed and expanded.

**Verdict**: Architecture scales. Add navigation redesign story and lazy-loading discipline.

---

### 3.2 Event-Driven Architecture Adoption

**Question**: Should backend adopt event-driven architecture? (EventBus is already there)

**Assessment**: `EventBusService` is already registered as a singleton in the DI container. It is used by multiple services (ContentPublishing, UserProfile, Subscription, etc.) for in-process event communication.

**Recommendation**: Yes, double down on event-driven for v2.0. Specifically:
- **In-process events** (existing EventBus): Use for decoupled service communication within a single request. Example: Content publish event triggers provenance signing, fingerprinting, and analytics update.
- **Background job events** (BullMQ/Inngest): Use for async work that survives request lifecycle. Example: Cross-platform publishing, content scanning, forecast generation.
- **Real-time events** (Supabase Realtime): Use for pushing updates to connected clients. Example: New message in unified inbox, content alert detected.

**Architecture pattern**: Event sourcing is overkill. Use EventBus for in-process choreography, job queue for async processing, Supabase Realtime for client push. Three tiers, each with a clear purpose.

---

### 3.3 DI Container Scaling (29 -> 50+ services)

**Question**: Is the custom DI container (ServiceToken pattern) the right approach as services grow?

**Assessment**: The current container handles 29 services with explicit lifetime management (singleton/scoped/transient), dependency graph validation, and module registration. The implementation is clean and well-tested.

**Scaling to 50+ services**:
- The `TYPES` object will become large but manageable with domain grouping (already organized by phase)
- `SERVICE_DEPENDENCIES` map becomes the maintenance burden -- each new service needs explicit dependency declaration
- No circular dependency detection issues at current scale; may surface at 50+

**Recommendation**: Keep the custom container. Add these improvements:
1. **Domain-based type files**: Split `types.ts` into `types/wellness.ts`, `types/shield.ts`, etc., with a barrel export
2. **Auto-registration pattern**: Create a `@Service()` decorator or registration helper that auto-discovers services in a directory, reducing manual `TYPES` entries
3. **Module-based binding files**: Continue the existing `bindings/` pattern -- create `bindings/wellness.bindings.ts`, `bindings/distribution.bindings.ts`, etc.

**Timing**: DURING v2.0 (evolve as new services are added)

---

### 3.4 CQRS for Analytics-Heavy Domains

**Question**: Should CQRS be adopted for Multi-Platform Analytics and Income Forecasting?

**Assessment**: CQRS (Command Query Responsibility Segregation) separates read and write models. It is valuable when:
- Read patterns differ significantly from write patterns (yes -- analytics dashboards read aggregated data; write operations are individual events)
- Read load significantly exceeds write load (yes -- dashboard views >> data mutations)
- Complex aggregation queries slow down write paths (potentially)

**Recommendation**: Adopt a lightweight CQRS pattern for analytics-heavy domains, NOT full event-sourcing CQRS.

**Implementation**:
- **Write side**: Standard service layer writes to Supabase tables (existing pattern)
- **Read side**: Materialized views or summary tables updated by background jobs (BullMQ)
- **Domains to apply**: Cross-Platform Analytics (US-224), Revenue Forecasting (US-251), Subscriber Health (US-252)
- **Pattern**: Write raw events -> BullMQ job aggregates into summary table -> Frontend reads summary table

This avoids complex real-time aggregation queries on hot tables while keeping the write path simple.

**Timing**: DURING v2.0 (design into analytics-heavy stories)

---

### 3.5 Real-Time Strategy

**Question**: What is the right real-time strategy for Unified Inbox + Creator Circles?

**Assessment**: The codebase has three real-time mechanisms available:
1. `ws` package (WebSocket server, installed in both frontend and backend)
2. `supabase-realtime-service.ts` (Supabase Realtime, configured)
3. NOSTR relay subscriptions (via nostr-tools SimplePool)

**Recommendation**: Use a **tiered real-time strategy**:

| Use Case | Protocol | Reason |
|----------|----------|--------|
| Unified Inbox new messages | Supabase Realtime | Messages are stored in Supabase; Realtime gives automatic push on INSERT with RLS |
| Creator Circles messaging | NOSTR relay subscriptions | Decentralized, no Sovren dependency; use NIP-44 encryption |
| Content alerts | Supabase Realtime | Alerts stored in Supabase; push on INSERT |
| Dashboard live metrics | SSE (Server-Sent Events) | One-directional push, HTTP-native, no WebSocket overhead |
| Marketplace order status | Supabase Realtime | Order state stored in Supabase |

**Avoid**: Building a custom WebSocket layer for general pub/sub. Supabase Realtime handles this natively with zero infrastructure.

**Creator Circles messaging caveat**: NIP-44 encrypted group messaging is not yet standardized (NIP-28 is public channels, not encrypted). For v2.0 MVP, use Supabase-backed group chat with NOSTR identity verification. Plan migration to pure NOSTR group messaging when the protocol matures.

---

### 3.6 Supabase at Scale (20+ new tables)

**Question**: Is Supabase the right choice as the platform scales to 20+ new tables?

**Assessment**: Supabase is PostgreSQL under the hood. The concern is not PostgreSQL scaling (it handles thousands of tables) but rather:
- **RLS policy complexity**: Each table needs Row-Level Security policies. At 40+ tables with per-user policies, RLS performance becomes a concern.
- **Migration tooling**: Raw SQL files without a migration runner make 20+ new table migrations risky.
- **Edge Functions**: Supabase Edge Functions run on Deno, not Node. Backend services cannot be deployed as Edge Functions without rewriting.

**Recommendation**: Stay on Supabase. It is the right choice. Address the scaling concerns:
1. **Add a migration runner**: Adopt `supabase-migrations` CLI or at minimum use numbered migration files with an execution order. The existing `database/` raw SQL approach will not scale safely to 20+ new tables.
2. **RLS performance testing**: Benchmark RLS policy performance at 40 tables with realistic data volumes before v2.0 launch. Use `EXPLAIN ANALYZE` on queries with RLS active.
3. **Index strategy**: Every `creator_id` foreign key needs a B-tree index. Every JSONB column used in queries needs a GIN index. Make this explicit in every data model story.
4. **Connection pooling**: At scale (1000+ concurrent creators), enable Supabase's pgBouncer integration for connection pooling.

**Timing**: Migration tooling BEFORE v2.0; performance testing DURING v2.0

---

## 4. Refactoring Roadmap

### P0: Must Do Before v2.0 (Blocks Quality/Scalability)

| # | Refactoring | Effort | Blocks |
|---|------------|--------|--------|
| P0-1 | Install and configure BullMQ job queue infrastructure | 8-12h | EPIC-008, 009, 012 |
| P0-2 | Fix P1 security issues (SQL injection, hardcoded keys, XSS, missing DI) | 12-16h | All v2 epics |
| P0-3 | Unify nostr-tools version to 2.23.0 across all packages | 2-4h | EPIC-010 (NIP-44) |
| P0-4 | Add v2 API route registration pattern (`routes/v2/index.ts`) | 2-3h | All v2 backend routes |
| P0-5 | Add DI container extension for v2 services (domain-based types + bindings) | 4-6h | All v2 backend services |
| P0-6 | Navigation architecture redesign (accommodate 11+ items) | 4-6h | All v2 frontend features |
| P0-7 | Migrate to ESLint 9 with flat config | 6-8h | Code quality across 6 new domains |

**Total P0 effort**: ~40-55 hours (1-1.5 weeks of focused work)

### P1: Should Do During v2.0 (Improves Developer Experience)

| # | Refactoring | Effort | Benefits |
|---|------------|--------|----------|
| P1-1 | Upgrade React 18 -> 19 | 8-12h | Actions, Compiler, cleaner APIs for new modules |
| P1-2 | Adopt tRPC for v2 API routes | 16-24h | End-to-end type safety for all v2 endpoints |
| P1-3 | Migrate Jest -> Vitest | 12-16h | Faster tests, native TS support, unified with backend integration tests |
| P1-4 | Upgrade Vite 5 -> 6 | 4-6h | Faster builds, Rolldown preview |
| P1-5 | Upgrade Tailwind v3 -> v4 | 6-10h | Faster builds, container queries, modern CSS |
| P1-6 | Add Turborepo for task caching | 4-6h | 40-60% CI time reduction |
| P1-7 | Remove inversify (keep custom DI) | 2-4h | Removes unused dependency, reduces confusion |
| P1-8 | Replace react-beautiful-dnd (unmaintained) | 2-4h | Use @hello-pangea/dnd or dnd-kit |

**Total P1 effort**: ~55-82 hours (1.5-2 weeks, parallelizable with feature work)

### P2: Can Do After v2.0 (Future Optimization)

| # | Refactoring | Effort | Benefits |
|---|------------|--------|----------|
| P2-1 | Evaluate Redux -> Zustand migration for client state | 12-16h | Simpler state, smaller bundle |
| P2-2 | Add database migration runner (Drizzle or Prisma Migrate) | 8-12h | Safe schema evolution |
| P2-3 | Evaluate Express -> Fastify/Hono for throughput | 40-60h | 2-3x throughput, better TS support |
| P2-4 | Add Supabase database branching for dev/staging | 4-8h | Branch-based database environments |
| P2-5 | Implement SSE layer for dashboard live metrics | 8-12h | Replace polling with push |
| P2-6 | Adopt Supabase Queues (native PostgreSQL queues) | 4-8h | Potentially replace BullMQ for simple jobs |
| P2-7 | Type-coverage enforcement (96.79% -> 98%+) | 4-6h | Close remaining type gaps |
| P2-8 | Evaluate NOSTR pure group messaging when NIPs stabilize | 8-16h | Remove Supabase dependency for circles |

**Total P2 effort**: ~88-138 hours (post v2.0 sprint)

---

## 5. Technology Debt Register

| ID | Debt Item | Severity | Impact | Domain | Recommended Fix | Timeline |
|----|-----------|----------|--------|--------|----------------|----------|
| TD-001 | No job queue infrastructure | Critical | Blocks 3 epics, no background processing capability | Backend | Install BullMQ, configure workers | Pre-v2.0 |
| TD-002 | Mixed nostr-tools versions (2.1.4, 2.13.1, 2.13.2) | High | Inconsistent API, missing NIP-44 encryption in backend | Shared | Unify to 2.23.0 | Pre-v2.0 |
| TD-003 | ESLint 8 with deprecated config format | High | Will break on ESLint 10; inconsistent rule enforcement | Tooling | Migrate to ESLint 9 flat config | Pre-v2.0 |
| TD-004 | Dual DI systems (custom + inversify installed) | Medium | Confusion about which to use, wasted bundle size | Backend | Remove inversify, keep custom | During v2.0 |
| TD-005 | Jest + Vitest split testing ecosystem | Medium | Inconsistent test config, double dependency set | Tooling | Consolidate to Vitest | During v2.0 |
| TD-006 | No type-safe API contract between frontend/backend | High | Runtime-only API shape validation | API Layer | Adopt tRPC or shared Zod contracts | Pre/During v2.0 |
| TD-007 | Raw SQL migrations without runner | Medium | Risky schema changes, no rollback capability | Database | Adopt migration runner | During v2.0 |
| TD-008 | react-beautiful-dnd is unmaintained | Low | No security patches, no React 19 support | Frontend | Replace with dnd-kit or @hello-pangea/dnd | During v2.0 |
| TD-009 | Storybook v9 config may need Vite 6 alignment | Low | Storybook builds may break on Vite upgrade | Frontend | Test Storybook compat during Vite 6 upgrade | During v2.0 |
| TD-010 | Duplicate directory issue (backend has `__tests__` and `__tests__ 2`) | Low | Confusing, possible test file conflicts | Backend | Remove duplicate directories | Pre-v2.0 |
| TD-011 | Backend uses CommonJS (`"type": "commonjs"`) while root and frontend use ESM | Medium | Module system inconsistency in monorepo | Backend | Evaluate ESM migration for backend | After v2.0 |
| TD-012 | `@sentry/tracing` v7 installed (deprecated, Sentry SDK v8 is current) | Medium | Missing session replay, profiling improvements | Monitoring | Upgrade to @sentry/browser v8 | During v2.0 |
| TD-013 | @typescript-eslint version inconsistency (v6 in root/frontend, v8 in backend) | Medium | Different rule behavior across packages | Tooling | Unify during ESLint 9 migration | Pre-v2.0 |
| TD-014 | No shared API error handling pattern | Medium | Inconsistent error responses across routes | API Layer | Define ErrorResponse type in shared package | During v2.0 |
| TD-015 | EmailService implementation status unclear | Medium | Email features (notifications, digests) may be blocked | Backend | Verify and implement with Resend/SendGrid | Pre-v2.0 |
| TD-016 | CurrencyService implementation status unclear | Medium | BTC/USD conversion needed for tax prep, income tracking | Backend | Verify and implement with free API (CoinGecko) | Pre-v2.0 |

---

## 6. Architecture Decision Records (ADRs) Needed

### ADR-001: Custodial Design for Payment Splitting and Escrow
**Priority**: P0-CRITICAL (blocks EPIC-010)
**Context**: Creator Marketplace escrow and collaborative content revenue splitting both require Sovren to temporarily hold Lightning funds. This conflicts with the non-custodial philosophy stated in PRD v2.0 Section 8.4.
**Decision needed**: Define the custody model -- options include:
1. HODL invoices (hold payment until release condition met)
2. Explicit short-term custody with user consent
3. Multi-party payment schemes (multiple invoices per transaction)
4. Defer escrow to later phase while the design is resolved
**Stakeholders**: Architect, Security, Legal

### ADR-002: Real-Time Strategy (WebSocket vs SSE vs Supabase Realtime)
**Priority**: P1-HIGH (blocks EPIC-009, EPIC-010)
**Context**: Three real-time mechanisms available (ws, Supabase Realtime, NOSTR relays). No unified strategy documented. v2.0 introduces 4+ new real-time use cases.
**Decision needed**: Define which protocol serves which use case (see Section 3.5 recommendation above)
**Stakeholders**: Architect, Backend

### ADR-003: Job Queue Selection (BullMQ vs Inngest vs Trigger.dev)
**Priority**: P0-CRITICAL (blocks 3 epics)
**Context**: No job queue exists. BullMQ leverages existing Redis; Inngest/Trigger.dev offer higher-level abstractions with less infrastructure management.
**Decision needed**: Choose job queue technology and define worker architecture (in-process vs separate container)
**Stakeholders**: Architect, DevOps

### ADR-004: Group Encryption for Creator Circles
**Priority**: P1-HIGH (blocks EPIC-010)
**Context**: NIP-28 (public channels) and NIP-44 (1:1 encryption) are stable. NIP-104 (group DMs) is experimental. Creator Circles need encrypted group messaging.
**Decision needed**: Supabase-backed group chat (pragmatic, works today) vs pure NOSTR group messaging (decentralized, protocol not ready)
**Stakeholders**: Architect, Backend, Protocol team

### ADR-005: API Protocol for v2 Endpoints (tRPC vs REST with Shared Contracts)
**Priority**: P1-HIGH
**Context**: Existing v1 routes are REST without type-safe contracts. v2 adds 30+ new endpoints across 6 domains. TypeScript monorepo is ideal for tRPC.
**Decision needed**: Adopt tRPC for v2 endpoints (coexist with v1 REST) or implement shared Zod contracts without protocol change
**Stakeholders**: Architect, Backend, Frontend

### ADR-006: Content Repurposing AI Model Selection
**Priority**: P2-MEDIUM (blocks US-E9-004)
**Context**: Content repurposing engine needs summarization and format adaptation. Options: rule-based (no AI), local LLM (llama.cpp), cloud LLM (OpenAI/Anthropic API), or Supabase AI (pgvector + edge functions).
**Decision needed**: Define approach and cost model for AI-powered content repurposing
**Stakeholders**: Architect, Product, Finance

### ADR-007: Database Migration Strategy
**Priority**: P1-HIGH
**Context**: 20+ new tables needed for v2.0. Current approach is raw SQL files without ordering, rollback, or tooling. Options: Drizzle ORM migrations, Prisma Migrate, Supabase CLI migrations, or numbered raw SQL with a custom runner.
**Decision needed**: Choose migration tooling before first v2.0 table is created
**Stakeholders**: Architect, Backend, DBA

### ADR-008: Frontend Code-Splitting Strategy for 12+ Feature Modules
**Priority**: P1-HIGH
**Context**: Adding 6 new feature modules doubles the frontend surface area. Current 14-chunk manual splitting may not accommodate new modules optimally.
**Decision needed**: Define lazy-loading boundaries, chunk grouping strategy, and bundle budget per feature module
**Stakeholders**: Architect, Frontend

---

## 7. Summary: Recommended Pre-v2.0 Sprint

Before starting any v2.0 epic, execute a focused infrastructure sprint:

| Day | Work Item | Effort |
|-----|-----------|--------|
| 1-2 | Fix P1 security issues (in progress per security-fixer team) | 12-16h |
| 2-3 | Install BullMQ + worker infrastructure (ADR-003) | 8-12h |
| 3-4 | Migrate ESLint to v9 flat config | 6-8h |
| 4 | Unify nostr-tools to 2.23.0 | 2-4h |
| 4-5 | Add v2 route registration + DI container extension | 6-9h |
| 5 | Navigation architecture redesign story | 4-6h |
| 5 | Write ADR-001 (custodial design) and ADR-004 (group encryption) | 3-4h |

**Total pre-v2.0 sprint**: ~5 working days (41-59 hours)

After this sprint, upgrade React 19, Vite 6, Tailwind v4, and adopt tRPC/Vitest as the first stories within v2.0 epics, where new code is written with the upgraded tooling from day one.

---

## Appendix: Technology Version Matrix

| Technology | Current | Target | Gap | Priority |
|-----------|---------|--------|-----|----------|
| React | 18.3.1 | 19.x | 1 major | P1 |
| React DOM | 18.3.1 | 19.x | 1 major | P1 |
| TypeScript | 5.3.3 | 5.7.x | 4 minor | P2 |
| Vite | 5.4.0 | 6.x | 1 major | P1 |
| Tailwind CSS | 3.4.0 | 4.x | 1 major (rewrite) | P1 |
| ESLint | 8.56.0 | 9.x | 1 major (breaking) | P0 |
| @typescript-eslint | 6.21/8.37 | 8.x (unified) | Inconsistent | P0 |
| Jest | 29.7.0 | Vitest 3.x | Framework switch | P1 |
| nostr-tools | 2.1-2.13 | 2.23.0 | 10-22 minor | P0 |
| Redux Toolkit | 2.1.0 | Zustand (eval) | Potential replacement | P2 |
| TanStack Query | 5.83.0 | 5.x (current) | Up to date | -- |
| Supabase JS | 2.38-2.49 | 2.49.x | Up to date (frontend) | -- |
| Express | 4.18.2 | 4.x (stay) | No action | -- |
| Inversify | 7.10.3 | Remove | Unused dependency | P1 |
| @sentry/tracing | 7.120.3 | @sentry/browser 8.x | 1 major | P1 |
| Storybook | 9.0.6 | 9.x (current) | Up to date | -- |
| Playwright | 1.52.0 | 1.x (current) | Up to date | -- |
| BullMQ | Not installed | 5.x | Missing | P0 |
| tRPC | Not installed | 11.x | Missing | P1 |
| Turborepo | Not installed | 2.x | Missing | P1 |

---

*Assessment produced by Principal Architecture Analyst. Recommendations are prioritized by v2.0 impact and risk. All effort estimates assume a senior developer familiar with the codebase.*
