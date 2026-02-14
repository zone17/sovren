---
title: 'P2 Deferred Fixes: Type Safety, DI Integration, and API Coverage'
date: 2026-02-14
category: architecture-issues
tags:
  - type-safety
  - dependency-injection
  - api-endpoints
  - service-token
  - code-review
module: backend
severity: p2
status: completed
symptoms:
  - 46 ServiceToken<any> declarations defeat TypeScript type safety in DI container
  - SecretsService manages its own singleton lifecycle outside DI container
  - v1 API has only 65% endpoint coverage (22 of 34 capabilities exposed)
root_cause:
  - container/types.ts used <any> for all service tokens because interfaces were not imported
  - SecretsService was never registered in bootstrap.ts registerInfrastructureServices()
  - Content CRUD and subscription read endpoints were never added to v1 routes
---

# P2 Deferred Fixes: Type Safety, DI Integration, and API Coverage

## Problem

Three deferred P2 findings from the PR #73 code review (rounds 1-5, spanning infrastructure sprint through P1 critical fixes) were left unresolved:

1. **Todo 074** - `ServiceToken<any>` used 46 times in `container/types.ts`, making the DI container effectively untyped
2. **Todo 010** - `SecretsService` declared but never registered in the DI container, managing its own singleton lifecycle via `getSecretsService()` factory
3. **Todo 012** - Only 65% of backend capabilities were exposed via v1 API endpoints (missing content CRUD and subscription reads)

## Investigation

### Fix 074: ServiceToken<any> Typing

The `ServiceToken<T>` generic in `IServiceRegistry.ts` supports proper typing, but every token in `types.ts` was declared as `ServiceToken<any>`. The challenge was locating all service interfaces — they were scattered across:

- `interfaces/content/`, `interfaces/payment/`, `interfaces/user/`, `interfaces/shared/` — canonical locations
- `factories/payment/PaymentServiceFactory.ts` — `IInvoiceService` only defined here
- `factories/shared/SharedServiceFactory.ts` — `IEmailService`, `INotificationService`, `IAuditLogService`
- `factories/user/UserServiceFactory.ts` — `IUserAuthenticationService`

Used `Grep` to find all `export interface I*Service` patterns and map them to canonical files.

### Fix 010: SecretsService DI

`SecretsService` was a standalone class with its own singleton pattern (`getSecretsService()`). The bootstrap sequence in `registerInfrastructureServices()` registered Logger, EventBus, Cache, Config, Database, but not SecretsService. It also lacked a health check and metadata entries (SERVICE_LIFETIMES, SERVICE_DEPENDENCIES, SERVICE_TAGS).

### Fix 012: Missing v1 Endpoints

Compared backend service capabilities to v1 route files:

- Content: Had publish, search, moderate, analytics, versions — missing list, get, update, delete
- Payment: Had invoices, pay, currency, subscriptions (create/update/cancel), refunds, analytics, webhooks — missing subscription tiers listing and individual subscription reads

## Solution

### Fix 074: 28 of 46 Tokens Typed (61% reduction)

Added 33 `import type` statements to `types.ts` for all resolvable interfaces:

```typescript
import type { ILogger } from '../interfaces/shared/ILogger';
import type { IContentCreationService } from '../interfaces/content';
import type { IPaymentProcessingService } from '../interfaces/payment/IPaymentProcessingService';
import type { ContentController } from '../controllers/content/ContentController';
import type { SecretsService } from '../services/SecretsService';
// ... 28 more
```

Key decision: Used `import type` (not `import`) to avoid circular dependencies at runtime. TypeScript strips type-only imports during compilation, so the DI container file doesn't create import cycles with the services it registers.

18 tokens remain as `<any>` — these are infrastructure placeholders (ServiceContainer, RepositoryFactory, MigrationService, DependencyAnalyzer, Config, Database, Redis, 5 Repositories, LightningService, NostrService, ElasticsearchService, ValidationService, RateLimitService) that don't yet have interface definitions.

### Fix 010: SecretsService DI Registration

```typescript
// bootstrap.ts - registerInfrastructureServices()
registry.registerSingletonFactory(TYPES.SecretsService, () => {
  return new SecretsService({
    environment: (process.env.NODE_ENV as any) || 'development',
    useAwsSecrets: process.env.USE_AWS_SECRETS === 'true',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
  });
});
```

Added health check, SERVICE_LIFETIMES (singleton), SERVICE_DEPENDENCIES, and SERVICE_TAGS entries.

### Fix 012: 6 New v1 Endpoints

**Content routes** (4 new):

- `GET /api/v1/content` — list/feed with optional query, sort, filters
- `GET /api/v1/content/:id` — get single content item
- `PUT /api/v1/content/:id` — update content
- `DELETE /api/v1/content/:id` — delete content

**Payment routes** (2 new):

- `GET /api/v1/payments/subscriptions/tiers` — list subscription plans (public)
- `GET /api/v1/payments/subscriptions/:id` — get specific subscription

Route ordering was critical: parameterized `/:id` routes placed AFTER named routes (`/publish`, `/search`, `/moderate`) to prevent Express from matching `/publish` as an `:id` parameter.

Added `ListContentSchema` and `UpdateContentSchema` validators. Made `ContentCreationService.getContent()` public and added `updateContent()` and `deleteContent()` methods.

## Metrics

| Metric                    | Before | After           |
| ------------------------- | ------ | --------------- |
| `ServiceToken<any>` count | 46     | 18              |
| Type coverage improvement | —      | 61% reduction   |
| v1 API endpoints          | 25     | 31              |
| API capability coverage   | 65%    | ~91%            |
| SecretsService in DI      | No     | Yes (singleton) |

## Prevention

1. **New service tokens should always be typed** — add `import type` for the interface when creating the token
2. **New services must be registered in bootstrap.ts** — the DI container is the single source of truth for service lifecycle
3. **New backend capabilities need v1 routes** — agent-native coverage should stay above 90%
4. **Route ordering matters** — always place parameterized `/:id` routes after named routes in Express

## Key Learnings

- **`import type` is essential for DI registries**: Regular imports from the services being registered would create circular dependencies. `import type` is erased at compile time, making it safe for type-only references in container configuration.
- **Interface location matters**: Service interfaces scattered across `interfaces/`, `factories/`, and service files made discovery hard. Canonical interface locations should be in `interfaces/` — factory-only interfaces are a code smell.
- **Todo accuracy varies**: Todo 074 claimed "97 ServiceToken<any>" but actual count was 46. Always verify against source before implementing.
- **Solo implementation can be more efficient than team for tightly coupled changes**: All 3 fixes touched overlapping files (types.ts, bootstrap.ts, controller bindings). A team would have created merge conflicts. Solo sequential implementation with a single verification pass was cleaner.

## Files Modified

- `packages/backend/src/container/types.ts` — 33 import types added, 28 tokens typed, SecretsService token added
- `packages/backend/src/bootstrap.ts` — SecretsService registration and health check
- `packages/backend/src/controllers/content/ContentController.ts` — 4 new methods
- `packages/backend/src/controllers/payment/PaymentController.ts` — 2 new methods
- `packages/backend/src/services/content/ContentCreationService.ts` — getContent public, updateContent, deleteContent added
- `packages/backend/src/routes/v1/content.routes.ts` — 4 new routes
- `packages/backend/src/routes/v1/payment.routes.ts` — 2 new routes
- `packages/backend/src/validators/content/index.ts` — ListContentSchema, UpdateContentSchema added
- `packages/backend/src/container/bindings/controller.bindings.ts` — ContentCreationService injection
