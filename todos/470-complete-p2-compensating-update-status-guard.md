---
status: complete
priority: p2
issue_id: '470'
tags: [code-review, data-integrity]
dependencies: []
---

# Add status guard to compensating update in CrossPostService.publish()

## Problem Statement

The compensating update that marks un-enqueued rows as `failed` doesn't filter by current status. If a row's status was changed between insert and the compensating update (e.g., by a concurrent processor picking up the BullMQ job), the update could overwrite a valid status with `failed`.

## Resolution

Added `.in('status', ['queued', 'scheduled'])` to the compensating update chain in `CrossPostService.ts`. Updated the test mock to verify the status filter is chained after the ID filter.

## Acceptance Criteria

- [x] Compensating update includes `.in('status', ['queued', 'scheduled'])` guard
- [x] Test updated to verify status guard is applied
- [x] Tests pass (11/11)

## Resources

- **PR:** #96
- **Pattern:** critical-patterns.md #7 (status guards)
