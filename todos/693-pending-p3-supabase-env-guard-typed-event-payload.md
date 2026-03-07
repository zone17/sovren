---
status: pending
priority: p3
issue_id: "693"
tags: [code-review, frontend, backend, typescript, slice-8]
dependencies: ["684"]
---

# supabase.ts missing env var guard + event handler uses untyped payload

## Problem Statement

Two type-safety issues:
1. `supabase.ts:8-11` uses `as string` cast on env vars — passes `undefined` silently to `createClient` when vars missing
2. `NotificationPersistenceService.ts:99-103` types event handler param as `Record<string, unknown>` instead of `CommunityEventPayload` discriminated union, enabling unsafe casts

**Agent consensus: 2/8 each** (Security + TypeScript)

## Fix

### supabase.ts
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
}
```

### Event handler
Change param type to `DomainEvent<CommunityEventPayload>` and remove unsafe `as` casts in switch cases.

## Acceptance Criteria

- [ ] Missing Supabase env vars throw at startup, not silently fail
- [ ] Event handler uses typed payload with discriminated union
- [ ] No `as Record<string, unknown>` casts in event handler
