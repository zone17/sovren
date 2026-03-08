---
status: pending
priority: p1
issue_id: '698'
tags: [code-review, security, backend, database, slice-8]
dependencies: []
---

# Notifications INSERT RLS allows any user

## Problem Statement

The `notifications_insert_service` RLS policy on the notifications table uses `WITH CHECK (TRUE)`, which means any authenticated user can insert arbitrary notifications into any other user's inbox. This is a privilege escalation — only the backend (service_role) should be able to create notifications.

**Agent consensus: 5/9** (Security, Data Integrity, Architecture, Pattern, Simplicity)

## Fix

In `supabase/migrations/20260306000000_notifications.sql`, change the `notifications_insert_service` policy from `WITH CHECK (TRUE)` to `WITH CHECK (auth.role() = 'service_role')`. This ensures only the backend service can insert notifications, not arbitrary authenticated users.
