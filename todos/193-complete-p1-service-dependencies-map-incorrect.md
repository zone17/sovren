---
status: pending
priority: p1
issue_id: '193'
tags: [code-review, pr-85, architecture]
---

# SERVICE_DEPENDENCIES Map Contains Incorrect Entries

## Problem Statement

The `SERVICE_DEPENDENCIES` map in `container/types.ts` lists wrong dependencies for `PlatformConnectionService` (claims `SecretsService` and `QueueService` but neither is actually injected via constructor). The map also uses an `as any` cast via `getServiceDependencies()`, silencing all type errors. This means the DI container may instantiate services in the wrong order, pass wrong dependencies, or fail at runtime with cryptic errors instead of clear compile-time failures.

## Findings

- **File**: `packages/backend/src/container/types.ts`, approximately line 582
  - `SERVICE_DEPENDENCIES` map entry for `PlatformConnectionService` lists `SecretsService` and `QueueService` as dependencies
  - `PlatformConnectionService` constructor does NOT inject `SecretsService` or `QueueService`
  - `getServiceDependencies()` function uses `as any` cast, preventing TypeScript from catching mismatches
  - Other entries in the map may also be incorrect (not audited)
  - The `as any` cast means the entire dependency graph is unverified at compile time

## Proposed Solutions

### Solution 1: Audit and Correct All Entries + Remove `as any` (Recommended)

1. For each entry in `SERVICE_DEPENDENCIES`, check the corresponding service constructor to verify listed dependencies match actual injected parameters
2. Fix all incorrect entries to match actual constructor signatures
3. Remove the `as any` cast from `getServiceDependencies()`
4. Add a TypeScript type that enforces the map values match registered service identifiers
5. Consider generating the dependency map from constructor metadata (e.g., `reflect-metadata` decorators) to prevent drift

**Pros**: Correct dependency graph, compile-time safety, prevents future drift
**Cons**: Requires auditing every service constructor (one-time effort)

### Solution 2: Remove Static Map, Use Runtime Reflection

Replace the static `SERVICE_DEPENDENCIES` map with runtime constructor parameter analysis using TypeScript decorators or a DI framework like `tsyringe` or `inversify`.

**Pros**: Dependencies always match constructors, zero maintenance
**Cons**: Requires DI framework migration, significant refactor

## Acceptance Criteria

- [ ] Every entry in `SERVICE_DEPENDENCIES` matches the actual constructor parameters of its corresponding service
- [ ] `PlatformConnectionService` entry lists only its actual constructor dependencies
- [ ] The `as any` cast is removed from `getServiceDependencies()`
- [ ] TypeScript compilation catches future mismatches between the map and constructors
- [ ] DI container instantiates all services successfully with correct dependency order
- [ ] Integration test verifies all services can be resolved from the container without runtime errors
