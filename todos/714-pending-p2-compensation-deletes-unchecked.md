---
status: pending
priority: p2
issue_id: '714'
tags: [code-review, backend, data-integrity, slice-8]
dependencies: []
---

# Compensation DELETEs unchecked in joinCircle/requestMentorship

## Problem Statement

When insert-then-verify finds over-capacity in `joinCircle()` and `requestMentorship()`, the compensation DELETE doesn't check its own error. This matches the known anti-pattern from critical-patterns.md #4c — compensation operations can themselves fail, and if they do, the failure is silently swallowed.

**Agent consensus: 1/9** (Data Integrity) — existing pattern from critical-patterns.md #4c

## Fix

In `CreatorCircleService.ts` (`joinCircle`) and `MentorshipService.ts` (`requestMentorship`), destructure `{ error }` from the compensation DELETE call. If the compensation fails, log the error with recovery context (e.g., the record ID that failed to delete) and rethrow the original error unconditionally.
