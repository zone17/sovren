---
status: pending
priority: p2
issue_id: '208'
tags: [code-review, pr-85, architecture]
---

# Concrete Type Coupling in Phase 8 DI Bindings

## Problem Statement

phase8.bindings.ts uses concrete PlatformConnectionService instead of IPlatformConnectionService interface. 4 other services import the concrete class to access getAdapter() method which is not on the interface.

## Findings

- **File**: `packages/backend/src/container/bindings/phase8.bindings.ts`
- **File**: `IPlatformConnectionService.ts` (missing `getAdapter()` method)
- The DI container bindings in phase8.bindings.ts register `PlatformConnectionService` as the concrete class rather than binding it to the `IPlatformConnectionService` interface
- The `getAdapter()` method exists on the concrete `PlatformConnectionService` class but is not declared on the `IPlatformConnectionService` interface
- At least 4 other services import and depend on the concrete `PlatformConnectionService` class directly (instead of the interface) specifically to access `getAdapter()`
- This defeats the purpose of the interface abstraction and DI pattern, making it impossible to swap implementations for testing or future refactoring
- Tight coupling to the concrete class means all 4+ consumers must change if the implementation class is renamed or restructured

## Proposed Solutions

1. Add `getAdapter(platform: string): IPlatformAdapter` to the `IPlatformConnectionService` interface, then update phase8.bindings.ts to bind via the interface. Update all 4 consumer services to depend on the interface instead of the concrete class.
2. If `getAdapter()` is an implementation detail that shouldn't be on the public interface, extract it into a separate `IPlatformAdapterFactory` interface and inject that separately into the services that need it.

## Acceptance Criteria

- [ ] `getAdapter()` is declared on `IPlatformConnectionService` (or extracted to a separate interface)
- [ ] phase8.bindings.ts binds to the interface, not the concrete class
- [ ] All services that previously imported the concrete class now depend on the interface
- [ ] Unit tests can mock IPlatformConnectionService (including getAdapter) without importing the concrete class
