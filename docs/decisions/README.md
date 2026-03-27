# Architecture Decision Records

This directory contains all Architecture Decision Records (ADRs) for the Sovren platform. Each ADR documents a significant architectural or technical decision, including the context, alternatives considered, and the rationale for the chosen approach.

## How to Read an ADR

Each ADR follows the format: **Context → Decision → Consequences**. Status values are:
- **Accepted** — decision is active and in use
- **Proposed** — under review, not yet ratified
- **Superseded** — replaced by a newer decision (link in the ADR)
- **Deprecated** — no longer applicable

---

## Architecture

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| Legacy-001 | Modular Monolith Architecture Pattern | 2026-02-11 | Accepted | Architecture | [ADR-legacy-001-modular-monolith-architecture.md](./ADR-legacy-001-modular-monolith-architecture.md) |
| Legacy-002 | WebSocket Infrastructure — Express + Redis Pub/Sub | 2026-02-11 | Proposed | Architecture | [ADR-legacy-002-websocket-infrastructure.md](./ADR-legacy-002-websocket-infrastructure.md) |
| 002 | Event-Driven Architecture | 2025-10-27 | Accepted | Architecture | [ADR-002-event-driven-architecture.md](./ADR-002-event-driven-architecture.md) |
| 007 | Feature-Based Code Organization | 2025-10-27 | Accepted | Architecture | [ADR-007-feature-based-organization.md](./ADR-007-feature-based-organization.md) |
| 010 | Express.js for API Server | 2025-10-27 | Accepted | Architecture | [ADR-010-expressjs-api-server.md](./ADR-010-expressjs-api-server.md) |
| 014 | Circuit Breaker Pattern for External Services | 2025-10-27 | Accepted | Architecture | [ADR-014-circuit-breaker-pattern.md](./ADR-014-circuit-breaker-pattern.md) |

---

## Database & Storage

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| Legacy-003 | Database Repository Implementation — Supabase SDK over Prisma | 2026-02-11 | Proposed | Database | [ADR-legacy-003-database-repository-implementation.md](./ADR-legacy-003-database-repository-implementation.md) |
| 003 | Multi-Layer Caching Strategy | 2025-10-27 | Accepted | Database | [ADR-003-multi-layer-caching.md](./ADR-003-multi-layer-caching.md) |
| 004 | Repository Pattern for Data Access | 2025-10-27 | Accepted | Database | [ADR-004-repository-pattern.md](./ADR-004-repository-pattern.md) |
| 012 | PostgreSQL with Supabase | 2025-10-27 | Accepted | Database | [ADR-012-postgresql-supabase.md](./ADR-012-postgresql-supabase.md) |
| 013 | Redis for Caching and Rate Limiting | 2025-10-27 | Accepted | Database | [ADR-013-redis-caching.md](./ADR-013-redis-caching.md) |

---

## Payments

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| 005 | Lightning Network for Payments | 2025-10-27 | Accepted | Payments | [ADR-005-lightning-network-payments.md](./ADR-005-lightning-network-payments.md) |
| 015 | Idempotency Keys for Payment Operations | 2025-10-27 | Accepted | Payments | [ADR-015-idempotency-keys.md](./ADR-015-idempotency-keys.md) |
| 021 | Custodial Design for Creator Payments | 2026-02-16 | Accepted | Payments | [ADR-021-custodial-design.md](./ADR-021-custodial-design.md) |
| P1 | Atomic Writes and Persistence Strategy for Payment Data | 2026-02-14 | Accepted | Payments | [ADR-p1-atomic-writes-persistence.md](./ADR-p1-atomic-writes-persistence.md) |

---

## Security

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| 016 | CSRF Double-Submit Cookie Pattern | 2026-02-12 | Accepted | Security | [ADR-016-csrf-double-submit-cookie.md](./ADR-016-csrf-double-submit-cookie.md) |

---

## API & Validation

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| 009 | Zod for Validation | 2025-10-27 | Accepted | API | [ADR-009-zod-validation.md](./ADR-009-zod-validation.md) |
| 011 | OpenAPI 3.0 for API Documentation | 2025-10-27 | Accepted | API | [ADR-011-openapi-documentation.md](./ADR-011-openapi-documentation.md) |
| 020 | REST+Zod API Contract Standard | 2026-02-26 | Accepted | API | [ADR-020-rest-zod-api-contract-standard.md](./ADR-020-rest-zod-api-contract-standard.md) |

---

## Infrastructure & CI/CD

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| 001 | Adopt Inversify for Dependency Injection | 2025-10-27 | Accepted | Infrastructure | [ADR-001-inversify-dependency-injection.md](./ADR-001-inversify-dependency-injection.md) |
| 017 | Observability Stack — prom-client, Sentry, AsyncLocalStorage | 2026-02-12 | Accepted | Infrastructure | [ADR-017-observability-stack.md](./ADR-017-observability-stack.md) |
| 018 | CI/CD Workflow Consolidation Strategy | 2026-02-12 | Accepted | Infrastructure | [ADR-018-cicd-consolidation.md](./ADR-018-cicd-consolidation.md) |
| 019 | BullMQ Job Queue Standard | 2026-02-26 | Accepted | Infrastructure | [ADR-019-bullmq-job-queue-standard.md](./ADR-019-bullmq-job-queue-standard.md) |
| 022 | Job Queue Selection | 2026-02-16 | Accepted | Infrastructure | [ADR-022-job-queue-selection.md](./ADR-022-job-queue-selection.md) |

---

## Testing

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| 008 | Jest for Testing (migrated to Vitest) | 2025-10-27 | Superseded | Testing | [ADR-008-jest-testing.md](./ADR-008-jest-testing.md) |

---

## TypeScript & Code Standards

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| 006 | TypeScript Strict Mode | 2025-10-27 | Accepted | Standards | [ADR-006-typescript-strict-mode.md](./ADR-006-typescript-strict-mode.md) |

---

## Frontend

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| 004-sm | State Management Boundaries — React Query + Redux | 2024-12-26 | Accepted | Frontend | [ADR-004-state-management-boundaries.md](./ADR-004-state-management-boundaries.md) |

---

## Creator Features

| # | Title | Date | Status | Domain | File |
|---|-------|------|--------|--------|------|
| 023 | Burnout Risk Scoring Algorithm | 2026-02-15 | Accepted | Creator Features | [ADR-023-burnout-scoring-algorithm.md](./ADR-023-burnout-scoring-algorithm.md) |
| 024 | Content Fingerprinting Approach | 2026-02-15 | Accepted | Creator Features | [ADR-024-content-fingerprinting-approach.md](./ADR-024-content-fingerprinting-approach.md) |

---

## Full Index (All Files)

| File | Title | Date | Status |
|------|-------|------|--------|
| [ADR-001-inversify-dependency-injection.md](./ADR-001-inversify-dependency-injection.md) | Adopt Inversify for Dependency Injection | 2025-10-27 | Accepted |
| [ADR-002-event-driven-architecture.md](./ADR-002-event-driven-architecture.md) | Implement Event-Driven Architecture | 2025-10-27 | Accepted |
| [ADR-003-multi-layer-caching.md](./ADR-003-multi-layer-caching.md) | Multi-Layer Caching Strategy | 2025-10-27 | Accepted |
| [ADR-004-repository-pattern.md](./ADR-004-repository-pattern.md) | Repository Pattern for Data Access | 2025-10-27 | Accepted |
| [ADR-004-state-management-boundaries.md](./ADR-004-state-management-boundaries.md) | State Management Boundaries — React Query + Redux | 2024-12-26 | Accepted |
| [ADR-005-lightning-network-payments.md](./ADR-005-lightning-network-payments.md) | Lightning Network for Payments | 2025-10-27 | Accepted |
| [ADR-006-typescript-strict-mode.md](./ADR-006-typescript-strict-mode.md) | TypeScript Strict Mode | 2025-10-27 | Accepted |
| [ADR-007-feature-based-organization.md](./ADR-007-feature-based-organization.md) | Feature-Based Code Organization | 2025-10-27 | Accepted |
| [ADR-008-jest-testing.md](./ADR-008-jest-testing.md) | Jest for Testing | 2025-10-27 | Superseded |
| [ADR-009-zod-validation.md](./ADR-009-zod-validation.md) | Zod for Validation | 2025-10-27 | Accepted |
| [ADR-010-expressjs-api-server.md](./ADR-010-expressjs-api-server.md) | Express.js for API Server | 2025-10-27 | Accepted |
| [ADR-011-openapi-documentation.md](./ADR-011-openapi-documentation.md) | OpenAPI 3.0 for API Documentation | 2025-10-27 | Accepted |
| [ADR-012-postgresql-supabase.md](./ADR-012-postgresql-supabase.md) | PostgreSQL with Supabase | 2025-10-27 | Accepted |
| [ADR-013-redis-caching.md](./ADR-013-redis-caching.md) | Redis for Caching and Rate Limiting | 2025-10-27 | Accepted |
| [ADR-014-circuit-breaker-pattern.md](./ADR-014-circuit-breaker-pattern.md) | Circuit Breaker Pattern for External Services | 2025-10-27 | Accepted |
| [ADR-015-idempotency-keys.md](./ADR-015-idempotency-keys.md) | Idempotency Keys for Payment Operations | 2025-10-27 | Accepted |
| [ADR-016-csrf-double-submit-cookie.md](./ADR-016-csrf-double-submit-cookie.md) | CSRF Double-Submit Cookie Pattern | 2026-02-12 | Accepted |
| [ADR-017-observability-stack.md](./ADR-017-observability-stack.md) | Observability Stack — prom-client, Sentry, AsyncLocalStorage | 2026-02-12 | Accepted |
| [ADR-018-cicd-consolidation.md](./ADR-018-cicd-consolidation.md) | CI/CD Workflow Consolidation Strategy | 2026-02-12 | Accepted |
| [ADR-019-bullmq-job-queue-standard.md](./ADR-019-bullmq-job-queue-standard.md) | BullMQ Job Queue Standard | 2026-02-26 | Accepted |
| [ADR-020-rest-zod-api-contract-standard.md](./ADR-020-rest-zod-api-contract-standard.md) | REST+Zod API Contract Standard | 2026-02-26 | Accepted |
| [ADR-021-custodial-design.md](./ADR-021-custodial-design.md) | Custodial Design for Creator Payments | 2026-02-16 | Accepted |
| [ADR-022-job-queue-selection.md](./ADR-022-job-queue-selection.md) | Job Queue Selection | 2026-02-16 | Accepted |
| [ADR-023-burnout-scoring-algorithm.md](./ADR-023-burnout-scoring-algorithm.md) | Burnout Risk Scoring Algorithm | 2026-02-15 | Accepted |
| [ADR-024-content-fingerprinting-approach.md](./ADR-024-content-fingerprinting-approach.md) | Content Fingerprinting Approach | 2026-02-15 | Accepted |
| [ADR-legacy-001-modular-monolith-architecture.md](./ADR-legacy-001-modular-monolith-architecture.md) | Modular Monolith Architecture Pattern | 2026-02-11 | Accepted |
| [ADR-legacy-002-websocket-infrastructure.md](./ADR-legacy-002-websocket-infrastructure.md) | WebSocket Infrastructure — Express + Redis Pub/Sub | 2026-02-11 | Proposed |
| [ADR-legacy-003-database-repository-implementation.md](./ADR-legacy-003-database-repository-implementation.md) | Database Repository Implementation — Supabase SDK over Prisma | 2026-02-11 | Proposed |
| [ADR-p1-atomic-writes-persistence.md](./ADR-p1-atomic-writes-persistence.md) | Atomic Writes and Persistence Strategy for Payment Data | 2026-02-14 | Accepted |
| [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) | Architecture Decisions Overview | — | Reference |

---

## ADR Format

Each ADR follows a standard format:

```markdown
# ADR-XXX: [Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded | Deprecated
**Epic**: [Epic name if applicable]
**Related ADRs**: [links]

## Context
[Background and problem statement]

## Decision
[The change we're proposing or have agreed to]

## Consequences
[What becomes easier or more difficult]

## Alternatives Considered
[Other options that were evaluated]
```

---

## Adding a New ADR

1. Copy an existing ADR as a template
2. Number it sequentially: `ADR-025-short-title.md`
3. Set status to `Proposed` until ratified by the architecture team
4. Add a row to the relevant domain section in this index and to the Full Index table
5. Link related ADRs bidirectionally in the "Related ADRs" frontmatter field
6. Include a CHANGELOG entry per project conventions

## Related Documentation

- [Architecture Diagrams](../architecture/diagrams/) — Visual representations of system architecture
- [Developer Guide](../development/backend-developer-guide.md) — Comprehensive developer onboarding
- [API Documentation](../api/README.md) — API reference and guides
- [SLOs](../observability/slos.md) — Service Level Objectives

## Revision History

- **2026-02-26**: Added ADR-019 (BullMQ Job Queue Standard) and ADR-020 (REST+Zod API Contract Standard) for v2.0 Production Roadmap
- **2026-02-16**: Added ADR-021 (Custodial Design), ADR-022 (Job Queue Selection)
- **2026-02-15**: Added ADR-023 (Burnout Scoring), ADR-024 (Content Fingerprinting)
- **2026-02-14**: Added ADR-p1 (Atomic Writes and Persistence)
- **2026-02-12**: Added ADR-016 (CSRF), ADR-017 (Observability Stack), ADR-018 (CI/CD Consolidation)
- **2024-12-26**: Added ADR-004-sm (State Management Boundaries)
- **2025-10-27**: Initial ADR collection for Epic 005 Backend Service Refactoring (ADR-001 through ADR-015)
