---
status: complete
priority: p2
issue_id: 673
tags: [code-review, stub, data-integrity, wellness, boundary]
dependencies: []
---

## Problem Statement

The `engagement_used_mins` field in BoundaryService returns a hardcoded `0`, providing misleading data to consumers. Users/agents relying on this value to make decisions about engagement boundaries receive false information (always appearing to have zero engagement). The stub is not marked as unimplemented, so consumers have no way to distinguish "zero engagement" from "not yet computed."

## Findings

- **Reporter**: agent-native-reviewer (1 agent)
- **File**: `packages/backend/src/services/wellness/BoundaryService.ts`
- `engagement_used_mins` returns hardcoded `0`
- No computation logic exists for actual engagement minutes
- Consumers (frontend, other services) receive `0` and may display it as real data
- No flag or sentinel value indicates the data is a stub
- Could lead to incorrect UX decisions (e.g., "you have 0 minutes of engagement today" when the feature is just unimplemented)

## Proposed Solutions

1. **Return null with a flag indicating not-yet-available**: Change the return value to `engagement_used_mins: null` and add a field like `engagement_tracking_available: false`. Frontend can display "Coming soon" or hide the metric. This is honest and prevents false data display.

2. **Implement real computation**: Query actual engagement data (session durations, activity logs) to compute the real value. This completes the feature but may be out of scope for the current slice.

3. **Remove the field from the response**: If the feature is not ready, stop returning `engagement_used_mins` entirely. Add it back when the computation is implemented. This avoids the stub problem but may break existing frontend code.

## Recommended Action

## Technical Details

- Current implementation returns something like:
  ```typescript
  engagement_used_mins: 0;
  ```
- Option 1 would change to:
  ```typescript
  engagement_used_mins: null,
  engagement_tracking_available: false
  ```
- The interface/type for the boundary response needs updating to reflect nullability
- Frontend components displaying engagement minutes need to handle null (show placeholder, hide metric)
- If the computation source (engagement/session data) does not yet exist, option 1 is the pragmatic choice

## Acceptance Criteria

- [ ] `engagement_used_mins` no longer returns misleading hardcoded `0`
- [ ] If null returned: frontend handles null gracefully (placeholder, hidden, or "coming soon")
- [ ] If computed: value reflects actual engagement data
- [ ] If removed: frontend does not break on missing field
- [ ] TypeScript types updated to match the chosen approach
- [ ] Existing tests pass; new test covers the updated behavior

## Work Log

## Resources

- `packages/backend/src/services/wellness/BoundaryService.ts`
- `packages/backend/src/interfaces/wellness/IBoundaryService.ts`
- critical-patterns.md #10b (silent fallback logging — related pattern)
