---
status: pending
priority: p2
issue_id: '707'
tags: [code-review, shared, dead-code, slice-8]
dependencies: []
---

# events.ts CommunityEventPayload dead code

## Problem Statement

`CommunityEventPayload` discriminated union (33 LOC) is defined in `packages/shared/src/types/events.ts` but never imported or used anywhere. The backend uses inline `as` casts instead of referencing this type.

**Agent consensus: 4/9** (Simplicity, Architecture, Pattern, TypeScript)

## Fix

Either:

1. **Preferred**: Wire up the `CommunityEventPayload` union properly — update backend event emission to use the typed union instead of inline `as` casts. This provides type safety for event payloads.
2. **Alternative**: Delete the dead `CommunityEventPayload` type from `packages/shared/src/types/events.ts` if the inline approach is intentional.
