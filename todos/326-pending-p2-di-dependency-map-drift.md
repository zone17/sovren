---
status: pending
priority: p2
issue_id: 326
tags: [code-review, architecture, di]
---

# DI dependency map drift — 4 services declare deps not actually injected

## Problem Statement

Four services declare dependencies in `SERVICE_DEPENDENCIES` that are never actually injected into the service constructors. This drift between declared and actual dependencies creates misleading documentation, can cause unnecessary service instantiation, and indicates incomplete implementation or stale refactoring artifacts.

## Findings

- `packages/backend/src/container/types.ts` — SERVICE_DEPENDENCIES entries:
  - **CollaborativeContentService**: declares `NostrService` + `EventBusService` but neither is injected
  - **MarketplaceService**: declares `EventBusService` but it is not injected
  - **BusinessInvoiceService**: declares `LightningService` but it is not injected
  - **NostrReplyAdapter**: declares `NostrService` but it is not injected

## Proposed Solutions

1. For each service, determine if the dependency was intended but never wired up, or if it was removed but the declaration left behind
2. If the dependency is no longer needed: remove it from `SERVICE_DEPENDENCIES`
3. If the dependency is needed but missing: inject it properly in the binding and service constructor

## Technical Details

- **Affected Files**: packages/backend/src/container/types.ts, packages/backend/src/container/bindings/community.bindings.ts, packages/backend/src/services/community/CollaborativeContentService.ts, packages/backend/src/services/community/MarketplaceService.ts, packages/backend/src/services/finance/BusinessInvoiceService.ts, packages/backend/src/services/nostr/NostrReplyAdapter.ts

## Acceptance Criteria

- [ ] Each of the 4 drifted dependencies investigated and resolved
- [ ] SERVICE_DEPENDENCIES entries match actual injected dependencies
- [ ] No service declares dependencies it does not receive
- [ ] DI container resolves all services without errors
- [ ] Existing tests pass
