---
status: pending
priority: p2
issue_id: 330
tags: [code-review, frontend, barrel-exports]
---

# Missing barrel re-exports in master `features/index.ts`

## Problem Statement

The master `features/index.ts` barrel file is missing re-exports for several Wave 2 feature modules: multi-platform, creator-network, business, wellness, and content-shield. This forces consumers to use deep imports instead of the standard barrel pattern, creating inconsistency and fragile import paths.

## Findings

- `packages/frontend/src/features/index.ts` — missing exports for:
  - `multi-platform`
  - `creator-network`
  - `business`
  - `wellness`
  - `content-shield`
- Known issue: `ApiResponse` name collision between modules must be resolved before adding exports

## Proposed Solutions

1. Resolve the `ApiResponse` name collision by renaming one or both exports (e.g., `InboxApiResponse`, `MarketplaceApiResponse`)
2. Add re-exports for all 5 missing feature modules to `features/index.ts`
3. Verify no other name collisions exist across the newly exported modules

## Technical Details

- **Affected Files**: packages/frontend/src/features/index.ts, and potentially individual feature barrel files for renaming collisions

## Acceptance Criteria

- [ ] `ApiResponse` name collision resolved via renaming
- [ ] All 5 missing feature modules re-exported from `features/index.ts`
- [ ] No name collisions between exported modules
- [ ] TypeScript compiles without errors
- [ ] Existing imports continue to work
