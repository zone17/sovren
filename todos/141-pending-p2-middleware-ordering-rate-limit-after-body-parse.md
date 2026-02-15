---
status: pending
priority: p2
issue_id: '141'
tags:
  - code-review
  - round-7
  - security
  - performance
  - middleware
dependencies: []
---

# 141: Middleware Ordering — Rate Limiting Applied After Body Parsing

## Problem Statement

In `app.ts`, the middleware chain applies body parsing (`express.json()`, `express.urlencoded()`) before rate limiting. This means attackers can send large request bodies that are fully parsed and buffered in memory BEFORE the rate limiter rejects the request. Under a targeted attack, this exhausts memory and CPU on parsing before the rate limiter kicks in.

**Why it matters**: Rate limiting is ineffective against resource exhaustion attacks when body parsing runs first.

## Findings

**Architecture Strategist (Round 7)**: Flagged as P1 — middleware ordering vulnerability.

**Security Sentinel (Round 7)**: Corroborated — rate limit should be first middleware after basic security headers.

**Location**: `packages/backend/src/app.ts` — middleware registration order.

## Proposed Solutions

### Option A: Move Rate Limiter Before Body Parser (Recommended)
**Effort**: Small | **Risk**: Low

Reorder middleware in `app.ts`:
```typescript
// 1. Security headers (helmet)
// 2. CORS
// 3. Rate limiting ← BEFORE body parsing
// 4. Body parsing (json, urlencoded)
// 5. Cookie parsing
// 6. CSRF
// 7. Auth
// 8. Routes
```

**Pros**: Immediate protection, minimal code change
**Cons**: Rate limiter can't use request body for decisions (but it shouldn't need to)

### Option B: Add Request Size Limit First
**Effort**: Small | **Risk**: Low

Add `express.json({ limit: '100kb' })` size cap AND move rate limiter up.

**Pros**: Defense in depth
**Cons**: May need larger limit for media uploads (handle separately)

## Recommended Action

Both options together — reorder middleware AND enforce body size limits.

## Technical Details

**Affected Files**:
- `packages/backend/src/app.ts`

## Acceptance Criteria

- [ ] Rate limiter runs before body parser in `app.ts` middleware chain
- [ ] Body parser has explicit size limit (`express.json({ limit: '100kb' })`)
- [ ] Rate-limited requests (429) never trigger body parsing
- [ ] All existing routes continue to function after middleware reorder
- [ ] Test: large body request (>100kb) gets 413 without body being fully parsed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 architecture + security reviews | Middleware ordering is a security concern |
