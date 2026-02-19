---
status: pending
priority: p3
issue_id: 357
tags: [code-review, typescript, interface]
---

# `recordRevenueSplitLedger` not declared on ICollaborativeContentService interface

## Problem Statement

The `recordRevenueSplitLedger` method exists as a public method on the `CollaborativeContentService` class but is not declared on the `ICollaborativeContentService` interface. Consumers using the interface through dependency injection cannot call this method without an unsafe type cast.

## Findings

- `recordRevenueSplitLedger` is a public method on the concrete class
- `ICollaborativeContentService` interface does not include this method signature
- DI consumers receive the interface type and would need `as CollaborativeContentService` to access the method
- This breaks the interface segregation principle and undermines the DI pattern

## Proposed Solutions

1. Add `recordRevenueSplitLedger` to the `ICollaborativeContentService` interface with its full signature
2. Alternatively, extract a separate `IRevenueSplitLedgerService` interface if the method belongs to a different domain concern
3. If the method should not be public API, make it `private` or `protected`

## Acceptance Criteria

- [ ] `recordRevenueSplitLedger` is callable through the DI interface without unsafe casts
- [ ] Interface and implementation signatures match
- [ ] All existing callers use the interface type, not the concrete class
