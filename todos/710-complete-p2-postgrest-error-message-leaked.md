---
status: pending
priority: p2
issue_id: '710'
tags: [code-review, backend, security, slice-8]
dependencies: []
---

# PostgREST error.message leaked to clients

## Problem Statement

In the notifications routes, `ValidationError` throws include `error.message` from Supabase PostgREST responses. These messages may contain internal table names, column names, or constraint details that should not be exposed to clients.

**Agent consensus: 1/9** (Security)

## Fix

In `packages/backend/src/routes/v2/notifications.routes.ts`, replace `error.message` in client-facing ValidationError throws with generic error messages (e.g., "Failed to update notification" or "Invalid notification request"). Log the original `error.message` server-side for debugging.
