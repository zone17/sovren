---
status: complete
priority: p2
issue_id: 667
tags: [code-review, data-integrity, pagination, finance]
dependencies: []
---

## Problem Statement

The export row accumulation loop in TaxService checks `MAX_EXPORT_ROWS` after pushing rows to the array. This means the array can contain up to `MAX_EXPORT_ROWS + PAGE_SIZE - 1` rows (50,499 if PAGE_SIZE=500 and MAX_EXPORT_ROWS=50000). The cap is not enforced precisely, leading to oversized exports.

## Findings

- **Reporter**: data-integrity-guardian (1 agent)
- **File**: `packages/backend/src/services/finance/TaxService.ts:420-430`
- The loop fetches pages of rows and pushes them all to an accumulator array
- The MAX_EXPORT_ROWS check happens after the push operation
- A final page could push up to PAGE_SIZE-1 extra rows beyond the cap
- This could cause larger-than-expected CSV files and increased memory usage

## Proposed Solutions

1. **Check before push, slice to exact cap**: Before pushing the page results, check if adding them would exceed the cap. If so, slice the page results to only include rows up to MAX_EXPORT_ROWS and break the loop.

2. **Check remaining capacity before fetch**: Calculate `remaining = MAX_EXPORT_ROWS - rows.length` before each fetch. Set the page limit to `Math.min(PAGE_SIZE, remaining)` so the database only returns what's needed.

3. **Post-loop truncation**: After the loop completes, truncate the array to MAX_EXPORT_ROWS with `rows.length = MAX_EXPORT_ROWS` or `rows.slice(0, MAX_EXPORT_ROWS)`. Simple but still fetches unnecessary data.

## Recommended Action

## Technical Details

- Current flow (lines 420-430):
  ```typescript
  rows.push(...pageResults); // Push first
  if (rows.length >= MAX_EXPORT_ROWS) break; // Check after
  ```
- Fix (option 1):
  ```typescript
  const remaining = MAX_EXPORT_ROWS - rows.length;
  if (pageResults.length <= remaining) {
    rows.push(...pageResults);
  } else {
    rows.push(...pageResults.slice(0, remaining));
    break;
  }
  ```
- Option 2 is more efficient as it avoids fetching unnecessary rows from the DB
- MAX_EXPORT_ROWS likely 50,000; PAGE_SIZE likely 500; overshoot up to 499 rows

## Acceptance Criteria

- [ ] Export never produces more than MAX_EXPORT_ROWS rows
- [ ] Final page is sliced to exact cap boundary
- [ ] No unnecessary database queries for rows that will be discarded
- [ ] Existing tests pass; new test verifies exact cap enforcement at boundary

## Work Log

## Resources

- `packages/backend/src/services/finance/TaxService.ts`
- common-solutions.md (paginated accumulation pattern)
