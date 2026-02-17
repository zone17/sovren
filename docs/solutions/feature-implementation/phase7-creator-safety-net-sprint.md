---
title: "Phase 7 Creator Safety Net Sprint"
category: feature-implementation
tags: [phase-7, wellness, content-shield, provenance, burnout-detection, fingerprinting, team-builder, standard-tier, CE-workflow]
severity: feature
module: wellness, provenance, content-shield
date: 2026-02-14
resolution_time: ~4 hours
team_tier: standard
agents: architect, product-owner, backend, frontend, qa, security-audit
branch: feature/phase-7-creator-safety-net
commit: 555c3b2
files_created: 90
lines_added: ~8000
security_score: 90/100
---

# Phase 7 Creator Safety Net Sprint

## Problem Statement

Sovren needed two new feature epics for creator protection:

- **EPIC-007 (Creator Wellness)**: Burnout detection, work pattern tracking, sustainable scheduling, creator boundary controls, wellness pulse check-ins, and benchmark comparisons. 10 user stories.
- **EPIC-008 (Content Shield)**: Cryptographic content provenance via NOSTR event signing, perceptual fingerprinting (SimHash for text, pHash for images), AI copy detection scanning, alert management, DMCA report generator, and authenticity verification badges. 11 user stories.

Both epics required coordinated backend services, frontend feature modules, shared types, database schema design, E2E tests, and a security audit.

## Solution

### Team Composition

Used `/team-builder standard` with 6 agents across 3 phases:

| Phase | Agents | Duration |
|-------|--------|----------|
| Phase 0: Architecture | architect + product-owner (parallel) | ~30 min |
| Phase 1: Implementation | backend + frontend (parallel) | ~90 min |
| Phase 2: Verification | qa + security-audit (parallel) | ~30 min |

### Architecture (Phase 0)

**8 architecture documents produced (~140KB)**:

| Document | Purpose |
|----------|---------|
| `docs/plans/phase7-architecture.md` | System design, component interactions |
| `docs/plans/phase7-api-spec.md` | 24 API endpoints (14 wellness + 10 shield) |
| `docs/plans/phase7-database-schema.md` | 7 new tables with RLS policies |
| `docs/plans/phase7-component-tree.md` | React component hierarchy |
| `docs/plans/phase7-requirements.md` | Acceptance criteria per story |
| `docs/plans/phase7-dod.md` | Definition of Done per story |
| `docs/adr/ADR-019-burnout-scoring-algorithm.md` | Weighted 5-factor scoring (0-100) |
| `docs/adr/ADR-020-content-fingerprinting-approach.md` | SimHash + pHash approach |

**Key architectural decisions**:
- Three-layer access control: middleware auth + service-level creator scoping + database RLS
- TanStack Query for all new v2 server state (no Redux)
- React.lazy() + Suspense for lazy-loaded feature modules
- DI container integration via `phase7.bindings.ts`

### Implementation (Phase 1)

**Backend (31 files)**:
- 4 wellness services: WellnessService, BurnoutScoringService, ScheduleService, BoundaryService
- 4 provenance services: ProvenanceService, FingerprintService, AlertService, DmcaService
- 10 interface files (5 wellness + 5 provenance)
- 2 validator files (Zod schemas for all endpoints)
- 3 route files (wellness.routes.ts, shield.routes.ts, v2/index.ts)
- DI bindings, container type extensions, bootstrap registration
- 5 unit test files

**Frontend (38 files)**:
- 15 React components across 2 feature modules
- 9 custom hooks (all TanStack Query)
- 2 API service clients
- 2 shared type definition files
- 6 test files
- App.tsx + Layout + MobileNavigation updates

**Shared (2 files)**:
- `packages/shared/src/types/wellness.ts` — Domain types for wellness
- `packages/shared/src/types/provenance.ts` — Domain types for provenance

### Verification (Phase 2)

**QA agent** created:
- `packages/frontend/e2e/wellness-dashboard.spec.ts` — Playwright E2E for wellness
- `packages/frontend/e2e/content-shield.spec.ts` — Playwright E2E for shield
- `packages/backend/src/__tests__/routes/v2/wellness.routes.test.ts` — Integration tests
- `packages/backend/src/__tests__/routes/v2/shield.routes.test.ts` — Integration tests

**Security audit** produced `docs/security/phase7-security-report.md`:
- Score: **90/100**
- 0 critical, 0 high, 2 moderate (accepted risk), 3 low (accepted risk)
- OWASP Top 10: all PASS
- All 24 endpoints verified for authentication
- All mutation endpoints verified for Zod validation
- No injection vectors, no secret leakage, no eval/exec

## Key Patterns

### 1. Barrel Re-exports for Monorepo Shared Types

When adding new shared type modules, the barrel `index.ts` must re-export them:

```typescript
// packages/shared/src/types/index.ts
export * from './wellness';
export * from './provenance';
```

Without this, all backend imports fail with `Cannot find module '@sovren/shared/types/wellness'`.

### 2. DI Container Phase Bindings

New service phases get their own binding file to keep `bootstrap.ts` clean:

```typescript
// packages/backend/src/container/bindings/phase7.bindings.ts
export function registerPhase7Bindings(container: ServiceContainer) {
  container.register(TYPES.PHASE_7.WellnessService, () => new WellnessService(/*deps*/));
  // ... all Phase 7 services
}
```

### 3. Three-Layer Access Control

Every wellness/shield endpoint uses defense-in-depth:
1. **Middleware**: `authenticate` + `requireCreator` + `validate`
2. **Service**: All queries scoped by `req.user!.nostr_pubkey`
3. **Database**: RLS policies enforce `creator_id = auth.uid()`

### 4. Burnout Scoring Algorithm (ADR-019)

Weighted 5-factor algorithm producing 0-100 risk score:
- Work patterns (frequency, duration, consistency)
- Energy/motivation self-reports
- Stress indicators
- Schedule adherence
- Recovery time between sessions

Sensitivity adjustment stored in-memory Map (accepted risk for MVP; should persist to DB before production).

### 5. Content Fingerprinting (ADR-020)

Dual-approach fingerprinting:
- **SimHash** for text content (locality-sensitive hash, 16 hex chars)
- **pHash** for image content (perceptual hash, invariant to minor edits)
- Similarity comparison with configurable threshold

## What Worked Well

1. **Standard tier team-builder is ideal for feature epics**: 6 agents, 3 phases, clean separation of concerns. Architecture docs gave implementation agents clear contracts.

2. **Architecture-first pays off**: 140KB of design docs before any code meant backend and frontend could work in parallel with shared type contracts.

3. **Security audit as sprint artifact**: 90/100 score with OWASP compliance gives confidence. Worth running for every feature sprint.

4. **Parallel Phase 2 (QA + Security)**: Both agents work independently since QA tests functionality while security audits code patterns.

5. **v2 route namespace**: Mounting all Phase 7 routes under `/api/v2/` keeps existing v1 routes untouched.

## What To Improve

### 1. Barrel Re-exports Must Be In Agent Briefs

Backend and frontend agents both imported from `@sovren/shared/types/wellness` but nobody updated the barrel export in `index.ts`. This caused ~20 TypeScript errors caught at Gate 2.

**Fix for future**: Add to implementation agent briefs: "If you create new files in `packages/shared/src/types/`, you MUST also update `packages/shared/src/types/index.ts` to re-export them."

### 2. QA Agent Needs Playwright Scaffolding Pre-Built

QA agent spent 8+ minutes trying to start a dev server for live Playwright testing. Had to be manually unblocked with "skip server, write tests directly."

**Fix for future**: Add to QA brief: "Do NOT attempt to start the dev server. Write Playwright test files following existing patterns in `packages/frontend/e2e/`. Tests will be run separately."

### 3. Agents Accidentally Delete Unrelated Files

4 files were silently deleted during the sprint (.dockerignore, .nvmrc, .env.example, cli-latest). Caught during pre-commit staging.

**Fix for future**: Add to all briefs: "Only modify files within your scope. Do NOT delete files outside your assigned directories." Also run `git diff --name-status` before staging to detect unexpected deletions.

### 4. Pre-Existing tsc Errors Block Gate Verification

3746 pre-existing TypeScript errors make `tsc --noEmit` unusable as a gate check. Phase 7-specific errors had to be filtered via grep.

**Fix for future**: Fix todo-069 (unblock tsc). Until then, gate checks should grep for Phase-specific errors rather than running full tsc.

### 5. In-Memory State Needs Production Path

BurnoutScoringService stores sensitivity settings in a `Map<string, SensitivityLevel>` that's lost on restart. Acceptable for MVP but needs database persistence before production.

## Anti-Patterns Identified

1. **Cache-as-primary-store**: In-memory Maps for settings that should be persisted (F-002 in security report)
2. **Overly broad RLS policies**: `creator_boundaries` table has `SELECT USING (TRUE)` when it should restrict non-owner reads (F-004)
3. **Missing max length on path params**: `contentId` lacks `.max(255)` in Zod schema (F-005)

## Related Documentation

- [Infrastructure Sprint Compound Doc](../infrastructure-issues/infrastructure-sprint-software-factory-first.md)
- [P2 Remediation Sprint](../security-issues/p2-remediation-sprint-25-findings.md)
- [P1 Critical Fixes Round 4](../security-issues/p1-critical-fixes-pr73-round4.md)
- [P2 Deferred Fixes](../architecture-issues/p2-deferred-fixes-type-safety-di-api-coverage.md)
- [ADR-019: Burnout Scoring Algorithm](../../adr/ADR-019-burnout-scoring-algorithm.md)
- [ADR-020: Content Fingerprinting](../../adr/ADR-020-content-fingerprinting-approach.md)
- [Phase 7 Security Report](../../security/phase7-security-report.md)
- [Phase 7 Architecture](../../plans/phase7-architecture.md)
- [Phase 7 API Spec](../../plans/phase7-api-spec.md)
- [Phase 7 Database Schema](../../plans/phase7-database-schema.md)

## Sprint Metrics

| Metric | Value |
|--------|-------|
| Total files created/modified | 90 |
| Architecture docs | 8 (140KB) |
| Backend files | 31 |
| Frontend files | 38 |
| Shared type files | 2 |
| E2E test files | 2 |
| Integration test files | 2 |
| Security report | 1 (90/100) |
| API endpoints | 24 (14 wellness + 10 shield) |
| React components | 15 |
| Custom hooks | 9 |
| Database tables (planned) | 7 |
| Team tier | Standard (6 agents) |
| Phases | 3 |
| Gate retries | 1 (barrel re-export fix) |
| Critical/High findings | 0 |
