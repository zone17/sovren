---
status: pending
priority: p2
issue_id: 744
tags: [code-review, slice-8, architecture, duplication, follow-service, user-relationships]
dependencies: []
---

# #744 - UserRelationshipService Overlap — Dual Follow Systems

## Problem Statement

Slice 8 introduced a new `FollowService` that writes to a `followers` table, while a pre-existing `UserRelationshipService` already handles follow/unfollow and writes to a `user_relationships` table. Two independent follow systems now coexist for the same domain. This creates data inconsistency risk, confuses consumers about which system is authoritative, and doubles the maintenance surface for follow-related features.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `UserRelationshipService` (pre-existing): writes follow/unfollow to `user_relationships` table; registered in `UserServiceFactory`
- `FollowService` (new, Slice 8): writes follow/unfollow to `followers` table; registered in the community service factory
- Both are accessible from different parts of the application
- Data in `user_relationships` and `followers` tables will diverge unless both are always written together
- No cross-reference or synchronization between the two systems
- `UserServiceFactory.ts` still wires `UserRelationshipService` into the DI container

## Proposed Solutions

Consolidate to a single follow system. Two options:

**Option A (recommended): Deprecate FollowService, migrate to UserRelationshipService**

- `FollowService` (new code) is redirected to use `user_relationships` table and `UserRelationshipService` logic
- New endpoints delegate to `UserRelationshipService`
- `followers` table migration either repurposed or removed
- Requires: audit which columns/features `followers` table has that `user_relationships` lacks

**Option B: Deprecate UserRelationshipService, migrate to FollowService**

- `UserRelationshipService` callers migrated to `FollowService`
- `user_relationships` table data migrated to `followers` table
- `UserRelationshipService` removed from DI container after migration
- More disruptive but results in a cleaner, Slice-8-aligned data model

In either case: pick one authoritative system, migrate the other's callers, and decommission the duplicate.

## Technical Details

- **Files**: `factories/user/UserServiceFactory.ts`, `services/community/FollowService.ts`
- **Tables**: `user_relationships` (existing), `followers` (new)
- **Discovery**: Run `grep -rn "UserRelationshipService\|FollowService" src/` to find all call sites
- **Risk**: Data migration if both tables have production data at time of consolidation
- **Note**: This may be a larger refactor than a single sprint item — scope carefully and consider a phased approach (deprecation warnings → migration PR → removal PR)

## Acceptance Criteria

- [ ] Decision made: which system is authoritative (Option A or B), documented in a comment or ADR
- [ ] Single follow system used across entire application
- [ ] Deprecated service removed from DI container
- [ ] Deprecated table either removed or confirmed empty and dropped
- [ ] All call sites migrated to the chosen authoritative service
- [ ] Existing follow-related tests pass against the consolidated service
- [ ] No data inconsistency possible after consolidation (single write path)
