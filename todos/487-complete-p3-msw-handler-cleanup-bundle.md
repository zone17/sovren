---
status: pending
priority: p3
issue_id: "487"
tags:
  - code-review
  - msw
  - cleanup
  - phase-9
dependencies:
  - "479"
  - "480"
  - "481"
  - "482"
---

# MSW handler cleanup bundle (P3 items)

## Problem Statement

Collection of P3 findings from 7 review agents. Individually minor, collectively improve handler quality.

## Findings

### 1. Lightning invoice response duplication (2/7 agents)
`lightning.ts` defines nearly identical response objects for create and get invoice. Extract a factory function.

### 2. Auth user objects duplicated 3x (2/7 agents)
Same `{ id, email/npub, displayName }` shape repeated in multiple auth handlers. Extract a constant.

### 3. Dynamic timestamps across handlers (1/7 agents)
`new Date().toISOString()` in handlers produces non-deterministic responses. Use a fixed timestamp constant for predictable assertions.

### 4. Speculative handlers — 60% may be removable (1/7 agents, simplicity reviewer)
Many handlers define endpoints that no current test exercises. Consider removing speculative handlers and adding only when tests need them (YAGNI). This is deferred until actual test migration begins.

### 5. Missing explicit return type on renderWithAll (1/7 agents)
Function should declare return type for better IDE support and documentation.

### 6. Cross-package import path fragility (2/7 agents)
`vitest-frontend-setup.ts` imports from `../packages/frontend/src/test-utils/msw/server` — a relative path across package boundaries. Consider a path alias or moving the setup file.

## Proposed Solutions

Items 1-3 and 5: Fix during P1/P2 remediation as drive-by improvements.
Item 4: Defer to actual test migration — remove unused handlers then.
Item 6: Evaluate when path aliases are configured.

## Acceptance Criteria

- [ ] No duplicated response objects in handlers
- [ ] Fixed timestamp constant for test predictability
- [ ] Explicit return type on `renderWithAll`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-24 | Created from Phase 9 MSW review | Bundle low-severity items to avoid todo proliferation |
