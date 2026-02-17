---
module: System
date: 2026-02-16
problem_type: infrastructure
component: monorepo_dependencies
symptoms:
  - "3 different nostr-tools versions across monorepo (2.1.4, 2.13.1, 2.13.2)"
  - "No persistent job queue — NotificationService uses in-memory array"
  - "Missing ADRs for custodial design and job queue selection"
resolution_type: infrastructure_setup
root_cause: missing_infrastructure
severity: high
tags: [infrastructure, nostr-tools, bullmq, adr, epic-009, epic-010, epic-012, e0-001, e0-006, e0-007]
---

# Infrastructure Prerequisites Sprint: nostr-tools Unification, BullMQ, and ADRs

## Problem

Three infrastructure prerequisites from PRD v2 Epic Decomposition blocked downstream epic implementation:

1. **E0-006 (nostr-tools Unification)**: The monorepo had three conflicting versions of nostr-tools (2.1.4 in backend, 2.13.1 in frontend, 2.13.2 in root). The v2.x API had breaking changes from v2.1.x (renamed functions, removed helpers, modularized imports). Epic-009 (NOSTR Relay Scanner) and Epic-010 (Creator Network) both depend on a unified, current nostr-tools.

2. **E0-001 (BullMQ Infrastructure)**: `NotificationService` used an in-memory array with `setInterval` polling every 5 seconds as its job queue. This meant: data loss on restart, no horizontal scaling, no dead letter queue, no observability. Epic-012 (Background Processing) requires a real persistent queue.

3. **E0-007 (Missing ADRs)**: Epic-010 (Creator Network) requires custodial payment design decisions (revenue splitting, escrow) and Epic-009/012 require job queue technology selection. No ADRs existed for either.

## Environment

- **Monorepo**: npm workspaces (`packages/backend`, `packages/frontend`, `packages/shared`)
- **Backend**: Node.js + TypeScript + Express + Inversify DI
- **Frontend**: React 18 + TypeScript + Vite
- **Existing infra**: Redis (via ioredis), Supabase, NOSTR relay connections
- **Branch**: `feature/infrastructure-prerequisites-e0`
- **PR**: #83

## Symptoms

- `npm ls nostr-tools` showed 3 different versions across the monorepo
- `packages/backend/src/services/content/ContentPublishingService.ts` used deprecated `signEvent()` and `getEventHash()` APIs
- Frontend services imported from `nostr-tools` root instead of modular subpaths (`nostr-tools/pure`, `nostr-tools/pool`, `nostr-tools/nip04`)
- `NotificationService` had `private readonly queue: NotificationQueueItem[] = []` — an in-memory array as a job queue
- No `/docs/adr/ADR-021*` or `/docs/adr/ADR-022*` files existed
- `/health/detailed` endpoint had no queue health check section

## Solution

### E0-006: nostr-tools 2.1.4/2.13.1/2.13.2 to 2.23.0

Migrated 19 files (2 backend, 14 frontend, 3 package.json) to nostr-tools v2.23.0 with modular imports.

**Breaking API changes applied:**

| Old (v2.1.x / v2.13.x) | New (v2.23.0) | Reason |
|---|---|---|
| `generatePrivateKey()` | `generateSecretKey()` from `nostr-tools/pure` | Returns `Uint8Array` instead of hex string |
| `signEvent(event, key)` | `finalizeEvent(event, key)` from `nostr-tools/pure` | Computes id + sig + returns `VerifiedEvent` in one call |
| `getEventHash(event)` | Removed (built into `finalizeEvent`) | No longer needed as separate step |
| `import { SimplePool } from 'nostr-tools'` | `import { SimplePool } from 'nostr-tools/pool'` | Modular subpath exports |
| `import { nip04 } from 'nostr-tools'` | `import * as nip04 from 'nostr-tools/nip04'` | NIP modules are separate entry points |

**Backend: ContentPublishingService.ts signNostrEvent() rewrite**

Before (v2.1.4):
```typescript
import { getEventHash, signEvent } from 'nostr-tools';

private async signNostrEvent(event, privateKey: string) {
  event.id = getEventHash(event);
  event.sig = signEvent(event, privateKey);
  return event;
}
```

After (v2.23.0):
```typescript
import { finalizeEvent, type VerifiedEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { hexToBytes } from '@noble/hashes/utils';

private async signNostrEvent(
  event: { kind: number; pubkey: string; created_at: number; tags: string[][]; content: string },
  privateKey: string
): Promise<VerifiedEvent> {
  const secretKey = hexToBytes(privateKey);
  return finalizeEvent({
    kind: event.kind,
    created_at: event.created_at,
    tags: event.tags,
    content: event.content,
  }, secretKey);
}
```

**Frontend: auth.ts key generation rewrite**

```typescript
// Before: import { generatePrivateKey, getPublicKey } from 'nostr-tools';
// After:
export async function generateNostrKeys() {
  const { generateSecretKey, getPublicKey } = await import('nostr-tools/pure');
  const privateKey = generateSecretKey();  // Returns Uint8Array
  const publicKey = getPublicKey(privateKey);
  return { publicKey, privateKey: bytesToHex(privateKey) };
}
```

### E0-007: Two P0-CRITICAL ADRs

**ADR-021: Custodial Design for Creator Payments** (`docs/adr/ADR-021-custodial-design.md`)
- Decision: HODL invoices for revenue splitting + escrow (non-custodial)
- Rationale: Avoids Money Transmitter License requirements, preserves decentralized philosophy
- Trade-off: Requires both parties online during payment window

**ADR-022: Job Queue Selection** (`docs/adr/ADR-022-job-queue-selection.md`)
- Decision: BullMQ (reuses existing Redis/ioredis infrastructure)
- Evaluated: BullMQ vs Agenda.js vs custom PostgreSQL queue
- Rationale: Zero new infrastructure (Redis already deployed), rich feature set (retries, DLQ, priorities, scheduling, admin UI via Bull Board)

### E0-001: BullMQ Infrastructure Setup

**Packages installed**: `bullmq`, `@bull-board/express`, `@bull-board/api`

**Interface-first design** — two interfaces define the contract:

`IQueueService` (`packages/backend/src/interfaces/queue/IQueueService.ts`):
```typescript
export interface IQueueService {
  createQueue(name: string, options?: Partial<QueueOptions>): void;
  addJob<T>(queueName: string, jobName: string, data: T, options?: JobsOptions): Promise<string>;
  getQueue(name: string): Queue | undefined;
  getQueueNames(): string[];
  isHealthy(): Promise<boolean>;
  closeAll(): Promise<void>;
}
```

`IJobProcessor` (`packages/backend/src/interfaces/queue/IJobProcessor.ts`):
```typescript
export interface IJobProcessor<T = unknown> {
  readonly name: string;
  readonly queueName: string;
  readonly concurrency?: number;
  process(job: Job<T>): Promise<void>;
  onCompleted?(job: Job<T>): Promise<void>;
  onFailed?(job: Job<T>, error: Error): Promise<void>;
}
```

**DI registration** (`packages/backend/src/container/bindings/queue.bindings.ts`):
```typescript
export class QueueServicesModule implements IServiceModule {
  register(registry: IServiceRegistry): void {
    registry.registerSingletonFactory(TYPES.QueueService, (container) => {
      const logger = container.resolve(TYPES.Logger);
      return new QueueService(logger);
    });
  }
}
```

**Bull Board admin UI** at `/admin/queues` (`packages/backend/src/routes/admin/bull-board.ts`):
```typescript
export function createBullBoardRouter(queueService: IQueueService): Router {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  const adapters = queueService.getQueueNames().map((name) => {
    return new BullMQAdapter(queueService.getQueue(name)!);
  });
  createBullBoard({ queues: adapters, serverAdapter });
  return serverAdapter.getRouter();
}
```

**Queue health check** added to `/health/detailed` endpoint:
```typescript
async function checkQueues(): Promise<ServiceHealth> {
  const { getQueueServiceInstance } = await import('../services/queue/QueueService');
  const queueService = getQueueServiceInstance();
  if (!queueService) {
    return { status: 'degraded', error: 'QueueService not initialized yet' };
  }
  const healthy = await queueService.isHealthy();
  return { status: healthy ? 'healthy' : 'unhealthy' };
}
```

**NotificationService refactored**: Constructor now accepts optional `IQueueService`. When present, notifications are enqueued via `addJob()` to a persistent `notifications` queue with a `notifications-dlq` dead letter queue, replacing the in-memory array.

## Changes Summary

| Category | Files Changed | Key Changes |
|---|---|---|
| nostr-tools migration (backend) | 2 | `ContentPublishingService.ts`, `ContentModerationService.ts` |
| nostr-tools migration (frontend) | 14 | `auth.ts`, `KeyManagementService.ts`, `NIP19Service.ts`, `NIP26Service.ts`, `NIP65Service.ts`, `NOSTRKeyManagementService.ts`, `NOSTRSigningService.ts`, `NOSTRSessionService.ts`, `NOSTRAccountProtectionService.ts`, `nostrService.ts`, `useFeedSubscription.ts`, `NotificationService.ts` (frontend), test mocks, e2e fixtures |
| nostr-tools package.json | 3 | Root, backend, frontend — all pinned to `2.23.0` |
| ADRs | 2 | `ADR-021-custodial-design.md`, `ADR-022-job-queue-selection.md` |
| BullMQ interfaces | 3 | `IQueueService.ts`, `IJobProcessor.ts`, `index.ts` |
| BullMQ implementation | 2 | `QueueService.ts`, `queue/index.ts` |
| DI bindings | 2 | `queue.bindings.ts`, `shared.bindings.ts` |
| Admin UI | 1 | `routes/admin/bull-board.ts` |
| Health check | 1 | `routes/health.ts` (added `checkQueues()`) |
| NotificationService | 1 | Refactored from in-memory to BullMQ |
| **Total** | **~31 files** | |

## Why This Works

1. **nostr-tools v2.23.0 modular imports prevent future version fragmentation**: Each subpath (`nostr-tools/pure`, `nostr-tools/pool`, `nostr-tools/nip04`) is tree-shakeable. A single version in root `package.json` with workspace hoisting ensures all packages resolve to the same version.

2. **`finalizeEvent()` is safer than the old 3-step pattern**: The old pattern (`getEventHash` then `signEvent` then manual assignment) could produce events with mismatched id/sig if any step was done out of order. `finalizeEvent()` atomically computes both and returns a `VerifiedEvent` type that TypeScript enforces.

3. **BullMQ reuses existing Redis**: No new infrastructure to deploy or manage. `QueueService` calls `getRedisClient().duplicate()` for each queue and worker, sharing the same connection pool configuration that the rest of the backend already uses.

4. **Interface-first design enables testing and swapping**: `IQueueService` and `IJobProcessor` are pure interfaces. Tests can mock the queue service. If BullMQ needs to be replaced later (unlikely given Redis investment), only `QueueService.ts` changes.

5. **Singleton pattern with getter avoids circular DI**: `getQueueServiceInstance()` lets the health check route access the queue service without importing from the DI container, avoiding circular dependency at module load time.

6. **ADR-021 HODL invoice decision avoids regulatory landmines**: Non-custodial approach means Sovren never holds user funds, avoiding Money Transmitter License requirements across all US states.

7. **ADR-022 BullMQ decision has zero infrastructure cost**: The only alternative with zero new dependencies was BullMQ (uses existing Redis). Agenda.js would have required MongoDB. Custom PostgreSQL queue would have required schema design and polling logic.

## Prevention

1. **Pin nostr-tools in root `package.json` only**: Use npm workspace hoisting so all packages resolve to the same version. Never add nostr-tools to individual package.json files — let workspace resolution handle it.

2. **Use modular imports exclusively**: Always `import { X } from 'nostr-tools/pure'` or `nostr-tools/pool`, never from the root `nostr-tools` path. This ensures tree-shaking works and makes the API surface explicit.

3. **Never use in-memory arrays as job queues**: Any background processing that survives restarts must go through `IQueueService.addJob()`. The in-memory pattern was a prototype shortcut that persisted too long.

4. **Write ADRs before implementation for cross-cutting decisions**: ADR-022 was written before BullMQ infrastructure was built. This confirmed the technology choice before investing implementation effort. ADR-021 documents the custodial trade-offs before Epic-010 implementation begins.

5. **Add health checks when adding infrastructure**: Every new service dependency (queues, caches, external APIs) must be represented in `/health/detailed`. The `checkQueues()` pattern (dynamic import, graceful degradation when not initialized) is the template.

## Sprint Process Notes

- **Team**: Standard tier — 4 parallel implementation agents + lead coordination
- **Agent assignments**: backend-nostr (2 files), frontend-nostr (14 files), adr-custodial, adr-jobqueue, bullmq-builder (spawned after ADR-022)
- **Verification**: qa-agent + review-agent in parallel
- **Duration**: ~10 minutes of parallel agent execution
- **Commits**: 8 (including post-migration import cleanup)
- **Key learning**: Initial nostr-tools scope estimate was 7 files; actual was 19. Three parallel Explore agents were needed to discover all affected imports across the monorepo. Always run deep codebase exploration for dependency migration scope.
