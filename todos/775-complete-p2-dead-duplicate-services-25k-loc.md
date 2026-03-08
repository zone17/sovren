---
status: pending
priority: p2
issue_id: 775
tags: [code-review, simplicity, dead-code, duplication]
dependencies: []
---

# Dead/Duplicate Services — ~25,000 LOC Removable

## Problem Statement

The codebase contains extensive dead code and service duplication: quality-metrics-service (1,188 LOC, zero consumers), 4 recommendation services (2,580 LOC), duplicate ContentModerationService, duplicate webhooks/sessions/ai-recommendations routes, duplicate subscription/session services, social-media-integration (1,169 LOC, zero consumers), email-integration (1,079 LOC speculative), plus stale root files.

## Findings

- **Simplicity Agent**: P1-02 through P1-07, P2-01 through P2-08

### Safe Immediate Deletion (Zero Consumers)

- quality-metrics-service.ts (1,188 LOC)
- social-media-integration-service.ts (1,169 LOC)
- creator-recommendation-service.ts (672 LOC)
- webhooks-race-condition-hardened.ts (693 LOC)
- app.js.OLD (2,783 LOC)
- update-us-e4-009.cjs, update-wave-2b-complete.cjs
- package-lock 6.json, styles.css (root)
- navigationSlice.ts, paginationSlice.ts (zero consumers)

## Acceptance Criteria

- [ ] Zero-consumer files deleted
- [ ] Duplicate services consolidated (pick one per domain)
- [ ] ~15,000+ LOC removed in Phase 1
