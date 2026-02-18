---
status: pending
priority: p2
issue_id: "198"
tags: [code-review, pr-85, resource-management]
---

# Module-Level setInterval Leaks Without Cleanup

## Problem Statement
Module-level setInterval for OAuth state cleanup (5min interval) at PlatformConnectionService.ts:27-34 leaks in tests, blocks graceful shutdown, and runs even if the service is unused.

## Findings
- **File**: `packages/backend/src/services/distribution/PlatformConnectionService.ts:27-34`
- A `setInterval` call at module scope runs every 5 minutes to clean up expired OAuth state entries
- The interval is created as soon as the module is imported, regardless of whether PlatformConnectionService is actually instantiated or used
- No `clearInterval` is ever called, meaning:
  - Tests that import this module will have a leaked timer (jest `--detectOpenHandles` will flag it)
  - Graceful shutdown cannot clear the interval since there is no reference to it
  - The interval continues running even if the service is garbage collected

## Proposed Solutions
1. Move the cleanup interval into an instance method (e.g., `startCleanupLoop()`) called during service initialization, with a corresponding `stopCleanupLoop()` called during shutdown. Store the interval ID on the instance.
2. Replace the periodic cleanup with a TTLCache or Map with lazy eviction — check and remove expired entries only when the map is accessed, eliminating the need for a background timer entirely.

## Acceptance Criteria
- [ ] No module-level setInterval exists in PlatformConnectionService
- [ ] OAuth state cleanup still occurs (either via instance method or lazy eviction)
- [ ] Graceful shutdown clears any active intervals
- [ ] Tests importing this module do not leak timers (jest --detectOpenHandles passes)
