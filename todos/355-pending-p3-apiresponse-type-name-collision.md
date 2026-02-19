---
status: pending
priority: p3
issue_id: 355
tags: [code-review, types]
---

# `ApiResponse` type name collision between creator-network and business barrel exports

## Problem Statement

Both the creator-network and business feature modules export a type named `ApiResponse`. If a master barrel file re-exports both modules, the names will collide, causing a TypeScript error or one silently shadowing the other.

## Findings

- Both feature modules define and export a type called `ApiResponse`
- Currently works because they are imported separately, but a unified barrel re-export would break
- Name collision makes it ambiguous which `ApiResponse` is being used in shared code

## Proposed Solutions

1. Rename to domain-specific names: `CommunityApiResponse` and `BusinessApiResponse`
2. Alternatively, consolidate into a single shared `ApiResponse` generic type in `packages/shared/`
3. If the types are structurally identical, deduplicate to one shared definition

## Acceptance Criteria

- [ ] No two modules export the same type name at the barrel level
- [ ] All import sites updated to use the new names
- [ ] TypeScript compilation succeeds with a master barrel re-export of both modules
