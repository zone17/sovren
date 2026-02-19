---
status: pending
priority: p2
issue_id: 324
tags: [code-review, typescript, di]
---

# `as any` cast in DI binding for MarketplaceService

## Problem Statement

The MarketplaceService DI binding uses `lightning as any` to bypass type checking, while all other bindings in the same file use properly typed casts. This defeats the purpose of the DI type system and could mask injection errors at compile time.

## Findings

- `packages/backend/src/container/bindings/community.bindings.ts:57` — `lightning as any` used in MarketplaceService binding
- All other bindings in the same file use typed casts (e.g., `as IService`)

## Proposed Solutions

1. Define or import the `ILightningService` interface
2. Replace `lightning as any` with `lightning as ILightningService`
3. Ensure the interface matches the actual LightningService implementation

## Technical Details

- **Affected Files**: packages/backend/src/container/bindings/community.bindings.ts

## Acceptance Criteria

- [ ] `as any` cast removed from MarketplaceService binding
- [ ] Proper typed interface used for the lightning dependency
- [ ] TypeScript compiles without errors
- [ ] No new `as any` casts introduced
