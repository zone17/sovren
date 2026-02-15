---
status: pending
priority: p2
issue_id: '025'
tags: [code-review, architecture, performance, simplicity]
dependencies: []
---

# security-headers.ts Overengineered (1,112 lines, Memory Leak, Unused)

## Problem Statement

`security-headers.ts` contains 9 classes and 1,112 lines for what should be a single middleware function. The file is NOT imported or used anywhere -- `app.ts` uses Helmet instead. Critical sub-issues:

1. **Nonce Map memory leak**: `ContentSecurityPolicyManager` stores nonces in an unbounded Map keyed by user-supplied `x-request-id`. At 100 req/s, ~360K entries/hour accumulate. Cleanup is O(n) per request.
2. **Testing utilities in production**: `SecurityHeadersTestingUtils`, `SecurityHeaderEffectivenessTester` are test code in the middleware file.
3. **10,000-event in-memory monitor**: `SecurityHeaderMonitor` stores events with `slice()` creating full copies at the cap.
4. **`require('crypto')` inline**: Called on every request instead of top-level import.
5. **1% sampling compliance check in hot path**: Creates multiple class instances on 1% of requests.

## Findings

- **performance-oracle**: CRITICAL-1 (nonce leak), CRITICAL-2 (require), CRITICAL-3 (event buffer), CRITICAL-4 (per-request rebuild)
- **architecture-strategist**: 1,097 lines of unused dead code
- **pattern-recognition-specialist**: God Object anti-pattern, 9 classes in one file
- **kieran-typescript-reviewer**: HIGH-7 through HIGH-11
- **code-simplicity-reviewer**: Replace with `helmet()` or 30-line function, ~1,050 lines removable

## Proposed Solutions

### Option A: Delete and rely on Helmet (Recommended)

`app.ts` already uses Helmet. Delete `security-headers.ts` entirely.

- **Effort**: Small | **Risk**: None (file is unused)

### Option B: Replace with 60-line middleware

Pre-compute all headers as constants. No classes, no maps, no monitors.

- **Effort**: Small | **Risk**: Low

## Acceptance Criteria

- [ ] `security-headers.ts` deleted or reduced to <100 lines
- [ ] No in-memory nonce storage
- [ ] No testing utilities in production code
- [ ] CSP headers still served correctly via Helmet
