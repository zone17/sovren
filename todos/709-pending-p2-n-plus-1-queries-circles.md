---
status: pending
priority: p2
issue_id: '709'
tags: [code-review, backend, performance, slice-8]
dependencies: []
---

# N+1 queries in getCircles and getSuggestedCircles

## Problem Statement

`getCircles()` runs 3 sequential queries (memberships, then created circles, then joined circles). `getSuggestedCircles()` similarly runs 3 sequential queries. These could be combined into fewer queries for better performance.

**Agent consensus: 2/9** (Performance, Agent-Native)

## Fix

In `packages/backend/src/services/community/CreatorCircleService.ts`, refactor `getCircles()` and `getSuggestedCircles()` to combine their sequential queries into single queries with joins, or use Supabase RPC functions to perform the logic server-side. This reduces 3 round trips to 1 per method.
