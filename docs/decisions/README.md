# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Sovren platform. ADRs document significant architectural decisions made during the project's development.

## Purpose

ADRs provide context for why certain architectural decisions were made, what alternatives were considered, and what consequences resulted from these decisions. They serve as:

- **Historical Record**: Understanding why decisions were made in the past
- **Onboarding Tool**: Helping new team members understand the system's architecture
- **Decision Framework**: Providing a structured approach to making architectural decisions
- **Communication**: Documenting decisions across the team

## ADR Format

Each ADR follows a standard format:

```markdown
# ADR-XXX: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Context

[Background and problem statement]

## Decision

[The change we're proposing or have agreed to]

## Consequences

[What becomes easier or more difficult]

## Alternatives Considered

[Other options that were evaluated]
```

## Index of ADRs

### Epic 005: Backend Service Refactoring

| ADR                                                    | Title                                         | Status   | Date       |
| ------------------------------------------------------ | --------------------------------------------- | -------- | ---------- |
| [ADR-001](./ADR-001-inversify-dependency-injection.md) | Adopt Inversify for Dependency Injection      | Accepted | 2025-10-27 |
| [ADR-002](./ADR-002-event-driven-architecture.md)      | Implement Event-Driven Architecture           | Accepted | 2025-10-27 |
| [ADR-003](./ADR-003-multi-layer-caching.md)            | Multi-Layer Caching Strategy                  | Accepted | 2025-10-27 |
| [ADR-004](./ADR-004-repository-pattern.md)             | Repository Pattern for Data Access            | Accepted | 2025-10-27 |
| [ADR-005](./ADR-005-lightning-network-payments.md)     | Lightning Network for Payments                | Accepted | 2025-10-27 |
| [ADR-006](./ADR-006-typescript-strict-mode.md)         | TypeScript Strict Mode                        | Accepted | 2025-10-27 |
| [ADR-007](./ADR-007-feature-based-organization.md)     | Feature-Based Code Organization               | Accepted | 2025-10-27 |
| [ADR-008](./ADR-008-jest-testing.md)                   | Jest for Testing                              | Accepted | 2025-10-27 |
| [ADR-009](./ADR-009-zod-validation.md)                 | Zod for Validation                            | Accepted | 2025-10-27 |
| [ADR-010](./ADR-010-expressjs-api-server.md)           | Express.js for API Server                     | Accepted | 2025-10-27 |
| [ADR-011](./ADR-011-openapi-documentation.md)          | OpenAPI 3.0 for API Documentation             | Accepted | 2025-10-27 |
| [ADR-012](./ADR-012-postgresql-supabase.md)            | PostgreSQL with Supabase                      | Accepted | 2025-10-27 |
| [ADR-013](./ADR-013-redis-caching.md)                  | Redis for Caching and Rate Limiting           | Accepted | 2025-10-27 |
| [ADR-014](./ADR-014-circuit-breaker-pattern.md)        | Circuit Breaker Pattern for External Services | Accepted | 2025-10-27 |
| [ADR-015](./ADR-015-idempotency-keys.md)               | Idempotency Keys for Payment Operations       | Accepted | 2025-10-27 |

## Categories

### API & Queue Infrastructure

| ADR                                                    | Title                          | Status   | Date       |
| ------------------------------------------------------ | ------------------------------ | -------- | ---------- |
| [ADR-019](./ADR-019-bullmq-job-queue-standard.md)      | BullMQ Job Queue Standard      | Accepted | 2026-02-26 |
| [ADR-020](./ADR-020-rest-zod-api-contract-standard.md) | REST+Zod API Contract Standard | Accepted | 2026-02-26 |

### Infrastructure & Architecture

- ADR-002: Event-Driven Architecture
- ADR-007: Feature-Based Code Organization
- ADR-010: Express.js for API Server
- ADR-012: PostgreSQL with Supabase

### Code Quality & Development

- ADR-001: Inversify for Dependency Injection
- ADR-006: TypeScript Strict Mode
- ADR-008: Jest for Testing
- ADR-009: Zod for Validation

### Performance & Reliability

- ADR-003: Multi-Layer Caching Strategy
- ADR-013: Redis for Caching and Rate Limiting
- ADR-014: Circuit Breaker Pattern for External Services

### Data & Payments

- ADR-004: Repository Pattern for Data Access
- ADR-005: Lightning Network for Payments
- ADR-015: Idempotency Keys for Payment Operations

### API & Queue Infrastructure

- ADR-019: BullMQ Job Queue Standard
- ADR-020: REST+Zod API Contract Standard

### Documentation

- ADR-011: OpenAPI 3.0 for API Documentation

## Related Documentation

- [Architecture Diagrams](/docs/architecture/diagrams/) - Visual representations of system architecture
- [Developer Guide](/docs/development/backend-developer-guide.md) - Comprehensive developer onboarding
- [API Documentation](/docs/api/README.md) - API reference and guides
- [CLAUDE.md](/CLAUDE.md) - Project overview and standards

## Contributing

When making new architectural decisions:

1. Create a new ADR using the next sequential number
2. Use the standard ADR template
3. Discuss the decision with the team
4. Update this index with the new ADR
5. Link to related ADRs and documentation
6. Commit with a descriptive message

## Revision History

- **2026-02-26**: Added ADR-019 (BullMQ Job Queue Standard) and ADR-020 (REST+Zod API Contract Standard) for v2.0 Production Roadmap
- **2025-10-27**: Initial ADR collection for Epic 005 Backend Service Refactoring (15 ADRs)
