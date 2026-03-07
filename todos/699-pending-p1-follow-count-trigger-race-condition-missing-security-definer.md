---
status: pending
priority: p1
issue_id: '699'
tags: [code-review, security, database, performance, slice-8]
dependencies: []
---

# Follow count trigger has race condition + missing SECURITY DEFINER

## Problem Statement

The follow count trigger function has two issues:

1. **Race condition**: `COALESCE(follower_count, 0) + 1` is a read-modify-write pattern. Under concurrent follows, count updates will be lost because two transactions can read the same value and both write value+1, losing one increment.

2. **Missing SECURITY DEFINER**: The trigger function uses SECURITY INVOKER by default. If RLS restricts UPDATE on the creators table, the trigger silently fails to update counts without raising an error.

**Agent consensus: 3/9** on SECURITY DEFINER (Security, Data Integrity, Pattern), 1/9 on race (Data Integrity)

## Fix

In `supabase/migrations/20260306000001_follow_count_trigger.sql`:

1. Change `COALESCE(follower_count, 0) + 1` to `SET follower_count = follower_count + 1` (and similarly for decrements). This is atomic in PostgreSQL — the UPDATE lock prevents concurrent reads of stale values.

2. Add `SECURITY DEFINER` to the trigger function declaration so it runs with the function owner's privileges, bypassing RLS restrictions on the creators table.
