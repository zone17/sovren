---
status: pending
priority: p2
issue_id: '706'
tags: [code-review, backend, performance, slice-8]
dependencies: []
---

# getFollowCounts does COUNT queries instead of reading trigger columns

## Problem Statement

The follow count trigger maintains `follower_count` and `following_count` columns on the creators table, but `getFollowCounts()` in FollowService ignores those pre-computed columns and runs 2 separate `COUNT(*)` queries against the follows table instead. This is unnecessarily expensive, especially as the follows table grows.

**Agent consensus: 3/9** (Performance, Simplicity, Data Integrity)

## Fix

In `packages/backend/src/services/community/FollowService.ts`, update `getFollowCounts()` to read `follower_count` and `following_count` directly from the creators table instead of running COUNT queries against the follows table. This leverages the work the trigger already does and reduces the query from O(n) to O(1).
