---
status: pending
priority: p2
issue_id: '711'
tags: [code-review, frontend, refactor, slice-8]
dependencies: []
---

# Redundant inFlightRef in 2 mutation hooks

## Problem Statement

Both `useFollow.ts` and the `useRequestMentorship` hook use a `useRef(false)` guard to prevent double-clicks on mutation triggers. However, TanStack Query's `isPending` state already prevents concurrent mutations. The `inFlightRef` is redundant and adds unnecessary complexity.

**Agent consensus: 2/9** (Simplicity, Pattern)

## Fix

In `packages/frontend/src/features/creator-network/hooks/useFollow.ts` and the mentorship hook file, remove the `inFlightRef` pattern. Instead, use TanStack Query's `isPending` from the mutation to disable the button/prevent re-invocation. For example: `disabled={followMutation.isPending}` on the trigger element.
