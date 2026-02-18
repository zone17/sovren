---
status: pending
priority: p3
issue_id: "218"
tags: [code-review, pr-85, dead-code]
---

# Unused Schemas and Types

## Problem Statement
ConnectBodySchema in validators/distribution.ts defined but unused. PlatformDisplayInfo has unused fields (id, icon, charLimit). PublishPayload.repurposed_version_ids unused. AnalyticsContentIdParamSchema duplicates ContentIdParamSchema.

## Findings
- File: `packages/backend/src/validators/distribution.ts` — `ConnectBodySchema` is defined but never imported or used by any route
- File: `packages/frontend/src/features/multi-platform/types/index.ts` — `PlatformDisplayInfo` has fields `id`, `icon`, and `charLimit` that are never read
- File: `packages/frontend/src/features/multi-platform/types/index.ts` — `PublishPayload.repurposed_version_ids` field is defined but never set or read
- File: `packages/backend/src/validators/distribution.ts` — `AnalyticsContentIdParamSchema` duplicates `ContentIdParamSchema` with identical shape

## Proposed Solutions
1. Remove `ConnectBodySchema`, unused `PlatformDisplayInfo` fields, `PublishPayload.repurposed_version_ids`, and `AnalyticsContentIdParamSchema` (replace with `ContentIdParamSchema` at call sites)
2. If any of these are planned for future use, add TODO comments with ticket references explaining when they will be wired in

## Acceptance Criteria
- [ ] `ConnectBodySchema` is removed or wired into a route handler
- [ ] Unused fields on `PlatformDisplayInfo` and `PublishPayload` are removed
- [ ] `AnalyticsContentIdParamSchema` is replaced with `ContentIdParamSchema` at all call sites
- [ ] No new TypeScript compilation errors are introduced
