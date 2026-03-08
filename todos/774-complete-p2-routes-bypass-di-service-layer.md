---
status: pending
priority: p2
issue_id: 774
tags: [code-review, architecture, di, service-layer]
dependencies: []
---

# Routes Bypass DI and Service Layer for Direct DB Access

## Problem Statement

Multiple routes create Supabase clients directly, bypassing the DI container and service layer. This breaks the architecture pattern (Route → Middleware → Service → Repository → Supabase) and makes testing and security auditing harder.

## Findings

- **Architecture Agent**: P1-04 — webhooks.ts, health.ts, unified-sessions.ts

## Proposed Solutions

Route all DB access through the service/repository layer. Routes should only interact with injected services.

## Acceptance Criteria

- [ ] No direct Supabase client creation in route files
- [ ] All DB access through service/repository layer
- [ ] Existing functionality preserved
