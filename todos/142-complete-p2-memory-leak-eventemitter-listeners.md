---
status: pending
priority: p2
issue_id: '142'
tags:
  - code-review
  - round-7
  - performance
  - memory-leak
dependencies: []
---

# 142: Memory Leak via Unremoved EventEmitter Listeners

## Problem Statement

Multiple services register EventEmitter listeners (via `.on()` or `.addListener()`) but never remove them during shutdown or service disposal. Over time, or with hot-reload in development, listeners accumulate and leak memory. Node.js warns at 11 listeners per event, but the services may not hit this threshold until significant memory is consumed.

**Why it matters**: In long-running production processes, leaked listeners cause gradual memory growth, eventually leading to OOM kills.

## Findings

**Performance Oracle (Round 7)**: Flagged as CRITICAL — memory leak via EventEmitter without lifecycle management.

**Pattern Recognition (Round 7)**: Corroborated — 20 EventEmitters without lifecycle cleanup detected.

**Key Locations**:
- Services using `process.on('SIGTERM', ...)` without corresponding `removeListener`
- Services registering on custom event buses without cleanup
- TTLCache `onEvict` callbacks (these are fine — tied to cache lifetime)

## Proposed Solutions

### Option A: AbortController Pattern (Recommended)
**Effort**: Medium | **Risk**: Low

Use `AbortController` signals tied to service lifecycle:
```typescript
class MyService {
  private abortController = new AbortController();

  initialize() {
    process.on('SIGTERM', this.handleShutdown, { signal: this.abortController.signal });
  }

  dispose() {
    this.abortController.abort(); // Removes all listeners
  }
}
```

**Pros**: Modern API, automatic cleanup
**Cons**: Requires Node.js 18+ (already met)

### Option B: Manual removeListener on Shutdown
**Effort**: Medium | **Risk**: Low

Track registered listeners and remove them in shutdown handler.

**Pros**: Works on any Node version
**Cons**: Easy to forget, manual tracking is error-prone

## Recommended Action

Option A for new code. Option B for quick fix on existing services.

## Technical Details

**Affected Files**:
- All backend services with EventEmitter usage (audit needed)
- `packages/backend/src/services/lightning-service.ts`
- `packages/backend/src/services/subscription-management-service.ts`

## Acceptance Criteria

- [ ] All EventEmitter `.on()` / `.addListener()` calls have corresponding cleanup in `dispose()` / `shutdown()`
- [ ] Services with EventEmitter usage implement a `dispose()` method
- [ ] Shutdown handler calls `dispose()` on all registered services
- [ ] No `MaxListenersExceededWarning` emitted during normal operation
- [ ] Test: verify listener count on process EventEmitter stays bounded after service init + dispose cycle

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 performance + pattern reviews | EventEmitter lifecycle is often overlooked |
