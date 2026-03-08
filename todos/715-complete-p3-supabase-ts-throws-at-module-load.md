---
status: pending
priority: p3
issue_id: '715'
tags: [code-review, frontend, architecture, slice-8]
dependencies: []
---

# supabase.ts throws at module load time

## Problem Statement

`packages/frontend/src/services/supabase.ts` throws an error at module load time if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` environment variables are missing. This crashes the entire application on import, even for pages that don't need Supabase Realtime functionality.

**Agent consensus: 1/9** (Architecture)

## Fix

In `packages/frontend/src/services/supabase.ts`, change from throwing at module load to lazy initialization. Either return `null` with runtime checks at usage sites, or use a lazy singleton pattern that only throws when the client is actually accessed (not when the module is imported).
