---
status: complete
priority: p2
issue_id: 664
tags: [code-review, validation, wellness]
dependencies: []
---

## Problem Statement

The time fields (likely wake_time and sleep_time) in the wellness validator use a regex `^\d{2}:\d{2}$` that only checks for the two-digit colon two-digit format but does not validate semantic correctness. Values like `25:61`, `99:99`, or `00:60` pass validation despite being invalid times.

## Findings

- **Reporter**: security-sentinel (1 agent)
- **File**: `packages/backend/src/validators/wellness.ts:63-64`
- Current regex: `^\d{2}:\d{2}$` matches any two digits, colon, any two digits
- `25:61` passes validation (invalid hour 25, invalid minute 61)
- No semantic check ensures hours are 0-23 and minutes are 0-59
- Invalid time values stored in the database could cause downstream calculation errors (e.g., sleep duration)

## Proposed Solutions

1. **Replace regex with semantically valid HH:MM pattern**: Use `^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$` which enforces hours 00-23 and minutes 00-59.

2. **Use Zod `.refine()` with Date parsing**: Parse the string as a time component and validate via JavaScript Date or a time library, then store the original string format.

3. **Use a dedicated time validation library**: Use a library like `date-fns` or `luxon` to parse and validate the time string, providing better error messages and handling edge cases.

## Recommended Action

## Technical Details

- Current regex at lines 63-64: `^\d{2}:\d{2}$`
- Recommended regex: `^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$`
  - `0[0-9]` matches 00-09
  - `1[0-9]` matches 10-19
  - `2[0-3]` matches 20-23
  - `[0-5][0-9]` matches 00-59
- Both fields (lines 63 and 64) need the same fix
- This is a straightforward regex replacement with no downstream impact on valid data

## Acceptance Criteria

- [ ] Time fields reject hours outside 00-23 range
- [ ] Time fields reject minutes outside 00-59 range
- [ ] Valid times (00:00, 12:30, 23:59) are accepted
- [ ] Invalid times (25:61, 24:00, 12:60) are rejected with clear error messages
- [ ] Both time field validators are updated consistently
- [ ] Existing tests pass; new tests cover boundary values

## Work Log

## Resources

- `packages/backend/src/validators/wellness.ts`
