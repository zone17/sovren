---
status: complete
priority: p2
issue_id: '276'
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Promise<any[]> Return Types Across 20+ Interface Methods

## Problem Statement

Over 20 interface methods across community and finance interfaces return Promise<any[]> instead of typed arrays. This defeats TypeScript's type system and allows silent data shape mismatches.

## Findings

- `packages/backend/src/interfaces/community/ICreatorCircleService.ts` — multiple any[] returns
- `packages/backend/src/interfaces/community/IMentorshipService.ts` — same
- `packages/backend/src/interfaces/community/ICollaborativeContentService.ts` — same
- `packages/backend/src/interfaces/finance/IContractService.ts` — same
- `packages/backend/src/interfaces/finance/IInvoicingService.ts` — same

## Proposed Solutions

### Option 1: Define return types for all methods

**Approach:** Create typed interfaces for each entity (Circle, MentorshipRequest, etc.) and replace Promise<any[]> with Promise<Circle[]> etc.
**Effort:** 3-4h **Risk:** Low

## Acceptance Criteria

- [ ] Zero Promise<any[]> return types in interfaces
- [ ] All entities have TypeScript interfaces
- [ ] Service implementations match new return types

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
