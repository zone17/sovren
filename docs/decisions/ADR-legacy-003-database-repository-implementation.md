# ADR-003: Database Repository Implementation - Supabase Client SDK over Prisma

**Status:** Proposed
**Date:** 2026-02-11
**Decision Makers:** Architecture Team
**Relates To:** FR-001 (Production Database Integration)

## Context

Multiple backend services (SubscriptionService, PaymentProcessingService, InvoiceService, RefundService, WebhookService) currently use in-memory Map-based storage. These must be replaced with PostgreSQL-backed implementations for production deployment.

Two data access approaches exist in the codebase:

1. **Supabase Client SDK** (`@supabase/supabase-js`) - Used by `config/database.ts`, the primary database connection layer
2. **Prisma** (`@prisma/client`) - Referenced in `user-subscription-service.ts` only

The existing repository interfaces (from the DI container) are already defined. The question is which driver to use for the concrete implementations.

### Options Evaluated

| Criteria                 | Supabase Client SDK                | Prisma ORM              | Raw pg Driver         |
| ------------------------ | ---------------------------------- | ----------------------- | --------------------- |
| Already used in codebase | Yes (primary DB layer)             | Partial (1 service)     | Yes (pool.ts, pg dep) |
| Schema management        | Supabase migrations                | Prisma migrations       | Manual SQL            |
| RLS compatibility        | Native                             | Requires workaround     | Native                |
| Type generation          | Manual (Zod schemas)               | Auto-generated          | Manual                |
| Query builder            | Built-in                           | Generated client        | Manual SQL            |
| Connection pooling       | Managed by Supabase                | Managed by Prisma       | Manual via pg Pool    |
| Learning curve for team  | Low (already primary)              | Medium (new ORM)        | Low                   |
| Performance overhead     | Low (thin client)                  | Medium (query engine)   | None                  |
| Migration story          | Already using supabase/migrations/ | Would require migration | Not applicable        |

## Decision

**Use the Supabase Client SDK for all new repository implementations. Remove the Prisma reference from user-subscription-service.ts.**

Specifically:

1. All InMemoryRepository implementations are replaced with Supabase Client SDK queries
2. The existing `SupabaseDatabase` class in `config/database.ts` provides the connection singleton
3. Repository implementations use the Supabase `.from('table').select/insert/update/delete` API
4. Complex queries (transactions, locks) use the `pg` driver via `database/pool.ts` for raw SQL where needed
5. The Prisma dependency is removed from the project

## Rationale

### Why Not Prisma

- **Dual migration system**: The project already has a mature Supabase migration system (`supabase/migrations/` with baseline + 8 incremental migrations, rollback support, testing framework). Adding Prisma migrations would create two competing schema management systems.
- **RLS incompatibility**: Prisma does not natively support PostgreSQL Row-Level Security. Supabase Client SDK sends auth context with every query, making RLS policies work transparently.
- **Minimal usage**: Only `user-subscription-service.ts` references Prisma. All other database access uses the Supabase Client SDK. Standardizing on one approach reduces cognitive overhead.
- **Additional dependency**: Prisma adds a query engine binary (~30MB) to the Docker image, increasing build time and image size.

### Why Supabase Client SDK

- **Already the primary database layer**: `config/database.ts` provides a singleton `SupabaseDatabase` instance used throughout the backend.
- **RLS works natively**: Auth context is passed with queries, enabling Row-Level Security without workarounds.
- **Migration system exists**: `supabase/migrations/` is mature with baseline schema, incremental migrations, rollback procedures, and testing utilities.
- **Simpler type story**: The `packages/shared/src/types/` directory already has comprehensive Zod schemas for all entities. These serve as the type layer without needing Prisma's generated types.

### Where to Use Raw pg Driver

For operations that require database-level primitives not available through the Supabase Client SDK:

- `SELECT FOR UPDATE` row-level locking (EC-001: concurrent subscription race condition)
- Multi-statement transactions with savepoints
- Database functions and stored procedures (payment state machine transitions)
- Bulk operations with COPY

The `pg` driver is already a direct dependency and `database/pool.ts` provides connection pooling.

## Consequences

### Positive

- Single, consistent data access pattern across all services
- RLS works transparently without workarounds
- No additional ORM dependency (smaller Docker image, fewer moving parts)
- Existing migration system continues to work unchanged

### Negative

- No auto-generated types from database schema (mitigated by comprehensive Zod schemas in shared package)
- No Prisma Studio for visual database exploration (mitigated by Supabase Dashboard)
- Manual query construction for complex joins (mitigated by Supabase's `.select('*, relation(*)')` syntax)

### Migration Steps

1. Implement `SubscriptionRepository` using Supabase Client SDK
2. Implement `PaymentRepository` (if not already backed by Supabase)
3. Implement `InvoiceRepository` using Supabase Client SDK
4. Implement `RefundRepository` using Supabase Client SDK
5. Implement `WebhookRepository` using Supabase Client SDK
6. Migrate `user-subscription-service.ts` from Prisma to Supabase Client SDK
7. Remove `@prisma/client` dependency from package.json

## References

- Existing DB config: `/packages/backend/src/config/database.ts`
- Existing pool: `/packages/backend/src/database/pool.ts`
- Migration system: `/supabase/migrations/`
- FR-001 requirements in `/docs/requirements.md`
