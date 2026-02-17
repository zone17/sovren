---
status: pending
priority: p2
issue_id: "157"
tags: [code-review, pr-82, phase-7, typescript, duplication, dry]
dependencies: []
---

# 8x Duplicated SupabaseClient Interface

## Problem Statement
The `SupabaseClient` interface is defined 8 times across Phase 7 service files instead of being imported from a shared location. Changes to the interface require updating 8 files.

## Findings
- Each of the 8 Phase 7 services defines its own `interface SupabaseClient { from(table: string): any; rpc(fn: string, params: any): any; }`
- Found in: WellnessService, BurnoutScoringService, ScheduleService, BoundaryService, ProvenanceService, FingerprintService, AlertService, DmcaService
- All definitions are identical
- Flagged by: kieran-typescript-reviewer, code-simplicity-reviewer, pattern-recognition-specialist

## Proposed Solutions
### Option 1: Shared Interface in Types (Recommended)
**Approach:** Create `packages/backend/src/interfaces/shared/ISupabaseClient.ts` and import in all 8 services.
**Pros:** Single source of truth, DRY
**Cons:** None
**Effort:** 30 minutes
**Risk:** Low

## Technical Details
- All 8 Phase 7 service files in `packages/backend/src/services/wellness/` and `packages/backend/src/services/provenance/`

## Acceptance Criteria
- [ ] Single SupabaseClient interface definition
- [ ] All 8 services import from shared location
- [ ] No duplicate interface definitions remain

## Resources
- **PR:** #82
- **Agents:** kieran-typescript-reviewer, code-simplicity-reviewer, pattern-recognition-specialist

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: typescript, duplication, dry
