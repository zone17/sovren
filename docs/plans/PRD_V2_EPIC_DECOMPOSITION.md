# PRD v2.0 Epic Decomposition for Team-Builder

**Source PRD**: `SOVREN_PRD_V2_CREATOR_EMPOWERMENT.md`
**Date**: 2026-02-12
**Total Epics**: 6 (EPIC-007 through EPIC-012) + Infrastructure
**Total Stories**: 29 PRD stories decomposed into ~78 implementation stories (original 54 + 12 infrastructure + 4 splits + 5 PRD additions + 4 factory remediation)
**Estimated Team-Builder Runs**: 9 (mix of enterprise, standard, minimal)
**Estimated Timeline**: 13-17 weeks (includes 2-week pre-v2.0 infrastructure + factory sprint)
**Architecture Reference**: `docs/reviews/architecture-assessment.md` (technology debt register, version matrix, ADR list)
**Software Factory Audit**: 2026-02-12 consolidated assessment — CI/CD: 2.75/5, Observability: 2.6/5, Security: 4.0/5, Overall: 3.1/5

---

## Execution Order & Dependencies

```
  Security Prereqs
        │
        ├────────────────┬────────────────┐
        │                │                │
  ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
  │ EPIC-007  │   │ EPIC-008  │   │ EPIC-009  │
  │ Wellness  │   │  Shield   │   │ Platform  │
  └─────┬─────┘   └─────┬─────┘   └───────────┘
        │                │          (Wave A + B)
        │                │
  ┌─────▼─────┐   ┌─────▼─────┐
  │ EPIC-011  │   │ EPIC-010  │
  │ Business  │   │ Network   │
  └─────┬─────┘   └───────────┘
        │
  ┌─────▼─────┐
  │ EPIC-012  │
  │  Income   │
  └───────────┘
```

**Corrected dependencies**:
- EPIC-007, EPIC-008, EPIC-009 all start in parallel after security prereqs (no sequential dependency between them)
- EPIC-010 depends on EPIC-008 (provenance for collaborative content attribution)
- EPIC-011 depends on EPIC-007 (wellness data in business health view); soft dependency on EPIC-009 is non-blocking
- EPIC-012 depends on EPIC-011 (revenue breakdown data)
- EPIC-009 has no dependency on EPIC-007 or EPIC-008 (benefits from EPIC-008 provenance for cross-posted content, but not blocking)

**Critical path**: Security Prereqs → [EPIC-007 || EPIC-008 || EPIC-009 Wave A] → EPIC-010 (after 008) / EPIC-011 (after 007) → EPIC-012
**Parallel lanes**: 007, 008, and 009 Wave A all start immediately; 010 and 011 run in parallel once their dependencies complete

---

## Pre-Requisites (Before Any v2.0 Work)

These P1 security issues from the existing backend TODO tracker **must be resolved first**:

| Issue | Location | Blocker For |
|---|---|---|
| SQL injection in Lightning payment service | backend/src/services/lightning-payment-service.ts:719 (service layer) | EPIC-012 |
| Plaintext NOSTR keys + auto-generated encryption key | ContentPublishingService.ts:757-770 (plaintext NOSTR keys) + EnhancedNostrAuthService:136 (auto-generated encryption key) | EPIC-008, EPIC-011 |
| XSS vulnerability in Markdown/RichText editors | frontend/features/content | EPIC-009 |
| Missing DI controller registration | backend/controllers | All new v2 routes |

**Recommendation**: Run `/team-builder minimal` with description "Fix P1 security issues in backend" before starting v2.0 epics.

### Architecture Pre-Requisites (from architecture assessment)

These P0 items from the architecture assessment must also be resolved before v2.0 epic work begins:

| Issue | Effort | Blocker For | Reference |
|---|---|---|---|
| ESLint 8 deprecated — migrate to ESLint 9 flat config | 6-8h | All 6 new feature domains (code quality debt) | Architecture Assessment §2.3 |
| Mixed nostr-tools versions (2.1.4, 2.13.1, 2.13.2) — unify to 2.23.0 | 2-4h | EPIC-010 (NIP-44 encryption for Creator Circles) | Architecture Assessment §2.9, TD-002 |
| No type-safe API contract — evaluate tRPC v11 vs shared Zod contracts | ADR only (2h) | All v2 backend endpoints | Architecture Assessment §2.2, ADR-005 |

### Architecture Decision Records (ADRs) Required

8 ADRs identified in architecture assessment. P0-CRITICAL ADRs must be written as part of the infrastructure sprint:

| ADR | Priority | Write Before | Decision Space |
|-----|----------|-------------|----------------|
| ADR-001: Custodial design | P0-CRITICAL | EPIC-010 | HODL invoices vs explicit custody vs multi-party payments |
| ADR-003: Job queue selection | P0-CRITICAL | US-E0-001 | BullMQ vs Inngest vs Trigger.dev |
| ADR-005: API protocol for v2 | P1-HIGH | First v2 endpoint | tRPC vs REST with shared Zod contracts |
| ADR-007: Database migration strategy | P1-HIGH | First v2 table | Drizzle vs Prisma vs Supabase CLI vs custom |
| ADR-002: Real-time strategy | P1-HIGH | EPIC-009 | Protocol per use case (see PRD §8.5) |
| ADR-004: Group encryption | P1-HIGH | EPIC-010 | Supabase-backed vs pure NOSTR |
| ADR-006: AI model for repurposing | P2-MEDIUM | US-E9-004 | Rule-based vs LLM |
| ADR-008: Code-splitting strategy | P1-HIGH | First v2 frontend module | Lazy-loading boundaries, chunk budgets |

### Software Factory Remediation (from 2026-02-12 audit)

A comprehensive 3-domain audit (CI/CD, Observability, Security) scored the platform at **3.1/5 overall**. The claim of "100% CI/CD maturity" is not substantiated — realistic is 40-50%. These findings **must be remediated before v2.0 epic work begins**:

| Domain | Score | Critical Finding |
|--------|-------|-----------------|
| CI/CD Pipeline | 2.75/5 | ALL deployment steps are `echo` stubs — zero actual deployment |
| Observability | 2.6/5 | Sentry is a simulation class; health checks use `Math.random()` |
| Security Pipeline | 4.0/5 | Production Supabase credentials in plaintext `.env` (CVSS 9.8) |

**Immediate action** (before any other work):
- Rotate Supabase database password (CRITICAL-001)
- Audit git history for committed `.env` files
- Remove hardcoded VAULT_TOKEN fallback from `credential-rotation-vault.yml`
- Remove exposed BACKUP_ENCRYPTION_KEY from backend `.env`

**Full audit reports**: `docs/reviews/software-factory-assessment.md` (to be created from agent outputs)

---

## Cross-Cutting Infrastructure Stories

These stories must be completed before or alongside the first epic stories that depend on them.

#### US-E0-001: BullMQ Infrastructure Setup
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: None
**Estimated Time**: 3-4 hours

**Description**: Install and configure BullMQ job queue infrastructure as a shared dependency for EPIC-008 (content scanning), EPIC-009 (cross-platform publishing), and EPIC-012 (forecast batch jobs).

**Subtasks**:
- [ ] Install BullMQ and @types/bullmq
- [ ] Configure Redis namespace strategy: `sovren:bullmq:` prefix to isolate from existing ioredis usage
- [ ] Create worker process management (in-process for MVP)
- [ ] Set up dead letter queue handling for failed jobs
- [ ] Add Bull Board monitoring dashboard endpoint
- [ ] Integration with Docker Compose (ensure Redis availability)
- [ ] Create shared job queue factory in DI container

**Definition of Done**:
- [ ] BullMQ installed and configured with tests
- [ ] Sample job enqueue/dequeue working with Redis namespace isolation
- [ ] Bull Board accessible at /admin/queues (auth-protected)
- [ ] 95%+ test coverage on queue infrastructure

---

#### US-E0-002: DI Container v2 Extension
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: None
**Estimated Time**: 2-3 hours

**Description**: Extend the DI container with service tokens, bindings, and lifetime configurations for all v2 services.

**Subtasks**:
- [ ] Add service tokens for v2 services: Wellness, Provenance, Distribution, Community, Finance
- [ ] Create binding files: wellness.bindings.ts, provenance.bindings.ts, distribution.bindings.ts, community.bindings.ts, finance.bindings.ts
- [ ] Update SERVICE_LIFETIMES and SERVICE_DEPENDENCIES
- [ ] Register existing controllers (ContentController, UserController, PaymentController) that are currently missing from bindings
- [ ] Integration test: resolve each new service token from container

**Definition of Done**:
- [ ] All v2 service tokens registered and resolvable
- [ ] All 3 existing controllers registered and resolvable
- [ ] No runtime DI resolution errors
- [ ] 95%+ test coverage

---

#### US-E0-003: v2 API Route Registration
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: US-E0-002
**Estimated Time**: 1-2 hours

**Description**: Create v2 route registration infrastructure following the existing v1 pattern.

**Subtasks**:
- [ ] Create `routes/v2/index.ts` barrel export
- [ ] Register v2 routes in `app.ts` under `/api/v2` prefix
- [ ] Add v2-specific middleware if needed (versioned error handling)
- [ ] Verify route registration with integration test

**Definition of Done**:
- [ ] `/api/v2/health` endpoint returns 200
- [ ] v2 routes load without breaking v1 routes
- [ ] Integration test confirms route registration

---

#### US-E0-004: Navigation Architecture Redesign
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: None
**Estimated Time**: 3-4 hours

**Description**: Restructure top-level navigation to accommodate v2.0 features (4 new top-level items: Distribute, Community, Business, Content Shield) without breaking the existing navigation UX on mobile.

**Subtasks**:
- [ ] Redesign navigation for 11+ items (grouped navigation with collapsible sections)
- [ ] Mobile hamburger menu redesign
- [ ] Progressive disclosure: new nav items hidden until feature is unlocked
- [ ] Responsive breakpoints for tablet and desktop views
- [ ] Accessibility: keyboard navigation and ARIA labels for grouped nav

**Definition of Done**:
- [ ] Navigation renders correctly with all v2 items on desktop, tablet, and mobile
- [ ] Existing v1 navigation items unaffected
- [ ] Accessible (ARIA, keyboard navigable)
- [ ] 85%+ test coverage on navigation components

---

#### US-PRE-002: Shared Test Infrastructure for v2.0
**Priority**: P0-CRITICAL
**Agent**: qa
**Dependencies**: None
**Estimated Time**: 5 hours

**Description**: Create shared test infrastructure needed by all v2.0 epics including Playwright scaffolding, mock services, and test data factories.

**Subtasks**:
- [ ] Create Playwright Page Object Model base classes and auth fixtures
- [ ] Create mock OAuth server factory for platform integration tests
- [ ] Extend createMockLightningService() with multi-output payment splitting
- [ ] Create BullMQ in-memory test harness
- [ ] Create NOSTR relay mock for provenance and encrypted messaging tests
- [ ] Create mock currency conversion API
- [ ] Create time-series test data factory for deterministic forecast testing
- [ ] Verify Playwright e2e/ directory has global-setup.ts and global-teardown.ts

**Definition of Done**:
- [ ] All mock services have TypeScript interfaces matching production services
- [ ] Playwright auth setup creates and stores authenticated sessions
- [ ] All mocks are importable from @test-utils/ path
- [ ] README in test-utils/ documents all available mocks
- [ ] 95%+ test coverage on mock implementations

---

#### US-E0-005: ESLint 9 Migration (Flat Config)
**Priority**: P0-CRITICAL
**Agent**: backend (tooling scope)
**Dependencies**: None
**Estimated Time**: 6-8 hours
**Architecture Reference**: Architecture Assessment §2.3, TD-003

**Description**: Migrate from deprecated ESLint 8 with `.eslintrc` to ESLint 9 with flat config. ESLint 8 is deprecated; ESLint 10 RC will remove `.eslintrc` support entirely. Current codebase has inconsistent `@typescript-eslint` versions (v6 in root/frontend/shared, v8 in backend).

**Subtasks**:
- [ ] Run ESLint migration tool: `npx @eslint/migrate-config .eslintrc.js`
- [ ] Replace `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` with unified `typescript-eslint` v8
- [ ] Convert to `eslint.config.js` with `defineConfig()` and `extends`
- [ ] Consolidate root/frontend/backend/shared ESLint configs
- [ ] Remove deprecated `eslint-plugin-prettier` (use Prettier separately)
- [ ] Verify CI/CD passes with new config
- [ ] Fix any new linting errors surfaced by unified v8 rules

**Definition of Done**:
- [ ] All packages use ESLint 9 with flat config
- [ ] Single `typescript-eslint` v8 version across all packages
- [ ] CI/CD lint step passes with zero errors
- [ ] No deprecated ESLint 8 config files remain

---

#### US-E0-006: Unify nostr-tools to 2.23.0
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: None
**Estimated Time**: 2-4 hours
**Architecture Reference**: Architecture Assessment §2.9, TD-002

**Description**: Unify 3 divergent nostr-tools versions (root: 2.13.2, frontend: 2.13.1, backend: 2.1.4) to latest 2.23.0. Required for NIP-44 encryption support needed by Creator Circles (EPIC-010). Backend is 22 minor versions behind.

**Subtasks**:
- [ ] Update all three packages to `nostr-tools@^2.23.0`
- [ ] Use npm workspace hoisting to ensure single version
- [ ] Audit existing code for NIP-04 usage — migrate to NIP-44 where applicable
- [ ] Test NOSTR event creation, signing, and relay communication
- [ ] Update shared types if nostr-tools API surface changed
- [ ] Verify all existing NOSTR tests pass with updated version

**Definition of Done**:
- [ ] Single nostr-tools version (2.23.0) across all packages
- [ ] NIP-44 encryption functions available and tested
- [ ] All existing NOSTR tests pass (event signing, relay communication, DMs)
- [ ] No duplicate nostr-tools in node_modules (verify with `npm ls nostr-tools`)

---

#### US-E0-007: Write P0-CRITICAL ADRs
**Priority**: P0-CRITICAL
**Agent**: architect
**Dependencies**: None
**Estimated Time**: 3-4 hours
**Architecture Reference**: Architecture Assessment §6

**Description**: Write the two P0-CRITICAL Architecture Decision Records before any epic work begins. These decisions block EPIC-008, 009, 010, and 012.

**Subtasks**:
- [ ] Write ADR-001: Custodial design for payment splitting and escrow (options: HODL invoices, explicit short-term custody, multi-party payments, defer)
- [ ] Write ADR-003: Job queue selection (options: BullMQ leveraging existing ioredis, Inngest for zero-infra, Trigger.dev)
- [ ] Write ADR-005: API protocol for v2 endpoints (options: tRPC v11 for new routes, shared Zod contracts without protocol change)
- [ ] Save ADRs to `/docs/decisions/` following ADR format
- [ ] Update CLAUDE.md if ADR decisions introduce new patterns

**Definition of Done**:
- [ ] ADR-001, ADR-003, ADR-005 written with context, options, decision, and consequences
- [ ] ADRs saved in `/docs/decisions/` directory
- [ ] Decisions actionable — subsequent infrastructure stories can reference them

---

#### US-E0-008: Emergency Credential Rotation & Secrets Cleanup
**Priority**: P0-CRITICAL (IMMEDIATE — before any other work)
**Agent**: backend (security scope)
**Dependencies**: None (start first)
**Estimated Time**: 2-3 hours
**Audit Reference**: Security Audit CRITICAL-001, CRITICAL-002

**Description**: Production Supabase credentials are in plaintext in `packages/frontend/.env` (CVSS 9.8). Hardcoded secrets exist in backend `.env` and CI workflows. Rotate, audit, and clean up all exposed credentials.

**Subtasks**:
- [ ] Rotate Supabase database password via Supabase dashboard
- [ ] Run `git log --all --full-history -- packages/frontend/.env` to audit if `.env` was ever committed
- [ ] If found in git history: run full credential rotation workflow, consider repo compromised
- [ ] Remove `BACKUP_ENCRYPTION_KEY` value from `packages/backend/.env` (move to `.env.example` as placeholder)
- [ ] Remove `VAULT_TOKEN=root-token-sovren` from `packages/backend/.env`
- [ ] Remove fallback `'root-token-sovren'` from `.github/workflows/credential-rotation-vault.yml` line 56
- [ ] Remove `JWT_SECRET=dev-jwt-secret...` from root `.env` (move to `.env.example`)
- [ ] Create `.env.example` files with placeholder values for all packages that have `.env` files
- [ ] Verify all `.env` files are in `.gitignore` (confirm no accidental tracking)

**Definition of Done**:
- [ ] Supabase password rotated; old credential no longer valid
- [ ] Git history audit complete (confirmed never committed OR rotation done)
- [ ] No hardcoded production-grade secrets in any `.env` file on disk
- [ ] `.env.example` files exist with safe placeholder values
- [ ] CI workflows have no hardcoded fallback secrets

---

#### US-E0-009: CI/CD Pipeline Consolidation & Real Deployment
**Priority**: P0-CRITICAL
**Agent**: backend (devops scope)
**Dependencies**: US-E0-008
**Estimated Time**: 12-16 hours (3-4 days)
**Audit Reference**: CI/CD Audit — score 2.75/5

**Description**: The CI/CD pipeline has 22 workflows with redundant triggers, `echo` stub deployments, deprecated action versions, and missing permissions. Consolidate into a functional pipeline with real deployment.

**Subtasks**:
- [ ] Consolidate 4+ overlapping trigger workflows into a single main CI workflow with reusable workflows
- [ ] Replace ALL `echo` stub deployment steps with real deployment logic (staging: auto-deploy on main merge; production: manual approval)
- [ ] Update all GitHub Action versions to latest (actions/checkout@v4, actions/setup-node@v4, docker/build-push-action@v5, etc.)
- [ ] Add `permissions: read-all` at top level of all 9 workflows missing it; grant specific write permissions at job level only
- [ ] Remove `continue-on-error: true` from security-critical steps in `dependency-audit.yml` (lines 49, 67, 86, 103, 128, 147)
- [ ] Fix frontend production Dockerfile (distroless with no web server) — add nginx or serve static files properly
- [ ] Fix test command references in CI that point to non-existent npm scripts
- [ ] Remove or update AI workflows using deprecated OpenAI API (pre-v1.0 `openai.ChatCompletion.create`)
- [ ] Set Trivy exit-code to 1 for critical vulnerabilities in `docker-build-push.yml`
- [ ] Remove `npm audit fix --force` from any automated workflow
- [ ] Create reusable composite actions for common patterns (setup-node, docker-build, deploy)
- [ ] Standardize Node.js version across all workflows (use `.nvmrc` or `engines` field)

**Definition of Done**:
- [ ] Single unified CI workflow with clear stages: lint → test → build → deploy-staging → deploy-production
- [ ] Real deployment to staging works on merge to main
- [ ] All actions use latest stable versions (v4/v5)
- [ ] All workflows have top-level `permissions: read-all`
- [ ] Security steps fail the pipeline on findings (no `continue-on-error`)
- [ ] Frontend production Docker image serves files correctly
- [ ] All CI test commands execute successfully

---

#### US-E0-010: Observability Stack Real-ification
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: None (can parallel with US-E0-009)
**Estimated Time**: 10-14 hours (2-3 days)
**Audit Reference**: Observability Audit — score 2.6/5

**Description**: Monitoring infrastructure is largely simulated. Replace simulations with real integrations so v2.0 can be reliably operated and debugged.

**Subtasks**:
- [ ] Replace Sentry simulation class (`packages/frontend/src/monitoring/sentry.ts`) with real `@sentry/react` SDK integration
- [ ] Add real `@sentry/node` to backend with proper error boundary and breadcrumbs
- [ ] Replace `Math.random()` in HealthCheckService with real system metrics (DB ping, Redis ping, BullMQ queue health)
- [ ] Replace hand-rolled Prometheus text format in `deployment-monitoring.ts` with `prom-client` library (histograms, counters, gauges)
- [ ] Wire Winston through request lifecycle with correlation IDs (request ID propagated via `cls-hooked` or AsyncLocalStorage)
- [ ] Create actual Loki/Promtail configuration files (currently referenced but missing)
- [ ] Define SLOs/SLIs for core API endpoints: p99 latency < 500ms, error rate < 1%, availability > 99.5%
- [ ] Define SLOs for BullMQ queues: job completion rate > 99%, p95 processing time per queue type
- [ ] Fix hardcoded Grafana admin password in docker-compose monitoring config
- [ ] Add real Web Vitals reporting to frontend (LCP, FID, CLS → Sentry performance)

**Definition of Done**:
- [ ] Sentry captures real errors in both frontend and backend (verified with test error)
- [ ] Health endpoint returns real metrics (DB connected: true/false, Redis latency, queue depth)
- [ ] Prometheus metrics scrapeable by Prometheus at `/metrics` endpoint using `prom-client`
- [ ] Every API request has a correlation ID in logs
- [ ] SLO definitions documented in `/docs/observability/slos.md`
- [ ] Grafana admin password sourced from environment variable, not hardcoded
- [ ] 95%+ test coverage on health check and metrics code

---

#### US-E0-011: Security Pipeline Hardening
**Priority**: P1-HIGH
**Agent**: backend (security scope)
**Dependencies**: US-E0-008
**Estimated Time**: 6-8 hours (1-2 days)
**Audit Reference**: Security Audit HIGH findings

**Description**: Harden security middleware and pipeline based on audit findings. Enforce CSRF, tighten CSP, enable database SSL, and wire the Redis rate limiter.

**Subtasks**:
- [ ] Implement CSRF middleware that generates tokens on GET and validates on all state-changing requests (double-submit cookie pattern)
- [ ] Wire CSRF middleware into all v1 and v2 route-level middleware (not just checking if headers happen to exist)
- [ ] Remove `'unsafe-inline'` from default CSP script-src in `security-headers.ts`; verify nonce-based scripts work
- [ ] Ensure production CSP config (`HeaderConfigurationManager`) loads in production (not the default with `unsafe-inline`)
- [ ] Set `DB_SSL=true` in production environment configuration; enforce `sslmode=require` in DATABASE_URL
- [ ] Wire Redis-backed rate limiter's `sendCommand` to real Redis (currently stub that returns null)
- [ ] Remove rate limit bypass header (`x-bypass-rate-limit`) or restrict to development only with NODE_ENV check
- [ ] Remove `soft_fail: true` from Checkov and `no-fail: true` from Hadolint in `docker-security-scan.yml`
- [ ] Update Nginx base image from 1.24 (EOL) to latest stable (1.26+) in `docker-compose.secure.yml`

**Definition of Done**:
- [ ] CSRF token generated and validated on all state-changing routes (POST/PUT/DELETE)
- [ ] Production CSP has no `'unsafe-inline'` in script-src
- [ ] Database connections use SSL in production
- [ ] Rate limiter uses Redis for shared state across instances
- [ ] Security scanning tools fail on findings (not soft-fail)
- [ ] Nginx image updated to non-EOL version
- [ ] 95%+ test coverage on CSRF middleware

---

## P1 Upgrade Stories (Run During Early Epics)

These upgrades from the architecture assessment are not blocking but should be completed during early v2.0 development. New v2 code should be written with upgraded tooling from day one. See `docs/reviews/architecture-assessment.md` §4.1 for full details.

| Story | Effort | Timing | Benefits |
|-------|--------|--------|----------|
| React 18 → 19 | 8-12h | Before/during EPIC-007 | Actions, Compiler, cleaner APIs |
| Jest → Vitest | 12-16h | During EPIC-007/008 | 30-70% faster tests, native TS |
| Vite 5 → 6 | 4-6h | Before EPIC-007 | 5x faster builds, Rolldown |
| Tailwind v3 → v4 | 6-10h | Before EPIC-007 | Container queries, 5x faster builds |
| Turborepo | 4-6h | Before EPIC-007 | 40-60% CI time reduction |
| Remove inversify | 2-4h | During any epic | Remove unused dependency (TD-004) |
| Replace react-beautiful-dnd | 2-4h | During EPIC-010 | Unmaintained, no React 19 support (TD-008) |

**Total P1 effort**: ~55-82 hours. These can be parallelized with feature work or tackled as a second infrastructure sprint.

**Technology debt register**: 16 items tracked in `docs/reviews/architecture-assessment.md` §5. Version matrix of 25+ dependencies in Appendix.

---

## EPIC-007: Creator Wellness System

**PRD Domain**: Domain 1 — Creator Wellness
**Team-Builder Tier**: `standard`
**Team-Builder Runs**: 1
**Stories**: 10 implementation stories (from 4 PRD stories)
**Dependencies**: None (builds on existing analytics infrastructure)
**Estimated Duration**: 1 week

### Why Standard Tier
New feature domain with frontend-heavy work. No payment flows or security-sensitive operations. Needs architect for data model, backend for APIs, frontend for dashboard, and QA for wellness metric accuracy.

### Team-Builder Command
```
/team-builder standard Creator Wellness System - wellness dashboard with burnout detection, sustainable scheduling assistant, creator boundary controls, and wellness insights. Build new feature module at packages/frontend/src/features/wellness/ and backend API at packages/backend/src/routes/v2/wellness/. Database tables: wellness_snapshots, creator_work_patterns. All wellness data is private to the creator - never shared or used for platform metrics.
```

### Implementation Stories

#### US-E7-001: Wellness Data Model & Migration
**Priority**: P0-CRITICAL
**Agent**: architect → backend
**Dependencies**: None (start immediately)
**Estimated Time**: 2 hours

**Description**: Design and implement the wellness data model with database migrations.

**Subtasks**:
- [ ] Create `wellness_snapshots` table (creator_id, energy, motivation, stress, work_hours, created_at)
- [ ] Create `creator_work_patterns` table (creator_id, date, content_time_mins, engagement_time_mins, management_time_mins, total_hours)
- [ ] Add RLS policies: creators can only read/write their own wellness data
- [ ] Create Supabase migration file
- [ ] Define TypeScript types in `packages/shared/src/types/wellness.ts`

**Definition of Done**:
- [ ] Migration runs without errors
- [ ] RLS policies tested (cross-creator access blocked)
- [ ] Types exported from shared package

---

#### US-E7-002: Work Pattern Tracking API
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: US-E7-001
**Estimated Time**: 3 hours

**Description**: Backend API endpoints that track creator work patterns from content creation, engagement, and management activities.

**Subtasks**:
- [ ] `POST /api/v2/wellness/patterns` — Record work activity (type, duration, timestamp)
- [ ] `GET /api/v2/wellness/patterns?period=7d|30d|90d` — Retrieve aggregated work patterns
- [ ] `GET /api/v2/wellness/patterns/heatmap` — Return hourly heatmap data for work activity
- [ ] Auto-tracking middleware: log content publish, DM sends, analytics views as implicit work events
- [ ] Zod validation schemas for all endpoints
- [ ] Rate limiting per creator

**Definition of Done**:
- [ ] All endpoints return correct data shapes
- [ ] Auto-tracking captures events without manual logging
- [ ] 95%+ test coverage on wellness routes

---

#### US-E7-003: Burnout Risk Scoring Engine
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E7-002
**Estimated Time**: 3 hours

**Description**: Algorithm that scores burnout risk based on work patterns, posting frequency changes, and engagement drops.

**Subtasks**:
- [ ] `GET /api/v2/wellness/risk-score` — Return current burnout risk (low/moderate/high/critical)
- [ ] Scoring factors: work hours trend, posting frequency spike, engagement drop, irregular hours, rest day deficit
- [ ] Baseline calibration: first 2 weeks of data establish personal baseline
- [ ] Historical risk score tracking (weekly snapshots)
- [ ] Configurable sensitivity (creator can adjust thresholds)

**Algorithm Specification**:
- **Scoring formula**: Weighted sum of 5 factors, normalized to 0-100 scale
  - Work hours trend (weight: 0.25) — weekly hours vs personal baseline; >120% triggers contribution
  - Posting frequency spike (weight: 0.20) — posts/week vs 4-week rolling average; >150% triggers contribution
  - Engagement drop (weight: 0.20) — engagement rate vs 4-week average; <70% triggers contribution
  - Hour regularity (weight: 0.15) — standard deviation of daily work start/end times; high variance triggers contribution
  - Rest day deficit (weight: 0.20) — days with <30min of tracked activity per week; <2 rest days triggers contribution
- **Thresholds**: Low (0-25), Moderate (26-50), High (51-75), Critical (76-100)
- **Test scenarios**:
  - Scenario A: Creator works 40hrs/week, regular hours, 2 rest days → Expected: Low (score ~15)
  - Scenario B: Creator works 60hrs/week, posting 3x normal, engagement stable → Expected: Moderate (score ~40)
  - Scenario C: Creator works 70hrs/week, irregular hours, 0 rest days, engagement dropping → Expected: Critical (score ~85)

**Definition of Done**:
- [ ] Risk score algorithm produces correct results for all 3 test scenarios above
- [ ] Baseline calibration period handled (no alerts before 14 days of data)
- [ ] Unit tests cover all scoring edge cases with known inputs/outputs
- [ ] 95%+ test coverage on scoring engine

---

#### US-E7-004: Wellness Dashboard UI
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E7-002, US-E7-003
**Estimated Time**: 4 hours

**Description**: New feature module with wellness dashboard showing work patterns, burnout risk, and rest metrics.

**PRD Story**: US-201

**Subtasks**:
- [ ] Create `packages/frontend/src/features/wellness/` feature module
- [ ] `WellnessDashboard` component — main dashboard view
- [ ] `WorkPatternHeatmap` component — hourly heatmap of work activity by day
- [ ] `BurnoutRiskGauge` component — visual risk indicator (green/yellow/orange/red)
- [ ] `RestDayTracker` component — streak counter and work/rest ratio
- [ ] `SustainablePaceIndicator` — compares current posting frequency to personal sustainable baseline
- [ ] Integration with existing CreatorDashboard as a new tab
- [ ] Responsive design for mobile

**Definition of Done**:
- [ ] Dashboard renders with real and empty data states
- [ ] All components tested with React Testing Library
- [ ] Accessible (ARIA labels, keyboard navigable)
- [ ] Integrates as tab in existing CreatorDashboard

---

#### US-E7-005: Sustainable Scheduling Assistant
**Priority**: P1-HIGH
**Agent**: frontend + backend
**Dependencies**: US-E7-003
**Estimated Time**: 4 hours

**Description**: AI-assisted scheduling that recommends sustainable posting cadences and manages the creator's content buffer.

**PRD Story**: US-202

**Subtasks**:
- [ ] `GET /api/v2/wellness/schedule/recommendations` — Return optimal posting frequency and best times
- [ ] `GET /api/v2/wellness/buffer-depth` — Return how many days of scheduled content exist
- [ ] `SustainableScheduler` component — shows recommended cadence vs current cadence
- [ ] `CreativeBuffer` component — visual indicator of content buffer depth with threshold alert
- [ ] `BatchCreationWindows` component — suggests productive hours for content creation
- [ ] Connect to existing content scheduling (US-072) infrastructure
- [ ] Alert when content buffer drops below creator-set threshold

**Definition of Done**:
- [ ] Recommendations based on actual creator performance data
- [ ] Buffer depth accurately counts scheduled future content
- [ ] Integrates with existing scheduling without breaking it

---

#### US-E7-006: Creator Boundaries Controls
**Priority**: P1-HIGH
**Agent**: frontend + backend
**Dependencies**: US-E7-001
**Estimated Time**: 3 hours

**Description**: Configurable focus hours, engagement limits, auto-responses, and DND mode.

**PRD Story**: US-203

**Subtasks**:
- [ ] `PUT /api/v2/wellness/boundaries` — Save boundary configuration
- [ ] `GET /api/v2/wellness/boundaries` — Retrieve current settings
- [ ] `BoundarySettings` component — configure focus hours, weekly engagement budget, DND
- [ ] `CreatorAvailabilityStatus` component — public-facing status indicator (available/creating/offline)
- [ ] Auto-response template editor for off-hours DMs
- [ ] Notification batching during DND (queue and deliver on resume)
- [ ] Extend existing NotificationSettings with boundary integration

**Definition of Done**:
- [ ] Focus hours silence notifications correctly
- [ ] Auto-responses send via existing NOSTR DM system
- [ ] Status visible on creator's public profile

---

#### US-E7-007: Wellness Pulse Check-Ins
**Priority**: P2-MEDIUM
**Agent**: frontend + backend
**Dependencies**: US-E7-001
**Estimated Time**: 2 hours

**Description**: Optional weekly wellness pulse survey with trend visualization.

**PRD Story**: US-204

**Subtasks**:
- [ ] `POST /api/v2/wellness/pulse` — Record pulse check-in (energy, motivation, stress: 1-5 scale)
- [ ] `GET /api/v2/wellness/pulse/history` — Retrieve pulse history
- [ ] `WellnessPulseModal` component — gentle weekly prompt (dismissible, never nagging)
- [ ] `WellnessTrend` component — line chart of pulse scores over time
- [ ] Anonymous benchmarking API: `GET /api/v2/wellness/benchmark` — aggregate stats (no individual data)
- [ ] Opt-in only, stored locally, deletable at any time

**Definition of Done**:
- [ ] Pulse data never leaves creator's own records
- [ ] Benchmarking uses only anonymized aggregates
- [ ] Check-in prompt respects opt-out permanently

---

#### US-E7-008: Wellness Resource Library
**Priority**: P3-LOW
**Agent**: frontend
**Dependencies**: None
**Estimated Time**: 1 hour

**Description**: Curated static resource library for creator mental health (articles, communities, tools).

**Subtasks**:
- [ ] `WellnessResources` component — categorized resource cards
- [ ] Static data file with initial curated resources
- [ ] Categories: communities, articles, tools, crisis resources
- [ ] Filterable by category
- [ ] Link out to external resources (not hosted on Sovren)

**Definition of Done**:
- [ ] Resources render with correct links
- [ ] Accessible and mobile-responsive

---

#### US-E7-009: Wellness Feature Integration Tests
**Priority**: P1-HIGH
**Agent**: qa
**Dependencies**: US-E7-004, US-E7-005, US-E7-006
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] E2E test: Navigate to wellness dashboard, verify data renders
- [ ] E2E test: Set boundary controls, verify notifications suppressed during focus hours
- [ ] E2E test: Submit wellness pulse, verify trend chart updates
- [ ] Integration test: Work pattern tracking captures content publish events
- [ ] Integration test: Burnout risk score updates when patterns change

---

#### US-E7-010: Wellness Feature Documentation
**Priority**: P2-MEDIUM
**Agent**: qa (or architect)
**Dependencies**: All US-E7-* stories
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Mermaid architecture diagram for wellness data flow
- [ ] Mermaid component interaction diagram
- [ ] CHANGELOG.md entry
- [ ] Update CLAUDE.md if new patterns introduced
- [ ] ADR for wellness data privacy model

---

## EPIC-008: Content Shield (AI Protection)

**PRD Domain**: Domain 2 — Content Shield
**Team-Builder Tier**: `standard`
**Team-Builder Runs**: 1
**Stories**: 11 implementation stories (from 4 PRD stories; US-E8-004 split into 3)
**Dependencies**: None (builds on existing NOSTR infrastructure)
**Estimated Duration**: 1.5 weeks

### Why Standard Tier
Cryptographic signing builds on existing NOSTR key infrastructure. Needs architect for provenance chain design, backend for fingerprinting/scanning, frontend for badges and alerts, QA for verification flows.

### Team-Builder Command
```
/team-builder standard Content Shield - cryptographic content provenance, perceptual fingerprinting, AI copy detection alerts, and authenticity verification badges. Extends NOSTR event signing with provenance metadata. New tables: content_fingerprints, provenance_records, content_alerts. Build at packages/frontend/src/features/content-shield/ and packages/backend/src/services/provenance/.
```

### Implementation Stories

#### US-E8-001: Provenance Data Model & NOSTR Event Extension
**Priority**: P0-CRITICAL
**Agent**: architect → backend
**Dependencies**: None
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] Design provenance chain schema (content_id → nostr_event_id → signature → relay_confirmations)
- [ ] Create `provenance_records` table with migration
- [ ] Create `content_fingerprints` table (content_id, hash_type, hash_value, created_at)
- [ ] Create `content_alerts` table (creator_id, content_id, detected_copy_url, confidence, status)
- [ ] Define NOSTR event tag extension for provenance metadata (NIP-compliant)
- [ ] TypeScript types in `packages/shared/src/types/provenance.ts`

**Definition of Done**:
- [ ] Migration runs without errors on clean and existing databases
- [ ] RLS policies tested (cross-creator access blocked)
- [ ] Types exported from shared package and importable
- [ ] 95%+ test coverage on data access layer

---

#### US-E8-002: Content Provenance Signing Service
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: US-E8-001
**Estimated Time**: 3 hours

**PRD Story**: US-211

**Subtasks**:
- [ ] `ProvenanceService` — signs content with creator's NOSTR key at publish time
- [ ] Embed provenance tags in NOSTR events (author pubkey, timestamp, content hash, relay list)
- [ ] `GET /api/v2/shield/provenance/:contentId` — Return provenance chain for a content piece
- [ ] Provenance certificate export (JSON format for legal/DMCA use)
- [ ] Hook into existing content publish pipeline (auto-sign all new content)

**Definition of Done**:
- [ ] Content signed with creator's NOSTR key and provenance record created
- [ ] Provenance chain retrievable via API with correct data
- [ ] Certificate export contains all required fields for DMCA use
- [ ] 95%+ test coverage on provenance service

---

#### US-E8-003: Content Fingerprinting Service
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E8-001
**Estimated Time**: 3 hours

**PRD Story**: US-212

**Subtasks**:
- [ ] Text fingerprinting: SimHash for text content at publish time
- [ ] Image fingerprinting: pHash for image attachments at publish time
- [ ] `POST /api/v2/shield/fingerprint` — Manual fingerprint registration (for existing content)
- [ ] `GET /api/v2/shield/fingerprints/:creatorId` — Creator's fingerprint registry
- [ ] `POST /api/v2/shield/compare` — Compare a hash against creator's registry (returns similarity score)
- [ ] Batch fingerprinting job for existing published content

**Definition of Done**:
- [ ] SimHash generated for text content with consistent results
- [ ] pHash generated for image content with consistent results
- [ ] Comparison API returns correct similarity scores for known test pairs
- [ ] Batch job fingerprints existing content without errors
- [ ] 95%+ test coverage on fingerprinting service

---

#### US-E8-004a: NOSTR Relay Content Scanner Job
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E8-003, US-E0-001 (BullMQ)
**Estimated Time**: 3 hours

**PRD Story**: US-213

**Subtasks**:
- [ ] BullMQ scheduled job: connect to configurable list of NOSTR relays
- [ ] Relay subscription management (connect, subscribe to text/image events, manage reconnection)
- [ ] Content ingestion pipeline: receive events, extract content, compute fingerprints
- [ ] Comparison engine: compare incoming fingerprints against creator's registered fingerprints
- [ ] Similarity scoring (exact copy >95%, derivative 70-95%, coincidental <70%)
- [ ] `content_alerts` creation when match found above configurable threshold
- [ ] Rate limiting to avoid relay bans (configurable requests-per-minute per relay)

**Definition of Done**:
- [ ] Scanner job runs on schedule and connects to at least 3 relays
- [ ] Fingerprint comparison returns correct similarity scores for test data
- [ ] Alerts created for matches above threshold
- [ ] Rate limiting prevents relay bans
- [ ] 95%+ test coverage

---

#### US-E8-004b: Alert Management API
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E8-004a
**Estimated Time**: 2 hours

**PRD Story**: US-213

**Subtasks**:
- [ ] `GET /api/v2/shield/alerts?status=new|reviewed|resolved` — Creator's alert feed
- [ ] `PUT /api/v2/shield/alerts/:id` — Update alert status (reviewed, false_positive, reported)
- [ ] Alert detail endpoint with side-by-side comparison data (original vs detected copy)
- [ ] Integrate with existing NotificationCenter for real-time alerts
- [ ] Alert count badge for Content Shield nav item

**Definition of Done**:
- [ ] Alert CRUD operations work with correct RLS
- [ ] NotificationCenter shows new alerts in real-time
- [ ] Alert status transitions validated (new → reviewed → resolved/false_positive/reported)
- [ ] 95%+ test coverage

---

#### US-E8-004c: DMCA Report Generator
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E8-004b, US-E8-002
**Estimated Time**: 2 hours

**PRD Story**: US-213

**Subtasks**:
- [ ] DMCA report template with required legal fields
- [ ] Populate template with provenance proof (creator signature, timestamp, relay confirmations)
- [ ] Include copy evidence (detected content URL, similarity score, comparison data)
- [ ] `POST /api/v2/shield/alerts/:id/dmca-report` — Generate report
- [ ] Export as PDF and JSON formats
- [ ] Rate limit DMCA report generation to prevent abuse

**Definition of Done**:
- [ ] DMCA report contains all required provenance data
- [ ] Report exportable as PDF and JSON
- [ ] Rate limiting prevents report spam
- [ ] 95%+ test coverage

---

#### US-E8-005: Authenticity Verification Badge UI
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E8-002
**Estimated Time**: 3 hours

**PRD Story**: US-214

**Subtasks**:
- [ ] `AuthenticityBadge` component — visual indicator (verified original / unverified / disputed)
- [ ] Badge click-through: provenance chain viewer showing cryptographic proof
- [ ] Integrate badge into existing `FeedItem` component
- [ ] Integrate badge into content detail pages
- [ ] NIP-05 + provenance combined verification display

**Definition of Done**:
- [ ] Badge renders in all 3 states (verified/unverified/disputed)
- [ ] Click-through displays correct provenance chain data
- [ ] Badge integrates into FeedItem and content detail pages
- [ ] Accessible (ARIA labels, screen reader friendly)
- [ ] 85%+ test coverage on badge components

---

#### US-E8-006: Content Shield Dashboard
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E8-003, US-E8-004
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] Create `packages/frontend/src/features/content-shield/` feature module
- [ ] `ShieldDashboard` component — provenance registry overview, coverage stats
- [ ] `AlertsFeed` component — detected copies with side-by-side comparison
- [ ] `DMCAReportButton` component — one-click report generation
- [ ] `FingerprintCoverage` component — how many content pieces are fingerprinted
- [ ] Alert resolution workflow (review → false_positive | report)

**Definition of Done**:
- [ ] Dashboard renders with real and empty data states
- [ ] Alerts feed shows detected copies with side-by-side comparison
- [ ] DMCA report generation works from dashboard
- [ ] Fingerprint coverage stats accurately reflect creator's registry
- [ ] 85%+ test coverage on dashboard components

---

#### US-E8-007: Provenance Auto-Signing Integration
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: US-E8-002
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Hook provenance signing into existing `POST /api/v1/content/publish` pipeline
- [ ] Ensure backward compatibility (existing content without provenance still works)
- [ ] Add provenance tags to NOSTR event creation in shared package
- [ ] Verify signing works with all key management methods (extension, manual)

**Definition of Done**:
- [ ] All new content auto-signed without user intervention
- [ ] Existing content without provenance continues to work (backward compatible)
- [ ] Provenance tags present in NOSTR events
- [ ] 95%+ test coverage on integration hooks

---

#### US-E8-008: Content Shield Integration Tests
**Priority**: P1-HIGH
**Agent**: qa
**Dependencies**: US-E8-005, US-E8-006
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] E2E test: Publish content → verify provenance badge appears
- [ ] E2E test: View provenance chain → verify cryptographic data displayed
- [ ] Integration test: Fingerprint generation on content publish
- [ ] Integration test: Copy detection finds matching content
- [ ] Integration test: DMCA report contains correct provenance data

**Definition of Done**:
- [ ] All E2E tests pass in Chromium, Firefox, and WebKit
- [ ] All integration tests pass with 95%+ coverage
- [ ] No regressions in existing content publish test suite

---

#### US-E8-009: Content Shield Documentation
**Priority**: P2-MEDIUM
**Agent**: architect
**Dependencies**: All US-E8-* stories
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Mermaid diagram: provenance chain data flow
- [ ] Mermaid diagram: copy detection scanner architecture
- [ ] ADR: Content fingerprinting algorithm choices
- [ ] CHANGELOG.md entry

**Definition of Done**:
- [ ] All Mermaid diagrams render correctly in GitHub
- [ ] ADR documents fingerprinting algorithm choice with rationale
- [ ] CHANGELOG entry follows conventional commit format

---

## EPIC-009: Multi-Platform Hub

**PRD Domain**: Domain 3 — Multi-Platform Hub
**Team-Builder Tier**: `enterprise`
**Team-Builder Runs**: 2 (Wave A: publishing + repurposing, Wave B: inbox + analytics)
**Stories**: 12 implementation stories (from 4 PRD stories)
**Dependencies**: None (new feature domain, but benefits from EPIC-008 provenance for cross-posted content)
**Estimated Duration**: 2 weeks

### Why Enterprise Tier
External OAuth integration is security-sensitive (storing platform tokens). Cross-platform publishing requires reliable job queue infrastructure (factory phase). Touches user credentials and external APIs — needs security audit.

### Team-Builder Command (Wave A)
```
/team-builder enterprise Multi-Platform Hub Wave A - Cross-platform publisher and content repurposing engine. OAuth connections to X/Twitter, YouTube, Bluesky, Mastodon. Job queue (BullMQ) for reliable cross-posting with retry logic. New tables: platform_connections, cross_posts, repurposed_content. Build at packages/frontend/src/features/multi-platform/ and packages/backend/src/services/distribution/. OAuth tokens must be encrypted at rest with AES-256.
```

### Team-Builder Command (Wave B)
```
/team-builder standard Multi-Platform Hub Wave B - Unified engagement inbox and cross-platform analytics. Aggregate comments, replies, DMs from connected platforms into single inbox. Cross-platform performance comparison dashboard. Build on existing packages/frontend/src/features/multi-platform/ and packages/backend/src/services/distribution/.
```

### Implementation Stories — Wave A

#### US-E9-001: Platform Connection Data Model
**Priority**: P0-CRITICAL
**Agent**: architect → backend
**Dependencies**: None
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] Create `platform_connections` table (creator_id, platform, access_token_encrypted, refresh_token_encrypted, scopes, connected_at, expires_at)
- [ ] Create `cross_posts` table (content_id, platform, platform_post_id, status, scheduled_at, published_at, error_message, metrics_json)
- [ ] Create `repurposed_content` table (source_content_id, platform, repurposed_text, format_type, approved, published)
- [ ] AES-256 encryption layer for OAuth tokens (use existing vault service)
- [ ] RLS: creators only access their own connections
- [ ] TypeScript types in `packages/shared/src/types/distribution.ts`

**Definition of Done**:
- [ ] Migration runs without errors
- [ ] AES-256-GCM encryption layer encrypts/decrypts tokens correctly
- [ ] RLS policies tested (cross-creator access blocked)
- [ ] Types exported from shared package
- [ ] 95%+ test coverage

---

#### US-E9-002: OAuth Platform Connection Service
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: US-E9-001
**Estimated Time**: 6 hours

**Subtasks**:
- [ ] `POST /api/v2/platforms/connect/:platform` — Initiate OAuth flow (X, YouTube, Bluesky, Mastodon)
- [ ] `GET /api/v2/platforms/callback/:platform` — OAuth callback handler
- [ ] `DELETE /api/v2/platforms/disconnect/:platform` — Revoke and remove connection
- [ ] `GET /api/v2/platforms/status` — Return connected platforms with status
- [ ] Token refresh scheduler (auto-refresh before expiry)
- [ ] Platform-specific adapters (each platform has its own OAuth flow)

**Definition of Done**:
- [ ] OAuth connect/disconnect works for at least 2 platforms (Mastodon, Bluesky)
- [ ] Tokens stored encrypted in database
- [ ] Token refresh scheduler auto-refreshes before expiry
- [ ] Platform status endpoint returns correct connection states
- [ ] 95%+ test coverage on OAuth service

---

#### US-E9-003: Cross-Platform Publishing Queue
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: US-E9-002, US-E0-001 (BullMQ)
**Estimated Time**: 6 hours

**PRD Story**: US-221

**Subtasks**:
- [ ] BullMQ job queue setup for cross-platform publishing
- [ ] `POST /api/v2/distribute/publish` — Queue content for distribution to selected platforms
- [ ] Platform adapters: X (character limit, threads), YouTube (description, tags), Bluesky (AT Protocol), Mastodon (ActivityPub)
- [ ] Per-platform formatting (character limits, media requirements, hashtag handling)
- [ ] Retry logic with exponential backoff (dead letter queue for permanent failures)
- [ ] `GET /api/v2/distribute/status/:contentId` — Cross-post status per platform
- [ ] Scheduled publishing support (publish at different times per platform)

**Definition of Done**:
- [ ] Content queued and published to at least 2 platforms successfully
- [ ] Retry logic handles transient failures with exponential backoff
- [ ] Dead letter queue captures permanent failures
- [ ] Per-platform formatting applied correctly (character limits, media)
- [ ] 95%+ test coverage on publishing queue

---

#### US-E9-004: Content Repurposing Engine
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E9-003
**Estimated Time**: 6 hours

**PRD Story**: US-222

**Subtasks**:
- [ ] `POST /api/v2/distribute/repurpose` — Generate platform-optimized versions
- [ ] Long-form to thread converter (split by paragraphs/sections, add numbering)
- [ ] Long-form to summary converter (key takeaways extraction)
- [ ] Image resizing service (per-platform optimal dimensions)
- [ ] Rule-based content adaptation for MVP (platform-specific headline/hook formatting rules); optional LLM integration post-MVP
- [ ] `GET /api/v2/distribute/repurposed/:contentId` — Preview repurposed versions
- [ ] Creator approval flow (repurposed content is draft until approved)
- [ ] Backlink injection (repurposed versions include link to Sovren original)

**Definition of Done**:
- [ ] Long-form to thread conversion produces correctly numbered segments
- [ ] Image resizing produces correct dimensions for each platform
- [ ] Repurposed content saved as draft until creator approves
- [ ] Backlinks present in all repurposed versions
- [ ] 95%+ test coverage on repurposing engine

---

#### US-E9-005: Cross-Platform Publisher UI
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E9-002, US-E9-003
**Estimated Time**: 4 hours

**Subtasks**:
- [ ] Create `packages/frontend/src/features/multi-platform/` feature module
- [ ] `PlatformConnector` component — connect/disconnect external accounts
- [ ] `DistributionPanel` component — select platforms and preview per-platform formatting
- [ ] `CrossPostQueue` component — scheduled cross-posts with status tracking
- [ ] `RepurposePreview` component — side-by-side preview of repurposed formats
- [ ] Integration with existing content editor (add "Distribute" step after publish)
- [ ] Platform status indicators (connected, token expiring, error)

**Definition of Done**:
- [ ] Platform connector shows connect/disconnect for each platform
- [ ] Distribution panel previews content per platform correctly
- [ ] Cross-post queue shows scheduled and completed posts with status
- [ ] All components tested with React Testing Library
- [ ] 85%+ test coverage on UI components

---

#### US-E9-006: Wave A Integration Tests & Security Audit
**Priority**: P0-CRITICAL
**Agent**: qa + security-audit
**Dependencies**: US-E9-003, US-E9-005
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] E2E test: Connect platform → publish content → verify cross-post appears
- [ ] Integration test: OAuth flow completes and tokens stored encrypted
- [ ] Integration test: Publishing queue retries on failure
- [ ] Security audit: Token storage encryption verified
- [ ] Security audit: OAuth state parameter prevents CSRF
- [ ] Security audit: No token leakage in logs or error messages

**Definition of Done**:
- [ ] All E2E and integration tests pass
- [ ] Security audit confirms encrypted token storage, CSRF protection, no token leakage
- [ ] No regressions in existing test suite
- [ ] 95%+ test coverage on new code

---

### Implementation Stories — Wave B

#### US-E9-007: Unified Inbox Backend
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E9-002 (platform connections)
**Estimated Time**: 6 hours

**PRD Story**: US-223

**Subtasks**:
- [ ] `GET /api/v2/inbox/messages?platform=all|x|youtube|nostr&status=unread|all` — Aggregated inbox
- [ ] Platform polling service: fetch new comments/DMs/mentions from connected platforms
- [ ] `POST /api/v2/inbox/reply/:messageId` — Reply routed to correct platform
- [ ] `PUT /api/v2/inbox/batch` — Batch actions (mark read, archive)
- [ ] Message normalization layer (convert each platform's format to unified schema)
- [ ] Polling frequency configuration per platform (respect rate limits)

**Definition of Done**:
- [ ] Aggregated inbox returns messages from connected platforms
- [ ] Reply routing sends response to correct platform
- [ ] Batch actions (mark read, archive) work correctly
- [ ] Message normalization produces consistent schema across platforms
- [ ] 95%+ test coverage on inbox service

---

#### US-E9-008: Cross-Platform Analytics Backend
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E9-002 (platform connections)
**Estimated Time**: 3 hours

**PRD Story**: US-224

**Subtasks**:
- [ ] `GET /api/v2/analytics/cross-platform/overview` — Aggregate followers/engagement across platforms
- [ ] `GET /api/v2/analytics/cross-platform/comparison/:contentId` — Same content, different platforms
- [ ] `GET /api/v2/analytics/cross-platform/roi` — Engagement-per-hour-invested per platform
- [ ] Platform metrics polling (follower count, post engagement, subscriber count)
- [ ] Historical metrics storage for trend analysis

**Definition of Done**:
- [ ] Overview endpoint returns aggregate metrics across platforms
- [ ] Content comparison shows same content performance on different platforms
- [ ] ROI metric calculated correctly per platform
- [ ] Historical metrics stored and retrievable for trend analysis
- [ ] 95%+ test coverage on analytics service

---

#### US-E9-009: Unified Inbox UI
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E9-007
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] `UnifiedInbox` component — all messages with platform badges
- [ ] Filter bar: platform, sentiment, priority, read/unread
- [ ] Reply-in-place: compose response that routes to correct platform
- [ ] Batch action toolbar (mark read, archive, template reply)
- [ ] Template manager for common responses
- [ ] Real-time updates via WebSocket for new messages

**Definition of Done**:
- [ ] Inbox displays messages with correct platform badges
- [ ] Filter bar filters by platform, sentiment, priority, read/unread
- [ ] Reply-in-place correctly routes to source platform
- [ ] Batch actions work on multi-selected messages
- [ ] 85%+ test coverage on inbox UI components

---

#### US-E9-010: Cross-Platform Analytics UI
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E9-008
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] `CrossPlatformDashboard` component — aggregate metrics view
- [ ] `PlatformComparison` component — side-by-side performance per platform
- [ ] `PlatformROI` component — engagement/hour metric with platform ranking
- [ ] `AudienceOverlap` component — estimated overlap between platforms
- [ ] Integration with existing analytics dashboard as a new tab

**Definition of Done**:
- [ ] Dashboard renders aggregate metrics from all connected platforms
- [ ] Platform comparison shows side-by-side performance data
- [ ] ROI ranking displays platforms ordered by engagement/hour
- [ ] Integrates as tab in existing analytics dashboard
- [ ] 85%+ test coverage on analytics UI components

---

#### US-E9-011: Wave B Integration Tests
**Priority**: P1-HIGH
**Agent**: qa
**Dependencies**: US-E9-009, US-E9-010
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] E2E test: Navigate to unified inbox, verify messages from multiple platforms displayed
- [ ] E2E test: Reply to a message, verify it routes to correct platform
- [ ] E2E test: Navigate to cross-platform analytics, verify aggregate data renders
- [ ] Integration test: Inbox polling fetches new messages from connected platforms
- [ ] Integration test: Analytics metrics aggregate correctly across platforms

**Definition of Done**:
- [ ] All E2E tests pass in Chromium and Firefox
- [ ] All integration tests pass with 95%+ coverage
- [ ] No regressions in existing test suite

---

#### US-E9-012: Multi-Platform Documentation
**Priority**: P2-MEDIUM
**Agent**: architect
**Dependencies**: All US-E9-*
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Mermaid diagram: cross-platform publishing queue architecture
- [ ] Mermaid diagram: unified inbox message flow
- [ ] ADR: Platform adapter abstraction pattern
- [ ] ADR: OAuth token storage encryption approach
- [ ] CHANGELOG.md entry

**Definition of Done**:
- [ ] All Mermaid diagrams render correctly in GitHub
- [ ] ADRs document platform adapter pattern and token encryption approach
- [ ] CHANGELOG entry follows conventional commit format

---

## EPIC-010: Creator Network

**PRD Domain**: Domain 4 — Creator Network
**Team-Builder Tier**: `enterprise`
**Team-Builder Runs**: 1
**Stories**: 11 implementation stories (from 4 PRD stories; US-E10-006 split into 3)
**Dependencies**: EPIC-008 (provenance signing for collaborative content attribution)
**Estimated Duration**: 1.5-2 weeks

### Why Enterprise Tier
Lightning escrow (marketplace) and payment splitting (collaborative content) involve temporary custodial fund handling, which is security-sensitive and requires security audit. Revenue split manipulation and escrow abuse are high-severity attack vectors that need dedicated security review.

### Team-Builder Command
```
/team-builder enterprise Creator Network - private creator circles with NOSTR encrypted group messaging, mentorship matching system, collaborative content with revenue splitting, and creator services marketplace with Lightning escrow. New tables: creator_circles, circle_members, mentorships, service_listings, service_orders. Build at packages/frontend/src/features/creator-network/ and packages/backend/src/services/community/. SECURITY: Payment splitting and escrow involve temporary custodial fund handling - requires security audit and ADR.
```

### Implementation Stories

#### US-E10-001: Creator Network Data Model
**Priority**: P0-CRITICAL
**Agent**: architect → backend
**Dependencies**: None
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] Create `creator_circles` table (id, name, description, niche, max_members, created_by, created_at)
- [ ] Create `circle_members` table (circle_id, creator_id, role: admin|member, joined_at)
- [ ] Create `mentorships` table (mentor_id, mentee_id, niche, goals_json, status, started_at)
- [ ] Create `service_listings` table (creator_id, service_type, title, description, price_sats, portfolio_urls, active)
- [ ] Create `service_orders` table (listing_id, buyer_id, seller_id, status, escrow_invoice_id, amount_sats)
- [ ] RLS policies for all tables
- [ ] TypeScript types in `packages/shared/src/types/community.ts`

**Definition of Done**:
- [ ] Migration runs without errors
- [ ] RLS policies tested (cross-creator access blocked, circle membership enforced)
- [ ] Types exported from shared package
- [ ] 95%+ test coverage on data access layer

---

#### US-E10-002: Creator Circles Backend
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E10-001
**Estimated Time**: 3 hours

**PRD Story**: US-231

**Subtasks**:
- [ ] `POST /api/v2/circles` — Create a circle
- [ ] `GET /api/v2/circles` — List circles (my circles + discoverable circles)
- [ ] `POST /api/v2/circles/:id/join` — Request to join
- [ ] `POST /api/v2/circles/:id/invite` — Invite a creator
- [ ] `GET /api/v2/circles/:id/feed` — Circle discussion feed (NOSTR encrypted group messages)
- [ ] Circle matching suggestion: `GET /api/v2/circles/suggested` — Based on niche, audience size, experience
- [ ] Member management (admin: approve/remove members)

**Definition of Done**:
- [ ] Circle CRUD operations work with correct RLS
- [ ] Circle matching returns relevant suggestions by niche and audience size
- [ ] Circle feed returns messages (NOSTR encrypted or Supabase-backed for MVP)
- [ ] Member management enforces 5-20 member limits
- [ ] 95%+ test coverage on circles service

---

#### US-E10-003: Mentorship Matching Backend
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E10-001
**Estimated Time**: 3 hours

**PRD Story**: US-232

**Subtasks**:
- [ ] `POST /api/v2/mentorship/register-mentor` — Opt-in as mentor with availability settings
- [ ] `GET /api/v2/mentorship/mentors?niche=&audienceSize=` — Browse available mentors
- [ ] `POST /api/v2/mentorship/request` — Request mentorship
- [ ] `PUT /api/v2/mentorship/:id/accept|decline` — Mentor responds
- [ ] `GET /api/v2/mentorship/my-mentorships` — Active mentorship relationships
- [ ] Structured program: goals, milestones, check-in tracking
- [ ] Mentor reputation calculation based on mentee growth metrics

**Definition of Done**:
- [ ] Mentor registration and browsing work with correct filters
- [ ] Mentorship request/accept workflow completes end-to-end
- [ ] Structured program tracks goals, milestones, and check-ins
- [ ] Mentor reputation scores calculated from mentee growth data
- [ ] 95%+ test coverage on mentorship service

---

#### US-E10-004: Collaborative Content Backend
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E10-001, EPIC-008 (provenance for co-author attribution)
**Estimated Time**: 6 hours

**PRD Story**: US-233

**Subtasks**:
- [ ] `POST /api/v2/content/collaborate` — Invite co-authors to content
- [ ] `PUT /api/v2/content/:id/revenue-split` — Configure percentage splits
- [ ] Revenue splitting in Lightning payment flow (auto-split incoming payments)
- [ ] Co-authored content appears on all co-authors' profiles
- [ ] Collaboration request/accept workflow via NOSTR DMs
- [ ] Provenance chain includes all co-author signatures

**Definition of Done**:
- [ ] Co-author invitation and acceptance workflow works end-to-end
- [ ] Revenue split configuration saves and validates (percentages sum to 100%)
- [ ] Lightning payment splitting distributes correct amounts to all co-authors
- [ ] Co-authored content appears on all co-authors' profiles
- [ ] Provenance chain includes all co-author signatures
- [ ] 95%+ test coverage on collaboration service

---

#### US-E10-005: Creator Marketplace Backend
**Priority**: P2-MEDIUM
**Agent**: backend
**Dependencies**: US-E10-001
**Estimated Time**: 5 hours

**PRD Story**: US-234

**Subtasks**:
- [ ] `POST /api/v2/marketplace/listings` — Create service listing
- [ ] `GET /api/v2/marketplace/listings?type=&priceRange=` — Browse listings
- [ ] `POST /api/v2/marketplace/orders` — Place order (creates Lightning escrow invoice)
- [ ] `PUT /api/v2/marketplace/orders/:id/complete` — Release escrow on completion
- [ ] `PUT /api/v2/marketplace/orders/:id/dispute` — Flag for dispute resolution
- [ ] Rating/review system for completed orders
- [ ] Portfolio showcase attached to listings

**Definition of Done**:
- [ ] Service listing CRUD operations work with correct RLS
- [ ] Lightning escrow invoice created on order placement
- [ ] Escrow releases on completion, auto-returns on timeout (30 days)
- [ ] Rating/review system records reviews for completed orders
- [ ] 95%+ test coverage on marketplace service

---

#### US-E10-006a: Circles & Mentorship UI
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E10-002, US-E10-003
**Estimated Time**: 5 hours

**Subtasks**:
- [ ] Create `packages/frontend/src/features/creator-network/` feature module
- [ ] `CirclesBrowser` component — discover and join circles
- [ ] `CircleFeed` component — discussion feed within a circle
- [ ] `MentorDirectory` component — browse and request mentors
- [ ] `MentorshipDashboard` component — track active mentorships

**Definition of Done**:
- [ ] Circle browsing, joining, and feed display working with real data
- [ ] Mentor directory filterable by niche, audience size
- [ ] All components tested with React Testing Library
- [ ] Accessible (ARIA labels, keyboard navigable)
- [ ] 85%+ test coverage on components

---

#### US-E10-006b: Collaboration & Marketplace UI
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E10-004, US-E10-005
**Estimated Time**: 5 hours

**Subtasks**:
- [ ] `CollaborationInvite` component — invite co-authors, set revenue splits
- [ ] `MarketplaceBrowser` component — browse service listings with filters
- [ ] `ServiceListingForm` component — create/edit service listing with portfolio
- [ ] `OrderTracker` component — track service order status with escrow indicators

**Definition of Done**:
- [ ] Revenue split configuration saves and displays correctly
- [ ] Marketplace browsing with filtering and sorting working
- [ ] Service listing creation with portfolio upload working
- [ ] All components tested with React Testing Library
- [ ] 85%+ test coverage on components

---

#### US-E10-006c: Creator Network Navigation Integration
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E10-006a, US-E10-006b
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Navigation integration: "Community" top-level nav item with sub-routes
- [ ] Tab-based layout within Community section (Circles, Mentorship, Collaborations, Marketplace)
- [ ] Mobile-responsive navigation for Community sub-pages
- [ ] Empty states for each section (no circles joined, no mentorships, etc.)

**Definition of Done**:
- [ ] Community nav item renders with all sub-routes
- [ ] Tab navigation works on desktop and mobile
- [ ] Empty states display correctly for new users
- [ ] 85%+ test coverage

---

#### US-E10-007: Creator Network Integration Tests
**Priority**: P1-HIGH
**Agent**: qa
**Dependencies**: US-E10-006c
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] E2E test: Browse circles, join a circle, view circle feed
- [ ] E2E test: Browse mentors, request mentorship, track program
- [ ] E2E test: Browse marketplace, create listing, place order
- [ ] Integration test: Circle membership enforces size limits
- [ ] Integration test: Mentorship matching returns relevant results

**Definition of Done**:
- [ ] All E2E tests pass in Chromium and Firefox
- [ ] All integration tests pass with 95%+ coverage
- [ ] No regressions in existing test suite

---

#### US-E10-008: Lightning Payment Split Tests
**Priority**: P0-CRITICAL
**Agent**: qa
**Dependencies**: US-E10-004
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Test: Collaborative content payment splits correctly to all co-authors
- [ ] Test: Marketplace escrow holds and releases correctly
- [ ] Test: Edge case — co-author removes themselves mid-subscription period
- [ ] Test: Split percentages always sum to 100%

**Definition of Done**:
- [ ] All payment splitting edge cases tested with known inputs/outputs
- [ ] Escrow hold and release verified with correct amounts
- [ ] Edge case: co-author removal mid-subscription tested
- [ ] 95%+ test coverage on payment split logic

---

#### US-E10-009: Creator Network Documentation
**Priority**: P2-MEDIUM
**Agent**: architect
**Dependencies**: All US-E10-*
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Mermaid diagram: creator circles and mentorship data flow
- [ ] Mermaid diagram: Lightning payment splitting architecture
- [ ] ADR: Custodial escrow design with timeout-based release
- [ ] ADR: NOSTR group messaging approach (Supabase-backed vs NIP-28/NIP-104)
- [ ] CHANGELOG.md entry

**Definition of Done**:
- [ ] All Mermaid diagrams render correctly in GitHub
- [ ] ADRs document custodial and messaging decisions with rationale
- [ ] CHANGELOG entry follows conventional commit format

---

## EPIC-011: Business Manager

**PRD Domain**: Domain 5 — Business Manager
**Team-Builder Tier**: `standard`
**Team-Builder Runs**: 1
**Stories**: 7 implementation stories (from 4 PRD stories)
**Dependencies**: EPIC-007 (wellness data feeds into business health view)
**Estimated Duration**: 1 week

### Why Standard Tier
While the backend is primarily CRUD, the frontend has 7+ UI components including charts (Revenue Mix donut, Red Flag Report) and financial data presentation that require proper frontend engineering. Standard tier provides architect + backend + frontend + QA. Note: soft dependency on EPIC-009 (cross-platform analytics for revenue diversification) is non-blocking -- EPIC-011 can start after EPIC-007 completes.

### Team-Builder Command
```
/team-builder standard Business Manager - contract templates with red flag analyzer, invoice generator with Lightning payment links, revenue diversification planner, and tax preparation assistant. New tables: contract_templates, contracts, invoices, expense_categories. Build at packages/frontend/src/features/business/ and packages/backend/src/services/finance/. All financial calculations use sats as base unit with USD conversion at time of receipt.
```

### Implementation Stories

#### US-E11-001: Business Data Model
**Priority**: P0-CRITICAL
**Agent**: architect → backend
**Dependencies**: None
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Create `contract_templates` table (id, name, category, template_text, red_flags_json)
- [ ] Create `contracts` table (creator_id, counterparty, template_id, filled_text, status, signed_at)
- [ ] Create `invoices` table (creator_id, client_name, line_items_json, total_sats, lightning_invoice, status, due_date)
- [ ] Create `expense_categories` table (creator_id, name, type: equipment|software|services|other)
- [ ] Create `expenses` table (creator_id, category_id, description, amount_sats, usd_at_time, date)
- [ ] TypeScript types in `packages/shared/src/types/finance.ts`

**Definition of Done**:
- [ ] Migration runs without errors
- [ ] RLS policies tested (cross-creator access blocked)
- [ ] Types exported from shared package
- [ ] 95%+ test coverage on data access layer

---

#### US-E11-002: Contract Templates & Red Flag Analyzer
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E11-001
**Estimated Time**: 3 hours

**PRD Story**: US-241

**Subtasks**:
- [ ] `GET /api/v2/business/contracts/templates` — List template library
- [ ] `POST /api/v2/business/contracts` — Create contract from template with fill-in values
- [ ] `POST /api/v2/business/contracts/analyze` — Red flag analyzer (paste contract text, get warnings)
- [ ] Red flag detection rules: exclusivity clauses, perpetual licenses, payment delays >60 days, IP assignment
- [ ] `GET /api/v2/business/contracts/:id/export` — Export as PDF
- [ ] Contract version history tracking

**Definition of Done**:
- [ ] Template library returns categorized templates
- [ ] Contract creation from template with fill-in values works
- [ ] Red flag analyzer detects exclusivity, perpetual license, delayed payment, IP assignment
- [ ] PDF export generates valid PDF (using pdf-lib or equivalent)
- [ ] 95%+ test coverage on contract service

---

#### US-E11-003: Invoice Generator
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E11-001
**Estimated Time**: 3 hours

**PRD Story**: US-242

**Subtasks**:
- [ ] `POST /api/v2/business/invoices` — Create invoice with line items
- [ ] `GET /api/v2/business/invoices` — List invoices with status filter
- [ ] Lightning payment link generation embedded in invoice
- [ ] Invoice status tracking (draft → sent → viewed → paid → overdue)
- [ ] Recurring invoice templates
- [ ] `GET /api/v2/business/invoices/:id/export` — Export CSV/PDF
- [ ] Overdue notification scheduler

**Definition of Done**:
- [ ] Invoice creation with line items and tax calculations works
- [ ] Lightning payment link generated and embedded in invoice
- [ ] Invoice status tracking transitions correctly (draft->sent->viewed->paid->overdue)
- [ ] PDF/CSV export generates valid output
- [ ] 95%+ test coverage on invoice service

---

#### US-E11-004: Revenue Diversification Planner
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E11-001
**Estimated Time**: 2 hours

**PRD Story**: US-243

**Subtasks**:
- [ ] `GET /api/v2/business/revenue/breakdown` — Revenue by source (subscriptions, tips, sponsorships, services, affiliate)
- [ ] Concentration risk calculation (warn if >50% from single source)
- [ ] `GET /api/v2/business/revenue/suggestions` — Underexplored revenue stream suggestions by niche
- [ ] Diversification goal setting and progress tracking
- [ ] Historical trend showing diversification improvement

**Definition of Done**:
- [ ] Revenue breakdown returns categorized data by source
- [ ] Concentration risk correctly warns when >50% from single source
- [ ] Suggestions generated based on creator's niche
- [ ] 95%+ test coverage on diversification planner service

---

#### US-E11-005: Tax Preparation Assistant
**Priority**: P2-MEDIUM
**Agent**: backend
**Dependencies**: US-E11-001
**Estimated Time**: 3 hours

**PRD Story**: US-244

**Subtasks**:
- [ ] Auto-categorization of Lightning payments by type
- [ ] `POST /api/v2/business/expenses` — Record expense
- [ ] `GET /api/v2/business/tax/quarterly-summary` — Income, expenses, estimated liability
- [ ] BTC-to-USD conversion rate recording at time of each payment receipt
- [ ] `GET /api/v2/business/tax/export?format=csv|json&year=2026` — Tax-software export

**Definition of Done**:
- [ ] Lightning payments auto-categorized using Sovren's internal transaction metadata
- [ ] Expense recording and categorization works
- [ ] Quarterly summary calculates income, expenses, and estimated liability correctly
- [ ] BTC-to-USD conversion recorded at payment receipt time
- [ ] Export generates valid CSV/JSON for tax software
- [ ] 95%+ test coverage on tax preparation service

---

#### US-E11-006: Business Manager UI
**Priority**: P1-HIGH
**Agent**: frontend (added to minimal via scope expansion or follow-up run)
**Dependencies**: US-E11-002 through US-E11-005
**Estimated Time**: 5 hours

**Subtasks**:
- [ ] Create `packages/frontend/src/features/business/` feature module
- [ ] `ContractLibrary` component — browse templates, create contracts
- [ ] `RedFlagReport` component — display analyzed contract warnings
- [ ] `InvoiceDashboard` component — create, track, and manage invoices
- [ ] `RevenueMix` component — donut chart of revenue sources with risk indicator
- [ ] `TaxSummary` component — quarterly income/expense/liability view
- [ ] `ExpenseTracker` component — log and categorize expenses
- [ ] Navigation: "Business" top-level nav item

**Note**: Standard tier includes a frontend agent to handle the 7 UI components including charts (Revenue Mix donut, Red Flag Report) that require proper frontend engineering.

**Definition of Done**:
- [ ] All 7 components render with real and empty data states
- [ ] Revenue Mix donut chart displays correct proportions
- [ ] Red Flag Report highlights unfavorable terms with explanations
- [ ] All components tested with React Testing Library
- [ ] Accessible (ARIA labels, keyboard navigable)
- [ ] 85%+ test coverage on UI components

---

#### US-E11-007: Business Manager Tests & Docs
**Priority**: P1-HIGH
**Agent**: qa
**Dependencies**: US-E11-006
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] E2E test: Create contract from template, verify red flag analysis
- [ ] E2E test: Create invoice, verify Lightning payment link embedded
- [ ] E2E test: View revenue diversification dashboard with chart
- [ ] Integration test: Tax categorization correctly classifies payment types
- [ ] Integration test: PDF export generates valid documents
- [ ] Mermaid diagrams for contract and invoice workflows
- [ ] CHANGELOG.md entry

**Definition of Done**:
- [ ] All E2E tests pass in Chromium and Firefox
- [ ] All integration tests pass with 95%+ coverage
- [ ] Mermaid diagrams render correctly in GitHub
- [ ] No regressions in existing test suite

---

## EPIC-012: Income Stabilizer

**PRD Domain**: Domain 6 — Income Stabilizer
**Team-Builder Tier**: `standard`
**Team-Builder Runs**: 1
**Stories**: 7 implementation stories (from 4 PRD stories)
**Dependencies**: EPIC-011 (revenue breakdown data), EPIC-007 (wellness metrics correlation)
**Estimated Duration**: 1 week

### Why Standard Tier
Revenue forecasting needs architect for ML model design. Subscriber churn detection builds on existing analytics. Emergency fund is non-custodial but needs careful UX. Standard provides architect + backend + frontend + QA.

### Team-Builder Command
```
/team-builder standard Income Stabilizer - AI revenue forecasting with confidence intervals, subscriber churn detection with re-engagement tools, non-custodial creator emergency fund tracking, and income milestone system. Build at packages/frontend/src/features/income/ and packages/backend/src/services/finance/. Revenue predictions use simple regression on historical data (not ML pipeline for MVP). Emergency fund is non-custodial - Sovren tracks allocation amounts but funds stay in creator's Lightning wallet.
```

### Implementation Stories

#### US-E12-001: Income Stabilizer Data Model
**Priority**: P0-CRITICAL
**Agent**: architect → backend
**Dependencies**: EPIC-011 (finance types)
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Create `revenue_forecasts` table (creator_id, forecast_date, period_days, optimistic_sats, expected_sats, conservative_sats, confidence, model_version)
- [ ] Create `subscriber_health` table (creator_id, subscriber_id, risk_score, last_engagement, engagement_trend, churn_probability)
- [ ] Create `emergency_fund_allocations` table (creator_id, payment_id, amount_sats, fund_balance_sats, allocated_at)
- [ ] Create `income_milestones` table (creator_id, milestone_type, target_sats, achieved_at, celebration_shared)
- [ ] TypeScript types added to `packages/shared/src/types/finance.ts`

**Definition of Done**:
- [ ] Migration runs without errors
- [ ] RLS policies tested (cross-creator access blocked, subscriber data scoped to creator)
- [ ] Types exported from shared package (extends finance.ts from EPIC-011)
- [ ] 95%+ test coverage on data access layer

---

#### US-E12-002: Revenue Forecasting Engine
**Priority**: P0-CRITICAL
**Agent**: backend
**Dependencies**: US-E12-001, US-E0-001 (BullMQ for batch jobs)
**Estimated Time**: 6 hours

**PRD Story**: US-251

**Subtasks**:
- [ ] `GET /api/v2/income/forecast?period=30|60|90` — Revenue prediction with confidence intervals
- [ ] Forecasting algorithm (see specification below)
- [ ] Scenario modeling: `POST /api/v2/income/forecast/scenario` — "What if" calculations
- [ ] Forecast accuracy tracking (compare predictions to actuals, log accuracy score)
- [ ] Daily batch job to refresh forecasts
- [ ] Weekly forecast digest email (opt-in)

**Algorithm Specification**:
- **Base forecast**: Linear regression on daily revenue for the past 90 days (minimum 30 days required)
  - Formula: `forecast(day) = slope * day + intercept` where slope and intercept are from ordinary least squares regression
  - Confidence intervals: 1 standard error of estimate for "expected", +/- 2 SE for optimistic/conservative
- **Seasonal adjustment**: 12-month cyclical pattern using same-month-prior-year revenue ratio. If <12 months of data, skip seasonal adjustment.
  - Formula: `seasonal_factor = avg_revenue_same_month_last_year / avg_revenue_all_months_last_year`
  - Applied as multiplier: `adjusted_forecast = base_forecast * seasonal_factor`
- **Content pipeline factor**: Scheduled/draft content count weighted by historical conversion rate
  - Formula: `pipeline_factor = (scheduled_content_count * avg_revenue_per_published_content) / forecast_period_days`
  - Added to adjusted forecast: `final_forecast = adjusted_forecast + pipeline_factor`
- **Accuracy tracking**: Compare each forecast to actual revenue when the period completes; store as percentage deviation

**Definition of Done**:
- [ ] Forecast returns correct values for deterministic test data
- [ ] Confidence intervals widen appropriately with less data
- [ ] Seasonal adjustment correctly applied when 12+ months of data available
- [ ] Accuracy tracking logs deviation for completed forecast periods
- [ ] 95%+ test coverage

---

#### US-E12-003: Subscriber Health Monitor
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E12-001
**Estimated Time**: 3 hours

**PRD Story**: US-252

**Subtasks**:
- [ ] `GET /api/v2/income/subscriber-health` — Per-subscriber risk scores
- [ ] Churn risk scoring: engagement decline rate, payment pattern changes, login frequency
- [ ] `GET /api/v2/income/cohorts` — Subscriber retention curves by cohort (month joined)
- [ ] `GET /api/v2/income/churn/at-risk` — Subscribers with high churn probability
- [ ] Re-engagement suggestions (content recommendations, personalized messages, tier offers)
- [ ] Monthly subscriber health report generation

**Algorithm Specification**:
- **Churn probability scoring**: Weighted sum of 3 inputs, normalized to 0-1 probability
  - Payment recency (weight: 0.40) — days since last payment; >30 days starts contributing, >60 days = high risk
  - Engagement frequency (weight: 0.35) — content views/interactions in last 30 days vs prior 30 days; declining trend increases risk
  - Content consumption trend (weight: 0.25) — percentage of creator's content viewed in last 30 days; declining = risk increase
- **At-risk threshold**: Churn probability >= 0.65 classified as "at-risk"
- **Risk levels**: Low (0-0.30), Moderate (0.31-0.64), High (0.65-0.84), Critical (0.85-1.0)

**Definition of Done**:
- [ ] Churn scores calculated correctly for test subscriber data
- [ ] At-risk subscribers identified at threshold >= 0.65
- [ ] Cohort retention curves render with real subscription data
- [ ] Re-engagement suggestions generated for at-risk subscribers
- [ ] 95%+ test coverage

---

#### US-E12-004: Creator Emergency Fund Tracking
**Priority**: P1-HIGH
**Agent**: backend
**Dependencies**: US-E12-001
**Estimated Time**: 2 hours

**PRD Story**: US-253

**Subtasks**:
- [ ] `PUT /api/v2/income/emergency-fund/configure` — Set auto-save percentage and target amount
- [ ] Auto-allocation: on each incoming Lightning payment, record allocation amount
- [ ] `GET /api/v2/income/emergency-fund/balance` — Current fund balance and progress to target
- [ ] `POST /api/v2/income/emergency-fund/withdraw` — Record withdrawal (non-custodial: just tracking)
- [ ] Fund target calculator based on creator's monthly expenses (creator-configured)
- [ ] **Non-custodial design**: Sovren records allocations but never holds funds. Creator's wallet is the source of truth.

**Definition of Done**:
- [ ] Auto-allocation records correct percentage of incoming payments
- [ ] Fund balance and progress to target display accurately
- [ ] Withdrawal endpoint records bookkeeping event (no fund movement)
- [ ] Fund target calculator recommends based on monthly expenses
- [ ] 95%+ test coverage on emergency fund service

---

#### US-E12-005: Income Milestone Tracking
**Priority**: P2-MEDIUM
**Agent**: backend
**Dependencies**: US-E12-001
**Estimated Time**: 2 hours

**PRD Story**: US-254

**Subtasks**:
- [ ] `GET /api/v2/income/milestones` — List milestones with progress
- [ ] `POST /api/v2/income/milestones` — Create custom milestone
- [ ] Default milestones: first $1, $100, $1K month, $10K month, 100 subscribers, 1K subscribers
- [ ] Auto-detection: trigger celebration when milestone reached
- [ ] Shareable achievement cards (generate image with milestone stats)
- [ ] Milestone history with dates achieved

**Definition of Done**:
- [ ] Default milestones created for new creators
- [ ] Custom milestone creation works
- [ ] Auto-detection triggers celebration when milestone reached
- [ ] Shareable achievement cards generated as images
- [ ] 95%+ test coverage on milestone service

---

#### US-E12-006: Income Stabilizer UI
**Priority**: P1-HIGH
**Agent**: frontend
**Dependencies**: US-E12-002 through US-E12-005
**Estimated Time**: 5 hours

**Subtasks**:
- [ ] Create `packages/frontend/src/features/income/` feature module
- [ ] `RevenueForecast` component — chart with confidence intervals and scenario toggles
- [ ] `SubscriberHealth` component — risk-scored subscriber list with cohort curves
- [ ] `ChurnAlerts` component — at-risk subscribers with re-engagement CTAs
- [ ] `EmergencyFund` component — balance indicator, progress bar, configuration
- [ ] `MilestoneTracker` component — visual progress with celebration animations
- [ ] `IncomePlanner` dashboard — combines forecast + fund + milestones
- [ ] Integration with existing CreatorDashboard as new tab
- [ ] Build on existing PerformancePredictionViewer and GrowthForecastingChart

**Definition of Done**:
- [ ] Revenue forecast chart renders with confidence intervals and scenario toggles
- [ ] Subscriber health list shows risk scores with color coding
- [ ] Emergency fund progress bar accurately reflects balance and target
- [ ] Milestone tracker shows progress with celebration animations
- [ ] All components tested with React Testing Library
- [ ] Accessible (ARIA labels, keyboard navigable)
- [ ] 85%+ test coverage on UI components

---

#### US-E12-007: Income Stabilizer Tests & Docs
**Priority**: P1-HIGH
**Agent**: qa
**Dependencies**: US-E12-006
**Estimated Time**: 4 hours

**Subtasks**:
- [ ] Integration test: Forecast accuracy improves with more data points
- [ ] Integration test: Churn risk scores update when engagement drops
- [ ] Integration test: Emergency fund allocation records on payment receipt
- [ ] Integration test: Milestone triggers when revenue crosses threshold
- [ ] E2E test: Income planner dashboard renders with real data
- [ ] Mermaid diagrams for forecasting engine and fund allocation flow
- [ ] CHANGELOG.md entry

**Definition of Done**:
- [ ] All integration and E2E tests pass
- [ ] Forecast accuracy validation working with test data
- [ ] Mermaid diagrams render correctly in GitHub
- [ ] CHANGELOG entry follows conventional commit format
- [ ] No regressions in existing test suite

---

## Execution Plan Summary

### Recommended Order (Revised with Factory + Infrastructure Sprint)

| Order | Epic | Tier | Runs | Duration | Parallel? |
|-------|------|------|------|----------|-----------|
| 0a-i | **EMERGENCY**: Credential rotation (US-E0-008) | — | — | 2-3 hours | **START IMMEDIATELY** |
| 0a | P1 Security Fixes (SQL injection, XSS, DI) | minimal | 1 | 2 days | Yes (parallel with 0b) |
| 0b | Software Factory: CI/CD rebuild (US-E0-009) | — | — | 3-4 days | Yes (parallel with 0a, 0c) |
| 0c | Software Factory: Observability real-ification (US-E0-010) | — | — | 2-3 days | Yes (parallel with 0a, 0b) |
| 0d | Security hardening (US-E0-011) | — | — | 1-2 days | After 0a-i |
| 0e | Infrastructure: US-E0-001 through US-E0-004, US-PRE-002 | — | — | 2-3 days | After 0a/0b |
| 0f | Architecture: US-E0-005 (ESLint 9), US-E0-006 (nostr-tools), US-E0-007 (ADRs) | — | — | 2-3 days | Yes (parallel with 0e) |
| 0g | P1 Upgrades (optional sprint): React 19, Vite 6, Tailwind v4, Turborepo | — | — | 3-5 days | Yes (can overlap with 1a start) |
| 1a | EPIC-007: Wellness | standard | 1 | 1 week | Yes (parallel with 1b, 1c) |
| 1b | EPIC-008: Shield | standard | 1 | 1.5 weeks | Yes (parallel with 1a, 1c) |
| 1c | EPIC-009 Wave A: Platform Publishing | enterprise | 1 | 1.5 weeks | Yes (parallel with 1a, 1b) |
| 2a | EPIC-009 Wave B: Platform Inbox/Analytics | standard | 1 | 1 week | Yes (parallel with 2b, 2c) |
| 2b | EPIC-010: Creator Network | enterprise | 1 | 1.5 weeks | Yes (parallel with 2a, 2c) |
| 2c | EPIC-011: Business Manager | standard | 1 | 1 week | Yes (parallel with 2a, 2b) |
| 3 | EPIC-012: Income Stabilizer | standard | 1 | 1 week | — |

**Pre-v2.0 factory + infrastructure sprint** (Orders 0a through 0f): ~9-13 working days (~80-110 hours). Originally estimated at 5 days based on architecture assessment alone, expanded after the Software Factory audit (2026-02-12) revealed CI/CD is 100% simulated, observability is mocked, and critical credentials are exposed. Order 0g (P1 upgrades) is optional but strongly recommended.

**Critical path change**: The factory sprint is now the longest pre-v2.0 dependency. CI/CD rebuild (0b) is the longest single item at 3-4 days and is on the critical path. Observability (0c) and security hardening (0d) can run in parallel with CI/CD.

### Token Budget Estimate

| Epic | Tier | Agents | Est. Cost |
|------|------|--------|-----------|
| Emergency Credential Rotation (US-E0-008) | — | 1 | ~$1.00 |
| Security Fixes (SQL injection, XSS, DI) | minimal | 3 | ~$2.00 |
| CI/CD Rebuild (US-E0-009) | — | 2-3 | ~$4.00 |
| Observability Real-ification (US-E0-010) | — | 2-3 | ~$4.00 |
| Security Hardening (US-E0-011) | — | 1-2 | ~$2.00 |
| Infrastructure Stories (US-E0-001 to E0-004, PRE-002) | — | 2-3 | ~$3.00 |
| Architecture Stories (US-E0-005 to E0-007) | — | 2-3 | ~$3.00 |
| P1 Upgrades (optional sprint) | — | 2-4 | ~$4.00 |
| EPIC-007 | standard | 6 | ~$5.00 |
| EPIC-008 | standard | 6 | ~$5.00 |
| EPIC-009 Wave A | enterprise | 10 | ~$9.00 |
| EPIC-009 Wave B | standard | 6 | ~$5.00 |
| EPIC-010 | enterprise | 10 | ~$9.00 |
| EPIC-011 | standard | 6 | ~$5.00 |
| EPIC-012 | standard | 6 | ~$5.00 |
| **Total** | — | **~68 agent runs** | **~$66.00** |

### Story Count by Epic

| Epic | P0-CRITICAL | P1-HIGH | P2-MEDIUM | P3-LOW | Total |
|------|-------------|---------|-----------|--------|-------|
| Factory Remediation (new) | 3 | 1 | 0 | 0 | 4 |
| Infrastructure (original) | 4 | 1 | 0 | 0 | 5 |
| Infrastructure (architecture) | 3 | 0 | 0 | 0 | 3 |
| EPIC-007 | 2 | 5 | 2 | 1 | 10 |
| EPIC-008 | 3 | 6 | 1 | 1 | 11 |
| EPIC-009 | 3 | 6 | 2 | 1 | 12 |
| EPIC-010 | 1 | 7 | 2 | 1 | 11 |
| EPIC-011 | 1 | 4 | 1 | 1 | 7 |
| EPIC-012 | 1 | 4 | 1 | 1 | 7 |
| **Total** | **21** | **34** | **9** | **6** | **~70** |

**Note**: Story count: original 54 → ~70 due to: 4 factory remediation stories (US-E0-008 credentials, US-E0-009 CI/CD rebuild, US-E0-010 observability, US-E0-011 security hardening), 5 original infrastructure stories (US-E0-001 through US-E0-004, US-PRE-002), 3 architecture infrastructure stories (US-E0-005 ESLint 9, US-E0-006 nostr-tools, US-E0-007 ADRs), US-E8-004 split into 3, US-E10-006 split into 3. Plus ~7 P1 upgrade stories tracked in the P1 Upgrade Stories table (not individually numbered — run as a sprint or individual tasks). Total estimated timeline: 13-17 weeks including 2-week factory + infrastructure sprint. See `docs/reviews/architecture-assessment.md` for the full technology debt register (16 items) and version matrix (25+ dependencies). Software Factory audit (2026-02-12) added ~30-42 hours of factory remediation work.

### Definition of Done (All Epics)

Every epic completion requires:
- [ ] All P0/P1 stories implemented and tested
- [ ] New database migrations run without errors
- [ ] Feature module follows existing pattern (components, services, types, barrel exports)
- [ ] Mermaid diagrams in `/docs/architecture/diagrams/`
- [ ] CHANGELOG.md updated
- [ ] Zero ESLint errors (ESLint 9 flat config), TypeScript strict compliance
- [ ] 95%+ test coverage on new services, 85%+ on new components
- [ ] No regressions in existing test suite
- [ ] ADR for any architectural decisions made (see ADR list in Pre-Requisites section)
- [ ] New v2 modules use TanStack Query for server state (no new Redux dependencies)
- [ ] All new feature modules lazy-loaded with `React.lazy()` and `Suspense` (ADR-008)
- [ ] Technology debt register (`docs/reviews/architecture-assessment.md` §5) updated if new debt introduced
- [ ] Real Sentry error tracking captures errors from new code (not simulation class)
- [ ] New API endpoints have Prometheus metrics (request count, latency histogram via `prom-client`)
- [ ] CSRF tokens validated on all new state-changing endpoints
- [ ] CI/CD pipeline deploys new code to staging successfully (not `echo` stubs)
