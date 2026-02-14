# ADR-001: Modular Monolith Architecture Pattern

**Status:** Accepted
**Date:** 2026-02-11
**Decision Makers:** Architecture Team
**Phase:** 1 - Architecture & Design

## Context

Sovren needs an architecture pattern that balances development velocity, team coordination, and long-term scalability. The platform has multiple domains (content management, user management, payments via Lightning Network, NOSTR protocol integration, analytics) that share data and interact frequently.

The team is small (5-7 people) and needs to ship an MVP within 12-16 weeks. The architecture must support the existing npm workspaces monorepo structure with `backend`, `frontend`, `shared`, and `testing` packages.

### Options Evaluated

| Criteria                      | Traditional Monolith | Modular Monolith       | Microservices                  |
| ----------------------------- | -------------------- | ---------------------- | ------------------------------ |
| Team Size Fit (<7 devs)       | Good                 | Excellent              | Poor (overhead)                |
| Development Velocity          | High                 | High                   | Low (infrastructure)           |
| Deployment Complexity         | Low                  | Low                    | High                           |
| Domain Isolation              | None                 | Good                   | Excellent                      |
| Operational Cost              | Low                  | Low                    | High                           |
| Testability                   | Medium               | High (DI)              | High                           |
| Future Extraction to Services | Hard                 | Easy                   | Already done                   |
| Shared Data Access            | Simple               | Simple with boundaries | Complex (eventual consistency) |

## Decision

**Adopt a Modular Monolith architecture** for the Sovren backend, using:

1. **Dependency Injection Container** (`ServiceContainer` with `TYPES` registry) to manage 29+ services across 5 domains with explicit lifetime management (singleton, scoped, transient).

2. **Domain-based Service Organization** with clear boundaries:

   - Infrastructure (6 services): Container, EventBus, Cache, Logger, Config, Database
   - Shared (4 services): Email, Notification, AuditLog, Cache
   - Content (7 services): Publishing, Moderation, Search, Recommendation, Analytics, Versioning, Creation
   - User (5 services): Profile, Preferences, Activity, Relationship, Analytics
   - Payment (7 services): Processing, Currency, Subscription, Refund, Analytics, Webhook, Invoice

3. **Event-Driven Communication** between domains via an in-memory EventBus, enabling loose coupling without the operational overhead of a message broker.

4. **Repository Pattern** for data access abstraction, making each domain testable in isolation and allowing future database-per-service extraction.

5. **API Versioning** (`/api/v1/`) with domain-scoped routes (`/content/*`, `/users/*`, `/payments/*`) plus legacy routes at `/api/auth/*` and `/api/lightning/*`.

## Rationale

### Why Not Microservices

Microservices would impose significant overhead for a 5-7 person team:

- Service mesh, container orchestration, distributed tracing
- Network latency for inter-service calls (NOSTR + Lightning already add external latency)
- Data consistency challenges for payment operations that span users and content
- Operational complexity that diverts engineering time from product features

### Why Not a Traditional Monolith

A traditional monolith without module boundaries would:

- Make it hard to parallelize development across domains
- Create tight coupling that prevents future extraction
- Reduce testability (no DI, no clear interfaces)
- Lead to a "big ball of mud" as features accumulate

### Why Modular Monolith Fits

The modular monolith provides:

- **Single deployable unit**: One Docker container, simple deployment pipeline (22+ GitHub Actions workflows already configured)
- **Strong module boundaries**: DI container enforces explicit dependencies, services only communicate through interfaces and EventBus
- **Extraction-ready**: Each domain (Content, User, Payment) has its own services, controllers, DTOs, validators, and routes that can be extracted to separate services when team size warrants it
- **Shared database with RLS**: PostgreSQL Row-Level Security provides data isolation at the database level without requiring separate databases per domain

## Consequences

### Positive

- Fast development: Single codebase, shared types via `packages/shared`, no network boundaries to manage
- Easy testing: DI container allows mocking any service, integration tests run against a single process
- Low operational cost: Single container deployment, no service mesh, minimal infrastructure
- Clear upgrade path: Domains are already isolated enough to extract when team grows beyond 10 developers

### Negative

- Single point of failure: One backend process handles all domains (mitigated by health checks and auto-restart)
- Shared database: Schema changes can affect multiple domains (mitigated by RLS and migration system)
- In-memory EventBus: Events are lost on process restart (acceptable for current scale; replace with Redis pub/sub or NATS when needed)

### Neutral

- Team must maintain discipline around module boundaries (DI container helps enforce this)
- All domains share the same Node.js process and thread pool (acceptable for current traffic projections)

## Implementation

The architecture is already implemented in the existing codebase:

- **DI Container**: `/packages/backend/src/container/ServiceContainer.ts`
- **Service Types**: `/packages/backend/src/container/types.ts` (29 services with lifetimes and dependencies)
- **Domain Routes**: `/packages/backend/src/routes/v1/` (content, user, payment)
- **Controllers**: `/packages/backend/src/controllers/` (content, user, payment)
- **Service Layer**: `/packages/backend/src/services/` (organized by domain)
- **EventBus**: `/packages/backend/src/services/EventBusService.ts`
- **Factory Pattern**: `/packages/backend/src/factories/` (per-domain factories)

## References

- Martin Fowler, "MonolithFirst" (2015)
- Kamil Grzybek, "Modular Monolith with DDD" (2019)
- Sam Newman, "Building Microservices" (2021) - Chapter on monolith-first approach
- Existing ADRs: ADR-001 (Inversify DI), ADR-002 (Event-Driven), ADR-004 (Repository Pattern)
