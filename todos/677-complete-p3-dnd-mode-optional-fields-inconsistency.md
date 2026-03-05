---
status: complete
priority: p3
issue_id: 677
tags: [code-review, slice-7, types, interface, wellness, dnd]
dependencies: []
---

## Problem Statement

In the `IBoundaryService` interface, the `dnd_mode` object has `active` as optional but `auto_response_enabled` and `auto_response_template` are required. This forces callers who only want to toggle DND on/off to supply all response-related fields, making partial updates unnecessarily verbose.

## Findings

- **File**: `packages/backend/src/interfaces/wellness/IBoundaryService.ts:16-21`
- The `dnd_mode` type definition:
  ```typescript
  dnd_mode: {
    active?: boolean;
    auto_response_enabled: boolean;       // required
    auto_response_template: string;       // required
  }
  ```
- A caller wanting to toggle `active` must also provide `auto_response_enabled` and `auto_response_template`, even if they don't want to change those values
- This creates unnecessary coupling — toggling DND mode is conceptually independent from configuring auto-response behavior
- Frontend components must fetch and re-supply existing values for fields they don't intend to modify

## Proposed Solutions

1. Make `auto_response_enabled` and `auto_response_template` optional:
   ```typescript
   dnd_mode: {
     active?: boolean;
     auto_response_enabled?: boolean;
     auto_response_template?: string;
   }
   ```
2. Update the service implementation to merge incoming partial updates with existing stored values (PATCH semantics rather than PUT)
3. If the service already uses PATCH semantics internally, only the interface change is needed
4. Consider adding a Zod refinement: if `auto_response_enabled` is `true`, `auto_response_template` must be provided (conditional requirement)

## Recommended Action

## Technical Details

- The interface likely represents the input to an update/upsert operation on the `creator_boundaries` table
- If the service layer does a full replace (PUT semantics), making fields optional requires updating the service to merge with existing DB values
- If the service already does a partial update (PATCH semantics), the interface is simply overly strict
- The Zod validator for this input should be updated to match the interface change
- Frontend forms using this interface can simplify their submit handlers by only sending changed fields

## Acceptance Criteria

- [ ] `auto_response_enabled` and `auto_response_template` are optional in the `dnd_mode` type
- [ ] Service implementation correctly handles partial updates (merges with existing values)
- [ ] Zod validator updated to match the new optionality
- [ ] If `auto_response_enabled` is `true`, `auto_response_template` is conditionally required (or a sensible default is used)
- [ ] Existing callers that provide all fields continue to work without changes

## Work Log

## Resources

- `packages/backend/src/interfaces/wellness/IBoundaryService.ts:16-21`
- Related Zod validators in `packages/backend/src/validators/wellness.ts`
- `creator_boundaries` table schema in Supabase migrations
